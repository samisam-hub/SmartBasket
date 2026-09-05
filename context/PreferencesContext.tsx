import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import {
  getSupabaseClient,
  preferencesStorageKey,
  supabaseConfigured,
} from "@/lib/supabase";
import { PreferenceStore } from "@/services/preference-store";
import { remotePreferences } from "@/services/preferences-repository";

const Context = createContext<PreferenceStore | null>(null);
export function PreferencesProvider({ children }: PropsWithChildren) {
  const [store] = useState(
    () =>
      new PreferenceStore(
        AsyncStorage,
        preferencesStorageKey,
        supabaseConfigured ? remotePreferences : null,
      ),
  );
  useEffect(() => {
    void store.initialize();
    let cleanup = () => {};
    try {
      const client = getSupabaseClient();
      if (client) {
        const refresh = (state: string) => {
          if (state === "active") void client.auth.startAutoRefresh();
          else void client.auth.stopAutoRefresh();
        };
        refresh(AppState.currentState);
        const subscription = AppState.addEventListener("change", refresh);
        cleanup = () => {
          subscription.remove();
          void client.auth.stopAutoRefresh();
        };
      }
    } catch {
      /* The repository reports malformed/missing configuration in the UI. */
    }
    return cleanup;
  }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function usePreferences() {
  const store = useContext(Context);
  if (!store) throw new Error("PreferencesProvider is missing");
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return { ...state, store };
}
