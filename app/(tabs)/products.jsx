import { useState, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Modal, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, ScrollView, KeyboardAvoidingView,
  Platform, Image, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useProducts } from '../../hooks/useProducts';
import { useIngredients } from '../../hooks/useIngredients';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { colors } from '../../styles/colors';

function PressScale({ style, onPress, children, scaleTo = 0.97, disabled }) {
  const s = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => { s.value = withSpring(scaleTo, { damping: 18, stiffness: 280 }); }}
      onPressOut={() => { s.value = withTiming(1, { duration: 160 }); }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

function stockTone(stock) {
  if (stock > 10) return { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer, dot: colors.secondary };
  if (stock > 4)  return { bg: colors.tertiaryContainer,  fg: colors.onTertiaryContainer,  dot: colors.tertiary  };
  return            { bg: colors.errorContainer,     fg: colors.onErrorContainer,     dot: colors.error     };
}

function priceDisplay(product) {
  const variants = product.product_variants || [];
  if (variants.length === 0) return `₺${Number(product.price).toFixed(2)}`;
  const prices = variants.map(v => Number(v.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `₺${min.toFixed(2)}`;
  return `₺${min.toFixed(2)}–₺${max.toFixed(2)}`;
}

export default function ProductsScreen() {
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const {
    products, categories, loading, error, refetch, addProduct, updateProduct, deleteProduct,
    fetchProductIngredients, saveVariants, saveProductIngredients,
  } = useProducts();
  const { ingredients } = useIngredients();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [detailProduct, setDetailProduct] = useState(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formStock, setFormStock] = useState('0');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formRecipe, setFormRecipe] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formVariants, setFormVariants] = useState([]);
  const [formIngredientRows, setFormIngredientRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.noAccess}>Bu sayfaya erişim yetkiniz yok.</Text>
      </View>
    );
  }

  const filtered = useMemo(() => products.filter(p => {
    const matchCat = selectedCategory === 'all' || String(p.category_id) === String(selectedCategory);
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [products, selectedCategory, search]);

  const lastDetailRef = useRef(null);
  if (detailProduct) lastDetailRef.current = detailProduct;
  const detailToShow = detailProduct || lastDetailRef.current;

  function openAdd() {
    setEditProduct(null);
    setFormName('');
    setFormPrice('');
    setFormStock('0');
    setFormCategoryId(categories[0]?.id ? String(categories[0].id) : '');
    setFormRecipe('');
    setFormImageUrl('');
    setFormVariants([]);
    setFormIngredientRows([]);
    setModalVisible(true);
  }

  async function openEdit(product) {
    setEditProduct(product);
    setFormName(product.name);
    setFormPrice(String(product.price));
    setFormStock(String(product.stock));
    setFormCategoryId(String(product.category_id));
    setFormRecipe(product.recipe || '');
    setFormImageUrl(product.image_url || '');
    setFormVariants((product.product_variants || []).map(v => ({ name: v.name, price: String(v.price) })));
    try {
      const rows = await fetchProductIngredients(product.id);
      setFormIngredientRows(rows.map(r => ({
        ingredient_id: String(r.ingredient_id),
        amount_used: String(r.amount_used),
        unit: r.ingredients?.unit || '',
      })));
    } catch {
      setFormIngredientRows([]);
    }
    setModalVisible(true);
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('İzin Gerekli', 'Galeri erişim izni gereklidir.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingImage(true);
    try {
      const uri = result.assets[0].uri;
      const filename = `${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const { error } = await supabase.storage
        .from('product-images')
        .upload(filename, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('product-images').getPublicUrl(filename);
      setFormImageUrl(data.publicUrl);
    } catch (e) {
      Alert.alert('Hata', 'Görsel yüklenemedi: ' + e.message);
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSave() {
    if (!formName || !formPrice) {
      Alert.alert('Hata', 'Ürün adı ve fiyat zorunludur.');
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: formName.trim(),
        price: parseFloat(formPrice),
        stock: parseInt(formStock) || 0,
        category_id: formCategoryId ? parseInt(formCategoryId) : null,
        recipe: formRecipe.trim() || null,
        image_url: formImageUrl || null,
      };
      let productId;
      if (editProduct) {
        await updateProduct(editProduct.id, data);
        productId = editProduct.id;
      } else {
        const { data: inserted, error } = await supabase
          .from('products')
          .insert({ ...data, is_active: true })
          .select('id')
          .single();
        if (error) throw error;
        productId = inserted.id;
        await refetch();
      }
      await saveVariants(productId, formVariants);
      await saveProductIngredients(
        productId,
        formIngredientRows
          .filter(r => r.ingredient_id)
          .map(r => ({ ingredient_id: parseInt(r.ingredient_id), amount_used: parseFloat(r.amount_used) || 0 })),
      );
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Hata', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    Alert.alert('Ürünü Sil', 'Bu ürünü silmek istediğinizden emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try { await deleteProduct(id); } catch (e) { Alert.alert('Hata', e.message); }
        },
      },
    ]);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function addVariant() { setFormVariants(v => [...v, { name: '', price: '' }]); }
  function updateVariant(idx, field, val) {
    setFormVariants(v => v.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  }
  function removeVariant(idx) { setFormVariants(v => v.filter((_, i) => i !== idx)); }

  function addIngredientRow() { setFormIngredientRows(r => [...r, { ingredient_id: '', amount_used: '', unit: '' }]); }
  function updateIngredientRow(idx, field, val) {
    setFormIngredientRows(r => r.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'ingredient_id') {
        const ing = ingredients.find(x => String(x.id) === val);
        return { ...item, ingredient_id: val, unit: ing?.unit || '' };
      }
      return { ...item, [field]: val };
    }));
  }
  function removeIngredientRow(idx) { setFormIngredientRows(r => r.filter((_, i) => i !== idx)); }

  const totalStock = products.reduce((s, p) => s + (p.stock || 0), 0);
  const lowStockCount = products.filter(p => (p.stock || 0) <= 4).length;

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        contentContainerStyle={[styles.grid, { paddingTop: insets.top + verticalScale(16) }]}
        columnWrapperStyle={styles.row}
        removeClippedSubviews={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>Hata: {error}</Text>
              </View>
            ) : null}

            {/* Editorial header */}
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Ürünler</Text>
                <View style={styles.countChip}>
                  <Text style={styles.countChipText}>{filtered.length}</Text>
                </View>
              </View>
              <Text style={styles.headerSubtitle}>
                Menüdeki ürünleri yönetin, varyant ve malzeme tarifleri ekleyin.
              </Text>
            </View>

            {/* Stats — Toplam Ürün / Stok / Az Kalan */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>TOPLAM ÜRÜN</Text>
                <Text style={styles.statValue}>{products.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>TOPLAM STOK</Text>
                <Text style={styles.statValue}>{totalStock}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>AZ KALAN</Text>
                <Text style={[styles.statValue, lowStockCount > 0 && { color: colors.error }]}>{lowStockCount}</Text>
              </View>
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={moderateScale(18)} color={colors.onSurfaceVariant} style={{ opacity: 0.5 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Ürün ara..."
                placeholderTextColor={colors.outline}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={moderateScale(18)} color={colors.outline} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              style={styles.filterScroll}
            >
              <PressScale
                style={[styles.filterChip, selectedCategory === 'all' && styles.filterChipActive]}
                onPress={() => setSelectedCategory('all')}
                scaleTo={0.94}
              >
                <Text style={[styles.filterChipText, selectedCategory === 'all' && styles.filterChipTextActive]}>Tümü</Text>
              </PressScale>
              {categories.map(c => {
                const active = String(selectedCategory) === String(c.id);
                return (
                  <PressScale
                    key={c.id}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setSelectedCategory(String(c.id))}
                    scaleTo={0.94}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{c.name}</Text>
                  </PressScale>
                );
              })}
            </ScrollView>
          </>
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={styles.centerPad}><ActivityIndicator color={colors.primary} size="large" /></View>
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="cube-outline" size={moderateScale(40)} color={colors.outline} style={{ opacity: 0.4 }} />
              <Text style={styles.empty}>Ürün bulunamadı</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const variants = item.product_variants || [];
          const tone = stockTone(item.stock);
          return (
            <View style={styles.cardWrapper}>
              <PressScale style={styles.productCard} onPress={() => setDetailProduct(item)} scaleTo={0.97}>
                <View style={styles.productImageWrap}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.productImage} />
                  ) : (
                    <View style={styles.productImagePlaceholder}>
                      <Ionicons name="cube-outline" size={moderateScale(28)} color={colors.outline} style={{ opacity: 0.5 }} />
                    </View>
                  )}
                  <View style={[styles.stockPill, { backgroundColor: tone.bg }]}>
                    <View style={[styles.stockDot, { backgroundColor: tone.dot }]} />
                    <Text style={[styles.stockPillText, { color: tone.fg }]}>{item.stock}</Text>
                  </View>
                </View>

                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                  {item.categories ? (
                    <Text style={styles.productCategory} numberOfLines={1}>{item.categories.name}</Text>
                  ) : null}
                  <View style={styles.priceRow}>
                    <Text style={styles.productPrice} numberOfLines={1}>{priceDisplay(item)}</Text>
                    {variants.length > 0 && (
                      <View style={styles.variantBadge}>
                        <Text style={styles.variantBadgeText}>{variants.length} varyant</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.productActions}>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); openEdit(item); }}
                    style={styles.editAction}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={moderateScale(14)} color={colors.primary} />
                    <Text style={styles.editActionText}>Düzenle</Text>
                  </TouchableOpacity>
                  <View style={styles.actionDivider} />
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); handleDelete(item.id); }}
                    style={styles.deleteAction}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={moderateScale(14)} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </PressScale>
            </View>
          );
        }}
      />

      {/* Floating + button */}
      <PressScale style={[styles.fab, { bottom: insets.bottom + verticalScale(80) }]} onPress={openAdd} scaleTo={0.92}>
        <Ionicons name="add" size={moderateScale(28)} color={colors.onPrimary} />
      </PressScale>

      {/* Detail modal */}
      <Modal
        visible={!!detailProduct}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setDetailProduct(null)}
      >
        <SafeAreaView style={styles.detail} edges={['top', 'bottom']}>
          {detailToShow ? (
            <>
              <View style={styles.detailHeader}>
                <TouchableOpacity onPress={() => setDetailProduct(null)} style={styles.backBtn}>
                  <Ionicons name="chevron-back" size={moderateScale(24)} color={colors.primary} />
                </TouchableOpacity>
                <View style={styles.detailTitleWrap}>
                  <Text style={styles.detailTitle} numberOfLines={1}>{detailToShow.name}</Text>
                  {detailToShow.categories ? (
                    <Text style={styles.detailSub} numberOfLines={1}>{detailToShow.categories.name}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => { setDetailProduct(null); setTimeout(() => openEdit(detailToShow), 250); }}
                  style={styles.detailEditBtn}
                >
                  <Ionicons name="create-outline" size={moderateScale(20)} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.detailScroll}>
                {detailToShow.image_url ? (
                  <Image source={{ uri: detailToShow.image_url }} style={styles.detailImage} />
                ) : (
                  <View style={styles.detailImagePlaceholder}>
                    <Ionicons name="cube-outline" size={moderateScale(56)} color={colors.outline} style={{ opacity: 0.4 }} />
                  </View>
                )}

                <View style={styles.detailHeadCard}>
                  <Text style={styles.detailPriceLabel}>FİYAT</Text>
                  <Text style={styles.detailPriceValue}>{priceDisplay(detailToShow)}</Text>
                  <View style={styles.detailMetaRow}>
                    <View style={styles.detailMetaItem}>
                      <Ionicons name="layers-outline" size={moderateScale(13)} color={colors.outlineVariant} />
                      <Text style={styles.detailMetaText}>Stok: {detailToShow.stock}</Text>
                    </View>
                    {(detailToShow.product_variants || []).length > 0 && (
                      <>
                        <View style={styles.detailMetaDot} />
                        <View style={styles.detailMetaItem}>
                          <Ionicons name="options-outline" size={moderateScale(13)} color={colors.outlineVariant} />
                          <Text style={styles.detailMetaText}>
                            {(detailToShow.product_variants || []).length} varyant
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>

                {(detailToShow.product_variants || []).length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>VARYANTLAR</Text>
                    <View style={styles.detailCard}>
                      {(detailToShow.product_variants || []).map((v, i) => (
                        <View
                          key={i}
                          style={[
                            styles.detailRow,
                            i === 0 && { paddingTop: 0 },
                            i === (detailToShow.product_variants.length - 1) && { paddingBottom: 0 },
                          ]}
                        >
                          <Text style={styles.detailRowName}>{v.name}</Text>
                          <Text style={styles.detailRowValue}>₺{Number(v.price).toFixed(2)}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {detailToShow.recipe ? (
                  <>
                    <Text style={styles.sectionLabel}>TARİF</Text>
                    <View style={styles.detailCard}>
                      <Text style={styles.detailRecipe}>{detailToShow.recipe}</Text>
                    </View>
                  </>
                ) : null}
              </ScrollView>
            </>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* Add/Edit modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.detail} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.backBtn}>
                <Ionicons name="close" size={moderateScale(24)} color={colors.primary} />
              </TouchableOpacity>
              <View style={styles.detailTitleWrap}>
                <Text style={styles.detailTitle}>{editProduct ? 'Ürünü Düzenle' : 'Yeni Ürün'}</Text>
                <Text style={styles.detailSub}>
                  {editProduct ? 'Detayları güncelleyin' : 'Menüye ürün ekleyin'}
                </Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
              {/* Image picker */}
              <PressScale
                style={styles.imagePicker}
                onPress={uploadingImage ? undefined : pickImage}
                disabled={uploadingImage}
                scaleTo={0.98}
              >
                {formImageUrl ? (
                  <>
                    <Image source={{ uri: formImageUrl }} style={styles.imagePreview} />
                    <View style={styles.imageEditOverlay}>
                      <Ionicons name="camera" size={moderateScale(16)} color={colors.onPrimary} />
                      <Text style={styles.imageEditText}>Değiştir</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.imagePickerEmpty}>
                    {uploadingImage ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="image-outline" size={moderateScale(32)} color={colors.outline} />
                        <Text style={styles.imagePickerText}>Görsel Seç</Text>
                      </>
                    )}
                  </View>
                )}
              </PressScale>

              <Text style={styles.fieldLabel}>Ürün Adı</Text>
              <TextInput
                style={styles.fieldInput}
                value={formName}
                onChangeText={setFormName}
                placeholder="Örn. Latte"
                placeholderTextColor={colors.outline}
              />

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Fiyat (₺)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={formPrice}
                    onChangeText={setFormPrice}
                    placeholder="0.00"
                    placeholderTextColor={colors.outline}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Stok</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={formStock}
                    onChangeText={setFormStock}
                    placeholder="0"
                    placeholderTextColor={colors.outline}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Kategori</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.formChipsRow}
                style={styles.formChipsScroll}
              >
                {categories.map(c => {
                  const active = String(formCategoryId) === String(c.id);
                  return (
                    <PressScale
                      key={c.id}
                      style={[styles.formChip, active && styles.formChipActive]}
                      onPress={() => setFormCategoryId(String(c.id))}
                      scaleTo={0.94}
                    >
                      <Text style={[styles.formChipText, active && styles.formChipTextActive]}>{c.name}</Text>
                    </PressScale>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>Tarif (isteğe bağlı)</Text>
              <TextInput
                style={[styles.fieldInput, styles.textArea]}
                value={formRecipe}
                onChangeText={setFormRecipe}
                placeholder="Hazırlama talimatları..."
                placeholderTextColor={colors.outline}
                multiline
              />

              {/* Variants section */}
              <View style={styles.formSectionHeader}>
                <View>
                  <Text style={styles.formSectionTitle}>Varyantlar</Text>
                  <Text style={styles.formSectionSub}>Boy, sıcaklık veya boyut</Text>
                </View>
                <PressScale style={styles.addRowBtn} onPress={addVariant} scaleTo={0.92}>
                  <Ionicons name="add" size={moderateScale(16)} color={colors.primary} />
                  <Text style={styles.addRowBtnText}>Ekle</Text>
                </PressScale>
              </View>
              {formVariants.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyRowText}>Henüz varyant eklenmedi.</Text>
                </View>
              ) : (
                formVariants.map((v, idx) => (
                  <View key={idx} style={styles.dataRow}>
                    <TextInput
                      style={[styles.fieldInput, styles.dataRowNameInput]}
                      value={v.name}
                      onChangeText={val => updateVariant(idx, 'name', val)}
                      placeholder="Varyant adı"
                      placeholderTextColor={colors.outline}
                    />
                    <TextInput
                      style={[styles.fieldInput, styles.dataRowPriceInput]}
                      value={v.price}
                      onChangeText={val => updateVariant(idx, 'price', val)}
                      placeholder="₺"
                      placeholderTextColor={colors.outline}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity onPress={() => removeVariant(idx)} style={styles.removeBtn} hitSlop={6}>
                      <Ionicons name="close" size={moderateScale(16)} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              {/* Ingredients section */}
              <View style={styles.formSectionHeader}>
                <View>
                  <Text style={styles.formSectionTitle}>Malzeme Tarifi</Text>
                  <Text style={styles.formSectionSub}>Stok düşümü için kullanılır</Text>
                </View>
                <PressScale style={styles.addRowBtn} onPress={addIngredientRow} scaleTo={0.92}>
                  <Ionicons name="add" size={moderateScale(16)} color={colors.primary} />
                  <Text style={styles.addRowBtnText}>Ekle</Text>
                </PressScale>
              </View>
              {formIngredientRows.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyRowText}>Henüz malzeme eklenmedi.</Text>
                </View>
              ) : (
                formIngredientRows.map((row, idx) => (
                  <View key={idx} style={styles.ingCard}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.ingChipsRow}
                    >
                      {ingredients.map(ing => {
                        const active = String(row.ingredient_id) === String(ing.id);
                        return (
                          <PressScale
                            key={ing.id}
                            style={[styles.ingChip, active && styles.ingChipActive]}
                            onPress={() => updateIngredientRow(idx, 'ingredient_id', String(ing.id))}
                            scaleTo={0.94}
                          >
                            <Text style={[styles.ingChipText, active && styles.ingChipTextActive]}>
                              {ing.name}
                            </Text>
                          </PressScale>
                        );
                      })}
                    </ScrollView>
                    <View style={styles.ingAmountRow}>
                      <TextInput
                        style={[styles.fieldInput, styles.ingAmountInput]}
                        value={row.amount_used}
                        onChangeText={val => updateIngredientRow(idx, 'amount_used', val)}
                        placeholder="Miktar"
                        placeholderTextColor={colors.outline}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.ingUnit}>{row.unit || '—'}</Text>
                      <TouchableOpacity onPress={() => removeIngredientRow(idx)} style={styles.removeBtn} hitSlop={6}>
                        <Ionicons name="close" size={moderateScale(16)} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}

              {/* Footer actions */}
              <View style={styles.formActions}>
                <PressScale
                  style={[styles.formBtn, styles.formBtnGhost]}
                  onPress={() => setModalVisible(false)}
                  scaleTo={0.96}
                >
                  <Text style={styles.formBtnGhostText}>İptal</Text>
                </PressScale>
                <PressScale
                  style={[styles.formBtn, styles.formBtnPrimary, saving && { opacity: 0.6 }]}
                  onPress={saving ? undefined : handleSave}
                  disabled={saving}
                  scaleTo={0.96}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.formBtnPrimaryText}>Kaydet</Text>
                  )}
                </PressScale>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  centerPad: { paddingVertical: verticalScale(60), alignItems: 'center' },
  noAccess: { fontSize: moderateScale(15), color: colors.outline },

  grid: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(120),
    gap: scale(14),
  },
  row: {
    gap: scale(14),
    marginBottom: verticalScale(14),
  },
  cardWrapper: { flex: 1 },

  errorBanner: {
    backgroundColor: colors.errorContainer,
    padding: scale(12),
    borderRadius: moderateScale(10),
    marginBottom: verticalScale(12),
  },
  errorText: { color: colors.onErrorContainer, fontSize: moderateScale(13), fontWeight: '600' },

  // Header
  header: { marginBottom: verticalScale(16) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: verticalScale(6),
  },
  headerTitle: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  countChip: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(999),
  },
  countChipText: {
    color: colors.secondary,
    fontSize: moderateScale(11),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: moderateScale(13),
    color: colors.onSurfaceVariant,
    lineHeight: moderateScale(20),
    maxWidth: '85%',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginBottom: verticalScale(16),
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(10),
    alignItems: 'center',
  },
  statLabel: {
    fontSize: moderateScale(9),
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.onSurfaceVariant,
    marginBottom: verticalScale(6),
  },
  statValue: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(14),
    gap: scale(10),
    marginBottom: verticalScale(12),
  },
  searchInput: {
    flex: 1,
    paddingVertical: verticalScale(12),
    fontSize: moderateScale(13),
    color: colors.onSurface,
  },

  // Category filter
  filterScroll: { marginBottom: verticalScale(16), flexGrow: 0 },
  filterRow: { gap: scale(8), paddingRight: scale(20) },
  filterChip: {
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(8),
    backgroundColor: colors.surfaceContainer,
    borderRadius: moderateScale(999),
  },
  filterChipActive: { backgroundColor: colors.primary },
  filterChipText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  filterChipTextActive: { color: colors.onPrimary },

  // Product card
  productCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(16),
    overflow: 'hidden',
  },
  productImageWrap: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceContainerHigh,
    position: 'relative',
  },
  productImage: { width: '100%', height: '100%' },
  productImagePlaceholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  stockPill: {
    position: 'absolute',
    top: scale(8), right: scale(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(999),
  },
  stockDot: { width: moderateScale(5), height: moderateScale(5), borderRadius: moderateScale(3) },
  stockPillText: { fontSize: moderateScale(10), fontWeight: '800' },

  productInfo: { padding: scale(12), paddingBottom: verticalScale(8) },
  productName: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.2,
    lineHeight: moderateScale(17),
    minHeight: moderateScale(34),
  },
  productCategory: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginTop: verticalScale(4),
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: verticalScale(8),
    gap: scale(4),
  },
  productPrice: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  variantBadge: {
    backgroundColor: colors.surfaceContainerHighest,
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(4),
  },
  variantBadgeText: {
    fontSize: moderateScale(9),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },

  productActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surfaceContainer,
  },
  editAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(5),
    paddingVertical: verticalScale(8),
  },
  editActionText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  actionDivider: {
    width: 1,
    backgroundColor: colors.outlineVariant,
    opacity: 0.4,
  },
  deleteAction: {
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyWrap: {
    alignItems: 'center',
    gap: verticalScale(8),
    paddingVertical: verticalScale(60),
  },
  empty: { color: colors.outline, fontSize: moderateScale(14) },

  // FAB
  fab: {
    position: 'absolute',
    right: scale(20),
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },

  // Detail / form modal
  detail: { flex: 1, backgroundColor: colors.surface },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    gap: scale(10),
  },
  backBtn: { padding: scale(4) },
  detailTitleWrap: { flex: 1 },
  detailTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  detailSub: {
    fontSize: moderateScale(11),
    color: colors.outline,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: verticalScale(1),
  },
  detailEditBtn: { padding: scale(6) },

  detailScroll: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(40),
    gap: verticalScale(20),
  },
  detailImage: {
    width: '100%',
    aspectRatio: 1.4,
    borderRadius: moderateScale(16),
    backgroundColor: colors.surfaceContainerLow,
  },
  detailImagePlaceholder: {
    width: '100%',
    aspectRatio: 1.4,
    borderRadius: moderateScale(16),
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailHeadCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: moderateScale(16),
    padding: scale(18),
  },
  detailPriceLabel: {
    fontSize: moderateScale(9),
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.onPrimaryContainer,
    opacity: 0.7,
    marginBottom: verticalScale(4),
  },
  detailPriceValue: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: -0.5,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(12),
    gap: scale(8),
  },
  detailMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
  },
  detailMetaText: {
    fontSize: moderateScale(11),
    color: colors.onPrimaryContainer,
    fontWeight: '600',
  },
  detailMetaDot: {
    width: 3, height: 3, borderRadius: 1.5,
    backgroundColor: colors.outlineVariant,
    opacity: 0.4,
  },

  sectionLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.onSurfaceVariant,
    opacity: 0.6,
    marginBottom: verticalScale(-8),
  },
  detailCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
    padding: scale(16),
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(10),
  },
  detailRowName: {
    fontSize: moderateScale(14),
    color: colors.onSurface,
    fontWeight: '600',
  },
  detailRowValue: {
    fontSize: moderateScale(14),
    color: colors.secondary,
    fontWeight: '800',
  },
  detailRecipe: {
    fontSize: moderateScale(14),
    color: colors.onSurface,
    lineHeight: moderateScale(22),
  },

  // Form
  formScroll: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(40),
  },
  imagePicker: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: moderateScale(16),
    backgroundColor: colors.surfaceContainerHighest,
    overflow: 'hidden',
    marginBottom: verticalScale(20),
    position: 'relative',
  },
  imagePickerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: verticalScale(6),
    borderRadius: moderateScale(16),
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    borderStyle: 'dashed',
  },
  imagePickerText: {
    fontSize: moderateScale(13),
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  imagePreview: { width: '100%', height: '100%' },
  imageEditOverlay: {
    position: 'absolute',
    bottom: scale(10), right: scale(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: colors.primary,
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(999),
  },
  imageEditText: {
    color: colors.onPrimary,
    fontSize: moderateScale(11),
    fontWeight: '700',
  },

  fieldLabel: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.onSurfaceVariant,
    marginBottom: verticalScale(6),
    textTransform: 'uppercase',
  },
  fieldInput: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
    fontSize: moderateScale(14),
    color: colors.onSurface,
    marginBottom: verticalScale(16),
  },
  textArea: {
    minHeight: verticalScale(80),
    textAlignVertical: 'top',
    paddingTop: verticalScale(12),
  },
  fieldRow: { flexDirection: 'row', gap: scale(12) },

  formChipsScroll: { flexGrow: 0, marginBottom: verticalScale(16) },
  formChipsRow: { gap: scale(8), paddingRight: scale(20) },
  formChip: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: moderateScale(999),
  },
  formChipActive: { backgroundColor: colors.primary },
  formChipText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  formChipTextActive: { color: colors.onPrimary },

  formSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: verticalScale(8),
    marginBottom: verticalScale(10),
  },
  formSectionTitle: {
    fontSize: moderateScale(15),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  formSectionSub: {
    fontSize: moderateScale(11),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(2),
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    backgroundColor: colors.secondaryContainer,
    borderRadius: moderateScale(999),
  },
  addRowBtnText: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    color: colors.primary,
  },

  emptyRow: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(12),
    paddingVertical: verticalScale(16),
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  emptyRowText: {
    fontSize: moderateScale(12),
    color: colors.outline,
    fontStyle: 'italic',
  },

  dataRow: {
    flexDirection: 'row',
    gap: scale(8),
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  dataRowNameInput: { flex: 2, marginBottom: 0 },
  dataRowPriceInput: { flex: 1, marginBottom: 0 },
  removeBtn: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ingCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(12),
    padding: scale(12),
    marginBottom: verticalScale(8),
  },
  ingChipsRow: { gap: scale(6), paddingRight: scale(8) },
  ingChip: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: moderateScale(999),
  },
  ingChipActive: { backgroundColor: colors.primary },
  ingChipText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
  },
  ingChipTextActive: { color: colors.onPrimary },
  ingAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginTop: verticalScale(8),
  },
  ingAmountInput: { flex: 1, marginBottom: 0 },
  ingUnit: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    minWidth: scale(34),
    textAlign: 'center',
  },

  formActions: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: verticalScale(24),
  },
  formBtn: {
    flex: 1,
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBtnGhost: { backgroundColor: colors.surfaceContainerHigh },
  formBtnGhostText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: colors.onSurface,
  },
  formBtnPrimary: { backgroundColor: colors.primary },
  formBtnPrimaryText: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: colors.onPrimary,
    letterSpacing: 0.3,
  },
});
