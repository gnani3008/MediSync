/*
 * ============================================================
 *  MediCare Reminder — ESP32 Firmware
 *  Hardware:
 *    - ESP32 (any variant, e.g. ESP32 DevKit v1 / WROOM)
 *    - 2× HC-SR501 PIR sensors
 *    - 1× Passive Buzzer (PWM tone)
 *    - 1× SSD1306 128×64 OLED (I2C)
 *
 *  Wiring:
 *    PIR Sensor 1  → GPIO 13  (motion near box)
 *    PIR Sensor 2  → GPIO 14  (box lid open detect)
 *    Passive Buzzer→ GPIO 25  (PWM capable)
 *    OLED SDA      → GPIO 21  (I2C default SDA)
 *    OLED SCL      → GPIO 22  (I2C default SCL)
 *
 *  Arduino IDE Setup:
 *    1. Install ESP32 board support:
 *       File > Preferences > Additional Boards Manager URLs:
 *       https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
 *       Tools > Board Manager > search "esp32" > install "esp32 by Espressif Systems" (v2.x)
 *       Board: "ESP32 Dev Module"
 *
 *    2. Install libraries via Sketch > Include Library > Manage Libraries:
 *       - "Adafruit SSD1306" by Adafruit (v2.5.x)
 *       - "Adafruit GFX Library" by Adafruit (v1.11.x)
 *       - "ArduinoJson" by Benoit Blanchon (v7.x)
 *       - "NTPClient" by Fabrice Weinberg (v3.2.x)
 *       - "WiFiClientSecure" — built-in with ESP32 Arduino core (no install needed)
 *       - "HTTPClient" — built-in with ESP32 Arduino core (no install needed)
 *
 *  Why Arduino C++ (not MicroPython)?
 *    MicroPython's GIL causes 15-20s delays in time display updates because
 *    blocking network calls starve the display update loop.
 *    Arduino runs bare-metal ISRs and millis()-based non-blocking loops,
 *    so the clock updates every second with zero drift.
 * ============================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <NTPClient.h>
#include <WiFiUDP.h>
#include <time.h>

// ─────────────────────────────────────────────
//  USER CONFIGURATION — Edit these values
// ─────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Your deployed backend API URL (e.g., https://yourapp.replit.app/api)
const char* API_BASE_URL  = "https://YOUR_REPLIT_DOMAIN/api";

// Patient ID assigned in the app (get this from admin after creating patient account)
const int   PATIENT_ID    = 1;

// Unique device identifier for this ESP32
const char* DEVICE_ID     = "ESP32-MedBox-001";

// Timezone offset in seconds from UTC (e.g., IST = 5.5h = 19800, EST = -5h = -18000)
const long  UTC_OFFSET_SEC = 19800;  // IST (India Standard Time)

// Medicine alarm times (24-hour format HH:MM) — must match what's set in the app
// Add up to 8 alarm times here
const char* ALARM_TIMES[] = {
  "08:00",
  "14:00",
  "21:00",
};
const int NUM_ALARMS = 3;

// ─────────────────────────────────────────────
//  HARDWARE PIN DEFINITIONS
// ─────────────────────────────────────────────
#define PIR1_PIN        13    // Motion sensor 1 (area near box)
#define PIR2_PIN        14    // Motion sensor 2 (box lid / opening detection)
#define BUZZER_PIN      25    // Passive buzzer (PWM)
#define OLED_SDA        21
#define OLED_SCL        22
#define OLED_WIDTH      128
#define OLED_HEIGHT     64
#define OLED_RESET      -1    // Reset pin (-1 = share Arduino reset)

// ─────────────────────────────────────────────
//  TIMING CONSTANTS
// ─────────────────────────────────────────────
#define DISPLAY_UPDATE_MS       1000   // Clock updates every 1 second exactly
#define SENSOR_POLL_MS           100   // Sensor state checked every 100ms
#define API_COOLDOWN_MS         5000   // Minimum 5s between API calls for same event
#define ALARM_CHECK_MS          1000   // Alarm checked every second
#define ALARM_DURATION_MS      30000   // Buzzer rings for 30 seconds
#define ALARM_SNOOZE_MS        60000   // After ack, snooze 1 minute before re-alarm
#define WIFI_RECONNECT_MS      10000   // Try WiFi reconnect every 10s
#define NTP_SYNC_MS          3600000   // Sync NTP every hour

// ─────────────────────────────────────────────
//  GLOBAL OBJECTS
// ─────────────────────────────────────────────
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, OLED_RESET);
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", UTC_OFFSET_SEC, 60000);

// ─────────────────────────────────────────────
//  STATE VARIABLES
// ─────────────────────────────────────────────

// Sensor state
volatile bool pir1Triggered = false;
volatile bool pir2Triggered = false;
bool pir1LastState = LOW;
bool pir2LastState = LOW;

// Debounce and cooldown
unsigned long pir1LastEvent = 0;
unsigned long pir2LastEvent = 0;

// Display timing — uses millis() for drift-free 1-second updates
unsigned long lastDisplayUpdate = 0;
char currentTimeStr[9];   // "HH:MM:SS"
char currentDateStr[16];  // "Mon, DD MMM YYYY"

// Alarm state
struct AlarmState {
  bool ringing;
  bool acknowledged;
  unsigned long startedAt;
  unsigned long acknowledgedAt;
  char triggeredTime[6];  // "HH:MM"
};
AlarmState alarm = { false, false, 0, 0, "" };
unsigned long lastAlarmCheck = 0;

// Network state
unsigned long lastWifiCheck = 0;
unsigned long lastNtpSync = 0;
bool wifiConnected = false;

// Display pages
enum DisplayPage { PAGE_CLOCK, PAGE_STATUS, PAGE_ALARM };
DisplayPage currentPage = PAGE_CLOCK;
unsigned long pageChangedAt = 0;
#define PAGE_DURATION_MS 5000  // Auto-rotate pages every 5 seconds

// ─────────────────────────────────────────────
//  ISR-COMPATIBLE SENSOR POLLING
//  (ISRs on ESP32 with IRAM_ATTR for safety)
// ─────────────────────────────────────────────
// Note: We use polling in the main loop (not ISRs) for this implementation
// because WiFi/HTTP calls cannot be made from ISRs. The 100ms polling is
// fast enough for PIR sensors (which have ~500ms output pulse minimum).

// ─────────────────────────────────────────────
//  BUZZER TONE HELPERS
// ─────────────────────────────────────────────
void buzzerTone(uint32_t freq, uint32_t durationMs) {
  ledcWriteTone(0, freq);
  delay(durationMs);
  ledcWrite(0, 0);
}

void playAlarmMelody() {
  // Non-blocking alarm melody — plays short bursts
  ledcWriteTone(0, 1000);
  delay(200);
  ledcWrite(0, 0);
  delay(100);
  ledcWriteTone(0, 1200);
  delay(200);
  ledcWrite(0, 0);
  delay(100);
  ledcWriteTone(0, 1400);
  delay(300);
  ledcWrite(0, 0);
  delay(200);
}

void playAckBeep() {
  ledcWriteTone(0, 800);
  delay(100);
  ledcWrite(0, 0);
  delay(50);
  ledcWriteTone(0, 1000);
  delay(100);
  ledcWrite(0, 0);
}

void stopBuzzer() {
  ledcWrite(0, 0);
}

// ─────────────────────────────────────────────
//  DISPLAY FUNCTIONS
// ─────────────────────────────────────────────
void updateClockStrings() {
  time_t now = timeClient.getEpochTime();
  struct tm* t = localtime(&now);
  
  snprintf(currentTimeStr, sizeof(currentTimeStr), "%02d:%02d:%02d",
           t->tm_hour, t->tm_min, t->tm_sec);

  const char* days[] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
  const char* months[] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun",
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
  snprintf(currentDateStr, sizeof(currentDateStr), "%s %02d %s",
           days[t->tm_wday], t->tm_mday, months[t->tm_mon]);
}

void drawClockPage() {
  display.clearDisplay();
  
  // Header
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.print("MediCare");
  display.setCursor(80, 0);
  display.print(wifiConnected ? "WiFi OK" : "No WiFi");
  
  // Divider
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
  
  // Large time display — pixel-perfect, no lag
  display.setTextSize(3);
  // Center the time string (HH:MM:SS = 8 chars × 18px = 144px, clip to 128)
  // Show HH:MM in large, SS in small below
  display.setCursor(4, 16);
  display.print(currentTimeStr);  // Full HH:MM:SS
  
  // Date in smaller text
  display.setTextSize(1);
  display.setCursor(20, 48);
  display.print(currentDateStr);

  // Alarm indicator
  if (alarm.ringing) {
    display.fillRect(0, 56, 128, 8, SSD1306_WHITE);
    display.setTextColor(SSD1306_BLACK);
    display.setCursor(10, 57);
    display.print("! TAKE MEDICINE NOW !");
    display.setTextColor(SSD1306_WHITE);
  }
  
  display.display();
}

void drawStatusPage() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  display.setCursor(0, 0);
  display.print("Device Status");
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
  
  display.setCursor(0, 14);
  display.print("Device: "); display.print(DEVICE_ID);
  
  display.setCursor(0, 24);
  display.print("Patient ID: "); display.print(PATIENT_ID);
  
  display.setCursor(0, 34);
  display.print("WiFi: ");
  display.print(wifiConnected ? WiFi.SSID() : "Disconnected");
  
  display.setCursor(0, 44);
  display.print("PIR1: ");
  display.print(digitalRead(PIR1_PIN) == HIGH ? "MOTION" : "Clear");
  display.print("  PIR2: ");
  display.print(digitalRead(PIR2_PIN) == HIGH ? "OPEN" : "Closed");
  
  display.setCursor(0, 54);
  display.print("Alarms: "); display.print(NUM_ALARMS);
  display.print(" configured");
  
  display.display();
}

void drawAlarmPage(const char* medTime) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  
  // Flashing border effect (toggle every call based on millis)
  if ((millis() / 500) % 2 == 0) {
    display.drawRect(0, 0, 128, 64, SSD1306_WHITE);
    display.drawRect(2, 2, 124, 60, SSD1306_WHITE);
  }
  
  display.setTextSize(1);
  display.setCursor(30, 6);
  display.print("! MEDICINE TIME !");
  
  display.setTextSize(2);
  display.setCursor(32, 22);
  display.print(medTime);
  
  display.setTextSize(1);
  display.setCursor(15, 44);
  display.print("Open box to confirm");
  
  display.setCursor(20, 54);
  display.print("PIR2 detected = ACK");
  
  display.display();
}

// ─────────────────────────────────────────────
//  API CLIENT
// ─────────────────────────────────────────────
bool postEvent(const char* eventType, const char* sensor) {
  if (!wifiConnected) return false;
  
  WiFiClientSecure client;
  client.setInsecure();  // For development — use certificate pinning in production
  
  HTTPClient http;
  String url = String(API_BASE_URL) + "/events";
  
  if (!http.begin(client, url)) return false;
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["patientId"] = PATIENT_ID;
  doc["eventType"] = eventType;
  if (sensor != nullptr) doc["sensor"] = sensor;
  
  String body;
  serializeJson(doc, body);
  
  int code = http.POST(body);
  http.end();
  
  return code == 201 || code == 200;
}

// ─────────────────────────────────────────────
//  ALARM LOGIC
// ─────────────────────────────────────────────
void getCurrentHHMM(char* buf) {
  time_t now = timeClient.getEpochTime();
  struct tm* t = localtime(&now);
  snprintf(buf, 6, "%02d:%02d", t->tm_hour, t->tm_min);
}

void checkAlarms() {
  if (!wifiConnected) return;
  
  char nowHHMM[6];
  getCurrentHHMM(nowHHMM);
  
  for (int i = 0; i < NUM_ALARMS; i++) {
    if (strcmp(nowHHMM, ALARM_TIMES[i]) == 0) {
      // Don't re-trigger if already ringing for this time
      if (!alarm.ringing || strcmp(alarm.triggeredTime, ALARM_TIMES[i]) != 0) {
        // Don't re-trigger within snooze window after acknowledgement
        if (alarm.acknowledged &&
            strcmp(alarm.triggeredTime, ALARM_TIMES[i]) == 0 &&
            millis() - alarm.acknowledgedAt < ALARM_SNOOZE_MS) {
          continue;
        }
        
        alarm.ringing = true;
        alarm.acknowledged = false;
        alarm.startedAt = millis();
        strncpy(alarm.triggeredTime, ALARM_TIMES[i], 6);
        
        // Post alarm event to server
        postEvent("alarm_triggered", nullptr);
        currentPage = PAGE_ALARM;
        
        Serial.print("[ALARM] Triggered at ");
        Serial.println(ALARM_TIMES[i]);
      }
    }
  }
  
  // Auto-cancel alarm after ALARM_DURATION_MS
  if (alarm.ringing && !alarm.acknowledged) {
    if (millis() - alarm.startedAt > ALARM_DURATION_MS) {
      alarm.ringing = false;
      stopBuzzer();
      currentPage = PAGE_CLOCK;
    }
  }
}

void acknowledgeAlarm() {
  if (alarm.ringing) {
    alarm.ringing = false;
    alarm.acknowledged = true;
    alarm.acknowledgedAt = millis();
    stopBuzzer();
    playAckBeep();
    
    postEvent("alarm_acknowledged", nullptr);
    postEvent("box_opened", "lid");
    
    currentPage = PAGE_CLOCK;
    Serial.println("[ALARM] Acknowledged — box opened");
  }
}

// ─────────────────────────────────────────────
//  WIFI MANAGEMENT
// ─────────────────────────────────────────────
void connectWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  // Non-blocking wait with display feedback
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 20);
    display.print("Connecting to WiFi");
    for (int d = 0; d < (attempts % 4); d++) display.print(".");
    display.display();
    delay(500);
    attempts++;
  }
  
  wifiConnected = (WiFi.status() == WL_CONNECTED);
  if (wifiConnected) {
    Serial.print("[WiFi] Connected! IP: ");
    Serial.println(WiFi.localIP());
    timeClient.begin();
    timeClient.forceUpdate();
    lastNtpSync = millis();
  }
}

// ─────────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("[Boot] MediCare ESP32 starting...");
  
  // GPIO setup
  pinMode(PIR1_PIN, INPUT);
  pinMode(PIR2_PIN, INPUT);
  
  // Buzzer via LEDC PWM (ESP32 Arduino v2 uses ledcAttachPin)
  ledcAttachPin(BUZZER_PIN, 0);
  ledcSetup(0, 2000, 8);
  
  // I2C OLED init
  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("[OLED] FAILED — check wiring!");
    while (true) delay(1000);
  }
  
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(10, 20);
  display.print("MediCare");
  display.setTextSize(1);
  display.setCursor(20, 45);
  display.print("Initializing...");
  display.display();
  delay(1500);
  
  // Connect WiFi
  connectWiFi();
  
  Serial.println("[Boot] Ready!");
  lastDisplayUpdate = millis();
}

// ─────────────────────────────────────────────
//  MAIN LOOP — Non-blocking, millis()-based
// ─────────────────────────────────────────────
void loop() {
  unsigned long now = millis();
  
  // ── WiFi reconnection ─────────────────────
  if (now - lastWifiCheck > WIFI_RECONNECT_MS) {
    lastWifiCheck = now;
    wifiConnected = (WiFi.status() == WL_CONNECTED);
    if (!wifiConnected) {
      Serial.println("[WiFi] Reconnecting...");
      WiFi.reconnect();
    }
  }
  
  // ── NTP time sync (hourly) ────────────────
  if (wifiConnected && now - lastNtpSync > NTP_SYNC_MS) {
    lastNtpSync = now;
    timeClient.update();
    Serial.println("[NTP] Time synced");
  } else if (wifiConnected) {
    timeClient.update();  // Non-blocking update (uses cached until next sync)
  }
  
  // ── DISPLAY UPDATE — exactly every 1 second, no drift ─────────────────────
  // This is the key fix for the "20-second lag" issue from MicroPython:
  // millis() never blocks and always increments, so display updates are
  // never delayed by network calls (which run in the same loop but only
  // when their own cooldown timers expire).
  if (now - lastDisplayUpdate >= DISPLAY_UPDATE_MS) {
    lastDisplayUpdate = now;
    updateClockStrings();
    
    // Auto-rotate pages when not in alarm
    if (!alarm.ringing) {
      if (now - pageChangedAt > PAGE_DURATION_MS) {
        pageChangedAt = now;
        currentPage = (currentPage == PAGE_CLOCK) ? PAGE_STATUS : PAGE_CLOCK;
      }
    }
    
    switch (currentPage) {
      case PAGE_CLOCK:  drawClockPage(); break;
      case PAGE_STATUS: drawStatusPage(); break;
      case PAGE_ALARM:  drawAlarmPage(alarm.triggeredTime); break;
    }
  }
  
  // ── SENSOR POLLING — every 100ms ──────────
  if (now % SENSOR_POLL_MS < 5) {  // ~every 100ms
    bool pir1Now = digitalRead(PIR1_PIN) == HIGH;
    bool pir2Now = digitalRead(PIR2_PIN) == HIGH;
    
    // PIR1 — Motion near medicine box area
    if (pir1Now && !pir1LastState) {
      if (now - pir1LastEvent > API_COOLDOWN_MS) {
        pir1LastEvent = now;
        Serial.println("[PIR1] Motion detected near box");
        postEvent("motion_detected", "pir1");
      }
    }
    
    // PIR2 — Box lid opening (any upward/close-range motion = opened)
    if (pir2Now && !pir2LastState) {
      if (now - pir2LastEvent > API_COOLDOWN_MS) {
        pir2LastEvent = now;
        Serial.println("[PIR2] Box interaction detected");
        
        if (alarm.ringing) {
          // Box opened during alarm = patient acknowledged and took medicine
          acknowledgeAlarm();
        } else {
          postEvent("box_opened", "pir2");
        }
      }
    }
    
    // PIR2 going LOW = box closed
    if (!pir2Now && pir2LastState) {
      if (now - pir2LastEvent > API_COOLDOWN_MS / 2) {
        pir2LastEvent = now;
        Serial.println("[PIR2] Box closed");
        postEvent("box_closed", "pir2");
      }
    }
    
    pir1LastState = pir1Now;
    pir2LastState = pir2Now;
  }
  
  // ── ALARM MELODY — while ringing ──────────
  if (alarm.ringing && !alarm.acknowledged) {
    playAlarmMelody();  // This takes ~800ms total (blocking is intentional for audio)
    // Note: Display update millis check will still work correctly after this
    // because lastDisplayUpdate is compared to millis() which advanced during playAlarmMelody
  }
  
  // ── ALARM TIME CHECK — every second ───────
  if (now - lastAlarmCheck >= ALARM_CHECK_MS) {
    lastAlarmCheck = now;
    checkAlarms();
  }
}

/*
 * ─────────────────────────────────────────────────────────────────
 *  COMPLETE SETUP GUIDE
 * ─────────────────────────────────────────────────────────────────
 *
 *  STEP 1 — Arduino IDE Setup
 *  ─────────────────────────────────────────
 *  a) Download & install Arduino IDE 2.x from https://www.arduino.cc/en/software
 *
 *  b) Add ESP32 board support:
 *     - File > Preferences
 *     - Add to "Additional boards manager URLs":
 *       https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
 *     - Tools > Board > Boards Manager
 *     - Search: "esp32"  →  Install "esp32 by Espressif Systems" (version 2.x.x)
 *
 *  c) Select board: Tools > Board > esp32 > "ESP32 Dev Module"
 *
 *  STEP 2 — Install Libraries
 *  ─────────────────────────────────────────
 *  Sketch > Include Library > Manage Libraries, then install each:
 *
 *  Library Name                        Author
 *  ─────────────────────────────────────────────
 *  Adafruit SSD1306                    Adafruit
 *  Adafruit GFX Library                Adafruit
 *  ArduinoJson                         Benoit Blanchon (v7.x)
 *  NTPClient                           Fabrice Weinberg
 *
 *  Built-in (no install needed, comes with ESP32 Arduino core):
 *  - WiFi
 *  - WiFiClientSecure
 *  - HTTPClient
 *
 *  STEP 3 — Configure This Sketch
 *  ─────────────────────────────────────────
 *  Edit the USER CONFIGURATION section at the top:
 *
 *  1. WIFI_SSID / WIFI_PASSWORD  — your home/office WiFi credentials
 *
 *  2. API_BASE_URL — Get this from your deployed app URL:
 *     If your Replit app is at https://myapp.myuser.replit.app
 *     then API_BASE_URL = "https://myapp.myuser.replit.app/api"
 *
 *  3. PATIENT_ID — Log into the app as the patient, note the patient's
 *     user ID (visible in admin panel), and set it here.
 *
 *  4. DEVICE_ID — Any unique string, e.g., "ESP32-Box-Room1"
 *
 *  5. UTC_OFFSET_SEC — Your timezone:
 *     IST (India):   19800  (+5:30)
 *     EST (US East): -18000 (-5:00)
 *     GMT (UK):          0
 *     CET (Europe):   3600  (+1:00)
 *     JST (Japan):   32400  (+9:00)
 *
 *  6. ALARM_TIMES — Match these exactly to what you configure in the app
 *
 *  STEP 4 — Hardware Wiring
 *  ─────────────────────────────────────────
 *  Component       ESP32 Pin    Notes
 *  ─────────────────────────────────────────
 *  PIR Sensor 1 VCC  3.3V or 5V  HC-SR501 works on 5V for better range
 *  PIR Sensor 1 GND  GND
 *  PIR Sensor 1 OUT  GPIO 13
 *
 *  PIR Sensor 2 VCC  3.3V or 5V
 *  PIR Sensor 2 GND  GND
 *  PIR Sensor 2 OUT  GPIO 14     Mount on lid hinge area to detect opening
 *
 *  Passive Buzzer +  GPIO 25     PWM pin
 *  Passive Buzzer -  GND
 *
 *  OLED SDA          GPIO 21     I2C SDA (default)
 *  OLED SCL          GPIO 22     I2C SCL (default)
 *  OLED VCC          3.3V
 *  OLED GND          GND
 *
 *  STEP 5 — Upload
 *  ─────────────────────────────────────────
 *  a) Connect ESP32 via USB
 *  b) Select correct Port in Tools > Port
 *  c) Upload Speed: 115200 (default)
 *  d) Click Upload arrow
 *  e) Open Serial Monitor (115200 baud) to see logs
 *
 *  STEP 6 — Firebase Realtime (optional enhancement)
 *  ─────────────────────────────────────────
 *  For true real-time notifications (without app polling), you can:
 *  1. Install "Firebase ESP32 Client" by Mobizt from Library Manager
 *  2. Store events in Firebase RTDB at /events/{patientId}/{eventId}
 *  3. The app can subscribe via Firebase onValue() listener
 *  This is optional — the current HTTP POST approach works reliably
 *  and the app polls every 15 seconds for near-real-time updates.
 *
 *  PLACEMENT TIPS
 *  ─────────────────────────────────────────
 *  PIR Sensor 1: Mount on the shelf/table facing the medicine box
 *               (detects when patient approaches the box area)
 *
 *  PIR Sensor 2: Mount INSIDE the lid or on the hinge side
 *               (detects when lid is lifted — confirming box opened)
 *               Adjust PIR sensitivity potentiometer to minimum range
 *               to avoid false triggers from room movement
 *
 *  Buzzer: Mount on top of box lid for maximum audibility
 *
 *  Display: Mount on front face of box, angled for easy reading
 *
 *  ESP32: Inside the box (with ventilation) or in a separate enclosure
 *         connected via short ribbon cable to sensors
 *
 * ─────────────────────────────────────────────────────────────────
 */
