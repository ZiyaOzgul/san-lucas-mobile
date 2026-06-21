import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

// Hermes (React Native JS engine) lacks crypto.randomUUID — small RFC4122 v4 fallback.
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useOrders(filter = 'all') {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user, profile } = useAuth();

  async function fetchOrders() {
    try {
      let query = supabase
        .from('orders')
        .select(`*, tables(name), order_items(*, products(name))`)
        .order('created_at', { ascending: false });

      if (filter === 'active') query = query.eq('status', 'active');
      else if (filter === 'completed') query = query.eq('status', 'completed');
      else if (filter === 'cancelled') query = query.eq('status', 'cancelled');

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const refetchTimerRef = useRef(null);
  function scheduleRefetch() {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null;
      fetchOrders();
    }, 300);
  }

  useEffect(() => {
    fetchOrders();

    const channelName = `orders-${filter}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [filter]);

  async function createOrder(tableId, items, paymentMethod) {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        table_id: tableId,
        status: 'active',
        payment_method: paymentMethod,
        total: items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
        local_id: uuidv4(),
        is_synced: true,
        closed_by: user?.id ?? null,
        waiter_name: profile?.full_name ?? null,
      })
      .select()
      .single();
    if (orderError) throw orderError;

    const orderItems = items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      local_id: uuidv4(),
      is_synced: true,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) throw itemsError;
    return order;
  }

  async function closeOrder(orderId, tableId, paymentMethod, total) {
    // Backward-compat single-payment close: emits one payment row, then completes.
    return addPayments(orderId, tableId, [{ amount: total, payment_method: paymentMethod }]);
  }

  async function getOrderPayments(orderId) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // Inserts one or more payment rows for an order. If the cumulative paid amount
  // covers the order total, the order is marked completed and the table is freed.
  // Returns { paid, remaining, completed }.
  async function addPayments(orderId, tableId, rows) {
    if (!rows || rows.length === 0) {
      throw new Error('En az bir ödeme gerekli.');
    }

    const insertRows = rows.map(r => ({
      order_id: orderId,
      amount: Number(r.amount),
      payment_method: r.payment_method,
      payer_label: r.payer_label || null,
      processed_by: user?.id ?? null,
      device: 'mobile',
    }));

    const { error: payError } = await supabase.from('payments').insert(insertRows);
    if (payError) throw payError;

    const [{ data: payments, error: fetchError }, { data: orderRow, error: orderFetchError }] = await Promise.all([
      supabase.from('payments').select('amount, payment_method').eq('order_id', orderId),
      supabase.from('orders').select('total').eq('id', orderId).single(),
    ]);
    if (fetchError) throw fetchError;
    if (orderFetchError) throw orderFetchError;

    const paid = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
    const total = Number(orderRow?.total || 0);
    const remaining = Math.max(total - paid, 0);
    const completed = paid + 0.001 >= total; // tolerate 1-kuruş drift

    if (completed) {
      // Pick the dominant payment method (largest sum) for the order's display field.
      const byMethod = {};
      (payments || []).forEach(p => {
        byMethod[p.payment_method] = (byMethod[p.payment_method] || 0) + Number(p.amount);
      });
      const dominantMethod = Object.entries(byMethod).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          payment_method: dominantMethod,
          closed_at: new Date().toISOString(),
          closed_by: user?.id ?? null,
          waiter_name: profile?.full_name ?? null,
        })
        .eq('id', orderId);
      if (orderUpdateError) throw orderUpdateError;

      if (tableId) {
        const { error: tableError } = await supabase
          .from('tables')
          .update({ status: 'empty' })
          .eq('id', tableId);
        if (tableError) throw tableError;
      }
    }

    return { paid, remaining, completed };
  }

  async function cancelOrder(orderId, tableId) {
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'cancelled', closed_at: new Date().toISOString() })
      .eq('id', orderId);
    if (orderError) throw orderError;

    const { error: tableError } = await supabase
      .from('tables')
      .update({ status: 'empty' })
      .eq('id', tableId);
    if (tableError) throw tableError;
  }

  async function addItemsToOrder(orderId, items) {
    if (!items || items.length === 0) return;
    const rows = items.map(item => ({
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      local_id: uuidv4(),
      is_synced: true,
    }));
    const { error } = await supabase.from('order_items').insert(rows);
    if (error) throw error;
  }

  async function updateOrderItemQty(itemId, quantity) {
    const { error } = await supabase
      .from('order_items')
      .update({ quantity })
      .eq('id', itemId);
    if (error) throw error;
  }

  async function deleteOrderItem(itemId) {
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('id', itemId);
    if (error) throw error;
  }

  async function updateOrderTotal(orderId, total) {
    const { error } = await supabase
      .from('orders')
      .update({ total })
      .eq('id', orderId);
    if (error) throw error;
  }

  // Moves a whole active order from one table to another empty table.
  async function transferOrder(orderId, fromTableId, toTableId) {
    const { error: orderError } = await supabase
      .from('orders')
      .update({ table_id: toTableId })
      .eq('id', orderId);
    if (orderError) throw orderError;

    const { error: toError } = await supabase
      .from('tables')
      .update({ status: 'occupied' })
      .eq('id', toTableId);
    if (toError) throw toError;

    const { error: fromError } = await supabase
      .from('tables')
      .update({ status: 'empty' })
      .eq('id', fromTableId);
    if (fromError) throw fromError;
  }

  // Moves selected order_items from source order into target (existing active) order.
  // Recalculates totals on both. If source becomes empty, it's cancelled and the table freed.
  async function transferItemsToOrder(itemIds, sourceOrderId, sourceTableId, targetOrderId) {
    if (!itemIds || itemIds.length === 0) return { sourceEmptied: false };

    const { error: moveError } = await supabase
      .from('order_items')
      .update({ order_id: targetOrderId })
      .in('id', itemIds);
    if (moveError) throw moveError;

    const [sourceItemsRes, targetItemsRes] = await Promise.all([
      supabase.from('order_items').select('quantity, unit_price').eq('order_id', sourceOrderId),
      supabase.from('order_items').select('quantity, unit_price').eq('order_id', targetOrderId),
    ]);
    if (sourceItemsRes.error) throw sourceItemsRes.error;
    if (targetItemsRes.error) throw targetItemsRes.error;

    const sumOf = rows => (rows || []).reduce((s, r) => s + Number(r.unit_price) * Number(r.quantity), 0);
    const sourceTotal = sumOf(sourceItemsRes.data);
    const targetTotal = sumOf(targetItemsRes.data);

    const { error: targetUpdateError } = await supabase
      .from('orders')
      .update({ total: targetTotal })
      .eq('id', targetOrderId);
    if (targetUpdateError) throw targetUpdateError;

    if ((sourceItemsRes.data || []).length === 0) {
      await cancelOrder(sourceOrderId, sourceTableId);
      return { sourceEmptied: true };
    }

    const { error: sourceUpdateError } = await supabase
      .from('orders')
      .update({ total: sourceTotal })
      .eq('id', sourceOrderId);
    if (sourceUpdateError) throw sourceUpdateError;

    return { sourceEmptied: false };
  }

  return {
    orders, loading, error, refetch: fetchOrders,
    createOrder, closeOrder, cancelOrder,
    addItemsToOrder, updateOrderItemQty, deleteOrderItem, updateOrderTotal,
    getOrderPayments, addPayments,
    transferOrder, transferItemsToOrder,
  };
}
