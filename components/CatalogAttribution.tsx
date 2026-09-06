import { Alert, Linking, Text, View } from "react-native";
import { sourceAttribution } from "@/services/catalog/attribution";
import { TextButton } from "@/components/ui";
import { ui } from "@/lib/theme";
export function openCatalogLink(url: string) {
  if (!url.startsWith("https://")) return;
  void Linking.openURL(url).catch(() => Alert.alert("Could not open link", "Please try again later."));
}
export function CatalogAttribution({ sources }: { sources: string[] }) {
  return <View>{[...new Set(sources)].map(source => {
    const info = sourceAttribution(source);
    return <View key={source}>
      <Text style={ui.caption}>Source: {info.name} · {info.license}</Text>
      {info.licenseUrl && <TextButton label="Source attribution & licensing" onPress={() => openCatalogLink(info.licenseUrl!)} />}
    </View>;
  })}</View>;
}
