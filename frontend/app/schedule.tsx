import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/lib/theme";
import { api } from "@/src/lib/api";

// 2-hour slots between 07:00 and 22:00 (10 PM)
const SLOT_HOURS = [7, 9, 11, 13, 15, 17, 19]; // start hours; each slot is 2 hours
const fmt12 = (h: number) => {
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${String(hh).padStart(2, "0")}:00 ${ampm}`;
};
const SLOTS = SLOT_HOURS.map((h) => `${fmt12(h)} - ${fmt12(h + 2)}`);
const today = () => new Date().toISOString().slice(0, 10);

function nextDates(n: number) {
  const out: { iso: string; dow: string; day: string; mon: string }[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      dow: d.toLocaleDateString("en-US", { weekday: "short" }),
      day: String(d.getDate()),
      mon: d.toLocaleDateString("en-US", { month: "short" }),
    });
  }
  return out;
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items: itemsStr } = useLocalSearchParams<{ items: string }>();
  const items = useMemo(() => { try { return JSON.parse(itemsStr || "[]"); } catch { return []; } }, [itemsStr]);

  const dates = useMemo(() => nextDates(7), []);
  const [date, setDate] = useState<string>(dates[0]?.iso);
  const [slot, setSlot] = useState<string>("");
  const [now, setNow] = useState<Date>(new Date());
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressId, setAddressId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingAddr, setLoadingAddr] = useState(true);

  // Re-check current time every minute so slots auto-disable as the day progresses.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // For today's date, only show slots whose START time is still in the future.
  const visibleSlots = useMemo(() => {
    if (date !== today()) return SLOTS;
    const curMin = now.getHours() * 60 + now.getMinutes();
    return SLOT_HOURS.filter((h) => h * 60 > curMin).map(
      (h) => `${fmt12(h)} - ${fmt12(h + 2)}`,
    );
  }, [date, now]);

  // Clear selection if the chosen slot just expired.
  useEffect(() => {
    if (slot && !visibleSlots.includes(slot)) setSlot("");
  }, [visibleSlots, slot]);

  useEffect(() => {
    (async () => {
      try {
        const a = await api.addresses();
        setAddresses(a);
        if (a.length) setAddressId(a.find((x: any) => x.is_default)?.id || a[0].id);
      } finally { setLoadingAddr(false); }
    })();
  }, []);

  const confirm = async () => {
    if (!date || !slot) { Alert.alert("Please pick a date & time slot"); return; }
    if (!addressId) { Alert.alert("Please add a pickup address"); return; }
    setLoading(true);
    try {
      await api.createOrder({
        items, pickup_date: date, pickup_slot: slot, address_id: addressId, notes: "",
      });
      Alert.alert("Pickup has been scheduled", `${date} • ${slot}`, [
        { text: "OK", onPress: () => router.replace("/(tabs)/home") },
      ]);
    } catch (e: any) { Alert.alert("Could not place order", e.message); }
    finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity testID="schedule-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule Pickup</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 200 }}>
        <Text style={styles.sectionTitle}>Select Pickup Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }} style={{ marginTop: 12 }}>
          {dates.map((d) => {
            const active = date === d.iso;
            return (
              <TouchableOpacity key={d.iso} testID={`date-${d.iso}`} onPress={() => setDate(d.iso)} style={[styles.dateCard, active && styles.activeCard]}>
                <Text style={[styles.dateDow, active && { color: "#fff" }]}>{d.dow}</Text>
                <Text style={[styles.dateDay, active && { color: "#fff" }]}>{d.day}</Text>
                <Text style={[styles.dateMon, active && { color: "#fff" }]}>{d.mon}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Select Time Slot</Text>
        <View style={styles.slotGrid}>
          {visibleSlots.map((s) => {
            const active = slot === s;
            return (
              <TouchableOpacity key={s} testID={`slot-${s}`} onPress={() => setSlot(s)} style={[styles.slotChip, active && styles.activeChip]}>
                <Text style={[styles.slotText, active && { color: "#fff" }]}>{s}</Text>
              </TouchableOpacity>
            );
          })}
          {visibleSlots.length === 0 && (
            <Text style={styles.noSlotsText} testID="no-slots-msg">
              No more slots today. Please pick a different date.
            </Text>
          )}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
          <Text style={styles.sectionTitle}>Pickup Address</Text>
          <TouchableOpacity testID="schedule-add-address" onPress={() => router.push("/address")}>
            <Text style={styles.linkText}>+ Add new</Text>
          </TouchableOpacity>
        </View>

        {loadingAddr ? <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} /> :
          addresses.length === 0 ? (
            <View style={styles.emptyAddr}>
              <Ionicons name="location-outline" size={24} color={colors.textSecondary} />
              <Text style={styles.emptyAddrText}>No address yet. Add one to confirm pickup.</Text>
              <TouchableOpacity testID="schedule-add-first-address" onPress={() => router.push("/address")} style={styles.emptyAddrBtn}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Add Address</Text>
              </TouchableOpacity>
            </View>
          ) : addresses.map((a) => {
            const selected = addressId === a.id;
            return (
              <TouchableOpacity key={a.id} testID={`address-${a.id}`} onPress={() => setAddressId(a.id)} style={[styles.addrCard, selected && styles.addrCardActive]}>
                <View style={[styles.radio, selected && { borderColor: colors.primary }]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.addrLabel}>{a.label} • {a.full_name}</Text>
                  <Text style={styles.addrLine}>{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city} - {a.pincode}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        }

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Selected Services</Text>
          {items.map((i: any, idx: number) => (
            <View key={idx} style={styles.summaryRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              <Text style={styles.summaryItem}>{i.service_name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity testID="confirm-booking-btn" onPress={confirm} disabled={loading} style={styles.confirmBtn} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Confirm Booking</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  dateCard: { width: 64, paddingVertical: 14, marginRight: 10, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center" },
  activeCard: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateDow: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },
  dateDay: { color: colors.text, fontSize: 20, fontWeight: "700", marginTop: 4 },
  dateMon: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  slotChip: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surface, borderRadius: 999, borderWidth: 1, borderColor: colors.borderLight, marginRight: 8, marginBottom: 8 },
  activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  noSlotsText: { color: colors.textSecondary, fontSize: 13, paddingVertical: 12 },
  linkText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  emptyAddr: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, alignItems: "center", marginTop: 12, borderWidth: 1, borderColor: colors.borderLight },
  emptyAddrText: { color: colors.textSecondary, marginTop: 8, marginBottom: 12 },
  emptyAddrBtn: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 999 },
  addrCard: { flexDirection: "row", padding: 16, backgroundColor: colors.surface, borderRadius: 18, marginTop: 10, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center" },
  addrCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  addrLabel: { color: colors.text, fontWeight: "700", fontSize: 14 },
  addrLine: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  summary: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 18, marginTop: 24, borderWidth: 1, borderColor: colors.borderLight },
  summaryTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 8 },
  summaryRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  summaryItem: { color: colors.text, fontSize: 14, marginLeft: 10 },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, padding: 16, borderTopWidth: 1, borderTopColor: colors.borderLight },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  confirmText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
