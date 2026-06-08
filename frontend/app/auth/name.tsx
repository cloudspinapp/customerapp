import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/lib/theme";
import { api, saveAuth } from "@/src/lib/api";
import { cloudspin, routeForScreen } from "@/src/lib/cloudspin";
import { storage } from "@/src/utils/storage";
import { registerForPush } from "@/src/lib/push";
import LocationPicker, { PickedLocation } from "@/src/components/LocationPicker";

export default function NameScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { phone, customer_id } = useLocalSearchParams<{ phone: string; customer_id?: string }>();
  const [name, setName] = useState("");
  const [loc, setLoc] = useState<PickedLocation | null>(null);
  const [saving, setSaving] = useState(false);

  const onContinue = async () => {
    if (!name.trim()) { Alert.alert("Missing name", "Please enter your name."); return; }
    if (!loc) { Alert.alert("Missing location", "Please pick your location on the map."); return; }
    if (!customer_id) { Alert.alert("Session expired", "Please sign in again."); router.replace("/auth/phone"); return; }

    const mapLink = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
    setSaving(true);
    try {
      // 1) Save profile in Cloudspin
      const res = await cloudspin.updateCustomer({
        customer_id: String(customer_id),
        txtname: name.trim(),
        map_location: mapLink,
      });
      if (!res?.status) {
        Alert.alert("Could not save profile", res?.message || "Please try again.");
        return;
      }

      // Persist context locally so other screens can access it
      await storage.setItem("customer_name", name.trim());
      await storage.setItem("customer_address", loc.address);
      await storage.setItem("customer_lat", loc.latitude.toString());
      await storage.setItem("customer_lng", loc.longitude.toString());
      await storage.setItem("customer_map_link", mapLink);

      // 2) Mint a local session so the existing app screens keep working
      const sendRes: any = await api.sendOtp(String(phone));
      const verifyRes: any = await api.verifyOtp(String(phone), sendRes?.otp, name.trim());
      await saveAuth(verifyRes.token, verifyRes.user);
      registerForPush(verifyRes.user.id).catch(() => {});

      // 3) Route per Cloudspin's `next_screen` if provided, else Home
      const target = routeForScreen(res.next_screen) || "/(tabs)/home";
      router.replace(target as any);
    } catch (e: any) {
      Alert.alert("Could not save profile", e?.message || "Please try again.");
    } finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }]}
      >
        <View style={styles.iconWrap}><Ionicons name="person-add-outline" size={28} color={colors.primary} /></View>
        <Text style={styles.title}>Let's set up your profile</Text>
        <Text style={styles.subtitle}>Tell us your name and pin your location so we can pick up & deliver to the right spot.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>YOUR NAME *</Text>
          <TextInput
            testID="name-input"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Priya Sharma"
            placeholderTextColor={colors.textDisabled}
            style={styles.input}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={[styles.label, { marginTop: 22 }]}>LOCATION *</Text>
          <LocationPicker value={loc} onChange={setLoc} />

          <TouchableOpacity testID="name-continue-btn" onPress={onContinue} disabled={saving} style={styles.button} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.buttonText}>Save & Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 18, marginTop: 24, alignSelf: "center" },
  title: { fontSize: 26, fontWeight: "700", color: colors.text, letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 8, lineHeight: 22, textAlign: "center", maxWidth: 420, alignSelf: "center" },
  form: { marginTop: 28, alignSelf: "stretch", maxWidth: 560, width: "100%" },
  label: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, color: colors.text },
  button: { backgroundColor: colors.primary, borderRadius: radius.button, paddingVertical: 18, alignItems: "center", marginTop: 24, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
