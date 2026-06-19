import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, FlatList, TextInput,
  StyleSheet, ActivityIndicator, Alert, Image, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useProducts } from '../hooks/useProducts';
import { CloseTableModal } from './CloseTableModal';
import { colors } from '../styles/colors';

function PressScale({ style, onPress, children, scaleTo = 0.96 }) {
  const s = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { s.value = withSpring(scaleTo, { damping: 18, stiffness: 280 }); }}
      onPressOut={() => { s.value = withTiming(1, { duration: 160 }); }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

export function OrderPanel({
  table,
  onClose,
  getActiveOrder,
  closeOrder,
  createOrder,
  updateTableStatus,
  addItemsToOrder,
  updateOrderItemQty,
  deleteOrderItem,
  updateOrderTotal,
  getOrderPayments,
  addPayments,
}) {
  const { products, categories, loading: productsLoading } = useProducts();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pending edits — kept locally until the user hits "Siparişi Kaydet".
  const [removedIds, setRemovedIds] = useState(new Set());
  const [qtyOverrides, setQtyOverrides] = useState({}); // { itemId: quantity }
  const [newItems, setNewItems] = useState([]); // { key, product, variant, quantity, price }

  // Browser state
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [variantProduct, setVariantProduct] = useState(null);

  useEffect(() => {
    if (table) loadOrder();
  }, [table]);

  async function loadOrder() {
    setLoading(true);
    try {
      const o = await getActiveOrder(table.id);
      setOrder(o);
      setRemovedIds(new Set());
      setQtyOverrides({});
      setNewItems([]);
    } catch (e) {
      Alert.alert('Hata', e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Existing items, with pending edits applied ───────────────
  const existingItems = useMemo(() => {
    const raw = order?.order_items || [];
    return raw
      .filter(i => !removedIds.has(i.id))
      .map(i => ({ ...i, quantity: qtyOverrides[i.id] ?? i.quantity }));
  }, [order, removedIds, qtyOverrides]);

  const itemCount = existingItems.reduce((s, i) => s + i.quantity, 0)
    + newItems.reduce((s, i) => s + i.quantity, 0);

  const total =
    existingItems.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0) +
    newItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const hasPendingChanges =
    removedIds.size > 0 ||
    Object.keys(qtyOverrides).length > 0 ||
    newItems.length > 0;

  const isNewOrder = !order;

  // ── Existing line edits ──────────────────────────────────────
  function bumpExistingQty(item, delta) {
    const next = (qtyOverrides[item.id] ?? item.quantity) + delta;
    if (next <= 0) {
      setRemovedIds(prev => new Set(prev).add(item.id));
      setQtyOverrides(prev => {
        const n = { ...prev };
        delete n[item.id];
        return n;
      });
      return;
    }
    setQtyOverrides(prev => ({ ...prev, [item.id]: next }));
  }

  function removeExisting(item) {
    setRemovedIds(prev => new Set(prev).add(item.id));
  }

  // ── New item edits ──────────────────────────────────────────
  function newItemKey(product, variant) {
    return variant ? `new_${product.id}_${variant.id}` : `new_${product.id}`;
  }

  function addNewItem(product, variant = null) {
    const key = newItemKey(product, variant);
    const price = variant ? Number(variant.price) : Number(product.price);
    setNewItems(prev => {
      const i = prev.findIndex(x => x.key === key);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { key, product, variant, quantity: 1, price }];
    });
  }

  function bumpNewItem(key, delta) {
    setNewItems(prev => {
      const i = prev.findIndex(x => x.key === key);
      if (i < 0) return prev;
      const nextQty = prev[i].quantity + delta;
      if (nextQty <= 0) return prev.filter(x => x.key !== key);
      const next = [...prev];
      next[i] = { ...next[i], quantity: nextQty };
      return next;
    });
  }

  function removeNewItem(key) {
    setNewItems(prev => prev.filter(x => x.key !== key));
  }

  function handleProductPress(product) {
    const variants = product.product_variants || [];
    if (variants.length === 0) addNewItem(product);
    else setVariantProduct(product);
  }

  // ── Save / discard ──────────────────────────────────────────
  async function handleSave() {
    if (!hasPendingChanges) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      if (isNewOrder) {
        // Boş masa → yeni sipariş oluştur + masayı dolu yap
        if (newItems.length === 0) {
          Alert.alert('Sepet Boş', 'En az bir ürün ekleyin.');
          setSaving(false);
          return;
        }
        await createOrder(
          table.id,
          newItems.map(i => ({
            product_id: i.product.id,
            quantity: i.quantity,
            unit_price: i.price,
          })),
          null,
        );
        await updateTableStatus(table.id, 'occupied');
        onClose();
        return;
      }

      // Mevcut sipariş güncelleme akışı
      for (const id of removedIds) {
        await deleteOrderItem(id);
      }
      for (const [id, q] of Object.entries(qtyOverrides)) {
        if (removedIds.has(Number(id))) continue;
        await updateOrderItemQty(Number(id), q);
      }
      if (newItems.length > 0) {
        await addItemsToOrder(order.id, newItems.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.price,
        })));
      }
      await updateOrderTotal(order.id, total);
      onClose();
    } catch (e) {
      Alert.alert('Hata', e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (!hasPendingChanges) {
      onClose();
      return;
    }
    Alert.alert(
      'Kaydedilmemiş değişiklikler',
      'Yaptığınız değişiklikler kaydedilmeyecek. Çıkmak istediğinize emin misiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Çık', style: 'destructive', onPress: onClose },
      ],
    );
  }

  function handlePaymentCompleted() {
    setShowCloseModal(false);
    onClose();
  }

  // ── Product filter ──────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      const matchCat = selectedCategory === 'all' || String(p.category_id) === String(selectedCategory);
      const matchSearch = !q || p.name.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, search]);

  // ── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: verticalScale(48) }} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* ── Top App Bar ─────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={moderateScale(24)} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {table?.name} — {isNewOrder ? 'Yeni Sipariş' : 'Sipariş'}
        </Text>
        <View style={styles.tablePill}>
          <Text style={styles.tablePillText}>{table?.name?.replace(/\D/g, '') || '·'}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Mevcut Sipariş ─────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>
              {isNewOrder ? 'YENİ SİPARİŞ' : 'MEVCUT SİPARİŞ'}
            </Text>
            <Text style={styles.sectionCount}>{existingItems.length + newItems.length} Ürün</Text>
          </View>

          {existingItems.length === 0 && newItems.length === 0 ? (
            <View style={styles.emptyOrder}>
              <Text style={styles.emptyOrderText}>
                {isNewOrder ? 'Aşağıdan ürün seçerek başlayın' : 'Henüz ürün eklenmedi'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: verticalScale(10) }}>
              {existingItems.map(item => (
                <OrderItemRow
                  key={`existing-${item.id}`}
                  name={item.products?.name || 'Ürün'}
                  note={null}
                  quantity={item.quantity}
                  onMinus={() => bumpExistingQty(item, -1)}
                  onPlus={() => bumpExistingQty(item, 1)}
                  onDelete={() => removeExisting(item)}
                />
              ))}
              {newItems.map(item => (
                <OrderItemRow
                  key={item.key}
                  name={item.product.name}
                  note={item.variant ? item.variant.name : 'Yeni'}
                  isNew
                  quantity={item.quantity}
                  onMinus={() => bumpNewItem(item.key, -1)}
                  onPlus={() => bumpNewItem(item.key, 1)}
                  onDelete={() => removeNewItem(item.key)}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Ürün Ekle ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ÜRÜN EKLE</Text>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={moderateScale(18)} color={colors.onSurfaceVariant} style={{ opacity: 0.5 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Ürün veya kategori ara..."
              placeholderTextColor={colors.outline}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Category chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            <CatChip label="Hepsi" active={selectedCategory === 'all'} onPress={() => setSelectedCategory('all')} />
            {categories.map(c => (
              <CatChip
                key={c.id}
                label={c.name}
                active={String(selectedCategory) === String(c.id)}
                onPress={() => setSelectedCategory(String(c.id))}
              />
            ))}
          </ScrollView>

          {/* Product grid */}
          {productsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: verticalScale(20) }} />
          ) : filteredProducts.length === 0 ? (
            <Text style={styles.empty}>Ürün bulunamadı</Text>
          ) : (
            <View style={styles.productGrid}>
              {filteredProducts.map(p => (
                <ProductCard key={p.id} product={p} onAdd={() => handleProductPress(p)} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ───────────────────────────────── */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.bottomLabel}>TOPLAM TUTAR</Text>
            <Text style={styles.bottomTotal}>₺{total.toFixed(2)}</Text>
          </View>
          {!isNewOrder && (
            <PressScale style={styles.closeTablePill} onPress={() => setShowCloseModal(true)}>
              <Ionicons name="card-outline" size={moderateScale(14)} color={colors.secondaryContainer} />
              <Text style={styles.closeTablePillText}>Adisyonu Kapat</Text>
            </PressScale>
          )}
        </View>
        <PressScale
          style={[styles.saveBtn, (!hasPendingChanges || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
        >
          {saving ? (
            <ActivityIndicator color={colors.secondaryContainer} />
          ) : (
            <>
              <Ionicons name="send" size={moderateScale(18)} color={colors.secondaryContainer} />
              <Text style={styles.saveBtnText}>
                {!hasPendingChanges
                  ? 'Değişiklik Yok'
                  : isNewOrder
                    ? 'Siparişi Oluştur'
                    : 'Siparişi Kaydet'}
              </Text>
            </>
          )}
        </PressScale>
      </View>

      {/* ── Variant Picker ──────────────────────────────────── */}
      {variantProduct && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setVariantProduct(null)}>
          <Pressable style={styles.variantOverlay} onPress={() => setVariantProduct(null)}>
            <Pressable style={styles.variantSheet}>
              <Text style={styles.variantTitle}>{variantProduct.name}</Text>
              <Text style={styles.variantSub}>Boyut seçin</Text>
              {(variantProduct.product_variants || []).map(v => (
                <TouchableOpacity
                  key={v.id}
                  style={styles.variantRow}
                  onPress={() => { addNewItem(variantProduct, v); setVariantProduct(null); }}
                >
                  <Text style={styles.variantName}>{v.name}</Text>
                  <Text style={styles.variantPrice}>₺{Number(v.price).toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setVariantProduct(null)} style={styles.variantCancel}>
                <Text style={styles.variantCancelText}>İptal</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <CloseTableModal
        visible={showCloseModal}
        order={order}
        table={table}
        onClose={() => setShowCloseModal(false)}
        onCompleted={handlePaymentCompleted}
        getOrderPayments={getOrderPayments}
        addPayments={addPayments}
      />
    </SafeAreaView>
  );
}

// ── Subcomponents ─────────────────────────────────────────────

function OrderItemRow({ name, note, quantity, isNew, onMinus, onPlus, onDelete }) {
  return (
    <View style={styles.itemRow}>
      <View style={{ flex: 1, paddingRight: scale(8) }}>
        <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
        {note ? (
          <Text style={[styles.itemNote, isNew && styles.itemNoteNew]}>{note}</Text>
        ) : (
          <Text style={styles.itemNote}>Standart</Text>
        )}
      </View>
      <View style={styles.qtyPill}>
        <TouchableOpacity onPress={onMinus} style={styles.qtyBtn} activeOpacity={0.6}>
          <Ionicons name="remove-circle" size={moderateScale(22)} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.qtyValue}>{quantity}</Text>
        <TouchableOpacity onPress={onPlus} style={styles.qtyBtn} activeOpacity={0.6}>
          <Ionicons name="add-circle" size={moderateScale(22)} color={colors.secondary} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} activeOpacity={0.6}>
        <Ionicons name="trash-outline" size={moderateScale(20)} color={colors.error} style={{ opacity: 0.4 }} />
      </TouchableOpacity>
    </View>
  );
}

function CatChip({ label, active, onPress }) {
  return (
    <PressScale
      style={[styles.catChip, active && styles.catChipActive]}
      onPress={onPress}
      scaleTo={0.94}
    >
      <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{label}</Text>
    </PressScale>
  );
}

function ProductCard({ product, onAdd }) {
  const variants = product.product_variants || [];
  const price = variants.length > 0
    ? `${Math.min(...variants.map(v => Number(v.price))).toFixed(2)}+`
    : Number(product.price).toFixed(2);

  return (
    <PressScale style={styles.productCard} onPress={onAdd} scaleTo={0.95}>
      <View style={styles.productImageWrap}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={[styles.productImage, styles.productImagePlaceholder]}>
            <Ionicons name="restaurant-outline" size={moderateScale(28)} color={colors.outline} />
          </View>
        )}
        <View style={styles.productAddBtn}>
          <Ionicons name="add" size={moderateScale(20)} color={colors.onPrimary} />
        </View>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productPrice}>{price} TL</Text>
      </View>
    </PressScale>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noOrder: {
    color: colors.outline,
    fontSize: moderateScale(15),
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    backgroundColor: 'rgba(249,250,242,0.95)',
    gap: scale(8),
  },
  backBtn: {
    padding: scale(4),
  },
  headerTitle: {
    flex: 1,
    fontSize: moderateScale(17),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  tablePill: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(999),
  },
  tablePillText: {
    color: colors.primary,
    fontSize: moderateScale(11),
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(180), // room for bottom bar
    gap: verticalScale(28),
  },

  // Section
  section: { gap: verticalScale(14) },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    letterSpacing: 2,
    opacity: 0.6,
  },
  sectionCount: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: colors.secondary,
  },

  // Order item rows
  emptyOrder: {
    padding: scale(20),
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
    alignItems: 'center',
  },
  emptyOrderText: {
    color: colors.outline,
    fontSize: moderateScale(13),
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(14),
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
    gap: scale(8),
  },
  itemName: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: colors.onSurface,
  },
  itemNote: {
    fontSize: moderateScale(11),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(2),
  },
  itemNoteNew: {
    color: colors.secondary,
    fontWeight: '700',
  },
  qtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(4),
    paddingVertical: verticalScale(2),
    gap: scale(2),
  },
  qtyBtn: {
    width: moderateScale(28),
    height: moderateScale(28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    paddingHorizontal: scale(6),
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: colors.onSurface,
    minWidth: scale(18),
    textAlign: 'center',
  },
  deleteBtn: {
    padding: scale(6),
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(14),
    gap: scale(10),
  },
  searchInput: {
    flex: 1,
    paddingVertical: verticalScale(12),
    fontSize: moderateScale(13),
    color: colors.onSurface,
  },

  // Category chips
  catRow: {
    paddingVertical: verticalScale(2),
    gap: scale(8),
  },
  catChip: {
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(8),
    backgroundColor: colors.surfaceContainer,
    borderRadius: moderateScale(999),
  },
  catChipActive: {
    backgroundColor: colors.primary,
  },
  catChipText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.3,
  },
  catChipTextActive: {
    color: colors.onPrimary,
  },

  // Product grid
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
  productCard: {
    width: '47%',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: moderateScale(14),
    padding: scale(10),
    gap: verticalScale(10),
  },
  productImageWrap: {
    aspectRatio: 1,
    borderRadius: moderateScale(10),
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLow,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productAddBtn: {
    position: 'absolute',
    bottom: scale(8),
    right: scale(8),
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  productInfo: {
    paddingHorizontal: scale(2),
  },
  productName: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: colors.onSurface,
    lineHeight: moderateScale(17),
  },
  productPrice: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: colors.secondary,
    marginTop: verticalScale(4),
  },
  empty: {
    textAlign: 'center',
    color: colors.outline,
    fontSize: moderateScale(13),
    paddingVertical: verticalScale(20),
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(20),
    backgroundColor: 'rgba(249,250,242,0.96)',
    gap: verticalScale(12),
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomLabel: {
    fontSize: moderateScale(9),
    fontWeight: '800',
    color: colors.onSurfaceVariant,
    letterSpacing: 2,
    opacity: 0.6,
    marginBottom: verticalScale(2),
  },
  bottomTotal: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  closeTablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: colors.primary,
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(999),
  },
  closeTablePillText: {
    color: colors.secondaryContainer,
    fontSize: moderateScale(11),
    fontWeight: '800',
  },
  saveBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    paddingVertical: verticalScale(16),
    backgroundColor: colors.primaryContainer,
    borderRadius: moderateScale(14),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.55,
  },
  saveBtnText: {
    color: colors.secondaryContainer,
    fontSize: moderateScale(15),
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Variant picker
  variantOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,26,15,0.5)',
    justifyContent: 'flex-end',
  },
  variantSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    padding: scale(20),
    gap: verticalScale(8),
  },
  variantTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: colors.primary,
  },
  variantSub: {
    fontSize: moderateScale(12),
    color: colors.onSurfaceVariant,
    marginBottom: verticalScale(8),
    letterSpacing: 1,
  },
  variantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(4),
  },
  variantName: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: colors.onSurface,
  },
  variantPrice: {
    fontSize: moderateScale(15),
    fontWeight: '800',
    color: colors.secondary,
  },
  variantCancel: {
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    marginTop: verticalScale(6),
  },
  variantCancelText: {
    color: colors.error,
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
});
