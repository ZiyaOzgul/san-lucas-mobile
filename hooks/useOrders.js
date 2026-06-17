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
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        payment_method: paymentMethod,
        total,
        closed_at: new Date().toISOString(),
        closed_by: user?.id ?? null,
        waiter_name: profile?.full_name ?? null,
      })
      .eq('id', orderId);
    if (orderError) throw orderError;

    const { error: tableError } = await supabase
      .from('tables')
      .update({ status: 'empty' })
      .eq('id', tableId);
    if (tableError) throw tableError;
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

  return { orders, loading, error, refetch: fetchOrders, createOrder, closeOrder, cancelOrder };
}
