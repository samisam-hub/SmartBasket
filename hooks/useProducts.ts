import { failureIllustration } from '../lib/failureIllustration';
import { useCallback, useEffect, useRef, useState } from "react";
import { getProductRepository } from "@/services/products";
import { emptyFilters, type CatalogFilters, type Product } from "@/types/product";
import { usePreferences } from "@/context/PreferencesContext";
export function useProducts() {
  const { saved } = usePreferences();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CatalogFilters>(emptyFilters);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [warning, setWarning] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"catalog" | "demo">("catalog");
  const [failureKind,setFailureKind]=useState<'offline'|'dataError'|undefined>();
  const [revision, setRevision] = useState(0);
  const generation = useRef(0), page = useRef(0), pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const readyKey = useRef("");
  const key = JSON.stringify([query, filters, saved?.dietaryPreferences, saved?.allergens]);
  useEffect(() => {
    const current = ++generation.current;
    const abort = new AbortController();
    controller.current?.abort(); controller.current = abort;
    pending.current = true; readyKey.current = "";
    setLoading(true); setLoadingMore(false); setError(null); setWarning(null); setProducts([]); setHasMore(false);
    const timer = setTimeout(() => {
      void getProductRepository().page(query, filters, saved, 0, "catalog", abort.signal).then(result => {
        if (generation.current !== current || abort.signal.aborted) return;
        setProducts(result.products); setHasMore(result.hasMore); setMode(result.mode); setWarning(result.warning);setFailureKind(result.failureKind);
        page.current = 0; readyKey.current = key;
      }).catch(cause => {
        if (!abort.signal.aborted && generation.current === current) {setFailureKind(failureIllustration(cause));setError("Catalog could not be loaded. Please retry.");}
      }).finally(() => {
        if (!abort.signal.aborted && generation.current === current) { pending.current = false; setLoading(false); }
      });
    }, query.trim() ? 300 : 0);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [key, revision, query, filters, saved]);
  const loadMore = useCallback(() => {
    if (pending.current || loading || !hasMore || readyKey.current !== key) return;
    pending.current = true; setLoadingMore(true); setError(null);
    const current = generation.current, next = page.current + 1;
    void getProductRepository().page(query, filters, saved, next, mode, controller.current?.signal).then(result => {
      if (generation.current !== current) return;
      setProducts(previous => [...previous, ...result.products.filter(p => !previous.some(old => old.id === p.id))]);
      setHasMore(result.hasMore); page.current = next;
    }).catch(cause => {
      if (generation.current === current) {setFailureKind(failureIllustration(cause));setError("More products could not be loaded. Your current results are still available.");}
    }).finally(() => {
      if (generation.current === current) { pending.current = false; setLoadingMore(false); }
    });
  }, [loading, hasMore, key, query, filters, saved, mode]);
  return { query, setQuery, filters, setFilters, products, saved, loading, loadingMore,
    hasMore, loadMore, mode, warning, error, failureKind, retry: () => setRevision(v => v + 1) };
}
