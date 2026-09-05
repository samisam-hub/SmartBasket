import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigured = Boolean(url && key);
let client: SupabaseClient | null = null;

/** Lazy initialization keeps the local catalog usable without a backend. */
export function getSupabaseClient(): SupabaseClient | null {
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: {
        storage: AsyncStorage,
        storageKey: 'smartbasket-auth',
        persistSession: true,
        // Enable foreground session refresh when authentication is introduced.
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
