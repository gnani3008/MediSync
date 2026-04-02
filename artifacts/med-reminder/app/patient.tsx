import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, RefreshControl, StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useApiClient } from "@/hooks/useApiClient";

interface Medicine {
  id: number;
  patientId: number;
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  notes?: string | null;
  isActive: boolean;
}

interface SensorEvent {
  id: number;
  eventType: string;
  sensor?: string | null;
  deviceId: string;
  timestamp: string;
}

const FREQ_OPTIONS = [
  { value: "daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "thrice_daily", label: "3× daily" },
  { value: "weekly", label: "Weekly" },
  { value: "as_needed", label: "As needed" },
];

const EVENT_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> = {
  motion_detected:    { icon: "walk",               color: "#0ea5e9", bg: "#f0f9ff", label: "Motion Detected" },
  box_opened:         { icon: "lock-open",           color: "#10b981", bg: "#f0fdf4", label: "Box Opened" },
  box_closed:         { icon: "lock-closed",         color: "#6366f1", bg: "#f5f3ff", label: "Box Closed" },
  alarm_triggered:    { icon: "notifications",       color: "#f59e0b", bg: "#fffbeb", label: "Alarm Triggered" },
  alarm_acknowledged: { icon: "checkmark-circle",    color: "#10b981", bg: "#f0fdf4", label: "Alarm Acknowledged" },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function PatientScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { request } = useApiClient();

  const [tab, setTab] = useState<"medicines" | "activity">("medicines");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [events, setEvents] = useState<SensorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editMed, setEditMed] = useState<Medicine | null>(null);

  const [form, setForm] = useState({
    name: "", dosage: "", frequency: "daily",
    times: ["08:00"], notes: "",
  });

  useEffect(() => {
    if (!user || user.role !== "patient") { router.replace("/"); return; }
    loadAll();
    const interval = setInterval(loadAll, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadAll() {
    try {
      const [m, e] = await Promise.all([
        request<Medicine[]>(`/medicines?patientId=${user!.id}`),
        request<SensorEvent[]>(`/events?patientId=${user!.id}&limit=20`),
      ]);
      setMedicines(m);
      setEvents(e);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); loadAll(); }, []);

  function openAdd() {
    setEditMed(null);
    setForm({ name: "", dosage: "", frequency: "daily", times: ["08:00"], notes: "" });
    setShowForm(true);
  }

  function openEdit(med: Medicine) {
    setEditMed(med);
    setForm({ name: med.name, dosage: med.dosage, frequency: med.frequency, times: med.times, notes: med.notes ?? "" });
    setShowForm(true);
  }

  async function saveMedicine() {
    if (!form.name.trim() || !form.dosage.trim()) {
      Alert.alert("Missing Info", "Name and dosage are required.");
      return;
    }
    try {
      if (editMed) {
        await request(`/medicines/${editMed.id}`, { method: "PUT", body: form });
      } else {
        await request("/medicines", { method: "POST", body: { ...form, patientId: user!.id } });
      }
      setShowForm(false);
      loadAll();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  async function deleteMedicine(id: number) {
    Alert.alert("Delete Medicine", "Remove this medicine from your list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try { await request(`/medicines/${id}`, { method: "DELETE" }); loadAll(); }
          catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
        <ActivityIndicator color="#059669" size="large" />
      </View>
    );
  }

  const activeMeds = medicines.filter(m => m.isActive);

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#059669", "#10b981"]} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.userName}>{user?.name?.split(" ")[0] ?? "Patient"}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Ionicons name="medical" size={14} color="#fff" />
            <Text style={styles.statText}>{activeMeds.length} Medicines</Text>
          </View>
          <View style={styles.statChip}>
            <Ionicons name="pulse" size={14} color="#fff" />
            <Text style={styles.statText}>{events.length} Events today</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          {(["medicines", "activity"] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Ionicons
                name={t === "medicines" ? "medical-outline" : "pulse-outline"}
                size={15}
                color={tab === t ? "#059669" : "rgba(255,255,255,0.7)"}
              />
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "medicines" ? "Medicines" : "Activity"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
        showsVerticalScrollIndicator={false}
      >
        {tab === "medicines" ? (
          medicines.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons name="medical-outline" size={40} color="#10b981" /></View>
              <Text style={styles.emptyTitle}>No medicines yet</Text>
              <Text style={styles.emptyDesc}>Tap the + button to add your first medicine</Text>
            </View>
          ) : (
            medicines.map(med => (
              <MedCard key={med.id} med={med} onEdit={() => openEdit(med)} onDelete={() => deleteMedicine(med.id)} />
            ))
          )
        ) : (
          events.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons name="radio-outline" size={40} color="#10b981" /></View>
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptyDesc}>Sensor events from your ESP32 device will appear here</Text>
            </View>
          ) : (
            events.map(ev => <EventRow key={ev.id} event={ev} />)
          )
        )}
      </ScrollView>

      {tab === "medicines" && (
        <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 24 }]} onPress={openAdd} activeOpacity={0.85}>
          <LinearGradient colors={["#059669", "#10b981"]} style={styles.fabInner}>
            <Ionicons name="add" size={28} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <MedForm
          editMed={editMed}
          form={form}
          setForm={setForm}
          onSave={saveMedicine}
          onClose={() => setShowForm(false)}
        />
      </Modal>
    </View>
  );
}

function MedCard({ med, onEdit, onDelete }: { med: Medicine; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={medStyles.card}>
      <View style={medStyles.left}>
        <View style={[medStyles.dot, !med.isActive && { backgroundColor: "#cbd5e1" }]} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={medStyles.topRow}>
          <Text style={medStyles.name}>{med.name}</Text>
          {!med.isActive && (
            <View style={medStyles.inactiveBadge}>
              <Text style={medStyles.inactiveTxt}>Inactive</Text>
            </View>
          )}
        </View>
        <Text style={medStyles.dosage}>{med.dosage} · {FREQ_OPTIONS.find(f => f.value === med.frequency)?.label ?? med.frequency}</Text>
        {med.times.length > 0 && (
          <View style={medStyles.times}>
            {med.times.map(t => (
              <View key={t} style={medStyles.timePill}>
                <Ionicons name="alarm-outline" size={11} color="#059669" />
                <Text style={medStyles.timeText}>{t}</Text>
              </View>
            ))}
          </View>
        )}
        {med.notes ? <Text style={medStyles.notes}>{med.notes}</Text> : null}
      </View>
      <View style={medStyles.actions}>
        <TouchableOpacity onPress={onEdit} style={medStyles.actionBtn}>
          <Ionicons name="pencil-outline" size={17} color="#64748b" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={medStyles.actionBtn}>
          <Ionicons name="trash-outline" size={17} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const medStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 10, flexDirection: "row", alignItems: "flex-start", gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  left: { paddingTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#10b981" },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  name: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#0f172a", flex: 1 },
  inactiveBadge: { backgroundColor: "#f1f5f9", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  inactiveTxt: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#94a3b8" },
  dosage: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748b", marginBottom: 8 },
  times: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  timePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  timeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#059669" },
  notes: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94a3b8", marginTop: 6, fontStyle: "italic" },
  actions: { gap: 8 },
  actionBtn: { padding: 6 },
});

function EventRow({ event }: { event: SensorEvent }) {
  const cfg = EVENT_CONFIG[event.eventType] ?? { icon: "ellipse-outline" as const, color: "#94a3b8", bg: "#f8fafc", label: event.eventType };
  return (
    <View style={evStyles.row}>
      <View style={[evStyles.iconBox, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={evStyles.label}>{cfg.label}</Text>
        <Text style={evStyles.device}>{event.deviceId} · {event.sensor ? `Sensor: ${event.sensor}` : "No sensor"}</Text>
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
  device: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  time: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#cbd5e1" },
});

function MedForm({
  editMed, form, setForm, onSave, onClose,
}: {
  editMed: Medicine | null;
  form: any;
  setForm: (f: any) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  function addTime() {
    if (form.times.length >= 6) return;
    setForm({ ...form, times: [...form.times, "12:00"] });
  }

  function removeTime(i: number) {
    setForm({ ...form, times: form.times.filter((_: any, idx: number) => idx !== i) });
  }

  function updateTime(i: number, val: string) {
    const t = [...form.times];
    t[i] = val;
    setForm({ ...form, times: t });
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <LinearGradient colors={["#059669", "#10b981"]} style={[fStyles.formHeader, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onClose} style={fStyles.closeBtn}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={fStyles.formTitle}>{editMed ? "Edit Medicine" : "Add Medicine"}</Text>
        <TouchableOpacity onPress={onSave} style={fStyles.saveBtn}>
          <Text style={fStyles.saveText}>Save</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 40 }}>
        <View>
          <Text style={fStyles.label}>Medicine Name *</Text>
          <TextInput
            style={fStyles.input}
            value={form.name}
            onChangeText={v => setForm({ ...form, name: v })}
            placeholder="e.g. Metformin"
            placeholderTextColor="#cbd5e1"
          />
        </View>
        <View>
          <Text style={fStyles.label}>Dosage *</Text>
          <TextInput
            style={fStyles.input}
            value={form.dosage}
            onChangeText={v => setForm({ ...form, dosage: v })}
            placeholder="e.g. 500mg"
            placeholderTextColor="#cbd5e1"
          />
        </View>
        <View>
          <Text style={fStyles.label}>Frequency</Text>
          <View style={fStyles.freqRow}>
            {FREQ_OPTIONS.map(f => (
              <TouchableOpacity
                key={f.value}
                onPress={() => setForm({ ...form, frequency: f.value })}
                style={[fStyles.freqBtn, form.frequency === f.value && fStyles.freqBtnActive]}
              >
                <Text style={[fStyles.freqText, form.frequency === f.value && fStyles.freqTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={fStyles.label}>Alarm Times</Text>
            <TouchableOpacity onPress={addTime} style={fStyles.addTimeBtn}>
              <Ionicons name="add" size={16} color="#059669" />
              <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: "#059669" }}>Add</Text>
            </TouchableOpacity>
          </View>
          {form.times.map((t: string, i: number) => (
            <View key={i} style={fStyles.timeRow}>
              <Ionicons name="alarm-outline" size={18} color="#059669" />
              <TextInput
                style={[fStyles.input, { flex: 1, marginBottom: 0 }]}
                value={t}
                onChangeText={v => updateTime(i, v)}
                placeholder="HH:MM"
                placeholderTextColor="#cbd5e1"
              />
              {form.times.length > 1 && (
                <TouchableOpacity onPress={() => removeTime(i)}>
                  <Ionicons name="remove-circle" size={22} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
        <View>
          <Text style={fStyles.label}>Notes (optional)</Text>
          <TextInput
            style={[fStyles.input, { height: 80, textAlignVertical: "top" }]}
            value={form.notes}
            onChangeText={v => setForm({ ...form, notes: v })}
            placeholder="Any special instructions..."
            placeholderTextColor="#cbd5e1"
            multiline
          />
        </View>
      </ScrollView>
    </View>
  );
}

const fStyles = StyleSheet.create({
  formHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  formTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  saveBtn: {
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  saveText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#475569", marginBottom: 8 },
  input: {
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5,
    borderColor: "#e2e8f0", paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: "Inter_400Regular", color: "#0f172a", marginBottom: 4,
  },
  freqRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  freqBtn: {
    backgroundColor: "#f1f5f9", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: "#e2e8f0",
  },
  freqBtnActive: { backgroundColor: "#f0fdf4", borderColor: "#10b981" },
  freqText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748b" },
  freqTextActive: { color: "#059669", fontFamily: "Inter_600SemiBold" },
  addTimeBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
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
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  statText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#fff" },
  tabRow: {
    flexDirection: "row", gap: 8, paddingBottom: 16, paddingTop: 4,
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)" },
  tabTextActive: { color: "#059669", fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#334155" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#94a3b8", textAlign: "center", paddingHorizontal: 20 },
  fab: { position: "absolute", right: 20 },
  fabInner: {
    width: 60, height: 60, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#059669", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
  },
});
