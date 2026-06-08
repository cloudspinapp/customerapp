import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "@/src/lib/theme";
import { cloudspin, CloudspinOrder } from "@/src/lib/cloudspin";
import { storage } from "@/src/utils/storage";

// Map upstream status text -> pill colour. Any unknown status falls back to primary.
const STATUS_COLORS: Record<string, string> = {
  // active
  "Placed":           "#F59E0B",
  "Order Generated":  "#F59E0B",
  "Pickup Scheduled": "#F59E0B",
  "Picked Up":        "#3B82F6",
  "Washing":          "#8B5CF6",
  "In Process":       "#8B5CF6",
  "Ready":            "#06B6D4",
  "Out for Delivery": "#06B6D4",
  // past / settled
  "Delivered":             "#10B981",
  "Delivered & No Due":    "#10B981",
  "Collected & No Due":    "#10B981",
  "Cancelled":             "#EF4444",
};

function parseDate(s?: string) {
  if (!s) return null;
  // Upstream format: "YYYY-MM-DD HH:MM:SS" -> make it ISO-friendly for cross-platform parsing.
  const iso = s.replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(s?: string) {
  const d = parseDate(s);
  if (!d) return "-";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "past">("active");
  const [orders, setOrders] = useState<CloudspinOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errMsg, setErrMsg] = useState<string>("");

  const load = useCallback(async (which: "active" | "past") => {
    try {
      setErrMsg("");
      const cid = await storage.getItem<string>("cloudspin_customer_id", "");
      if (!cid) { setOrders([]); setErrMsg("Please log in to view your orders."); return; }
      const res = await cloudspin.listOrders(cid, which);
      if (res.status && Array.isArray(res.data)) setOrders(res.data);
      else { setOrders([]); if (res.message) setErrMsg(res.message); }
    } catch (e: any) {
      setOrders([]);
      setErrMsg(e?.message || "Could not load orders");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(tab); }, [load, tab]));

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]} testID="orders-loading">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>My Orders</Text>
        <View style={styles.tabs}>
          <TouchableOpacity
            testID="orders-tab-active"
            onPress={() => { if (tab !== "active") { setTab("active"); setLoading(true); } }}
            style={[styles.tabBtn, tab === "active" && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === "active" && styles.tabTextActive]}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="orders-tab-past"
            onPress={() => { if (tab !== "past") { setTab("past"); setLoading(true); } }}
            style={[styles.tabBtn, tab === "past" && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, tab === "past" && styles.tabTextActive]}>Past</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(it) => it.ID}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(tab); }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty} testID="orders-empty">
            <Image
              source={{ uri: "https://static.prod-images.emergentagent.com/jobs/1644b8bc-ad0f-4fa8-890a-bd74752287e5/images/1fc15f02035de963451ebf9b899b58c8fa1cf60d65f8965809720dd235442245.png" }}
              style={styles.emptyImg}
            />
            <Text style={styles.emptyTitle}>No {tab} orders yet</Text>
            <Text style={styles.emptySub}>
              {errMsg || "Schedule your first pickup from Home and we'll take it from there."}
            </Text>
            <TouchableOpacity testID="orders-empty-cta" onPress={() => router.push("/(tabs)/home")} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Browse Services</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const amt = Number(item.final_amount || 0);
          const color = STATUS_COLORS[item.order_status] || colors.primary;
          return (
            <TouchableOpacity
              testID={`order-card-${item.ID}`}
              onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.ID } })}
              style={styles.card}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.orderNo}>#{item.order_no}</Text>
                <View style={[styles.statusPill, { backgroundColor: color + "22" }]}>
                  <Text style={[styles.statusText, { color }]} numberOfLines={1}>{item.order_status}</Text>
                </View>
              </View>
              <View style={styles.dateRow}>
                <View style={styles.dateCol}>
                  <Text style={styles.dateLabel}>Ordered</Text>
                  <Text style={styles.dateVal}>{fmtDate(item.created_date)}</Text>
                </View>
                <View style={styles.dateDivider} />
                <View style={styles.dateCol}>
                  <Text style={styles.dateLabel}>Delivery</Text>
                  <Text style={styles.dateVal}>{fmtDate(item.delivery_date)}</Text>
                </View>
              </View>
              {amt > 0 && <Text style={styles.cardTotal}>₹{amt}</Text>}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  tabs: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 999, marginTop: 16, padding: 4, borderWidth: 1, borderColor: colors.borderLight },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  tabBtnActive: { backgroundColor: colors.text },
  tabText: { color: colors.textSecondary, fontWeight: "600", fontSize: 14 },
  tabTextActive: { color: "#fff" },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 18, marginTop: 12, borderWidth: 1, borderColor: colors.borderLight },
  orderNo: { fontSize: 16, fontWeight: "700", color: colors.text },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, maxWidth: 200 },
  statusText: { fontSize: 12, fontWeight: "700" },
  dateRow: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.borderLight },
  dateCol: { flex: 1, alignItems: "center" },
  dateDivider: { width: 1, height: 28, backgroundColor: colors.borderLight },
  dateLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  dateVal: { fontSize: 14, color: colors.text, fontWeight: "700", marginTop: 4 },
  cardTotal: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: 14, textAlign: "center" },
  empty: { alignItems: "center", padding: 40 },
  emptyImg: { width: 140, height: 140, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 4 },
  emptySub: { fontSize: 14, color: colors.textSecondary, marginTop: 6, textAlign: "center" },
  emptyBtn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999, marginTop: 20 },
  emptyBtnText: { color: "#fff", fontWeight: "700" },
});
