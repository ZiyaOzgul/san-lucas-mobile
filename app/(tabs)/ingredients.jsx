import { useState, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Modal, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Image, Switch, KeyboardAvoidingView,
  Platform, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useIngredients } from '../../hooks/useIngredients';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { colors } from '../../styles/colors';

const UNITS = ['ml', 'L', 'g', 'kg', 'adet', 'dilim', 'çay kaşığı', 'yemek kaşığı'];

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

function isLow(ing) {
  return ing.min_stock_alert > 0 && ing.stock_amount < ing.min_stock_alert;
}

function formatStock(ing) {
  if (ing.container_name && ing.container_size > 0) {
    const containers = ing.stock_amount / ing.container_size;
    return `${containers % 1 === 0 ? containers : containers.toFixed(1)} ${ing.container_name}`;
  }
  const v = Number(ing.stock_amount);
  return `${v % 1 === 0 ? v : v.toFixed(1)} ${ing.unit}`;
}

function formatStockSub(ing) {
  if (ing.container_name && ing.container_size > 0) {
    return `${ing.stock_amount} ${ing.unit}`;
  }
  return null;
}

export default function IngredientsScreen() {
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const { ingredients, loading, error, addIngredient, updateIngredient, deleteIngredient } = useIngredients();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);

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
  const filtered = useMemo(
    () => ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase())),
    [ingredients, search]
  );

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
    const hasContainer = !!(item.container_name && item.container_size > 0);
    setFormUseContainer(hasContainer);
    setFormContainerName(item.container_name || '');
    setFormContainerSize(item.container_size ? String(item.container_size) : '');
    setFormStock(hasContainer
      ? String(item.stock_amount / item.container_size)
      : String(item.stock_amount));
    setFormMinAlert(String(item.min_stock_alert));
    setFormImageUrl(item.image_url || '');
    setModalVisible(true);
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('İzin Gerekli', 'Galeri erişim izni gereklidir.'); return; }
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

  const containerStockNum = parseFloat(formStock) || 0;
  const containerSizeNum = parseFloat(formContainerSize) || 0;
  const containerHint = formUseContainer && containerSizeNum > 0
    ? `${containerStockNum} ${formContainerName || 'kap'} × ${containerSizeNum} ${formUnit} = ${containerStockNum * containerSizeNum} ${formUnit}`
    : null;

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        contentContainerStyle={[styles.grid, { paddingTop: insets.top + verticalScale(16) }]}
        columnWrapperStyle={styles.row}
        removeClippedSubviews={false}
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
                <Text style={styles.headerTitle}>Malzemeler</Text>
                <View style={[styles.countChip, lowCount > 0 && styles.countChipAlert]}>
                  <Text style={[styles.countChipText, lowCount > 0 && styles.countChipTextAlert]}>
                    {lowCount > 0 ? `${lowCount} Az` : ingredients.length}
                  </Text>
                </View>
              </View>
              <Text style={styles.headerSubtitle}>
                Stok seviyelerini takip edin, kap sistemi ile büyük ambalajları yönetin.
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>TOPLAM</Text>
                <Text style={styles.statValue}>{ingredients.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>AZ KALAN</Text>
                <Text style={[styles.statValue, lowCount > 0 && { color: colors.error }]}>{lowCount}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>SAĞLIKLI</Text>
                <Text style={styles.statValue}>{ingredients.length - lowCount}</Text>
              </View>
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={moderateScale(18)} color={colors.onSurfaceVariant} style={{ opacity: 0.5 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Malzeme ara..."
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
          </>
        }
        ListEmptyComponent={
          loading && !refreshing ? (
            <View style={styles.centerPad}><ActivityIndicator color={colors.primary} size="large" /></View>
          ) : (
            <View style={styles.emptyWrap}>
              <Ionicons name="flask-outline" size={moderateScale(40)} color={colors.outline} style={{ opacity: 0.4 }} />
              <Text style={styles.empty}>Malzeme bulunamadı</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const low = isLow(item);
          const sub = formatStockSub(item);
          return (
            <View style={styles.cardWrapper}>
              <PressScale style={styles.card} onPress={() => openEdit(item)} scaleTo={0.97}>
                <View style={styles.cardImageWrap}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.cardImage} />
                  ) : (
                    <View style={styles.cardImagePlaceholder}>
                      <Ionicons name="flask-outline" size={moderateScale(28)} color={colors.outline} style={{ opacity: 0.5 }} />
                    </View>
                  )}
                  {low && (
                    <View style={styles.lowPill}>
                      <Ionicons name="warning" size={moderateScale(10)} color={colors.onErrorContainer} />
                      <Text style={styles.lowPillText}>AZ</Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.cardUnit}>{item.container_name || item.unit}</Text>

                  <View style={styles.stockBlock}>
                    <Text style={[styles.cardStock, low && styles.cardStockLow]}>
                      {formatStock(item)}
                    </Text>
                    {sub && <Text style={styles.cardStockSub}>{sub}</Text>}
                  </View>

                  {item.min_stock_alert > 0 && (
                    <View style={styles.minRow}>
                      <Ionicons name="alert-circle-outline" size={moderateScale(11)} color={low ? colors.error : colors.outline} />
                      <Text style={[styles.cardMin, low && styles.cardMinLow]}>
                        Min: {item.min_stock_alert} {item.unit}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardActions}>
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
                    onPress={(e) => { e.stopPropagation?.(); handleDelete(item.id, item.name); }}
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
                <Text style={styles.detailTitle}>{editItem ? 'Malzemeyi Düzenle' : 'Yeni Malzeme'}</Text>
                <Text style={styles.detailSub}>
                  {editItem ? 'Stok ve detayları güncelleyin' : 'Yeni malzeme ekleyin'}
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

              <Text style={styles.fieldLabel}>İsim</Text>
              <TextInput
                style={styles.fieldInput}
                value={formName}
                onChangeText={setFormName}
                placeholder="Örn. Süt"
                placeholderTextColor={colors.outline}
              />

              <Text style={styles.fieldLabel}>Birim</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.formChipsRow}
                style={styles.formChipsScroll}
              >
                {UNITS.map(u => {
                  const active = formUnit === u;
                  return (
                    <PressScale
                      key={u}
                      style={[styles.formChip, active && styles.formChipActive]}
                      onPress={() => setFormUnit(u)}
                      scaleTo={0.94}
                    >
                      <Text style={[styles.formChipText, active && styles.formChipTextActive]}>{u}</Text>
                    </PressScale>
                  );
                })}
              </ScrollView>

              {/* Container toggle */}
              <View style={styles.toggleCard}>
                <View style={styles.toggleHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>Kap Sistemi</Text>
                    <Text style={styles.toggleSub}>
                      Şişe / paket gibi sabit boyutlu ambalajlar için
                    </Text>
                  </View>
                  <Switch
                    value={formUseContainer}
                    onValueChange={setFormUseContainer}
                    trackColor={{ true: colors.primary, false: colors.surfaceContainerHigh }}
                    thumbColor={colors.surface}
                    ios_backgroundColor={colors.surfaceContainerHigh}
                  />
                </View>

                {formUseContainer && (
                  <View style={styles.containerFields}>
                    <View style={styles.fieldRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Kap Adı</Text>
                        <TextInput
                          style={styles.fieldInputAlt}
                          value={formContainerName}
                          onChangeText={setFormContainerName}
                          placeholder="şişe"
                          placeholderTextColor={colors.outline}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Boyut ({formUnit})</Text>
                        <TextInput
                          style={styles.fieldInputAlt}
                          value={formContainerSize}
                          onChangeText={setFormContainerSize}
                          placeholder="700"
                          placeholderTextColor={colors.outline}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                    {containerHint && (
                      <View style={styles.hintBox}>
                        <Ionicons name="cube-outline" size={moderateScale(14)} color={colors.onPrimaryContainer} />
                        <Text style={styles.hintText}>{containerHint}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>
                    Stok ({formUseContainer && formContainerName ? formContainerName : formUnit})
                  </Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={formStock}
                    onChangeText={setFormStock}
                    placeholder="0"
                    placeholderTextColor={colors.outline}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Min. Uyarı ({formUnit})</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={formMinAlert}
                    onChangeText={setFormMinAlert}
                    placeholder="0"
                    placeholderTextColor={colors.outline}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

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
  countChipAlert: { backgroundColor: colors.errorContainer },
  countChipText: {
    color: colors.secondary,
    fontSize: moderateScale(11),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countChipTextAlert: { color: colors.onErrorContainer },
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

  // Card
  card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(16),
    overflow: 'hidden',
  },
  cardImageWrap: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceContainerHigh,
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  lowPill: {
    position: 'absolute',
    top: scale(8), right: scale(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    paddingHorizontal: scale(7),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(999),
    backgroundColor: colors.errorContainer,
  },
  lowPillText: {
    fontSize: moderateScale(9),
    fontWeight: '800',
    color: colors.onErrorContainer,
    letterSpacing: 0.5,
  },

  cardBody: { padding: scale(12), paddingBottom: verticalScale(8) },
  cardName: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.2,
    lineHeight: moderateScale(17),
    minHeight: moderateScale(34),
  },
  cardUnit: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginTop: verticalScale(2),
  },
  stockBlock: { marginTop: verticalScale(6) },
  cardStock: {
    fontSize: moderateScale(15),
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: -0.2,
  },
  cardStockLow: { color: colors.error },
  cardStockSub: {
    fontSize: moderateScale(10),
    color: colors.outline,
    marginTop: verticalScale(1),
  },
  minRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    marginTop: verticalScale(6),
  },
  cardMin: { fontSize: moderateScale(10), color: colors.outline },
  cardMinLow: { color: colors.error, fontWeight: '700' },

  cardActions: {
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

  // Modal
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
  fieldInputAlt: {
    backgroundColor: colors.surface,
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    fontSize: moderateScale(13),
    color: colors.onSurface,
    marginBottom: verticalScale(12),
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

  // Container toggle card
  toggleCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
    padding: scale(14),
    marginBottom: verticalScale(16),
  },
  toggleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  toggleTitle: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  toggleSub: {
    fontSize: moderateScale(11),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(2),
    lineHeight: moderateScale(15),
  },
  containerFields: {
    marginTop: verticalScale(12),
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: colors.primaryContainer,
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
  },
  hintText: {
    fontSize: moderateScale(12),
    color: colors.onPrimaryContainer,
    fontWeight: '700',
    flex: 1,
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
