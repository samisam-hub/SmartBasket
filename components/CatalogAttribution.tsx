import { Alert, Linking, Text, View } from "react-native";
import { sourceAttribution } from "@/services/catalog/attribution";
import { TextButton } from "@/components/ui";
import { ui } from "@/lib/theme";
export function openCatalogLink(url: string) {
  if (!url.startsWith("https://")) return;
  void Linking.openURL(url).catch(() => Alert.alert("Link konnte nicht geöffnet werden", "Bitte versuche es später erneut."));
}
export function CatalogAttribution({ sources }: { sources: string[] }) {
  return <View>{[...new Set(sources)].map(source => {
    const info = sourceAttribution(source);
    return <View key={source}>
      <Text style={ui.caption}>Quelle: {info.name} · {info.license}</Text>
      {info.licenseUrl && <TextButton label="Quellenangaben und Lizenzen" onPress={() => openCatalogLink(info.licenseUrl!)} />}
    </View>;
  })}</View>;
}
