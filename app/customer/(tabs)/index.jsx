import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import { useAuth } from '../../../hooks/useAuth';
import { useCart } from '../../../hooks/useCart';
import { useProducts } from '../../../hooks/useProducts';
import { colors } from '../../../styles/colors';

function PressScale({ style, onPress, children, disabled }) {
  const scaleV = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleV.value }] }));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => (scaleV.value = withSpring(0.97, { damping: 18, stiffness: 280 }))}
      onPressOut={() => (scaleV.value = withTiming(1, { duration: 170 }))}
    >
      <Animated.View style={[style, animatedStyle, disabled && { opacity: 0.5 }]}>{children}</Animated.View>
    </Pressable>
  );
}

function ProductCard({ product, onPress }) {
  const minPrice = product.product_variants?.length
    ? Math.min(...product.product_variants.map((v) => Number(v.price) || 0))
    : Number(product.price) || 0;
  return (
    <PressScale style={styles.card} onPress={onPress}>
      <View style={styles.cardImageWrap}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Ionicons name="leaf-outline" size={moderateScale(28)} color={colors.outline} />
          </View>
        )}
        {product.product_variants?.length > 0 ? (
          <View style={styles.variantBadge}>
            <Text style={styles.variantBadgeText}>{product.product_variants.length} seçenek</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardCat} numberOfLines={1}>
          {(product.categories?.name || 'ÜRÜN').toUpperCase()}
        </Text>
        <Text style={styles.cardName} numberOfLines={2}>{product.name}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>₺{minPrice.toFixed(2)}</Text>
          <View style={styles.plusBtn}>
            <Ionicons name="add" size={moderateScale(18)} color={colors.surface} />
          </View>
        </View>
      </View>
    </PressScale>
  );
}

