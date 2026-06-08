import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { storage } from "@/src/utils/storage";
import { colors } from "@/src/lib/theme";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const token = await storage.getItem<string>("auth_token", "");
      // small delay so splash doesn't flash too quickly
      setTimeout(() => {
        if (token) router.replace("/(tabs)/home");
        else router.replace("/auth/phone");
      }, 200);
    })();
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
});
