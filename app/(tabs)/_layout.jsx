import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../styles/colors';

function TabBarIcon({ name, color }) {
  return <Ionicons name={name} size={moderateScale(22)} color={color} />;
}

export default function TabLayout() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = verticalScale(56) + (Platform.OS === 'ios' ? insets.bottom : 0);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading]);

  if (loading || !user) return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : verticalScale(6),
          paddingTop: verticalScale(4),
        },
        tabBarLabelStyle: {
          fontSize: moderateScale(11),
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: colors.bgCard,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: moderateScale(17),
        },
      }}
    >
      <Tabs.Screen
        name="tables"
        options={{
          title: 'Masalar',
          tabBarIcon: ({ color }) => <TabBarIcon name="grid-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Siparişler',
          tabBarIcon: ({ color }) => <TabBarIcon name="receipt-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Ürünler',
          tabBarIcon: ({ color }) => <TabBarIcon name="cube-outline" color={color} />,
          href: isAdmin ? '/products' : null,
        }}
      />
      <Tabs.Screen
        name="ingredients"
        options={{
          title: 'Malzemeler',
          tabBarIcon: ({ color }) => <TabBarIcon name="flask-outline" color={color} />,
          href: isAdmin ? '/ingredients' : null,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Raporlar',
          tabBarIcon: ({ color }) => <TabBarIcon name="bar-chart-outline" color={color} />,
          href: isAdmin ? '/reports' : null,
        }}
      />
      <Tabs.Screen
        name="employees"
        options={{
          title: 'Çalışanlar',
          tabBarIcon: ({ color }) => <TabBarIcon name="people-outline" color={color} />,
          href: isAdmin ? '/employees' : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ color }) => <TabBarIcon name="settings-outline" color={color} />,
          href: isAdmin ? '/settings' : null,
        }}
      />
    </Tabs>
  );
}
