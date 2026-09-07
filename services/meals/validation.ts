import type { MealPlan } from '../../types/meal';
import { ingredients } from '../../data/meals';
import {isParticipant} from '../profile-domain';
export function isMealPlan(v: unknown): v is MealPlan {
  if(!v||typeof v!=='object')return false;const p=v as MealPlan;
  return (p.participants===undefined||(Array.isArray(p.participants)&&p.participants.length===p.householdSize&&p.participants.every(isParticipant)))&&p.version==='1'&&['review','confirmed'].includes(p.status)&&[3,5,7,14].includes(p.planningDays)&&Number.isInteger(p.householdSize)&&p.householdSize>=1&&p.householdSize<=10&&
    [p.targetCalories,p.targetProtein].every(n=>Number.isFinite(n)&&n>0)&&Array.isArray(p.warnings)&&p.warnings.every(w=>w&&typeof w.code==='string'&&typeof w.message==='string')&&
    Array.isArray(p.items)&&p.items.length<=p.planningDays*3&&new Set(p.items.map(i=>i?.id)).size===p.items.length&&
    new Set(p.items.map(i=>`${i?.dayIndex}-${i?.mealSlot}`)).size===p.items.length&&p.items.every(i=>i&&typeof i.id==='string'&&Number.isInteger(i.dayIndex)&&i.dayIndex>=0&&i.dayIndex<p.planningDays&&
      ['breakfast','lunch','dinner'].includes(i.mealSlot)&&Number.isFinite(i.servings)&&i.servings>0&&i.servings<=15&&i.meal&&typeof i.meal.id==='string'&&typeof i.meal.name==='string'&&i.meal.servings===1&&
      Array.isArray(i.meal.dietaryTags)&&Array.isArray(i.meal.allergens)&&Array.isArray(i.meal.ingredients)&&i.meal.ingredients.length>0&&i.meal.ingredients.length<=12&&i.meal.ingredients.every(l=>l&&ingredients[l.ingredientKey]&&
        typeof l.ingredientName==='string'&&l.unit===ingredients[l.ingredientKey].unit&&Number.isFinite(l.quantity)&&l.quantity>0&&l.quantity<=2000&&typeof l.flexible==='boolean'&&
        Number.isFinite(l.minAdjustmentPercent)&&l.minAdjustmentPercent>=-20&&l.minAdjustmentPercent<=0&&Number.isFinite(l.maxAdjustmentPercent)&&l.maxAdjustmentPercent>=0&&l.maxAdjustmentPercent<=20));
}
