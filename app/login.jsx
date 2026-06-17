import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/shared/Button';
import { signIn } from '../lib/auth';
import { colors } from '../styles/colors';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin() {
    if (!email || !password) {
      setError('E-posta ve şifre gereklidir.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)/tables');
    } catch (e) {
      setError('Geçersiz e-posta veya şifre.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : verticalScale(20)}
      >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <Text style={styles.logoIcon}>☕</Text>
          <Text style={styles.appName}>San Lucas</Text>
          <Text style={styles.subtitle}>Kafe Yönetim Sistemi</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>E-posta</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@email.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Şifre</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize='none'
              autoCorrect={false}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={scale(8)}
              style={styles.passwordToggle}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={moderateScale(20)}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title="Giriş Yap"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginBtn}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: scale(24),
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: verticalScale(48),
  },
  logoIcon: {
    fontSize: moderateScale(64),
    marginBottom: verticalScale(8),
  },
  appName: {
    fontSize: moderateScale(32),
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: moderateScale(14),
    color: colors.textSecondary,
    marginTop: verticalScale(4),
  },
  form: {
    backgroundColor: colors.bgCard,
    borderRadius: moderateScale(12),
    padding: scale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: verticalScale(6),
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(12),
    fontSize: moderateScale(15),
    color: colors.textPrimary,
    backgroundColor: colors.bgPage,
    marginBottom: verticalScale(16),
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: moderateScale(8),
    backgroundColor: colors.bgPage,
    marginBottom: verticalScale(16),
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(12),
    fontSize: moderateScale(15),
    color: colors.textPrimary,
  },
  passwordToggle: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(12),
  },
  error: {
    fontSize: moderateScale(13),
    color: colors.danger,
    marginBottom: verticalScale(12),
    textAlign: 'center',
  },
  loginBtn: {
    width: '100%',
    marginTop: verticalScale(4),
  },
});
