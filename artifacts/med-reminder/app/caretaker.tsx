import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useApiClient } from "@/hooks/useApiClient";

interface Medicine {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  isActive: boolean;
}

interface SensorEvent {
  id: number;
  eventType: string;
  sensor?: string | null;
  deviceId: string;
  timestamp: string;
  patientId?: number;
}

interface PatientDetail {
  id: number;
  name: string;
  email: string;
  phone?: string;
  medicines: Medicine[];
  lastEvent?: SensorEvent | null;
  adherenceRate: number;
}

interface DashboardSummary {
  totalPatients: number;
  activeMedicines: number;
  todayEvents: number;
  adherenceRate: number;
  recentEvents: SensorEvent[];
}

const EVENT_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> = {
  motion_detected:    { icon: "walk",             color: "#0ea5e9", bg: "#f0f9ff", label: "Motion Detected" },
  box_opened:         { icon: "lock-open",         color: "#10b981", bg: "#f0fdf4", label: "Box Opened" },
  box_closed:         { icon: "lock-closed",       color: "#6366f1", bg: "#f5f3ff", label: "Box Closed" },
  alarm_triggered:    { icon: "notifications",     color: "#f59e0b", bg: "#fffbeb", label: "Alarm Triggered" },
  alarm_acknowledged: { icon: "checkmark-circle",  color: "#10b981", bg: "#f0fdf4", label: "Alarm Acknowledged" },
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function AdherenceRing({ pct }: { pct: number }) {
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: 52, height: 52 }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 5, borderColor: color + "30", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 4, borderColor: color, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color }}>{pct}%</Text>
        </View>
      </View>
    </View>
  );
}

export default function CaretakerScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { request } = useApiClient();

  const [tab, setTab] = useState<"dashboard" | "patients" | "events">("dashboard");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [patients, setPatients] = useState<PatientDetail[]>([]);
  const [events, setEvents] = useState<SensorEvent[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user || !["caretaker", "admin"].includes(user.role)) { router.replace("/"); return; }
    loadAll();
    const interval = setInterval(loadAll, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadAll() {
    try {
      const [s, p, e] = await Promise.all([
        request<DashboardSummary>("/dashboard/summary"),
        request<PatientDetail[]>("/caretaker/patients"),
        request<SensorEvent[]>("/events?limit=30"),
      ]);
      setSummary(s);
      setPatients(p);
      setEvents(e);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); loadAll(); }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
        <ActivityIndicator color="#0284c7" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#0284c7", "#0ea5e9"]} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name?.split(" ")[0] ?? "Caretaker"}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {(["dashboard", "patients", "events"] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => { setTab(t); setSelectedPatient(null); }}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Ionicons
                name={t === "dashboard" ? "grid-outline" : t === "patients" ? "people-outline" : "pulse-outline"}
                size={13}
                color={tab === t ? "#0284c7" : "rgba(255,255,255,0.7)"}
              />
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0284c7" />}
        showsVerticalScrollIndicator={false}
      >
        {tab === "dashboard" && summary && (
          <>
            <View style={styles.statsGrid}>
              {[
                { label: "Patients", value: summary.totalPatients, icon: "people" as const, color: "#0284c7", bg: "#f0f9ff" },
                { label: "Medicines", value: summary.activeMedicines, icon: "medical" as const, color: "#10b981", bg: "#f0fdf4" },
                { label: "Events Today", value: summary.todayEvents, icon: "flash" as const, color: "#f59e0b", bg: "#fffbeb" },
                { label: "Adherence", value: `${Math.round(summary.adherenceRate)}%`, icon: "checkmark-circle" as const, color: "#6366f1", bg: "#f5f3ff" },
              ].map(s => (
                <View key={s.label} style={[styles.statCard]}>
                  <View style={[styles.statIconBox, { backgroundColor: s.bg }]}>
                    <Ionicons name={s.icon} size={22} color={s.color} />
                  </View>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {summary.recentEvents.length === 0 ? (
              <View style={styles.emptySmall}>
                <Text style={styles.emptySmallText}>No recent events</Text>
              </View>
            ) : (
              summary.recentEvents.slice(0, 8).map(ev => <EventRow key={ev.id} event={ev} />)
            )}
          </>
        )}

        {tab === "patients" && !selectedPatient && (
          patients.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={40} color="#0ea5e9" />
              </View>
              <Text style={styles.emptyTitle}>No patients assigned</Text>
              <Text style={styles.emptyDesc}>Ask your administrator to assign patients to your account</Text>
            </View>
          ) : (
            patients.map(p => (
              <TouchableOpacity key={p.id} onPress={() => setSelectedPatient(p)} activeOpacity={0.88}>
                <PatientCard patient={p} />
              </TouchableOpacity>
            ))
          )
        )}

        {tab === "patients" && selectedPatient && (
          <PatientDetailView
            patient={selectedPatient}
            onBack={() => setSelectedPatient(null)}
          />
        )}

        {tab === "events" && (
          events.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="radio-outline" size={40} color="#0ea5e9" />
              </View>
              <Text style={styles.emptyTitle}>No events yet</Text>
              <Text style={styles.emptyDesc}>Sensor events from ESP32 devices will appear here</Text>
            </View>
          ) : (
            events.map(ev => <EventRow key={ev.id} event={ev} showPatient />)
          )
        )}
      </ScrollView>
    </View>
  );
}

