import type { Purchase } from '../types/pantry';
import { planNutrition } from './meals/planner';
import { splitNutrition } from './meals/portions';

/** Reused pantry quantities committed at checkout, not unconfirmed plan previews. */
export function wastePrevention(purchases: Purchase[]) {
  const seen = new Set<string>();
  let grams = 0, millilitres = 0;
  for (const purchase of purchases) {
    if (!purchase.basket.result.purchasedAt || seen.has(purchase.basketId)) continue;
    seen.add(purchase.basketId);
    for (const use of purchase.basket.result.pantryUsed ?? []) {
      if (!Number.isFinite(use.quantity) || use.quantity <= 0) continue;
      if (use.unit === 'g') grams += use.quantity;
      if (use.unit === 'ml') millilitres += use.quantity;
    }
  }
  return { grams, millilitres };
}

export function formatPreventedWaste({ grams, millilitres }: ReturnType<typeof wastePrevention>) {
  const format = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  const parts: string[] = [];
  if (grams > 0) parts.push(grams >= 1000 ? `${format(grams / 1000)} kg` : `${format(grams)} g`);
  if (millilitres > 0) parts.push(millilitres >= 1000 ? `${format(millilitres / 1000)} L` : `${format(millilitres)} ml`);
  return parts.join(' · ') || '0 g';
}

export function shoppingImpact(purchases: Purchase[], now = new Date()) {
  const completed = [...new Map(purchases.filter(p => p.basket.result.purchasedAt).map(p => [p.basketId, p])).values()];
  const prices = new Map<string, { unit: string; perUnit: number }>();
  for (const purchase of completed) for (const item of purchase.basket.result.items ?? []) {
    const quantity = item.purchasedQuantity ?? item.packageCount * item.packageAmount;
    if (item.product.currency !== 'EUR' || item.estimatedPrice === null || !Number.isFinite(item.estimatedPrice) || item.estimatedPrice < 0 || !Number.isFinite(quantity) || quantity <= 0) continue;
    prices.set(`${purchase.basketId}:${item.product.id}`, { unit: item.quantityUnit, perUnit: item.estimatedPrice / quantity });
  }
  let euros = 0, unpriced = 0;
  for (const purchase of completed) for (const use of purchase.basket.result.pantryUsed ?? []) {
    if (!Number.isFinite(use.quantity) || use.quantity <= 0) continue;
    const price = prices.get(use.lotId);
    if (price && price.unit === use.unit) euros += price.perUnit * use.quantity;
    else unpriced++;
  }
  let totalBudget = 0, budgetCosts = 0, budgetSkipped = 0;
  for (const purchase of completed) {
    const r = purchase.basket.result;
    if (!Number.isFinite(r.budgetTarget) || !r.budgetTarget || r.budgetTarget <= 0) continue;
    // Incomplete shopping costs must never be reported as budget savings.
    if (r.estimatedTotalPrice === null || !Number.isFinite(r.estimatedTotalPrice) || r.estimatedTotalPrice < 0 || ['price_incomplete','unknown'].includes(r.budgetStatus)) { budgetSkipped++; continue; }
    totalBudget += r.budgetTarget; budgetCosts += r.estimatedTotalPrice;
  }
  const dates = completed.map(p => new Date(p.purchasedAt)).filter(d => Number.isFinite(d.getTime()) && d <= now);
  const first = dates.sort((a, b) => a.getTime() - b.getTime())[0];
  const calendarDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = first ? Math.max(1, Math.round((calendarDay(now) - calendarDay(first)) / 86400000) + 1) : 0;
  let calorieDays = 0, proteinDays = 0, calorieMet = 0, proteinCoverage = 0;
  for (const purchase of completed) {
    const plan = purchase.basket.result.mealPlan;
    if (!plan || plan.status !== 'confirmed') continue;
    for (let day = 0; day < plan.planningDays; day++) {
      const nutrition = planNutrition({ ...plan, items: plan.items.filter(item => item.dayIndex === day) });
      for (const person of splitNutrition(plan, nutrition)) {
        if (person.calorieTarget && Number.isFinite(person.calorieTarget) && person.calorieTarget > 0) {
          calorieDays++;
          const ratio = person.calories / person.calorieTarget;
          if (ratio >= .9 - 1e-9 && ratio <= 1.1 + 1e-9) calorieMet++;
        }
        if (person.proteinTarget && Number.isFinite(person.proteinTarget) && person.proteinTarget > 0) {
          proteinDays++;
          proteinCoverage += person.protein / person.proteinTarget;
        }
      }
    }
  }
  return { ...wastePrevention(completed), euros, unpriced, days, shops: completed.length,
    savedBudgetPercent: totalBudget > 0 ? Math.round((totalBudget-budgetCosts)/totalBudget*100) : null, budgetSkipped,
    calorieTargetsMet: calorieDays ? Math.round(100 * calorieMet / calorieDays) : null,
    proteinTargetsMet: proteinDays ? Math.round(100 * proteinCoverage / proteinDays) : null };
}
