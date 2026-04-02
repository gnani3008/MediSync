import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useApiClient } from "@/hooks/useApiClient";
import { MedicineCard } from "@/components/MedicineCard";
import { EventBadge } from "@/components/EventBadge";
import { AdherenceRing } from "@/components/AdherenceRing";
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

export default function CaretakerScreen() {
  const c = useColors();
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
    } catch (err: any) {
      // silently retry
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, []);

  const patientForEvent = (e: SensorEvent) => patients.find(p => p.medicines.some(m => m.patientId === e.id));

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12, backgroundColor: c.card, borderBottomColor: c.border }]}>
        <View>
          <Text style={[styles.greeting, { color: c.mutedForeground }]}>Caretaker</Text>
          <Text style={[styles.name, { color: c.foreground }]}>{user?.name}</Text>
        </View>
        <TouchableOpacity
          onPress={() => Alert.alert("Sign Out", "Are you sure?", [{ text: "Cancel" }, { text: "Sign Out", style: "destructive", onPress: async () => { await logout(); router.replace("/"); } }])}
          style={[styles.logoutBtn, { backgroundColor: c.destructive + "10" }]}
        >
          <Feather name="log-out" size={18} color={c.destructive} />
        </TouchableOpacity>
      </View>

      <View style={[styles.tabs, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {([["dashboard", "Overview"], ["patients", "Patients"], ["events", "Activity"]] as const).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && { borderBottomColor: colors.light.caretakerColor, borderBottomWidth: 2 }]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, { color: tab === key ? colors.light.caretakerColor : c.mutedForeground, fontFamily: tab === key ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{label}</Text>
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
          {tab === "dashboard" && summary && (
            <View style={{ gap: 16 }}>
              <View style={styles.statRow}>
                {[
                  { label: "Patients", value: summary.totalPatients, icon: "users", color: colors.light.caretakerColor },
                  { label: "Medicines", value: summary.activeMedicines, icon: "activity", color: colors.light.patientColor },
                  { label: "Today's Events", value: summary.todayEvents, icon: "zap", color: "#f59e0b" },
                ].map(s => (
                  <View key={s.label} style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
                    <View style={[styles.statIcon, { backgroundColor: s.color + "15" }]}>
                      <Feather name={s.icon as any} size={16} color={s.color} />
                    </View>
                    <Text style={[styles.statValue, { color: c.foreground }]}>{s.value}</Text>
                    <Text style={[styles.statLabel, { color: c.mutedForeground }]}>{s.label}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.adherenceCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.sectionTitle, { color: c.foreground }]}>Overall Adherence</Text>
                <AdherenceRing rate={summary.adherenceRate} size={90} label="This week" />
              </View>

              {summary.recentEvents.length > 0 && (
                <View>
                  <Text style={[styles.sectionTitle, { color: c.foreground, marginBottom: 10 }]}>Recent Activity</Text>
                  {summary.recentEvents.slice(0, 5).map(e => (
                    <EventBadge key={e.id} eventType={e.eventType} timestamp={e.timestamp} sensor={e.sensor} deviceId={e.deviceId} />
                  ))}
                </View>
              )}
            </View>
          )}

          {tab === "patients" && (
            <View style={{ gap: 12 }}>
              {patients.length === 0 && (
                <View style={styles.empty}>
                  <Feather name="users" size={40} color={c.mutedForeground} />
                  <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No patients assigned yet</Text>
                  <Text style={[styles.emptySub, { color: c.mutedForeground }]}>Contact your administrator</Text>
                </View>
              )}
              {patients.map(p => (
                <View key={p.id} style={[styles.patientCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={styles.patientHeader}>
                    <View style={[styles.avatar, { backgroundColor: colors.light.patientColor + "20" }]}>
                      <Text style={[styles.avatarText, { color: colors.light.patientColor }]}>{p.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.patientName, { color: c.foreground }]}>{p.name}</Text>
                      <Text style={[styles.patientEmail, { color: c.mutedForeground }]}>{p.email}</Text>
                      {p.lastEvent && (
                        <Text style={[styles.lastSeen, { color: c.mutedForeground }]}>
                          Last: {p.lastEvent.eventType.replace(/_/g, " ")} · {new Date(p.lastEvent.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      )}
                    </View>
                    <AdherenceRing rate={p.adherenceRate} size={56} label="Rate" />
                  </View>
                  {p.medicines.length > 0 && (
                    <View style={{ marginTop: 8, gap: 6 }}>
                      <Text style={[styles.medTitle, { color: c.mutedForeground }]}>{p.medicines.length} Medicine{p.medicines.length > 1 ? "s" : ""}</Text>
                      {p.medicines.slice(0, 2).map(m => (
                        <MedicineCard key={m.id} medicine={m} />
                      ))}
                      {p.medicines.length > 2 && (
                        <Text style={[styles.moreMed, { color: c.primary }]}>+{p.medicines.length - 2} more</Text>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {tab === "events" && (
            <View>
              {events.length === 0 ? (
                <View style={styles.empty}>
                  <Feather name="activity" size={40} color={c.mutedForeground} />
                  <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No sensor events yet</Text>
                  <Text style={[styles.emptySub, { color: c.mutedForeground }]}>ESP32 events will appear here in real-time</Text>
                </View>
              ) : (
                events.map(e => (
                  <EventBadge key={e.id} eventType={e.eventType} timestamp={e.timestamp} sensor={e.sensor} deviceId={e.deviceId} />
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}
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
  logoutBtn: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 14 },
  tabText: { fontSize: 13 },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  statRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 4, alignItems: "center" },
  statIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  adherenceCard: { borderRadius: 14, borderWidth: 1, padding: 20, alignItems: "center", gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 60 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  patientCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 4 },
  patientHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  patientName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  patientEmail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  lastSeen: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3, fontStyle: "italic" },
  medTitle: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.4 },
  moreMed: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
