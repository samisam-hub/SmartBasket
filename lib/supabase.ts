import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
export const supabaseConfigured = Boolean(url && key);
// Keep local-only onboarding available when backend configuration is added later.
export const preferencesStorageKey = "smartbasket.preferences.v1";
let client: SupabaseClient | null = null;
// Bound network waits so offline onboarding can finish locally.
const timedFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init?.signal?.aborted) controller.abort();
  init?.signal?.addEventListener("abort", abort);
  const timer = setTimeout(abort, 12000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener("abort", abort);
  }
};
export function getSupabaseClient(): SupabaseClient | null {
  if (!url || !key) return null;
  client ??= createClient(url, key, {
    global: { fetch: timedFetch },
    auth: {
      storage: AsyncStorage,
      storageKey: `smartbasket-auth:${url}`,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
