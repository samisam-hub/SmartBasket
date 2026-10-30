import { t } from '../i18n';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SavedBasket } from '../../types/basket';
import { isSavedBasket, type RemoteBaskets } from './persistence';
export function remoteBaskets(client: SupabaseClient): RemoteBaskets {
  const verifyOwner = async (owner: string) => {
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== owner) throw Error(t('remote.basket.otherSession'));
  };
  return {
    async rename(owner,id,name){await verifyOwner(owner);const {error}=await client.rpc('rename_saved_basket',{p_request_key:id,p_name:name});if(error)throw Error(t('remote.basket.renameFailed'));},
    async remove(owner,id){await verifyOwner(owner);const {error}=await client.rpc('delete_saved_basket',{p_request_key:id});if(error)throw Error(t('remote.basket.deleteFailed'));},
    async save(basket) {
      if (!basket.ownerId) throw Error("Keine Cloud-Sitzung");
      await verifyOwner(basket.ownerId);
      const { data, error } = basket.cloudId ? await client.rpc('update_saved_basket', { p_request_key: basket.id, p_result: basket.result }) : await client.rpc('save_generated_basket', { p_request_key: basket.id,
        p_name: basket.name, p_preferences: basket.preferences, p_result: basket.result });
      if (error || typeof data !== 'string') throw Error(t('remote.basket.saveFailed'));
      return data;
    },
    async list(owner) {
      await verifyOwner(owner);
      const baskets:SavedBasket[]=[];
      for(let offset=0;;offset+=50){
      const { data, error } = await client.from('baskets').select('*,basket_items(position,item_snapshot)')
        .eq('user_id', owner).order('created_at', { ascending: false }).order('id').range(offset,offset+49);
      if (error || !Array.isArray(data)) throw Error(t('remote.basket.unavailable'));
      baskets.push(...data.map(row => {
        const items = row.basket_items as { position: number; item_snapshot: unknown }[];
        if (!Array.isArray(items)) throw Error(t('remote.basket.invalidItems'));
        const basket: unknown = { id: row.request_key, cloudId: row.id, ownerId: row.user_id, name: row.name,
          createdAt: row.created_at, preferences: row.preferences_snapshot, syncStatus: 'synced',
          result: { ...row.result_summary, items: [...items].sort((a, b) => a.position - b.position).map(i => i.item_snapshot) } };
        if (!isSavedBasket(basket)) throw Error(t('remote.basket.invalidSaved'));
        return basket;
      }));
      if(data.length<50)break;
      }
      await verifyOwner(owner);return baskets;
    },
  };
}
