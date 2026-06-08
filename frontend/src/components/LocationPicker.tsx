// Native (iOS / Android) LocationPicker — uses react-native-maps.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  FlatList, Keyboard, Platform,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
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
  const mapRef = useRef<MapView | null>(null);
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
    mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
  };

  const useCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      const addr = await reverseNominatim(latitude, longitude);
      onChange({ latitude, longitude, address: addr });
      setQuery(addr);
      lastTypedRef.current = addr;
      mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    } catch {
      // silently ignore
    } finally { setLocating(false); }
  }, [onChange]);

  const handleMapPress = async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const c = e.nativeEvent.coordinate;
    const addr = await reverseNominatim(c.latitude, c.longitude);
    onChange({ latitude: c.latitude, longitude: c.longitude, address: addr });
    setQuery(addr);
    lastTypedRef.current = addr;
  };

  const pin = value || { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude, address: "" };

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
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: pin.latitude,
            longitude: pin.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          onPress={handleMapPress}
        >
          <Marker
            draggable
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            onDragEnd={handleMapPress}
          />
        </MapView>
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
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 14 : 6 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: colors.text },
  suggBox: { backgroundColor: colors.surface, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, marginTop: 8, overflow: "hidden" },
  suggItem: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  suggText: { color: colors.text, fontSize: 13, flex: 1, lineHeight: 18 },
  locBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.primaryLight },
  locBtnText: { color: colors.primary, fontWeight: "600", marginLeft: 6, fontSize: 13 },
  mapWrap: { marginTop: 14, height: 240, borderRadius: radius.card, overflow: "hidden", borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.borderLight },
  pickedBox: { flexDirection: "row", alignItems: "flex-start", marginTop: 12, backgroundColor: "#ECFDF5", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#A7F3D0" },
  pickedText: { marginLeft: 8, color: "#065F46", fontSize: 13, flex: 1, lineHeight: 18 },
});
