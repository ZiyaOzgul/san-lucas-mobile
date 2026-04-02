import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Modal, ActivityIndicator, RefreshControl } from 'react-native';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useFocusEffect } from 'expo-router';
import { TableCard } from '../../components/TableCard';
import { OrderPanel } from '../../components/OrderPanel';
import { useTables } from '../../hooks/useTables';
import { useOrders } from '../../hooks/useOrders';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../styles/colors';

export default function TablesScreen() {
  const { tables, loading, refetch, getActiveOrderForTable } = useTables();
  const { closeOrder } = useOrders();
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
    if (table.status === 'occupied') {
      setSelectedTable(table);
      setPanelVisible(true);
    }
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
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Toplam Ciro</Text>
          <Text style={styles.chipValue}>₺{totalRevenue.toFixed(2)}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Aktif Masa</Text>
          <Text style={styles.chipValue}>{occupiedCount}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Toplam</Text>
          <Text style={styles.chipValue}>{tables.length}</Text>
        </View>
      </View>

      <FlatList
        data={tables}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Henüz masa eklenmemiş</Text>
        }
      />

      <Modal
        visible={panelVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handlePanelClose}
      >
        {selectedTable && (
          <OrderPanel
            table={selectedTable}
            onClose={handlePanelClose}
            getActiveOrder={getActiveOrderForTable}
            closeOrder={closeOrder}
          />
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
    backgroundColor: colors.bgPage,
  },
  summary: {
    flexDirection: 'row',
    padding: scale(12),
    gap: scale(8),
  },
  chip: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: moderateScale(8),
    padding: scale(10),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipLabel: {
    fontSize: moderateScale(11),
    color: colors.textMuted,
    marginBottom: verticalScale(2),
  },
  chipValue: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  grid: {
    padding: scale(12),
    gap: scale(10),
  },
  row: {
    gap: scale(10),
    marginBottom: verticalScale(10),
  },
  cardWrapper: {
    flex: 1,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: moderateScale(15),
    marginTop: verticalScale(48),
  },
});
