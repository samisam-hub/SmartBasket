import { products } from '../data/products';
import type { Product } from '../types/product';

/** All words must match somewhere in the product's searchable metadata. */
export function searchProducts(query: string): Product[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return products.filter((product) => {
    const haystack = [product.name, product.brand, product.category, ...product.labels]
      .join(' ').toLocaleLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
