import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Switch, StyleSheet,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../components/shared/Badge';
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
    description: 'Ürün ve malzeme ekleyip düzenleyebilir',
  },
];

export default function EmployeesScreen() {
  const { isAdmin, user: currentUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(null); // userId being updated

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
    if (emp.role === 'admin') return; // admins always have all permissions
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
        <Ionicons name="lock-closed-outline" size={moderateScale(40)} color={colors.textMuted} />
        <Text style={styles.noAccess}>Bu sayfaya erişim yetkiniz yok.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  function renderEmployee({ item: emp }) {
    const isCurrentUser = emp.id === currentUser?.id;
    const isEmpAdmin = emp.role === 'admin';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(emp.full_name || emp.id).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.empName}>{emp.full_name || '—'}</Text>
            <Badge
              label={isEmpAdmin ? 'Yönetici' : 'Garson'}
              variant={isEmpAdmin ? 'accent' : 'default'}
            />
          </View>
          {isCurrentUser && (
            <View style={styles.youBadge}>
              <Text style={styles.youText}>Siz</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.permissionsGrid}>
          {PERMISSIONS.map(perm => {
            const isOn = isEmpAdmin || (emp[perm.key] ?? (perm.key === 'can_take_orders'));
            const isLoading = updating === emp.id + perm.key;
            const disabled = isEmpAdmin || isCurrentUser;

            return (
              <View key={perm.key} style={styles.permRow}>
                <View style={styles.permLeft}>
                  <Ionicons
                    name={perm.icon}
                    size={moderateScale(18)}
                    color={isOn ? colors.accent : colors.textMuted}
                    style={styles.permIcon}
                  />
                  <View>
                    <Text style={[styles.permLabel, !isOn && styles.permLabelOff]}>
                      {perm.label}
                    </Text>
                    <Text style={styles.permDesc}>{perm.description}</Text>
                  </View>
                </View>
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Switch
                    value={isOn}
                    onValueChange={() => togglePermission(emp, perm.key)}
                    disabled={disabled}
                    trackColor={{ false: colors.border, true: colors.accentLight }}
                    thumbColor={isOn ? colors.accent : colors.textMuted}
                    ios_backgroundColor={colors.border}
                  />
                )}
              </View>
            );
          })}
        </View>

        {isEmpAdmin && (
          <View style={styles.adminNote}>
            <Ionicons name="shield-checkmark-outline" size={moderateScale(14)} color={colors.accent} />
            <Text style={styles.adminNoteText}>Yöneticiler tüm izinlere sahiptir</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <FlatList
      data={employees}
      keyExtractor={e => e.id}
      renderItem={renderEmployee}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.noAccess}>Henüz çalışan yok.</Text>
        </View>
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{employees.length} çalışan</Text>
          <Text style={styles.headerSub}>İzinleri toggle ile yönetin</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: scale(16), gap: verticalScale(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: scale(24), gap: verticalScale(12) },
  noAccess: { fontSize: moderateScale(15), color: colors.textMuted, textAlign: 'center' },

  header: { marginBottom: verticalScale(4) },
  headerTitle: { fontSize: moderateScale(16), fontWeight: '700', color: colors.textPrimary },
  headerSub: { fontSize: moderateScale(12), color: colors.textMuted, marginTop: verticalScale(2) },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: moderateScale(12),
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(14),
    gap: scale(12),
  },
  avatar: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: moderateScale(21),
    backgroundColor: colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: moderateScale(18), fontWeight: '700', color: colors.accent },
  cardInfo: { flex: 1, gap: verticalScale(4) },
  empName: { fontSize: moderateScale(15), fontWeight: '700', color: colors.textPrimary },
  youBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(10),
  },
  youText: { fontSize: moderateScale(11), fontWeight: '600', color: colors.success },

  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: scale(14) },

  permissionsGrid: { padding: scale(14), gap: verticalScale(12) },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: scale(10) },
  permIcon: { width: moderateScale(22) },
  permLabel: { fontSize: moderateScale(13), fontWeight: '600', color: colors.textPrimary },
  permLabelOff: { color: colors.textMuted },
  permDesc: { fontSize: moderateScale(11), color: colors.textMuted, marginTop: verticalScale(1) },

  adminNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: colors.accentLight,
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  adminNoteText: { fontSize: moderateScale(12), color: colors.accent, fontWeight: '500' },
});
