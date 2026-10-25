import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/** The product catalog is built from fictional demo data: invented brands, invented prices. It
 *  exists to show merchants what matching would look like with their own range. Real users must
 *  not meet it by accident and take those prices for real ones, so it is off unless somebody turns
 *  it on deliberately. */
const key = 'smartbasket.merchant-demo.v1';
let enabled = false;
let loaded = false;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());

export const merchantDemoEnabled = () => enabled;
/** Anything other than the one stored value means off: a half-written flag never opens the demo. */
export async function loadMerchantDemo(): Promise<boolean> {
  try {
    enabled = (await AsyncStorage.getItem(key)) === 'on';
  } catch {
    enabled = false;
  }
  loaded = true;
  publish();
  return enabled;
}
export async function setMerchantDemo(next: boolean): Promise<void> {
  enabled = next;
  publish();
  try {
    await AsyncStorage.setItem(key, next ? 'on' : 'off');
  } catch {
    /* The switch still holds for this run; the next start falls back to off, which is the safe way. */
  }
}
export function useMerchantDemo(): { demo: boolean; ready: boolean; set: (next: boolean) => void } {
  const [state, setState] = useState({ demo: enabled, ready: loaded });
  useEffect(() => {
    const update = () => setState({ demo: enabled, ready: loaded });
    listeners.add(update);
    if (!loaded) void loadMerchantDemo();
    else update();
    return () => { listeners.delete(update); };
  }, []);
  return { demo: state.demo, ready: state.ready, set: next => { void setMerchantDemo(next); } };
}
/** Test seam: the flag outlives a single test otherwise. */
export function resetMerchantDemo(): void {
  enabled = false;
  loaded = false;
}
