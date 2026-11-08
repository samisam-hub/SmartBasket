import { t } from './i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../lib/supabase';
import { BasketPersistence } from './basket/persistence';
import { remoteBaskets } from './basket/remote';
let persistence: BasketPersistence | null = null;
export function basketPersistence() {
  const client = getSupabaseClient();
  return persistence ??= new BasketPersistence(AsyncStorage, client ? remoteBaskets(client) : null);
}
export async function basketOwner(preferred: string | null): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return preferred;
  const { data, error } = await client.auth.getSession();
  if (error) return preferred;
  const owner = data.session?.user.id ?? preferred;
  if (preferred && owner !== preferred) throw Error(t('baskets.otherSession'));
  return owner;
}
