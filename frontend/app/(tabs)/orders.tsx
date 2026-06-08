import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/lib/theme";
import { api } from "@/src/lib/api";

const STATUS_COLORS: Record<string, string> = {
  "Placed": "#F59E0B",
  "Picked Up": "#3B82F6",
  "Washing": "#8B5CF6",
  "Out for Delivery": "#06B6D4",
  "Delivered": "#10B981",
};

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "past">("active");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setOrders(await api.orders()); }
    catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const filtered = orders.filter((o) =>
    tab === "active" ? o.status !== "Delivered" : o.status === "Delivered"
  );

  if (loading) {
    return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>My Orders</Text>
        <View style={styles.tabs}>
          <TouchableOpacity testID="orders-tab-active" onPress={() => setTab("active")} style={[styles.tabBtn, tab === "active" && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === "active" && styles.tabTextActive]}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="orders-tab-past" onPress={() => setTab("past")} style={[styles.tabBtn, tab === "past" && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === "past" && styles.tabTextActive]}>Past</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Image source={{ uri: "https://static.prod-images.emergentagent.com/jobs/1644b8bc-ad0f-4fa8-890a-bd74752287e5/images/1fc15f02035de963451ebf9b899b58c8fa1cf60d65f8965809720dd235442245.png" }} style={styles.emptyImg} />
            <Text style={styles.emptyTitle}>No {tab} orders yet</Text>
            <Text style={styles.emptySub}>Schedule your first pickup from Home and we'll take it from there.</Text>
            <TouchableOpacity testID="orders-empty-cta" onPress={() => router.push("/(tabs)/home")} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>Browse Services</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const orderedOn = new Date(item.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
          const pickupDate = new Date(item.pickup_date);
          const deliveryDate = new Date(pickupDate.getTime() + 2 * 24 * 60 * 60 * 1000);
          const deliveryOn = deliveryDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
          return (
            <TouchableOpacity
              testID={`order-card-${item.id}`}
              onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
              style={styles.card} activeOpacity={0.8}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.orderNo}>#{item.order_no}</Text>
                <View style={[styles.statusPill, { backgroundColor: (STATUS_COLORS[item.status] || colors.primary) + "22" }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || colors.primary }]}>{item.status}</Text>
                </View>
              </View>
              <View style={styles.dateRow}>
                <View style={styles.dateCol}>
                  <Text style={styles.dateLabel}>Ordered</Text>
                  <Text style={styles.dateVal}>{orderedOn}</Text>
                </View>
                <View style={styles.dateDivider} />
                <View style={styles.dateCol}>
                  <Text style={styles.dateLabel}>Delivery</Text>
                  <Text style={styles.dateVal}>{deliveryOn}</Text>
                </View>
              </View>
              <Text style={styles.cardTotal}>₹{item.total}</Text>
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
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
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
