export const catalogSources: Record<string, { name: string; url: string | null; license: string; licenseUrl: string | null }> = {
  "open-food-facts": { name: "Open Food Facts", url: "https://world.openfoodfacts.org",
    license: "Daten: ODbL · Bilder: CC BY-SA 3.0", licenseUrl: "https://world.openfoodfacts.org/terms-of-use" },
  demo: { name: "SmartBasket-Demodaten", url: null, license: "Nur beispielhafte Daten", licenseUrl: null },
};
export const sourceAttribution = (source: string) => catalogSources[source] ?? {
  name: source, url: null, license: "Quellenangaben stehen bei der Produktquelle", licenseUrl: null,
};
