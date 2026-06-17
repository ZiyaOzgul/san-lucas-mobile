import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchProducts() {
    try {
      const [{ data: prods, error: prodError }, { data: cats, error: catError }] = await Promise.all([
        supabase.from('products').select('*, categories(id, name, color), product_variants(id, name, price)').eq('is_active', true).order('name'),
        supabase.from('categories').select('*').order('name'),
      ]);
      if (prodError) throw prodError;
      if (catError) throw catError;
      setProducts(prods || []);
      setCategories(cats || []);
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
      fetchProducts();
    }, 300);
  }

  useEffect(() => {
    fetchProducts();

    const channelName = `products-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants' }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  async function addProduct(product) {
    const { error } = await supabase.from('products').insert({ ...product, is_active: true });
    if (error) throw error;
    await fetchProducts();
  }

  async function updateProduct(id, updates) {
    const { error } = await supabase.from('products').update(updates).eq('id', id);
    if (error) throw error;
    await fetchProducts();
  }

  async function deleteProduct(id) {
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) throw error;
    await fetchProducts();
  }

  async function updateStock(id, delta) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const newStock = Math.max(0, product.stock + delta);
    await updateProduct(id, { stock: newStock });
  }

  async function fetchProductIngredients(productId) {
    const { data, error } = await supabase
      .from('product_ingredients')
      .select('*, ingredients(id, name, unit)')
      .eq('product_id', productId);
    if (error) throw error;
    return data || [];
  }

  async function saveVariants(productId, variants) {
    const { error: delError } = await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', productId);
    if (delError) throw delError;
    if (variants.length > 0) {
      const { error: insError } = await supabase
        .from('product_variants')
        .insert(variants.map(v => ({ name: v.name, price: parseFloat(v.price) || 0, product_id: productId })));
      if (insError) throw insError;
    }
    await fetchProducts();
  }

  async function saveProductIngredients(productId, rows) {
    const { error: delError } = await supabase
      .from('product_ingredients')
      .delete()
      .eq('product_id', productId);
    if (delError) throw delError;
    if (rows.length > 0) {
      const { error: insError } = await supabase
        .from('product_ingredients')
        .insert(rows.map(r => ({
          ingredient_id: r.ingredient_id,
          amount_used: parseFloat(r.amount_used) || 0,
          product_id: productId,
        })));
      if (insError) throw insError;
    }
  }

  return {
    products,
    categories,
    loading,
    error,
    refetch: fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    updateStock,
    fetchProductIngredients,
    saveVariants,
    saveProductIngredients,
  };
}
