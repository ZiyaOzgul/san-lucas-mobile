import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { colors } from '../../styles/colors';

const DATE_FILTERS = [
  { key: 'today', label: 'Bugün' },
  { key: 'week', label: 'Bu Hafta' },
  { key: 'month', label: 'Bu Ay' },
  { key: 'all', label: 'Toplam' },
];

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

function getDateRange(key) {
  if (key === 'all') return null;
  const now = new Date();
  const start = new Date();
  if (key === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (key === 'week') {
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
  } else if (key === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return { start: start.toISOString(), end: now.toISOString() };
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function stockTone(ing) {
  if (ing.stock_amount <= 0) return { label: 'TÜKENDİ', bg: colors.errorContainer, fg: colors.onErrorContainer, dot: colors.error };
  if (ing.min_stock_alert > 0 && ing.stock_amount < ing.min_stock_alert)
    return { label: 'AZ', bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer, dot: colors.tertiary };
  return { label: 'YETERLİ', bg: colors.secondaryContainer, fg: colors.onSecondaryContainer, dot: colors.secondary };
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const [dateFilter, setDateFilter] = useState('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState({ revenue: 0, orderCount: 0, avgBasket: 0, topProduct: '—', cashRevenue: 0, cardRevenue: 0 });
  const [topProducts, setTopProducts] = useState([]);
  const [tableRevenues, setTableRevenues] = useState([]);
  const [productSalesDetail, setProductSalesDetail] = useState([]);
  const [categoryRevenue, setCategoryRevenue] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [staffPerformance, setStaffPerformance] = useState([]);
  const [ingredientStocks, setIngredientStocks] = useState([]);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.noAccess}>Bu sayfaya erişim yetkiniz yok.</Text>
      </View>
    );
  }

  useEffect(() => { fetchReports(); }, [dateFilter]);
  useFocusEffect(useCallback(() => { fetchReports(); }, [dateFilter]));

  async function fetchReports() {
    if (!refreshing) setLoading(true);
    try {
      const range = getDateRange(dateFilter);
      let query = supabase
        .from('orders')
        .select(`id, total, payment_method, closed_at, waiter_name,
          order_items(quantity, unit_price, products(name, price, categories(name, color))),
          tables(name)`)
        .eq('status', 'completed');
      if (range) query = query.gte('closed_at', range.start).lte('closed_at', range.end);

      const [{ data: orders }, { data: ings }] = await Promise.all([
        query,
        supabase.from('ingredients').select('id, name, unit, stock_amount, min_stock_alert').order('name'),
      ]);

      setIngredientStocks(ings || []);

      if (!orders || orders.length === 0) {
        setStats({ revenue: 0, orderCount: 0, avgBasket: 0, topProduct: '—', cashRevenue: 0, cardRevenue: 0 });
        setTopProducts([]); setTableRevenues([]); setProductSalesDetail([]);
        setCategoryRevenue([]); setOrderHistory([]); setStaffPerformance([]);
        return;
      }

      const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
      const cashRevenue = orders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + Number(o.total), 0);
      const cardRevenue = orders.filter(o => o.payment_method === 'card').reduce((s, o) => s + Number(o.total), 0);
      const avgBasket = revenue / orders.length;

      const productMap = {};
      orders.forEach(o => {
        (o.order_items || []).forEach(item => {
          const name = item.products?.name || 'Bilinmeyen';
          const category = item.products?.categories?.name || '—';
          if (!productMap[name]) productMap[name] = { name, category, qty: 0, revenue: 0 };
          productMap[name].qty += item.quantity;
          productMap[name].revenue += item.quantity * item.unit_price;
        });
      });
      const sortedProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty);
      setTopProducts(sortedProducts.slice(0, 5));

      const daySet = new Set();
      orders.forEach(o => { if (o.closed_at) daySet.add(new Date(o.closed_at).toDateString()); });
      const dayCount = Math.max(daySet.size, 1);
      setProductSalesDetail(sortedProducts.map(p => ({ ...p, dailyAvg: p.revenue / dayCount })));

      const catMap = {};
      orders.forEach(o => {
        (o.order_items || []).forEach(item => {
          const cat = item.products?.categories?.name || 'Diğer';
          if (!catMap[cat]) catMap[cat] = { name: cat, qty: 0, revenue: 0 };
          catMap[cat].qty += item.quantity;
          catMap[cat].revenue += item.quantity * item.unit_price;
        });
      });
      const catArr = Object.values(catMap).sort((a, b) => b.revenue - a.revenue);
      setCategoryRevenue(catArr.map(c => ({ ...c, percent: revenue > 0 ? Math.round((c.revenue / revenue) * 100) : 0 })));

      const tableMap = {};
      orders.forEach(o => {
        const name = o.tables?.name || 'Masa ?';
        if (!tableMap[name]) tableMap[name] = 0;
        tableMap[name] += Number(o.total);
      });
      setTableRevenues(Object.entries(tableMap).sort((a, b) => b[1] - a[1]).slice(0, 5));

      const hasWaiter = orders.some(o => o.waiter_name);
      if (hasWaiter) {
        const staffMap = {};
        orders.forEach(o => {
          const name = o.waiter_name || 'Bilinmeyen';
          if (!staffMap[name]) staffMap[name] = { name, orderCount: 0, revenue: 0 };
          staffMap[name].orderCount++;
          staffMap[name].revenue += Number(o.total);
        });
        setStaffPerformance(Object.values(staffMap).sort((a, b) => b.revenue - a.revenue));
      } else {
        setStaffPerformance([]);
      }

      const sorted = [...orders].sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at)).slice(0, 50);
      setOrderHistory(sorted);

      setStats({ revenue, orderCount: orders.length, avgBasket, topProduct: sortedProducts[0]?.name || '—', cashRevenue, cardRevenue });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  }

  const cashPercent = stats.revenue > 0 ? Math.round((stats.cashRevenue / stats.revenue) * 100) : 0;
  const cardPercent = stats.revenue > 0 ? 100 - cashPercent : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + verticalScale(16) }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      {/* Editorial header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Raporlar</Text>
          <View style={styles.countChip}>
            <Text style={styles.countChipText}>{stats.orderCount} sipariş</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          Ciro, ödeme dağılımı, ürün ve personel performansını izleyin.
        </Text>
      </View>

      {/* Date filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {DATE_FILTERS.map(f => {
          const active = dateFilter === f.key;
          return (
            <PressScale
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setDateFilter(f.key)}
              scaleTo={0.94}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </PressScale>
          );
        })}
      </ScrollView>

      {loading && !refreshing ? (
        <View style={styles.centerPad}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <>
          {/* Hero ciro card */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>TOPLAM CİRO</Text>
            <Text style={styles.heroValue}>₺{stats.revenue.toFixed(2)}</Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaItem}>
                <Ionicons name="receipt-outline" size={moderateScale(12)} color={colors.onPrimaryContainer} style={{ opacity: 0.7 }} />
                <Text style={styles.heroMetaText}>{stats.orderCount} sipariş</Text>
              </View>
              <View style={styles.heroMetaDot} />
              <View style={styles.heroMetaItem}>
                <Ionicons name="basket-outline" size={moderateScale(12)} color={colors.onPrimaryContainer} style={{ opacity: 0.7 }} />
                <Text style={styles.heroMetaText}>Ort. ₺{stats.avgBasket.toFixed(0)}</Text>
              </View>
            </View>
          </View>

          {/* KPI bento */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>NAKİT</Text>
              <Text style={styles.kpiValue}>₺{stats.cashRevenue.toFixed(0)}</Text>
              <Text style={styles.kpiSub}>%{cashPercent}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>KART</Text>
              <Text style={styles.kpiValue}>₺{stats.cardRevenue.toFixed(0)}</Text>
              <Text style={styles.kpiSub}>%{cardPercent}</Text>
            </View>
          </View>

          <View style={styles.topProductCard}>
            <Text style={styles.kpiLabel}>EN ÇOK SATAN</Text>
            <Text style={styles.topProductName} numberOfLines={1}>{stats.topProduct}</Text>
          </View>

          {/* Payment distribution */}
          {stats.revenue > 0 && (
            <>
              <Text style={styles.sectionLabel}>ÖDEME DAĞILIMI</Text>
              <View style={styles.sectionCard}>
                <View style={styles.payRow}>
                  <View style={styles.payLabelWrap}>
                    <Ionicons name="cash-outline" size={moderateScale(14)} color={colors.secondary} />
                    <Text style={styles.payLabel}>Nakit</Text>
                  </View>
                  <Text style={styles.payValueRow}>%{cashPercent}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${cashPercent}%`, backgroundColor: colors.secondary }]} />
                </View>
                <View style={[styles.payRow, { marginTop: verticalScale(14) }]}>
                  <View style={styles.payLabelWrap}>
                    <Ionicons name="card-outline" size={moderateScale(14)} color={colors.primary} />
                    <Text style={styles.payLabel}>Kart</Text>
                  </View>
                  <Text style={styles.payValueRow}>%{cardPercent}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${cardPercent}%`, backgroundColor: colors.primary }]} />
                </View>
              </View>
            </>
          )}

          {/* Top products ranked */}
          {topProducts.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>EN ÇOK SATAN ÜRÜNLER</Text>
              <View style={styles.sectionCard}>
                {topProducts.map((p, i) => (
                  <View
                    key={i}
                    style={[
                      styles.rankRow,
                      i === 0 && { paddingTop: 0 },
                      i === topProducts.length - 1 && { paddingBottom: 0, borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={[styles.rankBadge, i === 0 && styles.rankBadgeGold]}>
                      <Text style={[styles.rankBadgeText, i === 0 && styles.rankBadgeTextGold]}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rankName} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.rankSub}>{p.qty} adet · {p.category}</Text>
                    </View>
                    <Text style={styles.rankRevenue}>₺{p.revenue.toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Table revenues */}
          {tableRevenues.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>MASA BAZLI CİRO</Text>
              <View style={styles.sectionCard}>
                {tableRevenues.map(([name, rev], i) => (
                  <View
                    key={i}
                    style={[
                      styles.simpleRow,
                      i === 0 && { paddingTop: 0 },
                      i === tableRevenues.length - 1 && { paddingBottom: 0, borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={styles.tableIconWrap}>
                      <Ionicons name="grid" size={moderateScale(14)} color={colors.primary} />
                    </View>
                    <Text style={styles.simpleRowName}>{name}</Text>
                    <Text style={styles.simpleRowValue}>₺{rev.toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Product sales detail */}
          {productSalesDetail.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>ÜRÜN SATIŞ DETAYI</Text>
              <View style={styles.sectionCard}>
                <View style={styles.dataHeader}>
                  <Text style={[styles.dataHeaderCell, { flex: 2.2, textAlign: 'left' }]}>Ürün</Text>
                  <Text style={styles.dataHeaderCell}>Adet</Text>
                  <Text style={styles.dataHeaderCell}>Ciro</Text>
                  <Text style={styles.dataHeaderCell}>G.Ort.</Text>
                </View>
                {productSalesDetail.map((p, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dataRow,
                      i === productSalesDetail.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={{ flex: 2.2 }}>
                      <Text style={styles.dataCell} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.dataCellSub}>{p.category}</Text>
                    </View>
                    <Text style={styles.dataCellNum}>{p.qty}</Text>
                    <Text style={styles.dataCellNum}>₺{p.revenue.toFixed(0)}</Text>
                    <Text style={styles.dataCellNum}>₺{p.dailyAvg.toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Category revenue */}
          {categoryRevenue.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>KATEGORİ BAZLI CİRO</Text>
              <View style={styles.sectionCard}>
                {categoryRevenue.map((c, i) => (
                  <View
                    key={i}
                    style={[
                      styles.catRow,
                      i === categoryRevenue.length - 1 && { paddingBottom: 0, borderBottomWidth: 0 },
                      i === 0 && { paddingTop: 0 },
                    ]}
                  >
                    <View style={styles.catHeadRow}>
                      <Text style={styles.catName}>{c.name}</Text>
                      <Text style={styles.catRevenue}>₺{c.revenue.toFixed(0)}</Text>
                    </View>
                    <View style={styles.catBarTrack}>
                      <View style={[styles.catBarFill, { width: `${c.percent}%` }]} />
                    </View>
                    <View style={styles.catMetaRow}>
                      <Text style={styles.catMetaText}>{c.qty} adet</Text>
                      <Text style={styles.catMetaText}>%{c.percent}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Ingredient stock status */}
          {ingredientStocks.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>MALZEME STOK DURUMU</Text>
              <View style={styles.sectionCard}>
                {ingredientStocks.map((ing, i) => {
                  const tone = stockTone(ing);
                  return (
                    <View
                      key={i}
                      style={[
                        styles.simpleRow,
                        i === 0 && { paddingTop: 0 },
                        i === ingredientStocks.length - 1 && { paddingBottom: 0, borderBottomWidth: 0 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.simpleRowName} numberOfLines={1}>{ing.name}</Text>
                        <Text style={styles.dataCellSub}>{ing.stock_amount} {ing.unit} · min {ing.min_stock_alert}</Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                        <View style={[styles.statusDot, { backgroundColor: tone.dot }]} />
                        <Text style={[styles.statusPillText, { color: tone.fg }]}>{tone.label}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Staff performance */}
          {staffPerformance.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>PERSONEL PERFORMANSI</Text>
              <View style={styles.sectionCard}>
                {staffPerformance.map((s, i) => (
                  <View
                    key={i}
                    style={[
                      styles.simpleRow,
                      i === 0 && { paddingTop: 0 },
                      i === staffPerformance.length - 1 && { paddingBottom: 0, borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={styles.staffAvatar}>
                      <Text style={styles.staffAvatarText}>
                        {(s.name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.simpleRowName} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.dataCellSub}>{s.orderCount} sipariş</Text>
                    </View>
                    <Text style={styles.simpleRowValue}>₺{s.revenue.toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Order history accordion */}
          {orderHistory.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>SİPARİŞ GEÇMİŞİ</Text>
              <View style={styles.sectionCard}>
                {orderHistory.map((order, idx) => {
                  const expanded = expandedOrderId === order.id;
                  return (
                    <View
                      key={order.id}
                      style={[
                        styles.orderBlock,
                        idx === orderHistory.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <PressScale
                        style={styles.orderHead}
                        onPress={() => setExpandedOrderId(expanded ? null : order.id)}
                        scaleTo={0.99}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.orderTable}>{order.tables?.name || 'Masa ?'}</Text>
                          <View style={styles.orderMetaRow}>
                            <Ionicons name="time-outline" size={moderateScale(10)} color={colors.outline} />
                            <Text style={styles.orderTime}>
                              {fmtDate(order.closed_at)} · {fmtTime(order.closed_at)}
                            </Text>
                          </View>
                        </View>
                        <Ionicons
                          name={order.payment_method === 'cash' ? 'cash-outline' : 'card-outline'}
                          size={moderateScale(14)}
                          color={colors.onSurfaceVariant}
                        />
                        <Text style={styles.orderTotal}>₺{Number(order.total).toFixed(0)}</Text>
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={moderateScale(14)}
                          color={colors.outline}
                        />
                      </PressScale>
                      {expanded && (
                        <View style={styles.orderItems}>
                          {(order.order_items || []).map((item, j) => (
                            <View key={j} style={styles.orderItemRow}>
                              <View style={styles.qtyChip}>
                                <Text style={styles.qtyChipText}>{item.quantity}</Text>
                              </View>
                              <Text style={styles.orderItemName} numberOfLines={1}>{item.products?.name || 'Ürün'}</Text>
                              <Text style={styles.orderItemPrice}>
                                ₺{(item.quantity * item.unit_price).toFixed(0)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(120),
    gap: verticalScale(16),
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  centerPad: { paddingVertical: verticalScale(60), alignItems: 'center' },
  noAccess: { fontSize: moderateScale(15), color: colors.outline },

  // Header
  header: {},
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
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(999),
  },
  countChipText: {
    color: colors.secondary,
    fontSize: moderateScale(11),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: moderateScale(13),
    color: colors.onSurfaceVariant,
    lineHeight: moderateScale(20),
    maxWidth: '85%',
  },

  // Date filter
  filterScroll: { flexGrow: 0 },
  filterRow: { gap: scale(8), paddingRight: scale(20) },
  filterChip: {
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(8),
    backgroundColor: colors.surfaceContainer,
    borderRadius: moderateScale(999),
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: { fontSize: moderateScale(12), fontWeight: '700', color: colors.onSurfaceVariant },
  filterChipTextActive: { color: colors.onPrimary },

  // Hero card
  heroCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: moderateScale(20),
    padding: scale(22),
  },
  heroLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.onPrimaryContainer,
    opacity: 0.7,
    marginBottom: verticalScale(6),
  },
  heroValue: {
    fontSize: moderateScale(36),
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: -1,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginTop: verticalScale(12),
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
  },
  heroMetaText: {
    fontSize: moderateScale(12),
    color: colors.onPrimaryContainer,
    fontWeight: '600',
  },
  heroMetaDot: {
    width: 3, height: 3, borderRadius: 1.5,
    backgroundColor: colors.outlineVariant,
    opacity: 0.4,
  },

  // KPI bento
  kpiRow: { flexDirection: 'row', gap: scale(12) },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(16),
    padding: scale(16),
  },
  kpiLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.onSurfaceVariant,
    opacity: 0.7,
    marginBottom: verticalScale(8),
  },
  kpiValue: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  kpiSub: {
    fontSize: moderateScale(11),
    color: colors.onSurfaceVariant,
    fontWeight: '600',
    marginTop: verticalScale(2),
  },
  topProductCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(16),
    padding: scale(16),
  },
  topProductName: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: -0.3,
  },

  // Section label
  sectionLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.onSurfaceVariant,
    opacity: 0.6,
    marginBottom: verticalScale(-8),
    marginTop: verticalScale(4),
  },
  sectionCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(16),
    padding: scale(16),
  },

  // Payment bars
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(6),
  },
  payLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: scale(6) },
  payLabel: { fontSize: moderateScale(13), color: colors.onSurface, fontWeight: '700' },
  payValueRow: { fontSize: moderateScale(13), color: colors.primary, fontWeight: '800' },
  barTrack: {
    height: verticalScale(8),
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: moderateScale(999),
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: moderateScale(999) },

  // Rank rows (top products)
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingVertical: verticalScale(10),
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  rankBadge: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeGold: { backgroundColor: colors.primary },
  rankBadgeText: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    color: colors.onSurfaceVariant,
  },
  rankBadgeTextGold: { color: colors.onPrimary },
  rankName: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  rankSub: {
    fontSize: moderateScale(11),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(2),
  },
  rankRevenue: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: colors.secondary,
  },

  // Simple rows (table revenues, ingredients, staff)
  simpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingVertical: verticalScale(10),
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  simpleRowName: {
    flex: 1,
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: colors.primary,
  },
  simpleRowValue: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: colors.secondary,
  },
  tableIconWrap: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatar: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarText: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: colors.secondary,
  },

  // Status pill (ingredient stocks)
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(999),
  },
  statusDot: { width: moderateScale(6), height: moderateScale(6), borderRadius: moderateScale(3) },
  statusPillText: { fontSize: moderateScale(9), fontWeight: '800', letterSpacing: 0.5 },

  // Data table
  dataHeader: {
    flexDirection: 'row',
    paddingBottom: verticalScale(10),
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    marginBottom: verticalScale(4),
  },
  dataHeaderCell: {
    flex: 1,
    fontSize: moderateScale(9),
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.onSurfaceVariant,
    textAlign: 'right',
    opacity: 0.7,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(10),
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  dataCell: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: colors.primary,
  },
  dataCellSub: {
    fontSize: moderateScale(10),
    color: colors.outline,
    marginTop: verticalScale(1),
  },
  dataCellNum: {
    flex: 1,
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'right',
  },

  // Category rows with bars
  catRow: {
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  catHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: verticalScale(6),
  },
  catName: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  catRevenue: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: colors.secondary,
  },
  catBarTrack: {
    height: verticalScale(6),
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: moderateScale(999),
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    backgroundColor: colors.tertiary,
    borderRadius: moderateScale(999),
  },
  catMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: verticalScale(6),
  },
  catMetaText: {
    fontSize: moderateScale(10),
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },

  // Order history accordion
  orderBlock: {
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  orderHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    gap: scale(10),
  },
  orderTable: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    marginTop: verticalScale(2),
  },
  orderTime: { fontSize: moderateScale(10), color: colors.outline },
  orderTotal: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: colors.secondary,
    minWidth: scale(50),
    textAlign: 'right',
  },
  orderItems: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: moderateScale(10),
    padding: scale(10),
    marginBottom: verticalScale(10),
    gap: verticalScale(6),
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  qtyChip: {
    minWidth: moderateScale(24),
    height: moderateScale(22),
    paddingHorizontal: scale(5),
    borderRadius: moderateScale(11),
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyChipText: { fontSize: moderateScale(11), fontWeight: '800', color: colors.primary },
  orderItemName: { flex: 1, fontSize: moderateScale(12), color: colors.onSurface, fontWeight: '600' },
  orderItemPrice: { fontSize: moderateScale(12), fontWeight: '800', color: colors.secondary },
});
