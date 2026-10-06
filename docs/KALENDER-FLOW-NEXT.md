# Kalender-Flow · Übergabe an Codex

Stand: 6. Oktober 2026 · Plan: [docs/KALENDER-FLOW-PLAN.md](KALENDER-FLOW-PLAN.md)

**Alle Phasen des Plans sind umgesetzt und grün** (`npm run typecheck`, `npm run lint`, `npm test` — 182 Tests). Offen sind nur noch die Punkte unter „Offene Entscheidungen" und die kuratierten Einfach-Gerichte, die Bild-Assets brauchen.

Branch: `claude/kalender-flow`, gepusht.

## Pflichtregeln für jede weitere Phase

1. **Nach jeder Phase anhalten** und `npm run typecheck`, `npm run lint`, `npm test` laufen lassen. Alle drei müssen grün sein, bevor es weitergeht.
2. **Alte gespeicherte Pläne müssen lesbar bleiben.** Version-1-Pläne (`MealPlan`, `dayIndex`, `planningDays`) werden weder konvertiert noch umgeschrieben. Jedes neue Feld ist optional, und kein vorhandener Pflichtwert wird entfernt.
3. **Kalorien und Protein bleiben unsichtbar.** Sie beeinflussen das Scoring, werden im Kalender-Flow aber nicht angezeigt.
4. Keine stillen Wiederholungen oder erfundenen Daten: Wenn etwas nicht geht (keine passenden Gerichte, fehlende Produkte, kein verifiziertes Fertiggericht), sagt die App es und bietet einen Ausweg.

## Was steht (Commits in Reihenfolge)

| Phase | Commit | Inhalt |
| --- | --- | --- |
| 0 | `681ff1f` | Onboarding: Haushalt als Personenliste, ein Tipp pro Person (Erwachsener/Kind), optional Alter/Geschlecht/Aktivität, Kalorienempfehlung per Mifflin-St-Jeor (`estimateCalories`, `patchParticipant`), neuer Schritt `meals` für den Mahlzeiten-Standard (`SlotDefaults`) |
| 1 | `6c986cc` | `WeekPlan`/`WeekPlanItem`/`WeekPlanDay` (Version `'2'`), `AnyMealPlan`, `services/meals/weekPlan.ts` mit UTC-Datumslogik |
| 2 | `2b4322f` | Migration `20261006090000_calendar_week_plans.sql`: `slot_defaults`/`participants` in `user_preferences`, `plan_version`/`week_start` in `meal_plans`, `plan_date` in `meal_plan_items`, `baskets.planning_days` 1–14, RPC für beide Formen |
| 3 | `f0bc95f` | `suggestMeals` (genau zwei Gerichte, `exclude`, geteiltes Scoring mit `generateMealPlan`) |
| 4 | `e64fe7f` | `isWeekPlan`, Korb für beide Formen, Abdeckung über `slotCalorieShare`, `planDays`/`itemDayLabel` für die UI |
| 5a | `b1c9e27` | `weekPlanDraft.ts` (toggleDay/toggleSlot/chooseMeal/clearChoice/skipSlot/confirmWeek), `WeekPlanStore`, `WeekPlanContext` |
| 5b | `dd73778` | Wochenkalender als Startansicht, `app/plan/week.tsx`, `app/plan/[date].tsx`, `app/plan/[date]/[slot].tsx` mit Wischgeste, `app/plan/day-done.tsx`, `basket-setup` nimmt den Wochenplan |
| 5c | `63ad545` | `chooseMode` (Aufwärmen/Auswärts für offene Slots), `meal_choice_events` + Recorder |
| 6 | `a03e651` | Korb-Extras: Produktsuche über den geladenen Katalog, feste „Immer dabei"-Liste |
| 3b · 1 | `1623826` | Anwesenheit pro Mahlzeit: `participantIds`, Menge nach Köpfen, Nährwerte nur unter den Anwesenden |
| 3b · 2 | `3380eab` | Mehrere Gerichte pro Slot für disjunkte Gruppen, Migration `20261006150000_meals_per_participant_group.sql` |

Wichtige Festlegungen, die über den Plan hinausgehen:

