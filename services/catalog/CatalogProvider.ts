import type { CatalogProductInput } from "../../types/product";
/** Import boundary; providers never return their raw schema to the app. */
export interface CatalogProvider {
  readonly source: string;
  normalize(raw: unknown): CatalogProductInput | null;
  getByBarcode(barcode: string): Promise<CatalogProductInput | null>;
}
