# Kalender-Flow · Übergabe an Codex

Stand: 6. Oktober 2026 · Plan: [docs/KALENDER-FLOW-PLAN.md](KALENDER-FLOW-PLAN.md)

**Phase 0, 1 und 2 sind fertig und grün** (`npm run typecheck`, `npm run lint`, `npm test` — 141 Tests). Dieses Dokument beschreibt, was danach dran ist, in welcher Reihenfolge, und was man dabei wissen muss, um nicht in dieselben Fallen zu laufen.

Branch: `claude/kalender-flow-phase0-2`, drei Commits über `main` (789193c). Nichts davon ist gepusht.

## Pflichtregeln für jede weitere Phase

1. **Nach jeder Phase anhalten** und `npm run typecheck`, `npm run lint`, `npm test` laufen lassen. Alle drei müssen grün sein, bevor es weitergeht.
2. **Alte gespeicherte Pläne müssen lesbar bleiben.** Version-1-Pläne (`MealPlan`, `dayIndex`, `planningDays`) werden weder konvertiert noch umgeschrieben. Jedes neue Feld ist optional, und kein vorhandener Pflichtwert wird entfernt.
3. **Kalorien und Protein bleiben unsichtbar.** Sie dürfen das Scoring beeinflussen, aber im neuen Flow nicht angezeigt werden (`plan` → „Kalorien und Protein laufen unsichtbar weiter").
4. Keine stillen Wiederholungen oder erfundenen Daten: Wenn etwas nicht geht (keine passenden Gerichte, fehlende Produkte), sagt die App es ehrlich und bietet einen Ausweg.

## Was Phase 0–2 geliefert hat

### Phase 0 — Onboarding mit Personen (Commit `681ff1f`)

| Datei | Inhalt |
| --- | --- |
| `components/HouseholdFields.tsx` | Personenliste: ein Tipp = Erwachsener/Kind, optional Alter, Geschlecht, Aktivität, editierbare Kalorienempfehlung |
| `services/profile-domain.ts` | `estimateCalories` (Mifflin-St-Jeor × Aktivitätsfaktor, auf 50 kcal gerundet, geklemmt auf 1.000–5.000), `estimateProtein`, `newParticipant`, `patchParticipant`, `participantKind`, `activityFactors` |
| `services/preference-domain.ts` | `householdValues`, `validParticipantList`, `validSlotDefaults`, `slotLabels`, `activeSlotLabels` |
| `types/preferences.ts` | `SlotDefaults`, `defaultSlotDefaults`, `slotDefaultsOf`, `activeSlots`, Schritt `meals`, `participants?` und `slotDefaults?` in `PreferenceValues` |
| `types/profile.ts` | `PlanParticipant.kind?`, `.activityLevel?`, `participantKinds`, `onboardingActivities` |
| `app/onboarding/[step].tsx` | Schritt `household` = Personenliste, neuer Schritt `meals` (Mahlzeiten-Standard), Schritt `goals` ohne Kalorieneingabe |

Wichtig: `patchParticipant` verschiebt die Empfehlung nur, solange der Wert noch der Empfehlung entspricht. Eine selbst eingetippte Zahl bleibt stehen. Dafür gibt es kein zusätzliches Flag im Datenmodell — der Vergleich mit `estimateCalories(person)` ist die Quelle der Wahrheit.

### Phase 1 — Datenmodell (Commit `6c986cc`)

`types/meal.ts`:

```ts
interface MealChoice { id, mealSlot, meal, servings, mealMode?, readyMealCategory?, readyMealMatch? }
export interface MealPlanItem extends MealChoice { dayIndex: number }   // Version 1, unverändert
export interface WeekPlanItem extends MealChoice { date: string }       // Version 2
export interface WeekPlanDay { date: string; slots: MealSlot[] }
export interface WeekPlan { version: '2'; weekStart; days; items: WeekPlanItem[]; householdSize;
  targetCalories; targetProtein; status; warnings; participants? }
export type AnyMealPlan = MealPlan | WeekPlan;
export type AnyMealPlanItem = MealPlanItem | WeekPlanItem;
export const mealSlots = ['breakfast','lunch','dinner','snack'] as const;
```

`services/meals/weekPlan.ts` (alles UTC, damit keine Zeitzone einen Tag verschiebt):
`parsePlanDate`, `planDate`, `isPlanDate`, `addDays`, `weekStartOf`, `isWeekStart`, `weekDates`, `inWeek`, `emptyWeekPlan`, `defaultDaySlots`, `sortSlots`, `plannedDates`, `dayOf`, `itemsOn`, `openSlots`, `isWeekPlanShape`, `itemDate`, `itemDayIndex`, `plannedDayCount`.

`MealPlanItem.dayIndex` ist **bewusst Pflichtfeld geblieben**. Dadurch musste kein Version-1-Konsument angepasst werden. Wer beide Formen lesen muss, nimmt `AnyMealPlan` plus die Accessoren.

### Phase 2 — Migration (Commit `2b4322f`)

`supabase/migrations/20261006090000_calendar_week_plans.sql`:

- `user_preferences.slot_defaults jsonb`, `user_preferences.participants jsonb` (beide nullable; `valid_slot_defaults(jsonb)` als Helper-Funktion, weil CHECK keine Subqueries erlaubt; `participants`-Länge muss `household_size` entsprechen)
- `meal_plans.plan_version text not null default '1'`, `meal_plans.week_start date`, `planning_days` nullable. Version 1: Periode gesetzt, `week_start` null. Version 2: `week_start` ist ein Montag (`extract(isodow)=1`), `planning_days` null.
- `meal_plan_items.plan_date date`, `day_index` nullable, genau **eines** von beiden pro Zeile; neues `unique(meal_plan_id, plan_date, meal_slot)`.
- Insert-Policy prüft Datum gegen die Woche des Plans bzw. Tagesnummer gegen die Periode.
- `baskets.planning_days` jetzt `between 1 and 14` (vorher nur 3, 5, 7, 14) — eine Kalenderwoche kann 2 oder 4 Tage umfassen.
- `save_generated_basket` schreibt beide Formen; die `planningDays`-Prüfung gegen die Preferences gilt nur noch für Version 1.
- `services/preferences-repository.ts` trägt `slot_defaults`/`participants` in beide Richtungen.

## Als nächstes: Phase 3 — Vorschläge statt Komplettplan

Datei: `services/meals/planner.ts` (neue Funktion, `generateMealPlan` bleibt bestehen).

```ts
export function suggestMeals(plan: WeekPlan, date: string, slot: MealSlot,
  preferences: UserPreferences, catalog: Product[] = [], exclude: string[] = []): Meal[]
```

- Liefert **genau zwei** Gerichte mit unterschiedlicher `meal.id`, oder weniger, wenn der Katalog nichts mehr hergibt (dann ehrlich leer/eines zurückgeben — der Screen bietet Überspringen, Aufwärmen, Auswärts an).
- Bewertung aus `generateMealPlan` wiederverwenden: Wiederholung, gleiche Mahlzeit am selben Tag, Zutaten-Wiederverwendung (`used`), Verfügbarkeit (`ingredientCosts`), Budget. Die Gewichte stehen in `services/meals/config.ts` (`mealWeights`).
- `compatibleMeal(meal, preferences)` ist die Kompatibilitätsprüfung — Allergene und Diäten dürfen **nie** verletzt werden.
- `exclude` sind bereits gezeigte `meal.id`s („Zwei andere zeigen").
- Die Abendessen-Logik „Rest des Tages" nur anwenden, wenn die anderen Slots des Tages schon gewählt sind (`openSlots(plan, date)` zeigt, was offen ist).
- `fitsSlot` in `planner.ts` beachten: `lunch` und `dinner` sind austauschbar, `breakfast` und `snack` nicht.

Neuer Test `tests/meal-suggestions.test.cjs`: genau zwei verschiedene kompatible Gerichte; `exclude` greift; Allergene/Diäten werden nie verletzt; bei zu kleinem Katalog kommt weniger zurück statt einer Wiederholung. Fixtures: `tests/basket-fixtures.cjs` (`prefs`, `product`, `catalog`), `tests/meal-fixtures.cjs` (`fullCatalog`).

## Phase 4 — Validierung und Korb

Dateien: `services/meals/validation.ts`, `services/meals/basket.ts`, `services/meals/aggregation.ts`, `services/meals/portions.ts`, `services/basket/edit.ts`, `services/waste-prevention.ts`.

- `isWeekPlan(v): v is WeekPlan` neben `isMealPlan`: `weekStart` ist ein Montag, jedes `days[].date` liegt in der Woche (`inWeek`), jedes Item-Datum ist ein geplanter Tag, der Slot gehört zu den gewählten Slots dieses Tages, keine Dubletten pro Datum + Slot, `items.length <= days.length * 4`. Die restliche Item-Prüfung (Modi, Zutaten, Toleranzen) ist in `isMealPlan` schon vorhanden und sollte geteilt, nicht kopiert werden.
- Status `partial` nur noch bei fehlenden Produkten oder offenen **gewählten** Slots, nicht bei bewusst leeren Tagen oder abgewählten Slots.
- Ernährungsabdeckung nur über geplante Tage (`plannedDayCount`), nicht geplante Tage sind keine Lücke.
- `planNutrition` und `participantPortions` müssen beide Plantypen verstehen. `portions.ts` rechnet heute mit `plan.targetCalories / plan.planningDays / plan.householdSize` — für Version 2 über `plannedDayCount(plan)` gehen.
- `components/ParticipantNutrition.tsx` zeigt `plan.planningDays` an; auf `plannedDayCount` umstellen.
- `services/meals/choices.ts` ist auf `MealPlanItem` bzw. `MealPlan` typisiert (`isCook`, `readyCategories`, `replaceMealChoice`). Für Version 2 auf die gemeinsame Basis bzw. `AnyMealPlan` erweitern, statt eine zweite Kopie anzulegen.

## Phase 5 — Screens

`app/(tabs)/index.tsx` wird der Wochenkalender (Screen 6). Neu: `app/plan/week.tsx` (Screen 2), `app/plan/[date].tsx` (Screen 3), `app/plan/[date]/[slot].tsx` (Screen 4), `app/plan/day-done.tsx` (Screen 5). `app/basket-setup.tsx` auf `WeekPlan` umstellen.

Wischregeln auf Screen 4 (Teil des MVP): Karten einzeln; rechts = nehmen, Slot sofort fertig; **nur ein Gericht pro Mahlzeit**, das erste Ja gewinnt; links = nächste Karte; sind alle passenden Gerichte durch, ehrlich melden und Überspringen/Aufwärmen/Auswärts anbieten; Antippen bleibt gleichwertig.

Bestehendes wiederverwenden: `services/meals/choices.ts` (`replaceMealChoice`, `isCook`, `readyCategories`), `lib/meal-images.ts`, `components/MealPlanReview.tsx` als Vorbild für UI-Tests.

## Phase 3b und 6

- **3b Anwesenheit pro Mahlzeit**: `MealPlanItem`/`WeekPlanItem` bekommen `participantIds?` (fehlt = alle dabei, damit alte Pläne gültig bleiben). Drei Zustände pro Person und Mahlzeit: dabei, ganz weg, eigenes einfaches Gericht. Zustand 3 braucht keinen neuen Modus, nur ein paar einfache Gerichte in `data/meals.ts`.
- **6 Korb-Extras**: Suchfeld „Produkt hinzufügen" über `addBasketProduct` (`services/basket/add-product.ts`, legt Artikel mit `isExtra` und `ingredientKey: extra:<id>` an), „Immer dabei" im MVP als feste Liste.

## Wisch-Entscheidungen speichern

Eigene Tabelle `meal_choice_events` (nur Insert, Lesen nur eigene Zeilen, RLS wie `meal_plans`), Felder siehe Plan. Ab dem MVP schreiben, auch wenn noch nichts daraus lernt. Gehört zu Phase 5, weil die Ereignisse dort entstehen.

## Fallen, die in Phase 0–2 Zeit gekostet haben

1. **CHECK-Constraints erlauben keine Subqueries.** Für Prüfungen über JSONB eine `immutable`-Funktion anlegen — und ihr `execute` an `authenticated` **und** `service_role` geben: Der Constraint läuft als der Rolle, die schreibt, nicht als Owner. Sonst „permission denied for function".
2. **RLS schlägt vor CHECK-Constraints zu.** Eine Zeile, die beides verletzt, kommt mit `42501` zurück, nicht mit `23514`. Tests, die eine bestimmte Fehlerklasse erwarten, müssen das berücksichtigen.
3. **pglite liefert Treibertypen, nicht JSON.** `numeric` kommt als String (`"70.00"`), `timestamptz` als `Date`. `fromRow` validiert so eine Rohzeile zu Recht nicht. Im Test über einen kleinen Normalisierer gehen (siehe `asJsonRow` in `tests/week-plan-database.test.cjs`).
4. **`lib/supabase` zieht React Native herein** und lässt sich in Node nicht laden. In Tests, die ein Modul mit diesem Import brauchen, `Module._load` patchen (Beispiele: `tests/week-plan-database.test.cjs`, `tests/onboarding-ui.test.cjs`).
5. **`services/preference-domain.ts` und `services/profile-domain.ts` importieren sich gegenseitig.** Das ist in Ordnung, solange die Aufrufe in Funktionskörpern stehen (TypeScript exportiert Funktionsdeklarationen vor der Modulauswertung). Keine Top-Level-Auswertung über die Zyklusgrenze hinweg einbauen.
6. **UI-Tests** rendern Komponenten mit `react-test-renderer` und gestubbten `./ui`-Komponenten. `PreferenceRow` hat `onEdit`, nicht `onPress`. Stub-Komponenten brauchen einen `displayName`, sonst scheitert `npm run lint` an `react/display-name`.
7. **`PreferenceStore` verwirft seinen Cache**, wenn `isDraft` fehlschlägt oder ein Schrittname unbekannt ist (`localError` = „Stored preferences could not be read"). Deshalb: niemals einen Schrittnamen entfernen, und neue Draft-Felder immer optional halten.

## Offene Entscheidungen (vor Phase 3 bzw. 5 zu klären, blockieren den Code-Start nicht)

- **`planningDays`**: steckt noch in `PreferenceValues` (Default 7) und wird von `nutritionTargets`, `preferenceChips`, dem Budget-Text und `app/plan-setup.tsx` benutzt. Entfernen gehört in Phase 4/5, wenn der Kalender die Tage liefert. In der DB ist es für Version-2-Pläne schon `null`.
- **Katalogtiefe**: rund 30 Gerichte, davon 10 Frühstücke. Mit Diätfiltern und „Zwei andere zeigen" gehen die Vorschläge schnell aus. Im Plan zurückgestellt; die größere Idee sind abwandelbare Gerichte statt fester Katalog.
- **Budget**: Kriterium für die Vorschläge oder nur Anzeige im Korb?
- **Mahlzeiten-Standard**: gilt für den ganzen Haushalt oder pro Person? Aktuell haushaltsweit (`user_preferences.slot_defaults`).
- **Branch-Name**: `claude/kalender-flow-phase0-2` trägt Phase 0 bis 2. Ob Phase 3+ dort weiterläuft oder einen eigenen Branch bekommt, ist noch offen.
