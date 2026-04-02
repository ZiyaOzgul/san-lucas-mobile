import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, StyleSheet, ActivityIndicator, Alert, RefreshControl, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useRouter } from 'expo-router';
import { Badge } from '../../components/shared/Badge';
import { Button } from '../../components/shared/Button';
import { useProducts } from '../../hooks/useProducts';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../styles/colors';

function stockVariant(stock) {
  if (stock > 10) return 'success';
  if (stock > 4) return 'warning';
  return 'danger';
}

export default function ProductsScreen() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { products, categories, loading, refetch, addProduct, updateProduct, deleteProduct } = useProducts();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.noAccess}>Bu sayfaya erişim yetkiniz yok.</Text>
      </View>
    );
  }

  const filtered = products.filter(p => {
    const matchCat = selectedCategory === 'all' || String(p.category_id) === String(selectedCategory);
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function openAdd() {
    setEditProduct(null);
    setFormName('');
    setFormPrice('');
    setFormStock('0');
    setFormCategoryId(categories[0]?.id ? String(categories[0].id) : '');
    setModalVisible(true);
  }

  function openEdit(product) {
    setEditProduct(product);
    setFormName(product.name);
    setFormPrice(String(product.price));
    setFormStock(String(product.stock));
    setFormCategoryId(String(product.category_id));
    setModalVisible(true);
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
      };
      if (editProduct) {
        await updateProduct(editProduct.id, data);
      } else {
        await addProduct(data);
      }
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
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(id);
          } catch (e) {
            Alert.alert('Hata', e.message);
          }
        },
      },
    ]);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
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
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <View style={styles.productCard}>
              <View style={styles.productImagePlaceholder}>
                <Text style={styles.productEmoji}>📦</Text>
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                {item.categories && (
                  <Badge label={item.categories.name} variant="accent" style={styles.catBadge} />
                )}
                <Text style={styles.productPrice}>₺{Number(item.price).toFixed(2)}</Text>
                <Badge
                  label={`Stok: ${item.stock}`}
                  variant={stockVariant(item.stock)}
                  style={styles.stockBadge}
                />
              </View>
              <View style={styles.productActions}>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
                  <Text style={styles.editText}>Düzenle</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                  <Text style={styles.deleteText}>Sil</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Ürün bulunamadı</Text>
          }
        />
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noAccess: { fontSize: moderateScale(15), color: colors.textMuted },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(12),
    gap: scale(8),
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.bgPage,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    fontSize: moderateScale(14),
    color: colors.textPrimary,
  },
  addBtn: { paddingHorizontal: scale(16) },
  catScroll: { backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border },
  catBar: { paddingHorizontal: scale(8), paddingVertical: verticalScale(8), gap: scale(8) },
  catTab: {
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(20),
    backgroundColor: colors.bgPage,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  catText: { fontSize: moderateScale(13), fontWeight: '600', color: colors.textSecondary },
  catTextActive: { color: '#fff' },
  grid: { padding: scale(12) },
  row: { gap: scale(10), marginBottom: verticalScale(10) },
  productCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: moderateScale(10),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
  },
  productImagePlaceholder: {
    height: verticalScale(80),
    backgroundColor: colors.bgPage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productEmoji: { fontSize: moderateScale(32) },
  productInfo: { padding: scale(10) },
  productName: { fontSize: moderateScale(14), fontWeight: '700', color: colors.textPrimary, marginBottom: verticalScale(4) },
  catBadge: { marginBottom: verticalScale(4) },
  productPrice: { fontSize: moderateScale(16), fontWeight: '800', color: colors.accent, marginBottom: verticalScale(4) },
  stockBadge: {},
  productActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: { flex: 1, paddingVertical: verticalScale(8), alignItems: 'center' },
  editText: { fontSize: moderateScale(12), color: colors.accent, fontWeight: '600' },
  deleteText: { fontSize: moderateScale(12), color: colors.danger, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: moderateScale(15), marginTop: verticalScale(48) },
  modalContainer: { flex: 1, backgroundColor: colors.bgCard },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: scale(16), borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: moderateScale(17), fontWeight: '700', color: colors.textPrimary },
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
  modalActions: { flexDirection: 'row', gap: scale(12), marginTop: verticalScale(8) },
  modalBtn: { flex: 1 },
});
