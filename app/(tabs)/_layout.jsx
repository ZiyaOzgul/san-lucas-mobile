import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../styles/colors';

function TabBarIcon({ name, nameFilled, focused, color }) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={focused ? (nameFilled || name) : name} size={moderateScale(22)} color={color} />
      <View style={[styles.activeDot, { opacity: focused ? 1 : 0 }]} />
    </View>
  );
}

export default function TabLayout() {
  const { user, profile, loading, isAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = verticalScale(60) + (Platform.OS === 'ios' ? insets.bottom : verticalScale(8));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (profile?.role === 'customer') {
      router.replace('/customer/(tabs)');
    }
  }, [user, profile, loading]);

  if (loading || !user || profile?.role === 'customer') return null;

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
        tabBarItemStyle: {
          paddingTop: verticalScale(4),
        },
      }}
    >
      <Tabs.Screen
        name="tables"
        options={{
          title: 'Masalar',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="grid-outline" nameFilled="grid" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Siparişler',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="receipt-outline" nameFilled="receipt" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Ürünler',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="cube-outline" nameFilled="cube" focused={focused} color={color} />
          ),
          href: isAdmin ? '/products' : null,
        }}
      />
      <Tabs.Screen
        name="ingredients"
        options={{
          title: 'Malzeme',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="flask-outline" nameFilled="flask" focused={focused} color={color} />
          ),
          href: isAdmin ? '/ingredients' : null,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Rapor',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="bar-chart-outline" nameFilled="bar-chart" focused={focused} color={color} />
          ),
          href: isAdmin ? '/reports' : null,
        }}
      />
      <Tabs.Screen
        name="employees"
        options={{
          title: 'Personel',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="people-outline" nameFilled="people" focused={focused} color={color} />
          ),
          href: isAdmin ? '/employees' : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="settings-outline" nameFilled="settings" focused={focused} color={color} />
          ),
          href: isAdmin ? '/settings' : null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: moderateScale(4),
    height: moderateScale(4),
    borderRadius: moderateScale(2),
    backgroundColor: colors.primary,
    marginTop: verticalScale(3),
  },
});
