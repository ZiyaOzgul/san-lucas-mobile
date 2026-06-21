import { Modal, Pressable, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { colors } from '../styles/colors';

export function TablePickerModal({ visible, onClose, tables, mode, excludeTableId, title, subtitle, onSelect }) {
  if (!visible) return null;

  const wantStatus = mode === 'emptyOnly' ? 'empty' : 'occupied';
  const filtered = (tables || []).filter(
    t => t.status === wantStatus && t.id !== excludeTableId,
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}

          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="alert-circle-outline" size={moderateScale(28)} color={colors.outline} />
              <Text style={styles.emptyText}>
                {mode === 'emptyOnly' ? 'Boş masa bulunamadı' : 'Aktif adisyonu olan başka masa yok'}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: verticalScale(4) }}>
              {filtered.map(t => (
                <TouchableOpacity key={t.id} style={styles.row} onPress={() => onSelect(t)} activeOpacity={0.7}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.dot, { backgroundColor: t.status === 'occupied' ? colors.secondary : colors.outline }]} />
                    <Text style={styles.rowName}>{t.name}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={moderateScale(18)} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>İptal</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5,26,15,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    padding: scale(20),
    paddingBottom: verticalScale(28),
    gap: verticalScale(8),
    maxHeight: '75%',
  },
  title: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: colors.primary,
  },
  sub: {
    fontSize: moderateScale(12),
    color: colors.onSurfaceVariant,
    marginBottom: verticalScale(8),
    letterSpacing: 1,
  },
  list: {
    maxHeight: verticalScale(360),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainer,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  dot: {
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: moderateScale(5),
  },
  rowName: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: colors.onSurface,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: verticalScale(28),
    gap: verticalScale(8),
  },
  emptyText: {
    color: colors.outline,
    fontSize: moderateScale(13),
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    marginTop: verticalScale(6),
  },
  cancelText: {
    color: colors.error,
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
});
