import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Switch, StyleSheet,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { colors } from '../../styles/colors';

const PERMISSIONS = [
  {
    key: 'can_take_orders',
    label: 'Sipariş Alır',
    icon: 'receipt-outline',
    description: 'Masaya ürün ekleyebilir',
  },
  {
    key: 'can_close_tables',
    label: 'Masa Kapatır',
    icon: 'checkmark-circle-outline',
    description: 'Ödeme alıp siparişi kapatabilir',
  },
  {
    key: 'can_manage_products',
    label: 'Ürün Yönetir',
    icon: 'cube-outline',
    description: 'Ürün ve malzemeyi düzenleyebilir',
  },
];

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

export default function EmployeesScreen() {
  const insets = useSafeAreaInsets();
  const { isAdmin, user: currentUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    if (!error) setEmployees(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function togglePermission(emp, permKey) {
    if (emp.role === 'admin') return;
    if (emp.id === currentUser?.id) {
      Alert.alert('Uyarı', 'Kendi izinlerinizi değiştiremezsiniz.');
      return;
    }

    const newVal = !emp[permKey];
    setUpdating(emp.id + permKey);

    const { error } = await supabase
      .from('profiles')
      .update({ [permKey]: newVal })
      .eq('id', emp.id);

    if (error) {
      Alert.alert('Hata', error.message);
    } else {
      setEmployees(prev =>
        prev.map(e => e.id === emp.id ? { ...e, [permKey]: newVal } : e)
      );
    }
    setUpdating(null);
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={moderateScale(40)} color={colors.outline} style={{ opacity: 0.4 }} />
        <Text style={styles.noAccess}>Bu sayfaya erişim yetkiniz yok.</Text>
      </View>
    );
  }

  const adminCount = employees.filter(e => e.role === 'admin').length;
  const waiterCount = employees.length - adminCount;

  function renderEmployee({ item: emp }) {
    const isCurrentUser = emp.id === currentUser?.id;
    const isEmpAdmin = emp.role === 'admin';
    const tone = avatarTone(emp.full_name || emp.id);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
            <Text style={[styles.avatarText, { color: tone.fg }]}>
              {(emp.full_name || emp.id).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.empName} numberOfLines={1}>{emp.full_name || '—'}</Text>
              {isCurrentUser && (
                <View style={styles.youBadge}>
                  <Text style={styles.youText}>SİZ</Text>
                </View>
              )}
            </View>
            <View style={[styles.rolePill, isEmpAdmin ? styles.rolePillAdmin : styles.rolePillWaiter]}>
              <Ionicons
                name={isEmpAdmin ? 'shield-checkmark' : 'person-outline'}
                size={moderateScale(10)}
                color={isEmpAdmin ? colors.onPrimary : colors.secondary}
              />
              <Text style={[styles.rolePillText, isEmpAdmin ? styles.rolePillTextAdmin : styles.rolePillTextWaiter]}>
                {isEmpAdmin ? 'Yönetici' : 'Garson'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.permsBlock}>
          {PERMISSIONS.map(perm => {
            const isOn = isEmpAdmin || (emp[perm.key] ?? (perm.key === 'can_take_orders'));
            const isLoading = updating === emp.id + perm.key;
            const disabled = isEmpAdmin || isCurrentUser;

            return (
              <View key={perm.key} style={styles.permRow}>
                <View style={[styles.permIconWrap, isOn && styles.permIconWrapOn]}>
                  <Ionicons
                    name={perm.icon}
                    size={moderateScale(16)}
                    color={isOn ? colors.primary : colors.outline}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.permLabel, !isOn && styles.permLabelOff]}>
                    {perm.label}
                  </Text>
                  <Text style={styles.permDesc}>{perm.description}</Text>
                </View>
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Switch
                    value={isOn}
                    onValueChange={() => togglePermission(emp, perm.key)}
                    disabled={disabled}
                    trackColor={{ false: colors.surfaceContainerHigh, true: colors.primary }}
                    thumbColor={colors.surface}
                    ios_backgroundColor={colors.surfaceContainerHigh}
                  />
                )}
              </View>
            );
          })}
        </View>

        {isEmpAdmin && (
          <View style={styles.adminNote}>
            <Ionicons name="shield-checkmark" size={moderateScale(13)} color={colors.onPrimaryContainer} />
            <Text style={styles.adminNoteText}>Yöneticiler tüm izinlere sahiptir</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={employees}
      keyExtractor={e => e.id}
      renderItem={renderEmployee}
      contentContainerStyle={[styles.list, { paddingTop: insets.top + verticalScale(16) }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Personel</Text>
              <View style={styles.countChip}>
                <Text style={styles.countChipText}>{employees.length}</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              Çalışan izinlerini yönetin. Yöneticiler tüm izinlere sahiptir.
            </Text>
          </View>

          {employees.length > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>TOPLAM</Text>
                <Text style={styles.statValue}>{employees.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>YÖNETİCİ</Text>
                <Text style={styles.statValue}>{adminCount}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>GARSON</Text>
                <Text style={styles.statValue}>{waiterCount}</Text>
              </View>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        loading && !refreshing ? (
          <View style={styles.centerPad}><ActivityIndicator color={colors.primary} size="large" /></View>
        ) : (
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={moderateScale(40)} color={colors.outline} style={{ opacity: 0.4 }} />
            <Text style={styles.empty}>Henüz çalışan yok</Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  list: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(120),
    gap: verticalScale(12),
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, padding: scale(24), gap: verticalScale(12) },
  centerPad: { paddingVertical: verticalScale(60), alignItems: 'center' },
  noAccess: { fontSize: moderateScale(15), color: colors.outline, textAlign: 'center' },

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

  // Card
  card: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(16),
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(16),
    gap: scale(14),
  },
  avatar: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: moderateScale(19),
    fontWeight: '800',
  },
  cardInfo: { flex: 1, gap: verticalScale(6) },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  empName: {
    fontSize: moderateScale(15),
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  youBadge: {
    backgroundColor: colors.tertiaryContainer,
    paddingHorizontal: scale(7),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(999),
  },
  youText: {
    fontSize: moderateScale(9),
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.onTertiaryContainer,
  },
  rolePill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(999),
  },
  rolePillAdmin: { backgroundColor: colors.primary },
  rolePillWaiter: { backgroundColor: colors.secondaryContainer },
  rolePillText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  rolePillTextAdmin: { color: colors.onPrimary },
  rolePillTextWaiter: { color: colors.secondary },

  permsBlock: {
    padding: scale(16),
    paddingTop: 0,
    gap: verticalScale(10),
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    backgroundColor: colors.surface,
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
  },
  permIconWrap: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(10),
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permIconWrapOn: {
    backgroundColor: colors.secondaryContainer,
  },
  permLabel: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: colors.primary,
  },
  permLabelOff: { color: colors.onSurfaceVariant },
  permDesc: {
    fontSize: moderateScale(11),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(2),
  },

  adminNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
  },
  adminNoteText: {
    fontSize: moderateScale(12),
    color: colors.onPrimaryContainer,
    fontWeight: '700',
  },

  emptyWrap: {
    alignItems: 'center',
    gap: verticalScale(8),
    paddingVertical: verticalScale(60),
  },
  empty: { color: colors.outline, fontSize: moderateScale(14) },
});
