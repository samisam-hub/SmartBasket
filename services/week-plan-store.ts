import type { MealMode, MealSlot, ReadyMealCategory, WeekPlan } from '../types/meal';
import type { UserPreferences } from '../types/preferences';
import type { MealSuggestion } from './meals/planner';
import { isWeekPlan } from './meals/validation';
import {
  chooseMeal, chooseMode, clearChoice, confirmWeek, moveWeek, setPresence, skipSlot, startWeek, toggleDay, toggleSlot,
} from './meals/weekPlanDraft';
import type { LocalStorage } from './preference-store';

export interface WeekPlanState {
  plan: WeekPlan | null;
  ready: boolean;
  /** Set when the stored week could not be read or written; it is never overwritten silently. */
  error: string | null;
}
/** Holds the week the household is filling in. One owner, one device: the draft is local until a
 *  basket is created from it, so a half-planned week survives leaving the app. */
export class WeekPlanStore {
  private state: WeekPlanState = { plan: null, ready: false, error: null };
  private listeners = new Set<() => void>();
  private writes: Promise<void> = Promise.resolve();
  private initialization: Promise<void> | null = null;
  private readable = true;
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
        const stored = JSON.parse(raw) as { version: number; plan: unknown };
        // A null plan is the stored "no week yet" state, written after a reset.
        if (stored.version !== 1 || (stored.plan !== null && !isWeekPlan(stored.plan))) throw Error('Invalid stored week');
        this.publish({ plan: stored.plan });
      }
    } catch {
      this.readable = false;
      this.publish({ error: 'The planned week could not be read. It has not been overwritten; restart the app to retry.' });
    }
    this.publish({ ready: true });
  }
  private persist(plan: WeekPlan | null) {
    if (!this.readable) return;
    const json = JSON.stringify({ version: 1, plan });
    this.writes = this.writes.catch(() => {}).then(() => this.storage.setItem(this.key, json));
    void this.writes.then(() => this.publish({ error: null }))
      .catch(() => this.publish({ error: 'The planned week could not be saved on this device. Free some storage and retry.' }));
  }
  /** Every change keeps the plan valid and writes it through, so nothing is lost on the way. */
  private apply(next: WeekPlan | null) {
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
    this.apply(this.state.plan ? moveWeek(this.state.plan, weekStart, preferences) : startWeek(weekStart, preferences));
  toggleDay = (date: string, preferences: UserPreferences) =>
    this.apply(toggleDay(this.require(), date, preferences));
  toggleSlot = (date: string, slot: MealSlot, preferences: UserPreferences) =>
    this.apply(toggleSlot(this.require(), date, slot, preferences));
  choose = (date: string, slot: MealSlot, suggestion: MealSuggestion, preferences: UserPreferences,
    participantIds?: string[]) =>
    this.apply(chooseMeal(this.require(), date, slot, suggestion, preferences, participantIds));
  chooseMode = (date: string, slot: MealSlot, mode: Exclude<MealMode, 'cook'>,
    category: ReadyMealCategory | undefined, preferences: UserPreferences, participantIds?: string[]) =>
    this.apply(chooseMode(this.require(), date, slot, mode, category, preferences, participantIds));
  setPresence = (itemId: string, participantIds: string[], preferences: UserPreferences) =>
    this.apply(setPresence(this.require(), itemId, participantIds, preferences));
  clear = (itemId: string, preferences: UserPreferences) =>
    this.apply(clearChoice(this.require(), itemId, preferences));
  skip = (date: string, slot: MealSlot, preferences: UserPreferences) =>
    this.apply(skipSlot(this.require(), date, slot, preferences));
  replace = (plan: WeekPlan) => this.apply(plan);
  /** Hands over a confirmed copy for the basket; the draft itself stays open for further changes. */
  confirm = (preferences: UserPreferences) => confirmWeek(this.require(), preferences);
  /** After a basket was created from the week, or when the household wants to start over. */
  reset = () => this.apply(null);
  flush = async () => { await this.writes; };
}
