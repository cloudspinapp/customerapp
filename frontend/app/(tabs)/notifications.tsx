import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/lib/theme";
import { api } from "@/src/lib/api";

function timeAgo(iso: string): string {
  const d = new Date(iso); const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api.notifications()); }
    catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true); load();
    // mark read on visit (after fetching)
    const id = setTimeout(() => { api.markRead().catch(() => {}); }, 1200);
    return () => clearTimeout(id);
  }, [load]));

  const markAll = async () => { await api.markRead().catch(() => {}); await load(); };

  if (loading) {
    return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity testID="notifications-mark-read" onPress={markAll}>
          <Text style={styles.markText}>Mark all read</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={56} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptySub}>We'll ping you when there's an update on your orders.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View testID={`notif-${item.id}`} style={[styles.card, !item.read && styles.cardUnread]}>
            <View style={[styles.icon, { backgroundColor: !item.read ? colors.primaryLight : colors.borderLight }]}>
              <Ionicons name={item.type === "order" ? "receipt-outline" : item.type === "welcome" ? "sparkles-outline" : "notifications-outline"} size={20} color={!item.read ? colors.primary : colors.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                {!item.read && <View style={styles.dot} />}
              </View>
              <Text style={styles.notifBody}>{item.body}</Text>
              <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  title: { fontSize: 26, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  markText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, marginTop: 12, flexDirection: "row", borderWidth: 1, borderColor: colors.borderLight },
  cardUnread: { backgroundColor: "#fff", borderColor: colors.primaryLight },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  notifTitle: { color: colors.text, fontWeight: "700", fontSize: 14, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 6 },
  notifBody: { color: colors.textSecondary, marginTop: 2, fontSize: 13, lineHeight: 18 },
  notifTime: { color: colors.textDisabled, fontSize: 11, marginTop: 6 },
  empty: { alignItems: "center", padding: 40, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 12 },
  emptySub: { fontSize: 14, color: colors.textSecondary, marginTop: 6, textAlign: "center" },
});
