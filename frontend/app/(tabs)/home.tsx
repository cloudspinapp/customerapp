import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/lib/theme";
import { getUser } from "@/src/lib/api";
import { api } from "@/src/lib/api";
import { cloudspin, iconForService, CloudspinService } from "@/src/lib/cloudspin";

const { width } = Dimensions.get("window");

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [services, setServices] = useState<CloudspinService[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, s, b] = await Promise.all([getUser(), cloudspin.services(), api.banners()]);
      setUser(u);
      setServices(Array.isArray(s?.data) ? s.data : []);
      setBanners(b);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = (key: string) => setSelected((c) => {
    const next = { ...c };
    if (next[key]) delete next[key]; else next[key] = true;
    return next;
  });

  const selectedIds = Object.keys(selected);
  const totalItems = selectedIds.length;

  const onSchedule = () => {
    const items = services.filter((s) => selected[s.name]).map((s) => ({
      service_id: s.name, service_name: s.name, price: 0, quantity: 1,
    }));
    router.push({ pathname: "/schedule", params: { items: JSON.stringify(items) } });
  };

  if (loading) {
    return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: totalItems > 0 ? tabBarHeight + 90 : tabBarHeight + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Hello{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋</Text>
            <View style={styles.locRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.locText}>Pickup ready in your area</Text>
            </View>
          </View>
          <TouchableOpacity testID="header-notifications-btn" onPress={() => router.push("/(tabs)/notifications")} style={styles.bellBtn}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Banners */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24 }} style={{ marginTop: 16 }}>
          {banners.map((b) => (
            <View key={b.id} style={[styles.banner, { width: width - 64 }]} testID={`banner-${b.id}`}>
              <Image source={{ uri: b.image_url }} style={styles.bannerImg} />
              <View style={styles.bannerOverlay}>
                <Text style={styles.bannerTitle}>{b.title}</Text>
                {b.subtitle ? <Text style={styles.bannerSub}>{b.subtitle}</Text> : null}
                {b.cta_text ? <View style={styles.bannerCta}><Text style={styles.bannerCtaText}>{b.cta_text}</Text></View> : null}
              </View>
            </View>
          ))}
          {banners.length === 0 && (
            <View style={[styles.banner, { width: width - 64, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>No banners yet</Text>
            </View>
          )}
        </ScrollView>

        {/* Services */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Our Services</Text>
          <Text style={styles.sectionSub}>Tap to select • Choose multiple</Text>
        </View>

        <View style={styles.grid}>
          {services.map((s) => {
            const isSelected = !!selected[s.name];
            return (
              <TouchableOpacity
                key={s.name}
                testID={`service-${s.name}`}
                activeOpacity={0.85}
                onPress={() => toggle(s.name)}
                style={[styles.serviceCard, isSelected && styles.serviceCardSelected]}
              >
                <View style={styles.serviceTop}>
                  <View style={styles.serviceImgWrap}>
                    <Image source={{ uri: iconForService(s) }} style={styles.serviceImg} resizeMode="contain" />
                  </View>
                  <View style={[styles.checkBadge, isSelected ? styles.checkBadgeOn : styles.checkBadgeOff]}>
                    {isSelected ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Ionicons name="add" size={14} color={colors.textSecondary} />}
                  </View>
                </View>
                <Text style={styles.serviceName}>{s.name}</Text>
                <Text style={styles.serviceDesc} numberOfLines={2}>{s.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Schedule Bar */}
      {totalItems > 0 && (
        <View style={[styles.fab, { bottom: tabBarHeight + 8 }]} testID="schedule-fab">
          <View style={{ flex: 1 }}>
            <Text style={styles.fabCount}>{totalItems} item{totalItems > 1 ? "s" : ""} selected</Text>
          </View>
          <TouchableOpacity testID="schedule-btn" onPress={onSchedule} style={styles.fabBtn} activeOpacity={0.85}>
            <Text style={styles.fabBtnText}>Schedule Pickup</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hello: { fontSize: 24, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  locRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  locText: { color: colors.textSecondary, marginLeft: 4, fontSize: 13 },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  banner: { height: 160, borderRadius: radius.card, marginRight: 14, overflow: "hidden", backgroundColor: colors.surface },
  bannerImg: { width: "100%", height: "100%" },
  bannerOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, top: 0, padding: 20, backgroundColor: "rgba(15,23,42,0.35)", justifyContent: "flex-end" },
  bannerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  bannerSub: { color: "#E2E8F0", marginTop: 4, fontSize: 13 },
  bannerCta: { backgroundColor: "#fff", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, alignSelf: "flex-start", marginTop: 12 },
  bannerCtaText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  sectionHeader: { marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  sectionSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  serviceCard: { width: "48%", backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.borderLight },
  serviceCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  serviceTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 },
  serviceImgWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderLight },
  serviceImg: { width: 40, height: 40 },
  checkBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  checkBadgeOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkBadgeOff: { backgroundColor: "transparent", borderColor: colors.border },
  serviceName: { fontSize: 15, fontWeight: "700", color: colors.text },
  serviceDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 4, minHeight: 32 },
  fab: { position: "absolute", left: 16, right: 16, backgroundColor: colors.text, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  fabCount: { color: "#fff", fontSize: 15, fontWeight: "700" },
  fabBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, flexDirection: "row", alignItems: "center" },
  fabBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
