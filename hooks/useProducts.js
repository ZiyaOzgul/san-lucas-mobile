import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchProducts() {
    try {
      const [{ data: prods, error: prodError }, { data: cats, error: catError }] = await Promise.all([
        supabase.from('products').select('*, categories(id, name, color)').eq('is_active', true).order('name'),
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

  useEffect(() => {
    fetchProducts();
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

  return { products, categories, loading, error, refetch: fetchProducts, addProduct, updateProduct, deleteProduct, updateStock };
}
