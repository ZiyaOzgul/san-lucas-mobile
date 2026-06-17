import { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, FlatList,
  ScrollView, StyleSheet, Alert, ActivityIndicator, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useProducts } from '../hooks/useProducts';
import { Button } from './shared/Button';
import { colors } from '../styles/colors';

export function NewOrderModal({ visible, table, onClose, createOrder, updateTableStatus }) {
  const { products, categories, loading } = useProducts();

  const [cart, setCart] = useState({}); // { productId: { product, variant, quantity } }
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null); // product awaiting variant selection
  const [submitting, setSubmitting] = useState(false);

  function resetAndClose() {
    setCart({});
    setSearch('');
    setSelectedCategory('all');
    setShowCart(false);
    setVariantProduct(null);
    onClose();
  }

  function cartKey(productId, variantId) {
    return variantId ? `${productId}_${variantId}` : `${productId}`;
  }

  function addToCart(product, variant = null) {
    const key = cartKey(product.id, variant?.id);
    const price = variant ? Number(variant.price) : Number(product.price);
    setCart(prev => ({
      ...prev,
      [key]: prev[key]
        ? { ...prev[key], quantity: prev[key].quantity + 1 }
        : { product, variant, quantity: 1, price },
    }));
  }

  function changeQty(key, delta) {
    setCart(prev => {
      const item = prev[key];
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { ...item, quantity: newQty } };
    });
  }

  function handleProductPress(product) {
    const variants = product.product_variants || [];
    if (variants.length === 0) {
      addToCart(product);
    } else {
      setVariantProduct(product);
    }
  }

  const cartItems = Object.entries(cart).map(([key, item]) => ({ key, ...item }));
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const filtered = products.filter(p => {
    const matchCat = selectedCategory === 'all' || String(p.category_id) === String(selectedCategory);
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  async function handleSubmit() {
    if (cartItems.length === 0) {
      Alert.alert('Sepet Boş', 'Lütfen en az bir ürün ekleyin.');
      return;
    }
    setSubmitting(true);
    try {
      const items = cartItems.map(i => ({
        product_id: i.product.id,
        variant_id: i.variant?.id ?? null,
        quantity: i.quantity,
        unit_price: i.price,
      }));
      await createOrder(table.id, items, null);
      await updateTableStatus(table.id, 'occupied');
      resetAndClose();
    } catch (e) {
      Alert.alert('Hata', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function renderProduct({ item }) {
    const variants = item.product_variants || [];
    const price = variants.length > 0
      ? `₺${Math.min(...variants.map(v => Number(v.price))).toFixed(2)}+`
      : `₺${Number(item.price).toFixed(2)}`;
    const cat = categories.find(c => c.id === item.category_id);

    return (
      <TouchableOpacity style={styles.productCard} onPress={() => handleProductPress(item)} activeOpacity={0.75}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, styles.productImagePlaceholder]}>
            <Text style={styles.productEmoji}>📦</Text>
          </View>
        )}
        <View style={styles.productBody}>
          <View style={[styles.categoryDot, { backgroundColor: cat?.color || colors.accent }]} />
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productPrice}>{price}</Text>
        </View>
        <View style={styles.addBtn}>
          <Ionicons name="add" size={moderateScale(18)} color="#fff" />
        </View>
      </TouchableOpacity>
    );
  }

  function renderCartItem({ item }) {
    return (
      <View style={styles.cartRow}>
        <View style={styles.cartInfo}>
          <Text style={styles.cartName} numberOfLines={1}>{item.product.name}</Text>
          {item.variant && <Text style={styles.cartVariant}>{item.variant.name}</Text>}
        </View>
        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(item.key, -1)}>
            <Ionicons name="remove" size={moderateScale(16)} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(item.key, 1)}>
            <Ionicons name="add" size={moderateScale(16)} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.cartLineTotal}>₺{(item.price * item.quantity).toFixed(2)}</Text>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} onRequestClose={resetAndClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={resetAndClose} style={styles.closeBtn}>
            <Ionicons name="close" size={moderateScale(24)} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{table?.name} — Yeni Sipariş</Text>
          <TouchableOpacity style={styles.cartToggle} onPress={() => setShowCart(v => !v)}>
            <Ionicons name={showCart ? 'grid-outline' : 'cart-outline'} size={moderateScale(22)} color={colors.accent} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {showCart ? (
          /* ── Cart View ── */
          <FlatList
            data={cartItems}
            keyExtractor={i => i.key}
            contentContainerStyle={styles.cartList}
            ListEmptyComponent={
              <View style={styles.emptyCart}>
                <Ionicons name="cart-outline" size={moderateScale(48)} color={colors.textMuted} />
                <Text style={styles.emptyCartText}>Sepet boş</Text>
              </View>
            }
            renderItem={renderCartItem}
          />
        ) : (
          /* ── Product Browser ── */
          <>
            {/* Category tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catBar}>
              <TouchableOpacity
                style={[styles.catTab, selectedCategory === 'all' && styles.catTabActive]}
                onPress={() => setSelectedCategory('all')}
              >
                <Text style={[styles.catText, selectedCategory === 'all' && styles.catTextActive]}>Tümü</Text>
              </TouchableOpacity>
              {categories.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catTab, String(selectedCategory) === String(c.id) && styles.catTabActive, { borderColor: c.color || colors.accent }]}
                  onPress={() => setSelectedCategory(String(c.id))}
                >
                  <Text style={[styles.catText, String(selectedCategory) === String(c.id) && styles.catTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Search */}
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={moderateScale(16)} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Ürün ara..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {loading ? (
              <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={item => String(item.id)}
                numColumns={2}
                contentContainerStyle={styles.productGrid}
                columnWrapperStyle={styles.productRow}
                ListEmptyComponent={<Text style={styles.empty}>Ürün bulunamadı</Text>}
                renderItem={renderProduct}
              />
            )}
          </>
        )}

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Toplam</Text>
            <Text style={styles.totalAmount}>₺{cartTotal.toFixed(2)}</Text>
          </View>
          <Button
            title={submitting ? 'Kaydediliyor...' : 'Siparişi Onayla'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={cartCount === 0}
            style={styles.confirmBtn}
          />
        </View>

        {/* Variant Picker Modal */}
        {variantProduct && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setVariantProduct(null)}>
            <TouchableOpacity style={styles.variantOverlay} activeOpacity={1} onPress={() => setVariantProduct(null)}>
              <View style={styles.variantSheet}>
                <Text style={styles.variantTitle}>{variantProduct.name}</Text>
                <Text style={styles.variantSub}>Boyut seçin</Text>
                {(variantProduct.product_variants || []).map(v => (
                  <TouchableOpacity
                    key={v.id}
                    style={styles.variantRow}
                    onPress={() => { addToCart(variantProduct, v); setVariantProduct(null); }}
                  >
                    <Text style={styles.variantName}>{v.name}</Text>
                    <Text style={styles.variantPrice}>₺{Number(v.price).toFixed(2)}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => setVariantProduct(null)} style={styles.variantCancel}>
                  <Text style={styles.variantCancelText}>İptal</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPage },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: scale(12), paddingVertical: verticalScale(10),
    backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  closeBtn: { padding: scale(4) },
  headerTitle: { flex: 1, fontSize: moderateScale(16), fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  cartToggle: { padding: scale(4) },
  cartBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: colors.accent, borderRadius: moderateScale(8),
    minWidth: moderateScale(16), height: moderateScale(16),
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
  },
  cartBadgeText: { color: '#fff', fontSize: moderateScale(10), fontWeight: '700' },

  // Category tabs
  catScroll: {
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: verticalScale(44),
  },
  catBar: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    gap: scale(6),
    alignItems: 'center',
  },
  catTab: {
    paddingHorizontal: scale(12), paddingVertical: verticalScale(4),
    borderRadius: moderateScale(20), backgroundColor: colors.bgPage,
    borderWidth: 1, borderColor: colors.border,
  },
  catTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  catText: { fontSize: moderateScale(13), fontWeight: '600', color: colors.textSecondary },
  catTextActive: { color: '#fff' },

  // Search
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: scale(12), marginVertical: verticalScale(8),
    backgroundColor: colors.bgCard, borderRadius: moderateScale(8),
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: scale(10),
  },
  searchIcon: { marginRight: scale(6) },
  searchInput: { flex: 1, fontSize: moderateScale(14), color: colors.textPrimary, paddingVertical: verticalScale(8) },

  // Product grid
  productGrid: { paddingHorizontal: scale(12), paddingBottom: verticalScale(8) },
  productRow: { gap: scale(10), marginBottom: verticalScale(10) },
  productCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: moderateScale(10),
    padding: scale(8),
    borderWidth: 1,
    borderColor: colors.border,
    gap: scale(8),
  },
  productImage: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(8),
    backgroundColor: colors.bgPage,
  },
  productImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productEmoji: { fontSize: moderateScale(22) },
  productBody: { flex: 1, gap: verticalScale(2) },
  categoryDot: { width: moderateScale(8), height: moderateScale(8), borderRadius: moderateScale(4) },
  productName: { fontSize: moderateScale(13), fontWeight: '600', color: colors.textPrimary },
  productPrice: { fontSize: moderateScale(14), fontWeight: '700', color: colors.accent },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: moderateScale(14), width: moderateScale(26), height: moderateScale(26),
    alignItems: 'center', justifyContent: 'center',
  },

  // Cart list
  cartList: { padding: scale(16), gap: verticalScale(10) },
  emptyCart: { alignItems: 'center', paddingTop: verticalScale(60), gap: verticalScale(12) },
  emptyCartText: { fontSize: moderateScale(15), color: colors.textMuted },
  cartRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: moderateScale(10),
    padding: scale(12), borderWidth: 1, borderColor: colors.border, gap: scale(8),
  },
  cartInfo: { flex: 1 },
  cartName: { fontSize: moderateScale(14), fontWeight: '600', color: colors.textPrimary },
  cartVariant: { fontSize: moderateScale(12), color: colors.textMuted },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  qtyBtn: {
    width: moderateScale(28), height: moderateScale(28), borderRadius: moderateScale(14),
    backgroundColor: colors.bgPage, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyText: { fontSize: moderateScale(15), fontWeight: '700', color: colors.textPrimary, minWidth: scale(20), textAlign: 'center' },
  cartLineTotal: { fontSize: moderateScale(13), fontWeight: '700', color: colors.accent, minWidth: scale(56), textAlign: 'right' },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: scale(16), paddingVertical: verticalScale(10),
    backgroundColor: colors.bgCard, borderTopWidth: 1, borderTopColor: colors.border, gap: scale(12),
  },
  totalBox: { flex: 0 },
  totalLabel: { fontSize: moderateScale(11), color: colors.textMuted },
  totalAmount: { fontSize: moderateScale(18), fontWeight: '700', color: colors.textPrimary },
  confirmBtn: { flex: 1 },

  // Misc
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: moderateScale(15), marginTop: verticalScale(48) },

  // Variant picker
  variantOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  variantSheet: {
    backgroundColor: colors.bgCard, borderTopLeftRadius: moderateScale(16), borderTopRightRadius: moderateScale(16),
    padding: scale(20), gap: verticalScale(8),
  },
  variantTitle: { fontSize: moderateScale(17), fontWeight: '700', color: colors.textPrimary },
  variantSub: { fontSize: moderateScale(13), color: colors.textMuted, marginBottom: verticalScale(4) },
  variantRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: verticalScale(12), borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  variantName: { fontSize: moderateScale(15), fontWeight: '600', color: colors.textPrimary },
  variantPrice: { fontSize: moderateScale(15), fontWeight: '700', color: colors.accent },
  variantCancel: { alignItems: 'center', paddingVertical: verticalScale(12) },
  variantCancelText: { fontSize: moderateScale(15), color: colors.danger, fontWeight: '600' },
});
