import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import colors from "@/constants/colors";
import type { UserRole, AuthUser } from "@/context/AuthContext";

const roleConfig = {
  admin: { label: "Administrator", color: colors.light.adminColor, icon: "shield" as const },
  caretaker: { label: "Caretaker", color: colors.light.caretakerColor, icon: "users" as const },
  patient: { label: "Patient", color: colors.light.patientColor, icon: "user" as const },
};

export default function AuthScreen() {
  const { role = "patient" } = useLocalSearchParams<{ role: UserRole }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPw, setShowPw] = useState(false);

  const cfg = roleConfig[role as UserRole] || roleConfig.patient;
  const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

  async function handleSubmit() {
    if (!email || !password || (isRegister && !name)) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const body = isRegister
        ? { name, email, password, role, phone: phone || undefined }
        : { email, password };

      const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data.message || "Authentication failed");
        return;
      }

      await login(data.token, data.user as AuthUser);

      if (data.user.role === "admin") router.replace("/admin");
      else if (data.user.role === "caretaker") router.replace("/caretaker");
      else router.replace("/patient");
    } catch (err) {
      Alert.alert("Network Error", "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={[styles.container, { backgroundColor: c.background }]}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()} style={[styles.back, { top: insets.top + 16 }]}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: cfg.color + "15" }]}>
            <Feather name={cfg.icon} size={32} color={cfg.color} />
          </View>
          <Text style={[styles.title, { color: c.foreground }]}>{cfg.label}</Text>
          <Text style={[styles.sub, { color: c.mutedForeground }]}>
            {isRegister ? "Create your account" : "Sign in to your account"}
          </Text>
        </View>

        <View style={styles.form}>
          {isRegister && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: c.mutedForeground }]}>Full Name</Text>
              <View style={[styles.inputWrap, { backgroundColor: c.card, borderColor: c.border }]}>
                <Feather name="user" size={16} color={c.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: c.foreground }]}
                  placeholder="Your name"
                  placeholderTextColor={c.mutedForeground}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          <View style={styles.field}>
            <Text style={[styles.label, { color: c.mutedForeground }]}>Email</Text>
            <View style={[styles.inputWrap, { backgroundColor: c.card, borderColor: c.border }]}>
              <Feather name="mail" size={16} color={c.mutedForeground} />
              <TextInput
                style={[styles.input, { color: c.foreground }]}
                placeholder="your@email.com"
                placeholderTextColor={c.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {isRegister && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: c.mutedForeground }]}>Phone (optional)</Text>
              <View style={[styles.inputWrap, { backgroundColor: c.card, borderColor: c.border }]}>
                <Feather name="phone" size={16} color={c.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: c.foreground }]}
                  placeholder="+1 234 567 8900"
                  placeholderTextColor={c.mutedForeground}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          )}

          <View style={styles.field}>
            <Text style={[styles.label, { color: c.mutedForeground }]}>Password</Text>
            <View style={[styles.inputWrap, { backgroundColor: c.card, borderColor: c.border }]}>
              <Feather name="lock" size={16} color={c.mutedForeground} />
              <TextInput
                style={[styles.input, { color: c.foreground }]}
                placeholder={isRegister ? "Min 6 characters" : "Your password"}
                placeholderTextColor={c.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
              />
              <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                <Feather name={showPw ? "eye-off" : "eye"} size={16} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: cfg.color, opacity: loading ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{isRegister ? "Create Account" : "Sign In"}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.toggle} onPress={() => setIsRegister(!isRegister)}>
            <Text style={[styles.toggleText, { color: c.mutedForeground }]}>
              {isRegister ? "Already have an account? " : "Don't have an account? "}
              <Text style={{ color: cfg.color, fontFamily: "Inter_600SemiBold" }}>
                {isRegister ? "Sign In" : "Register"}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  back: { position: "absolute", left: 20, zIndex: 10, padding: 4 },
  header: { alignItems: "center", gap: 10, marginBottom: 36, paddingHorizontal: 20, paddingTop: 40 },
  iconWrap: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular" },
  form: { paddingHorizontal: 20, gap: 16 },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 13,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  btn: {
    borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
  },
  btnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  toggle: { alignItems: "center", marginTop: 4 },
  toggleText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
