import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";
import { colors } from "../styles/colors";
function getTimeOpen(createdAt) {
  if (!createdAt) return "";
  const diff = Math.floor((Date.now() - new Date(createdAt)) / 60000);
  if (diff < 1) return "az önce";
  if (diff < 60) return `${diff} dk`;
  return `${Math.floor(diff / 60)} sa ${diff % 60} dk`;
}

export function TableCard({ table, order, onPress, isSelected }) {
  const isOccupied = table.status === "occupied";
  const total = order?.total || 0;

  // Tick every 30s so elapsed time updates live without a refetch.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isOccupied || !order?.created_at) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [isOccupied, order?.created_at]);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isOccupied ? styles.cardActive : styles.cardEmpty,
        isSelected && styles.cardSelected,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {isOccupied && <Text style={styles.activeTag}>AKTİF</Text>}

      <MaterialIcons
        name="table-restaurant"
        size={moderateScale(32)}
        color={isOccupied ? colors.onSecondaryContainer : colors.outline}
        style={[styles.icon, !isOccupied && styles.iconEmpty]}
      />

      <Text
        style={[
          styles.tableName,
          isOccupied ? styles.tableNameActive : styles.tableNameEmpty,
        ]}
      >
        {table.name}
      </Text>

      {isOccupied && order ? (
        <Text style={styles.total}>₺{Number(total).toFixed(2)}</Text>
      ) : (
        <Text style={styles.emptyLabel}>Boş</Text>
      )}

      {isOccupied && order?.created_at ? (
        <Text style={styles.time}>{getTimeOpen(order.created_at)}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1,
    borderRadius: moderateScale(16),
    alignItems: "center",
    justifyContent: "center",
    padding: scale(12),
    position: "relative",
  },
  cardActive: {
    backgroundColor: colors.secondaryContainer,
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  cardEmpty: {
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: scale(1.5),
    borderColor: colors.outlineVariant,
    borderStyle: "dashed",
  },
  cardSelected: {
    backgroundColor: colors.primaryContainer,
  },
  activeTag: {
    position: "absolute",
    top: scale(10),
    right: scale(12),
    fontSize: moderateScale(9),
    fontWeight: "800",
    letterSpacing: 1.5,
    color: colors.onSecondaryContainer,
    opacity: 0.6,
  },
  icon: {
    marginBottom: verticalScale(6),
  },
  iconEmpty: {
    opacity: 0.3,
  },
  tableName: {
    fontSize: moderateScale(17),
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  tableNameActive: {
    color: colors.onSecondaryContainer,
  },
  tableNameEmpty: {
    color: colors.onSurfaceVariant,
    fontWeight: "700",
  },
  total: {
    fontSize: moderateScale(11),
    fontWeight: "600",
    color: colors.onSecondaryContainer,
    marginTop: verticalScale(2),
    opacity: 0.8,
  },
  emptyLabel: {
    fontSize: moderateScale(11),
    fontWeight: "500",
    color: colors.outline,
    marginTop: verticalScale(2),
    opacity: 0.7,
  },
  time: {
    fontSize: moderateScale(9),
    color: colors.onSecondaryContainer,
    marginTop: verticalScale(2),
    opacity: 0.55,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
});
