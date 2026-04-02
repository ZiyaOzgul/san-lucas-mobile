import { scale, verticalScale, moderateScale } from 'react-native-size-matters';

export const spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
};

export const radius = {
  card: moderateScale(10),
  input: moderateScale(6),
  pill: moderateScale(20),
  sm: moderateScale(4),
};

export const fontSize = {
  xs: moderateScale(11),
  sm: moderateScale(13),
  md: moderateScale(15),
  lg: moderateScale(17),
  xl: moderateScale(20),
  xxl: moderateScale(24),
};
