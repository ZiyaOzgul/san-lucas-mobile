import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useRouter } from 'expo-router';
import { Button } from '../../components/shared/Button';
import { Badge } from '../../components/shared/Badge';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { colors } from '../../styles/colors';

const SECTIONS = ['Kafe Bilgileri', 'Masa Yönetimi', 'Garson Yönetimi', 'Hesap'];

export default function SettingsScreen() {
  const { isAdmin, profile, user } = useAuth();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('Hesap');
  const [cafeName, setCafeName] = useState('San Lucas Cafe');
  const [tables, setTables] = useState([]);
  const [newTableName, setNewTableName] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      if (activeSection === 'Masa Yönetimi') loadTables();
      if (activeSection === 'Garson Yönetimi') loadUsers();
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
    try {
      await supabase.from('tables').insert({ name: newTableName.trim(), status: 'empty' });
      setNewTableName('');
      await loadTables();
    } catch (e) {
      Alert.alert('Hata', e.message);
    }
  }

  async function handleDeleteTable(id) {
    Alert.alert('Masayı Sil', 'Bu masayı silmek istediğinizden emin misiniz?', [
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

  async function handleChangeRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'waiter' : 'admin';
    Alert.alert('Rol Değiştir', `Bu kullanıcının rolünü "${newRole === 'admin' ? 'Yönetici' : 'Garson'}" olarak değiştirmek istiyor musunuz?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Değiştir',
        onPress: async () => {
          await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
          await loadUsers();
        },
      },
    ]);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (e) {
      Alert.alert('Hata', e.message);
    } finally {
      setLoggingOut(false);
    }
  }

  function renderContent() {
    if (activeSection === 'Hesap') {
      return (
        <View style={styles.sectionContent}>
          <View style={styles.profileCard}>
            <Text style={styles.profileName}>{profile?.full_name || user?.email}</Text>
            <Badge label={profile?.role === 'admin' ? 'Yönetici' : 'Garson'} variant={profile?.role === 'admin' ? 'accent' : 'default'} />
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
          <Button title="Çıkış Yap" variant="danger" onPress={handleLogout} loading={loggingOut} style={styles.logoutBtn} />
        </View>
      );
    }

    if (!isAdmin) {
      return (
        <View style={styles.center}>
          <Text style={styles.noAccess}>Bu bölüme erişim yetkiniz yok.</Text>
        </View>
      );
    }

    if (activeSection === 'Kafe Bilgileri') {
      return (
        <View style={styles.sectionContent}>
          <Text style={styles.fieldLabel}>Kafe Adı</Text>
          <TextInput
            style={styles.fieldInput}
            value={cafeName}
            onChangeText={setCafeName}
            placeholder="Kafe adı"
            placeholderTextColor={colors.textMuted}
          />
          <Button title="Kaydet" onPress={() => Alert.alert('Kaydedildi', 'Kafe bilgileri güncellendi.')} />
        </View>
      );
    }

    if (activeSection === 'Masa Yönetimi') {
      return (
        <View style={styles.sectionContent}>
          <View style={styles.addRow}>
            <TextInput
              style={[styles.fieldInput, { flex: 1, marginBottom: 0 }]}
              value={newTableName}
              onChangeText={setNewTableName}
              placeholder="Yeni masa adı"
              placeholderTextColor={colors.textMuted}
            />
            <Button title="Ekle" onPress={handleAddTable} style={styles.addBtn} />
          </View>
          {tables.map(t => (
            <View key={t.id} style={styles.listRow}>
              <Text style={styles.listName}>{t.name}</Text>
              <Badge label={t.status === 'occupied' ? 'Dolu' : 'Boş'} variant={t.status === 'occupied' ? 'success' : 'default'} />
              <TouchableOpacity onPress={() => handleDeleteTable(t.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>Sil</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }

    if (activeSection === 'Garson Yönetimi') {
      return (
        <View style={styles.sectionContent}>
          {users.map(u => (
            <View key={u.id} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listName}>{u.full_name || u.id}</Text>
                <Badge label={u.role === 'admin' ? 'Yönetici' : 'Garson'} variant={u.role === 'admin' ? 'accent' : 'default'} />
              </View>
              <TouchableOpacity onPress={() => handleChangeRole(u.id, u.role)} style={styles.roleBtn}>
                <Text style={styles.roleText}>Rol Değiştir</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.navScroll} contentContainerStyle={styles.navBar}>
        {SECTIONS.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.navItem, activeSection === s && styles.navItemActive]}
            onPress={() => setActiveSection(s)}
          >
            <Text style={[styles.navText, activeSection === s && styles.navTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        {renderContent()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPage },
  navScroll: { backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border },
  navBar: { paddingHorizontal: scale(8), paddingVertical: verticalScale(8), gap: scale(8) },
  navItem: {
    paddingHorizontal: scale(16), paddingVertical: verticalScale(8),
    borderRadius: moderateScale(20), backgroundColor: colors.bgPage,
    borderWidth: 1, borderColor: colors.border,
  },
  navItemActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  navText: { fontSize: moderateScale(13), fontWeight: '600', color: colors.textSecondary },
  navTextActive: { color: '#fff' },
  body: { flex: 1 },
  bodyContent: { padding: scale(16) },
  sectionContent: { gap: verticalScale(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: verticalScale(48) },
  noAccess: { fontSize: moderateScale(15), color: colors.textMuted },
  profileCard: {
    backgroundColor: colors.bgCard, borderRadius: moderateScale(12), padding: scale(20),
    alignItems: 'center', gap: verticalScale(8), borderWidth: 1, borderColor: colors.border,
  },
  profileName: { fontSize: moderateScale(18), fontWeight: '700', color: colors.textPrimary },
  profileEmail: { fontSize: moderateScale(13), color: colors.textMuted },
  logoutBtn: { marginTop: verticalScale(8) },
  fieldLabel: { fontSize: moderateScale(13), fontWeight: '600', color: colors.textSecondary },
  fieldInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: moderateScale(8),
    paddingHorizontal: scale(12), paddingVertical: verticalScale(10),
    fontSize: moderateScale(15), color: colors.textPrimary, backgroundColor: colors.bgCard,
    marginBottom: verticalScale(12),
  },
  addRow: { flexDirection: 'row', gap: scale(8), marginBottom: verticalScale(16), alignItems: 'center' },
  addBtn: { paddingHorizontal: scale(16) },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: scale(12),
    backgroundColor: colors.bgCard, borderRadius: moderateScale(8), padding: scale(12),
    borderWidth: 1, borderColor: colors.border,
  },
  listName: { flex: 1, fontSize: moderateScale(14), fontWeight: '600', color: colors.textPrimary },
  deleteBtn: { padding: scale(6) },
  deleteText: { fontSize: moderateScale(13), color: colors.danger, fontWeight: '600' },
  roleBtn: { padding: scale(6) },
  roleText: { fontSize: moderateScale(13), color: colors.accent, fontWeight: '600' },
});
