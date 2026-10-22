import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '../../types/product';
import { productFromRow } from '../catalog/product-row';
/** Read SmartBasket only. Never substitute fictional demo products for a real basket. */
export async function loadBasketCatalog(client: SupabaseClient | null, signal?: AbortSignal): Promise<Product[]> {
  if (!client) throw Error("Verbinde dich mit dem SmartBasket-Katalog, um einen Warenkorb zu erstellen. Gespeicherte Warenkörbe bleiben offline verfügbar.");
  const products: Product[] = [];
  for (let offset = 0; offset <= 2000; offset += 250) {
    if (signal?.aborted) throw Error('Cancelled');
    let request = client.from('products').select('*').neq('source', 'demo').order('id').range(offset, offset === 2000 ? offset : offset + 249);
    if (signal) request = request.abortSignal(signal);
    const { data, error } = await request;
    if (signal?.aborted) throw Error('Cancelled');
    if (error) throw Error("Der Produktkatalog konnte nicht geladen werden. Stelle die Verbindung wieder her und versuche es erneut.");
    if (!Array.isArray(data)) throw Error("Ungültige Katalogantwort.");
    if (offset === 2000 && data.length) break;
    products.push(...data.map(row => productFromRow(row as Record<string, unknown>)));
    if (data.length < 250) return products;
  }
  throw Error("Der Katalog überschreitet die unterstützte Grenze von 2.000 Produkten. Es wurde kein unvollständiger Katalog verwendet.");
}
