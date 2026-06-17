import { useEffect, useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { Badge } from './shared/Badge';
import { colors } from '../styles/colors';

function getTimeOpen(createdAt) {
  if (!createdAt) return '';
  const diff = Math.floor((Date.now() - new Date(createdAt)) / 60000);
  if (diff < 1) return 'az önce';
  if (diff < 60) return `${diff} dk`;
  return `${Math.floor(diff / 60)} sa ${diff % 60} dk`;
}

export function TableCard({ table, order, onPress, isSelected }) {
  const isOccupied = table.status === 'occupied';
  const itemCount = order?.order_items?.length || 0;
  const total = order?.total || 0;

  // Tick every 30s so the elapsed time updates live without a refetch.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isOccupied || !order?.created_at) return;
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [isOccupied, order?.created_at]);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isOccupied && styles.occupied,
        isSelected && styles.selected,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <Text style={styles.tableName}>{table.name}</Text>
        <Badge
          label={isOccupied ? 'Dolu' : 'Boş'}
          variant={isOccupied ? 'success' : 'default'}
        />
      </View>
      {isOccupied && order ? (
        <View style={styles.info}>
          <Text style={styles.itemCount}>{itemCount} ürün</Text>
          <Text style={styles.total}>₺{Number(total).toFixed(2)}</Text>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={moderateScale(11)} color={colors.textMuted} />
            <Text style={styles.time}>{getTimeOpen(order.created_at)}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.empty}>Boş masa</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: moderateScale(10),
    padding: scale(12),
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: scale(3),
    borderLeftColor: 'transparent',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
  occupied: {
    borderLeftColor: colors.success,
  },
  selected: {
    borderLeftColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  tableName: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  info: {
    gap: verticalScale(2),
  },
  itemCount: {
    fontSize: moderateScale(13),
    color: colors.textSecondary,
  },
  total: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    marginTop: verticalScale(2),
  },
  time: {
    fontSize: moderateScale(11),
    color: colors.textMuted,
  },
  empty: {
    fontSize: moderateScale(13),
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
