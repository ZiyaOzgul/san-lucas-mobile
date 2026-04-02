import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { colors } from '../../styles/colors';

const DATE_FILTERS = [
  { key: 'today', label: 'Bugün' },
  { key: 'week', label: 'Bu Hafta' },
  { key: 'month', label: 'Bu Ay' },
];

function getDateRange(key) {
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

export default function ReportsScreen() {
  const { isAdmin } = useAuth();
  const [dateFilter, setDateFilter] = useState('today');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ revenue: 0, orderCount: 0, avgBasket: 0, topProduct: '—', cashRevenue: 0, cardRevenue: 0 });
  const [topProducts, setTopProducts] = useState([]);
  const [tableRevenues, setTableRevenues] = useState([]);

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

  async function fetchReports() {
    setLoading(true);
    try {
      const { start, end } = getDateRange(dateFilter);

      const { data: orders } = await supabase
        .from('orders')
        .select(`*, order_items(quantity, unit_price, products(name)), tables(name)`)
        .eq('status', 'completed')
        .gte('closed_at', start)
        .lte('closed_at', end);

      if (!orders || orders.length === 0) {
        setStats({ revenue: 0, orderCount: 0, avgBasket: 0, topProduct: '—', cashRevenue: 0, cardRevenue: 0 });
        setTopProducts([]);
        setTableRevenues([]);
        return;
      }

      const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
      const cashRevenue = orders.filter(o => o.payment_method === 'cash').reduce((sum, o) => sum + Number(o.total), 0);
      const cardRevenue = orders.filter(o => o.payment_method === 'card').reduce((sum, o) => sum + Number(o.total), 0);
      const avgBasket = revenue / orders.length;

      // top products
      const productMap = {};
      orders.forEach(o => {
        (o.order_items || []).forEach(item => {
          const name = item.products?.name || 'Bilinmeyen';
          if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
          productMap[name].qty += item.quantity;
          productMap[name].revenue += item.quantity * item.unit_price;
        });
      });
      const sortedProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 5);
      setTopProducts(sortedProducts);

      // table revenues
      const tableMap = {};
      orders.forEach(o => {
        const name = o.tables?.name || 'Masa ?';
        if (!tableMap[name]) tableMap[name] = 0;
        tableMap[name] += Number(o.total);
      });
      const sortedTables = Object.entries(tableMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
      setTableRevenues(sortedTables);

      setStats({
        revenue,
        orderCount: orders.length,
        avgBasket,
        topProduct: sortedProducts[0]?.name || '—',
        cashRevenue,
        cardRevenue,
      });
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
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: moderateScale(10),
    padding: scale(4),
    marginBottom: verticalScale(16),
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTab: {
    flex: 1, paddingVertical: verticalScale(8), alignItems: 'center', borderRadius: moderateScale(8),
  },
  filterTabActive: { backgroundColor: colors.accent },
  filterText: { fontSize: moderateScale(13), fontWeight: '600', color: colors.textMuted },
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
});
