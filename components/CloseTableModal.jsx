import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { Button } from './shared/Button';
import { colors } from '../styles/colors';

export function CloseTableModal({ visible, order, table, onClose, onConfirm }) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);

  const items = order?.order_items || [];
  const total = items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(order.id, table.id, paymentMethod, total);
      onClose();
    } catch (e) {
      Alert.alert('Hata', e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!order || !table) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{table.name} — Hesap</Text>

          <ScrollView style={styles.itemsContainer} showsVerticalScrollIndicator={false}>
            {items.map((item, idx) => (
              <View key={idx} style={styles.item}>
                <Text style={styles.itemQty}>{item.quantity}x</Text>
                <Text style={styles.itemName}>{item.products?.name}</Text>
                <Text style={styles.itemTotal}>₺{(item.unit_price * item.quantity).toFixed(2)}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Toplam</Text>
            <Text style={styles.totalAmount}>₺{total.toFixed(2)}</Text>
          </View>

          <Text style={styles.paymentLabel}>Ödeme Yöntemi</Text>
          <View style={styles.paymentToggle}>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentActive]}
              onPress={() => setPaymentMethod('cash')}
            >
              <Text style={[styles.paymentText, paymentMethod === 'cash' && styles.paymentActiveText]}>Nakit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentActive]}
              onPress={() => setPaymentMethod('card')}
            >
              <Text style={[styles.paymentText, paymentMethod === 'card' && styles.paymentActiveText]}>Kart</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <Button title="İptal" variant="secondary" onPress={onClose} style={styles.actionBtn} />
            <Button title="Tahsil Et" onPress={handleConfirm} loading={loading} style={styles.actionBtn} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(16),
  },
  modal: {
    backgroundColor: colors.bgCard,
    borderRadius: moderateScale(12),
    padding: scale(20),
    width: '100%',
    maxHeight: '80%',
  },
  title: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: verticalScale(16),
  },
  itemsContainer: {
    maxHeight: verticalScale(180),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(6),
    gap: scale(8),
  },
  itemQty: {
    fontSize: moderateScale(13),
    color: colors.accent,
    fontWeight: '700',
    width: scale(28),
  },
  itemName: {
    flex: 1,
    fontSize: moderateScale(14),
    color: colors.textPrimary,
  },
  itemTotal: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: verticalScale(12),
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(16),
  },
  totalLabel: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: colors.textSecondary,
  },
  totalAmount: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: colors.textPrimary,
  },
  paymentLabel: {
    fontSize: moderateScale(13),
    color: colors.textSecondary,
    marginBottom: verticalScale(8),
  },
  paymentToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(8),
    overflow: 'hidden',
    marginBottom: verticalScale(16),
  },
  paymentOption: {
    flex: 1,
    paddingVertical: verticalScale(10),
    alignItems: 'center',
    backgroundColor: colors.bgCard,
  },
  paymentActive: {
    backgroundColor: colors.accent,
  },
  paymentText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: colors.textSecondary,
  },
  paymentActiveText: {
    color: '#fff',
  },
  actions: {
    flexDirection: 'row',
    gap: scale(12),
  },
  actionBtn: {
    flex: 1,
  },
});
