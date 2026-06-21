import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useAddresses() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAddresses = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('profile_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error) setAddresses(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  async function addAddress({ label, full_address, notes, is_default }) {
    if (!user) throw new Error('Giriş gerekli.');
    if (is_default) {
      await supabase.from('addresses').update({ is_default: false }).eq('profile_id', user.id);
    }
    const { error } = await supabase.from('addresses').insert({
      profile_id: user.id,
      label,
      full_address,
      notes: notes || null,
      is_default: !!is_default,
    });
    if (error) throw error;
    await fetchAddresses();
  }

  async function deleteAddress(id) {
    const { error } = await supabase.from('addresses').delete().eq('id', id);
    if (error) throw error;
    await fetchAddresses();
  }

  async function setDefault(id) {
    if (!user) return;
    await supabase.from('addresses').update({ is_default: false }).eq('profile_id', user.id);
    await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    await fetchAddresses();
  }

  return { addresses, loading, refetch: fetchAddresses, addAddress, deleteAddress, setDefault };
}

export function useCustomerOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const refetchTimer = useRef(null);

  const fetchOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_items(*, products(name, image_url), product_variants(name)), addresses(label, full_address)`)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) setOrders(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchOrders();
    if (!user) return;

    const channel = supabase
      .channel(`customer-orders-${user.id.slice(0, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${user.id}` }, () => {
        if (refetchTimer.current) clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(fetchOrders, 300);
      })
      .subscribe();

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [fetchOrders, user]);

  async function placeOrder({ items, order_type, delivery_address_id, customer_note }) {
    if (!user) throw new Error('Giriş gerekli.');
    if (!items || items.length === 0) throw new Error('Sepet boş.');

    const total = items.reduce((s, it) => s + it.unit_price * it.quantity, 0);
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        status: 'active',
        total,
        order_type,
        customer_id: user.id,
        delivery_address_id: delivery_address_id || null,
        customer_note: customer_note || null,
        local_id: uuidv4(),
        is_synced: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (orderError) throw orderError;

    const rows = items.map((it) => ({
      order_id: order.id,
      product_id: it.product_id,
      variant_id: it.variant_id || null,
      quantity: it.quantity,
      unit_price: it.unit_price,
      local_id: uuidv4(),
      is_synced: true,
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(rows);
    if (itemsError) throw itemsError;

    await fetchOrders();
    return order;
  }

  return { orders, loading, refetch: fetchOrders, placeOrder };
}
