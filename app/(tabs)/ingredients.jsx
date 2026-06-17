import { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Modal, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Image, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useIngredients } from '../../hooks/useIngredients';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { colors } from '../../styles/colors';
import { Button } from '../../components/shared/Button';

const UNITS = ['ml', 'L', 'g', 'kg', 'adet', 'dilim', 'çay kaşığı', 'yemek kaşığı'];

function isLow(ing) {
  return ing.min_stock_alert > 0 && ing.stock_amount < ing.min_stock_alert;
}

function formatStock(ing) {
  if (ing.container_name && ing.container_size > 0) {
    const containers = ing.stock_amount / ing.container_size;
    return `${containers % 1 === 0 ? containers : containers.toFixed(1)} ${ing.container_name}`;
  }
  return `${ing.stock_amount} ${ing.unit}`;
}

function formatStockSub(ing) {
  if (ing.container_name && ing.container_size > 0) {
    return `(= ${ing.stock_amount} ${ing.unit})`;
  }
  return null;
}

export default function IngredientsScreen() {
  const { isAdmin } = useAuth();
  const { ingredients, loading, error, addIngredient, updateIngredient, deleteIngredient } = useIngredients();
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUnit, setFormUnit] = useState('g');
  const [formStock, setFormStock] = useState('0');
  const [formMinAlert, setFormMinAlert] = useState('0');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formUseContainer, setFormUseContainer] = useState(false);
  const [formContainerName, setFormContainerName] = useState('');
  const [formContainerSize, setFormContainerSize] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.noAccess}>Bu sayfaya erişim yetkiniz yok.</Text>
      </View>
    );
  }

  const lowCount = ingredients.filter(isLow).length;
  const filtered = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  function openAdd() {
    setEditItem(null);
    setFormName('');
    setFormUnit('g');
    setFormStock('0');
    setFormMinAlert('0');
    setFormImageUrl('');
    setFormUseContainer(false);
    setFormContainerName('');
    setFormContainerSize('');
    setModalVisible(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setFormName(item.name);
    setFormUnit(item.unit);
    setFormStock(String(item.stock_amount));
    setFormMinAlert(String(item.min_stock_alert));
    setFormImageUrl(item.image_url || '');
    const hasContainer = !!(item.container_name && item.container_size > 0);
    setFormUseContainer(hasContainer);
    setFormContainerName(item.container_name || '');
    setFormContainerSize(item.container_size ? String(item.container_size) : '');
    setModalVisible(true);
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin Gerekli', 'Galeri erişim izni gereklidir.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
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
        .from('ingredient-images')
        .upload(filename, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('ingredient-images').getPublicUrl(filename);
      setFormImageUrl(data.publicUrl);
    } catch (e) {
      Alert.alert('Hata', 'Görsel yüklenemedi: ' + e.message);
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSave() {
    if (!formName.trim()) {
      Alert.alert('Hata', 'Malzeme adı zorunludur.');
      return;
    }
    setSaving(true);
    try {
      let stockAmount = parseFloat(formStock) || 0;
      const containerSize = formUseContainer ? (parseFloat(formContainerSize) || 0) : 0;
      if (formUseContainer && containerSize > 0) {
        stockAmount = stockAmount * containerSize;
      }
      const data = {
        name: formName.trim(),
        unit: formUnit,
        stock_amount: stockAmount,
        min_stock_alert: parseFloat(formMinAlert) || 0,
        image_url: formImageUrl || null,
        container_name: formUseContainer ? (formContainerName.trim() || null) : null,
        container_size: formUseContainer ? containerSize : null,
      };
      if (editItem) {
        await updateIngredient(editItem.id, data);
      } else {
        await addIngredient(data);
      }
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Hata', e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id, name) {
    Alert.alert('Malzemeyi Sil', `"${name}" silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try { await deleteIngredient(id); } catch (e) { Alert.alert('Hata', e.message); }
        },
      },
    ]);
  }

  // Live container hint
  const containerStockNum = parseFloat(formStock) || 0;
  const containerSizeNum = parseFloat(formContainerSize) || 0;
  const containerHint = formUseContainer && containerSizeNum > 0
    ? `${containerStockNum} ${formContainerName || 'kap'} × ${containerSizeNum} ${formUnit} = ${containerStockNum * containerSizeNum} ${formUnit} stok`
    : null;

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Hata: {error}</Text>
        </View>
      ) : null}
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Malzeme ara..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {lowCount > 0 && (
          <View style={styles.lowBadge}>
            <Text style={styles.lowBadgeText}>{lowCount} Az</Text>
          </View>
        )}
        <Button title="+ Ekle" onPress={openAdd} style={styles.addBtn} />
      </View>

      {loading ? (
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
          ListEmptyComponent={<Text style={styles.empty}>Malzeme bulunamadı</Text>}
          renderItem={({ item }) => {
            const low = isLow(item);
            return (
              <View style={[styles.card, low && styles.cardLow]}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.cardImage} />
                ) : (
                  <View style={styles.cardImagePlaceholder}>
                    <Text style={styles.cardEmoji}>🧪</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.cardUnit}>{item.unit}</Text>
                  <Text style={[styles.cardStock, low && styles.cardStockLow]}>
                    {formatStock(item)}
                  </Text>
                  {formatStockSub(item) && (
                    <Text style={styles.cardStockSub}>{formatStockSub(item)}</Text>
                  )}
                  <Text style={[styles.cardMin, low && styles.cardMinLow]}>
                    Min: {item.min_stock_alert} {item.unit}
                  </Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
                    <Text style={styles.editText}>Düzenle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.actionBtn}>
                    <Text style={styles.deleteText}>Sil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Ingredient Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editItem ? 'Malzemeyi Düzenle' : 'Yeni Malzeme'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Name */}
              <Text style={styles.fieldLabel}>İsim</Text>
              <TextInput
                style={styles.fieldInput}
                value={formName}
                onChangeText={setFormName}
                placeholder="Malzeme adı"
                placeholderTextColor={colors.textMuted}
              />

              {/* Unit */}
              <Text style={styles.fieldLabel}>Birim</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroll}>
                {UNITS.map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitChip, formUnit === u && styles.unitChipActive]}
                    onPress={() => setFormUnit(u)}
                  >
                    <Text style={[styles.unitChipText, formUnit === u && styles.unitChipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Container toggle */}
              <View style={styles.containerToggleRow}>
                <Text style={styles.fieldLabel}>Kap Sistemi</Text>
                <Switch
                  value={formUseContainer}
                  onValueChange={setFormUseContainer}
                  trackColor={{ true: colors.accent, false: colors.border }}
                  thumbColor="#fff"
                />
              </View>

              {formUseContainer && (
                <View style={styles.containerFields}>
                  <Text style={styles.fieldLabel}>Kap Adı (örn: şişe, paket)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={formContainerName}
                    onChangeText={setFormContainerName}
                    placeholder="şişe"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={styles.fieldLabel}>Kap Boyutu ({formUnit})</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={formContainerSize}
                    onChangeText={setFormContainerSize}
                    placeholder="700"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                  {containerHint && (
                    <View style={styles.hintBox}>
                      <Text style={styles.hintText}>📦 {containerHint}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Stock */}
              <Text style={styles.fieldLabel}>
                Mevcut Stok ({formUseContainer && formContainerName ? formContainerName : formUnit})
              </Text>
              <TextInput
                style={styles.fieldInput}
                value={formStock}
                onChangeText={setFormStock}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />

              {/* Min alert */}
              <Text style={styles.fieldLabel}>Min. Stok Uyarısı ({formUnit})</Text>
              <TextInput
                style={styles.fieldInput}
                value={formMinAlert}
                onChangeText={setFormMinAlert}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />

              {/* Image */}
              <Text style={styles.fieldLabel}>Görsel</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage} disabled={uploadingImage}>
                {formImageUrl ? (
                  <Image source={{ uri: formImageUrl }} style={styles.imagePreview} />
                ) : (
                  <Text style={styles.imagePickerText}>
                    {uploadingImage ? 'Yükleniyor...' : '📷 Görsel Seç'}
                  </Text>
                )}
              </TouchableOpacity>

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
  lowBadge: {
    backgroundColor: colors.dangerLight, paddingHorizontal: scale(8), paddingVertical: verticalScale(4),
    borderRadius: moderateScale(12),
  },
  lowBadgeText: { fontSize: moderateScale(12), fontWeight: '700', color: colors.danger },
  addBtn: { paddingHorizontal: scale(16) },
  grid: { padding: scale(12) },
  row: { gap: scale(10), marginBottom: verticalScale(10) },
  card: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: moderateScale(10),
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border, elevation: 1,
  },
  cardLow: { borderColor: colors.danger, borderWidth: 1.5 },
  cardImage: { width: '100%', height: verticalScale(80) },
  cardImagePlaceholder: {
    width: '100%', height: verticalScale(80), backgroundColor: colors.bgPage,
    alignItems: 'center', justifyContent: 'center',
  },
  cardEmoji: { fontSize: moderateScale(32) },
  cardBody: { padding: scale(10) },
  cardName: { fontSize: moderateScale(14), fontWeight: '700', color: colors.textPrimary, marginBottom: verticalScale(2) },
  cardUnit: { fontSize: moderateScale(11), color: colors.textMuted, marginBottom: verticalScale(4) },
  cardStock: { fontSize: moderateScale(13), fontWeight: '600', color: colors.textSecondary },
  cardStockLow: { color: colors.danger },
  cardStockSub: { fontSize: moderateScale(11), color: colors.textMuted },
  cardMin: { fontSize: moderateScale(11), color: colors.textMuted, marginTop: verticalScale(2) },
  cardMinLow: { color: colors.danger },
  cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn: { flex: 1, paddingVertical: verticalScale(8), alignItems: 'center' },
  editText: { fontSize: moderateScale(12), color: colors.accent, fontWeight: '600' },
  deleteText: { fontSize: moderateScale(12), color: colors.danger, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.textMuted, fontSize: moderateScale(15), marginTop: verticalScale(48) },
  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.bgCard },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: scale(16), borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: moderateScale(17), fontWeight: '700', color: colors.textPrimary },
  closeX: { fontSize: moderateScale(18), color: colors.textMuted, padding: scale(4) },
  modalBody: { padding: scale(16) },
  fieldLabel: {
    fontSize: moderateScale(13), fontWeight: '600', color: colors.textSecondary,
    marginBottom: verticalScale(6), marginTop: verticalScale(4),
  },
  fieldInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: moderateScale(8),
    paddingHorizontal: scale(12), paddingVertical: verticalScale(10),
    fontSize: moderateScale(15), color: colors.textPrimary, backgroundColor: colors.bgPage,
    marginBottom: verticalScale(12),
  },
  unitScroll: { marginBottom: verticalScale(12) },
  unitChip: {
    paddingHorizontal: scale(12), paddingVertical: verticalScale(6),
    borderRadius: moderateScale(20), backgroundColor: colors.bgPage,
    borderWidth: 1, borderColor: colors.border, marginRight: scale(8),
  },
  unitChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  unitChipText: { fontSize: moderateScale(13), color: colors.textSecondary },
  unitChipTextActive: { color: '#fff' },
  containerToggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  containerFields: {
    backgroundColor: colors.bgPage, borderRadius: moderateScale(8),
    padding: scale(12), marginBottom: verticalScale(12),
  },
  hintBox: {
    backgroundColor: colors.accentLight, borderRadius: moderateScale(6),
    padding: scale(10), marginBottom: verticalScale(8),
  },
  hintText: { fontSize: moderateScale(12), color: colors.accent, fontWeight: '600' },
  imagePicker: {
    height: verticalScale(80), borderWidth: 1, borderColor: colors.border,
    borderRadius: moderateScale(8), borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bgPage, marginBottom: verticalScale(16),
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePickerText: { fontSize: moderateScale(14), color: colors.textMuted },
  modalActions: { flexDirection: 'row', gap: scale(12), marginTop: verticalScale(8) },
  modalBtn: { flex: 1 },
});
