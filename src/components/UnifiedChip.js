// UnifiedChip.js Rev 2 — 2026-01-08
// Changes since Rev 1: Repo-wide style relocation — moved styles used by this module into this file. No behaviour/design changes.
// Behaviour note: Only changes listed above are intended.


import { View, Text, Pressable, Image, StyleSheet } from "react-native";

const styles = StyleSheet.create({
  unifiedChipCard: {},
  unifiedChipCardSelected: {},
  unifiedChipCardDisabled: {},
  unifiedChipTop: {},
  unifiedChipImage: {},
  unifiedChipImageFallback: {},
  unifiedChipBottom: {},
  unifiedChipText: {},
  unifiedChipTextCountry: {},
});

export default function UnifiedChip({
  label,
  imageSrc,
  onPress,
  selected = false,
  disabled = false,
  variant = "airport", // "airport" | "country"
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.unifiedChipCard,
        selected && styles.unifiedChipCardSelected,
        disabled && styles.unifiedChipCardDisabled,
        pressed && !disabled && { opacity: 0.92 },
      ]}
    >
      {/* Top 60%: image */}
      <View style={styles.unifiedChipTop}>
        {!!imageSrc ? (
          <Image
            source={imageSrc}
            resizeMode="contain"
            style={styles.unifiedChipImage}
          />
        ) : (
          <View style={styles.unifiedChipImageFallback} />
        )}
      </View>

      {/* Bottom 40%: label */}
      <View style={styles.unifiedChipBottom}>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.unifiedChipText,
            variant === "country" && styles.unifiedChipTextCountry,
          ]}
        >
          {String(label)}
        </Text>
      </View>
    </Pressable>
  );
}

