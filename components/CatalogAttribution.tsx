import { t } from '../services/i18n';
import { Alert, Linking, Text, View } from "react-native";
import { sourceAttribution } from "@/services/catalog/attribution";
import { TextButton } from "@/components/ui";
import { ui } from "@/lib/theme";
export function openCatalogLink(url: string) {
  if (!url.startsWith("https://")) return;
  void Linking.openURL(url).catch(() => Alert.alert(t('attribution.linkFailed'), t('attribution.tryLater')));
}
export function CatalogAttribution({ sources }: { sources: string[] }) {
  return <View>{[...new Set(sources)].map(source => {
    const info = sourceAttribution(source);
    return <View key={source}>
      <Text style={ui.caption}>Quelle: {info.name} · {info.license}</Text>
      {info.licenseUrl && <TextButton label={t('attribution.title')} onPress={() => openCatalogLink(info.licenseUrl!)} />}
    </View>;
  })}</View>;
}
