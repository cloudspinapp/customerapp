import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";

SplashScreen.preventAutoHideAsync();

// Foreground push handler (module scope)
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data || {};
      if (Platform.OS === "android" && typeof data.supr_send_n_pl === "string") {
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });
}

// Android channel (module scope)
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
  });
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const router = useRouter();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      let url = data.deeplink || data.action_url;
      if (!url && typeof data.supr_send_n_pl === "string") {
        try { const p = JSON.parse(data.supr_send_n_pl); url = p.deeplink || p.action_url; } catch {}
      }
      if (!url) return;
      typeof url === "string" && url.startsWith("http") ? Linking.openURL(url) : router.push(url);
    });
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data || {};
      let url = data.deeplink || data.action_url;
      if (!url && typeof data.supr_send_n_pl === "string") {
        try { const p = JSON.parse(data.supr_send_n_pl); url = p.deeplink || p.action_url; } catch {}
      }
      if (url) typeof url === "string" && url.startsWith("http") ? Linking.openURL(url) : router.push(url);
    });
    return () => { tapSub.remove(); };
  }, [router]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F8FAFC" } }} />
    </SafeAreaProvider>
  );
}
