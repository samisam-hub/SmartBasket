export const catalogSources: Record<string, { name: string; url: string | null; license: string; licenseUrl: string | null }> = {
  "open-food-facts": { name: "Open Food Facts", url: "https://world.openfoodfacts.org",
    license: "Data: ODbL · Images: CC BY-SA 3.0", licenseUrl: "https://world.openfoodfacts.org/terms-of-use" },
  demo: { name: "SmartBasket fictional demo", url: null, license: "Illustrative data only", licenseUrl: null },
};
export const sourceAttribution = (source: string) => catalogSources[source] ?? {
  name: source, url: null, license: "See product source for attribution", licenseUrl: null,
};
