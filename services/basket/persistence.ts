import { basketDayCount } from './naming';
import type { SavedBasket, BasketGenerationResult } from '../../types/basket';
import type { UserPreferences } from '../../types/preferences';
import { isSaved } from '../preference-domain';
import { groups } from './scoring';
import { isAnyMealPlan } from '../meals/validation';
export interface BasketStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export interface RemoteBaskets { save(basket: SavedBasket): Promise<string>; list(ownerId: string): Promise<SavedBasket[]>; rename?(ownerId:string,id:string,name:string):Promise<void>; remove?(ownerId:string,id:string):Promise<void> }
export function isBasketResult(v: unknown): v is BasketGenerationResult {
  if (!v || typeof v !== 'object') return false;
  const r = v as BasketGenerationResult;
  if (!Array.isArray(r.items)) return false;
  if (r.excludedItems !== undefined) {
    if (!Array.isArray(r.excludedItems)) return false;
    if (r.excludedItems.length && !isBasketResult({ ...r, excludedItems: undefined, items: r.excludedItems })) return false;
    if (r.excludedItems.some(i => r.items.some(selected => selected?.product?.id === i.product.id))) return false;
    if (new Set(r.excludedItems.map(i => i.product.id)).size !== r.excludedItems.length) return false;
  }
  return ['1','2'].includes(r.engineVersion) && (r.engineVersion==='2'?['generated','partial','empty']:['generated','partial']).includes(r.status) &&
    (r.engineVersion!=='2'||(isAnyMealPlan(r.mealPlan)&&r.mealPlan.status==='confirmed'&&Array.isArray(r.ingredientRequirements)&&r.ingredientRequirements.every(x=>x&&typeof x.ingredientKey==='string'&&Number.isFinite(x.requiredQuantity)&&x.requiredQuantity>0))) &&
    [r.totalCalories, r.totalProtein, r.totalCarbohydrates, r.totalFat, r.calorieTarget, r.proteinTarget, r.score, r.calorieCoveragePercent, r.proteinCoveragePercent, r.knownPriceSubtotal, r.dailyProteinTarget].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0) &&
    typeof r.proteinRule === 'string' && ['disabled','unknown','within_budget','slightly_over','unachievable','over_budget','price_incomplete'].includes(r.budgetStatus) &&
    (r.budgetTarget === null || (typeof r.budgetTarget === 'number' && Number.isFinite(r.budgetTarget) && r.budgetTarget > 0)) &&
    (r.budgetDifference === null || (typeof r.budgetDifference === 'number' && Number.isFinite(r.budgetDifference))) &&
    (r.estimatedTotalPrice === null || (typeof r.estimatedTotalPrice === 'number' && Number.isFinite(r.estimatedTotalPrice) && r.estimatedTotalPrice >= 0)) &&
    Array.isArray(r.warnings) && r.warnings.every(w => w && typeof w.code === 'string' && typeof w.message === 'string') &&
    Array.isArray(r.categoryCoverage) && r.categoryCoverage.every(c => c && groups.includes(c.group) && typeof c.represented === 'boolean') &&
    Array.isArray(r.items) && (r.engineVersion==='2'||r.items.length>0) && r.items.length <= (r.engineVersion==='2'?64:24) && r.items.every(i => i && i.product && typeof i.product.id === 'string' && typeof i.product.name === 'string' &&
      (r.engineVersion!=='2'||(typeof i.ingredientKey==='string'&&Array.isArray(i.sourceMealIds)&&i.sourceMealIds.every(s=>typeof s==='string')&&
        [i.purchasedQuantity,i.plannedConsumptionQuantity,i.leftoverQuantity].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)&&
        Math.abs(i.purchasedQuantity!-i.plannedConsumptionQuantity!-i.leftoverQuantity!)<0.01&&Math.abs(i.purchasedQuantity!-i.packageCount*i.packageAmount)<0.01))&&
      typeof i.product.source === 'string' && (i.product.brand === null || typeof i.product.brand === 'string') &&
      (i.product.quantityLabel === null || typeof i.product.quantityLabel === 'string') &&
      Number.isInteger(i.packageCount) && i.packageCount > 0 && typeof i.packageAmount === 'number' && Number.isFinite(i.packageAmount) && i.packageAmount > 0 &&
      ['g', 'ml'].includes(i.quantityUnit) && typeof i.quantityAssumed === 'boolean' &&
      [i.totalCalories, i.totalProtein, i.totalCarbohydrates, i.totalFat].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0) &&
      (i.estimatedPrice === null || (typeof i.estimatedPrice === 'number' && Number.isFinite(i.estimatedPrice) && i.estimatedPrice >= 0)) &&
      Array.isArray(i.reasonSelected) && i.reasonSelected.every(reason => reason && typeof reason.code === 'string' && typeof reason.detail === 'string'));
}
export function isSavedBasket(v: unknown): v is SavedBasket {
  if (!v || typeof v !== 'object') return false;
  const b = v as SavedBasket;
  return typeof b.id === 'string' && typeof b.name === 'string' && typeof b.createdAt === 'string' &&
    (b.ownerId === null || typeof b.ownerId === 'string') && (b.cloudId === null || typeof b.cloudId === 'string') &&
    ['local', 'synced'].includes(b.syncStatus) && isSaved(b.preferences) && isBasketResult(b.result);
}
/** Each basket is its own entry, avoiding oversized Android AsyncStorage values. */
type Change = {kind:'rename';name:string}|{kind:'delete';synced?:boolean};
export function basketName(value:string){const name=value.trim();if(!name||name.length>120)throw Error("Gib einen Warenkorbnamen mit 1–120 Zeichen ein.");return name;}
export class BasketPersistence {
 private tail:Promise<unknown>=Promise.resolve();
 constructor(private storage:BasketStorage,private remote:RemoteBaskets|null){}
 private key(owner:string|null){return `smartbasket.baskets.v1:${owner??'device'}`;}
 private queue<T>(run:()=>Promise<T>):Promise<T>{const task=this.tail.then(run);this.tail=task.catch(()=>{});return task;}
 private async changes(owner:string|null):Promise<Record<string,Change>>{
  const raw=await this.storage.getItem(`${this.key(owner)}:changes`);if(!raw)return {};
  const v=JSON.parse(raw);if(!v||typeof v!=='object'||Array.isArray(v)||!Object.values(v).every((x)=>{const c=x as Change;return c?.kind==='delete'||c?.kind==='rename'&&typeof c.name==='string'&&c.name===basketName(c.name);}))throw Error("Warenkorbänderungen konnten nicht gelesen werden. Sie wurden beibehalten.");return v;
 }
 private putChanges(owner:string|null,v:Record<string,Change>){return this.storage.setItem(`${this.key(owner)}:changes`,JSON.stringify(v));}
 private async local(owner:string|null):Promise<SavedBasket[]>{
  const raw=await this.storage.getItem(this.key(owner)),ids:unknown=raw?JSON.parse(raw):[];
  if(!Array.isArray(ids)||!ids.every(id=>typeof id==='string'))throw Error("Das Verzeichnis gespeicherter Warenkörbe ist nicht lesbar und wurde beibehalten.");
  const changes=await this.changes(owner),rows:SavedBasket[]=[];
  for(const id of ids){if(changes[id]?.kind==='delete')continue;const value=await this.storage.getItem(`${this.key(owner)}:${id}`);if(!value)throw Error("Ein gespeicherter Warenkorb fehlt im Gerätespeicher.");const b:unknown=JSON.parse(value);if(!isSavedBasket(b)||b.ownerId!==owner)throw Error("Ein gespeicherter Warenkorb ist nicht lesbar oder gehört zu einer anderen Sitzung.");const c=changes[id];rows.push(c?.kind==='rename'?{...b,name:c.name,syncStatus:'local'}:b);}
  return rows;
 }
 private async write(b:SavedBasket){const raw=await this.storage.getItem(this.key(b.ownerId)),ids:unknown=raw?JSON.parse(raw):[];if(!Array.isArray(ids)||!ids.every(id=>typeof id==='string'))throw Error("Das Verzeichnis gespeicherter Warenkörbe ist nicht lesbar und wurde beibehalten.");await this.storage.setItem(`${this.key(b.ownerId)}:${b.id}`,JSON.stringify(b));await this.storage.setItem(this.key(b.ownerId),JSON.stringify([...new Set([b.id,...ids])]));}
 private async erase(owner:string|null,id:string){
  const raw=await this.storage.getItem(this.key(owner)),ids:unknown=raw?JSON.parse(raw):[];
  if(!Array.isArray(ids)||!ids.every(x=>typeof x==='string'))throw Error("Das Verzeichnis gespeicherter Warenkörbe ist nicht lesbar.");
  await this.storage.setItem(this.key(owner),JSON.stringify(ids.filter(x=>x!==id)));
  // Clear snapshot contents, also on storage adapters without removeItem.
  await this.storage.setItem(`${this.key(owner)}:${id}`,'');
 }
 private async syncChanges(owner:string|null){
  const changes=await this.changes(owner);if(!Object.keys(changes).length)return null;
  let failed=false;
  for(const [id,c] of Object.entries(changes)){
   try{
    if(c.kind==='delete'){
     await this.erase(owner,id);
     if(owner&&this.remote&&!c.synced){if(!this.remote.remove)throw Error();await this.remote.remove(owner,id);}
     if(!c.synced){changes[id]={kind:'delete',synced:true};await this.putChanges(owner,changes);}
     // Keep an ID-only tombstone to prevent stale open screens from restoring a deletion.
    }else{
     const b=(await this.local(owner)).find(x=>x.id===id);if(!b)throw Error("Umbenannter Warenkorb fehlt");
     let updated=b;
     if(owner&&this.remote){if(!this.remote.rename)throw Error();const cloudId=b.cloudId??await this.remote.save(b);await this.remote.rename(owner,id,c.name);updated={...b,cloudId,syncStatus:'synced'};}
     await this.write(updated);delete changes[id];await this.putChanges(owner,changes);
    }
   }catch{failed=true;}
  }
  return failed?"Änderungen auf diesem Gerät gespeichert. Die Cloud-Synchronisierung steht aus. Nutze bei bestehender Verbindung Gespeicherte Warenkörbe neu laden.":null;
 }
 cache(b:SavedBasket):Promise<void>{return this.queue(async()=>{if(!isSavedBasket(b))throw Error("Ungültiger Warenkorbstand");if((await this.changes(b.ownerId))[b.id]?.kind==='delete')return;await this.write(b);});}
 save(b:SavedBasket):Promise<{basket:SavedBasket;warning:string|null}>{return this.queue(async()=>{
  if(!isSavedBasket(b))throw Error("Dieser Warenkorb kann nicht gespeichert werden. Erstelle zuerst einen gültigen, nicht leeren Warenkorb.");
  const existing=(await this.local(b.ownerId)).find(x=>x.id===b.id);if(existing?.result.purchasedAt&&JSON.stringify(existing.result)!==JSON.stringify(b.result))throw Error("Bereits eingekaufte Warenkörbe können nicht bearbeitet werden.");
  const changes=await this.changes(b.ownerId);if(changes[b.id]?.kind==='delete')throw Error("Dieser Warenkorb wurde gelöscht.");
  const c=changes[b.id];if(c?.kind==='rename')b={...b,name:c.name};await this.write(b);
  if(!this.remote||!b.ownerId)return {basket:b,warning:"Nur auf diesem Gerät gespeichert. Der Cloud-Speicher ist für diese Sitzung nicht verfügbar."};
  try{const cloudId=await this.remote.save(b),synced:SavedBasket={...b,cloudId,syncStatus:'synced'};try{await this.write(synced);}catch{return {basket:synced,warning:"Online gespeichert. Der Synchronisierungsstatus auf dem Gerät konnte nicht aktualisiert werden. Du kannst es gefahrlos erneut versuchen."};}return {basket:synced,warning:null};}
  catch{return {basket:b,warning:"Auf diesem Gerät gespeichert. Cloud-Speicherung fehlgeschlagen. Nutze bei bestehender Verbindung Erneut in der Cloud speichern."};}
 });}
 rename(owner:string|null,id:string,value:string){return this.queue(async()=>{
  const name=basketName(value);if(!(await this.local(owner)).some(b=>b.id===id))throw Error("Warenkorb in diesem Konto nicht gefunden.");
  const changes=await this.changes(owner);changes[id]={kind:'rename',name};await this.putChanges(owner,changes);return {warning:await this.syncChanges(owner)};
 });}
 isDeleted(owner:string|null,id:string){return this.queue(async()=> (await this.changes(owner))[id]?.kind==='delete');}
 discard(b:SavedBasket){return this.queue(async()=>{
  if(!isSavedBasket(b)||b.result.purchasedAt)throw Error("Nur ein noch nicht abgeschlossener Warenkorb kann verworfen werden.");
  const existing=(await this.local(b.ownerId)).find(x=>x.id===b.id);
  if(existing?.result.purchasedAt)throw Error("Bereits eingekaufte Warenkörbe können nicht verworfen werden.");
  const changes=await this.changes(b.ownerId);changes[b.id]={kind:'delete'};
  await this.putChanges(b.ownerId,changes);return {warning:await this.syncChanges(b.ownerId)};
 });}
 remove(owner:string|null,id:string){return this.queue(async()=>{
  const changes=await this.changes(owner);if(changes[id]?.kind!=='delete'&&!(await this.local(owner)).some(b=>b.id===id))throw Error("Warenkorb in diesem Konto nicht gefunden.");
  changes[id]={kind:'delete'};await this.putChanges(owner,changes);return {warning:await this.syncChanges(owner)};
 });}
 list(owner:string|null):Promise<{baskets:SavedBasket[];warning:string|null}>{return this.queue(async()=>{
  const pending=await this.syncChanges(owner),local=await this.local(owner);
  if(!owner||!this.remote)return {baskets:local,warning:pending??"Auf diesem Gerät gespeicherte Warenkörbe werden angezeigt."};
  try{
   const cloud=await this.remote.list(owner);if(!cloud.every(b=>isSavedBasket(b)&&b.ownerId===owner))throw Error("Ungültiger Cloud-Warenkorb");
   const changes=await this.changes(owner),merged=new Map(local.filter(b=>b.syncStatus!=='synced'||changes[b.id]).map(b=>[b.id,b]));
   for(const b of cloud){if(changes[b.id])continue;merged.set(b.id,b);}
   let warning=pending;
   try{for(const b of merged.values())await this.write(b);for(const b of local)if(!merged.has(b.id))await this.erase(owner,b.id);}catch{warning="Online geladen. Der Gerätespeicher konnte nicht aktualisiert werden.";}
   return {baskets:[...merged.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)),warning};
  }catch{return {baskets:local,warning:pending??"Cloud-Warenkörbe konnten nicht geladen werden. Gerätekopien werden angezeigt."};}
 });}
}
export function newSavedBasket(result: BasketGenerationResult, preferences: UserPreferences, ownerId: string | null): SavedBasket {
  return { id: `basket-${Date.now()}-${Math.random().toString(36).slice(2)}`, cloudId: null, ownerId,
    name: `Warenkorb für ${basketDayCount(result, preferences)} ${basketDayCount(result, preferences) === 1 ? "Tag" : "Tage"}`, createdAt: new Date().toISOString(), preferences,
    result, syncStatus: 'local' };
}
