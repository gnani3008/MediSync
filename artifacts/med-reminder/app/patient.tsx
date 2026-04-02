import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useApiClient } from "@/hooks/useApiClient";
import { MedicineCard } from "@/components/MedicineCard";
import { EventBadge } from "@/components/EventBadge";
import colors from "@/constants/colors";

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

const frequencyOptions = [
  { value: "daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "thrice_daily", label: "3× daily" },
  { value: "weekly", label: "Weekly" },
  { value: "as_needed", label: "As needed" },
] as const;

export default function PatientScreen() {
  const c = useColors();
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
    name: "", dosage: "", frequency: "daily" as string,
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
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); loadAll(); }, []);

  function openAdd() {
    setEditMed(null);
    setForm({ name: "", dosage: "", frequency: "daily", times: ["08:00"], notes: "" });
    setShowForm(true);
  }

  function openEdit(m: Medicine) {
    setEditMed(m);
    setForm({ name: m.name, dosage: m.dosage, frequency: m.frequency, times: m.times, notes: m.notes || "" });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name || !form.dosage) {
      Alert.alert("Error", "Name and dosage are required");
      return;
    }
    try {
      const body = { ...form, patientId: user!.id, isActive: true };
      if (editMed) {
        await request(`/medicines/${editMed.id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await request("/medicines", { method: "POST", body: JSON.stringify(body) });
      }
      setShowForm(false);
      loadAll();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  async function handleDelete(id: number) {
    Alert.alert("Delete Medicine", "Remove this reminder?", [
      { text: "Cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await request(`/medicines/${id}`, { method: "DELETE" });
            loadAll();
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  }

  function addTime() { setForm(f => ({ ...f, times: [...f.times, "12:00"] })); }
  function removeTime(i: number) { setForm(f => ({ ...f, times: f.times.filter((_, idx) => idx !== i) })); }
  function setTime(i: number, val: string) { setForm(f => { const t = [...f.times]; t[i] = val; return { ...f, times: t }; }); }

  const nextMed = medicines.find(m => m.isActive);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12, backgroundColor: c.card, borderBottomColor: c.border }]}>
        <View>
          <Text style={[styles.greeting, { color: c.mutedForeground }]}>Patient</Text>
          <Text style={[styles.name, { color: c.foreground }]}>{user?.name}</Text>
        </View>
        <View style={styles.topRight}>
          <TouchableOpacity onPress={openAdd} style={[styles.addBtn, { backgroundColor: colors.light.patientColor }]}>
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert("Sign Out", "Are you sure?", [{ text: "Cancel" }, { text: "Sign Out", style: "destructive", onPress: async () => { await logout(); router.replace("/"); } }])}
            style={[styles.logoutBtn, { backgroundColor: c.destructive + "10" }]}
          >
            <Feather name="log-out" size={18} color={c.destructive} />
          </TouchableOpacity>
        </View>
      </View>

      {nextMed && (
        <View style={[styles.nextDose, { backgroundColor: colors.light.patientColor + "10", borderColor: colors.light.patientColor + "30" }]}>
          <View style={[styles.nextIcon, { backgroundColor: colors.light.patientColor + "20" }]}>
            <Feather name="bell" size={18} color={colors.light.patientColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.nextLabel, { color: colors.light.patientColor }]}>Next dose</Text>
            <Text style={[styles.nextMedName, { color: c.foreground }]}>{nextMed.name} · {nextMed.dosage}</Text>
            <Text style={[styles.nextTime, { color: c.mutedForeground }]}>{nextMed.times[0]} — {nextMed.frequency.replace(/_/g, " ")}</Text>
          </View>
          <Feather name="clock" size={18} color={colors.light.patientColor} />
        </View>
      )}

      <View style={[styles.tabs, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {([["medicines", "My Medicines"], ["activity", "Box Activity"]] as const).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && { borderBottomColor: colors.light.patientColor, borderBottomWidth: 2 }]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, { color: tab === key ? colors.light.patientColor : c.mutedForeground, fontFamily: tab === key ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} size="large" /></View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        >
          {tab === "medicines" ? (
            <View style={{ gap: 4 }}>
              {medicines.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="activity" size={40} color={c.mutedForeground} />
                  <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No medicines added yet</Text>
                  <TouchableOpacity onPress={openAdd} style={[styles.emptyBtn, { backgroundColor: colors.light.patientColor }]}>
                    <Text style={styles.emptyBtnText}>Add Medicine</Text>
                  </TouchableOpacity>
                </View>
              ) : medicines.map(m => (
                <MedicineCard
                  key={m.id}
                  medicine={m}
                  showActions
                  onEdit={() => openEdit(m)}
                  onDelete={() => handleDelete(m.id)}
                />
              ))}
            </View>
          ) : (
            <View>
              {events.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="box" size={40} color={c.mutedForeground} />
                  <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No activity yet</Text>
                  <Text style={[styles.emptySub, { color: c.mutedForeground }]}>Sensor events from your ESP32 device appear here</Text>
                </View>
              ) : events.map(e => (
                <EventBadge key={e.id} eventType={e.eventType} timestamp={e.timestamp} sensor={e.sensor} deviceId={e.deviceId} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={showForm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.modal, { backgroundColor: c.card }]} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: c.foreground }]}>{editMed ? "Edit Medicine" : "Add Medicine"}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Feather name="x" size={22} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>

            {[
              { label: "Medicine Name *", key: "name", placeholder: "e.g. Metformin", icon: "activity" as const },
              { label: "Dosage *", key: "dosage", placeholder: "e.g. 500mg", icon: "zap" as const },
            ].map(f => (
              <View key={f.key} style={styles.field}>
                <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>{f.label}</Text>
                <View style={[styles.inputWrap, { backgroundColor: c.background, borderColor: c.border }]}>
                  <Feather name={f.icon} size={15} color={c.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: c.foreground }]}
                    placeholder={f.placeholder}
                    placeholderTextColor={c.mutedForeground}
                    value={(form as any)[f.key]}
                    onChangeText={v => setForm(fm => ({ ...fm, [f.key]: v }))}
                  />
                </View>
              </View>
            ))}

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Frequency</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                <View style={styles.freqRow}>
                  {frequencyOptions.map(f => (
                    <TouchableOpacity
                      key={f.value}
                      style={[styles.freqChip, { backgroundColor: form.frequency === f.value ? colors.light.patientColor : c.secondary, borderColor: form.frequency === f.value ? colors.light.patientColor : c.border }]}
                      onPress={() => setForm(fm => ({ ...fm, frequency: f.value }))}
                    >
                      <Text style={[styles.freqText, { color: form.frequency === f.value ? "#fff" : c.foreground }]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.field}>
              <View style={styles.timesHeader}>
                <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Alarm Times</Text>
                <TouchableOpacity onPress={addTime} style={[styles.addTimeBtn, { backgroundColor: c.accent }]}>
                  <Feather name="plus" size={14} color={c.accentForeground} />
                  <Text style={[styles.addTimeText, { color: c.accentForeground }]}>Add</Text>
                </TouchableOpacity>
              </View>
              {form.times.map((t, i) => (
                <View key={i} style={styles.timeRow}>
                  <View style={[styles.inputWrap, { flex: 1, backgroundColor: c.background, borderColor: c.border }]}>
                    <Feather name="clock" size={15} color={c.mutedForeground} />
                    <TextInput
                      style={[styles.input, { color: c.foreground }]}
                      value={t}
                      onChangeText={v => setTime(i, v)}
                      placeholder="HH:MM"
                      placeholderTextColor={c.mutedForeground}
                    />
                  </View>
                  {form.times.length > 1 && (
                    <TouchableOpacity onPress={() => removeTime(i)} style={[styles.removeTime, { backgroundColor: c.destructive + "10" }]}>
                      <Feather name="minus" size={14} color={c.destructive} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>Notes (optional)</Text>
              <View style={[styles.inputWrap, { backgroundColor: c.background, borderColor: c.border, alignItems: "flex-start", minHeight: 80 }]}>
                <TextInput
                  style={[styles.input, { color: c.foreground, textAlignVertical: "top" }]}
                  placeholder="Any special instructions..."
                  placeholderTextColor={c.mutedForeground}
                  value={form.notes}
                  onChangeText={v => setForm(fm => ({ ...fm, notes: v }))}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: c.muted }]} onPress={() => setShowForm(false)}>
                <Text style={[styles.modalBtnText, { color: c.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.light.patientColor }]} onPress={handleSave}>
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>{editMed ? "Save Changes" : "Add Medicine"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  greeting: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  name: { fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 2 },
  topRight: { flexDirection: "row", gap: 8 },
  addBtn: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  logoutBtn: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  nextDose: {
    flexDirection: "row", alignItems: "center", gap: 12,
    margin: 16, borderRadius: 14, borderWidth: 1, padding: 14,
  },
  nextIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  nextLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  nextMedName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  nextTime: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 14 },
  tabText: { fontSize: 13 },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, paddingVertical: 60 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40 },
  emptyBtn: { borderRadius: 12, paddingVertical: 11, paddingHorizontal: 24, marginTop: 6 },
  emptyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 4 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  field: { gap: 8, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.4 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 11,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  freqRow: { flexDirection: "row", gap: 8 },
  freqChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  freqText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  timesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addTimeBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  addTimeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  timeRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  removeTime: { width: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
