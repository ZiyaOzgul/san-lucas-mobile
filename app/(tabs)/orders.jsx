import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { Badge } from '../../components/shared/Badge';
import { useOrders } from '../../hooks/useOrders';
import { colors } from '../../styles/colors';

const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Aktif' },
  { key: 'completed', label: 'Tamamlandı' },
  { key: 'cancelled', label: 'İptal' },
];

function statusBadge(status) {
  if (status === 'active') return { label: 'Aktif', variant: 'success' };
  if (status === 'completed') return { label: 'Tamamlandı', variant: 'default' };
  return { label: 'İptal', variant: 'danger' };
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function OrdersScreen() {
  const [filter, setFilter] = useState('all');
  const { orders, loading, refetch } = useOrders(filter);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const badge = selectedOrder ? statusBadge(selectedOrder.status) : null;

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const { label, variant } = statusBadge(item.status);
            const summary = item.order_items?.slice(0, 2).map(i => i.products?.name).filter(Boolean).join(', ');
            return (
              <TouchableOpacity
                style={[
                  styles.orderCard,
                  item.status === 'active' && styles.orderActive,
                  item.status === 'cancelled' && styles.orderCancelled,
                ]}
                onPress={() => setSelectedOrder(item)}
                activeOpacity={0.8}
              >
                <View style={styles.orderTop}>
                  <Text style={styles.orderTable}>{item.tables?.name || 'Masa ?'}</Text>
                  <Badge label={label} variant={variant} />
                </View>
                <Text style={styles.orderSummary} numberOfLines={1}>{summary || 'Sipariş detayı yok'}</Text>
                <View style={styles.orderBottom}>
                  <Text style={styles.orderTotal}>₺{Number(item.total).toFixed(2)}</Text>
                  <Text style={styles.orderTime}>{formatDate(item.created_at)} {formatTime(item.created_at)}</Text>
                  <Text style={styles.orderPayment}>
                    {item.payment_method === 'cash' ? '💵 Nakit' : item.payment_method === 'card' ? '💳 Kart' : '—'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Sipariş bulunamadı</Text>
          }
        />
      )}

      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedOrder(null)}
      >
        {selectedOrder && (
          <SafeAreaView style={styles.detail} edges={['top', 'bottom']}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{selectedOrder.tables?.name} — #{selectedOrder.id}</Text>
              <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                <Text style={styles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailMeta}>
              {badge && <Badge label={badge.label} variant={badge.variant} />}
              <Text style={styles.detailDate}>
                {formatDate(selectedOrder.created_at)} {formatTime(selectedOrder.created_at)}
              </Text>
            </View>

            <FlatList
              data={selectedOrder.order_items || []}
              keyExtractor={(item, idx) => String(idx)}
              contentContainerStyle={styles.detailItems}
              renderItem={({ item }) => (
                <View style={styles.detailItem}>
                  <Text style={styles.detailQty}>{item.quantity}x</Text>
                  <Text style={styles.detailName}>{item.products?.name}</Text>
                  <Text style={styles.detailPrice}>₺{(item.unit_price * item.quantity).toFixed(2)}</Text>
                </View>
              )}
            />

            <View style={styles.detailFooter}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Ödeme</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder.payment_method === 'cash' ? 'Nakit' : selectedOrder.payment_method === 'card' ? 'Kart' : '—'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Toplam</Text>
                <Text style={[styles.detailValue, styles.detailTotal]}>₺{Number(selectedOrder.total).toFixed(2)}</Text>
              </View>
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: scale(8),
  },
  filterTab: {
    flex: 1,
    paddingVertical: verticalScale(12),
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: colors.accent,
  },
  filterText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.accent,
  },
  list: {
    padding: scale(12),
    gap: scale(10),
  },
  orderCard: {
    backgroundColor: colors.bgCard,
    borderRadius: moderateScale(10),
    padding: scale(14),
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: scale(3),
    borderLeftColor: 'transparent',
    marginBottom: verticalScale(8),
    elevation: 1,
  },
  orderActive: {
    borderLeftColor: colors.success,
  },
  orderCancelled: {
    opacity: 0.6,
    borderLeftColor: colors.danger,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  orderTable: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  orderSummary: {
    fontSize: moderateScale(13),
    color: colors.textSecondary,
    marginBottom: verticalScale(8),
  },
  orderBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  orderTotal: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  orderTime: {
    fontSize: moderateScale(11),
    color: colors.textMuted,
  },
  orderPayment: {
    fontSize: moderateScale(11),
    color: colors.textMuted,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: moderateScale(15),
    marginTop: verticalScale(48),
  },
  detail: {
    flex: 1,
    backgroundColor: colors.bgCard,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailTitle: {
    fontSize: moderateScale(17),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeX: {
    fontSize: moderateScale(18),
    color: colors.textMuted,
    padding: scale(4),
  },
  detailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    padding: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailDate: {
    fontSize: moderateScale(13),
    color: colors.textMuted,
  },
  detailItems: {
    padding: scale(16),
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(10),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: scale(8),
  },
  detailQty: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: colors.accent,
    width: scale(28),
  },
  detailName: {
    flex: 1,
    fontSize: moderateScale(14),
    color: colors.textPrimary,
  },
  detailPrice: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  detailFooter: {
    padding: scale(16),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(6),
  },
  detailLabel: {
    fontSize: moderateScale(14),
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  detailTotal: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: colors.textPrimary,
  },
});
