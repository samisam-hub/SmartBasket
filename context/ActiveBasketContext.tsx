import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedBasket } from '../types/basket';
import type { Product } from '../types/product';
import { useAuth } from './AuthContext';
import { isSavedBasket } from '../services/basket/persistence';
import { basketPersistence } from '../services/baskets';
import { addBasketProduct } from '../services/basket/add-product';

const Context = createContext<{
  active: SavedBasket | null; remember: (b: SavedBasket) => void; clear: (id: string) => void;
  add: (p: Product) => Promise<string>; busy: boolean;
} | null>(null);
export function ActiveBasketProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const owner = session?.user.id ?? null;
  const key = `smartbasket.active-basket.v1:${owner ?? 'local'}`;
  const [active, setActive] = useState<SavedBasket | null>(null), [busy, setBusy] = useState(false);
  const current = useRef<SavedBasket | null>(null), lock = useRef(false), revision = useRef(0);
  const remember = useCallback((b: SavedBasket) => {
    if (b.ownerId !== owner || b.result.purchasedAt) return;
    revision.current++; current.current = b; setActive(b);
    void AsyncStorage.setItem(key, JSON.stringify(b)).catch(() => {});
  }, [key, owner]);
  const clear = useCallback((id: string) => {
    if (current.current?.id !== id) return;
    revision.current++; current.current = null; setActive(null); void AsyncStorage.removeItem(key);
  }, [key]);
  useEffect(() => {
    let alive = true; const version = revision.current;
    void AsyncStorage.getItem(key).then(raw => {
      if (!alive || version !== revision.current || !raw) return;
      const b: unknown = JSON.parse(raw);
      if (isSavedBasket(b) && b.ownerId === owner && !b.result.purchasedAt) { current.current = b; setActive(b); }
    }).catch(() => {});
    return () => { alive = false; };
  }, [key, owner]);
  const add = async (p: Product) => {
    if (lock.current) throw Error('Please wait for the current product to finish saving.');
    const b = current.current;
    if (!b || b.ownerId !== owner || b.result.purchasedAt) throw Error('Open or create a basket first.');
    lock.current = true; setBusy(true);
    const version = revision.current;
    try {
      const next = { ...b, result: addBasketProduct(b.result, p), syncStatus: 'local' as const };
      const response = await basketPersistence().save(next);
      if (revision.current === version) remember(response.basket);
      return response.warning ?? `Added to ${b.name}`;
    } finally { lock.current = false; setBusy(false); }
  };
  return <Context.Provider value={{ active, remember, clear, add, busy }}>{children}</Context.Provider>;
}
export function useActiveBasket() { const value = useContext(Context); if (!value) throw Error('ActiveBasketProvider missing'); return value; }
