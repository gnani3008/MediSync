import React from "react";
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { RoleCard } from "@/components/RoleCard";
import colors from "@/constants/colors";

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const c = useColors();

  if (user) {
    if (user.role === "admin") { router.replace("/admin"); return null; }
    if (user.role === "caretaker") { router.replace("/caretaker"); return null; }
    if (user.role === "patient") { router.replace("/patient"); return null; }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={[styles.logoWrap, { backgroundColor: c.primary + "15" }]}>
          <Feather name="heart" size={32} color={c.primary} />
        </View>
        <Text style={[styles.appName, { color: c.foreground }]}>MediCare</Text>
        <Text style={[styles.tagline, { color: c.mutedForeground }]}>Smart medicine reminders for better health</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>Choose your role to get started</Text>
        <RoleCard
          title="Administrator"
          subtitle="Manage users, assign patients & caretakers"
          icon="shield"
          color={colors.light.adminColor}
          onPress={() => router.push("/auth?role=admin")}
        />
        <RoleCard
          title="Caretaker"
          subtitle="Monitor patients & receive medicine alerts"
          icon="users"
          color={colors.light.caretakerColor}
          onPress={() => router.push("/auth?role=caretaker")}
        />
        <RoleCard
          title="Patient"
          subtitle="View my medications & reminders"
          icon="user"
          color={colors.light.patientColor}
          onPress={() => router.push("/auth?role=patient")}
        />
      </View>

      <View style={styles.features}>
        {[
          { icon: "bell", label: "Smart Alarms", desc: "Buzzer alerts at medication times" },
          { icon: "zap", label: "Motion Detection", desc: "PIR sensors detect box interaction" },
          { icon: "wifi", label: "Real-time Updates", desc: "Live ESP32 sensor data" },
        ].map(f => (
          <View key={f.label} style={[styles.featureItem, { backgroundColor: c.card, borderColor: c.border }]}>
            <Feather name={f.icon as any} size={20} color={c.primary} />
            <Text style={[styles.featureLabel, { color: c.foreground }]}>{f.label}</Text>
            <Text style={[styles.featureDesc, { color: c.mutedForeground }]}>{f.desc}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: "center", gap: 12, marginBottom: 36, paddingHorizontal: 20 },
  logoWrap: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  appName: { fontSize: 32, fontFamily: "Inter_700Bold" },
  tagline: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  section: { gap: 0, marginBottom: 24 },
  sectionLabel: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    textTransform: "uppercase", letterSpacing: 0.8,
    marginBottom: 12, marginHorizontal: 20,
  },
  features: {
    flexDirection: "row", gap: 10, marginHorizontal: 20, marginTop: 8,
  },
  featureItem: {
    flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 6, alignItems: "center",
  },
  featureLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  featureDesc: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 15 },
});
