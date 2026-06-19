import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { moderateScale, scale, verticalScale } from "react-native-size-matters";
import { useAuth } from "../hooks/useAuth";
import { colors } from "../styles/colors";

function PressableCard({ style, onPress, children }) {
  const scaleV = useSharedValue(1);
  const opacityV = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleV.value }],
    opacity: opacityV.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scaleV.value = withSpring(0.96, { damping: 18, stiffness: 280 });
        opacityV.value = withTiming(0.92, { duration: 120 });
      }}
      onPressOut={() => {
        scaleV.value = withTiming(1, { duration: 180 });
        opacityV.value = withTiming(1, { duration: 180 });
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Already-logged-in staff skip straight to the panel.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/(tabs)/tables");
    }
  }, [user, loading]);

  if (loading || user) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Background layer — solid forest tone until the hero image is added.
          Swap this View for <ImageBackground source={...}> later. */}
      <View style={styles.bg} />
      <View style={styles.bgOverlayTop} />
      <View style={styles.bgOverlayBottom} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.content}>
          {/* Brand anchor */}
          <View style={styles.brand}>
            <Ionicons
              name="leaf"
              size={moderateScale(36)}
              color={colors.surface}
              style={styles.brandIcon}
            />
            <Text style={styles.brandTitle}>SAN LUCAS</Text>
            <Text style={styles.brandTagline}>BOTANICAL ATELIER</Text>
          </View>

          {/* Action cards */}
          <View style={styles.actions}>
            {/* Customer Entry — primary glass card */}
            <PressableCard
              style={styles.customerCard}
              onPress={() =>
                Alert.alert("Yakında", "Müşteri girişi yakında aktif olacak.")
              }
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.customerIconWrap}>
                  <Ionicons
                    name="cafe"
                    size={moderateScale(22)}
                    color={colors.primary}
                  />
                </View>
                <Ionicons
                  name="arrow-forward"
                  size={moderateScale(20)}
                  color={colors.primary}
                  style={{ opacity: 0.4 }}
                />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.customerTitle}>Müşteri Girişi</Text>
                <Text style={styles.customerDesc}>
                  Dijital menümüzü keşfedin, sipariş verin ve özel deneyimlerle
                  puan kazanın.
                </Text>
              </View>
            </PressableCard>

            {/* Staff Entry — recessed glass card */}
            <PressableCard
              style={styles.staffCard}
              onPress={() => router.push("/login")}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.staffIconWrap}>
                  <Ionicons
                    name="storefront"
                    size={moderateScale(18)}
                    color={colors.onPrimaryContainer}
                  />
                </View>
                <Ionicons
                  name="arrow-forward"
                  size={moderateScale(20)}
                  color={colors.onPrimaryContainer}
                  style={{ opacity: 0.4 }}
                />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.staffTitle}>Garson Girişi</Text>
                <Text style={styles.staffDesc}>
                  Yetkili personel için masa yönetimi ve POS erişimi.
                </Text>
              </View>
            </PressableCard>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  root: {
    flex: 1,
    backgroundColor: colors.primary,
  },

  // Background stack — replace `bg` with an ImageBackground later.
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
  },
  bgOverlayTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "40%",
    backgroundColor: "rgba(5,26,15,0.4)",
  },
  bgOverlayBottom: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,26,15,0.55)",
  },

  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(32),
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },

  // Brand
  brand: {
    alignItems: "center",
    marginTop: verticalScale(40),
  },
  brandIcon: {
    marginBottom: verticalScale(12),
    opacity: 0.9,
  },
  brandTitle: {
    fontSize: moderateScale(38),
    fontWeight: "800",
    color: colors.surface,
    letterSpacing: scale(4),
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  brandTagline: {
    fontSize: moderateScale(10),
    fontWeight: "600",
    color: colors.inversePrimary || "#b4ccbb",
    letterSpacing: scale(3),
    marginTop: verticalScale(12),
  },

  // Action stack
  actions: {
    width: "100%",
    gap: verticalScale(16),
    marginBottom: verticalScale(16),
  },

  // Customer — primary glass card
  customerCard: {
    backgroundColor: "rgba(249,250,242,0.85)",
    borderRadius: moderateScale(16),
    padding: scale(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  customerIconWrap: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    backgroundColor: "rgba(226,227,219,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  customerTitle: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: -0.4,
    marginBottom: verticalScale(4),
  },
  customerDesc: {
    fontSize: moderateScale(13),
    color: colors.onSurfaceVariant,
    lineHeight: moderateScale(20),
  },

  // Staff — recessed glass card
  staffCard: {
    backgroundColor: "rgba(26,47,35,0.7)",
    borderRadius: moderateScale(16),
    padding: scale(20),
    borderWidth: 1,
    borderColor: "rgba(194,200,194,0.15)",
  },
  staffIconWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: "rgba(5,26,15,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  staffTitle: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: colors.surface,
    letterSpacing: -0.3,
    marginBottom: verticalScale(4),
  },
  staffDesc: {
    fontSize: moderateScale(13),
    color: colors.onPrimaryContainer,
    lineHeight: moderateScale(20),
    opacity: 0.9,
  },

  // Shared
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: verticalScale(14),
  },
  cardBody: {
    width: "100%",
  },
});
