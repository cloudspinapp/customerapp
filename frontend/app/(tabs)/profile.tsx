import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/lib/theme";
import { api, clearAuth, getUser } from "@/src/lib/api";
import { cloudspin } from "@/src/lib/cloudspin";
import { storage } from "@/src/utils/storage";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [addrCount, setAddrCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);

  const load = useCallback(async () => {
    const [u, cid, o] = await Promise.all([
      getUser(),
      storage.getItem<string>("cloudspin_customer_id", ""),
      api.orders().catch(() => []),
    ]);
    setUser(u);
    setOrderCount(o.length);
    if (cid) {
      try {
        const res = await cloudspin.listAddresses(cid);
        setAddrCount(res.status && Array.isArray(res.data) ? res.data.length : 0);
      } catch { setAddrCount(0); }
    } else {
      setAddrCount(0);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const logout = async () => {
    await clearAuth();
    if (Platform.OS === "web") {
      // Force a clean reload so the (tabs) stack is fully torn down
      if (typeof window !== "undefined") {
        window.location.href = "/auth/phone";
        return;
      }
    }
    router.replace("/auth/phone");
  };

  const MenuItem = ({ icon, label, value, onPress, testID }: any) => (
    <TouchableOpacity testID={testID} onPress={onPress} style={styles.menuItem} activeOpacity={0.7}>
      <View style={styles.menuIcon}><Ionicons name={icon} size={20} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        {value !== undefined && <Text style={styles.menuValue}>{value}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={colors.primary} />
        </View>
        <Text style={styles.name}>{user?.name || "Welcome"}</Text>
        <Text style={styles.phone}>+91 {user?.phone || ""}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statNum}>{orderCount}</Text><Text style={styles.statLabel}>Orders</Text></View>
        <View style={styles.statCard}><Text style={styles.statNum}>{addrCount}</Text><Text style={styles.statLabel}>Addresses</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <MenuItem testID="profile-addresses" icon="location-outline" label="Saved Addresses" value={`${addrCount} saved`} onPress={() => router.push("/address")} />
        <MenuItem testID="profile-orders" icon="receipt-outline" label="Past Orders" value={`${orderCount} total`} onPress={() => router.push("/(tabs)/orders")} />
        <MenuItem testID="profile-notifications" icon="notifications-outline" label="Notifications" onPress={() => router.push("/(tabs)/notifications")} />
      </View>

      <TouchableOpacity testID="profile-logout" onPress={logout} style={styles.logoutBtn}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingBottom: 24, paddingHorizontal: 20, backgroundColor: colors.surface },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  name: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 12 },
  phone: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: "row", paddingHorizontal: 20, marginTop: -20 },
  statCard: { flex: 1, backgroundColor: colors.surface, padding: 16, marginHorizontal: 4, borderRadius: radius.card, alignItems: "center", borderWidth: 1, borderColor: colors.borderLight, shadowColor: "#0F172A", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  statNum: { fontSize: 22, fontWeight: "700", color: colors.text },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.textSecondary, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" },
  menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.borderLight },
  menuIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 12 },
  menuLabel: { color: colors.text, fontWeight: "600", fontSize: 15 },
  menuValue: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 24, marginHorizontal: 20, padding: 16, borderRadius: 16, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  logoutText: { color: colors.error, fontWeight: "700", marginLeft: 8 },
});
