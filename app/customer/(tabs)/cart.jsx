import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
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
import { useCart } from '../../../hooks/useCart';
import { useAddresses, useCustomerOrders } from '../../../hooks/useCustomer';
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

function AddressModal({ visible, onClose, onSaved }) {
  const { addAddress } = useAddresses();
  const [label, setLabel] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!label.trim() || !fullAddress.trim()) {
      Alert.alert('Eksik bilgi', 'Etiket ve adres gereklidir.');
      return;
    }
    setSaving(true);
    try {
      await addAddress({
        label: label.trim(),
        full_address: fullAddress.trim(),
        notes: notes.trim() || null,
        is_default: true,
      });
      setLabel('');
      setFullAddress('');
      setNotes('');
      onSaved?.();
      onClose();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Adres kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={{ padding: scale(20) }}>
            <Text style={styles.modalTitle}>Yeni Adres</Text>

            <Text style={styles.label}>ETİKET</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Ev, İş, ..."
              placeholderTextColor={colors.outline}
            />

            <Text style={[styles.label, { marginTop: verticalScale(14) }]}>AÇIK ADRES</Text>
            <TextInput
              style={[styles.input, { height: verticalScale(80), textAlignVertical: 'top' }]}
              value={fullAddress}
              onChangeText={setFullAddress}
              placeholder="Mahalle, sokak, bina no..."
              placeholderTextColor={colors.outline}
              multiline
            />

            <Text style={[styles.label, { marginTop: verticalScale(14) }]}>NOT (OPSİYONEL)</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Kapı kodu, kat, vs."
              placeholderTextColor={colors.outline}
            />

            <PressScale
              style={[styles.primaryBtn, { marginTop: verticalScale(20) }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.primaryText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
            </PressScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function CustomerCart() {
  const { items, updateQty, removeItem, clear, totals, itemKey } = useCart();
  const { addresses, refetch: refetchAddresses } = useAddresses();
  const { placeOrder } = useCustomerOrders();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [orderType, setOrderType] = useState('takeaway');
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [note, setNote] = useState('');
  const [addressModal, setAddressModal] = useState(false);
  const [placing, setPlacing] = useState(false);

  const defaultAddr = addresses.find((a) => a.is_default) || addresses[0];
  const effectiveAddress = selectedAddress || defaultAddr;

  async function handlePlace() {
    if (items.length === 0) return;
    if (orderType === 'delivery' && !effectiveAddress) {
      Alert.alert('Adres gerekli', 'Eve teslim için bir adres seçmelisiniz.');
      return;
    }
    setPlacing(true);
    try {
      await placeOrder({
        items,
        order_type: orderType,
        delivery_address_id: orderType === 'delivery' ? effectiveAddress?.id : null,
        customer_note: note.trim() || null,
      });
      clear();
      setNote('');
      Alert.alert('Sipariş alındı', 'Siparişiniz mutfağa iletildi. Teşekkür ederiz!', [
        { text: 'Tamam', onPress: () => router.push('/customer/(tabs)/orders') },
      ]);
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Sipariş gönderilemedi.');
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Sepet</Text>
        </View>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bag-outline" size={moderateScale(36)} color={colors.outline} />
          </View>
          <Text style={styles.emptyTitle}>Sepetin boş</Text>
          <Text style={styles.emptyDesc}>Menüden lezzetler eklemeye başla.</Text>
          <PressScale
            style={[styles.primaryBtn, { marginTop: verticalScale(24), paddingHorizontal: scale(28) }]}
            onPress={() => router.push('/customer/(tabs)')}
          >
            <Text style={styles.primaryText}>Menüyü Keşfet</Text>
          </PressScale>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: verticalScale(220) + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Sepet</Text>
          <Pressable
            onPress={() =>
              Alert.alert('Sepeti boşalt', 'Tüm ürünleri kaldırmak istiyor musun?', [
                { text: 'İptal', style: 'cancel' },
                { text: 'Boşalt', style: 'destructive', onPress: clear },
              ])
            }
            hitSlop={8}
          >
            <Text style={styles.clearLink}>Boşalt</Text>
          </Pressable>
        </View>

        <View style={styles.itemsWrap}>
          {items.map((it) => {
            const key = itemKey(it);
            return (
              <View key={key} style={styles.itemRow}>
                {it.product_image ? (
                  <Image source={{ uri: it.product_image }} style={styles.itemImg} />
                ) : (
                  <View style={[styles.itemImg, styles.itemImgPlaceholder]}>
                    <Ionicons name="leaf-outline" size={moderateScale(18)} color={colors.outline} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>{it.product_name}</Text>
                  {it.variant_name ? (
                    <Text style={styles.itemVariant}>{it.variant_name}</Text>
                  ) : null}
                  <Text style={styles.itemPrice}>₺{(it.unit_price * it.quantity).toFixed(2)}</Text>
                </View>
                <View style={styles.qtyControls}>
                  <PressScale
                    style={styles.qtyBtnSm}
                    onPress={() => updateQty(key, it.quantity - 1)}
                  >
                    <Ionicons name="remove" size={moderateScale(14)} color={colors.primary} />
                  </PressScale>
                  <Text style={styles.qtyValueSm}>{it.quantity}</Text>
                  <PressScale
                    style={styles.qtyBtnSm}
                    onPress={() => updateQty(key, it.quantity + 1)}
                  >
                    <Ionicons name="add" size={moderateScale(14)} color={colors.primary} />
                  </PressScale>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TESLİMAT</Text>
          <View style={styles.typeRow}>
            <PressScale
              style={[styles.typeChip, orderType === 'takeaway' && styles.typeChipActive]}
              onPress={() => setOrderType('takeaway')}
            >
              <Ionicons
                name="walk"
                size={moderateScale(18)}
                color={orderType === 'takeaway' ? colors.surface : colors.primary}
              />
              <Text style={[styles.typeText, orderType === 'takeaway' && styles.typeTextActive]}>
                Gel-Al
              </Text>
            </PressScale>
            <PressScale
              style={[styles.typeChip, orderType === 'delivery' && styles.typeChipActive]}
              onPress={() => setOrderType('delivery')}
            >
              <Ionicons
                name="bicycle"
                size={moderateScale(18)}
                color={orderType === 'delivery' ? colors.surface : colors.primary}
              />
              <Text style={[styles.typeText, orderType === 'delivery' && styles.typeTextActive]}>
                Eve Teslim
              </Text>
            </PressScale>
          </View>
        </View>

        {orderType === 'delivery' ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>ADRES</Text>
              <Pressable onPress={() => setAddressModal(true)} hitSlop={6}>
                <Text style={styles.linkText}>+ Yeni</Text>
              </Pressable>
            </View>
            {addresses.length === 0 ? (
              <PressScale style={styles.emptyAddress} onPress={() => setAddressModal(true)}>
                <Ionicons name="location-outline" size={moderateScale(20)} color={colors.primary} />
                <Text style={styles.emptyAddressText}>Bir adres ekle</Text>
              </PressScale>
            ) : (
              <View style={{ gap: verticalScale(8) }}>
                {addresses.map((addr) => {
                  const active = (selectedAddress?.id || defaultAddr?.id) === addr.id;
                  return (
                    <PressScale
                      key={addr.id}
                      style={[styles.addrRow, active && styles.addrRowActive]}
                      onPress={() => setSelectedAddress(addr)}
                    >
                      <View
                        style={[styles.radio, active && styles.radioActive]}
                      >
                        {active ? <View style={styles.radioDot} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.addrLabel}>{addr.label}</Text>
                        <Text style={styles.addrText} numberOfLines={2}>
                          {addr.full_address}
                        </Text>
                      </View>
                    </PressScale>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOT</Text>
          <TextInput
            style={[styles.input, { height: verticalScale(70), textAlignVertical: 'top' }]}
            value={note}
            onChangeText={setNote}
            placeholder="Acı az olsun, şekersiz vs."
            placeholderTextColor={colors.outline}
            multiline
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.primaryContainer, padding: scale(18), borderRadius: moderateScale(16), marginHorizontal: scale(20) }]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ara Toplam</Text>
            <Text style={styles.summaryValue}>₺{totals.subtotal.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: verticalScale(8) }]}>
            <Text style={styles.summaryTotalLabel}>Toplam</Text>
            <Text style={styles.summaryTotal}>₺{totals.subtotal.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            bottom:
              verticalScale(60) +
              (Platform.OS === 'ios' ? insets.bottom : verticalScale(8)),
          },
        ]}
      >
        <PressScale
          style={styles.placeBtn}
          onPress={handlePlace}
          disabled={placing}
        >
          <Ionicons name="checkmark-circle" size={moderateScale(20)} color={colors.surface} />
          <Text style={styles.placeText}>
            {placing ? 'Gönderiliyor...' : `Siparişi Ver · ₺${totals.subtotal.toFixed(2)}`}
          </Text>
        </PressScale>
      </View>

      <AddressModal
        visible={addressModal}
        onClose={() => setAddressModal(false)}
        onSaved={refetchAddresses}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerRow: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(14),
    paddingBottom: verticalScale(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  clearLink: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: colors.error,
  },

  itemsWrap: {
    paddingHorizontal: scale(20),
    gap: verticalScale(10),
    marginTop: verticalScale(4),
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
    padding: scale(10),
  },
  itemImg: {
    width: scale(54),
    height: scale(54),
    borderRadius: moderateScale(10),
    backgroundColor: colors.surfaceContainerHigh,
  },
  itemImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: moderateScale(14), fontWeight: '700', color: colors.primary },
  itemVariant: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(2),
  },
  itemPrice: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: colors.secondary,
    marginTop: verticalScale(4),
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: moderateScale(20),
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(4),
  },
  qtyBtnSm: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValueSm: {
    minWidth: scale(20),
    textAlign: 'center',
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: colors.primary,
  },

  section: {
    paddingHorizontal: scale(20),
    marginTop: verticalScale(22),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  sectionLabel: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: scale(2),
    marginBottom: verticalScale(10),
  },
  linkText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: colors.secondary,
  },

  typeRow: { flexDirection: 'row', gap: scale(10) },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(14),
    backgroundColor: colors.surfaceContainerLow,
  },
  typeChipActive: { backgroundColor: colors.primary },
  typeText: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: colors.primary,
  },
  typeTextActive: { color: colors.surface },

  emptyAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(14),
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
    justifyContent: 'center',
  },
  emptyAddressText: { fontSize: moderateScale(13), fontWeight: '700', color: colors.primary },

  addrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(12),
    padding: scale(14),
    borderRadius: moderateScale(14),
    backgroundColor: colors.surfaceContainerLow,
  },
  addrRowActive: { backgroundColor: colors.secondaryContainer },
  addrLabel: { fontSize: moderateScale(13), fontWeight: '800', color: colors.primary },
  addrText: {
    fontSize: moderateScale(12),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(2),
    lineHeight: moderateScale(18),
  },
  radio: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(2),
  },
  radioActive: { borderColor: colors.primary },
  radioDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    backgroundColor: colors.primary,
  },

  label: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: scale(2),
    marginBottom: verticalScale(8),
  },
  input: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
    fontSize: moderateScale(14),
    color: colors.onSurface,
  },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: {
    fontSize: moderateScale(12),
    color: colors.onPrimaryContainer,
    opacity: 0.7,
  },
  summaryValue: { fontSize: moderateScale(13), fontWeight: '700', color: colors.surface },
  summaryTotalLabel: { fontSize: moderateScale(13), fontWeight: '700', color: colors.surface },
  summaryTotal: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: colors.onPrimaryContainer,
  },

  bottomBar: {
    position: 'absolute',
    left: scale(12),
    right: scale(12),
    backgroundColor: 'rgba(249,250,242,0.98)',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(18),
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  placeBtn: {
    backgroundColor: colors.primary,
    borderRadius: moderateScale(14),
    paddingVertical: verticalScale(15),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
  },
  placeText: {
    color: colors.surface,
    fontSize: moderateScale(15),
    fontWeight: '700',
  },

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: moderateScale(14),
    paddingVertical: verticalScale(13),
    paddingHorizontal: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: colors.surface,
    fontSize: moderateScale(14),
    fontWeight: '700',
    letterSpacing: scale(0.3),
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(40),
  },
  emptyIcon: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(18),
  },
  emptyTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: colors.primary,
    marginBottom: verticalScale(6),
  },
  emptyDesc: {
    fontSize: moderateScale(13),
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,26,15,0.45)' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: moderateScale(28),
    borderTopRightRadius: moderateScale(28),
    overflow: 'hidden',
  },
  modalHandle: {
    alignSelf: 'center',
    width: scale(40),
    height: verticalScale(4),
    borderRadius: scale(2),
    backgroundColor: colors.outlineVariant,
    marginTop: verticalScale(8),
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: colors.primary,
    marginBottom: verticalScale(18),
  },
});
