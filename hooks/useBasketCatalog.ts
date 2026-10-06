import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { loadBasketCatalog } from '@/services/basket/catalog';
import type { Product } from '@/types/product';

/** The product catalog is the same for everybody and changes rarely, so it is fetched once per app
 *  run and shared by every screen that asks. It used to be loaded per screen, and since choosing a
 *  meal moves on to the next slot, every single decision paid for the whole catalog again. Without
 *  it meals can still be chosen; package matching then reports what it could not buy instead of
 *  inventing products. */
export type BasketCatalog = { products: Product[]; loading: boolean; error: string | null };
const pending: BasketCatalog = { products: [], loading: true, error: null };
let cached: BasketCatalog | null = null;
let inFlight: Promise<BasketCatalog> | null = null;

async function read(): Promise<BasketCatalog> {
  try {
    return { products: await loadBasketCatalog(getSupabaseClient()), loading: false, error: null };
  } catch (e) {
    return { products: [], loading: false,
      error: e instanceof Error ? e.message : 'The product catalog could not be loaded.' };
  }
}
/** One fetch, however many screens are waiting. A failure is not kept, so the next screen retries. */
function start(): Promise<BasketCatalog> {
  inFlight ??= read().then(result => {
    inFlight = null;
    if (!result.error) cached = result;
    return result;
  });
  return inFlight;
}
/** Begin loading before a screen needs it. The calendar calls this, so the fetch runs while the
 *  household is still picking days and the first card does not have to wait for it. */
export function primeBasketCatalog(): void {
  if (!cached) void start();
}
/** Test seam: the cache lives for the life of the process, which outlives a single test. */
export function resetBasketCatalog(): void {
  cached = null;
  inFlight = null;
}
export function useBasketCatalog(): BasketCatalog {
  const [state, setState] = useState<BasketCatalog>(() => cached ?? pending);
  useEffect(() => {
    if (cached) {
      setState(cached);
      return;
    }
    let active = true;
    void start().then(result => { if (active) setState(result); });
    return () => { active = false; };
  }, []);
  return state;
}
