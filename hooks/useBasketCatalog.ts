import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { loadBasketCatalog } from '@/services/basket/catalog';
import type { Product } from '@/types/product';

/** The real catalog, loaded once per screen. Without it meals can still be chosen; package
 *  matching then reports what it could not buy instead of inventing products. */
export function useBasketCatalog() {
  const [state, setState] = useState<{ products: Product[]; loading: boolean; error: string | null }>(
    { products: [], loading: true, error: null });
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const products = await loadBasketCatalog(getSupabaseClient(), controller.signal);
        if (!controller.signal.aborted) setState({ products, loading: false, error: null });
      } catch (e) {
        if (!controller.signal.aborted) setState({ products: [], loading: false,
          error: e instanceof Error ? e.message : 'The product catalog could not be loaded.' });
      }
    })();
    return () => controller.abort();
  }, []);
  return state;
}
