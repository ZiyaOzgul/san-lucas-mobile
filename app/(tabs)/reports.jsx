import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
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

function fmt(date) {
  return new Date(date).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function stockStatus(ing) {
  if (ing.stock_amount <= 0) return { label: 'Tükendi', color: colors.danger, bg: colors.dangerLight };
  if (ing.min_stock_alert > 0 && ing.stock_amount < ing.min_stock_alert) return { label: 'Az', color: colors.warning, bg: colors.warningLight };
  return { label: 'Yeterli', color: colors.success, bg: colors.successLight };
}

export default function ReportsScreen() {
  const { isAdmin } = useAuth();
  const [dateFilter, setDateFilter] = useState('today');
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchReports();
  }, [dateFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [dateFilter])
  );

  async function fetchReports() {
    setLoading(true);
    try {
      const range = getDateRange(dateFilter);

      let query = supabase
        .from('orders')
        .select(`id, total, payment_method, closed_at, waiter_name,
          order_items(quantity, unit_price, products(name, price, categories(name, color))),
          tables(name)`)
        .eq('status', 'completed');

      if (range) {
        query = query.gte('closed_at', range.start).lte('closed_at', range.end);
      }

      const [{ data: orders }, { data: ings }] = await Promise.all([
        query,
        supabase.from('ingredients').select('id, name, unit, stock_amount, min_stock_alert').order('name'),
      ]);

      setIngredientStocks(ings || []);

      if (!orders || orders.length === 0) {
        setStats({ revenue: 0, orderCount: 0, avgBasket: 0, topProduct: '—', cashRevenue: 0, cardRevenue: 0 });
        setTopProducts([]);
        setTableRevenues([]);
        setProductSalesDetail([]);
        setCategoryRevenue([]);
        setOrderHistory([]);
        setStaffPerformance([]);
        return;
      }

      // KPIs
      const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
      const cashRevenue = orders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + Number(o.total), 0);
      const cardRevenue = orders.filter(o => o.payment_method === 'card').reduce((s, o) => s + Number(o.total), 0);
      const avgBasket = revenue / orders.length;

      // Product aggregation
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

      // Compute daily avg for product sales detail
      const daySet = new Set();
      orders.forEach(o => {
        if (o.closed_at) daySet.add(new Date(o.closed_at).toDateString());
      });
      const dayCount = Math.max(daySet.size, 1);
      setProductSalesDetail(sortedProducts.map(p => ({ ...p, dailyAvg: p.revenue / dayCount })));

      // Category aggregation
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

      // Table revenues
      const tableMap = {};
      orders.forEach(o => {
        const name = o.tables?.name || 'Masa ?';
        if (!tableMap[name]) tableMap[name] = 0;
        tableMap[name] += Number(o.total);
      });
      setTableRevenues(Object.entries(tableMap).sort((a, b) => b[1] - a[1]).slice(0, 5));

      // Staff performance
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

      // Order history (most recent 50)
      const sorted = [...orders].sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at)).slice(0, 50);
      setOrderHistory(sorted);

      setStats({ revenue, orderCount: orders.length, avgBasket, topProduct: sortedProducts[0]?.name || '—', cashRevenue, cardRevenue });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const cashPercent = stats.revenue > 0 ? Math.round((stats.cashRevenue / stats.revenue) * 100) : 0;
  const cardPercent = 100 - cashPercent;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Date filter tabs */}
      <View style={styles.filterBar}>
        {DATE_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, dateFilter === f.key && styles.filterTabActive]}
            onPress={() => setDateFilter(f.key)}
          >
            <Text style={[styles.filterText, dateFilter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: verticalScale(48) }} />
      ) : (
        <>
          {/* KPI Cards */}
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Toplam Ciro</Text>
              <Text style={styles.kpiValue}>₺{stats.revenue.toFixed(2)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Sipariş Sayısı</Text>
              <Text style={styles.kpiValue}>{stats.orderCount}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Ort. Sepet</Text>
              <Text style={styles.kpiValue}>₺{stats.avgBasket.toFixed(2)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>En Çok Satan</Text>
              <Text style={[styles.kpiValue, styles.kpiSmall]} numberOfLines={2}>{stats.topProduct}</Text>
            </View>
          </View>

          {/* Payment Distribution */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ödeme Dağılımı</Text>
            <View style={styles.paymentBars}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>💵 Nakit</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${cashPercent}%`, backgroundColor: colors.success }]} />
                </View>
                <Text style={styles.paymentValue}>{cashPercent}%</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>💳 Kart</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${cardPercent}%`, backgroundColor: colors.accent }]} />
                </View>
                <Text style={styles.paymentValue}>{cardPercent}%</Text>
              </View>
            </View>
          </View>

          {/* Top Products */}
          {topProducts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>En Çok Satan Ürünler</Text>
              {topProducts.map((p, i) => (
                <View key={i} style={styles.rankRow}>
                  <Text style={styles.rankNum}>#{i + 1}</Text>
                  <Text style={styles.rankName}>{p.name}</Text>
                  <Text style={styles.rankQty}>{p.qty} adet</Text>
                  <Text style={styles.rankRevenue}>₺{p.revenue.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Table Revenues */}
          {tableRevenues.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Masa Bazlı Ciro</Text>
              {tableRevenues.map(([name, rev], i) => (
                <View key={i} style={styles.rankRow}>
                  <Text style={styles.rankName}>{name}</Text>
                  <Text style={styles.rankRevenue}>₺{rev.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Product Sales Detail */}
          {productSalesDetail.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ürün Satış Detayı</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Ürün</Text>
                <Text style={styles.tableHeaderCell}>Adet</Text>
                <Text style={styles.tableHeaderCell}>Ciro</Text>
                <Text style={styles.tableHeaderCell}>Gün Ort.</Text>
              </View>
              {productSalesDetail.map((p, i) => (
                <View key={i} style={styles.tableRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.tableCell} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.tableCellSub}>{p.category}</Text>
                  </View>
                  <Text style={styles.tableCell}>{p.qty}</Text>
                  <Text style={styles.tableCell}>₺{p.revenue.toFixed(0)}</Text>
                  <Text style={styles.tableCell}>₺{p.dailyAvg.toFixed(0)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Category Revenue */}
          {categoryRevenue.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Kategori Bazlı Ciro</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Kategori</Text>
                <Text style={styles.tableHeaderCell}>Adet</Text>
                <Text style={styles.tableHeaderCell}>Ciro</Text>
                <Text style={styles.tableHeaderCell}>%</Text>
              </View>
              {categoryRevenue.map((c, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.tableCell}>{c.qty}</Text>
                  <Text style={styles.tableCell}>₺{c.revenue.toFixed(0)}</Text>
                  <Text style={styles.tableCell}>{c.percent}%</Text>
                </View>
              ))}
            </View>
          )}

          {/* Ingredient Stock Status */}
          {ingredientStocks.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Malzeme Stok Durumu</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Malzeme</Text>
                <Text style={styles.tableHeaderCell}>Stok</Text>
                <Text style={styles.tableHeaderCell}>Min</Text>
                <Text style={styles.tableHeaderCell}>Durum</Text>
              </View>
              {ingredientStocks.map((ing, i) => {
                const status = stockStatus(ing);
                return (
                  <View key={i} style={styles.tableRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.tableCell} numberOfLines={1}>{ing.name}</Text>
                      <Text style={styles.tableCellSub}>{ing.unit}</Text>
                    </View>
                    <Text style={styles.tableCell}>{ing.stock_amount}</Text>
                    <Text style={styles.tableCell}>{ing.min_stock_alert}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Staff Performance */}
          {staffPerformance.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personel Performansı</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Garson</Text>
                <Text style={styles.tableHeaderCell}>Sipariş</Text>
                <Text style={styles.tableHeaderCell}>Ciro</Text>
              </View>
              {staffPerformance.map((s, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.tableCell}>{s.orderCount}</Text>
                  <Text style={styles.tableCell}>₺{s.revenue.toFixed(0)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Order History */}
          {orderHistory.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sipariş Geçmişi</Text>
              {orderHistory.map(order => {
                const expanded = expandedOrderId === order.id;
                return (
                  <View key={order.id}>
                    <TouchableOpacity
                      style={styles.orderRow}
                      onPress={() => setExpandedOrderId(expanded ? null : order.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderTable}>{order.tables?.name || 'Masa ?'}</Text>
                        <Text style={styles.orderTime}>{fmt(order.closed_at)}</Text>
                      </View>
                      <Text style={styles.orderPayment}>
                        {order.payment_method === 'cash' ? '💵' : '💳'}
                      </Text>
                      <Text style={styles.orderTotal}>₺{Number(order.total).toFixed(2)}</Text>
                      <Text style={styles.expandIcon}>{expanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {expanded && (
                      <View style={styles.orderItems}>
                        {(order.order_items || []).map((item, idx) => (
                          <View key={idx} style={styles.orderItemRow}>
                            <Text style={styles.orderItemQty}>{item.quantity}×</Text>
                            <Text style={styles.orderItemName}>{item.products?.name || 'Ürün'}</Text>
                            <Text style={styles.orderItemPrice}>₺{(item.quantity * item.unit_price).toFixed(2)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPage },
  content: { padding: scale(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noAccess: { fontSize: moderateScale(15), color: colors.textMuted },
  filterBar: {
    flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: moderateScale(10),
    padding: scale(4), marginBottom: verticalScale(16), borderWidth: 1, borderColor: colors.border,
  },
  filterTab: { flex: 1, paddingVertical: verticalScale(8), alignItems: 'center', borderRadius: moderateScale(8) },
  filterTabActive: { backgroundColor: colors.accent },
  filterText: { fontSize: moderateScale(12), fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: '#fff' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(10), marginBottom: verticalScale(16) },
  kpiCard: {
    flex: 1, minWidth: '45%', backgroundColor: colors.bgCard, borderRadius: moderateScale(10),
    padding: scale(14), borderWidth: 1, borderColor: colors.border, elevation: 1,
  },
  kpiLabel: { fontSize: moderateScale(12), color: colors.textMuted, marginBottom: verticalScale(4) },
  kpiValue: { fontSize: moderateScale(20), fontWeight: '800', color: colors.textPrimary },
  kpiSmall: { fontSize: moderateScale(14) },
  section: {
    backgroundColor: colors.bgCard, borderRadius: moderateScale(10), padding: scale(14),
    borderWidth: 1, borderColor: colors.border, marginBottom: verticalScale(12), elevation: 1,
  },
  sectionTitle: { fontSize: moderateScale(15), fontWeight: '700', color: colors.textPrimary, marginBottom: verticalScale(12) },
  paymentBars: { gap: verticalScale(10) },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  paymentLabel: { fontSize: moderateScale(13), color: colors.textSecondary, width: scale(60) },
  barTrack: { flex: 1, height: verticalScale(12), backgroundColor: colors.border, borderRadius: moderateScale(6), overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: moderateScale(6) },
  paymentValue: { fontSize: moderateScale(13), fontWeight: '600', color: colors.textSecondary, width: scale(36), textAlign: 'right' },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: verticalScale(8), borderBottomWidth: 1, borderBottomColor: colors.border, gap: scale(8) },
  rankNum: { fontSize: moderateScale(13), fontWeight: '700', color: colors.accent, width: scale(24) },
  rankName: { flex: 1, fontSize: moderateScale(14), color: colors.textPrimary },
  rankQty: { fontSize: moderateScale(13), color: colors.textMuted },
  rankRevenue: { fontSize: moderateScale(14), fontWeight: '700', color: colors.textPrimary },
  // Table styles
  tableHeader: { flexDirection: 'row', paddingBottom: verticalScale(8), borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: verticalScale(4) },
  tableHeaderCell: { flex: 1, fontSize: moderateScale(11), fontWeight: '700', color: colors.textMuted, textAlign: 'right' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: verticalScale(8), borderBottomWidth: 1, borderBottomColor: colors.border },
  tableCell: { flex: 1, fontSize: moderateScale(13), color: colors.textPrimary, textAlign: 'right' },
  tableCellSub: { fontSize: moderateScale(11), color: colors.textMuted, textAlign: 'right' },
  statusBadge: { paddingHorizontal: scale(6), paddingVertical: verticalScale(2), borderRadius: moderateScale(10) },
  statusBadgeText: { fontSize: moderateScale(11), fontWeight: '700' },
  // Order history
  orderRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: verticalScale(10),
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: scale(8),
  },
  orderTable: { fontSize: moderateScale(14), fontWeight: '600', color: colors.textPrimary },
  orderTime: { fontSize: moderateScale(11), color: colors.textMuted },
  orderPayment: { fontSize: moderateScale(16) },
  orderTotal: { fontSize: moderateScale(14), fontWeight: '700', color: colors.textPrimary },
  expandIcon: { fontSize: moderateScale(10), color: colors.textMuted, width: scale(16), textAlign: 'center' },
  orderItems: { backgroundColor: colors.bgPage, padding: scale(10), marginBottom: verticalScale(4) },
  orderItemRow: { flexDirection: 'row', paddingVertical: verticalScale(4) },
  orderItemQty: { fontSize: moderateScale(13), color: colors.textMuted, width: scale(24) },
  orderItemName: { flex: 1, fontSize: moderateScale(13), color: colors.textPrimary },
  orderItemPrice: { fontSize: moderateScale(13), fontWeight: '600', color: colors.textPrimary },
});
