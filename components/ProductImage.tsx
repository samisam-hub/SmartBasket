import { useState } from "react";
import Feather from "@expo/vector-icons/Feather";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { colors, radii } from "@/lib/theme";
import { safeImageUrl } from "@/services/catalog/images";
export function ProductImage({ uri, name, large = false }: { uri: string | null; name: string; large?: boolean }) {
  const safe = safeImageUrl(uri);
  // Remount per URL so a failed/recycled list image never poisons the next product.
  return <ImageFrame key={safe ?? "missing"} uri={safe} name={name} large={large} />;
}
function ImageFrame({ uri, name, large }: { uri: string | null; name: string; large: boolean }) {
  const [failed, setFailed] = useState(false), [loading, setLoading] = useState(!!uri);
  return <View style={[styles.frame, large ? styles.large : styles.small]}>
    {uri && !failed ? <>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityLabel={name}
        onLoad={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} />
      {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="Loading product image" />}
    </> : <Feather name="package" size={large ? 64 : 32} color={colors.muted} accessibilityLabel="Product image unavailable" />}
  </View>;
}
const styles = StyleSheet.create({
  frame: { borderRadius: radii.large, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  small: { width: 80, height: 96 }, large: { width: "100%", height: 240 },
});
