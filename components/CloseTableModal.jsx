import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { colors } from "../styles/colors";

const MODES = [
  { key: "single", label: "Tek", icon: "card-outline" },
  { key: "split", label: "Eşit Böl", icon: "people-outline" },
  { key: "custom", label: "Tutar Gir", icon: "create-outline" },
  { key: "item", label: "Ürün Ürün", icon: "basket-outline" },
];

function PressScale({ style, onPress, children, scaleTo = 0.97, disabled }) {
  const s = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
  }));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        s.value = withSpring(scaleTo, { damping: 18, stiffness: 280 });
      }}
      onPressOut={() => {
        s.value = withTiming(1, { duration: 160 });
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

function fmtMoney(v) {
  return `₺${Number(v || 0).toFixed(2)}`;
}

export function CloseTableModal({
  visible,
  order,
  table,
  onClose,
  onCompleted,
  getOrderPayments,
  addPayments,
}) {
  const [existingPayments, setExistingPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [mode, setMode] = useState("single");

  // single
  const [singleMethod, setSingleMethod] = useState("cash");

  // split
  const [splitCount, setSplitCount] = useState(2);
  const [splitMethod, setSplitMethod] = useState("cash");

  // custom drafts (not yet committed) — { id, amount, method, label }
  const [customDrafts, setCustomDrafts] = useState([]);
  const [draftAmount, setDraftAmount] = useState("");
  const [draftMethod, setDraftMethod] = useState("cash");
  const [draftLabel, setDraftLabel] = useState("");

  // item-by-item: { [itemId]: quantity_to_pay }
  const [itemSelections, setItemSelections] = useState({});
  const [itemMethod, setItemMethod] = useState("cash");

  const [submitting, setSubmitting] = useState(false);

  const items = order?.order_items || [];
  const total = Number(
    order?.total || items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
  );

  useEffect(() => {
    if (!visible || !order) return;
    setMode("single");
    setSingleMethod("cash");
    setSplitCount(2);
    setSplitMethod("cash");
    setCustomDrafts([]);
    setDraftAmount("");
    setDraftMethod("cash");
    setDraftLabel("");
    setItemSelections({});
    setItemMethod("cash");
    loadPayments();
  }, [visible, order?.id]);

  async function loadPayments() {
    if (!order?.id || !getOrderPayments) return;
    setLoadingPayments(true);
    try {
      const rows = await getOrderPayments(order.id);
      setExistingPayments(rows);
    } catch (e) {
      Alert.alert("Hata", "Ödemeler yüklenemedi: " + e.message);
    } finally {
      setLoadingPayments(false);
    }
  }

  const paidAlready = useMemo(
    () => existingPayments.reduce((s, p) => s + Number(p.amount), 0),
    [existingPayments],
  );
  const remaining = Math.max(total - paidAlready, 0);

  // Build the rows to commit based on mode
  const splitShare = useMemo(
    () => (splitCount > 0 ? remaining / splitCount : 0),
    [remaining, splitCount],
  );

  const draftsSum = useMemo(
    () => customDrafts.reduce((s, d) => s + Number(d.amount || 0), 0),
    [customDrafts],
  );

  const paymentsToCommit = useMemo(() => {
    if (mode === "single") {
      if (remaining <= 0) return [];
      return [{ amount: remaining, payment_method: singleMethod }];
    }
    if (mode === "split") {
      if (remaining <= 0 || splitCount <= 0) return [];
      // Distribute with rounding: last person absorbs the residue.
      const base = Math.floor((remaining / splitCount) * 100) / 100;
      const rows = [];
      let acc = 0;
      for (let i = 0; i < splitCount - 1; i++) {
        rows.push({
          amount: base,
          payment_method: splitMethod,
          payer_label: `Kişi ${i + 1}`,
        });
        acc += base;
      }
      rows.push({
        amount: Math.round((remaining - acc) * 100) / 100,
        payment_method: splitMethod,
        payer_label: `Kişi ${splitCount}`,
      });
      return rows;
    }
    if (mode === "custom") {
      return customDrafts.map((d) => ({
        amount: Number(d.amount),
        payment_method: d.method,
        payer_label: d.label || null,
      }));
    }
    if (mode === "item") {
      const parts = [];
      let sum = 0;
      for (const item of items) {
        const qty = Number(itemSelections[item.id] || 0);
        if (qty <= 0) continue;
        sum += qty * Number(item.unit_price);
        parts.push(`${qty}x ${item.products?.name || "Ürün"}`);
      }
      if (sum <= 0) return [];
      return [{
        amount: Math.round(sum * 100) / 100,
        payment_method: itemMethod,
        payer_label: parts.join(", ").slice(0, 200) || null,
      }];
    }
    return [];
  }, [mode, remaining, singleMethod, splitCount, splitMethod, customDrafts, items, itemSelections, itemMethod]);

  const commitAmount = paymentsToCommit.reduce((s, r) => s + r.amount, 0);
  const commitOverflow = commitAmount > remaining + 0.001;

  function addDraft() {
    const amt = parseFloat((draftAmount || "").replace(",", "."));
    if (!amt || amt <= 0) {
      Alert.alert("Hata", "Geçerli bir tutar girin.");
      return;
    }
    const draftsAfter = draftsSum + amt;
    if (draftsAfter > remaining + 0.001) {
      Alert.alert("Hata", `Kalan ${fmtMoney(remaining)} tutarı aşamaz.`);
      return;
    }
    setCustomDrafts((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        amount: amt,
        method: draftMethod,
        label: draftLabel.trim(),
      },
    ]);
    setDraftAmount("");
    setDraftLabel("");
  }

  function removeDraft(id) {
    setCustomDrafts((prev) => prev.filter((d) => d.id !== id));
  }

  function fillDraftRemaining() {
    const left = Math.max(remaining - draftsSum, 0);
    setDraftAmount(left.toFixed(2));
  }

  async function handleCommit() {
    if (paymentsToCommit.length === 0) {
      Alert.alert("Hata", "Tahsil edilecek tutar yok.");
      return;
    }
    if (commitOverflow) {
      Alert.alert("Hata", "Tahsilat tutarı kalandan fazla olamaz.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await addPayments(order.id, table.id, paymentsToCommit);
      if (result.completed) {
        onCompleted?.();
      } else {
        await loadPayments();
        if (mode === "custom") {
          setCustomDrafts([]);
          setDraftAmount("");
          setDraftLabel("");
        }
      }
    } catch (e) {
      Alert.alert("Hata", e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!order || !table) return null;

  const paidPercent =
    total > 0 ? Math.min((paidAlready / total) * 100, 100) : 0;
  const commitDisabled = submitting || commitAmount <= 0 || commitOverflow;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.backBtn} hitSlop={8}>
            <Ionicons
              name="chevron-back"
              size={moderateScale(24)}
              color={colors.primary}
            />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {table.name}
            </Text>
            <Text style={styles.headerSub}>Adisyon Kapat</Text>
          </View>
          <View style={styles.tablePill}>
            <Text style={styles.tablePillText}>#{order.id}</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Summary hero */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>KALAN BAKİYE</Text>
            <Text style={styles.summaryValue}>{fmtMoney(remaining)}</Text>

            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${paidPercent}%` }]}
              />
            </View>

            <View style={styles.summaryMetaRow}>
              <View style={styles.summaryMetaItem}>
                <Text style={styles.summaryMetaLabel}>TOPLAM</Text>
                <Text style={styles.summaryMetaValue}>{fmtMoney(total)}</Text>
              </View>
              <View style={styles.summaryMetaDivider} />
              <View style={styles.summaryMetaItem}>
                <Text style={styles.summaryMetaLabel}>ÖDENDİ</Text>
                <Text style={styles.summaryMetaValue}>
                  {fmtMoney(paidAlready)}
                </Text>
              </View>
            </View>
          </View>

          {/* Items recap */}
          {items.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>
                SİPARİŞ İÇERİĞİ · {items.length}
              </Text>
              <View style={styles.itemsCard}>
                {items.map((item, idx) => (
                  <View
                    key={item.id ?? idx}
                    style={[
                      styles.itemRow,
                      idx === 0 && { paddingTop: 0 },
                      idx === items.length - 1 && {
                        paddingBottom: 0,
                        borderBottomWidth: 0,
                      },
                    ]}
                  >
                    <View style={styles.qtyChip}>
                      <Text style={styles.qtyChipText}>{item.quantity}</Text>
                    </View>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.products?.name || "Ürün"}
                    </Text>
                    <Text style={styles.itemPrice}>
                      {fmtMoney(item.unit_price * item.quantity)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {remaining > 0 && (
            <>
              {/* Mode tabs */}
              <Text style={styles.sectionLabel}>ÖDEME ŞEKLİ</Text>
              <View style={styles.modeRow}>
                {MODES.map((m) => {
                  const active = mode === m.key;
                  return (
                    <PressScale
                      key={m.key}
                      style={[styles.modeChip, active && styles.modeChipActive]}
                      onPress={() => setMode(m.key)}
                      scaleTo={0.94}
                    >
                      <View
                        style={[
                          styles.modeChipIconWrap,
                          active && styles.modeChipIconWrapActive,
                        ]}
                      >
                        <Ionicons
                          name={m.icon}
                          size={moderateScale(16)}
                          color={active ? colors.onPrimary : colors.primary}
                        />
                      </View>
                      <Text
                        style={[
                          styles.modeChipText,
                          active && styles.modeChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {m.label}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>

              {/* Mode panel */}
              {mode === "single" && (
                <View style={styles.panel}>
                  <Text style={styles.panelTitle}>Tek Ödeme</Text>
                  <Text style={styles.panelSub}>
                    Kalan {fmtMoney(remaining)} tutarı tek seferde tahsil
                    edilecek.
                  </Text>
                  <View style={styles.methodRow}>
                    <MethodButton
                      method="cash"
                      active={singleMethod === "cash"}
                      onPress={() => setSingleMethod("cash")}
                    />
                    <MethodButton
                      method="card"
                      active={singleMethod === "card"}
                      onPress={() => setSingleMethod("card")}
                    />
                  </View>
                </View>
              )}

              {mode === "split" && (
                <View style={styles.panel}>
                  <Text style={styles.panelTitle}>Eşit Böl</Text>
                  <Text style={styles.panelSub}>
                    Kalanı eşit parçalara böl. Yuvarlama farkı son kişiye
                    eklenir.
                  </Text>

                  <View style={styles.stepperWrap}>
                    <Text style={styles.stepperLabel}>KİŞİ SAYISI</Text>
                    <View style={styles.stepper}>
                      <Pressable
                        onPress={() => setSplitCount((c) => Math.max(2, c - 1))}
                        style={styles.stepperBtn}
                      >
                        <Ionicons
                          name="remove"
                          size={moderateScale(18)}
                          color={colors.primary}
                        />
                      </Pressable>
                      <Text style={styles.stepperValue}>{splitCount}</Text>
                      <Pressable
                        onPress={() =>
                          setSplitCount((c) => Math.min(20, c + 1))
                        }
                        style={styles.stepperBtn}
                      >
                        <Ionicons
                          name="add"
                          size={moderateScale(18)}
                          color={colors.primary}
                        />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.shareBox}>
                    <Text style={styles.shareLabel}>KİŞİ BAŞI</Text>
                    <Text style={styles.shareValue}>
                      {fmtMoney(splitShare)}
                    </Text>
                  </View>

                  <View style={styles.methodRow}>
                    <MethodButton
                      method="cash"
                      active={splitMethod === "cash"}
                      onPress={() => setSplitMethod("cash")}
                    />
                    <MethodButton
                      method="card"
                      active={splitMethod === "card"}
                      onPress={() => setSplitMethod("card")}
                    />
                  </View>
                </View>
              )}

              {mode === "custom" && (
                <View style={styles.panel}>
                  <Text style={styles.panelTitle}>Tutar Gir</Text>
                  <Text style={styles.panelSub}>
                    Her kişi için ayrı tutar ekleyin. Toplam kalanı geçemez.
                  </Text>

                  {customDrafts.length > 0 && (
                    <View style={styles.draftsList}>
                      {customDrafts.map((d, i) => (
                        <View
                          key={d.id}
                          style={[
                            styles.draftRow,
                            i === customDrafts.length - 1 && {
                              borderBottomWidth: 0,
                            },
                          ]}
                        >
                          <View style={styles.draftMethodIcon}>
                            <Ionicons
                              name={
                                d.method === "cash"
                                  ? "cash-outline"
                                  : "card-outline"
                              }
                              size={moderateScale(14)}
                              color={colors.primary}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.draftAmount}>
                              {fmtMoney(d.amount)}
                            </Text>
                            {d.label ? (
                              <Text style={styles.draftLabel}>{d.label}</Text>
                            ) : (
                              <Text style={styles.draftLabel}>
                                {d.method === "cash" ? "Nakit" : "Kart"}
                              </Text>
                            )}
                          </View>
                          <Pressable
                            onPress={() => removeDraft(d.id)}
                            style={styles.draftRemove}
                            hitSlop={6}
                          >
                            <Ionicons
                              name="close"
                              size={moderateScale(15)}
                              color={colors.error}
                            />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>TUTAR</Text>
                  <View style={styles.amountRow}>
                    <TextInput
                      style={styles.fieldInput}
                      value={draftAmount}
                      onChangeText={setDraftAmount}
                      placeholder="0.00"
                      placeholderTextColor={colors.outline}
                      keyboardType="decimal-pad"
                    />
                    <PressScale
                      style={styles.fillBtn}
                      onPress={fillDraftRemaining}
                      scaleTo={0.94}
                    >
                      <Text style={styles.fillBtnText}>Kalan</Text>
                    </PressScale>
                  </View>

                  <Text style={styles.fieldLabel}>ETİKET (OPSİYONEL)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={draftLabel}
                    onChangeText={setDraftLabel}
                    placeholder="Örn. Müşteri 1, Ali"
                    placeholderTextColor={colors.outline}
                  />

                  <View style={styles.methodRow}>
                    <MethodButton
                      method="cash"
                      active={draftMethod === "cash"}
                      onPress={() => setDraftMethod("cash")}
                    />
                    <MethodButton
                      method="card"
                      active={draftMethod === "card"}
                      onPress={() => setDraftMethod("card")}
                    />
                  </View>

                  <PressScale
                    style={styles.addDraftBtn}
                    onPress={addDraft}
                    scaleTo={0.97}
                  >
                    <Ionicons
                      name="add"
                      size={moderateScale(16)}
                      color={colors.primary}
                    />
                    <Text style={styles.addDraftText}>Ödemeye Ekle</Text>
                  </PressScale>
                </View>
              )}

              {mode === "item" && (
                <View style={styles.panel}>
                  <Text style={styles.panelTitle}>Ürün Ürün Öde</Text>
                  <Text style={styles.panelSub}>
                    Ödenecek ürünleri ve adetlerini seçin. Toplam yalnızca seçim
                    tutarı kadar tahsil edilir.
                  </Text>

                  <View style={styles.itemPickList}>
                    {items.map((it, idx) => {
                      const sel = Number(itemSelections[it.id] || 0);
                      const max = Number(it.quantity);
                      const lineTotal = sel * Number(it.unit_price);
                      return (
                        <View
                          key={it.id ?? idx}
                          style={[
                            styles.itemPickRow,
                            idx === items.length - 1 && { borderBottomWidth: 0 },
                          ]}
                        >
                          <Pressable
                            onPress={() =>
                              setItemSelections(prev => ({
                                ...prev,
                                [it.id]: sel > 0 ? 0 : max,
                              }))
                            }
                            hitSlop={6}
                          >
                            <Ionicons
                              name={sel > 0 ? "checkbox" : "square-outline"}
                              size={moderateScale(22)}
                              color={sel > 0 ? colors.secondary : colors.outline}
                            />
                          </Pressable>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemPickName} numberOfLines={1}>
                              {it.products?.name || "Ürün"}
                            </Text>
                            <Text style={styles.itemPickPrice}>
                              {fmtMoney(it.unit_price)} · {max} adet
                            </Text>
                          </View>
                          <View style={styles.itemPickStepper}>
                            <Pressable
                              onPress={() =>
                                setItemSelections(prev => ({
                                  ...prev,
                                  [it.id]: Math.max(0, sel - 1),
                                }))
                              }
                              style={styles.itemPickBtn}
                            >
                              <Ionicons
                                name="remove"
                                size={moderateScale(16)}
                                color={colors.primary}
                              />
                            </Pressable>
                            <Text style={styles.itemPickQty}>{sel}</Text>
                            <Pressable
                              onPress={() =>
                                setItemSelections(prev => ({
                                  ...prev,
                                  [it.id]: Math.min(max, sel + 1),
                                }))
                              }
                              style={styles.itemPickBtn}
                            >
                              <Ionicons
                                name="add"
                                size={moderateScale(16)}
                                color={colors.primary}
                              />
                            </Pressable>
                          </View>
                          <Text style={styles.itemPickLineTotal}>
                            {fmtMoney(lineTotal)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.methodRow}>
                    <MethodButton
                      method="cash"
                      active={itemMethod === "cash"}
                      onPress={() => setItemMethod("cash")}
                    />
                    <MethodButton
                      method="card"
                      active={itemMethod === "card"}
                      onPress={() => setItemMethod("card")}
                    />
                  </View>
                </View>
              )}
            </>
          )}

          {/* Existing payments from previous sessions */}
          {existingPayments.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>
                {loadingPayments
                  ? "YÜKLENİYOR..."
                  : `KAYITLI ÖDEMELER · ${existingPayments.length}`}
              </Text>
              <View style={styles.historyCard}>
                {existingPayments.map((p, i) => (
                  <View
                    key={p.id}
                    style={[
                      styles.historyRow,
                      i === 0 && { paddingTop: 0 },
                      i === existingPayments.length - 1 && {
                        paddingBottom: 0,
                        borderBottomWidth: 0,
                      },
                    ]}
                  >
                    <View style={styles.historyMethodIcon}>
                      <Ionicons
                        name={
                          p.payment_method === "cash"
                            ? "cash-outline"
                            : "card-outline"
                        }
                        size={moderateScale(13)}
                        color={colors.secondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyAmount}>
                        {fmtMoney(p.amount)}
                      </Text>
                      <Text style={styles.historyLabel}>
                        {p.payer_label ||
                          (p.payment_method === "cash" ? "Nakit" : "Kart")}
                      </Text>
                    </View>
                    <Ionicons
                      name="checkmark-circle"
                      size={moderateScale(16)}
                      color={colors.secondary}
                    />
                  </View>
                ))}
              </View>
            </>
          )}

          {remaining <= 0 && existingPayments.length > 0 && (
            <View style={styles.completedBanner}>
              <Ionicons
                name="checkmark-circle"
                size={moderateScale(20)}
                color={colors.secondary}
              />
              <Text style={styles.completedText}>Adisyon tamamen ödenmiş.</Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom action bar */}
        {remaining > 0 && (
          <View style={styles.bottomBar}>
            <View style={styles.bottomLeftCol}>
              <Text style={styles.bottomLabel}>TAHSİL EDİLECEK</Text>
              <Text
                style={[
                  styles.bottomAmount,
                  commitOverflow && { color: colors.error },
                ]}
              >
                {fmtMoney(commitAmount)}
              </Text>
            </View>
            <PressScale
              style={[styles.commitBtn, commitDisabled && { opacity: 0.5 }]}
              onPress={commitDisabled ? undefined : handleCommit}
              disabled={commitDisabled}
              scaleTo={0.96}
            >
              {submitting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark"
                    size={moderateScale(20)}
                    color={colors.onPrimary}
                  />
                  <Text style={styles.commitBtnText}>
                    {commitAmount >= remaining - 0.001
                      ? "Tahsil & Kapat"
                      : "Tahsil Et"}
                  </Text>
                </>
              )}
            </PressScale>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function MethodButton({ method, active, onPress }) {
  const isCash = method === "cash";
  return (
    <PressScale
      style={[styles.methodBtn, active && styles.methodBtnActive]}
      onPress={onPress}
      scaleTo={0.96}
    >
      <View
        style={[styles.methodIconWrap, active && styles.methodIconWrapActive]}
      >
        <Ionicons
          name={isCash ? "cash-outline" : "card-outline"}
          size={moderateScale(22)}
          color={active ? colors.onPrimary : colors.primary}
        />
      </View>
      <Text
        style={[styles.methodBtnText, active && styles.methodBtnTextActive]}
        numberOfLines={1}
      >
        {isCash ? "Nakit" : "Kart"}
      </Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    gap: scale(10),
  },
  backBtn: { padding: scale(4) },
  headerTitle: {
    fontSize: moderateScale(18),
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: moderateScale(11),
    color: colors.outline,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: verticalScale(1),
  },
  tablePill: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(999),
  },
  tablePillText: {
    color: colors.secondary,
    fontSize: moderateScale(11),
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  body: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(40),
    gap: verticalScale(16),
  },

  sectionLabel: {
    fontSize: moderateScale(10),
    fontWeight: "800",
    letterSpacing: 2,
    color: colors.onSurfaceVariant,
    opacity: 0.6,
    marginBottom: verticalScale(-8),
  },

  // Summary card
  summaryCard: {
    backgroundColor: colors.primaryContainer,
    borderRadius: moderateScale(20),
    padding: scale(22),
  },
  summaryLabel: {
    fontSize: moderateScale(10),
    fontWeight: "800",
    letterSpacing: 2,
    color: colors.onPrimaryContainer,
    opacity: 0.7,
    marginBottom: verticalScale(6),
  },
  summaryValue: {
    fontSize: moderateScale(36),
    fontWeight: "800",
    color: colors.surface,
    letterSpacing: -1,
  },
  progressTrack: {
    height: verticalScale(6),
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: moderateScale(999),
    marginTop: verticalScale(14),
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.secondaryContainer,
    borderRadius: moderateScale(999),
  },
  summaryMetaRow: {
    flexDirection: "row",
    marginTop: verticalScale(14),
  },
  summaryMetaItem: { flex: 1 },
  summaryMetaLabel: {
    fontSize: moderateScale(9),
    fontWeight: "800",
    letterSpacing: 1.5,
    color: colors.onPrimaryContainer,
    opacity: 0.6,
    marginBottom: verticalScale(2),
  },
  summaryMetaValue: {
    fontSize: moderateScale(15),
    fontWeight: "800",
    color: colors.surface,
    letterSpacing: -0.3,
  },
  summaryMetaDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: scale(14),
  },

  // Items card
  itemsCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(16),
    padding: scale(16),
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    paddingVertical: verticalScale(8),
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  qtyChip: {
    minWidth: moderateScale(26),
    height: moderateScale(24),
    paddingHorizontal: scale(5),
    borderRadius: moderateScale(12),
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyChipText: {
    fontSize: moderateScale(11),
    fontWeight: "800",
    color: colors.primary,
  },
  itemName: {
    flex: 1,
    fontSize: moderateScale(13),
    color: colors.onSurface,
    fontWeight: "600",
  },
  itemPrice: {
    fontSize: moderateScale(13),
    fontWeight: "800",
    color: colors.secondary,
  },

  // Mode tabs (vertical card style — icon over label so Turkish labels never clip)
  modeRow: { flexDirection: "row", gap: scale(4) },
  modeChip: {
    flex: 1,
    minHeight: verticalScale(40),
    minWidth: verticalScale(60),
    alignItems: "center",
    justifyContent: "center",
    gap: verticalScale(8),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(8),
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(16),
  },
  modeChipActive: { backgroundColor: colors.primary },
  modeChipIconWrap: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: "center",
    justifyContent: "center",
  },
  modeChipIconWrapActive: { backgroundColor: "rgba(255,255,255,0.16)" },
  modeChipText: {
    fontSize: moderateScale(12),
    fontWeight: "800",
    color: colors.onSurfaceVariant,
    letterSpacing: -0.1,
  },
  modeChipTextActive: { color: colors.onPrimary },

  // Panel
  panel: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(16),
    paddingVertical: scale(18),
    paddingHorizontal: scale(12),
    gap: verticalScale(14),
  },
  panelTitle: {
    fontSize: moderateScale(15),
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: -0.2,
  },
  panelSub: {
    fontSize: moderateScale(12),
    color: colors.onSurfaceVariant,
    lineHeight: moderateScale(17),
    marginTop: verticalScale(-10),
  },

  methodRow: { flexDirection: "row", gap: scale(10) },
  methodBtn: {
    flex: 1,
    minHeight: verticalScale(96),
    minWidth: verticalScale(110),
    alignItems: "center",
    justifyContent: "center",
    gap: verticalScale(10),
    paddingVertical: verticalScale(18),
    paddingHorizontal: scale(20),
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: moderateScale(16),
  },
  methodBtnActive: { backgroundColor: colors.primary },
  methodIconWrap: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  methodIconWrapActive: { backgroundColor: "rgba(255,255,255,0.16)" },
  methodBtnText: {
    fontSize: moderateScale(14),
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: -0.2,
  },
  methodBtnTextActive: { color: colors.onPrimary },

  // Stepper (split mode)
  stepperWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepperLabel: {
    fontSize: moderateScale(11),
    fontWeight: "800",
    letterSpacing: 1.2,
    color: colors.onSurfaceVariant,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(4),
    paddingVertical: verticalScale(2),
    gap: scale(2),
  },
  stepperBtn: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: moderateScale(17),
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    minWidth: scale(40),
    textAlign: "center",
    fontSize: moderateScale(16),
    fontWeight: "800",
    color: colors.primary,
  },
  shareBox: {
    backgroundColor: colors.secondaryContainer,
    borderRadius: moderateScale(12),
    padding: scale(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shareLabel: {
    fontSize: moderateScale(10),
    fontWeight: "800",
    letterSpacing: 1.5,
    color: colors.secondary,
  },
  shareValue: {
    fontSize: moderateScale(20),
    fontWeight: "800",
    color: colors.secondary,
    letterSpacing: -0.3,
  },

  // Custom (drafts)
  draftsList: {
    backgroundColor: colors.surface,
    borderRadius: moderateScale(12),
    padding: scale(12),
  },
  draftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    paddingVertical: verticalScale(8),
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  draftMethodIcon: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    backgroundColor: colors.secondaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  draftAmount: {
    fontSize: moderateScale(14),
    fontWeight: "800",
    color: colors.primary,
  },
  draftLabel: {
    fontSize: moderateScale(11),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(1),
  },
  draftRemove: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    backgroundColor: colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
  },

  fieldLabel: {
    fontSize: moderateScale(10),
    fontWeight: "800",
    letterSpacing: 1.5,
    color: colors.onSurfaceVariant,
    marginBottom: verticalScale(6),
  },
  fieldInput: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
    fontSize: moderateScale(15),
    color: colors.onSurface,
    fontWeight: "700",
  },
  amountRow: { flexDirection: "row", gap: scale(8), alignItems: "center" },
  fillBtn: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(12),
  },
  fillBtnText: {
    fontSize: moderateScale(12),
    fontWeight: "800",
    color: colors.secondary,
    letterSpacing: 0.3,
  },
  addDraftBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(6),
    paddingVertical: verticalScale(12),
    backgroundColor: colors.secondaryContainer,
    borderRadius: moderateScale(12),
  },
  addDraftText: {
    fontSize: moderateScale(13),
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0.3,
  },

  // Item-by-item payment
  itemPickList: {
    backgroundColor: colors.surface,
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(10),
  },
  itemPickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    paddingVertical: verticalScale(10),
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  itemPickName: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: colors.onSurface,
  },
  itemPickPrice: {
    fontSize: moderateScale(11),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(2),
  },
  itemPickStepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(2),
    paddingVertical: verticalScale(2),
    gap: scale(2),
  },
  itemPickBtn: {
    width: moderateScale(26),
    height: moderateScale(26),
    alignItems: "center",
    justifyContent: "center",
  },
  itemPickQty: {
    minWidth: scale(20),
    textAlign: "center",
    fontSize: moderateScale(13),
    fontWeight: "800",
    color: colors.primary,
  },
  itemPickLineTotal: {
    minWidth: scale(56),
    textAlign: "right",
    fontSize: moderateScale(12),
    fontWeight: "800",
    color: colors.secondary,
  },

  // History (existing payments)
  historyCard: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: moderateScale(16),
    padding: scale(16),
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    paddingVertical: verticalScale(8),
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  historyMethodIcon: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
    backgroundColor: colors.secondaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  historyAmount: {
    fontSize: moderateScale(13),
    fontWeight: "800",
    color: colors.primary,
  },
  historyLabel: {
    fontSize: moderateScale(11),
    color: colors.onSurfaceVariant,
    marginTop: verticalScale(1),
  },

  completedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(14),
  },
  completedText: {
    fontSize: moderateScale(13),
    fontWeight: "800",
    color: colors.secondary,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(16),
    backgroundColor: "rgba(249,250,242,0.96)",
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 12,
  },
  bottomLeftCol: { flex: 1 },
  bottomLabel: {
    fontSize: moderateScale(9),
    fontWeight: "800",
    letterSpacing: 1.5,
    color: colors.onSurfaceVariant,
    opacity: 0.6,
  },
  bottomAmount: {
    fontSize: moderateScale(22),
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: -0.5,
    marginTop: verticalScale(2),
  },
  commitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(8),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(14),
    backgroundColor: colors.primary,
    borderRadius: moderateScale(14),
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  commitBtnText: {
    fontSize: moderateScale(14),
    fontWeight: "800",
    color: colors.onPrimary,
    letterSpacing: 0.3,
  },
});
