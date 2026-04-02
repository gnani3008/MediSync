import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const frequencyLabel: Record<string, string> = {
  daily: "Once daily",
  twice_daily: "Twice daily",
  thrice_daily: "3× daily",
  weekly: "Weekly",
  as_needed: "As needed",
};

interface Medicine {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  notes?: string | null;
  isActive: boolean;
}

interface Props {
  medicine: Medicine;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

export function MedicineCard({ medicine, onEdit, onDelete, showActions = false }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.pill, { backgroundColor: medicine.isActive ? colors.primary + "15" : colors.muted }]}>
          <Feather name="activity" size={14} color={medicine.isActive ? colors.primary : colors.mutedForeground} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={[styles.name, { color: colors.foreground }]}>{medicine.name}</Text>
          <Text style={[styles.dosage, { color: colors.mutedForeground }]}>{medicine.dosage}</Text>
        </View>
        {showActions && (
          <View style={styles.actions}>
            {onEdit && (
              <TouchableOpacity onPress={onEdit} style={[styles.actionBtn, { backgroundColor: colors.accent }]}>
                <Feather name="edit-2" size={14} color={colors.accentForeground} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity onPress={onDelete} style={[styles.actionBtn, { backgroundColor: colors.destructive + "15" }]}>
                <Feather name="trash-2" size={14} color={colors.destructive} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <View style={[styles.tag, { backgroundColor: colors.secondary }]}>
          <Feather name="clock" size={11} color={colors.mutedForeground} />
          <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{frequencyLabel[medicine.frequency] || medicine.frequency}</Text>
        </View>
        {medicine.times.map((t, i) => (
          <View key={i} style={[styles.tag, { backgroundColor: colors.primary + "10" }]}>
            <Text style={[styles.tagText, { color: colors.primary }]}>{t}</Text>
          </View>
        ))}
      </View>
      {medicine.notes ? (
        <Text style={[styles.notes, { color: colors.mutedForeground }]}>{medicine.notes}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flex: 1 },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  dosage: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  notes: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    lineHeight: 18,
  },
});
