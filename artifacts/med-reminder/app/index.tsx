import React from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  StatusBar, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";

const ROLES = [
  {
    id: "admin",
    title: "Administrator",
    subtitle: "Manage users & assign patients to caretakers",
    icon: "shield-checkmark" as const,
    gradient: ["#7c3aed", "#9333ea"] as [string, string],
    lightBg: "#f5f3ff",
    lightIcon: "#7c3aed",
    badge: "Full Access",
  },
  {
    id: "caretaker",
    title: "Caretaker",
    subtitle: "Monitor patients & receive real-time medicine alerts",
    icon: "people" as const,
    gradient: ["#0284c7", "#0ea5e9"] as [string, string],
    lightBg: "#f0f9ff",
    lightIcon: "#0284c7",
    badge: "Live Alerts",
  },
  {
    id: "patient",
    title: "Patient",
    subtitle: "View medications, reminders & box activity",
    icon: "person" as const,
    gradient: ["#059669", "#10b981"] as [string, string],
    lightBg: "#f0fdf4",
    lightIcon: "#059669",
    badge: "Personal",
  },
];

const FEATURES = [
  { icon: "notifications" as const, label: "Smart Alarms", desc: "Buzzer alerts" },
  { icon: "flash" as const, label: "PIR Sensors", desc: "Motion detect" },
  { icon: "wifi" as const, label: "Real-time", desc: "ESP32 live data" },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  if (user) {
    if (user.role === "admin") { router.replace("/admin"); return null; }
    if (user.role === "caretaker") { router.replace("/caretaker"); return null; }
    if (user.role === "patient") { router.replace("/patient"); return null; }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={["#1e1b4b", "#0f172a"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <LinearGradient
            colors={["#7c3aed", "#0ea5e9"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoBg}
          >
            <Ionicons name="medkit" size={34} color="#fff" />
          </LinearGradient>
          <Text style={styles.appName}>MediCare</Text>
          <Text style={styles.tagline}>Smart medicine reminder ecosystem</Text>
          <Text style={styles.taglineSub}>Powered by ESP32 IoT sensors</Text>
        </View>

        <Text style={styles.sectionLabel}>SELECT YOUR ROLE</Text>

        <View style={styles.roles}>
          {ROLES.map((role) => (
            <TouchableOpacity
              key={role.id}
              activeOpacity={0.88}
              onPress={() => router.push(`/auth?role=${role.id}`)}
              style={styles.roleBtn}
            >
              <LinearGradient
                colors={role.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.roleCard}
              >
                <View style={styles.roleLeft}>
                  <View style={styles.roleIconWrap}>
                    <Ionicons name={role.icon} size={26} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleTitle}>{role.title}</Text>
                    <Text style={styles.roleSub}>{role.subtitle}</Text>
                  </View>
                </View>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{role.badge}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.featureRow}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.featureCard}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon} size={22} color="#7c3aed" />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Ionicons name="hardware-chip-outline" size={14} color="#475569" />
          <Text style={styles.footerText}>  ESP32 + PIR + OLED + Buzzer</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  header: { alignItems: "center", marginBottom: 36, gap: 6 },
  logoBg: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12, shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20,
    elevation: 12,
  },
  appName: {
    fontSize: 34, fontFamily: "Inter_700Bold", color: "#f8fafc", letterSpacing: -0.5,
  },
  tagline: { fontSize: 15, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  taglineSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569" },
  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#475569",
    letterSpacing: 1.5, marginBottom: 14,
  },
  roles: { gap: 12, marginBottom: 28 },
  roleBtn: {
    borderRadius: 18, overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12,
    elevation: 8,
  },
  roleCard: {
    flexDirection: "row", alignItems: "center", padding: 18, gap: 0,
  },
  roleLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  roleIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  roleTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 3 },
  roleSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", lineHeight: 17 },
  roleBadge: {
    backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  roleBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
  featureRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  featureCard: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, padding: 14, alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  featureIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "rgba(124,58,237,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  featureLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#e2e8f0", textAlign: "center" },
  featureDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748b", textAlign: "center" },
  footer: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  footerText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569" },
});
