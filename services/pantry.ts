import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../lib/supabase';
import { basketPersistence } from './baskets';
import { checkoutPantry } from './pantry-domain';
import type { PantryState, Purchase } from '../types/pantry';
import type { SavedBasket } from '../types/basket';
type Journal = { state: PantryState; purchases: Purchase[] };
const key = (owner:string|null) => `smartbasket.pantry.v1:${owner ?? 'device'}`;
let tail:Promise<unknown> = Promise.resolve();
function queue<T>(fn:()=>Promise<T>):Promise<T>{const task=tail.then(fn);tail=task.catch(()=>{});return task;}
async function clientFor(owner:string){const client=getSupabaseClient();if(!client)throw Error('Connect to SmartBasket to update your pantry.');const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==owner)throw Error('Your session changed. Reopen your basket.');return client;}
export async function loadPantry(owner:string|null):Promise<Journal>{
 if(owner){
  const client=await clientFor(owner);
  const stock=await client.from('pantry_state').select('version,lots').eq('user_id',owner).maybeSingle();
  if(stock.error)throw Error('Pantry unavailable. Reconnect before using stock or checking out.');
  const purchases:Purchase[]=[];
  // Read every page so lifetime reuse totals do not stop at the API row limit.
  for(let offset=0;;offset+=100){
   const history=await client.from('purchase_history').select('basket_key,purchased_at,snapshot').eq('user_id',owner).order('basket_key').range(offset,offset+99);
   if(history.error||!history.data)throw Error('Purchase history unavailable. Please try again.');
   purchases.push(...history.data.map(p=>({basketId:p.basket_key,purchasedAt:p.purchased_at,basket:p.snapshot})));
   if(history.data.length<100)break;
  }
  purchases.sort((a,b)=>b.purchasedAt.localeCompare(a.purchasedAt));
  return {state:stock.data??{version:0,lots:[]},purchases};
 }
 const raw=await AsyncStorage.getItem(key(owner));return raw?JSON.parse(raw):{state:{version:0,lots:[]},purchases:[]};
}
export function checkoutBasket(basket:SavedBasket){return queue(async()=>{
 const journal=await loadPantry(basket.ownerId),previous=journal.purchases.find(p=>p.basketId===basket.id);
 if(previous){await basketPersistence().cache(previous.basket);return previous.basket;}
 const purchasedAt=new Date().toISOString(),next=checkoutPantry(journal.state,basket,purchasedAt);
 let completed:SavedBasket={...basket,result:{...basket.result,purchasedAt}};
 if(basket.ownerId){const client=await clientFor(basket.ownerId);const saved=await basketPersistence().save(basket);if(saved.warning||!saved.basket.cloudId)throw Error('Save your basket online before checkout.');const {data,error}=await client.rpc('checkout_basket',{p_basket_key:basket.id,p_version:journal.state.version,p_lots:next.lots,p_expected_result:basket.result});if(error)throw Error(error.message);completed={...saved.basket,result:{...basket.result,purchasedAt:data.purchasedAt}};}
 else {await AsyncStorage.setItem(key(null),JSON.stringify({state:next,purchases:[{basketId:basket.id,purchasedAt,basket:completed},...journal.purchases]}));await basketPersistence().save(completed);}
 await basketPersistence().cache(completed).catch(()=>{});
 return completed;
 });}
export function removePantryLot(owner:string|null,id:string){return queue(async()=>{const journal=await loadPantry(owner);const state={version:journal.state.version+1,lots:journal.state.lots.filter(l=>l.id!==id)};if(owner){const client=await clientFor(owner);const {data,error}=await client.from('pantry_state').update(state).eq('user_id',owner).eq('version',journal.state.version).select('version');if(error||!data?.length)throw Error('Pantry changed. Reload and try again.');}else await AsyncStorage.setItem(key(null),JSON.stringify({...journal,state}));});}
