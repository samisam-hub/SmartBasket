import type { MealSlot, WeekPlan } from '../../types/meal';
import { mealSlots } from '../../types/meal';
import { parsePlanDate } from './weekPlan';

/** Monday is 0. Rules are local defaults for future choices, never a rewrite of saved meals. */
export interface AttendanceRule { personId: string; weekday: number; slot: MealSlot }
export function validAttendanceRules(value: unknown): value is AttendanceRule[] {
  if (!Array.isArray(value)) return false;
  const rules = value as AttendanceRule[];
  return rules.every(rule => rule && typeof rule.personId === 'string' && !!rule.personId &&
    Number.isInteger(rule.weekday) && rule.weekday >= 0 && rule.weekday <= 6 && mealSlots.includes(rule.slot)) &&
    new Set(rules.map(rule => `${rule.personId}:${rule.weekday}:${rule.slot}`)).size === rules.length;
}
export function attendingPeople(plan: WeekPlan, date: string, slot: MealSlot, rules: AttendanceRule[]): string[] {
  const parsed = parsePlanDate(date);
  if (!parsed) throw Error('Invalid plan date');
  const weekday = (parsed.getUTCDay() + 6) % 7;
  return (plan.participants ?? []).map(person => person.id).filter(personId =>
    !rules.some(rule => rule.personId === personId && rule.weekday === weekday && rule.slot === slot));
}
