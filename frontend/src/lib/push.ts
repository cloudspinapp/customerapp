import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "@/src/lib/api";

export async function registerForPush(user_id: string) {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    if (!tokenResp?.data) return;
    await api.registerPush(user_id, Platform.OS, String(tokenResp.data));
  } catch {
    // silently ignore — push not critical for app to work
  }
}