- **Abdeckung zählt nur geplante Mahlzeiten.** `slotCalorieShare` (`services/meals/config.ts`: Frühstück 0,25 · Mittag 0,32 · Abend 0,32 · Snack 0,08) sagt, welchen Anteil eines Tages ein Slot trägt. Die Ziele eines Wochenplans skalieren mit der Summe der gewählten Slots, und „Rest des Tages" beim Abendessen ist der Rest der *geplanten* Slots. Ein abgewähltes Frühstück wird nirgends nachgeholt. Ohne das war jeder Kalender-Korb `partial`.
- **`partial` nur bei echten Lücken**: ein gewählter, aber unentschiedener Slot (Warnung `open_slot_<datum>`). Ungeplante Tage und abgewählte Slots sind Antworten, keine Lücken.
- **`baskets.planning_days`** musste von (3,5,7,14) auf 1–14 gelockert werden, sonst ist eine Woche mit zwei geplanten Tagen nicht speicherbar.
- **`user_preferences.participants`** ist eine zusätzliche Spalte (im Plan nicht genannt): ohne sie überlebt die Personenliste keinen Cloud-Sync.
- Die Wischgeste nutzt `PanResponder`/`Animated` aus React Native — **keine neue Abhängigkeit**. `swipeAction(dx, dy, width)` ist die testbare Entscheidung; Tippen macht dasselbe.
- Der Home-Tab behält Sprachplanung, Pantry, Vorratsanzeige und Produkt-Tiles; nur der automatische Komplettplan ist durch den Kalender ersetzt.

## Phase 3b, Teil 1: Anwesenheit pro Mahlzeit (steht)

`MealChoice.participantIds?: string[]` — **fehlt das Feld, sind alle dabei**, und genau so bleiben alle gespeicherten Pläne gültig. `setPresence(plan, itemId, ids, preferences)` rechnet die Menge auf die Köpfe am Tisch um (dieselbe Basis, die `householdSize` immer hatte), speichert „alle dabei" wieder als *kein* Feld, und wenn niemand übrig bleibt, wird der Slot übersprungen statt eine leere Mahlzeit zu führen. Eine Person, die der Plan nicht kennt, wird abgewiesen; `isWeekPlan`/`isMealPlan` prüfen die Liste gegen die Teilnehmer des Plans. `portionsFor`/`splitNutrition` teilen eine Mahlzeit nur unter den Anwesenden, nach deren Kalorienanteil. UI: Chips pro Person unter jeder entschiedenen Mahlzeit auf `app/plan/[date].tsx`.

## Phase 3b, Teil 2: eigenes einfaches Gericht (steht)

Ein Slot kann mehrere Gerichte tragen, solange sie **verschiedene Personen** versorgen.

- `chooseMeal`/`chooseMode` nehmen optional eine Personengruppe. Wer sein eigenes Gericht nimmt, **verlässt dabei automatisch** das Familienessen dieses Slots (`release`), und dessen Menge schrumpft entsprechend; bleibt dort niemand übrig, verschwindet es.
- Die Gruppen eines Slots sind paarweise disjunkt, und ein Gericht ohne Gruppe (der ganze Haushalt) ist das einzige in seinem Slot. `isWeekPlan` prüft das über `disjointSlots`; ein Plan, der eine Person zweimal im selben Slot füttert, ist ungültig.
- `suggestMeals` nimmt optional die Gruppe: für eine benannte Gruppe blockiert das Familienessen nicht (sie verlassen es ja), nur ein Gericht, das **genau diese** Gruppe schon versorgt, hat nichts mehr zu wählen.
- `setPresence` arbeitet jetzt auf der **Item-id** statt auf (Datum, Slot) — ein Slot kann mehrere Gerichte haben. Jemanden an ein Gericht zu setzen, der im selben Slot schon etwas anderes isst, wird abgewiesen statt stillschweigend umgebucht. Eine leere Liste entfernt nur dieses Gericht; war es das letzte des Slots, wird der Slot übersprungen.
- Migration `20261006150000_meals_per_participant_group.sql`: `meal_plan_items` bekommt `item_key` und `participant_ids`, die Uniqueness wandert von `(plan, plan_date, meal_slot)` auf `(plan, plan_date, meal_slot, item_key)`, bestehende Kalenderzeilen werden aus dem Snapshot nachgefüllt. Version-1-Zeilen behalten ihr „ein Gericht pro Tagesnummer und Slot" und dürfen keine `participant_ids` tragen. Die RPC schreibt beides mit.
- UI: Auf dem Tagesscreen steht unter jedem Gericht „X isst was anderes"; der Slot-Screen plant dann über `?for=<id>` nur für diese Person, inklusive Auswärts und Aufwärmen.

