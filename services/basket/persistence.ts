import type { SavedBasket, BasketGenerationResult } from '../../types/basket';
import type { UserPreferences } from '../../types/preferences';
import { isSaved } from '../preference-domain';
import { groups } from './scoring';
import { isMealPlan } from '../meals/validation';
export interface BasketStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export interface RemoteBaskets { save(basket: SavedBasket): Promise<string>; list(ownerId: string): Promise<SavedBasket[]> }
export function isBasketResult(v: unknown): v is BasketGenerationResult {
  if (!v || typeof v !== 'object') return false;
  const r = v as BasketGenerationResult;
  return ['1','2'].includes(r.engineVersion) && (r.engineVersion==='2'?['generated','partial','empty']:['generated','partial']).includes(r.status) &&
    (r.engineVersion!=='2'||(isMealPlan(r.mealPlan)&&r.mealPlan.status==='confirmed'&&Array.isArray(r.ingredientRequirements)&&r.ingredientRequirements.every(x=>x&&typeof x.ingredientKey==='string'&&Number.isFinite(x.requiredQuantity)&&x.requiredQuantity>0))) &&
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
export class BasketPersistence {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private storage: BasketStorage, private remote: RemoteBaskets | null) {}
  private key(owner: string | null) { return `smartbasket.baskets.v1:${owner ?? 'device'}`; }
  private async local(owner: string | null): Promise<SavedBasket[]> {
    const index = await this.storage.getItem(this.key(owner));
    if (!index) return [];
    const ids: unknown = JSON.parse(index);
    if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) throw Error('Saved basket index is unreadable. It has been preserved.');
    const rows: SavedBasket[] = [];
    for (const id of ids) {
      const raw = await this.storage.getItem(`${this.key(owner)}:${id}`);
      if (!raw) throw Error('A saved basket is missing from device storage.');
      const row: unknown = JSON.parse(raw);
      if (!isSavedBasket(row) || row.ownerId !== owner) throw Error('A saved basket is unreadable or belongs to another session.');
      rows.push(row);
    }
    return rows;
  }
  private async write(basket: SavedBasket) {
    const raw = await this.storage.getItem(this.key(basket.ownerId));
    const ids: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) throw Error('Saved basket index is unreadable. It has been preserved.');
    await this.storage.setItem(`${this.key(basket.ownerId)}:${basket.id}`, JSON.stringify(basket));
    await this.storage.setItem(this.key(basket.ownerId), JSON.stringify([...new Set([basket.id, ...ids])]));
  }
  save(basket: SavedBasket): Promise<{ basket: SavedBasket; warning: string | null }> {
    const run = async () => {
      if (!isSavedBasket(basket)) throw Error('This basket cannot be saved. Generate a valid nonempty basket first.');
      await this.write(basket); // Never claim success before the device write succeeds.
      if (!this.remote || !basket.ownerId) return { basket, warning: 'Saved on this device only. Cloud storage is unavailable for this session.' };
      try {
        const cloudId = await this.remote.save(basket);
        const synced: SavedBasket = { ...basket, cloudId, syncStatus: 'synced' };
        try { await this.write(synced); }
        catch { return { basket: synced, warning: 'Saved online; the device sync marker could not be updated. Retrying is safe.' }; }
        return { basket: synced, warning: null };
      } catch { return { basket, warning: 'Saved on this device. Cloud save failed; use Retry cloud save when connected.' }; }
    };
    const task = this.tail.then(run); this.tail = task.catch(() => {}); return task;
  }
  async list(ownerId: string | null): Promise<{ baskets: SavedBasket[]; warning: string | null }> {
    await this.tail;
    const local = await this.local(ownerId);
    if (!ownerId || !this.remote) return { baskets: local, warning: 'Showing baskets saved on this device.' };
    try {
      const cloud = await this.remote.list(ownerId);
      if (!cloud.every(b => isSavedBasket(b) && b.ownerId === ownerId)) throw Error('Invalid cloud basket');
      const merged = new Map(local.map(b => [b.id, b]));
      cloud.forEach(b => merged.set(b.id, b));
      // Cache cloud snapshots so they can be reopened after going offline.
      const cache = this.tail.then(async () => { for (const b of cloud) await this.write(b); });
      this.tail = cache.catch(() => {});
      let warning: string | null = null;
      try { await cache; } catch { warning = 'Loaded online; some baskets could not be cached for offline use.'; }
      return { baskets: [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)), warning };
    } catch { return { baskets: local, warning: 'Cloud baskets could not be loaded. Showing device copies.' }; }
  }
}
export function newSavedBasket(result: BasketGenerationResult, preferences: UserPreferences, ownerId: string | null): SavedBasket {
  return { id: `basket-${Date.now()}-${Math.random().toString(36).slice(2)}`, cloudId: null, ownerId,
    name: `${preferences.planningDays}-day basket`, createdAt: new Date().toISOString(), preferences,
    result, syncStatus: 'local' };
}
