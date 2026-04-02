import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useApiClient } from "@/hooks/useApiClient";
import type { AuthUser } from "@/context/AuthContext";

interface User extends AuthUser {
  createdAt: string;
}

interface Assignment {
  id: number;
  patientId: number;
  caretakerId: number;
  patient: User;
  caretaker: User;
  createdAt: string;
}

const ROLE_COLORS = {
  admin:     { color: "#7c3aed", bg: "#f5f3ff" },
  caretaker: { color: "#0284c7", bg: "#f0f9ff" },
  patient:   { color: "#059669", bg: "#f0fdf4" },
};

const ROLE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  admin: "shield-checkmark",
  caretaker: "people",
  patient: "person",
};

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { request } = useApiClient();

  const [tab, setTab] = useState<"users" | "assignments">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);
  const [selectedCaretaker, setSelectedCaretaker] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") { router.replace("/"); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([
        request<User[]>("/users"),
        request<Assignment[]>("/assignments"),
      ]);
      setUsers(u);
      setAssignments(a);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(id: number, name: string) {
    Alert.alert("Delete User", `Remove ${name} from the system?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try { await request(`/users/${id}`, { method: "DELETE" }); loadData(); }
          catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  }

  async function createAssignment() {
    if (!selectedPatient || !selectedCaretaker) {
      Alert.alert("Missing Selection", "Select both a patient and a caretaker.");
      return;
    }
    try {
      await request("/assignments", {
        method: "POST",
        body: { patientId: selectedPatient, caretakerId: selectedCaretaker },
      });
      setShowAssignModal(false);
      setSelectedPatient(null);
      setSelectedCaretaker(null);
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  }

  async function deleteAssignment(id: number) {
    Alert.alert("Remove Assignment", "Remove this patient-caretaker pairing?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          try { await request(`/assignments/${id}`, { method: "DELETE" }); loadData(); }
          catch (e: any) { Alert.alert("Error", e.message); }
        },
      },
    ]);
  }

  const patients = users.filter(u => u.role === "patient");
  const caretakers = users.filter(u => u.role === "caretaker");
  const admins = users.filter(u => u.role === "admin");

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
        <ActivityIndicator color="#7c3aed" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#7c3aed", "#9333ea"]} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Admin Panel</Text>
            <Text style={styles.userName}>{user?.name?.split(" ")[0]}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: "Admins", value: admins.length, color: "#fff" },
            { label: "Caretakers", value: caretakers.length, color: "#fff" },
            { label: "Patients", value: patients.length, color: "#fff" },
            { label: "Assignments", value: assignments.length, color: "#fff" },
          ].map(s => (
            <View key={s.label} style={styles.statChip}>
              <Text style={styles.statVal}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabRow}>
          {(["users", "assignments"] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Ionicons
                name={t === "users" ? "people-outline" : "git-branch-outline"}
                size={14}
                color={tab === t ? "#7c3aed" : "rgba(255,255,255,0.7)"}
              />
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "users" ? "Users" : "Assignments"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === "users" && (
          <>
            {[
              { role: "admin" as const, list: admins, label: "Administrators" },
              { role: "caretaker" as const, list: caretakers, label: "Caretakers" },
              { role: "patient" as const, list: patients, label: "Patients" },
            ].map(group => (
              <View key={group.role} style={{ marginBottom: 20 }}>
                <View style={styles.groupHeader}>
                  <View style={[styles.groupDot, { backgroundColor: ROLE_COLORS[group.role].color }]} />
                  <Text style={styles.groupTitle}>{group.label}</Text>
                  <View style={[styles.groupCount, { backgroundColor: ROLE_COLORS[group.role].bg }]}>
                    <Text style={[styles.groupCountText, { color: ROLE_COLORS[group.role].color }]}>
                      {group.list.length}
                    </Text>
                  </View>
                </View>

                {group.list.length === 0 ? (
                  <View style={styles.emptyGroup}>
                    <Text style={styles.emptyGroupText}>No {group.label.toLowerCase()} yet</Text>
                  </View>
                ) : (
                  group.list.map(u => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onDelete={() => deleteUser(u.id, u.name)}
                      isCurrentUser={u.id === user?.id}
                    />
                  ))
                )}
              </View>
            ))}
          </>
        )}

        {tab === "assignments" && (
          assignments.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="git-branch-outline" size={40} color="#7c3aed" />
              </View>
              <Text style={styles.emptyTitle}>No assignments yet</Text>
              <Text style={styles.emptyDesc}>Tap the button below to assign a patient to a caretaker</Text>
            </View>
          ) : (
            assignments.map(a => (
              <AssignmentCard key={a.id} assignment={a} onDelete={() => deleteAssignment(a.id)} />
            ))
          )
        )}
      </ScrollView>

      {tab === "assignments" && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 24 }]}
          onPress={() => setShowAssignModal(true)}
          activeOpacity={0.85}
        >
          <LinearGradient colors={["#7c3aed", "#9333ea"]} style={styles.fabInner}>
            <Ionicons name="add" size={28} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      <Modal visible={showAssignModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
          <LinearGradient
            colors={["#7c3aed", "#9333ea"]}
            style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}
          >
            <TouchableOpacity onPress={() => setShowAssignModal(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Assignment</Text>
            <TouchableOpacity onPress={createAssignment} style={styles.confirmBtn}>
              <Text style={styles.confirmText}>Assign</Text>
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: insets.bottom + 40 }}>
            <View>
              <Text style={styles.modalSectionTitle}>Select Patient</Text>
              {patients.length === 0 ? (
                <Text style={styles.noneText}>No patients registered</Text>
              ) : (
                patients.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelectedPatient(p.id)}
                    style={[styles.selectRow, selectedPatient === p.id && styles.selectRowActive]}
                  >
                    <View style={[styles.selectAvatar, { backgroundColor: "#f0fdf4" }]}>
                      <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#059669" }}>
                        {p.name.charAt(0)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectName}>{p.name}</Text>
                      <Text style={styles.selectEmail}>{p.email}</Text>
                    </View>
                    {selectedPatient === p.id && (
                      <Ionicons name="checkmark-circle" size={22} color="#059669" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View>
              <Text style={styles.modalSectionTitle}>Select Caretaker</Text>
              {caretakers.length === 0 ? (
                <Text style={styles.noneText}>No caretakers registered</Text>
              ) : (
                caretakers.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setSelectedCaretaker(c.id)}
                    style={[styles.selectRow, selectedCaretaker === c.id && styles.selectRowActiveBlue]}
                  >
                    <View style={[styles.selectAvatar, { backgroundColor: "#f0f9ff" }]}>
                      <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: "#0284c7" }}>
                        {c.name.charAt(0)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectName}>{c.name}</Text>
                      <Text style={styles.selectEmail}>{c.email}</Text>
                    </View>
                    {selectedCaretaker === c.id && (
                      <Ionicons name="checkmark-circle" size={22} color="#0284c7" />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function UserRow({ user, onDelete, isCurrentUser }: { user: User; onDelete: () => void; isCurrentUser: boolean }) {
  const cfg = ROLE_COLORS[user.role as keyof typeof ROLE_COLORS] ?? { color: "#64748b", bg: "#f8fafc" };
  const icon = ROLE_ICONS[user.role] ?? "person-outline";
  return (
    <View style={urStyles.row}>
      <View style={[urStyles.avatar, { backgroundColor: cfg.bg }]}>
        <Ionicons name={icon} size={18} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={urStyles.name}>{user.name}</Text>
          {isCurrentUser && <View style={urStyles.youBadge}><Text style={urStyles.youText}>You</Text></View>}
        </View>
        <Text style={urStyles.email}>{user.email}</Text>
        {user.phone && <Text style={urStyles.phone}>{user.phone}</Text>}
      </View>
      {!isCurrentUser && (
        <TouchableOpacity onPress={onDelete} style={urStyles.deleteBtn}>
          <Ionicons name="trash-outline" size={17} color="#ef4444" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const urStyles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  avatar: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#0f172a" },
  youBadge: { backgroundColor: "#7c3aed", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  youText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
  email: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748b", marginTop: 2 },
  phone: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  deleteBtn: { padding: 8 },
});

function AssignmentCard({ assignment, onDelete }: { assignment: Assignment; onDelete: () => void }) {
  return (
    <View style={acStyles.card}>
      <View style={acStyles.patient}>
        <View style={[acStyles.avatar, { backgroundColor: "#f0fdf4" }]}>
          <Text style={[acStyles.avatarText, { color: "#059669" }]}>{assignment.patient.name.charAt(0)}</Text>
        </View>
        <View>
          <Text style={acStyles.roleTag}>Patient</Text>
          <Text style={acStyles.personName}>{assignment.patient.name}</Text>
          <Text style={acStyles.personEmail}>{assignment.patient.email}</Text>
        </View>
      </View>

      <View style={acStyles.arrow}>
        <Ionicons name="arrow-forward" size={20} color="#7c3aed" />
      </View>

      <View style={acStyles.caretaker}>
        <View style={[acStyles.avatar, { backgroundColor: "#f0f9ff" }]}>
          <Text style={[acStyles.avatarText, { color: "#0284c7" }]}>{assignment.caretaker.name.charAt(0)}</Text>
        </View>
        <View>
          <Text style={[acStyles.roleTag, { color: "#0284c7" }]}>Caretaker</Text>
          <Text style={acStyles.personName}>{assignment.caretaker.name}</Text>
          <Text style={acStyles.personEmail}>{assignment.caretaker.email}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={onDelete} style={acStyles.deleteBtn}>
        <Ionicons name="trash-outline" size={17} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

const acStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  patient: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  caretaker: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  roleTag: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#059669", marginBottom: 2 },
  personName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0f172a" },
  personEmail: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  arrow: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#f5f3ff", alignItems: "center", justifyContent: "center",
  },
  deleteBtn: { padding: 8 },
});

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  userName: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statChip: { flex: 1, alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 10 },
  statVal: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
  tabRow: { flexDirection: "row", gap: 8, paddingBottom: 16, paddingTop: 4 },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)" },
  tabTextActive: { color: "#7c3aed", fontFamily: "Inter_600SemiBold" },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#334155", flex: 1 },
  groupCount: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  groupCountText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  emptyGroup: { backgroundColor: "#fff", borderRadius: 12, padding: 16, alignItems: "center" },
  emptyGroupText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: "#f5f3ff", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#334155" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#94a3b8", textAlign: "center", paddingHorizontal: 20 },
  fab: { position: "absolute", right: 20 },
  fabInner: {
    width: 60, height: 60, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#7c3aed", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  confirmBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  confirmText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  modalSectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#334155", marginBottom: 12 },
  noneText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  selectRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 2, borderColor: "#e2e8f0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  selectRowActive: { borderColor: "#10b981", backgroundColor: "#f0fdf4" },
  selectRowActiveBlue: { borderColor: "#0284c7", backgroundColor: "#f0f9ff" },
  selectAvatar: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  selectName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#0f172a" },
  selectEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748b", marginTop: 2 },
});
