import type { Product } from '../../types/product';
import type { UserPreferences } from '../../types/preferences';
import type { BasketGenerationResult, BasketGroup, BasketItem, BasketWarning } from '../../types/basket';
import { isDraft, validatePreferences } from '../preference-domain';
import { exclusionReason } from './constraints';
import { nutritionTargets } from './nutritionTargets';
import { packagePrice, planPackage } from './quantityPlanner';
import { coverageAmount, groupOf, groups, limits, requiredGroups, scoreProduct, weights } from './scoring';

const round = (n: number) => Math.round(n * 100) / 100;
const compareId = (a: Product, b: Product) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
type Candidate = { product: Product; pack: NonNullable<ReturnType<typeof planPackage>>; group: BasketGroup; price: number | null; calories: number; protein: number; quality: number };
/** Pure, bounded and deterministic. Same preferences + catalog produce identical results. */
export function generateBasket(input: UserPreferences, products: readonly Product[], objectiveWeights: Record<keyof typeof weights, number> = weights): BasketGenerationResult {
  const warnings: BasketWarning[] = [], exclusions: Record<string, number> = {};
  const exclude = (code: string) => { exclusions[code] = (exclusions[code] ?? 0) + 1; };
  const invalid = !isDraft(input) || input.onboardingCompleted !== true || Object.keys(validatePreferences(input)).length > 0;
  const targets = invalid ? { calorieTarget: 0, proteinTarget: 0, dailyProteinTarget: 0, proteinRule: 'Invalid input', budgetTarget: null } : nutritionTargets(input);
  const base: BasketGenerationResult = { engineVersion: '1', optimizationWeights: { ...objectiveWeights }, status: invalid ? 'invalid' : 'empty', items: [],
    totalCalories: 0, totalProtein: 0, totalCarbohydrates: 0, totalFat: 0, totalFiber: null,
    estimatedTotalPrice: null, knownPriceSubtotal: 0, ...targets, budgetDifference: null,
    budgetStatus: !invalid && input.budgetEnabled ? 'unknown' : 'disabled', calorieCoveragePercent: 0, proteinCoveragePercent: 0,
    categoryCoverage: [], warnings, constraintsApplied: [], exclusions, score: 0, objective: 0, iterations: 0 };
  if (invalid) { warnings.push({ code: 'invalid_preferences', message: 'Complete valid saved preferences before generating a basket.' }); return base; }
  base.constraintsApplied = ['complete_calories_and_macros', 'whole_packages', 'no_mass_volume_conversion',
    ...input.dietaryPreferences.filter(d => d !== 'none').map(d => `positive_diet_evidence:${d}`),
    ...input.allergens.map(a => `contains_traces_and_unknown_excluded:${a}`)];
  const personDays = input.householdSize * input.planningDays;
  const byId = new Map<string, Product[]>();
  for (const p of products) { if (!p || typeof p !== 'object') { exclude('malformed_product'); continue; } byId.set(p.id, [...(byId.get(p.id) ?? []), p]); }
  const eligible: Candidate[] = [];
  for (const duplicates of byId.values()) {
    const p = duplicates[0];
    if (duplicates.some(other => JSON.stringify(other) !== JSON.stringify(p))) { exclude('conflicting_duplicate'); continue; }
    if (duplicates.length > 1) exclusions.duplicate = (exclusions.duplicate ?? 0) + duplicates.length - 1;
    const reason = exclusionReason(p, input);
    if (reason) { exclude(reason); continue; }
    const pack = planPackage(p);
    if (!pack) { exclude('package_basis_mismatch_or_invalid'); continue; }
    const calories = p.caloriesPer100g! * pack.amount / 100;
    if (calories > targets.calorieTarget * limits.maxCalorieShare) { exclude('package_too_large_for_period'); continue; }
    eligible.push({ product: p, pack, group: groupOf(p), price: packagePrice(p), calories,
      protein: p.proteinPer100g! * pack.amount / 100, quality: scoreProduct(p, input).score });
  }
  // Bound optimization work without allowing catalog order to determine the result.
  const priced = eligible.filter(c => c.price !== null);
  const pool = input.budgetEnabled && requiredGroups.every(g => priced.some(c => c.group === g)) ? priced : eligible;
  if (pool !== eligible && priced.length < eligible.length) {
    warnings.push({ code: 'unpriced_candidates_excluded', message: 'Unpriced products were left out because priced options cover the core categories. All prices remain estimates.' });
    base.constraintsApplied.push('prefer_complete_estimated_prices');
  }
  const candidates = groups.flatMap(group => pool.filter(c => c.group === group)
    .sort((a, b) => b.quality - a.quality || compareId(a.product, b.product)).slice(0, limits.candidatesPerGroup))
    .sort((a, b) => compareId(a.product, b.product));
  const available = new Set(candidates.map(c => c.group));
  const diversityTarget = Math.min(candidates.length, input.planningDays >= 7 ? 6 : 4);
  const quantities = new Array<number>(candidates.length).fill(0);
  function totals(q: number[]) {
    let calories = 0, protein = 0, cost = 0, unknown = 0, count = 0, quality = 0, duplication = 0, extrasCalories = 0;
    const amounts = Object.fromEntries(groups.map(g => [g, 0])) as Record<BasketGroup, number>;
    q.forEach((n, i) => {
      if (!n) return;
      const c = candidates[i]; calories += n * c.calories; protein += n * c.protein;
      cost += n * (c.price ?? 0); unknown += c.price === null ? 1 : 0; count++; quality += c.quality;
      amounts[c.group] += n * c.pack.amount;
      duplication += Math.max(0, n * c.calories / targets.calorieTarget - 0.2) ** 2;
      if (c.group === 'extras') extrasCalories += n * c.calories;
    });
    const categoryLoss = requiredGroups.filter(g => available.has(g)).reduce((sum, g) => sum + Math.max(0, 1 - amounts[g] / coverageAmount(g, personDays)) ** 2, 0);
    const overBudget = targets.budgetTarget === null ? 0 : Math.max(0, cost / targets.budgetTarget - 1);
    const objective = objectiveWeights.calories * (1 - calories / targets.calorieTarget) ** 2 +
      objectiveWeights.protein * (1 - protein / targets.proteinTarget) ** 2 +
      objectiveWeights.budget * Math.log1p(overBudget) ** 2 + objectiveWeights.category * categoryLoss +
      objectiveWeights.diversity * (diversityTarget ? Math.max(0, 1 - count / diversityTarget) ** 2 : 0) +
      objectiveWeights.repetition * duplication + objectiveWeights.extras * Math.max(0, extrasCalories / targets.calorieTarget - limits.maxExtrasShare) ** 2 +
      objectiveWeights.quality * (count ? 1 - quality / count / 100 : 1) + (targets.budgetTarget === null ? 0 : objectiveWeights.unknownPrices * unknown);
    return { calories, protein, cost, unknown, count, amounts, objective };
  }
  const canAdd = (q: number[], i: number) => {
    const c = candidates[i];
    const groupShareLimit = c.group === 'extras' ? limits.maxExtrasShare : c.group === 'breakfast' ? limits.maxBreakfastShare : 1;
    const groupCalories = q.reduce((sum, n, j) => sum + (candidates[j].group === c.group ? n * candidates[j].calories : 0), 0);
    return (q[i] > 0 || q.filter(n => n > 0).length < limits.maxItems) && q[i] < Math.max(2, Math.ceil(personDays / 2)) &&
      groupCalories + c.calories <= Math.max(c.calories, targets.calorieTarget * groupShareLimit) &&
      (q[i] + 1) * c.calories <= targets.calorieTarget * limits.maxCalorieShare;
  };
  let current = totals(quantities);
  let iterations = 0;
  for (; iterations < limits.iterations; iterations++) {
    let best = -1, loss = Infinity;
    candidates.forEach((c, i) => {
      if (!canAdd(quantities, i)) return;
      quantities[i]++; const next = totals(quantities).objective; quantities[i]--;
      if (next < loss - 1e-10) { loss = next; best = i; }
    });
    // Keep a nonempty best effort for a tiny budget rather than claiming no food exists.
    if (best < 0 || (current.count > 0 && loss >= current.objective - 1e-8)) break;
    quantities[best]++; current = totals(quantities);
  }
  // Bounded one-package removals / swaps escape simple greedy overshoot.
  for (let pass = 0; pass < limits.refinementPasses; pass++) {
    let change: [number, number] | null = null, best = current.objective;
    for (let i = 0; i < candidates.length; i++) {
      if (!quantities[i]) continue;
      quantities[i]--;
      const removed = totals(quantities);
      if (removed.count && removed.objective < best - 1e-8) { change = [i, -1]; best = removed.objective; }
      for (let j = 0; j < candidates.length; j++) {
        if (i === j || !canAdd(quantities, j)) continue;
        quantities[j]++; const loss = totals(quantities).objective; quantities[j]--;
        if (loss < best - 1e-8) { change = [i, j]; best = loss; }
      }
      quantities[i]++;
    }
    if (!change) break;
    quantities[change[0]]--; if (change[1] >= 0) quantities[change[1]]++;
    current = totals(quantities);
  }
  const items: BasketItem[] = candidates.flatMap((c, i) => {
    const n = quantities[i]; if (!n) return [];
    const amount = n * c.pack.amount, factor = amount / 100;
    const reasons = [{ code: 'category_coverage', detail: `Adds ${c.group} variety` },
      ...input.dietaryPreferences.filter(d => d !== 'none').map(d => ({ code: `diet:${d}`, detail: `Matches ${d.replace(/_/g, '-')} preference` }))];
    if (c.product.proteinPer100g! * 4 >= c.product.caloriesPer100g! * 0.2) reasons.push({ code: 'high_protein', detail: 'At least 20% of listed energy from protein' });
    if (c.price !== null && c.calories / c.price >= 500) reasons.push({ code: 'price_efficiency', detail: 'At least 500 kcal per estimated euro' });
    if (c.pack.assumed) reasons.push({ code: 'assumed_package', detail: `Assumed ${c.pack.amount} ${c.pack.unit} package; verify the actual size` });
    return [{ product: c.product, group: c.group, packageCount: n, packageAmount: c.pack.amount, quantityUnit: c.pack.unit,
      quantityAssumed: c.pack.assumed, totalWeight: c.pack.unit === 'g' ? round(amount) : null, totalVolume: c.pack.unit === 'ml' ? round(amount) : null,
      totalCalories: round(factor * c.product.caloriesPer100g!), totalProtein: round(factor * c.product.proteinPer100g!),
      totalCarbohydrates: round(factor * c.product.carbohydratesPer100g!), totalFat: round(factor * c.product.fatPer100g!),
      totalFiber: typeof c.product.fiberPer100g === 'number' && Number.isFinite(c.product.fiberPer100g) && c.product.fiberPer100g >= 0 ? round(factor * c.product.fiberPer100g) : null,
      estimatedPrice: c.price === null ? null : round(n * c.price), reasonSelected: reasons }];
  });
  const sum = (field: 'totalCalories' | 'totalProtein' | 'totalCarbohydrates' | 'totalFat') => round(items.reduce((s, i) => s + i[field], 0));
  const categoryCoverage = groups.map(group => ({ group, required: requiredGroups.includes(group), available: available.has(group),
    represented: items.some(i => i.group === group), amount: round(current.amounts[group]), targetAmount: coverageAmount(group, personDays) }));
  const nutritionMet = current.calories >= targets.calorieTarget * 0.9 && current.calories <= targets.calorieTarget * 1.1 &&
    current.protein >= targets.proteinTarget * 0.9 && current.protein <= targets.proteinTarget * 1.3;
  const coverageMet = categoryCoverage.filter(c => c.required).every(c => c.represented && c.amount >= c.targetAmount * 0.75);
  const knownPriceSubtotal = round(items.reduce((s, i) => s + (i.estimatedPrice ?? 0), 0));
  const price = items.length && !current.unknown ? knownPriceSubtotal : null;
  const budgetDifference = price !== null && targets.budgetTarget !== null ? round(price - targets.budgetTarget) : null;
  const budgetStatus: BasketGenerationResult['budgetStatus'] = !input.budgetEnabled ? 'disabled' : price === null ? 'unknown' :
    !nutritionMet || !coverageMet || price > targets.budgetTarget! * 1.1 ? 'unachievable' : price > targets.budgetTarget! ? 'slightly_over' : 'within_budget';
  if (!items.length) warnings.push({ code: 'no_eligible_products', message: 'No products meet the available nutrition, package and safety constraints. No unsafe alternatives were selected.' });
  if (current.unknown) warnings.push({ code: 'missing_prices', message: `Prices are missing for ${current.unknown} selected products. The total and budget fit cannot be verified.` });
  if (items.some(i => i.quantityAssumed)) warnings.push({ code: 'assumed_packages', message: 'Some package sizes are assumptions. Quantities and nutrition depend on those assumptions.', productIds: items.filter(i => i.quantityAssumed).map(i => i.product.id) });
  if (!nutritionMet && items.length) warnings.push({ code: 'nutrition_conflict', message: 'This best-effort basket is outside the calorie or protein target tolerance.' });
  for (const c of categoryCoverage.filter(c => c.required && (!c.represented || c.amount < c.targetAmount * 0.75))) warnings.push({ code: `coverage:${c.group}`, message: c.available ? `Limited ${c.group} coverage in this basket.` : `No eligible ${c.group} products are available for these constraints.` });
  if (budgetStatus === 'unachievable' || budgetStatus === 'slightly_over') warnings.push({ code: 'budget_conflict', message: 'The heuristic could not meet all nutrition, variety and budget targets together. This is a best effort, not proof that no cheaper basket exists.' });
  if (exclusions.allergen_safety_unknown) warnings.push({ code: 'allergen_evidence', message: 'Products without explicit selected-allergen-free labels and ingredient information were excluded; empty allergen lists are not treated as safe.' });
  if (input.allergens.length) warnings.push({ code: 'verify_labels', message: 'Source labels can be incomplete or outdated. Check actual packaging; this is not an allergy-safety guarantee.' });
  if (iterations === limits.iterations) warnings.push({ code: 'search_limit', message: 'The bounded search reached its iteration limit.' });
  return { ...base, items, status: !items.length ? 'empty' : nutritionMet && coverageMet ? 'generated' : 'partial',
    totalCalories: sum('totalCalories'), totalProtein: sum('totalProtein'), totalCarbohydrates: sum('totalCarbohydrates'), totalFat: sum('totalFat'),
    totalFiber: items.length && items.every(i => i.totalFiber !== null) ? round(items.reduce((s, i) => s + i.totalFiber!, 0)) : null,
    estimatedTotalPrice: price, knownPriceSubtotal, budgetDifference, budgetStatus,
    calorieCoveragePercent: round(current.calories / targets.calorieTarget * 100), proteinCoveragePercent: round(current.protein / targets.proteinTarget * 100),
    categoryCoverage, score: items.length ? round(100 / (1 + current.objective)) : 0, objective: round(current.objective), iterations };
}
