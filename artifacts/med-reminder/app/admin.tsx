import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useApiClient } from "@/hooks/useApiClient";
import type { AuthUser } from "@/context/AuthContext";
import colors from "@/constants/colors";

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

export default function AdminScreen() {
  const c = useColors();
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

  async function handleAssign() {
    if (!selectedPatient || !selectedCaretaker) {
      Alert.alert("Select both a patient and caretaker");
      return;
    }
    try {
      await request("/assignments", {
        method: "POST",
        body: JSON.stringify({ patientId: selectedPatient, caretakerId: selectedCaretaker }),
      });
      setShowAssignModal(false);
      setSelectedPatient(null);
      setSelectedCaretaker(null);
      loadData();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  async function handleDeleteAssignment(id: number) {
    Alert.alert("Remove Assignment", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          try {
            await request(`/assignments/${id}`, { method: "DELETE" });
            loadData();
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  }

  async function handleDeleteUser(id: number) {
    Alert.alert("Delete User", "This will remove the user and all their data.", [
      { text: "Cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await request(`/users/${id}`, { method: "DELETE" });
            loadData();
          } catch (err: any) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  }

  const patients = users.filter(u => u.role === "patient");
  const caretakers = users.filter(u => u.role === "caretaker");

  const roleColor = (role: string) => {
    if (role === "admin") return colors.light.adminColor;
    if (role === "caretaker") return colors.light.caretakerColor;
    return colors.light.patientColor;
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12, backgroundColor: c.card, borderBottomColor: c.border }]}>
        <View>
          <Text style={[styles.greeting, { color: c.mutedForeground }]}>Administrator</Text>
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
        {([["users", "Users"], ["assignments", "Assignments"]] as const).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tab, tab === key && { borderBottomColor: colors.light.adminColor, borderBottomWidth: 2 }]} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, { color: tab === key ? colors.light.adminColor : c.mutedForeground, fontFamily: tab === key ? "Inter_600SemiBold" : "Inter_400Regular" }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} size="large" /></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }} showsVerticalScrollIndicator={false}>
          {tab === "users" ? (
            <View style={{ gap: 10 }}>
              {users.map(u => (
                <View key={u.id} style={[styles.userCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={[styles.avatar, { backgroundColor: roleColor(u.role) + "20" }]}>
                    <Text style={[styles.avatarText, { color: roleColor(u.role) }]}>{u.name[0]}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: c.foreground }]}>{u.name}</Text>
                    <Text style={[styles.userEmail, { color: c.mutedForeground }]}>{u.email}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: roleColor(u.role) + "15" }]}>
                      <Text style={[styles.roleText, { color: roleColor(u.role) }]}>{u.role}</Text>
                    </View>
                  </View>
                  {u.id !== user?.id && (
                    <TouchableOpacity onPress={() => handleDeleteUser(u.id)} style={[styles.deleteBtn, { backgroundColor: c.destructive + "10" }]}>
                      <Feather name="trash-2" size={15} color={c.destructive} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.light.adminColor }]}
                onPress={() => setShowAssignModal(true)}
              >
                <Feather name="plus" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Assign Patient to Caretaker</Text>
              </TouchableOpacity>

              {assignments.length === 0 && (
                <View style={styles.empty}>
                  <Feather name="link-2" size={36} color={c.mutedForeground} />
                  <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No assignments yet</Text>
                </View>
              )}

              {assignments.map(a => (
                <View key={a.id} style={[styles.assignCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={styles.assignRow}>
                    <View style={[styles.miniAvatar, { backgroundColor: colors.light.patientColor + "20" }]}>
                      <Text style={[styles.miniAvatarText, { color: colors.light.patientColor }]}>{a.patient?.name?.[0] ?? "P"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.assignName, { color: c.foreground }]}>{a.patient?.name}</Text>
                      <Text style={[styles.assignRole, { color: colors.light.patientColor }]}>Patient</Text>
                    </View>
                  </View>
                  <View style={[styles.arrowWrap, { backgroundColor: c.muted }]}>
                    <Feather name="arrow-right" size={14} color={c.mutedForeground} />
                  </View>
                  <View style={styles.assignRow}>
                    <View style={[styles.miniAvatar, { backgroundColor: colors.light.caretakerColor + "20" }]}>
                      <Text style={[styles.miniAvatarText, { color: colors.light.caretakerColor }]}>{a.caretaker?.name?.[0] ?? "C"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.assignName, { color: c.foreground }]}>{a.caretaker?.name}</Text>
                      <Text style={[styles.assignRole, { color: colors.light.caretakerColor }]}>Caretaker</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteAssignment(a.id)} style={[styles.deleteBtn, { backgroundColor: c.destructive + "10" }]}>
                    <Feather name="x" size={15} color={c.destructive} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={showAssignModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: c.card }]}>
            <Text style={[styles.modalTitle, { color: c.foreground }]}>Assign Patient to Caretaker</Text>

            <Text style={[styles.modalLabel, { color: c.mutedForeground }]}>Select Patient</Text>
            {patients.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.selectOption, { borderColor: selectedPatient === p.id ? colors.light.patientColor : c.border, backgroundColor: selectedPatient === p.id ? colors.light.patientColor + "10" : c.background }]}
                onPress={() => setSelectedPatient(p.id)}
              >
                <Text style={[styles.selectText, { color: c.foreground }]}>{p.name}</Text>
                {selectedPatient === p.id && <Feather name="check" size={16} color={colors.light.patientColor} />}
              </TouchableOpacity>
            ))}

            <Text style={[styles.modalLabel, { color: c.mutedForeground, marginTop: 12 }]}>Select Caretaker</Text>
            {caretakers.map(ct => (
              <TouchableOpacity
                key={ct.id}
                style={[styles.selectOption, { borderColor: selectedCaretaker === ct.id ? colors.light.caretakerColor : c.border, backgroundColor: selectedCaretaker === ct.id ? colors.light.caretakerColor + "10" : c.background }]}
                onPress={() => setSelectedCaretaker(ct.id)}
              >
                <Text style={[styles.selectText, { color: c.foreground }]}>{ct.name}</Text>
                {selectedCaretaker === ct.id && <Feather name="check" size={16} color={colors.light.caretakerColor} />}
              </TouchableOpacity>
            ))}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: c.muted }]} onPress={() => setShowAssignModal(false)}>
                <Text style={[styles.modalBtnText, { color: c.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.light.adminColor }]} onPress={handleAssign}>
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>Assign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom right FAB */}
      <View style={{ position: "absolute", bottom: insets.bottom + 20, right: 20 }}>
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.light.adminColor }]} onPress={loadData}>
          <Feather name="refresh-cw" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
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
  tabText: { fontSize: 14 },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  userCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  avatar: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  userInfo: { flex: 1, gap: 4 },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  userEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  roleBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 2 },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 4,
    justifyContent: "center",
  },
  addBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 40 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  assignCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  assignRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  arrowWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  miniAvatar: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  miniAvatarText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  assignName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  assignRole: { fontSize: 11, fontFamily: "Inter_400Regular", textTransform: "uppercase" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 8, maxHeight: "85%" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 8 },
  modalLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  selectOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 6,
  },
  selectText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  modalBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  modalBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  fab: {
    width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
  },
});
