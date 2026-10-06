import type { MealMode, MealSlot, ReadyMealCategory, WeekPlan } from '../types/meal';
import type { UserPreferences } from '../types/preferences';
import type { MealSuggestion } from './meals/planner';
import { isWeekPlan } from './meals/validation';
import {
  chooseMeal, chooseMode, clearChoice, confirmWeek, copyPreviousWeek, setPresence, skipSlot, startWeek, toggleDay, toggleSlot,
} from './meals/weekPlanDraft';
import { addDays } from './meals/weekPlan';
import { attendingPeople, validAttendanceRules, type AttendanceRule } from './meals/attendance';
import type { LocalStorage } from './preference-store';

export interface WeekPlanState {
  plan: WeekPlan | null;
  ready: boolean;
  /** Set when the stored week could not be read or written; it is never overwritten silently. */
  error: string | null;
  attendanceRules: AttendanceRule[];
}
/** Keeps drafts by week, scoped to one owner on one device: the draft is local until a
 *  basket is created from it, so a half-planned week survives leaving the app. */
export class WeekPlanStore {
  private state: WeekPlanState = { plan: null, ready: false, error: null, attendanceRules: [] };
  private listeners = new Set<() => void>();
  private writes: Promise<void> = Promise.resolve();
  private initialization: Promise<void> | null = null;
  private readable = true;
  private plans: Record<string, WeekPlan> = {};
  constructor(private storage: LocalStorage, private key: string) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(patch: Partial<WeekPlanState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  initialize = () => {
    this.initialization ??= this.load();
    return this.initialization;
  };
  private async load() {
    try {
      const raw = await this.storage.getItem(this.key);
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored.version === 1) {
          // Read the original single-week cache without changing its plan or discarding it.
          if (stored.plan !== null && !isWeekPlan(stored.plan)) throw Error('Invalid stored week');
          this.plans = stored.plan ? { [stored.plan.weekStart]: stored.plan } : {};
          this.publish({ plan: stored.plan });
        } else if (stored.version === 2) {
          if (!stored.plans || typeof stored.plans !== 'object' || Array.isArray(stored.plans) ||
              !Object.entries(stored.plans).every(([date, plan]) => isWeekPlan(plan) && plan.weekStart === date) ||
              (stored.attendanceRules !== undefined && !validAttendanceRules(stored.attendanceRules)) ||
              (stored.activeWeek !== null && (typeof stored.activeWeek !== 'string' || !Object.hasOwn(stored.plans, stored.activeWeek))))
            throw Error('Invalid stored weeks');
          this.plans = stored.plans;
          this.publish({ plan: stored.activeWeek === null ? null : this.plans[stored.activeWeek],
            attendanceRules: stored.attendanceRules ?? [] });
        } else throw Error('Unknown stored week format');
      }
    } catch {
      this.readable = false;
      this.publish({ error: 'The planned week could not be read. It has not been overwritten; restart the app to retry.' });
    }
    this.publish({ ready: true });
  }
  private persist(plan: WeekPlan | null) {
    if (!this.readable) return;
    const json = JSON.stringify({ version: 2, activeWeek: plan?.weekStart ?? null, plans: this.plans,
      attendanceRules: this.state.attendanceRules });
    this.writes = this.writes.catch(() => {}).then(() => this.storage.setItem(this.key, json));
    void this.writes.then(() => this.publish({ error: null }))
      .catch(() => this.publish({ error: 'The planned week could not be saved on this device. Free some storage and retry.' }));
  }
  /** Every change keeps the plan valid and writes it through, so nothing is lost on the way. */
  private apply(next: WeekPlan | null) {
    if (!this.state.ready || !this.readable) return this.state.plan;
    if (next) {
      if (!isWeekPlan(next)) throw Error('Invalid week plan');
      this.plans = { ...this.plans, [next.weekStart]: next };
    } else if (this.state.plan) {
      this.plans = { ...this.plans };
      delete this.plans[this.state.plan.weekStart];
    }
    this.publish({ plan: next });
    this.persist(next);
    return next;
  }
  private require(): WeekPlan {
    if (!this.state.plan) throw Error('Pick a week first.');
    return this.state.plan;
  }
  /** Opens the given week, keeping what is already planned in it. */
  open = (weekStart: string, preferences: UserPreferences) =>
    this.apply(this.plans[weekStart] ?? startWeek(weekStart, preferences));
  toggleAttendanceRule = (rule: AttendanceRule, preferences: UserPreferences) => {
    if (!this.state.ready || !this.readable) return;
    if (!validAttendanceRules([rule]) || !preferences.participants?.some(person => person.id === rule.personId))
      throw Error('Choose a person and a valid weekday and meal.');
    const key = (candidate: AttendanceRule) => candidate.personId === rule.personId &&
      candidate.weekday === rule.weekday && candidate.slot === rule.slot;
    const rules = this.state.attendanceRules.some(key)
      ? this.state.attendanceRules.filter(candidate => !key(candidate))
      : [...this.state.attendanceRules, rule];
    this.publish({ attendanceRules: rules });
    this.persist(this.state.plan);
  };
  canCopyPreviousWeek = (weekStart: string, preferences: UserPreferences) => {
    if (!this.state.ready || !this.readable || this.plans[weekStart]?.days.length) return false;
    const previous = this.plans[addDays(weekStart, -7)];
    if (!previous?.days.length) return false;
    try { copyPreviousWeek(previous, weekStart, preferences); return true; } catch { return false; }
  };
  copyPreviousWeek = (weekStart: string, preferences: UserPreferences) => {
    if (!this.state.ready || !this.readable) return this.state.plan;
    if (this.plans[weekStart]?.days.length) throw Error('This week already has a plan. Clear it before copying.');
    const previous = this.plans[addDays(weekStart, -7)];
    if (!previous) throw Error('There is no planned previous week to copy.');
    return this.apply(copyPreviousWeek(previous, weekStart, preferences));
  };
  toggleDay = (date: string, preferences: UserPreferences) => {
    const plan = this.require();
    if (plan.days.some(day => day.date === date) || !plan.participants?.length || !this.state.attendanceRules.length)
      return this.apply(toggleDay(plan, date, preferences));
    let next = toggleDay(plan, date, preferences);
    for (const slot of [...next.days.find(day => day.date === date)!.slots]) {
      if (!attendingPeople(next, date, slot, this.state.attendanceRules).length)
        next = skipSlot(next, date, slot, preferences);
    }
    if (!next.days.some(day => day.date === date)) throw Error('Nobody is at home for the selected meals on this day.');
    return this.apply(next);
  };
  toggleSlot = (date: string, slot: MealSlot, preferences: UserPreferences) =>
    this.apply(toggleSlot(this.require(), date, slot, preferences));
  choose = (date: string, slot: MealSlot, suggestion: MealSuggestion, preferences: UserPreferences,
    participantIds?: string[]) => {
    const plan = this.require();
    let next = chooseMeal(plan, date, slot, suggestion, preferences, participantIds);
    if (!participantIds && plan.participants?.length && next !== plan) {
      const attending = attendingPeople(plan, date, slot, this.state.attendanceRules);
      if (!attending.length) throw Error('Nobody is at home for this meal. Change the routine or the day.');
      if (attending.length < plan.participants.length)
        next = setPresence(next, next.items[next.items.length - 1].id, attending, preferences);
    }
    return this.apply(next);
  };
  chooseMode = (date: string, slot: MealSlot, mode: Exclude<MealMode, 'cook'>,
    category: ReadyMealCategory | undefined, preferences: UserPreferences, participantIds?: string[]) =>
    {
      const plan = this.require();
      let next = chooseMode(plan, date, slot, mode, category, preferences, participantIds);
      if (!participantIds && plan.participants?.length && next !== plan) {
        const attending = attendingPeople(plan, date, slot, this.state.attendanceRules);
        if (!attending.length) throw Error('Nobody is at home for this meal. Change the routine or the day.');
        if (attending.length < plan.participants.length)
          next = setPresence(next, next.items[next.items.length - 1].id, attending, preferences);
      }
      return this.apply(next);
    };
  setPresence = (itemId: string, participantIds: string[], preferences: UserPreferences) =>
    this.apply(setPresence(this.require(), itemId, participantIds, preferences));
  clear = (itemId: string, preferences: UserPreferences) =>
    this.apply(clearChoice(this.require(), itemId, preferences));
  skip = (date: string, slot: MealSlot, preferences: UserPreferences) =>
    this.apply(skipSlot(this.require(), date, slot, preferences));
  replace = (plan: WeekPlan) => this.apply(plan);
  /** Hands over a confirmed copy for the basket; the draft itself stays open for further changes. */
  confirm = (preferences: UserPreferences) => confirmWeek(this.require(), preferences);
  /** Clears only the active week; the other weeks remain available. */
  reset = () => this.apply(null);
  flush = async () => { await this.writes; };
}
