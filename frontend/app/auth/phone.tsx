import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/lib/theme";
import { cloudspin, routeForScreen } from "@/src/lib/cloudspin";

export default function PhoneScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleContinue = async () => {
    setError("");
    const trimmed = phone.replace(/\D/g, "");
    if (trimmed.length < 10) { setError("Please enter a valid 10-digit phone number"); return; }
    setLoading(true);
    try {
      const res = await cloudspin.sendOtp(trimmed);
      if (!res?.status) {
        Alert.alert("Could not send OTP", res?.message || "Please try again.");
        return;
      }
      const target = routeForScreen(res.next_screen) || "/auth/otp";
      router.push({
        pathname: target as any,
        params: {
          phone: trimmed,
          hintOtp: res.data?.otp || "",
        },
      });
    } catch (e: any) {
      Alert.alert("Could not send OTP", e?.message || "Please try again.");
    }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.iconWrap}><Text style={styles.emoji}>🧺</Text></View>
        <Text style={styles.title}>Welcome to FreshFold</Text>
        <Text style={styles.subtitle}>Laundry, picked up & delivered fresh. Sign in with your mobile number to get started.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>MOBILE NUMBER</Text>
          <TextInput
            testID="auth-phone-input"
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
            placeholder="9876543210"
            placeholderTextColor={colors.textDisabled}
            keyboardType="number-pad"
            style={styles.input}
            maxLength={10}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity testID="auth-send-otp-btn" style={styles.button} onPress={handleContinue} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.buttonText}>Send OTP</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.tos}>By continuing you agree to our Terms & Privacy Policy.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, alignItems: "center" },
  iconWrap: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  emoji: { fontSize: 36 },
  title: { fontSize: 30, fontWeight: "700", color: colors.text, letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: 16, color: colors.textSecondary, marginTop: 10, lineHeight: 22, textAlign: "center", maxWidth: 360 },
  form: { marginTop: 36, alignSelf: "stretch", maxWidth: 420, alignItems: "stretch", width: "100%" },
  label: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 1, marginBottom: 8, textAlign: "center" },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingHorizontal: 16, paddingVertical: 16, fontSize: 18, color: colors.text, textAlign: "center", letterSpacing: 2, fontWeight: "600" },
  button: { backgroundColor: colors.primary, borderRadius: radius.button, paddingVertical: 18, alignItems: "center", justifyContent: "center", marginTop: 24, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: colors.error, marginTop: 12, fontSize: 14, textAlign: "center" },
  tos: { textAlign: "center", color: colors.textDisabled, fontSize: 12, marginTop: 24 },
});
