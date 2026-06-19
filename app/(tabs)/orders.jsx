import { useState, useRef, useMemo } from 'react';
import { View, Text, TextInput, FlatList, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, RefreshControl, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useOrders } from '../../hooks/useOrders';
import { colors } from '../../styles/colors';

const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Aktif' },
  { key: 'completed', label: 'Tamamlandı' },
  { key: 'cancelled', label: 'İptal' },
];

const STATUS_META = {
  active:    { label: 'Aktif',      bg: '#b6edc2', fg: '#3b6d4b', dot: '#376847' },
  completed: { label: 'Tamamlandı', bg: '#e2e3db', fg: '#43483e', dot: '#737973' },
  cancelled: { label: 'İptal',      bg: '#ffdad6', fg: '#93000a', dot: '#ba1a1a' },
};

function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function PressScale({ style, onPress, children, scaleTo = 0.97 }) {
  const s = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { s.value = withSpring(scaleTo, { damping: 18, stiffness: 280 }); }}
      onPressOut={() => { s.value = withTiming(1, { duration: 160 }); }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

// Aktif önce, ardından iptal, en sonda tamamlandı; her grup içinde en yeni önce.
const STATUS_PRIORITY = { active: 0, cancelled: 1, completed: 2 };

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { orders, loading, refetch } = useOrders(filter);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const lastOrderRef = useRef(null);
  if (selectedOrder) lastOrderRef.current = selectedOrder;
  const orderToShow = selectedOrder || lastOrderRef.current;

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const meta = orderToShow ? STATUS_META[orderToShow.status] : null;

  const visibleOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? orders.filter(o => String(o.id).includes(q) || (o.tables?.name || '').toLowerCase().includes(q))
      : orders;

    return [...filtered].sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 99;
      const pb = STATUS_PRIORITY[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [orders, search]);

  return (
    <View style={styles.container}>
      <FlatList
        data={visibleOrders}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + verticalScale(16) }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            {/* Editorial header */}
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Siparişler</Text>
                <View style={styles.countChip}>
                  <Text style={styles.countChipText}>{visibleOrders.length}</Text>
                </View>
              </View>
              <Text style={styles.headerSubtitle}>
                Tüm aktif, iptal ve tamamlanmış siparişler — aktifler en üstte.
              </Text>
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={moderateScale(18)} color={colors.onSurfaceVariant} style={{ opacity: 0.5 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Sipariş ID veya masa ara..."
                placeholderTextColor={colors.outline}
                value={search}
                onChangeText={setSearch}
                keyboardType="default"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={moderateScale(18)} color={colors.outline} />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              style={styles.filterScroll}
            >
              {FILTERS.map(f => (
                <PressScale
                  key={f.key}
                  style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                  onPress={() => setFilter(f.key)}
                  scaleTo={0.94}
                >
                  <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </PressScale>
              ))}
            </ScrollView>
          </>
        }
        renderItem={({ item }) => {
          const m = STATUS_META[item.status] || STATUS_META.completed;
          const summary = item.order_items?.slice(0, 2).map(i => i.products?.name).filter(Boolean).join(', ');
          const extra = (item.order_items?.length || 0) - 2;
          return (
            <PressScale style={styles.orderCard} onPress={() => setSelectedOrder(item)} scaleTo={0.98}>
              <View style={styles.orderTop}>
                <View style={styles.orderTableWrap}>
                  <Text style={styles.orderTable}>{item.tables?.name || 'Masa ?'}</Text>
                  <Text style={styles.orderId}>#{item.id}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: m.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: m.dot }]} />
                  <Text style={[styles.statusPillText, { color: m.fg }]}>{m.label}</Text>
                </View>
              </View>

              <Text style={styles.orderSummary} numberOfLines={1}>
                {summary || 'Sipariş detayı yok'}
                {extra > 0 ? `  +${extra}` : ''}
              </Text>

              <View style={styles.orderBottom}>
                <Text style={styles.orderTotal}>₺{Number(item.total).toFixed(2)}</Text>
                <View style={styles.orderMeta}>
                  <Ionicons name="time-outline" size={moderateScale(11)} color={colors.outline} />
                  <Text style={styles.orderTime}>{formatDate(item.created_at)} {formatTime(item.created_at)}</Text>
                  {item.payment_method ? (
                    <>
                      <View style={styles.metaDot} />
                      <Ionicons
                        name={item.payment_method === 'cash' ? 'cash-outline' : 'card-outline'}
                        size={moderateScale(11)}
                        color={colors.onSurfaceVariant}
                      />
                      <Text style={styles.orderPayment}>
                        {item.payment_method === 'cash' ? 'Nakit' : 'Kart'}
                      </Text>
                    </>
                  ) : null}
                </View>
              </View>
            </PressScale>
          );
        }}
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="receipt-outline" size={moderateScale(40)} color={colors.outline} style={{ opacity: 0.4 }} />
              <Text style={styles.empty}>Sipariş bulunamadı</Text>
            </View>
          )
        }
      />

      {/* Detail Modal */}
      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setSelectedOrder(null)}
      >
        <SafeAreaView style={styles.detail} edges={['top', 'bottom']}>
          {orderToShow ? (
            <>
              <View style={styles.detailHeader}>
                <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.backBtn}>
                  <Ionicons name="chevron-back" size={moderateScale(24)} color={colors.primary} />
                </TouchableOpacity>
                <View style={styles.detailTitleWrap}>
                  <Text style={styles.detailTitle}>{orderToShow.tables?.name}</Text>
                  <Text style={styles.detailIdSub}>Sipariş #{orderToShow.id}</Text>
                </View>
                {meta && (
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
                    <Text style={[styles.statusPillText, { color: meta.fg }]}>{meta.label}</Text>
                  </View>
                )}
              </View>

              <ScrollView contentContainerStyle={styles.detailScroll}>
                {/* Meta cards */}
                <View style={styles.metaCards}>
                  <View style={styles.metaCard}>
                    <Text style={styles.metaCardLabel}>AÇILIŞ</Text>
                    <Text style={styles.metaCardValue}>{formatTime(orderToShow.created_at)}</Text>
                    <Text style={styles.metaCardSub}>{formatDate(orderToShow.created_at)}</Text>
                  </View>
                  <View style={styles.metaCard}>
                    <Text style={styles.metaCardLabel}>KAPANIŞ</Text>
                    <Text style={styles.metaCardValue}>
                      {orderToShow.closed_at ? formatTime(orderToShow.closed_at) : '—'}
                    </Text>
                    <Text style={styles.metaCardSub}>
                      {orderToShow.closed_at ? formatDate(orderToShow.closed_at) : 'Henüz açık'}
                    </Text>
                  </View>
                </View>

                {/* Items */}
                <Text style={styles.sectionLabel}>SİPARİŞ İÇERİĞİ</Text>
                <View style={styles.itemsCard}>
                  {(orderToShow.order_items || []).map((item, idx) => (
                    <View key={item.id ?? idx} style={[styles.detailItem, idx === 0 && { paddingTop: 0 }]}>
                      <View style={styles.qtyChip}>
                        <Text style={styles.qtyChipText}>{item.quantity}</Text>
                      </View>
                      <Text style={styles.detailName} numberOfLines={2}>{item.products?.name}</Text>
                      <Text style={styles.detailPrice}>
                        ₺{(item.unit_price * item.quantity).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Summary */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Ödeme Yöntemi</Text>
                    <Text style={styles.summaryValue}>
                      {orderToShow.payment_method === 'cash' ? '💵 Nakit' :
                       orderToShow.payment_method === 'card' ? '💳 Kart' : '—'}
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.totalLabel}>TOPLAM</Text>
                    <Text style={styles.totalAmount}>₺{Number(orderToShow.total).toFixed(2)}</Text>
                  </View>
                </View>
              </ScrollView>
            </>
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: {
    paddingVertical: verticalScale(60),
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(120),
    gap: verticalScale(10),
  },

  // Header
  header: {
    marginBottom: verticalScale(16),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: verticalScale(6),
  },
  headerTitle: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  countChip: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(999),
  },
  countChipText: {
    color: colors.secondary,
    fontSize: moderateScale(11),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: moderateScale(13),
    color: colors.onSurfaceVariant,
    lineHeight: moderateScale(20),
    maxWidth: '85%',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(14),
    gap: scale(10),
    marginBottom: verticalScale(12),
  },
  searchInput: {
    flex: 1,
    paddingVertical: verticalScale(12),
    fontSize: moderateScale(13),
    color: colors.onSurface,
  },

  // Filter chips
  filterScroll: {
    marginBottom: verticalScale(16),
    flexGrow: 0,
  },
  filterRow: {
    gap: scale(8),
    paddingRight: scale(20),
  },
  filterChip: {
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(8),
    backgroundColor: colors.surfaceContainer,
    borderRadius: moderateScale(999),
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: colors.onPrimary,
  },

  // Order card
  orderCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
    padding: scale(16),
    gap: verticalScale(8),
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTableWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: scale(8),
  },
  orderTable: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  orderId: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    color: colors.outline,
  },
  orderSummary: {
    fontSize: moderateScale(12),
    color: colors.onSurfaceVariant,
  },
  orderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  orderTime: {
    fontSize: moderateScale(10),
    color: colors.onSurfaceVariant,
  },
  metaDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.outline,
    marginHorizontal: scale(3),
  },
  orderPayment: {
    fontSize: moderateScale(10),
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },

  // Status pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(999),
  },
  statusDot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: moderateScale(3),
  },
  statusPillText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  empty: {
    color: colors.outline,
    fontSize: moderateScale(14),
  },
  emptyWrap: {
    alignItems: 'center',
    gap: verticalScale(8),
    paddingVertical: verticalScale(60),
  },

  // Detail modal
  detail: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    gap: scale(10),
  },
  backBtn: {
    padding: scale(4),
  },
  detailTitleWrap: {
    flex: 1,
  },
  detailTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  detailIdSub: {
    fontSize: moderateScale(11),
    color: colors.outline,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  detailScroll: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(40),
    gap: verticalScale(20),
  },

  // Meta cards
  metaCards: {
    flexDirection: 'row',
    gap: scale(10),
  },
  metaCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
    padding: scale(14),
  },
  metaCardLabel: {
    fontSize: moderateScale(9),
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    letterSpacing: 1.5,
    opacity: 0.6,
    marginBottom: verticalScale(6),
  },
  metaCardValue: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  metaCardSub: {
    fontSize: moderateScale(11),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(2),
  },

  sectionLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.onSurfaceVariant,
    opacity: 0.6,
    marginBottom: verticalScale(-6),
  },

  // Items card
  itemsCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
    padding: scale(14),
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(10),
    gap: scale(10),
  },
  qtyChip: {
    minWidth: moderateScale(28),
    height: moderateScale(28),
    paddingHorizontal: scale(6),
    borderRadius: moderateScale(14),
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyChipText: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    color: colors.primary,
  },
  detailName: {
    flex: 1,
    fontSize: moderateScale(14),
    color: colors.onSurface,
    fontWeight: '600',
  },
  detailPrice: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: colors.secondary,
  },

  // Summary card
  summaryCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: moderateScale(14),
    padding: scale(16),
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: moderateScale(13),
    color: colors.onPrimaryContainer,
  },
  summaryValue: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: colors.surface,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: verticalScale(12),
  },
  totalLabel: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: colors.onPrimaryContainer,
    letterSpacing: 1.5,
  },
  totalAmount: {
    fontSize: moderateScale(24),
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: -0.5,
  },
});
