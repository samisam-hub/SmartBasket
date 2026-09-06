import { products } from "../data/products";
import { getSupabaseClient } from "../lib/supabase";
import { ProductRepository } from "./catalog/ProductRepository";
let repository: ProductRepository | null = null;
export function getProductRepository(): ProductRepository {
  if (!repository) {
    try { repository = new ProductRepository(getSupabaseClient(), products); }
    catch { repository = new ProductRepository(null, products); }
  }
  return repository;
}
