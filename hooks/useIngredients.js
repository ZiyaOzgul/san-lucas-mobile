import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useIngredients() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchIngredients() {
    try {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .order('name');
      if (error) throw error;
      setIngredients(data || []);
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
      fetchIngredients();
    }, 300);
  }

  useEffect(() => {
    fetchIngredients();

    const channelName = `ingredients-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  async function addIngredient(data) {
    const { error } = await supabase.from('ingredients').insert(data);
    if (error) throw error;
    await fetchIngredients();
  }

  async function updateIngredient(id, data) {
    const { error } = await supabase.from('ingredients').update(data).eq('id', id);
    if (error) throw error;
    await fetchIngredients();
  }

  async function deleteIngredient(id) {
    const { error } = await supabase.from('ingredients').delete().eq('id', id);
    if (error) throw error;
    await fetchIngredients();
  }

  return { ingredients, loading, error, refetch: fetchIngredients, addIngredient, updateIngredient, deleteIngredient };
}
