import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/lib/theme";
import { cloudspin, CloudspinAddress } from "@/src/lib/cloudspin";
import { storage } from "@/src/utils/storage";

type FormState = {
  label: string;
  address_line: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
};

const empty: FormState = {
  label: "Home", address_line: "", landmark: "",
  city: "", state: "", pincode: "", is_default: false,
};

// Lightweight in-screen toast (no Alert per platform rules).
function useToast() {
  const [toast, setToast] = useState<{ msg: string; kind: "info" | "error" } | null>(null);
  const show = (msg: string, kind: "info" | "error" = "info") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  };
  return { toast, show };
}

export default function AddressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string>("");
  const [items, setItems] = useState<CloudspinAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null); // "new" | address ID | null
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [busyDefault, setBusyDefault] = useState<string>("");
  const [busyDelete, setBusyDelete] = useState<string>("");
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    try {
      const cid = await storage.getItem<string>("cloudspin_customer_id", "");
      if (!cid) { setItems([]); return; }
      setCustomerId(cid);
      const res = await cloudspin.listAddresses(cid);
      if (res.status && Array.isArray(res.data)) setItems(res.data);
      else setItems([]);
    } catch {
      show("Could not load addresses", "error");
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const openNew = () => { setForm(empty); setEditing("new"); };

  const openEdit = (a: CloudspinAddress) => {
    setForm({
      label: a.label || "Home",
      address_line: a.address_line || "",
      landmark: a.landmark || "",
      city: a.city || "",
      state: a.state || "",
      pincode: a.pincode || "",
      is_default: String(a.is_default) === "1",
    });
    setEditing(a.ID);
  };

  const close = () => { setEditing(null); setForm(empty); };

  const save = async () => {
    if (!form.label || !form.address_line || !form.city || !form.state || !form.pincode) {
      show("Please fill all required fields", "error"); return;
    }
    if (!customerId) { show("Missing customer session. Please log in again.", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        label: form.label,
        address_line: form.address_line,
        landmark: form.landmark,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        is_default: form.is_default ? ("1" as const) : ("0" as const),
      };
      let res;
      if (editing === "new") res = await cloudspin.addAddress(customerId, payload);
      else res = await cloudspin.updateAddress(customerId, editing as string, payload);
      if (!res.status) { show(res.message || "Failed to save address", "error"); return; }
      show(res.message || "Saved");
      await load();
      close();
    } catch (e: any) {
      show(e?.message || "Failed to save address", "error");
    } finally { setSaving(false); }
  };

  const remove = async (a: CloudspinAddress) => {
    setBusyDelete(a.ID);
    try {
      const res = await cloudspin.deleteAddress(customerId, a.ID);
      if (!res.status) { show(res.message || "Failed to delete", "error"); return; }
      show("Address deleted");
      if (Array.isArray(res.data)) setItems(res.data); else await load();
    } catch (e: any) { show(e?.message || "Failed to delete", "error"); }
    finally { setBusyDelete(""); }
  };

  const setDefault = async (a: CloudspinAddress) => {
    if (String(a.is_default) === "1") return;
    setBusyDefault(a.ID);
    try {
      const res = await cloudspin.setDefaultAddress(customerId, a.ID);
      if (!res.status) { show(res.message || "Failed to update", "error"); return; }
      show("Default address updated");
      if (Array.isArray(res.data)) setItems(res.data); else await load();
    } catch (e: any) { show(e?.message || "Failed to update", "error"); }
    finally { setBusyDefault(""); }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity testID="address-back" onPress={() => (editing ? close() : router.back())} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editing ? (editing === "new" ? "New Address" : "Edit Address") : "My Addresses"}
        </Text>
        {editing ? (
          <TouchableOpacity testID="address-close" onPress={close} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            testID="address-add-btn"
            onPress={openNew}
            style={[styles.iconBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {editing ? (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 80 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>LABEL *</Text>
          <View style={{ flexDirection: "row" }}>
            {["Home", "Work", "Other"].map((l) => (
              <TouchableOpacity
                key={l}
                testID={`addr-label-${l.toLowerCase()}`}
                onPress={() => setForm({ ...form, label: l })}
                style={[styles.chip, form.label === l && styles.chipActive]}
              >
                <Text style={[styles.chipText, form.label === l && { color: "#fff" }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 18 }]}>ADDRESS LINE *</Text>
          <TextInput
            testID="addr-line"
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            value={form.address_line}
            onChangeText={(t) => setForm({ ...form, address_line: t })}
            placeholder="Flat / House / Street / Area"
            placeholderTextColor={colors.textDisabled}
            multiline
          />

          <Text style={[styles.label, { marginTop: 18 }]}>LANDMARK</Text>
          <TextInput
            testID="addr-landmark"
            style={styles.input}
            value={form.landmark}
            onChangeText={(t) => setForm({ ...form, landmark: t })}
            placeholder="Optional"
            placeholderTextColor={colors.textDisabled}
          />

          <View style={{ flexDirection: "row", marginTop: 18 }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>CITY *</Text>
              <TextInput
                testID="addr-city"
                style={styles.input}
                value={form.city}
                onChangeText={(t) => setForm({ ...form, city: t })}
                placeholder="City"
                placeholderTextColor={colors.textDisabled}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>STATE *</Text>
              <TextInput
                testID="addr-state"
                style={styles.input}
                value={form.state}
                onChangeText={(t) => setForm({ ...form, state: t })}
                placeholder="State"
                placeholderTextColor={colors.textDisabled}
              />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 18 }]}>PINCODE *</Text>
          <TextInput
            testID="addr-pincode"
            style={styles.input}
            value={form.pincode}
            onChangeText={(t) => setForm({ ...form, pincode: t.replace(/\D/g, "").slice(0, 6) })}
            keyboardType="number-pad"
            placeholder="6-digit pincode"
            placeholderTextColor={colors.textDisabled}
          />

          <TouchableOpacity
            testID="addr-default"
            onPress={() => setForm({ ...form, is_default: !form.is_default })}
            style={styles.defaultRow}
          >
            <View style={[styles.checkbox, form.is_default && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              {form.is_default && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.defaultText}>Set as default address</Text>
          </TouchableOpacity>

          <TouchableOpacity testID="addr-save" onPress={save} disabled={saving} style={styles.saveBtn}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Address</Text>}
          </TouchableOpacity>
        </ScrollView>
      ) : loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }} testID="address-loading">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
          {items.length === 0 ? (
            <View style={styles.empty} testID="address-empty">
              <Ionicons name="location-outline" size={48} color={colors.textDisabled} />
              <Text style={styles.emptyTitle}>No addresses yet</Text>
              <Text style={styles.emptySub}>Add your pickup address to schedule orders.</Text>
              <TouchableOpacity testID="address-empty-add" onPress={openNew} style={styles.emptyBtn}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Add Address</Text>
              </TouchableOpacity>
            </View>
          ) : items.map((a) => {
            const isDefault = String(a.is_default) === "1";
            return (
              <View key={a.ID} style={styles.addrCard} testID={`address-row-${a.ID}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={styles.labelPill}><Text style={styles.labelPillText}>{a.label || "Address"}</Text></View>
                  {isDefault ? (
                    <Text style={styles.defaultPill} testID={`address-default-${a.ID}`}>DEFAULT</Text>
                  ) : (
                    <TouchableOpacity
                      testID={`address-set-default-${a.ID}`}
                      onPress={() => setDefault(a)}
                      disabled={busyDefault === a.ID}
                      style={styles.setDefaultBtn}
                    >
                      {busyDefault === a.ID
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Text style={styles.setDefaultText}>Set default</Text>}
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.addrFull} testID={`address-line-${a.ID}`}>{a.address_line}</Text>
                <Text style={styles.addrFull}>
                  {a.city}{a.state ? `, ${a.state}` : ""} - {a.pincode}
                </Text>
                {a.landmark ? <Text style={styles.addrFull}>Landmark: {a.landmark}</Text> : null}

                <View style={styles.row}>
                  <TouchableOpacity testID={`address-edit-${a.ID}`} onPress={() => openEdit(a)} style={styles.smallBtn}>
                    <Ionicons name="create-outline" size={16} color={colors.primary} />
                    <Text style={[styles.smallBtnText, { color: colors.primary }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`address-del-${a.ID}`}
                    onPress={() => remove(a)}
                    disabled={busyDelete === a.ID}
                    style={[styles.smallBtn, { marginLeft: 10 }]}
                  >
                    {busyDelete === a.ID ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                        <Text style={[styles.smallBtnText, { color: colors.error }]}>Delete</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {toast ? (
        <View
          pointerEvents="none"
          style={[
            styles.toast,
            { bottom: insets.bottom + 24, backgroundColor: toast.kind === "error" ? "#FEE2E2" : colors.text },
          ]}
          testID="address-toast"
        >
          <Text style={[styles.toastText, toast.kind === "error" ? { color: colors.error } : { color: "#fff" }]}>
            {toast.msg}
          </Text>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  label: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text },
  chip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderRadius: 999, borderWidth: 1, borderColor: colors.borderLight, marginRight: 8 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  defaultRow: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginRight: 10 },
  defaultText: { color: colors.text, fontSize: 14 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  empty: { alignItems: "center", padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 12 },
  emptySub: { fontSize: 14, color: colors.textSecondary, marginTop: 6, textAlign: "center" },
  emptyBtn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999, marginTop: 16 },
  addrCard: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.borderLight },
  labelPill: { backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start" },
  labelPillText: { color: colors.primary, fontWeight: "700", fontSize: 12, textTransform: "capitalize" },
  defaultPill: { color: colors.success, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  setDefaultBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderLight, minHeight: 24, justifyContent: "center" },
  setDefaultText: { color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  addrFull: { color: colors.textSecondary, marginTop: 8, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: "row", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  smallBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.bg, minHeight: 28 },
  smallBtnText: { marginLeft: 6, fontWeight: "700", fontSize: 13 },
  toast: { position: "absolute", left: 20, right: 20, padding: 14, borderRadius: 12, alignItems: "center" },
  toastText: { fontWeight: "600", fontSize: 14 },
});
