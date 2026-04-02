import { View, Text, StyleSheet } from 'react-native';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { colors } from '../../styles/colors';

const variantStyles = {
  success: { bg: colors.successLight, text: colors.success },
  danger: { bg: colors.dangerLight, text: colors.danger },
  warning: { bg: colors.warningLight, text: colors.warning },
  default: { bg: colors.border, text: colors.textSecondary },
  accent: { bg: colors.accentLight, text: colors.accent },
};

export function Badge({ label, variant = 'default', style }) {
  const v = variantStyles[variant] || variantStyles.default;
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }, style]}>
      <Text style={[styles.text, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(20),
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
});
