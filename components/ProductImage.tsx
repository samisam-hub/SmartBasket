import { useCallback, useEffect, useRef, useState } from "react";
import {Assets} from '../lib/assets';
import { ActivityIndicator, Image, PixelRatio, StyleSheet, View } from "react-native";
import { colors, radii } from "@/lib/theme";
import { imageSuitable, safeImageUrl } from "@/services/catalog/images";
type Props = { uri: string | null; width: number | null; height: number | null; name: string; large?: boolean; fill?: boolean };
export function ProductImage({ uri, width, height, name, large = false, fill = false }: Props) {
  const safe = imageSuitable(width, height, large) ? safeImageUrl(uri) : null;
  // Remount per URL so a failed/recycled list image never poisons the next product.
  return <ImageFrame key={`${safe}:${width}:${height}:${large}`} uri={safe} width={width} height={height} name={name} large={large} fill={fill} />;
}
function ImageFrame({ uri, width, height, name, large = false, fill = false }: Props) {
  const [failed, setFailed] = useState(false), [loading, setLoading] = useState(!!uri);
  const [actual, setActual] = useState({ width: width ?? 0, height: height ?? 0 });
  const density = PixelRatio.get();
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const acceptSize = useCallback((loadedWidth: unknown, loadedHeight: unknown) => {
    if (!active.current) return;
    if (typeof loadedWidth !== 'number' || typeof loadedHeight !== 'number' || !Number.isFinite(loadedWidth) || !Number.isFinite(loadedHeight) || loadedWidth <= 0 || loadedHeight <= 0 || Math.max(loadedWidth, loadedHeight) < (large ? 200 : 72)) setFailed(true);
    else setActual({width:loadedWidth,height:loadedHeight});
    setLoading(false);
  }, [large]);
  const onLoad = useCallback((event: unknown) => {
    // Native supplies source dimensions; React Native Web wraps a DOM load event.
    const native = (event as { nativeEvent?: { source?: { width?: number; height?: number }; target?: { naturalWidth?: number; naturalHeight?: number } } } | null)?.nativeEvent;

    const loadedWidth = native?.source?.width ?? native?.target?.naturalWidth;
    const loadedHeight = native?.source?.height ?? native?.target?.naturalHeight;
    if (loadedWidth === undefined && loadedHeight === undefined && uri) {
      // Some web runtimes omit the DOM target; query the decoded resource itself.
      Image.getSize(uri, (w,h) => acceptSize(w,h), () => acceptSize(null,null));
    } else acceptSize(loadedWidth,loadedHeight);
  }, [uri,acceptSize]);
  const onError = useCallback(() => { setFailed(true); setLoading(false); }, []);
  return <View style={[styles.frame, fill ? styles.fill : large ? styles.large : styles.small]}>
    {uri && !failed ? <>
      <Image source={{ uri }} style={{ width: "100%", height: "100%", maxWidth: actual.width / density,
        maxHeight: actual.height / density, opacity: loading ? 0 : 1 }} resizeMode="contain" resizeMethod="resize" accessibilityLabel={name}
        onLoad={onLoad} onError={onError} />
      {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.primary} accessibilityLabel="Loading product image" />}
    </> : <Image source={Assets.states.productPlaceholder} resizeMode="contain" style={{width:"100%",height:"100%"}} accessibilityLabel="Product image unavailable" testID="product-placeholder" />}
  </View>;
}
const styles = StyleSheet.create({
  frame: { borderRadius: radii.large, backgroundColor: colors.pale, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  fill: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  small: { width: 80, height: 96 }, large: { width: "100%", height: 240 },
});
