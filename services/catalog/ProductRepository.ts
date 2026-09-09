import { failureIllustration } from '../../lib/failureIllustration';
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogFilters, Product } from "../../types/product";
import type { UserPreferences } from "../../types/preferences";
import { allergenTerms, hasDiscoveryPreferences, productMatches, requiredDiet, searchExpression } from "./discovery";
import { productColumns, productFromRow } from "./product-row";
export const PAGE_SIZE = 24;
const columns = ["id", ...Object.values(productColumns), "created_at", "updated_at"].join(",");
export interface CatalogPage {
  products: Product[];
  hasMore: boolean;
  mode: "catalog" | "demo";
  warning: string | null;
  failureKind?: 'offline'|'dataError';
}
export class ProductRepository {
  constructor(private client: SupabaseClient | null, private demo: readonly Product[]) {}
  async page(query: string, filters: CatalogFilters, preferences: UserPreferences | null,
    page = 0, mode: "catalog" | "demo" = "catalog", signal?: AbortSignal): Promise<CatalogPage> {
    if (!Number.isInteger(page) || page < 0) throw new Error("Invalid page");
    if (!this.client || mode === "demo") return this.demoPage(query, filters, preferences, page);
    try {
      let request = this.client.from("products").select(columns).order("name").order("id");
      const expression = searchExpression(query);
      if (expression) request = request.textSearch("search_document", expression, { config: "simple" });
      if (filters.category === 'fruit-vegetables') request = request.in('category', ['fruit', 'vegetables']);
      else if (filters.category === 'meat-fish') request = request.in('category', ['meat', 'fish']);
      else if (filters.category === 'dairy-alternatives-group') request = request.in('category', ['dairy', 'dairy-alternatives']);
      else if (filters.category === 'pantry') request = request.in('category', ['grains', 'pasta']);
      else if (filters.category) request = request.eq("category", filters.category);
      if (filters.highProtein) request = request.eq("high_protein", true);
      const flags = new Set(requiredDiet(filters.matchesPreferences ? preferences : null));
      for (const flag of ["vegetarian", "vegan", "lactoseFree", "glutenFree"] as const) if (filters[flag]) flags.add(flag);
      for (const flag of flags) request = request.eq(productColumns[flag], true);
      if (filters.matchesPreferences) {
        if (!hasDiscoveryPreferences(preferences)) return { products: [], hasMore: false, mode: "catalog", warning: null };
        if (preferences?.dietaryPreferences.includes("pescatarian")) request = request.or("vegetarian.eq.true,category.eq.fish");
        const allergens = allergenTerms(preferences);
        if (allergens.length) request = request.eq("allergen_info_available", true)
          .not("allergens", "ov", `{${allergens.join(",")}}`)
          .not("may_contain_allergens", "ov", `{${allergens.join(",")}}`);
      }
      request = request.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      if (signal) request = request.abortSignal(signal);
      const { data, error } = await request;
      if (signal?.aborted) throw new Error("Cancelled");
      if (error) throw new Error(error.message);
      if (!Array.isArray(data)) throw new Error("Invalid catalog response");
      // Fetch one extra row to determine whether another page exists, without an expensive count.
      const rows = data as unknown as Record<string, unknown>[];
      return { products: rows.slice(0, PAGE_SIZE).map(productFromRow), hasMore: rows.length > PAGE_SIZE, mode: "catalog", warning: null };
    } catch (error) {
      if (signal?.aborted || page > 0) throw error;
      const result=this.demoPage(query, filters, preferences, page);
      return {...result,failureKind:failureIllustration(error)};
    }
  }
  private demoPage(query: string, filters: CatalogFilters, preferences: UserPreferences | null, page: number): CatalogPage {
    const rows = this.demo.filter(p => productMatches(p, query, filters, preferences)).sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return { products: rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), hasMore: rows.length > (page + 1) * PAGE_SIZE,
      mode: "demo", warning: "Live catalog unavailable. Showing a small fictional demo catalog; prices and nutrition are illustrative." };
  }
  async get(id: string, signal?: AbortSignal): Promise<Product | null> {
    const demo = this.demo.find(p => p.id === id);
    if (demo) return demo;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    if (!this.client) throw new Error("Catalog unavailable. Reconnect and retry.");
    let request = this.client.from("products").select(columns).eq("id", id);
    if (signal) request = request.abortSignal(signal);
    const { data, error } = await request.maybeSingle();
    if (error) throw new Error("Product could not be loaded. Reconnect and retry.");
    return data ? productFromRow(data as unknown as Record<string, unknown>) : null;
  }
}
