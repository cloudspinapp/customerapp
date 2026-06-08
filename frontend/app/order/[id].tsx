import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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

// Column widths for the invoice table
const COL = {
  service: 100,
  particulars: 160,
  qty: 70,
  pieces: 60,
  rate: 60,
  subtotal: 80,
  discount: 70,
  total: 70,
};

export default function OrderDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setOrder(await api.order(String(id))); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!order) return <View style={[styles.center, { paddingTop: insets.top }]}><Text>Order not found</Text></View>;

  const orderedOn = new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const pickupDate = new Date(order.pickup_date);
  const deliveryDate = new Date(pickupDate.getTime() + 2 * 24 * 60 * 60 * 1000);
  const deliveryOn = deliveryDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const subtotalSum = order.items.reduce((acc: number, i: any) => acc + i.price * i.quantity, 0);
  const discountSum = 0;
  const totalSum = subtotalSum - discountSum;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity testID="order-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{order.order_no}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
        {/* Status pill + dates */}
        <View style={styles.metaCard}>
          <View style={[styles.statusPill, { backgroundColor: (STATUS_COLORS[order.status] || colors.primary) + "22" }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[order.status] || colors.primary }]}>{order.status}</Text>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Ordered</Text>
              <Text style={styles.metaVal}>{orderedOn}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Delivery</Text>
              <Text style={styles.metaVal}>{deliveryOn}</Text>
            </View>
          </View>
        </View>

        {/* Invoice Table */}
        <Text style={styles.sectionTitle}>Item Details</Text>
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              {/* Header */}
              <View style={[styles.row, styles.headRow]}>
                <Text style={[styles.cell, styles.headCell, { width: COL.service }]}>Service</Text>
                <Text style={[styles.cell, styles.headCell, { width: COL.particulars }]}>Particular's</Text>
                <Text style={[styles.cell, styles.headCell, { width: COL.qty, textAlign: "center" }]}>Qty</Text>
                <Text style={[styles.cell, styles.headCell, { width: COL.pieces, textAlign: "center" }]}>Pieces</Text>
                <Text style={[styles.cell, styles.headCell, { width: COL.rate, textAlign: "right" }]}>Rate</Text>
                <Text style={[styles.cell, styles.headCell, { width: COL.subtotal, textAlign: "right" }]}>Subtotal</Text>
                <Text style={[styles.cell, styles.headCell, { width: COL.discount, textAlign: "right" }]}>Discount</Text>
                <Text style={[styles.cell, styles.headCell, { width: COL.total, textAlign: "right" }]}>Total</Text>
              </View>

              {/* Rows */}
              {order.items.map((it: any, idx: number) => {
                const sub = it.price * it.quantity;
                const dis = 0;
                const tot = sub - dis;
                return (
                  <View key={idx} style={styles.row}>
                    <Text style={[styles.cell, styles.bodyCell, { width: COL.service }]} numberOfLines={2}>{it.service_name}</Text>
                    <Text style={[styles.cell, styles.bodyCell, { width: COL.particulars }]} numberOfLines={2}>{it.particulars || it.service_name}</Text>
                    <Text style={[styles.cell, styles.bodyCell, { width: COL.qty, textAlign: "center" }]}>{it.quantity} {it.quantity > 1 ? "Pieces" : "Piece"}</Text>
                    <Text style={[styles.cell, styles.bodyCell, { width: COL.pieces, textAlign: "center" }]}>{it.quantity}</Text>
                    <Text style={[styles.cell, styles.bodyCell, { width: COL.rate, textAlign: "right" }]}>{it.price}</Text>
                    <Text style={[styles.cell, styles.bodyCell, { width: COL.subtotal, textAlign: "right" }]}>{sub}</Text>
                    <Text style={[styles.cell, styles.bodyCell, { width: COL.discount, textAlign: "right" }]}>{dis}</Text>
                    <Text style={[styles.cell, styles.bodyCell, { width: COL.total, textAlign: "right", fontWeight: "700" }]}>{tot}</Text>
                  </View>
                );
              })}

              {/* Footer totals */}
              <View style={[styles.row, styles.totalRow]}>
                <Text style={[styles.cell, styles.totalLabel, { width: COL.service + COL.particulars + COL.qty + COL.pieces + COL.rate, textAlign: "right", paddingRight: 12 }]}>Grand Total</Text>
                <Text style={[styles.cell, styles.bodyCell, { width: COL.subtotal, textAlign: "right", fontWeight: "700" }]}>{subtotalSum}</Text>
                <Text style={[styles.cell, styles.bodyCell, { width: COL.discount, textAlign: "right", fontWeight: "700" }]}>{discountSum}</Text>
                <Text style={[styles.cell, styles.bodyCell, { width: COL.total, textAlign: "right", fontWeight: "700", color: colors.primary }]}>₹{totalSum}</Text>
              </View>
            </View>
          </ScrollView>
          <Text style={styles.scrollHint}>← swipe to see all columns →</Text>
        </View>

        {/* Pickup Address */}
        <Text style={styles.sectionTitle}>Pickup Address</Text>
        <View style={styles.addrCard}>
          <Text style={styles.addrLabel}>{order.address.label} • {order.address.full_name}</Text>
          <Text style={styles.addrLine}>+91 {order.address.phone}</Text>
          <Text style={styles.addrLine}>{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ""}</Text>
          <Text style={styles.addrLine}>{order.address.city} - {order.address.pincode}</Text>
          {order.address.landmark ? <Text style={styles.addrLine}>Landmark: {order.address.landmark}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },

  metaCard: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: colors.borderLight },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, alignSelf: "flex-start" },
  statusText: { fontSize: 12, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.borderLight },
  metaCol: { flex: 1, alignItems: "center" },
  metaDivider: { width: 1, height: 28, backgroundColor: colors.borderLight },
  metaLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  metaVal: { fontSize: 14, color: colors.text, fontWeight: "700", marginTop: 4 },

  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textSecondary, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" },
  tableCard: { backgroundColor: colors.surface, borderRadius: radius.card, marginBottom: 20, borderWidth: 1, borderColor: colors.borderLight, paddingVertical: 8 },
  row: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight, alignItems: "center" },
  headRow: { backgroundColor: colors.bg, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  totalRow: { backgroundColor: colors.primaryLight, borderBottomWidth: 0 },
  cell: { fontSize: 13, paddingHorizontal: 10 },
  headCell: { color: colors.textSecondary, fontWeight: "700", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  bodyCell: { color: colors.text },
  totalLabel: { color: colors.text, fontWeight: "700", fontSize: 13 },
  scrollHint: { color: colors.textDisabled, fontSize: 11, textAlign: "center", marginTop: 6, fontStyle: "italic" },

  addrCard: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.borderLight },
  addrLabel: { color: colors.text, fontWeight: "700", fontSize: 14 },
  addrLine: { color: colors.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
});
