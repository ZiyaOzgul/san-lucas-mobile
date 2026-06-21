import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'san_lucas_customer_cart_v1';

function itemKey(it) {
  return `${it.product_id}::${it.variant_id ?? ''}`;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const writeTimer = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setItems(parsed);
          } catch {}
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, 200);
    return () => writeTimer.current && clearTimeout(writeTimer.current);
  }, [items, hydrated]);

  function addItem(newItem) {
    setItems((prev) => {
      const key = itemKey(newItem);
      const existing = prev.find((it) => itemKey(it) === key);
      if (existing) {
        return prev.map((it) =>
          itemKey(it) === key ? { ...it, quantity: it.quantity + (newItem.quantity || 1) } : it,
        );
      }
      return [...prev, { ...newItem, quantity: newItem.quantity || 1 }];
    });
  }

  function updateQty(key, qty) {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((it) => itemKey(it) !== key);
      return prev.map((it) => (itemKey(it) === key ? { ...it, quantity: qty } : it));
    });
  }

  function removeItem(key) {
    setItems((prev) => prev.filter((it) => itemKey(it) !== key));
  }

  function clear() {
    setItems([]);
  }

  const totals = useMemo(() => {
    const count = items.reduce((s, it) => s + it.quantity, 0);
    const subtotal = items.reduce((s, it) => s + it.unit_price * it.quantity, 0);
    return { count, subtotal };
  }, [items]);

  return (
    <CartContext.Provider value={{ items, addItem, updateQty, removeItem, clear, totals, hydrated, itemKey }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
