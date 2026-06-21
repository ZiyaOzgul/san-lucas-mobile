import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import { useCustomerOrders } from '../../../hooks/useCustomer';
import { colors } from '../../../styles/colors';

function PressScale({ style, onPress, children }) {
  const scaleV = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleV.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (scaleV.value = withSpring(0.98, { damping: 18, stiffness: 280 }))}
      onPressOut={() => (scaleV.value = withTiming(1, { duration: 170 }))}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

function statusMeta(status) {
  if (status === 'active')
    return { label: 'HAZIRLANIYOR', color: colors.tertiary, bg: colors.tertiaryContainer };
  if (status === 'completed')
    return { label: 'TAMAMLANDI', color: colors.secondary, bg: colors.secondaryContainer };
  return { label: 'İPTAL', color: colors.error, bg: colors.errorContainer };
}

function typeLabel(t) {
  if (t === 'delivery') return { label: 'Eve Teslim', icon: 'bicycle' };
  if (t === 'takeaway') return { label: 'Gel-Al', icon: 'walk' };
  return { label: 'Masada', icon: 'restaurant' };
}

function formatDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}

export default function CustomerOrders() {
  const { orders, loading, refetch } = useCustomerOrders();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function renderOrder({ item }) {
    const s = statusMeta(item.status);
    const t = typeLabel(item.order_type);
    const itemCount = (item.order_items || []).reduce((sum, oi) => sum + (oi.quantity || 0), 0);

    return (
      <PressScale style={styles.orderCard} onPress={() => setSelected(item)}>
        <View style={styles.orderTop}>
          <View>
            <Text style={styles.orderId}>#{item.id}</Text>
            <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
          </View>
        </View>

        <View style={styles.orderMeta}>
          <View style={styles.metaRow}>
            <Ionicons name={t.icon} size={moderateScale(15)} color={colors.onSurfaceVariant} />
            <Text style={styles.metaText}>{t.label}</Text>
          </View>
          <View style={styles.dotSep} />
          <View style={styles.metaRow}>
            <Ionicons name="cube-outline" size={moderateScale(15)} color={colors.onSurfaceVariant} />
            <Text style={styles.metaText}>{itemCount} ürün</Text>
          </View>
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.orderTotal}>₺{Number(item.total).toFixed(2)}</Text>
          <Ionicons name="chevron-forward" size={moderateScale(18)} color={colors.outline} />
        </View>
      </PressScale>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerRow}>
        <Text style={styles.title}>Siparişlerim</Text>
        {orders.length > 0 ? (
          <View style={styles.countChip}>
            <Text style={styles.countText}>{orders.length}</Text>
          </View>
        ) : null}
      </View>

      {loading && orders.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderOrder}
          contentContainerStyle={{
            paddingHorizontal: scale(20),
            paddingTop: verticalScale(10),
            paddingBottom: verticalScale(140),
            gap: verticalScale(10),
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={moderateScale(36)} color={colors.outline} />
              </View>
              <Text style={styles.emptyTitle}>Henüz sipariş yok</Text>
              <Text style={styles.emptyDesc}>İlk siparişinizi vermek için menüye göz atın.</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {selected ? (
              <ScrollView contentContainerStyle={{ padding: scale(20), paddingBottom: verticalScale(40) }}>
                <View style={styles.detailHeader}>
                  <View>
                    <Text style={styles.detailEyebrow}>SİPARİŞ DETAYI</Text>
                    <Text style={styles.detailId}>#{selected.id}</Text>
                  </View>
                  <View
                    style={[styles.statusPill, { backgroundColor: statusMeta(selected.status).bg }]}
                  >
                    <View
                      style={[styles.dot, { backgroundColor: statusMeta(selected.status).color }]}
                    />
                    <Text style={[styles.statusText, { color: statusMeta(selected.status).color }]}>
                      {statusMeta(selected.status).label}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaCard}>
                  <View style={styles.metaCardRow}>
                    <Ionicons name="time-outline" size={moderateScale(16)} color={colors.onPrimaryContainer} />
                    <Text style={styles.metaCardText}>{formatDate(selected.created_at)}</Text>
                  </View>
                  <View style={styles.metaCardRow}>
                    <Ionicons
                      name={typeLabel(selected.order_type).icon}
                      size={moderateScale(16)}
                      color={colors.onPrimaryContainer}
                    />
                    <Text style={styles.metaCardText}>{typeLabel(selected.order_type).label}</Text>
                  </View>
                  {selected.addresses ? (
                    <View style={styles.metaCardRow}>
                      <Ionicons name="location-outline" size={moderateScale(16)} color={colors.onPrimaryContainer} />
                      <Text style={styles.metaCardText} numberOfLines={2}>
                        {selected.addresses.label} — {selected.addresses.full_address}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.sectionLabel}>ÜRÜNLER</Text>
                <View style={styles.itemsList}>
                  {(selected.order_items || []).map((oi) => (
                    <View key={oi.id} style={styles.itemRow}>
                      <View style={styles.qtyBubble}>
                        <Text style={styles.qtyBubbleText}>{oi.quantity}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {oi.products?.name || 'Ürün'}
                        </Text>
                        {oi.product_variants?.name ? (
                          <Text style={styles.itemSub}>{oi.product_variants.name}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.itemAmt}>
                        ₺{(Number(oi.unit_price) * oi.quantity).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>

                {selected.customer_note ? (
                  <>
                    <Text style={styles.sectionLabel}>NOT</Text>
                    <View style={styles.noteBox}>
                      <Text style={styles.noteText}>{selected.customer_note}</Text>
                    </View>
                  </>
                ) : null}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Toplam</Text>
                  <Text style={styles.totalValue}>₺{Number(selected.total).toFixed(2)}</Text>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerRow: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(14),
    paddingBottom: verticalScale(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  countChip: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(20),
    backgroundColor: colors.secondaryContainer,
  },
  countText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: colors.onSecondaryContainer,
    letterSpacing: scale(0.5),
  },

  orderCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: moderateScale(16),
    padding: scale(14),
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderId: { fontSize: moderateScale(16), fontWeight: '800', color: colors.primary },
  orderDate: {
    fontSize: moderateScale(11),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(2),
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(20),
  },
  dot: { width: scale(6), height: scale(6), borderRadius: scale(3) },
  statusText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: scale(1),
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginTop: verticalScale(10),
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: scale(4) },
  metaText: { fontSize: moderateScale(11), color: colors.onSurfaceVariant, fontWeight: '600' },
  dotSep: {
    width: scale(3),
    height: scale(3),
    borderRadius: scale(1.5),
    backgroundColor: colors.outline,
  },
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: verticalScale(12),
  },
  orderTotal: { fontSize: moderateScale(18), fontWeight: '800', color: colors.secondary },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(40),
    paddingTop: verticalScale(60),
  },
  emptyIcon: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(16),
  },
  emptyTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: colors.primary,
    marginBottom: verticalScale(6),
  },
  emptyDesc: {
    fontSize: moderateScale(13),
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,26,15,0.5)' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: moderateScale(28),
    borderTopRightRadius: moderateScale(28),
    maxHeight: '90%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: scale(40),
    height: verticalScale(4),
    borderRadius: scale(2),
    backgroundColor: colors.outlineVariant,
    marginTop: verticalScale(8),
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: verticalScale(16),
  },
  detailEyebrow: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: scale(2),
  },
  detailId: {
    fontSize: moderateScale(24),
    fontWeight: '800',
    color: colors.primary,
    marginTop: verticalScale(4),
  },
  metaCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: moderateScale(14),
    padding: scale(14),
    gap: verticalScale(10),
  },
  metaCardRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  metaCardText: {
    fontSize: moderateScale(13),
    color: colors.onPrimaryContainer,
    fontWeight: '600',
    flex: 1,
  },
  sectionLabel: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: scale(2),
    marginTop: verticalScale(20),
    marginBottom: verticalScale(10),
  },
  itemsList: { gap: verticalScale(8) },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(12),
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(12),
  },
  qtyBubble: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBubbleText: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    color: colors.onSecondaryContainer,
  },
  itemTitle: { fontSize: moderateScale(14), fontWeight: '700', color: colors.primary },
  itemSub: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(2),
  },
  itemAmt: { fontSize: moderateScale(14), fontWeight: '800', color: colors.secondary },
  noteBox: {
    backgroundColor: colors.surfaceContainerLow,
    padding: scale(12),
    borderRadius: moderateScale(12),
  },
  noteText: {
    fontSize: moderateScale(13),
    color: colors.onSurface,
    lineHeight: moderateScale(20),
  },
  totalRow: {
    marginTop: verticalScale(22),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: verticalScale(14),
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  totalLabel: { fontSize: moderateScale(14), fontWeight: '700', color: colors.onSurfaceVariant },
  totalValue: { fontSize: moderateScale(22), fontWeight: '800', color: colors.primary },
});
