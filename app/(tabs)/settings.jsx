import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, StyleSheet, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { colors } from '../../styles/colors';

const SECTIONS = [
  { key: 'account', label: 'Hesap', icon: 'person-circle-outline' },
  { key: 'cafe', label: 'Kafe', icon: 'storefront-outline' },
  { key: 'tables', label: 'Masalar', icon: 'grid-outline' },
  { key: 'users', label: 'Garsonlar', icon: 'people-outline' },
];

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

function avatarTone(name) {
  const palette = [
    { bg: colors.secondaryContainer, fg: colors.secondary },
    { bg: colors.tertiaryContainer,  fg: colors.tertiary  },
    { bg: colors.primaryContainer,   fg: colors.surface   },
    { bg: colors.surfaceContainerHighest, fg: colors.primary },
  ];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { isAdmin, profile, user } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('account');
  const [cafeName, setCafeName] = useState('San Lucas Cafe');
  const [tables, setTables] = useState([]);
  const [newTableName, setNewTableName] = useState('');
  const [users, setUsers] = useState([]);
  const [savingCafe, setSavingCafe] = useState(false);
  const [addingTable, setAddingTable] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      if (activeSection === 'tables') loadTables();
      if (activeSection === 'users') loadUsers();
    }
  }, [activeSection, isAdmin]);

  async function loadTables() {
    const { data } = await supabase.from('tables').select('*').order('name');
    setTables(data || []);
  }
  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    setUsers(data || []);
  }

  async function handleAddTable() {
    if (!newTableName.trim()) return;
    setAddingTable(true);
    try {
      await supabase.from('tables').insert({ name: newTableName.trim(), status: 'empty' });
      setNewTableName('');
      await loadTables();
    } catch (e) {
      Alert.alert('Hata', e.message);
    } finally {
      setAddingTable(false);
    }
  }

  function handleDeleteTable(id, name) {
    Alert.alert('Masayı Sil', `"${name}" silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          await supabase.from('tables').delete().eq('id', id);
          await loadTables();
        },
      },
    ]);
  }

  function handleChangeRole(userId, currentRole, name) {
    const newRole = currentRole === 'admin' ? 'waiter' : 'admin';
    Alert.alert(
      'Rol Değiştir',
      `"${name}" ${newRole === 'admin' ? 'Yönetici' : 'Garson'} olarak değiştirilecek.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Onayla',
          onPress: async () => {
            await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
            await loadUsers();
          },
        },
      ]
    );
  }

  function handleLogout() {
    Alert.alert('Çıkış Yap', 'Oturumunuzu kapatmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await signOut();
            router.replace('/login');
          } catch (e) {
            Alert.alert('Hata', e.message);
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }

  function renderContent() {
    if (activeSection === 'account') {
      const tone = avatarTone(profile?.full_name || user?.email || '');
      return (
        <View style={{ gap: verticalScale(16) }}>
          <View style={styles.profileCard}>
            <View style={[styles.profileAvatar, { backgroundColor: tone.bg }]}>
              <Text style={[styles.profileAvatarText, { color: tone.fg }]}>
                {((profile?.full_name || user?.email || '?').charAt(0)).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.profileName}>{profile?.full_name || user?.email}</Text>
            <View style={[
              styles.rolePill,
              profile?.role === 'admin' ? styles.rolePillAdmin : styles.rolePillWaiter,
            ]}>
              <Ionicons
                name={profile?.role === 'admin' ? 'shield-checkmark' : 'person-outline'}
                size={moderateScale(11)}
                color={profile?.role === 'admin' ? colors.onPrimary : colors.secondary}
              />
              <Text style={[
                styles.rolePillText,
                profile?.role === 'admin' ? styles.rolePillTextAdmin : styles.rolePillTextWaiter,
              ]}>
                {profile?.role === 'admin' ? 'Yönetici' : 'Garson'}
              </Text>
            </View>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>

          <Text style={styles.sectionLabel}>İŞLEMLER</Text>
          <View style={styles.actionsCard}>
            <PressScale
              style={[styles.actionRow, loggingOut && { opacity: 0.6 }]}
              onPress={loggingOut ? undefined : handleLogout}
              disabled={loggingOut}
              scaleTo={0.98}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.errorContainer }]}>
                <Ionicons name="log-out-outline" size={moderateScale(18)} color={colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionLabel, { color: colors.error }]}>Çıkış Yap</Text>
                <Text style={styles.actionSub}>Oturumu kapat</Text>
              </View>
              {loggingOut ? (
                <ActivityIndicator color={colors.error} />
              ) : (
                <Ionicons name="chevron-forward" size={moderateScale(16)} color={colors.outline} />
              )}
            </PressScale>
          </View>
        </View>
      );
    }

    if (!isAdmin) {
      return (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={moderateScale(40)} color={colors.outline} style={{ opacity: 0.4 }} />
          <Text style={styles.noAccess}>Bu bölüme erişim yetkiniz yok.</Text>
        </View>
      );
    }

    if (activeSection === 'cafe') {
      return (
        <View style={{ gap: verticalScale(16) }}>
          <Text style={styles.sectionLabel}>KAFE BİLGİLERİ</Text>
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Kafe Adı</Text>
            <TextInput
              style={styles.fieldInput}
              value={cafeName}
              onChangeText={setCafeName}
              placeholder="Kafe adı"
              placeholderTextColor={colors.outline}
            />
            <PressScale
              style={[styles.primaryBtn, savingCafe && { opacity: 0.6 }]}
              onPress={savingCafe ? undefined : () => {
                setSavingCafe(true);
                setTimeout(() => {
                  setSavingCafe(false);
                  Alert.alert('Kaydedildi', 'Kafe bilgileri güncellendi.');
                }, 300);
              }}
              disabled={savingCafe}
              scaleTo={0.96}
            >
              {savingCafe ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.primaryBtnText}>Kaydet</Text>
              )}
            </PressScale>
          </View>
        </View>
      );
    }

    if (activeSection === 'tables') {
      return (
        <View style={{ gap: verticalScale(16) }}>
          <Text style={styles.sectionLabel}>YENİ MASA EKLE</Text>
          <View style={styles.addRow}>
            <TextInput
              style={[styles.fieldInput, { flex: 1, marginBottom: 0 }]}
              value={newTableName}
              onChangeText={setNewTableName}
              placeholder="Masa adı"
              placeholderTextColor={colors.outline}
            />
            <PressScale
              style={[styles.primaryBtnCompact, addingTable && { opacity: 0.6 }]}
              onPress={addingTable ? undefined : handleAddTable}
              disabled={addingTable}
              scaleTo={0.94}
            >
              {addingTable ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Ionicons name="add" size={moderateScale(20)} color={colors.onPrimary} />
              )}
            </PressScale>
          </View>

          {tables.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>MEVCUT MASALAR · {tables.length}</Text>
              <View style={styles.listCard}>
                {tables.map((t, i) => {
                  const occupied = t.status === 'occupied';
                  return (
                    <View
                      key={t.id}
                      style={[
                        styles.listRow,
                        i === 0 && { paddingTop: 0 },
                        i === tables.length - 1 && { paddingBottom: 0, borderBottomWidth: 0 },
                      ]}
                    >
                      <View style={[styles.listIcon, occupied && { backgroundColor: colors.secondaryContainer }]}>
                        <Ionicons name="grid" size={moderateScale(14)} color={occupied ? colors.secondary : colors.outline} />
                      </View>
                      <Text style={styles.listName}>{t.name}</Text>
                      <View style={[
                        styles.statusPill,
                        occupied ? { backgroundColor: colors.secondaryContainer } : { backgroundColor: colors.surfaceContainerHighest },
                      ]}>
                        <View style={[
                          styles.statusDot,
                          { backgroundColor: occupied ? colors.secondary : colors.outline },
                        ]} />
                        <Text style={[
                          styles.statusPillText,
                          { color: occupied ? colors.secondary : colors.onSurfaceVariant },
                        ]}>
                          {occupied ? 'Dolu' : 'Boş'}
                        </Text>
                      </View>
                      <Pressable onPress={() => handleDeleteTable(t.id, t.name)} hitSlop={8} style={styles.deleteIconBtn}>
                        <Ionicons name="trash-outline" size={moderateScale(15)} color={colors.error} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      );
    }

    if (activeSection === 'users') {
      return (
        <View style={{ gap: verticalScale(16) }}>
          <Text style={styles.sectionLabel}>KULLANICILAR · {users.length}</Text>
          <View style={styles.listCard}>
            {users.length === 0 ? (
              <Text style={styles.emptyInline}>Henüz kullanıcı yok</Text>
            ) : (
              users.map((u, i) => {
                const tone = avatarTone(u.full_name || u.id);
                const isAdminUser = u.role === 'admin';
                return (
                  <View
                    key={u.id}
                    style={[
                      styles.userRow,
                      i === 0 && { paddingTop: 0 },
                      i === users.length - 1 && { paddingBottom: 0, borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={[styles.userAvatar, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.userAvatarText, { color: tone.fg }]}>
                        {(u.full_name || u.id || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listName} numberOfLines={1}>{u.full_name || u.id}</Text>
                      <View style={[
                        styles.rolePillSmall,
                        isAdminUser ? styles.rolePillAdmin : styles.rolePillWaiter,
                      ]}>
                        <Text style={[
                          styles.rolePillTextSmall,
                          isAdminUser ? styles.rolePillTextAdmin : styles.rolePillTextWaiter,
                        ]}>
                          {isAdminUser ? 'Yönetici' : 'Garson'}
                        </Text>
                      </View>
                    </View>
                    <PressScale
                      style={styles.changeRoleBtn}
                      onPress={() => handleChangeRole(u.id, u.role, u.full_name || u.id)}
                      scaleTo={0.94}
                    >
                      <Ionicons name="swap-horizontal" size={moderateScale(13)} color={colors.primary} />
                      <Text style={styles.changeRoleText}>Rol</Text>
                    </PressScale>
                  </View>
                );
              })
            )}
          </View>
        </View>
      );
    }

    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerWrap}>
        <Text style={styles.headerTitle}>Ayarlar</Text>
        <Text style={styles.headerSubtitle}>
          Hesabınızı, kafenizi ve ekibinizi yönetin.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.navRow}
        style={styles.navScroll}
      >
        {SECTIONS.map(s => {
          const active = activeSection === s.key;
          const disabled = !isAdmin && s.key !== 'account';
          return (
            <PressScale
              key={s.key}
              style={[
                styles.navChip,
                active && styles.navChipActive,
                disabled && { opacity: 0.4 },
              ]}
              onPress={disabled ? undefined : () => setActiveSection(s.key)}
              disabled={disabled}
              scaleTo={0.94}
            >
              <Ionicons
                name={s.icon}
                size={moderateScale(14)}
                color={active ? colors.onPrimary : colors.onSurfaceVariant}
              />
              <Text style={[styles.navText, active && styles.navTextActive]}>{s.label}</Text>
            </PressScale>
          );
        })}
      </ScrollView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderContent()}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  headerWrap: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(12),
  },
  headerTitle: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: moderateScale(13),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(4),
    maxWidth: '85%',
    lineHeight: moderateScale(20),
  },

  // Nav
  navScroll: { flexGrow: 0, marginBottom: verticalScale(8) },
  navRow: {
    paddingHorizontal: scale(20),
    gap: scale(8),
  },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    backgroundColor: colors.surfaceContainer,
    borderRadius: moderateScale(999),
  },
  navChipActive: { backgroundColor: colors.primary },
  navText: { fontSize: moderateScale(12), fontWeight: '700', color: colors.onSurfaceVariant },
  navTextActive: { color: colors.onPrimary },

  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(140),
  },

  center: { alignItems: 'center', paddingVertical: verticalScale(60), gap: verticalScale(12) },
  noAccess: { fontSize: moderateScale(15), color: colors.outline, textAlign: 'center' },

  sectionLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.onSurfaceVariant,
    opacity: 0.6,
  },

  // Profile card
  profileCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(20),
    padding: scale(24),
    alignItems: 'center',
    gap: verticalScale(10),
  },
  profileAvatar: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(4),
  },
  profileAvatarText: {
    fontSize: moderateScale(32),
    fontWeight: '800',
  },
  profileName: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: moderateScale(12),
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },

  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(999),
  },
  rolePillAdmin: { backgroundColor: colors.primary },
  rolePillWaiter: { backgroundColor: colors.secondaryContainer },
  rolePillText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  rolePillTextAdmin: { color: colors.onPrimary },
  rolePillTextWaiter: { color: colors.secondary },

  // Actions card
  actionsCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(16),
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(14),
    gap: scale(12),
  },
  actionIcon: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  actionSub: {
    fontSize: moderateScale(11),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(2),
  },

  // Form card
  formCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(16),
    padding: scale(16),
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
    marginBottom: verticalScale(12),
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: verticalScale(13),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: colors.onPrimary,
    letterSpacing: 0.3,
  },
  primaryBtnCompact: {
    backgroundColor: colors.primary,
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: scale(10) },

  // List card (tables, users)
  listCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(16),
    padding: scale(16),
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingVertical: verticalScale(10),
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  listIcon: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(10),
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listName: {
    flex: 1,
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: colors.primary,
  },
  deleteIconBtn: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(10),
    backgroundColor: colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(999),
  },
  statusDot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: moderateScale(3),
  },
  statusPillText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // User row
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  userAvatar: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: moderateScale(15),
    fontWeight: '800',
  },
  rolePillSmall: {
    alignSelf: 'flex-start',
    paddingHorizontal: scale(7),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(999),
    marginTop: verticalScale(3),
  },
  rolePillTextSmall: {
    fontSize: moderateScale(9),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  changeRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(999),
    backgroundColor: colors.secondaryContainer,
  },
  changeRoleText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: colors.primary,
  },

  emptyInline: {
    textAlign: 'center',
    color: colors.outline,
    fontSize: moderateScale(13),
    paddingVertical: verticalScale(20),
  },
});
