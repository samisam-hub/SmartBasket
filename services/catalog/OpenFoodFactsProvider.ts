import type { CatalogProvider } from "./CatalogProvider";
import { normalizeOpenFoodFacts, record } from "./normalize";
/** Administrative importer only. Never instantiated by mobile search. */
export class OpenFoodFactsProvider implements CatalogProvider {
  readonly source = "open-food-facts";
  readonly normalize = normalizeOpenFoodFacts;
  constructor(private userAgent: string, private request: typeof fetch = fetch) {}
  async getByBarcode(barcode: string) {
    if (!/^\d{8,14}$/.test(barcode)) throw new Error("Invalid barcode");
    const response = await this.request(`https://world.openfoodfacts.org/api/v3.6/product/${barcode}`, {
      headers: { "User-Agent": this.userAgent }, signal: AbortSignal.timeout(20000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Open Food Facts returned HTTP ${response.status}`);
    const data = record(await response.json());
    if (!data.product || typeof data.product !== "object") throw new Error("Malformed Open Food Facts response");
    return this.normalize(data.product);
  }
}
