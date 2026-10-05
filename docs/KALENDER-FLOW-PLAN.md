# SmartBasket · Umsetzungsplan Kalender-Flow

Stand: 5. Oktober 2026 · Quelle: Claude-Dokument „SmartBasket · Umsetzungsplan Kalender-Flow“ (https://claude.ai/code/artifact/10d6ea1d-85dd-4f78-b4ae-1ce14babc793) · Design: Canvas „SmartBasket Wochenplanung“ (https://claude.ai/artifact/R12Vk43MS6jyKnnGrq5S4h)

## Ziel und Scope

Die erste Version ersetzt den automatisch erzeugten Komplettplan durch einen Kalender, den die Nutzerin selbst füllt: Woche wählen, Tag anpassen, pro Mahlzeit zwischen zwei Gerichten wählen, Korb erstellen. Grundlage ist der Canvas „SmartBasket Wochenplanung“ (Screens 1–7).

**MVP (diese Umsetzung)**

- Mahlzeiten-Standard einmalig festlegen (Screen 1)
- Tage einer Woche frei wählen, auch mit Lücken (Screen 2)
- Slots pro Tag vorbelegt, einzeln abwählbar (Screen 3)
- Zwei Gerichte pro Slot, Alternativen „Überspringen“, „Aufwärmen“, „Auswärts“ (Screen 4)
- Rückkehr zum Kalender nach jedem Tag (Screen 5)
- Wochenkalender als Startansicht (Screen 6)
- Korb aus allen Gerichten auf „kochen“ plus manuelle Extras (Screen 7)

**Bewusst später**

- „Tag wie Montag übernehmen“
- „Steht etwas Besonderes an?“ mit Backrezepten
- „Immer dabei“, gelernt aus früheren Körben
- Vorschläge, die aus Wisch-Entscheidungen lernen (die Daten werden aber ab dem MVP gespeichert)
- Google-Kalender-Anbindung

Kalorien und Protein laufen unsichtbar weiter: Sie sortieren die Vorschläge, werden aber im neuen Flow nicht angezeigt.

## Ausgangslage im Code

Heute erzeugt `generateMealPlan` in einem Schritt alle Slots für 3, 5, 7 oder 14 aufeinanderfolgende Tage; `basketFromMealPlan` macht daraus den Korb. Diese Stellen passen nicht zum Kalender:

| Stelle | Heute | Konflikt mit dem Kalender |
| --- | --- | --- |
| `types/meal.ts` (`MealPlan`, `MealPlanItem`) | `planningDays` + `dayIndex` ab 0 | Keine echten Daten, keine Lücken zwischen Tagen |
| `services/preference-domain.ts`, Migrationen | `planning_days in (3,5,7,14)`, `day_index between 0 and 13` | Mo, Di, Do ist nicht darstellbar |
| `services/meals/planner.ts` | Füllt jeden Slot jedes Tages automatisch | Neu: zwei Vorschläge pro Slot auf Anfrage |
| `services/meals/validation.ts` | Plan muss zu `planningDays` passen | Muss gewählte Tage und Slots prüfen |
| `services/meals/basket.ts` | Status „partial“, wenn nicht alle Tage × 4 Slots belegt sind | Fast jeder Kalender-Korb wäre „partial“ |
| Supabase-RPC (Migration `meal_based_baskets`) | Prüft `planningDays` gegen Preferences | Wochenplan hängt nicht mehr an einer festen Tageszahl |

Schon vorhanden und wiederverwendbar:

- `mealMode` mit `cook`, `heat_and_eat`, `ready_to_eat`, `eat_out` und `replaceMealChoice` (`services/meals/choices.ts`)
- Manuelle Extras: `addBasketProduct` legt Artikel mit `isExtra` und `ingredientKey: extra:<id>` an (`services/basket/add-product.ts`)
- Gerichtsbilder für fast alle Gerichte (`lib/meal-images.ts`)
- Scoring für Wiederholung, Zutaten-Wiederverwendung, Diät und Allergene im Planer

## Phasen in Reihenfolge

### Implementierungsstand: Haltepunkt nach Phase 0

- Personen-Onboarding mit einem automatisch angelegten ersten Teilnehmer, Erwachsener/Kind als Pflichtauswahl, optionalen Details und korrigierbarer Empfehlung.
- `estimateCalories` ist über `services/profile-domain.ts` verfügbar. Erwachsene mit vollständigem Alter, Größe, Gewicht und männlich/weiblich verwenden Mifflin–St Jeor mit Aktivitätsfaktor; sonst 2.000 kcal als Ausgangswert. Kinder verwenden eine kleinere, anpassbare Standardportion von 1.400 kcal, keine Erwachsenenformel. Dies sind Planungswerte, keine individuellen Ernährungsvorgaben.
- Mahlzeiten-Standard mit ausgeschaltetem Snack im Onboarding. `SlotDefaults` wurde als Voraussetzung dafür bereits ergänzt; `WeekPlan` bleibt Phase 1.
- Abschluss führt zum leeren Wochenkalender mit Wochennavigation. Tage und Mahlzeiten sind hier noch nicht bearbeitbar; diese Screens folgen in der vorgesehenen UI-Phase. Vorhandene gespeicherte Pläne bleiben separat erreichbar.
- Neue Haushaltsdaten und Mahlzeiten-Standards werden lokal inklusive Entwürfen gespeichert. Bis Phase 2 bleibt ihr Cloud-Sync ausdrücklich ausstehend, damit alte Tabellen keine neuen Daten stillschweigend verlieren. Die Migration muss neben `slot_defaults` auch die Teilnehmerliste dauerhaft in den Preferences speichern; anschließend den vorläufigen Guard in `preferences-repository.ts` ersetzen und Roundtrip-Tests ergänzen.
- Alte Preferences, Teilnehmer und Version-1-Plan-Snapshots werden nicht umgeschrieben. `planningDays` bleibt intern für die bisherigen Planfunktionen erhalten, entfällt aber aus dem normalen Onboarding.
- Neue Regressionstests: `tests/onboarding-household.test.cjs` und `tests/onboarding-people-ui.test.cjs`; bestehende Mengen-, Persistenz- und Datenbanktests bleiben aktiv.

Phasen 0 bis 6 plus 3b, jede einzeln testbar. Phase 0 bis 2 bauen aufeinander auf und kommen zuerst; Phase 1 bis 3 sind reine Logik ohne UI; ab Phase 4 kann parallel an Screens gearbeitet werden.

### Phase 0 — Onboarding mit Personen und Kalorien

Umbau des bestehenden Onboardings in `app/onboarding/[step].tsx` (heute: welcome, household mit `householdSize` + `planningDays`, goals mit manuellen `dailyCalories`, diet, allergies, budget). `planningDays` entfällt (der Kalender ersetzt es), `householdSize` wird zur Personenliste, die manuelle Kalorieneingabe wird zur berechneten Empfehlung. Einmalig und später änderbar. Ziel: in Sekunden durchzukommen und trotzdem jede Person einzeln anzulegen, damit später eigene Ziele möglich sind.

- Der Haushalt ist eine **Liste von Personen** (`PlanParticipant`, schon vorhanden), nicht nur eine Zahl. Nutzer wird automatisch als erste Person angelegt.
- Pflicht pro Person: **ein Tipp** — Erwachsener oder Kind. Mehr nicht.
- Optional pro Person: Alter, Geschlecht, Aktivität (sitzend, normal, aktiv), einzeln nachtragbar.
- Die App rechnet pro Person ein **Kalorienziel per Mifflin-St-Jeor** (Grundumsatz × Aktivitätsfaktor); ohne Detailangaben Standardwerte je Erwachsener/Kind. Kind zählt als kleinere Portion.
- Ergebnis als **Empfehlung** gezeigt, nicht als nackte Kalorienzahl; antippen und korrigieren möglich.
- Ebenfalls hier: Mahlzeiten-Standard (Screen 1) und harte Einschränkungen (Allergien, Ernährungsform) — Letztere, weil sie die Gerichte filtern.
- Nicht hier: genaue Vorlieben und Abneigungen; die lernt die App über die Wisch-Entscheidungen.
- Danach landet der Nutzer auf dem **leeren, einladenden Kalender**, nicht in weiteren Formularen.

Dateien: `app/onboarding/[step].tsx` (Schritte umbauen), Erweiterung von `types/profile.ts` (`PlanParticipant` um Aktivität und Zielwert), neue Funktion `estimateCalories(participant)` in `services/profile-domain.ts`, Mengenrechnung in `services/meals/portions.ts` summiert über Personen.

1. **Datenmodell: Kalender-Plan** — `types/meal.ts`
   - Neuer Typ `WeekPlan` (Version `'2'`): `weekStart` (ISO-Datum, Montag), `days: { date, slots: MealSlot[] }[]`, `items`
   - `MealPlanItem` bekommt `date` statt `dayIndex`; `dayIndex` bleibt nur für alte Pläne lesbar
   - Neuer Typ `SlotDefaults` (Mahlzeiten-Standard) in `types/preferences.ts`; Snack standardmäßig aus
2. **Migration** — neue Datei in `supabase/migrations/`
   - `user_preferences`: Spalte `slot_defaults jsonb`
   - `meal_plans`: Spalten `week_start date`, `plan_version`; `planning_days` nullable machen
   - `meal_plan_items`: Spalte `plan_date date`; Check `day_index between 0 and 13` und Unique-Constraint auf `(meal_plan_id, plan_date, meal_slot)` umstellen
   - RPC zum Speichern: Prüfung `planningDays` gegen Preferences für Version 2 entfernen
   - Alte Pläne bleiben unverändert lesbar
3. **Vorschläge statt Komplettplan** — `services/meals/planner.ts`
   - Neue Funktion `suggestMeals(plan, date, slot, preferences, catalog, exclude)` → genau zwei unterschiedliche Gerichte
   - Bestehende Bewertung wiederverwenden (Wiederholung, gleiche Mahlzeit am Tag, Zutaten-Wiederverwendung, Verfügbarkeit, Budget); statt `candidates[0]` die zwei besten mit verschiedener `meal.id`
   - `exclude` = bereits gezeigte Gerichte, für „Zwei andere zeigen“
   - Kalorien/Protein bleiben im Score; das Abendessen-„Rest des Tages“ nur anwenden, wenn die anderen Slots des Tages schon gewählt sind
   - `generateMealPlan` vorerst behalten: Die Sprachplanung (`app/voice-plan.tsx`) liefert Wunschgerichte (`preferredMealIds`), die heute darüber eingeplant werden
4. **Validierung und Korb** — `services/meals/validation.ts`, `services/meals/basket.ts`, `services/meals/aggregation.ts`
   - `isWeekPlan`: Datum gehört zur Woche, Slot gehört zu den gewählten Slots des Tages, keine Dubletten pro Datum + Slot
   - Status „partial“ nur noch bei fehlenden Produkten oder offenen *gewählten* Slots, nicht bei bewusst leeren
   - Ernährungsabdeckung nur über geplante Tage rechnen; nicht geplante Tage zählen nicht als Lücke
   - Aggregation bleibt gleich: sie nimmt ohnehin nur `isCook`-Einträge. `planNutrition` wird auch von `services/basket/edit.ts` und `services/waste-prevention.ts` genutzt und muss beide Plantypen verstehen
5. **Screens** — `app/`
   - `app/(tabs)/index.tsx` wird zum Wochenkalender (Screen 6)
   - Neu: `app/plan/week.tsx` (Screen 2), `app/plan/[date].tsx` (Screen 3), `app/plan/[date]/[slot].tsx` (Screen 4), `app/plan/day-done.tsx` (Screen 5)
   - Mahlzeiten-Standard ins Onboarding: `app/onboarding/[step].tsx` (Screen 1)
   - Wischgeste ist Teil des MVP (nicht erst später). Regeln auf Screen 4:
     - Karten einzeln, eine nach der anderen
     - Rechts wischen = nehmen; der Slot ist sofort belegt und fertig
     - **Nur ein Gericht pro Mahlzeit** — das erste Ja gewinnt (first come, first plan), danach verschwinden die Karten dieser Mahlzeit
     - Links wischen = nächste Karte zeigen
     - Sind alle passenden Gerichte durch (z. B. nur zwei Snacks), ehrlich melden und Ausweg bieten: Überspringen, Aufwärmen oder Auswärts — keine stille Wiederholung
     - Antippen bleibt als gleichwertige Alternative zum Wischen
   - `app/basket-setup.tsx` auf `WeekPlan` umstellen
6. **Korb-Extras** — `components/BasketResult.tsx`, `services/basket/add-product.ts`
   - Suchfeld „Produkt hinzufügen“ über die vorhandene `addBasketProduct`
   - „Immer dabei“ im MVP als feste Vorschlagsliste; Lernen kommt später

### Phase 3b — Anwesenheit pro Mahlzeit

Nicht jede Person isst jede Mahlzeit zu Hause. Darum bekommt jeder Slot eine Anwesenheitsliste; die Menge rechnet sich nur aus den Anwesenden (`portions.ts` denkt schon pro Teilnehmer).

- Standard: **alle dabei**. Abwesenheit ist die Ausnahme, einzeln pro Slot ab-/zuwählbar (antippen oder wegwischen).
- Drei Zustände pro Person und Mahlzeit:
  1. **Dabei** — zählt zur Menge des gewählten Gerichts
  2. **Ganz weg** (z. B. Mensa) — keine Menge, kein Einkauf
  3. **Eigenes einfaches Gericht** (z. B. Brotzeit/Lunchbox) — kommt mit Zutaten in den Korb, ohne neue Mechanik
- Zustand 3 braucht keinen eigenen Modus: ein paar einfache Gerichte wie „belegtes Brot“, „Lunchbox“ in `data/meals.ts` ergänzen; die Person wählt für diesen Slot dieses Gericht statt des Familienessens.
- Datenmodell: `MealPlanItem` bekommt `participantIds` (wer isst mit); fehlt es, gelten alle (Abwärtskompatibilität).
- **Später:** wiederkehrende Muster wie „Kind, Mo–Fr, Mittag, nicht dabei“, damit man es nicht jede Woche neu setzt.

## Wisch-Entscheidungen speichern

Jede Entscheidung auf Screen 4 wird ab dem MVP als Ereignis gespeichert, auch wenn noch nichts daraus lernt. Eigene Tabelle `meal_choice_events` (nur Insert, Lesen nur eigene Zeilen, RLS wie bei `meal_plans`):

| Feld | Typ | Inhalt |
| --- | --- | --- |
| `user_id` | uuid | Nutzer |
| `created_at` | timestamptz | Zeitpunkt |
| `plan_date` | date | Für welchen Tag geplant wurde |
| `meal_slot` | text | `breakfast`, `lunch`, `dinner`, `snack` |
| `shown_meal_ids` | text\[\] | Die zwei gezeigten Gerichte |
| `action` | text | `chosen`, `shuffled` (zwei andere), `skipped`, `heat_and_eat`, `eat_out`, `copied_day` |
| `chosen_meal_id` | text, nullable | Nur bei `chosen` |
| `round` | smallint | Wie oft „Zwei andere zeigen“ gedrückt wurde, bevor entschieden wurde |

Daraus lassen sich später ablesen: welche Gerichte nie gewählt werden, welche Slots am häufigsten übersprungen werden und ob die ersten zwei Vorschläge reichen.

## Tests und offene Fragen

Die Tests laufen über `npm test` (`node --test tests/*.test.cjs`); dazu `npm run typecheck` und `npm run lint` nach jeder Phase.

**Tests anpassen oder neu schreiben**

- [ ] `tests/meals.test.cjs`, `tests/meal-snacks.test.cjs`: gehen von vollständig gefüllten Tagen aus
- [ ] `tests/meal-persistence.test.cjs`, `tests/basket-database.test.cjs`: neue Spalten und Version-2-Pläne
- [ ] `tests/meal-choices.test.cjs`: Modi pro Slot im Kalender
- [ ] Neu `tests/meal-suggestions.test.cjs`: `suggestMeals` liefert genau zwei verschiedene, kompatible Gerichte; `exclude` greift; Allergene und Diäten werden nie verletzt
- [ ] Neu: Korb mit Lücken (Mo, Di, Do) und abgewählten Slots ist nicht „partial“
- [ ] Alte gespeicherte Pläne (Version 1) lassen sich weiterhin öffnen

**Offene Fragen vor Phase 3**

- Reicht der Katalog? Rund 30 Gerichte, davon 10 Frühstücke; mit Diätfiltern und „Zwei andere zeigen“ gehen die Vorschläge schnell aus. Was zeigt die App, wenn weniger als zwei passende Gerichte übrig sind? **Zurückgestellt** — wird separat entschieden, blockiert den Code-Start nicht. Mitgedacht wird dabei die größere Idee, **Gerichte abwändelbar zu machen statt fester Katalog** (Zutaten tauschen, Varianten, evtl. eigene Gerichte): Aus wenigen Grundgerichten werden viele, was die Knappheit weitgehend löst. Eigene Designfrage für eine spätere Textchat-Sitzung.
- Bleibt das Budget im Kalender-Flow ein Kriterium für die Vorschläge oder nur eine Anzeige im Korb?
- Haushalte mit mehreren Personen: Gilt der Mahlzeiten-Standard für alle, oder pro Person?