**Noch nicht drin**: die kuratierten Einfach-Gerichte „belegtes Brot" und „Lunchbox" aus `data/meals.ts`. Die Mechanik funktioniert mit jedem bestehenden passenden Gericht; neue Katalog-Gerichte brauchen vorher Illustrationen in `assets/meals/`, weil `tests/meal-images.test.cjs` für jedes Gericht ein passendes Bild verlangt (und `mealImageSource` bewusst kein Bild liefert, dessen Zutaten nicht exakt stimmen).

## Fallen, die in Phase 0–6 Zeit gekostet haben

1. **CHECK-Constraints erlauben keine Subqueries.** Für JSONB-Prüfungen eine `immutable`-Funktion anlegen — und ihr `execute` an `authenticated` **und** `service_role` geben: Der Constraint läuft als die schreibende Rolle. Sonst „permission denied for function".
2. **RLS schlägt vor CHECK-Constraints zu.** Eine Zeile, die beides verletzt, kommt mit `42501`, nicht mit `23514`.
3. **pglite liefert Treibertypen, nicht JSON.** `numeric` als String, `timestamptz` als `Date`. Im Test über einen Normalisierer gehen (`asJsonRow` in `tests/week-plan-database.test.cjs`).
4. **`lib/supabase` zieht React Native herein** und lädt in Node nicht. In Tests `Module._load` patchen (Beispiele: `tests/week-plan-database.test.cjs`, `tests/week-plan-ui.test.cjs`).
5. **`preference-domain` ↔ `profile-domain` importieren sich gegenseitig.** In Ordnung, solange die Aufrufe in Funktionskörpern stehen; keine Top-Level-Auswertung über die Zyklusgrenze.
6. **UI-Tests**: `react-test-renderer` mit gestubbten `./ui`-Komponenten. `PreferenceRow` hat `onEdit`, nicht `onPress`. Stubs brauchen einen `displayName` (sonst `react/display-name`). `findAll` trifft **Stub-Komponente und Host-Element**, also nie auf `length === 1` prüfen.
7. **`PreferenceStore` verwirft seinen Cache** bei unbekanntem Schrittnamen oder ungültigem Draft. Nie einen Schrittnamen entfernen, neue Draft-Felder immer optional.
8. **Der `WeekPlanStore` speichert `{version:1, plan:null}`** nach einem Reset. Beim Laden muss `plan === null` gültig sein, sonst meldet der Store seinen eigenen leeren Stand als unlesbar.
9. **Ein synchron werfender Supabase-Client** entkommt `Promise.resolve(...).catch(...)`. `recordChoice` ist deshalb `async` mit `try/catch` — ein Log-Eintrag darf eine getroffene Entscheidung nie scheitern lassen.
10. **Zähler in `tests/basket-ui.test.cjs` sind kumulativ** über die Tests, und der Katalog-Loader bleibt aus dem vorherigen Test hängen. Am Testbeginn `load` zurücksetzen und Zähler-Baselines nehmen.
11. **Der Fixture-Katalog deckt nicht jede Zutat** (Teriyaki hat kein Paket). Tests, die einen vollständigen Korb brauchen, über `ingredientAvailability` einen kaufbaren Vorschlag wählen — sonst testet man die Katalog-Lücke statt des Kalenders.

## Offene Entscheidungen

- **`planningDays`** steckt noch in `PreferenceValues` (Default 7) und wird von `nutritionTargets`, `preferenceChips`, dem Budget-Text, `app/plan-setup.tsx` und dem alten Sprach-/Automatikpfad benutzt. Für Version-2-Pläne ist es in der DB schon `null`. Ausbauen erst, wenn der alte Flow wirklich weg soll.
- **Alter Flow**: `generateMealPlan`, `plan-setup.tsx`, `MealPlanReview` leben weiter (Sprachplanung braucht sie). Wann sie verschwinden, ist offen.
- **Katalogtiefe**: rund 30 Gerichte, davon 10 Frühstücke. Mit Diätfiltern gehen die Vorschläge schnell aus; der Screen sagt es ehrlich. Die größere Idee sind abwandelbare Gerichte statt fester Katalog.
- **Budget**: derzeit Kriterium im Scoring und Anzeige im Korb; der Gesamtbetrag wird für eine Woche nicht nach geplanten Tagen skaliert.
- **Mahlzeiten-Standard** gilt haushaltsweit (`user_preferences.slot_defaults`), nicht pro Person.
- **`meal_choice_events`** wird geschrieben, aber von nichts gelesen. Ein fehlgeschlagener Schreibversuch wird verworfen, nicht gepuffert.
- **Branch-Name** passt nicht mehr zum Inhalt.
