import type { PreferenceValues } from '../../types/preferences';
export const proteinPercent = { balanced: 0.15, maintain: 0.20, high_protein: 0.25, lose_weight: 0.25, build_muscle: 0.275 } as const;
export function nutritionTargets(p: PreferenceValues & {participants?:import('../../types/profile').PlanParticipant[]}) {
  const dailyProteinTarget = p.participants?.length ? p.participants.reduce((s,x)=>s+x.proteinTarget!,0)/p.participants.length : p.proteinMode === 'manual' ? p.proteinTargetGrams! : p.dailyCalories * proteinPercent[p.primaryGoal] / 4;
  const scale = p.householdSize * p.planningDays;
  return { calorieTarget: p.participants?.length ? p.planningDays*p.participants.reduce((s,x)=>s+x.dailyCalories!,0):scale * p.dailyCalories, proteinTarget: scale * dailyProteinTarget, dailyProteinTarget,
    proteinRule: p.participants?.length?'Sum of individual participant targets; shared meals':p.proteinMode === 'manual' ? 'Saved manual grams per person per day' : `${Number((proteinPercent[p.primaryGoal] * 100).toFixed(1))}% of calories ÷ 4 kcal/g; per person per day`,
    // This existing field is explicitly a total for the selected period, not a weekly rate.
    budgetTarget: p.budgetEnabled ? p.weeklyBudgetEur : null };
}
