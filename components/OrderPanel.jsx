import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { Badge } from './shared/Badge';
import { Button } from './shared/Button';
import { CloseTableModal } from './CloseTableModal';
import { colors } from '../styles/colors';

export function OrderPanel({ table, onClose, getActiveOrder, closeOrder }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    if (table) {
      loadOrder();
    }
  }, [table]);

  async function loadOrder() {
    setLoading(true);
    try {
      const o = await getActiveOrder(table.id);
      setOrder(o);
    } catch (e) {
      Alert.alert('Hata', e.message);
    } finally {
      setLoading(false);
    }
  }

  const items = order?.order_items || [];
  const total = items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);

  async function handleCloseOrder(orderId, tableId, paymentMethod, totalAmount) {
    await closeOrder(orderId, tableId, paymentMethod, totalAmount);
    onClose();
  }

  return (
    <SafeAreaView style={styles.panel} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.tableName}>{table?.name}</Text>
          <Badge label="Açık" variant="success" />
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeX}>✕</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: verticalScale(32) }} />
      ) : !order ? (
        <Text style={styles.noOrder}>Aktif sipariş bulunamadı</Text>
      ) : (
        <>
          <ScrollView style={styles.items} showsVerticalScrollIndicator={false}>
            {items.map((item, idx) => (
              <View key={idx} style={styles.item}>
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                </View>
                <Text style={styles.itemName}>{item.products?.name}</Text>
                <Text style={styles.unitPrice}>₺{Number(item.unit_price).toFixed(2)}</Text>
                <Text style={styles.lineTotal}>₺{(item.unit_price * item.quantity).toFixed(2)}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Toplam</Text>
              <Text style={styles.totalAmount}>₺{total.toFixed(2)}</Text>
            </View>
            <Button
              title="Masayı Kapat"
              onPress={() => setShowCloseModal(true)}
              style={styles.closeOrderBtn}
            />
          </View>
        </>
      )}

      <CloseTableModal
        visible={showCloseModal}
        order={order}
        table={table}
        onClose={() => setShowCloseModal(false)}
        onConfirm={handleCloseOrder}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: colors.bgCard,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  tableName: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: scale(8),
  },
  closeX: {
    fontSize: moderateScale(18),
    color: colors.textMuted,
  },
  noOrder: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: moderateScale(15),
    marginTop: verticalScale(32),
  },
  items: {
    flex: 1,
    padding: scale(16),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(10),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: scale(8),
  },
  qtyBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: moderateScale(6),
    width: scale(28),
    height: scale(28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: colors.accent,
  },
  itemName: {
    flex: 1,
    fontSize: moderateScale(14),
    color: colors.textPrimary,
  },
  unitPrice: {
    fontSize: moderateScale(12),
    color: colors.textMuted,
  },
  lineTotal: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: colors.textPrimary,
    width: scale(60),
    textAlign: 'right',
  },
  footer: {
    padding: scale(16),
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: verticalScale(12),
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  totalLabel: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: colors.textSecondary,
  },
  totalAmount: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeOrderBtn: {
    width: '100%',
  },
});
