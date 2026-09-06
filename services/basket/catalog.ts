import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '../../types/product';
import { productFromRow } from '../catalog/product-row';
/** Read SmartBasket only. Never substitute fictional demo products for a real basket. */
export async function loadBasketCatalog(client: SupabaseClient | null, signal?: AbortSignal): Promise<Product[]> {
  if (!client) throw Error('Connect to the SmartBasket catalog to generate a basket. Saved baskets remain available offline.');
  const products: Product[] = [];
  for (let offset = 0; offset <= 2000; offset += 250) {
    if (signal?.aborted) throw Error('Cancelled');
    let request = client.from('products').select('*').neq('source', 'demo').order('id').range(offset, offset === 2000 ? offset : offset + 249);
    if (signal) request = request.abortSignal(signal);
    const { data, error } = await request;
    if (signal?.aborted) throw Error('Cancelled');
    if (error) throw Error('The product catalog could not be loaded. Reconnect and retry.');
    if (!Array.isArray(data)) throw Error('Invalid catalog response.');
    if (offset === 2000 && data.length) break;
    products.push(...data.map(row => productFromRow(row as Record<string, unknown>)));
    if (data.length < 250) return products;
  }
  throw Error('The catalog exceeds the V1 safety limit of 2,000 products. No partial catalog was used.');
}
