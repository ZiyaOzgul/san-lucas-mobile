import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useTables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchTables() {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('name');
      if (error) throw error;
      setTables(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTables();

    const channel = supabase
      .channel('tables-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchTables)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchTables)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function getActiveOrderForTable(tableId) {
    const { data, error } = await supabase
      .from('orders')
      .select(`*, order_items(*, products(name, price))`)
      .eq('table_id', tableId)
      .eq('status', 'active')
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async function updateTableStatus(tableId, status) {
    const { error } = await supabase
      .from('tables')
      .update({ status })
      .eq('id', tableId);
    if (error) throw error;
  }

  return { tables, loading, error, refetch: fetchTables, getActiveOrderForTable, updateTableStatus };
}
