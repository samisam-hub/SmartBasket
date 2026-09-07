import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
import { scopedRemotePreferences } from "@/services/preferences-repository";
import {useAuth} from './AuthContext';
import {migrateOwnedCache} from '../services/scope-migration';

const Context = createContext<PreferenceStore | null>(null);
export function PreferencesProvider({ children }: PropsWithChildren) {
  const {session}=useAuth();
  const owner=session?.user.id??'local';
  const scopedKey=`${preferencesStorageKey}:${owner}`;
  const store = useMemo(
    () =>
      new PreferenceStore(
        AsyncStorage,
        scopedKey,
        supabaseConfigured&&owner!=='local' ? scopedRemotePreferences(owner) : null,
      ), [scopedKey,owner]
  );
  useEffect(() => {
    void (async()=>{
      // Copy legacy data only to its existing owner; never expose it to a different login.
      await migrateOwnedCache(AsyncStorage,preferencesStorageKey,scopedKey,owner,!!session?.user.is_anonymous||owner==='local','userId');
      await store.initialize();
    })().catch(()=>{void store.initialize();});
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
  }, [store,scopedKey,owner,session?.user.is_anonymous]);
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
