import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import { signIn, signUpCustomer } from '../../lib/auth';
import { colors } from '../../styles/colors';

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

export default function CustomerRegister() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Ad, e-posta ve şifre gereklidir.');
      return;
    }
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalı.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await signUpCustomer({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() || null,
      });
      if (result?.session) {
        router.replace('/customer/(tabs)');
        return;
      }
      // Email confirmation off → sign in directly. If on, the call below
      // will fail with "Email not confirmed" and we show a helpful message.
      try {
        await signIn(email.trim(), password);
        router.replace('/customer/(tabs)');
      } catch {
        setError('Hesabınız oluşturuldu. Lütfen e-postanızı doğrulayıp giriş yapın.');
      }
    } catch (e) {
      setError(e?.message || 'Hesap oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.bg} />
      <View style={styles.glow} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={moderateScale(24)} color={colors.surface} />
            </Pressable>

            <View style={styles.brand}>
              <View style={styles.leafWrap}>
                <Ionicons name="sparkles" size={moderateScale(24)} color={colors.secondaryContainer} />
              </View>
              <Text style={styles.eyebrow}>SAN LUCAS DENEYİMİ</Text>
              <Text style={styles.title}>Aramıza{`\n`}hoş geldiniz.</Text>
              <Text style={styles.subtitle}>
                Hesap oluşturun; her siparişle puan kazanın, adreslerinizi kaydedin.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>AD SOYAD</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Adınız Soyadınız"
                placeholderTextColor={colors.outline}
                autoCapitalize="words"
              />

              <Text style={[styles.label, { marginTop: verticalScale(14) }]}>E-POSTA</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="ornek@email.com"
                placeholderTextColor={colors.outline}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={[styles.label, { marginTop: verticalScale(14) }]}>TELEFON (OPSİYONEL)</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+90 5xx xxx xx xx"
                placeholderTextColor={colors.outline}
                keyboardType="phone-pad"
              />

              <Text style={[styles.label, { marginTop: verticalScale(14) }]}>ŞİFRE</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="En az 6 karakter"
                  placeholderTextColor={colors.outline}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={8}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={moderateScale(20)}
                    color={colors.onSurfaceVariant}
                  />
                </Pressable>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <PressScale style={styles.primaryBtn} onPress={handleRegister} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <>
                    <Text style={styles.primaryText}>Hesabı Oluştur</Text>
                    <Ionicons name="arrow-forward" size={moderateScale(18)} color={colors.surface} />
                  </>
                )}
              </PressScale>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Zaten hesabınız var mı?</Text>
              <Pressable onPress={() => router.replace('/customer/login')} hitSlop={8}>
                <Text style={styles.footerLink}>Giriş Yap</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.primary },
  glow: {
    position: 'absolute',
    top: -scale(140),
    left: -scale(120),
    width: scale(360),
    height: scale(360),
    borderRadius: scale(180),
    backgroundColor: 'rgba(55,104,71,0.30)',
  },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(28),
  },
  backBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(16),
  },
  brand: { marginBottom: verticalScale(24) },
  leafWrap: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: 'rgba(182,237,194,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(18),
  },
  eyebrow: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: colors.secondaryContainer,
    letterSpacing: scale(3),
    marginBottom: verticalScale(10),
    opacity: 0.85,
  },
  title: {
    fontSize: moderateScale(32),
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: -1,
    lineHeight: moderateScale(38),
  },
  subtitle: {
    fontSize: moderateScale(13),
    color: colors.secondaryContainer,
    opacity: 0.7,
    marginTop: verticalScale(10),
    lineHeight: moderateScale(20),
  },
  card: {
    backgroundColor: 'rgba(249,250,242,0.96)',
    borderRadius: moderateScale(20),
    padding: scale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 12,
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
    paddingVertical: verticalScale(13),
    fontSize: moderateScale(15),
    color: colors.onSurface,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(12),
    paddingRight: scale(4),
  },
  eyeBtn: {
    width: scale(40),
    height: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    marginTop: verticalScale(12),
    fontSize: moderateScale(12),
    color: colors.error,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: verticalScale(20),
    backgroundColor: colors.primary,
    borderRadius: moderateScale(14),
    paddingVertical: verticalScale(15),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
  },
  primaryText: {
    color: colors.surface,
    fontSize: moderateScale(15),
    fontWeight: '700',
    letterSpacing: scale(0.5),
  },
  footer: {
    marginTop: verticalScale(24),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(8),
  },
  footerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: moderateScale(13),
  },
  footerLink: {
    color: colors.secondaryContainer,
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
});