function PatientCard({ patient }: { patient: PatientDetail }) {
  const evCfg = patient.lastEvent ? (EVENT_CONFIG[patient.lastEvent.eventType] ?? null) : null;
  return (
    <View style={pcStyles.card}>
      <View style={pcStyles.avatar}>
        <Text style={pcStyles.avatarText}>{patient.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={pcStyles.name}>{patient.name}</Text>
          <AdherenceRing pct={Math.round(patient.adherenceRate)} />
        </View>
        <Text style={pcStyles.email}>{patient.email}</Text>
        <View style={pcStyles.bottomRow}>
          <View style={pcStyles.medCount}>
            <Ionicons name="medical-outline" size={12} color="#0284c7" />
            <Text style={pcStyles.medCountText}>{patient.medicines.filter(m => m.isActive).length} active meds</Text>
          </View>
          {patient.lastEvent && evCfg && (
            <View style={[pcStyles.lastEvent, { backgroundColor: evCfg.bg }]}>
              <Ionicons name={evCfg.icon} size={11} color={evCfg.color} />
              <Text style={[pcStyles.lastEventText, { color: evCfg.color }]}>{evCfg.label}</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" style={{ marginLeft: 8 }} />
    </View>
  );
}

const pcStyles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: "#dbeafe",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#0284c7" },
  name: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#0f172a", flex: 1 },
  email: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94a3b8", marginBottom: 8 },
  bottomRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  medCount: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#eff6ff", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  medCountText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#0284c7" },
  lastEvent: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  lastEventText: { fontSize: 11, fontFamily: "Inter_500Medium" },
});

function PatientDetailView({ patient, onBack }: { patient: PatientDetail; onBack: () => void }) {
  return (
    <View>
      <TouchableOpacity onPress={onBack} style={pdStyles.backBtn}>
        <Ionicons name="arrow-back" size={18} color="#0284c7" />
        <Text style={pdStyles.backText}>Back to Patients</Text>
      </TouchableOpacity>

      <View style={pdStyles.profileCard}>
        <View style={pdStyles.avatar}>
          <Text style={pdStyles.avatarText}>{patient.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={pdStyles.name}>{patient.name}</Text>
          <Text style={pdStyles.email}>{patient.email}</Text>
          {patient.phone && <Text style={pdStyles.phone}>{patient.phone}</Text>}
        </View>
        <View style={{ flex: 1 }} />
        <AdherenceRing pct={Math.round(patient.adherenceRate)} />
      </View>

      <Text style={styles.sectionTitle}>Medicines ({patient.medicines.filter(m => m.isActive).length} active)</Text>
      {patient.medicines.length === 0 ? (
        <View style={styles.emptySmall}><Text style={styles.emptySmallText}>No medicines configured</Text></View>
      ) : (
        patient.medicines.filter(m => m.isActive).map(m => (
          <View key={m.id} style={pdStyles.medRow}>
            <View style={pdStyles.medDot} />
            <View>
              <Text style={pdStyles.medName}>{m.name} — {m.dosage}</Text>
              <Text style={pdStyles.medFreq}>{m.frequency} · {m.times.join(", ")}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const pdStyles = StyleSheet.create({
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  backText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#0284c7" },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#0284c7" },
  name: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#0f172a" },
  email: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748b" },
  phone: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  medRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8,
  },
  medDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10b981", marginTop: 4 },
  medName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0f172a" },
  medFreq: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94a3b8", marginTop: 2 },
});

function EventRow({ event, showPatient }: { event: SensorEvent; showPatient?: boolean }) {
  const cfg = EVENT_CONFIG[event.eventType] ?? { icon: "ellipse-outline" as const, color: "#94a3b8", bg: "#f8fafc", label: event.eventType };
  return (
    <View style={evStyles.row}>
      <View style={[evStyles.iconBox, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={evStyles.label}>{cfg.label}</Text>
        <Text style={evStyles.meta}>
          {showPatient && event.patientId ? `Patient #${event.patientId} · ` : ""}
          {event.deviceId}
          {event.sensor ? ` · ${event.sensor}` : ""}
        </Text>
      </View>
      <Text style={evStyles.time}>{timeAgo(event.timestamp)}</Text>
    </View>
  );
}

const evStyles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#0f172a", marginBottom: 2 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  time: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#cbd5e1" },
});

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  userName: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  tabRow: { flexDirection: "row", gap: 8, paddingBottom: 16, paddingTop: 4 },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)" },
  tabTextActive: { color: "#0284c7", fontFamily: "Inter_600SemiBold" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    width: "47.5%", alignItems: "flex-start",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    gap: 6,
  },
  statIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#0f172a" },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#94a3b8" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#0f172a", marginBottom: 12, marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: "#f0f9ff", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#334155" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#94a3b8", textAlign: "center", paddingHorizontal: 20 },
  emptySmall: { alignItems: "center", paddingVertical: 20 },
  emptySmallText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#94a3b8" },
});
