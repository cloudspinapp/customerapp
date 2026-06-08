// Web LocationPicker — uses OpenStreetMap iframe (no react-native-maps on web).
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  FlatList, Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/lib/theme";
import {
  PickedLocation, Suggestion, DEFAULT_REGION,
  searchNominatim, reverseNominatim,
} from "./locationShared";

export type { PickedLocation } from "./locationShared";

type Props = {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation) => void;
};

export default function LocationPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState(value?.address || "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypedRef = useRef<string>(value?.address || "");

  useEffect(() => {
    if (value?.address && value.address !== lastTypedRef.current) {
      setQuery(value.address);
      lastTypedRef.current = value.address;
    }
  }, [value?.address]);

  const onTypeQuery = (text: string) => {
    setQuery(text);
    lastTypedRef.current = text;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try { setSuggestions(await searchNominatim(text)); }
      catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 350);
  };

  const pickSuggestion = (s: Suggestion) => {
    const latitude = parseFloat(s.lat);
    const longitude = parseFloat(s.lon);
    const address = s.display_name;
    setQuery(address);
    lastTypedRef.current = address;
    setSuggestions([]);
    Keyboard.dismiss();
    onChange({ latitude, longitude, address });
  };

  const useCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      await new Promise<void>((resolve, reject) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          reject(new Error("Geolocation not supported")); return;
        }
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude, lon = pos.coords.longitude;
            const addr = await reverseNominatim(lat, lon);
            onChange({ latitude: lat, longitude: lon, address: addr });
            setQuery(addr);
            lastTypedRef.current = addr;
            resolve();
          },
          (err) => reject(new Error(err.message || "Could not get location")),
          { enableHighAccuracy: true, timeout: 10000 },
        );
      });
    } catch {
      // silently ignore
    } finally { setLocating(false); }
  }, [onChange]);

  const pin = value || { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude, address: "" };
  const iframeSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${pin.longitude - 0.005}%2C${pin.latitude - 0.005}%2C${pin.longitude + 0.005}%2C${pin.latitude + 0.005}&layer=mapnik&marker=${pin.latitude}%2C${pin.longitude}`;

  return (
    <View>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          testID="location-search-input"
          value={query}
          onChangeText={onTypeQuery}
          placeholder="Search address, area, landmark…"
          placeholderTextColor={colors.textDisabled}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggBox}>
          <FlatList
            data={suggestions}
            keyExtractor={(it, i) => `${it.lat}-${it.lon}-${i}`}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => pickSuggestion(item)} style={styles.suggItem}>
                <Ionicons name="location-outline" size={16} color={colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.suggText} numberOfLines={2}>{item.display_name}</Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 220 }}
          />
        </View>
      )}

      <TouchableOpacity testID="use-current-location" onPress={useCurrentLocation} disabled={locating} style={styles.locBtn}>
        {locating ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="navigate" size={16} color={colors.primary} />}
        <Text style={styles.locBtnText}>Use my current location</Text>
      </TouchableOpacity>

      <View style={styles.mapWrap}>
        {/* @ts-ignore - iframe is only used on web */}
        <iframe src={iframeSrc} style={{ border: 0, width: "100%", height: "100%" }} title="Map preview" />
      </View>

      {value ? (
        <View style={styles.pickedBox}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.pickedText} numberOfLines={2}>
            <Text style={{ fontWeight: "700" }}>Selected: </Text>
            {value.address}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: colors.text, outlineStyle: "none" as any },
  suggBox: { backgroundColor: colors.surface, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, marginTop: 8, overflow: "hidden" },
  suggItem: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  suggText: { color: colors.text, fontSize: 13, flex: 1, lineHeight: 18 },
  locBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.primaryLight },
  locBtnText: { color: colors.primary, fontWeight: "600", marginLeft: 6, fontSize: 13 },
  mapWrap: { marginTop: 14, height: 280, borderRadius: radius.card, overflow: "hidden", borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.borderLight },
  pickedBox: { flexDirection: "row", alignItems: "flex-start", marginTop: 12, backgroundColor: "#ECFDF5", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#A7F3D0" },
  pickedText: { marginLeft: 8, color: "#065F46", fontSize: 13, flex: 1, lineHeight: 18 },
});
