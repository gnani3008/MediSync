import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const eventConfig: Record<string, { label: string; icon: keyof typeof Feather.glyphMap; color: string }> = {
  motion_detected: { label: "Motion", icon: "activity", color: "#f59e0b" },
  box_opened: { label: "Box Opened", icon: "package", color: "#10b981" },
  box_closed: { label: "Box Closed", icon: "box", color: "#64748b" },
  alarm_triggered: { label: "Alarm", icon: "bell", color: "#ef4444" },
  alarm_acknowledged: { label: "Acknowledged", icon: "check-circle", color: "#0ea5e9" },
};

interface Props {
  eventType: string;
  timestamp: string;
  deviceId?: string;
  sensor?: string | null;
}

export function EventBadge({ eventType, timestamp, deviceId, sensor }: Props) {
  const colors = useColors();
  const config = eventConfig[eventType] || { label: eventType, icon: "zap" as const, color: colors.mutedForeground };
  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: config.color + "15" }]}>
        <Feather name={config.icon as any} size={18} color={config.color} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.label, { color: colors.foreground }]}>{config.label}</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {sensor ? `${sensor.toUpperCase()} · ` : ""}{dateStr} at {timeStr}
        </Text>
      </View>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1 },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  sub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
