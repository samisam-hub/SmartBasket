import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { keptTicks, loadTicks, saveTicks } from '@/services/basket/ticks';

/** What is already in the trolley for one list, kept so a shopping trip survives leaving the
 *  screen. Shared by the shopping tab and the basket editor so both see the same ticks. */
export function useBasketTicks(listId: string | null, presentProductIds: string[]) {
  const [ticked, setTicked] = useState<string[]>([]);
  useEffect(() => {
    if (!listId) { setTicked([]); return; }
    let active = true;
    void loadTicks(AsyncStorage, listId).then(stored => { if (active) setTicked(stored); }).catch(() => {});
    return () => { active = false; };
  }, [listId]);
  const present = presentProductIds.join('\u0000');
  const toggle = useCallback((productId: string) => {
    if (!listId) return;
    setTicked(current => {
      const next = keptTicks(
        current.includes(productId) ? current.filter(id => id !== productId) : [...current, productId],
        present ? present.split('\u0000') : []);
      void saveTicks(AsyncStorage, listId, next).catch(() => {});
      return next;
    });
  }, [listId, present]);
  return { ticked, toggle };
}
