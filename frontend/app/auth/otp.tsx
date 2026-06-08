import { useEffect, useState } from "react";
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
import { registerForPush } from "@/src/lib/push";
import { storage } from "@/src/utils/storage";

const OTP_LENGTH = 6;

export default function OtpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { phone, hintOtp } = useLocalSearchParams<{ phone: string; hintOtp?: string }>();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState<string>(typeof hintOtp === "string" ? hintOtp : "");

  useEffect(() => {
    if (typeof hintOtp === "string" && hintOtp) setOtp(hintOtp);
  }, [hintOtp]);

  const verify = async () => {
    setError("");
    if (otp.length !== OTP_LENGTH) { setError(`Enter the ${OTP_LENGTH}-digit OTP`); return; }
    setLoading(true);
    try {
      // Validate OTP with Cloudspin
      const cs = await cloudspin.verifyOtp(String(phone), otp);
      if (!cs?.status) {
        Alert.alert("Verification failed", cs?.message || "Invalid OTP. Please try again.");
        return;
      }
      const customerId = cs.data?.customer_id;
      if (customerId !== undefined && customerId !== null) {
        await storage.setItem("cloudspin_customer_id", String(customerId));
      }

      // Route based on Cloudspin's next_screen
      const target = routeForScreen(cs.next_screen);

      if (target === "/auth/name") {
        // New customer: send to profile setup (no local session yet — created after Name screen)
        router.replace({
          pathname: "/auth/name",
          params: { phone: String(phone), customer_id: customerId ? String(customerId) : "" },
        });
        return;
      }

      // Existing customer flow → Home. Mint a local session so the rest of the app
      // keeps working until those screens are migrated to Cloudspin.
      const sendRes: any = await api.sendOtp(String(phone));
      const localOtp = sendRes?.otp;
      const verifyRes: any = await api.verifyOtp(String(phone), localOtp);
      await saveAuth(verifyRes.token, verifyRes.user);
      registerForPush(verifyRes.user.id).catch(() => {});

      router.replace((target || "/(tabs)/home") as any);
    } catch (e: any) {
      Alert.alert("Verification failed", e?.message || "Could not sign you in. Please try again.");
    } finally { setLoading(false); }
  };

  const resend = async () => {
    setResending(true);
    try {
      const res = await cloudspin.sendOtp(String(phone));
      if (!res?.status) {
        Alert.alert("Could not resend OTP", res?.message || "Please try again.");
        return;
      }
      setHint(res.data?.otp || "");
      setOtp("");
      setError("");
    } catch (e: any) { Alert.alert("Could not resend OTP", e.message || "Please try again."); }
    finally { setResending(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity testID="otp-back-btn" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to <Text style={{ color: colors.text, fontWeight: "600" }}>{phone}</Text></Text>

        {hint ? (
          <View style={styles.hintBox} testID="otp-hint-box">
            <Ionicons name="information-circle" size={18} color={colors.primary} />
            <Text style={styles.hintText}>Demo OTP: <Text style={{ fontWeight: "700" }}>{hint}</Text></Text>
          </View>
        ) : null}

        <TextInput
          testID="otp-input"
          value={otp}
          onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, OTP_LENGTH))}
          placeholder="• • • • • •"
          placeholderTextColor={colors.textDisabled}
          keyboardType="number-pad"
          style={styles.otpInput}
          maxLength={OTP_LENGTH}
          autoFocus
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity testID="otp-verify-btn" style={styles.button} onPress={verify} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Continue</Text>}
        </TouchableOpacity>

        <TouchableOpacity testID="otp-resend-btn" onPress={resend} disabled={resending} style={{ marginTop: 18, alignSelf: "center" }}>
          <Text style={styles.resend}>{resending ? "Sending…" : "Didn't get it? Resend code"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 8, lineHeight: 22 },
  hintBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primaryLight, borderRadius: 12, padding: 12, marginTop: 16 },
  hintText: { marginLeft: 8, color: colors.primary, fontSize: 14, flex: 1 },
  otpInput: { marginTop: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingHorizontal: 16, paddingVertical: 22, fontSize: 26, color: colors.text, textAlign: "center", letterSpacing: 12, fontWeight: "700" },
  error: { color: colors.error, marginTop: 12, fontSize: 14 },
  button: { backgroundColor: colors.primary, borderRadius: radius.button, paddingVertical: 18, alignItems: "center", marginTop: 24, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  resend: { color: colors.primary, fontSize: 15, fontWeight: "600" },
});
