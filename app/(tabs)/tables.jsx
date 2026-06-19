import { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Modal, ActivityIndicator, RefreshControl, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { TableCard } from '../../components/TableCard';
import { OrderPanel } from '../../components/OrderPanel';
import { useTables } from '../../hooks/useTables';
import { useOrders } from '../../hooks/useOrders';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../styles/colors';

export default function TablesScreen() {
  const insets = useSafeAreaInsets();
  const { tables, loading, error, refetch, getActiveOrderForTable, updateTableStatus } = useTables();
  const {
    closeOrder, createOrder, addItemsToOrder, updateOrderItemQty, deleteOrderItem, updateOrderTotal,
    getOrderPayments, addPayments,
  } = useOrders();
  const { user } = useAuth();
  const [selectedTable, setSelectedTable] = useState(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [tableOrders, setTableOrders] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadTableOrders();
    }, [tables])
  );

  async function loadTableOrders() {
    const occupied = tables.filter(t => t.status === 'occupied');
    const orders = {};
    await Promise.all(
      occupied.map(async (t) => {
        try {
          const order = await getActiveOrderForTable(t.id);
          if (order) orders[t.id] = order;
        } catch {}
      })
    );
    setTableOrders(orders);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    await loadTableOrders();
    setRefreshing(false);
  }

  function handleTablePress(table) {
    setSelectedTable(table);
    setPanelVisible(true);
  }

  function handlePanelClose() {
    setPanelVisible(false);
    setSelectedTable(null);
    refetch();
    loadTableOrders();
  }

  const occupiedCount = tables.filter(t => t.status === 'occupied').length;
  const totalRevenue = Object.values(tableOrders).reduce((sum, o) => sum + (o?.total || 0), 0);

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tables}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + verticalScale(16) }]}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>Hata: {error}</Text>
              </View>
            ) : null}

            {/* Editorial header */}
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Masa Seçimi</Text>
                <View style={styles.activeChip}>
                  <Text style={styles.activeChipText}>{occupiedCount} Aktif Masa</Text>
                </View>
              </View>
              <Text style={styles.headerSubtitle}>
                Sipariş girişi yapmak veya hesap detaylarını görmek için bir masa seçin.
              </Text>
            </View>

            {/* Stats — Toplam Ciro / Aktif Masa / Toplam */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>TOPLAM CİRO</Text>
                <Text style={styles.statValue}>₺{totalRevenue.toFixed(2)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>AKTİF MASA</Text>
                <Text style={styles.statValue}>{occupiedCount}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>TOPLAM</Text>
                <Text style={styles.statValue}>{tables.length}</Text>
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <TableCard
              table={item}
              order={tableOrders[item.id]}
              onPress={() => handleTablePress(item)}
              isSelected={selectedTable?.id === item.id}
            />
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Henüz masa eklenmemiş</Text>
        }
        ListFooterComponent={
          tables.length > 0 ? (
            <View style={styles.infoBanner}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="information-circle" size={moderateScale(20)} color={colors.onPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>BİLGİLENDİRME</Text>
                <Text style={styles.infoText}>
                  Masa seçerek sipariş alma ekranına geçiş yapabilirsiniz.
                </Text>
              </View>
            </View>
          ) : null
        }
      />

      <Modal
        visible={panelVisible}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={handlePanelClose}
      >
        {selectedTable && (
          <OrderPanel
            table={selectedTable}
            onClose={handlePanelClose}
            getActiveOrder={getActiveOrderForTable}
            closeOrder={closeOrder}
            createOrder={createOrder}
            updateTableStatus={updateTableStatus}
            addItemsToOrder={addItemsToOrder}
            updateOrderItemQty={updateOrderItemQty}
            deleteOrderItem={deleteOrderItem}
            updateOrderTotal={updateOrderTotal}
            getOrderPayments={getOrderPayments}
            addPayments={addPayments}
          />
        )}
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  scroll: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(120),
    gap: scale(14),
  },
  row: {
    gap: scale(14),
    marginBottom: verticalScale(14),
  },
  cardWrapper: {
    flex: 1,
  },

  // Header
  header: {
    marginBottom: verticalScale(20),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: verticalScale(8),
  },
  headerTitle: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
    flex: 1,
  },
  activeChip: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(999),
  },
  activeChipText: {
    color: colors.secondary,
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: moderateScale(13),
    color: colors.onSurfaceVariant,
    lineHeight: moderateScale(20),
    maxWidth: '85%',
  },

  // Stats — Toplam Ciro / Aktif Masa / Toplam (kept as required)
  statsRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginBottom: verticalScale(20),
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(10),
    alignItems: 'center',
  },
  statLabel: {
    fontSize: moderateScale(9),
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.onSurfaceVariant,
    marginBottom: verticalScale(6),
  },
  statValue: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },

  // Info banner
  infoBanner: {
    marginTop: verticalScale(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
    padding: scale(16),
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: moderateScale(14),
  },
  infoIconWrap: {
    padding: scale(10),
    backgroundColor: colors.primaryContainer,
    borderRadius: moderateScale(10),
  },
  infoLabel: {
    fontSize: moderateScale(9),
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.onSurfaceVariant,
    marginBottom: verticalScale(3),
  },
  infoText: {
    fontSize: moderateScale(13),
    color: colors.onSurface,
    lineHeight: moderateScale(18),
  },

  empty: {
    textAlign: 'center',
    color: colors.outline,
    fontSize: moderateScale(15),
    marginTop: verticalScale(48),
  },
  errorBanner: {
    backgroundColor: colors.errorContainer,
    padding: scale(12),
    borderRadius: moderateScale(10),
    marginBottom: verticalScale(12),
  },
  errorText: {
    color: colors.onErrorContainer,
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
});
