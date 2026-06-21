import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import { useAuth } from '../../../hooks/useAuth';
import { useCart } from '../../../hooks/useCart';
import { colors } from '../../../styles/colors';

function TabBarIcon({ name, nameFilled, focused, color, badge }) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={focused ? nameFilled || name : name} size={moderateScale(22)} color={color} />
      {badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
      <View style={[styles.activeDot, { opacity: focused ? 1 : 0 }]} />
    </View>
  );
}

export default function CustomerTabsLayout() {
  const { user, profile, loading } = useAuth();
  const { totals } = useCart();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight =
    verticalScale(60) + (Platform.OS === 'ios' ? insets.bottom : verticalScale(8));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/customer/login');
    } else if (profile && profile.role !== 'customer') {
      router.replace('/(tabs)/tables');
    }
  }, [user, profile, loading]);

  if (loading || !user) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.outline,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: 'rgba(249,250,242,0.92)',
          borderTopWidth: 0,
          borderTopLeftRadius: moderateScale(20),
          borderTopRightRadius: moderateScale(20),
          height: tabBarHeight,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : verticalScale(8),
          paddingTop: verticalScale(8),
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          shadowColor: colors.onSurface,
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.06,
          shadowRadius: 32,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: moderateScale(9),
          fontWeight: '700',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginTop: verticalScale(2),
        },
        tabBarItemStyle: { paddingTop: verticalScale(4) },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Menü',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="leaf-outline" nameFilled="leaf" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Sepet',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="bag-handle-outline"
              nameFilled="bag-handle"
              focused={focused}
              color={color}
              badge={totals.count}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Siparişlerim',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="receipt-outline" nameFilled="receipt" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name="person-circle-outline"
              nameFilled="person-circle"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  activeDot: {
    width: moderateScale(4),
    height: moderateScale(4),
    borderRadius: moderateScale(2),
    backgroundColor: colors.primary,
    marginTop: verticalScale(3),
  },
  badge: {
    position: 'absolute',
    top: -verticalScale(4),
    right: -scale(10),
    minWidth: scale(16),
    height: scale(16),
    paddingHorizontal: scale(4),
    borderRadius: scale(8),
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.surface,
    fontSize: moderateScale(9),
    fontWeight: '800',
  },
});
