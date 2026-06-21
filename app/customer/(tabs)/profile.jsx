import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
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
import { useAddresses } from '../../../hooks/useCustomer';
import { signOut } from '../../../lib/auth';
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

function AddressFormModal({ visible, onClose, onSaved }) {
  const { addAddress } = useAddresses();
  const [label, setLabel] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!label.trim() || !fullAddress.trim()) {
      Alert.alert('Eksik', 'Etiket ve adres gereklidir.');
      return;
    }
    setSaving(true);
    try {
      await addAddress({
        label: label.trim(),
        full_address: fullAddress.trim(),
        notes: notes.trim() || null,
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
              placeholder="Ev, İş..."
              placeholderTextColor={colors.outline}
            />

            <Text style={[styles.label, { marginTop: verticalScale(14) }]}>AÇIK ADRES</Text>
            <TextInput
              style={[styles.input, { height: verticalScale(80), textAlignVertical: 'top' }]}
              value={fullAddress}
              onChangeText={setFullAddress}
              placeholder="Mahalle, sokak..."
              placeholderTextColor={colors.outline}
              multiline
            />

            <Text style={[styles.label, { marginTop: verticalScale(14) }]}>NOT</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Kat, kapı kodu..."
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

export default function CustomerProfile() {
  const { user, profile } = useAuth();
  const { addresses, deleteAddress, setDefault, refetch } = useAddresses();
  const { clear: clearCart } = useCart();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [addrModal, setAddrModal] = useState(false);

  const initial = (profile?.full_name || 'M').trim().charAt(0).toUpperCase();
  const points = profile?.loyalty_points ?? 0;

  function confirmLogout() {
    Alert.alert('Çıkış yap', 'Hesaptan çıkmak istediğine emin misin?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            clearCart();
            router.replace('/');
          } catch {}
        },
      },
    ]);
  }

  function confirmDelete(addr) {
    Alert.alert('Adresi sil', `"${addr.label}" adresini silmek istiyor musun?`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deleteAddress(addr.id) },
    ]);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: verticalScale(140),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Profil</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{profile?.full_name || 'Misafir'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
          {profile?.phone ? <Text style={styles.email}>{profile.phone}</Text> : null}
        </View>

        <View style={styles.loyaltyCard}>
          <View style={styles.loyaltyHeader}>
            <View style={styles.loyaltyIcon}>
              <Ionicons name="sparkles" size={moderateScale(18)} color={colors.onPrimaryContainer} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.loyaltyLabel}>SADAKAT PUANI</Text>
              <Text style={styles.loyaltyDesc}>Her ₺10 harcamada 1 puan</Text>
            </View>
          </View>
          <View style={styles.loyaltyValueRow}>
            <Text style={styles.loyaltyValue}>{points}</Text>
            <Text style={styles.loyaltyUnit}>puan</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>ADRESLERİM</Text>
            <PressScale onPress={() => setAddrModal(true)} style={styles.addBtn}>
              <Ionicons name="add" size={moderateScale(16)} color={colors.surface} />
              <Text style={styles.addBtnText}>Ekle</Text>
            </PressScale>
          </View>

          {addresses.length === 0 ? (
            <View style={styles.emptyAddr}>
              <Ionicons name="location-outline" size={moderateScale(28)} color={colors.outline} />
              <Text style={styles.emptyAddrText}>Henüz adres yok</Text>
            </View>
          ) : (
            <View style={{ gap: verticalScale(8) }}>
              {addresses.map((addr) => (
                <View key={addr.id} style={styles.addrCard}>
                  <View style={styles.addrIcon}>
                    <Ionicons
                      name={addr.is_default ? 'star' : 'location'}
                      size={moderateScale(16)}
                      color={colors.onSecondaryContainer}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.addrTopRow}>
                      <Text style={styles.addrLabel}>{addr.label}</Text>
                      {addr.is_default ? (
                        <View style={styles.defaultPill}>
                          <Text style={styles.defaultText}>VARSAYILAN</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.addrText} numberOfLines={2}>{addr.full_address}</Text>
                    {addr.notes ? (
                      <Text style={styles.addrNote}>Not: {addr.notes}</Text>
                    ) : null}
                    {!addr.is_default ? (
                      <Pressable onPress={() => setDefault(addr.id)} hitSlop={6}>
                        <Text style={styles.makeDefaultLink}>Varsayılan yap</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Pressable onPress={() => confirmDelete(addr)} hitSlop={8} style={styles.trashBtn}>
                    <Ionicons name="trash-outline" size={moderateScale(16)} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HESAP</Text>
          <PressScale style={styles.logoutBtn} onPress={confirmLogout}>
            <Ionicons name="log-out-outline" size={moderateScale(20)} color={colors.error} />
            <Text style={styles.logoutText}>Çıkış Yap</Text>
            <Ionicons name="chevron-forward" size={moderateScale(18)} color={colors.error} />
          </PressScale>
        </View>
      </ScrollView>

      <AddressFormModal
        visible={addrModal}
        onClose={() => setAddrModal(false)}
        onSaved={refetch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerRow: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(14),
    paddingBottom: verticalScale(4),
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },

  profileCard: {
    alignItems: 'center',
    paddingVertical: verticalScale(28),
    marginHorizontal: scale(20),
    marginTop: verticalScale(8),
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(20),
  },
  avatar: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(14),
  },
  avatarText: {
    fontSize: moderateScale(34),
    fontWeight: '800',
    color: colors.surface,
  },
  name: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  email: {
    fontSize: moderateScale(12),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(4),
  },

  loyaltyCard: {
    marginHorizontal: scale(20),
    marginTop: verticalScale(16),
    backgroundColor: colors.primaryContainer,
    borderRadius: moderateScale(20),
    padding: scale(18),
  },
  loyaltyHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(12) },
  loyaltyIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: 'rgba(182,237,194,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyLabel: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: colors.onPrimaryContainer,
    letterSpacing: scale(2),
  },
  loyaltyDesc: {
    fontSize: moderateScale(11),
    color: colors.onPrimaryContainer,
    opacity: 0.7,
    marginTop: verticalScale(2),
  },
  loyaltyValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: scale(6),
    marginTop: verticalScale(14),
  },
  loyaltyValue: {
    fontSize: moderateScale(40),
    fontWeight: '800',
    color: colors.onPrimaryContainer,
    letterSpacing: -1,
  },
  loyaltyUnit: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: colors.onPrimaryContainer,
    opacity: 0.7,
  },

  section: {
    paddingHorizontal: scale(20),
    marginTop: verticalScale(28),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  sectionLabel: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    letterSpacing: scale(2),
    marginBottom: verticalScale(12),
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: colors.primary,
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(20),
  },
  addBtnText: {
    color: colors.surface,
    fontSize: moderateScale(12),
    fontWeight: '700',
  },

  emptyAddr: {
    alignItems: 'center',
    gap: verticalScale(8),
    paddingVertical: verticalScale(28),
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
  },
  emptyAddrText: {
    fontSize: moderateScale(13),
    color: colors.onSurfaceVariant,
  },

  addrCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(12),
    padding: scale(14),
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(14),
  },
  addrIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrTopRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  addrLabel: { fontSize: moderateScale(14), fontWeight: '800', color: colors.primary },
  defaultPill: {
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(6),
    backgroundColor: colors.secondary,
  },
  defaultText: {
    fontSize: moderateScale(8),
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: scale(1),
  },
  addrText: {
    fontSize: moderateScale(12),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(2),
    lineHeight: moderateScale(18),
  },
  addrNote: {
    fontSize: moderateScale(11),
    color: colors.outline,
    marginTop: verticalScale(2),
    fontStyle: 'italic',
  },
  makeDefaultLink: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: colors.secondary,
    marginTop: verticalScale(6),
  },
  trashBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    padding: scale(14),
    backgroundColor: colors.errorContainer,
    borderRadius: moderateScale(14),
  },
  logoutText: {
    flex: 1,
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: colors.error,
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
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: moderateScale(14),
    paddingVertical: verticalScale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: colors.surface,
    fontSize: moderateScale(14),
    fontWeight: '700',
    letterSpacing: scale(0.3),
  },
});
