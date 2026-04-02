import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import type { UserRole, AuthUser } from "@/context/AuthContext";

const ROLE_CONFIG = {
  admin: {
    label: "Administrator",
    gradient: ["#7c3aed", "#9333ea"] as [string, string],
    icon: "shield-checkmark" as const,
  },
  caretaker: {
    label: "Caretaker",
    gradient: ["#0284c7", "#0ea5e9"] as [string, string],
    icon: "people" as const,
  },
  patient: {
    label: "Patient",
    gradient: ["#059669", "#10b981"] as [string, string],
    icon: "person" as const,
  },
};

export default function AuthScreen() {
  const { role = "patient" } = useLocalSearchParams<{ role: UserRole }>();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const cfg = ROLE_CONFIG[role as UserRole] || ROLE_CONFIG.patient;

  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPw, setShowPw] = useState(false);

  const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

  async function handleSubmit() {
    if (!email.trim() || !password.trim() || (isRegister && !name.trim())) {
      Alert.alert("Missing Fields", "Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const body = isRegister
        ? { name: name.trim(), email: email.trim(), password, role, phone: phone.trim() || undefined }
        : { email: email.trim(), password };

      const res = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Authentication Failed", data.message || "Please check your credentials.");
        return;
      }

      await login(data.token, data.user as AuthUser);
      if (data.user.role === "admin") router.replace("/admin");
      else if (data.user.role === "caretaker") router.replace("/caretaker");
      else router.replace("/patient");
    } catch {
      Alert.alert("Network Error", "Could not connect to the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={cfg.gradient} style={styles.topBand}>
        <View style={[styles.topContent, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.topCenter}>
            <View style={styles.iconCircle}>
              <Ionicons name={cfg.icon} size={30} color="#fff" />
            </View>
            <Text style={styles.roleLabel}>{cfg.label}</Text>
            <Text style={styles.roleDesc}>
              {isRegister ? "Create your account to get started" : "Sign in to your account"}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={[styles.formContent, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.formTitle}>{isRegister ? "Create Account" : "Welcome Back"}</Text>

          {isRegister && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={18} color="#94a3b8" />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor="#cbd5e1"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color="#94a3b8" />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor="#cbd5e1"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {isRegister && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Phone <Text style={styles.optional}>(optional)</Text></Text>
              <View style={styles.inputRow}>
                <Ionicons name="call-outline" size={18} color="#94a3b8" />
                <TextInput
                  style={styles.input}
                  placeholder="+91 98765 43210"
                  placeholderTextColor="#cbd5e1"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
              <TextInput
                style={styles.input}
                placeholder={isRegister ? "Minimum 6 characters" : "Your password"}
                placeholderTextColor="#cbd5e1"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
              />
              <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={12}>
                <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.88}
            style={{ marginTop: 8 }}
          >
            <LinearGradient
              colors={cfg.gradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Text style={styles.submitText}>
                      {isRegister ? "Create Account" : "Sign In"}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity onPress={() => setIsRegister(!isRegister)} style={styles.toggleBtn}>
            <Text style={styles.toggleText}>
              {isRegister ? "Already have an account?" : "Don't have an account?"}{"  "}
            </Text>
            <Text style={[styles.toggleAction, { color: cfg.gradient[0] }]}>
              {isRegister ? "Sign In" : "Register"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBand: { paddingBottom: 36 },
  topContent: { paddingHorizontal: 20 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  topCenter: { alignItems: "center", gap: 10, paddingBottom: 8 },
  iconCircle: {
    width: 70, height: 70, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  roleLabel: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" },
  roleDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", textAlign: "center" },
  formScroll: { flex: 1, backgroundColor: "#f8fafc", marginTop: -24 },
  formContent: { paddingTop: 8, paddingHorizontal: 20 },
  card: {
    backgroundColor: "#fff", borderRadius: 24, padding: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 8,
  },
  formTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#0f172a", marginBottom: 20 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#475569", marginBottom: 8 },
  optional: { fontFamily: "Inter_400Regular", color: "#94a3b8" },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 1.5,
    borderColor: "#e2e8f0", paddingHorizontal: 14, paddingVertical: 13,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: "#0f172a" },
  submitBtn: {
    borderRadius: 14, paddingVertical: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: "#7c3aed", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e2e8f0" },
  dividerText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  toggleBtn: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap" },
  toggleText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#64748b" },
  toggleAction: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
