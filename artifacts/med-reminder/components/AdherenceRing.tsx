import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  rate: number;
  size?: number;
  label?: string;
}

export function AdherenceRing({ rate, size = 80, label = "Adherence" }: Props) {
  const colors = useColors();
  const clampedRate = Math.max(0, Math.min(100, rate));
  const color = clampedRate >= 80 ? colors.success : clampedRate >= 50 ? colors.warning : colors.destructive;

  return (
    <View style={styles.wrap}>
      <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color + "30", borderWidth: 6 }]}>
        <View style={[styles.innerRing, { width: size - 12, height: size - 12, borderRadius: (size - 12) / 2, borderColor: color, borderWidth: 3 }]}>
          <Text style={[styles.rate, { color, fontSize: size > 70 ? 22 : 16, fontFamily: "Inter_700Bold" }]}>{clampedRate}%</Text>
        </View>
      </View>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 6 },
  ring: { alignItems: "center", justifyContent: "center" },
  innerRing: { alignItems: "center", justifyContent: "center" },
  rate: {},
  label: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
