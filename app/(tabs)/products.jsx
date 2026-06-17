import { useState, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Modal, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, ScrollView, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { useProducts } from '../../hooks/useProducts';
import { useIngredients } from '../../hooks/useIngredients';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { colors } from '../../styles/colors';

function stockVariant(stock) {
  if (stock > 10) return 'success';
  if (stock > 4) return 'warning';
  return 'danger';
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
  const { isAdmin } = useAuth();
  const {
    products, categories, loading, error, refetch, addProduct, updateProduct, deleteProduct,
    fetchProductIngredients, saveVariants, saveProductIngredients,
  } = useProducts();
  const { ingredients } = useIngredients();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Detail modal
  const [detailProduct, setDetailProduct] = useState(null);

  // Edit/add modal
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

  // Keep last opened detail product around through Modal close animation
  // to avoid unmounting children mid-animation (Android addViewAt crash).
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

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Hata: {error}</Text>
        </View>
      ) : null}
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Ürün ara..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <Button title="+ Ekle" onPress={openAdd} style={styles.addBtn} />
      </View>

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
            style={[styles.catTab, String(selectedCategory) === String(c.id) && styles.catTabActive]}
            onPress={() => setSelectedCategory(String(c.id))}
          >
            <Text style={[styles.catText, String(selectedCategory) === String(c.id) && styles.catTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          removeClippedSubviews={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
          ListEmptyComponent={<Text style={styles.empty}>Ürün bulunamadı</Text>}
          renderItem={({ item }) => {
            const variants = item.product_variants || [];
            return (
              <TouchableOpacity style={styles.productCard} activeOpacity={0.85} onPress={() => setDetailProduct(item)}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.productImage} />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Text style={styles.productEmoji}>📦</Text>
                  </View>
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                  {item.categories && (
                    <Badge label={item.categories.name} variant="accent" style={styles.catBadge} />
                  )}
                  <Text style={styles.productPrice}>{priceDisplay(item)}</Text>
                  {variants.length > 0 && (
                    <Text style={styles.variantBadge}>{variants.length} varyant</Text>
                  )}
                  <Badge label={`Stok: ${item.stock}`} variant={stockVariant(item.stock)} style={styles.stockBadge} />
                </View>
                <View style={styles.productActions}>
                  <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); openEdit(item); }} style={styles.actionBtn}>
                    <Text style={styles.editText}>Düzenle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); handleDelete(item.id); }} style={styles.actionBtn}>
                    <Text style={styles.deleteText}>Sil</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Product Detail Modal */}
      <Modal visible={!!detailProduct} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} onRequestClose={() => setDetailProduct(null)}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          {detailToShow ? (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={1}>{detailToShow.name}</Text>
                <TouchableOpacity onPress={() => setDetailProduct(null)}>
                  <Text style={styles.closeX}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalBody}>
                {detailToShow.image_url ? (
                  <Image source={{ uri: detailToShow.image_url }} style={styles.detailImage} />
                ) : (
                  <View style={styles.detailImagePlaceholder}>
                    <Text style={{ fontSize: moderateScale(48) }}>📦</Text>
                  </View>
                )}
                {detailToShow.categories && (
                  <View style={styles.detailMeta}>
                    <View style={[styles.catPill, { backgroundColor: detailToShow.categories.color || colors.accent }]}>
                      <Text style={styles.catPillText}>{detailToShow.categories.name}</Text>
                    </View>
                  </View>
                )}
                <Text style={styles.detailPrice}>{priceDisplay(detailToShow)}</Text>
                {(detailToShow.product_variants || []).length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Varyantlar</Text>
                    {(detailToShow.product_variants || []).map((v, i) => (
                      <View key={i} style={styles.detailRow}>
                        <Text style={styles.detailRowName}>{v.name}</Text>
                        <Text style={styles.detailRowValue}>₺{Number(v.price).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {detailToShow.recipe ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Tarif</Text>
                    <Text style={styles.detailRecipe}>{detailToShow.recipe}</Text>
                  </View>
                ) : null}
              </ScrollView>
            </>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editProduct ? 'Ürünü Düzenle' : 'Yeni Ürün'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.fieldLabel}>Ürün Adı</Text>
              <TextInput style={styles.fieldInput} value={formName} onChangeText={setFormName} placeholder="Ürün adı" placeholderTextColor={colors.textMuted} />

              <Text style={styles.fieldLabel}>Fiyat (₺)</Text>
              <TextInput style={styles.fieldInput} value={formPrice} onChangeText={setFormPrice} placeholder="0.00" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />

              <Text style={styles.fieldLabel}>Başlangıç Stoğu</Text>
              <TextInput style={styles.fieldInput} value={formStock} onChangeText={setFormStock} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />

              <Text style={styles.fieldLabel}>Kategori</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: verticalScale(16) }}>
                {categories.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catChip, String(formCategoryId) === String(c.id) && styles.catChipActive]}
                    onPress={() => setFormCategoryId(String(c.id))}
                  >
                    <Text style={[styles.catChipText, String(formCategoryId) === String(c.id) && styles.catChipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Tarif (isteğe bağlı)</Text>
              <TextInput
                style={[styles.fieldInput, { height: verticalScale(72), textAlignVertical: 'top' }]}
                value={formRecipe}
                onChangeText={setFormRecipe}
                placeholder="Hazırlama tarifi..."
                placeholderTextColor={colors.textMuted}
                multiline
              />

              <Text style={styles.fieldLabel}>Görsel</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage} disabled={uploadingImage}>
                {formImageUrl ? (
                  <Image source={{ uri: formImageUrl }} style={styles.imagePreview} />
                ) : (
                  <Text style={styles.imagePickerText}>{uploadingImage ? 'Yükleniyor...' : '📷 Görsel Seç'}</Text>
                )}
              </TouchableOpacity>

              {/* Variants */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Varyantlar</Text>
                <TouchableOpacity onPress={addVariant} style={styles.addRowBtn}>
                  <Text style={styles.addRowBtnText}>+ Ekle</Text>
                </TouchableOpacity>
              </View>
              {formVariants.map((v, idx) => (
                <View key={idx} style={styles.variantRow}>
                  <TextInput
                    style={[styles.fieldInput, styles.variantInput]}
                    value={v.name}
                    onChangeText={val => updateVariant(idx, 'name', val)}
                    placeholder="Varyant adı"
                    placeholderTextColor={colors.textMuted}
                  />
                  <TextInput
                    style={[styles.fieldInput, styles.variantPriceInput]}
                    value={v.price}
                    onChangeText={val => updateVariant(idx, 'price', val)}
                    placeholder="₺"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity onPress={() => removeVariant(idx)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Ingredient recipe */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Malzeme Tarifi</Text>
                <TouchableOpacity onPress={addIngredientRow} style={styles.addRowBtn}>
                  <Text style={styles.addRowBtnText}>+ Ekle</Text>
                </TouchableOpacity>
              </View>
              {formIngredientRows.map((row, idx) => (
                <View key={idx} style={styles.ingRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: verticalScale(6) }}>
                    {ingredients.map(ing => (
                      <TouchableOpacity
                        key={ing.id}
                        style={[styles.ingChip, String(row.ingredient_id) === String(ing.id) && styles.ingChipActive]}
                        onPress={() => updateIngredientRow(idx, 'ingredient_id', String(ing.id))}
                      >
                        <Text style={[styles.ingChipText, String(row.ingredient_id) === String(ing.id) && styles.ingChipTextActive]}>
                          {ing.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={styles.ingAmountRow}>
                    <TextInput
                      style={[styles.fieldInput, styles.ingAmountInput]}
                      value={row.amount_used}
                      onChangeText={val => updateIngredientRow(idx, 'amount_used', val)}
                      placeholder="Miktar"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                    <Text style={styles.ingUnit}>{row.unit || '—'}</Text>
                    <TouchableOpacity onPress={() => removeIngredientRow(idx)} style={styles.removeBtn}>
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={styles.modalActions}>
                <Button title="İptal" variant="secondary" onPress={() => setModalVisible(false)} style={styles.modalBtn} />
                <Button title="Kaydet" onPress={handleSave} loading={saving} style={styles.modalBtn} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPage },
  errorBanner: { backgroundColor: colors.dangerLight, padding: scale(12), borderBottomWidth: 1, borderBottomColor: colors.danger },
  errorText: { color: colors.danger, fontSize: moderateScale(13), fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noAccess: { fontSize: moderateScale(15), color: colors.textMuted },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', padding: scale(12), gap: scale(8),
    backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1, backgroundColor: colors.bgPage, borderWidth: 1, borderColor: colors.border,
    borderRadius: moderateScale(8), paddingHorizontal: scale(12), paddingVertical: verticalScale(8),
    fontSize: moderateScale(14), color: colors.textPrimary,
  },
  addBtn: { paddingHorizontal: scale(16) },
  catScroll: { backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border },
  catBar: { paddingHorizontal: scale(8), paddingVertical: verticalScale(8), gap: scale(8) },
  catTab: {
    paddingHorizontal: scale(14), paddingVertical: verticalScale(6),
    borderRadius: moderateScale(20), backgroundColor: colors.bgPage,
    borderWidth: 1, borderColor: colors.border,
  },
  catTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  catText: { fontSize: moderateScale(13), fontWeight: '600', color: colors.textSecondary },
  catTextActive: { color: '#fff' },
  grid: { padding: scale(12) },
  row: { gap: scale(10), marginBottom: verticalScale(10) },
  productCard: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: moderateScale(10),
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border, elevation: 1,
  },
  productImage: { width: '100%', height: verticalScale(80) },
  productImagePlaceholder: {
    height: verticalScale(80), backgroundColor: colors.bgPage,
    alignItems: 'center', justifyContent: 'center',
  },
  productEmoji: { fontSize: moderateScale(32) },
  productInfo: { padding: scale(10) },
  productName: { fontSize: moderateScale(14), fontWeight: '700', color: colors.textPrimary, marginBottom: verticalScale(4) },
  catBadge: { marginBottom: verticalScale(4) },
  productPrice: { fontSize: moderateScale(16), fontWeight: '800', color: colors.accent, marginBottom: verticalScale(4) },
  variantBadge: {
    fontSize: moderateScale(11), color: colors.textMuted,
    backgroundColor: colors.bgPage, borderRadius: moderateScale(4),
    paddingHorizontal: scale(6), paddingVertical: verticalScale(2),
    alignSelf: 'flex-start', marginBottom: verticalScale(4),
  },
  stockBadge: {},
  productActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn: { flex: 1, paddingVertical: verticalScale(8), alignItems: 'center' },
  editText: { fontSize: moderateScale(12), color: colors.accent, fontWeight: '600' },
  deleteText: { fontSize: moderateScale(12), color: colors.danger, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: moderateScale(15), marginTop: verticalScale(48) },
  // Detail modal
  detailImage: { width: '100%', height: verticalScale(200), borderRadius: moderateScale(8), marginBottom: verticalScale(12) },
  detailImagePlaceholder: {
    height: verticalScale(120), alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgPage, borderRadius: moderateScale(8), marginBottom: verticalScale(12),
  },
  detailMeta: { flexDirection: 'row', marginBottom: verticalScale(8) },
  catPill: { paddingHorizontal: scale(12), paddingVertical: verticalScale(4), borderRadius: moderateScale(20) },
  catPillText: { fontSize: moderateScale(12), color: '#fff', fontWeight: '600' },
  detailPrice: { fontSize: moderateScale(24), fontWeight: '800', color: colors.accent, marginBottom: verticalScale(16) },
  detailSection: { marginBottom: verticalScale(16) },
  detailSectionTitle: { fontSize: moderateScale(14), fontWeight: '700', color: colors.textSecondary, marginBottom: verticalScale(8) },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: verticalScale(6), borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  detailRowName: { fontSize: moderateScale(14), color: colors.textPrimary },
  detailRowValue: { fontSize: moderateScale(14), fontWeight: '600', color: colors.textPrimary },
  detailRecipe: { fontSize: moderateScale(14), color: colors.textSecondary, lineHeight: moderateScale(22) },
  // Add/edit modal
  modalContainer: { flex: 1, backgroundColor: colors.bgCard },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: scale(16), borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: moderateScale(17), fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: scale(8) },
  closeX: { fontSize: moderateScale(18), color: colors.textMuted, padding: scale(4) },
  modalBody: { padding: scale(16) },
  fieldLabel: { fontSize: moderateScale(13), fontWeight: '600', color: colors.textSecondary, marginBottom: verticalScale(6) },
  fieldInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: moderateScale(8),
    paddingHorizontal: scale(12), paddingVertical: verticalScale(10),
    fontSize: moderateScale(15), color: colors.textPrimary, backgroundColor: colors.bgPage,
    marginBottom: verticalScale(16),
  },
  catChip: {
    paddingHorizontal: scale(14), paddingVertical: verticalScale(6),
    borderRadius: moderateScale(20), backgroundColor: colors.bgPage,
    borderWidth: 1, borderColor: colors.border, marginRight: scale(8),
  },
  catChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  catChipText: { fontSize: moderateScale(13), color: colors.textSecondary },
  catChipTextActive: { color: '#fff' },
  imagePicker: {
    height: verticalScale(80), borderWidth: 1, borderColor: colors.border,
    borderRadius: moderateScale(8), borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgPage, marginBottom: verticalScale(16), overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePickerText: { fontSize: moderateScale(14), color: colors.textMuted },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: verticalScale(4), marginBottom: verticalScale(8),
    paddingTop: verticalScale(12), borderTopWidth: 1, borderTopColor: colors.border,
  },
  sectionTitle: { fontSize: moderateScale(14), fontWeight: '700', color: colors.textPrimary },
  addRowBtn: {
    paddingHorizontal: scale(10), paddingVertical: verticalScale(4),
    borderRadius: moderateScale(6), backgroundColor: colors.accentLight,
  },
  addRowBtnText: { fontSize: moderateScale(12), color: colors.accent, fontWeight: '600' },
  variantRow: { flexDirection: 'row', gap: scale(8), alignItems: 'flex-start', marginBottom: verticalScale(4) },
  variantInput: { flex: 2, marginBottom: 0 },
  variantPriceInput: { flex: 1, marginBottom: 0 },
  removeBtn: { paddingHorizontal: scale(8), paddingVertical: verticalScale(10) },
  removeBtnText: { fontSize: moderateScale(14), color: colors.danger },
  ingRow: { marginBottom: verticalScale(8) },
  ingChip: {
    paddingHorizontal: scale(10), paddingVertical: verticalScale(5),
    borderRadius: moderateScale(16), backgroundColor: colors.bgPage,
    borderWidth: 1, borderColor: colors.border, marginRight: scale(6),
  },
  ingChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  ingChipText: { fontSize: moderateScale(12), color: colors.textSecondary },
  ingChipTextActive: { color: '#fff' },
  ingAmountRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  ingAmountInput: { flex: 1, marginBottom: 0 },
  ingUnit: { fontSize: moderateScale(13), color: colors.textMuted, width: scale(40) },
  modalActions: { flexDirection: 'row', gap: scale(12), marginTop: verticalScale(16) },
  modalBtn: { flex: 1 },
});