function ProductDetailModal({ product, visible, onClose, onAdd }) {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [qty, setQty] = useState(1);

  if (!product) return null;
  const variants = product.product_variants || [];
  const activePrice = selectedVariant?.price ?? product.price ?? 0;

  function handleAdd() {
    onAdd({
      product_id: product.id,
      product_name: product.name,
      product_image: product.image_url,
      variant_id: selectedVariant?.id || null,
      variant_name: selectedVariant?.name || null,
      unit_price: Number(activePrice),
      quantity: qty,
    });
    onClose();
    setSelectedVariant(null);
    setQty(1);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {product.image_url ? (
              <Image source={{ uri: product.image_url }} style={styles.modalImage} />
            ) : (
              <View style={[styles.modalImage, styles.cardImagePlaceholder]}>
                <Ionicons name="leaf-outline" size={moderateScale(48)} color={colors.outline} />
              </View>
            )}
            <View style={{ padding: scale(20) }}>
              <Text style={styles.modalCat}>{(product.categories?.name || '').toUpperCase()}</Text>
              <Text style={styles.modalName}>{product.name}</Text>
              {product.recipe ? <Text style={styles.modalRecipe}>{product.recipe}</Text> : null}

              {variants.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>SEÇENEK</Text>
                  <View style={styles.variantList}>
                    {variants.map((v) => {
                      const active = selectedVariant?.id === v.id;
                      return (
                        <PressScale
                          key={v.id}
                          style={[styles.variantRow, active && styles.variantRowActive]}
                          onPress={() => setSelectedVariant(v)}
                        >
                          <View style={styles.variantLeft}>
                            <View
                              style={[styles.radio, active && styles.radioActive]}
                            >
                              {active ? (
                                <View style={styles.radioDot} />
                              ) : null}
                            </View>
                            <Text style={styles.variantName}>{v.name}</Text>
                          </View>
                          <Text style={styles.variantPrice}>₺{Number(v.price).toFixed(2)}</Text>
                        </PressScale>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Text style={styles.sectionLabel}>ADET</Text>
              <View style={styles.qtyRow}>
                <PressScale
                  style={styles.qtyBtn}
                  onPress={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Ionicons name="remove" size={moderateScale(18)} color={colors.primary} />
                </PressScale>
                <Text style={styles.qtyValue}>{qty}</Text>
                <PressScale style={styles.qtyBtn} onPress={() => setQty((q) => q + 1)}>
                  <Ionicons name="add" size={moderateScale(18)} color={colors.primary} />
                </PressScale>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <PressScale
              style={styles.addToCartBtn}
              onPress={handleAdd}
              disabled={variants.length > 0 && !selectedVariant}
            >
              <Ionicons name="bag-add" size={moderateScale(18)} color={colors.surface} />
              <Text style={styles.addToCartText}>
                Sepete Ekle · ₺{(Number(activePrice) * qty).toFixed(2)}
              </Text>
            </PressScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function CustomerMenu() {
  const { profile } = useAuth();
  const { products, categories, loading } = useProducts();
  const { addItem, totals } = useCart();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState(null);
  const [detail, setDetail] = useState(null);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCat) list = list.filter((p) => p.category_id === activeCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCat, search]);

  const firstName = profile?.full_name?.split(' ')[0] || 'Misafir';

  function handleAdd(item) {
    addItem(item);
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Merhaba, {firstName}</Text>
            <Text style={styles.headerTitle}>San Lucas</Text>
          </View>
          <View style={styles.brandIconLg}>
            <Ionicons name="leaf" size={moderateScale(22)} color={colors.primary} />
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={moderateScale(18)} color={colors.outline} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ürün ara..."
            placeholderTextColor={colors.outline}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={6}>
              <Ionicons name="close-circle" size={moderateScale(18)} color={colors.outline} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          <PressScale
            style={[styles.catChip, !activeCat && styles.catChipActive]}
            onPress={() => setActiveCat(null)}
          >
            <Text style={[styles.catChipText, !activeCat && styles.catChipTextActive]}>Tümü</Text>
          </PressScale>
          {categories.map((cat) => {
            const active = activeCat === cat.id;
            return (
              <PressScale
                key={cat.id}
                style={[styles.catChip, active && styles.catChipActive]}
                onPress={() => setActiveCat(cat.id)}
              >
                <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                  {cat.name}
                </Text>
              </PressScale>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          renderItem={({ item }) => (
            <ProductCard product={item} onPress={() => setDetail(item)} />
          )}
          columnWrapperStyle={{ gap: scale(12), paddingHorizontal: scale(20) }}
          contentContainerStyle={{
            paddingTop: verticalScale(8),
            paddingBottom: verticalScale(140),
            gap: verticalScale(12),
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="leaf-outline" size={moderateScale(40)} color={colors.outline} />
              <Text style={styles.emptyText}>Ürün bulunamadı</Text>
            </View>
          }
        />
      )}

      {totals.count > 0 ? (
        <PressScale
          style={[styles.fab, { bottom: verticalScale(90) + insets.bottom }]}
          onPress={() => router.push('/customer/(tabs)/cart')}
        >
          <Ionicons name="bag-handle" size={moderateScale(20)} color={colors.surface} />
          <Text style={styles.fabText}>
            Sepete Git ({totals.count}) · ₺{totals.subtotal.toFixed(2)}
          </Text>
          <Ionicons name="arrow-forward" size={moderateScale(18)} color={colors.surface} />
        </PressScale>
      ) : null}

      <ProductDetailModal
        product={detail}
        visible={!!detail}
        onClose={() => setDetail(null)}
        onAdd={handleAdd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(8),
  },
  greeting: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: scale(2),
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
    marginTop: verticalScale(4),
  },
  brandIconLg: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    marginHorizontal: scale(20),
    marginTop: verticalScale(14),
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(11),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(14),
    color: colors.onSurface,
    padding: 0,
  },
  catRow: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(14),
    paddingBottom: verticalScale(4),
    gap: scale(8),
  },
  catChip: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(100),
    backgroundColor: colors.surfaceContainerLow,
  },
  catChipActive: { backgroundColor: colors.primary },
  catChipText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: scale(0.5),
  },
  catChipTextActive: { color: colors.surface },

  card: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: moderateScale(18),
    overflow: 'hidden',
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardImageWrap: { position: 'relative' },
  cardImage: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceContainerLow },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  variantBadge: {
    position: 'absolute',
    top: scale(8),
    left: scale(8),
    backgroundColor: 'rgba(5,26,15,0.7)',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
  },
  variantBadgeText: {
    fontSize: moderateScale(9),
    fontWeight: '700',
    color: colors.surface,
    letterSpacing: scale(0.5),
  },
  cardBody: { padding: scale(12) },
  cardCat: {
    fontSize: moderateScale(9),
    fontWeight: '700',
    color: colors.secondary,
    letterSpacing: scale(1.2),
    marginBottom: verticalScale(4),
  },
  cardName: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: -0.2,
    minHeight: verticalScale(38),
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: verticalScale(8),
  },
  cardPrice: {
    fontSize: moderateScale(15),
    fontWeight: '800',
    color: colors.secondary,
  },
  plusBtn: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(60),
    gap: verticalScale(12),
  },
  emptyText: {
    fontSize: moderateScale(13),
    color: colors.onSurfaceVariant,
  },

  fab: {
    position: 'absolute',
    left: scale(20),
    right: scale(20),
    backgroundColor: colors.primary,
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(8),
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  fabText: {
    color: colors.surface,
    fontSize: moderateScale(13),
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,26,15,0.45)' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: moderateScale(28),
    borderTopRightRadius: moderateScale(28),
    maxHeight: '92%',
    overflow: 'hidden',
  },
  modalHandle: {
    alignSelf: 'center',
    width: scale(40),
    height: verticalScale(4),
    borderRadius: scale(2),
    backgroundColor: colors.outlineVariant,
    marginTop: verticalScale(8),
    marginBottom: verticalScale(4),
  },
  modalImage: { width: '100%', aspectRatio: 1.4, backgroundColor: colors.surfaceContainerLow },
  modalCat: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: colors.secondary,
    letterSpacing: scale(2),
    marginBottom: verticalScale(6),
  },
  modalName: {
    fontSize: moderateScale(24),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  modalRecipe: {
    fontSize: moderateScale(13),
    color: colors.onSurfaceVariant,
    lineHeight: moderateScale(20),
    marginTop: verticalScale(8),
  },
  sectionLabel: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: scale(2),
    marginTop: verticalScale(20),
    marginBottom: verticalScale(10),
  },
  variantList: { gap: verticalScale(8) },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(12),
    backgroundColor: colors.surfaceContainerLow,
  },
  variantRowActive: { backgroundColor: colors.secondaryContainer },
  variantLeft: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },
  radio: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    backgroundColor: colors.primary,
  },
  variantName: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: colors.onSurface,
  },
  variantPrice: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: colors.secondary,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(20),
  },
  qtyBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: colors.primary,
    minWidth: scale(40),
    textAlign: 'center',
  },
  modalFooter: {
    padding: scale(20),
    paddingBottom: verticalScale(28),
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  addToCartBtn: {
    backgroundColor: colors.primary,
    borderRadius: moderateScale(14),
    paddingVertical: verticalScale(15),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
  },
  addToCartText: {
    color: colors.surface,
    fontSize: moderateScale(15),
    fontWeight: '700',
    letterSpacing: scale(0.3),
  },
});
