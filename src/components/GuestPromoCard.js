// ================== START GuestPromoCard.js ==================
import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Linking, Image } from "react-native";
import { API_BASE_URL } from "../config/api";

const ROTATION_MS = 10000; // 10s – calm, not flashy
const LOGO_SIZE = 22;

export default function GuestPromoCard() {
  const [enabled, setEnabled] = useState(false);
  const [promos, setPromos] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/guest_promos.php`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && data.enabled && Array.isArray(data.promos)) {
          const clean = data.promos.filter(
            (p) => p && p.title && p.body && p.link
          );
          setEnabled(true);
          setPromos(clean);
        }
      })
      .catch(() => {
        // Silent fail — promo must NEVER break HomeScreen
      });
  }, []);

  useEffect(() => {
    if (!enabled || promos.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % promos.length);
    }, ROTATION_MS);

    return () => clearInterval(timer);
  }, [enabled, promos]);

  if (!enabled || promos.length === 0) return null;

  const promo = promos[index];

  const onPress = () => {
    Linking.openURL(promo.link);
  };

  const logoUrl = typeof promo.logo_url === "string" ? promo.logo_url : "";
  const logoText = typeof promo.logo_text === "string" ? promo.logo_text : "";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.rowTop}>
        <Text style={styles.label}>{promo.label || "PARTNER"}</Text>

        <View style={styles.logoWrap}>
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={styles.logoImg}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoFallbackText}>
                {(logoText || "AD").toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {promo.title}
      </Text>

      <Text style={styles.body} numberOfLines={2}>
        {promo.body}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#d9e2ee",
    borderRadius: 16,
    padding: 14,
  },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  label: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(19,35,51,0.45)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  logoWrap: {
    height: LOGO_SIZE,
    minWidth: LOGO_SIZE,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  logoImg: {
    height: LOGO_SIZE,
    width: LOGO_SIZE * 2.2, // allow a small wordmark
  },

  logoFallback: {
    height: LOGO_SIZE,
    minWidth: LOGO_SIZE * 1.6,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(19,35,51,0.12)",
    backgroundColor: "rgba(19,35,51,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },

  logoFallbackText: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(19,35,51,0.65)",
    letterSpacing: 0.6,
  },

  title: {
    fontSize: 14,
    fontWeight: "900",
    color: "#132333",
    marginBottom: 4,
  },

  body: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(19,35,51,0.65)",
    lineHeight: 16,
  },
});
// ================== END GuestPromoCard.js ==================
