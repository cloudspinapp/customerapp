import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/lib/theme";
import { Platform, View, Text, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import React from "react";
import { api } from "@/src/lib/api";

function BellWithBadge({ color, size }: { color: string; size: number }) {
  const [count, setCount] = useState(0);
  const load = React.useCallback(() => {
    api.unreadCount().then((r) => setCount(r.count || 0)).catch(() => {});
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id); }, [load]);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));
  return (
    <View>
      <Ionicons name="notifications-outline" size={size} color={color} />
      {count > 0 && (
        <View style={styles.badge}><Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text></View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="home" options={{
        title: "Home",
        tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        tabBarButtonTestID: "tab-home",
      }} />
      <Tabs.Screen name="orders" options={{
        title: "Orders",
        tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        tabBarButtonTestID: "tab-orders",
      }} />
      <Tabs.Screen name="notifications" options={{
        title: "Alerts",
        tabBarIcon: ({ color, size }) => <BellWithBadge color={color} size={size} />,
        tabBarButtonTestID: "tab-notifications",
      }} />
      <Tabs.Screen name="profile" options={{
        title: "Profile",
        tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        tabBarButtonTestID: "tab-profile",
      }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: { position: "absolute", top: -4, right: -8, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
