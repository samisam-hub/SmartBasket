# SmartBasket – Katalogausbau auf 285 Gerichte

**Status:** In Arbeit; keine Freigabe als 285-Gerichte-Katalog.

## Nachgewiesener Ist-Zustand
- `data/meals.ts`: 34 kuratierte Basisrezepte.
- `data/german-everyday-meals.json`: 64 deutsche Alltagsrezepte, die über `buildEverydayMeals` in die App übernommen werden.
- **98 vorhandene Gerichte; 187 fehlen zum Ziel 285.**
- Supabase enthält keine eigenständige zentrale Rezepttabelle; die Rezepte sind im App-Repository definiert.

## Definition of Done – erst dann „nur Bilder fehlen“
- 187 zusätzliche **eigenständige, alltagstaugliche** Rezepte, keine bloßen Wort- oder Zutatentausch-Duplikate.
- Jedes Rezept mit stabiler ID, deutschem Namen, passenden mealSlots, 4-Portionen-Zutatenmengen, vorhandenen Ingredient-Keys, Methode, Zubereitungshinweis, aktiver und gesamter Zeit.
- Alle Zutaten auf vorhandene IngredientDefinition und damit auf die Einkaufsliste abbildbar; keine fiktiven Zutaten.
- Keine unplausiblen Mahlzeitenzuordnungen wie ein inszeniertes Linsen-Avocado-Ei-Frühstück.
- Test: exakt 285 eindeutige IDs und Namen, 0 unbekannte Zutaten, Mengen > 0, activeMinutes <= totalMinutes, keine leeren Rezeptangaben.
- Bildstatus pro ID: `missing`, `existing`, `needs_review`, `approved`; Bildgenerierung ausschließlich für nachweislich fehlende Bilder.
- Bestehende App-Bilder bleiben unverändert; kein Deploy oder Merge ohne Prüfung.

## Bildstil
Quadratischer Ausschnitt wie die SmartBasket-App-Screenshots: ein vollständig sichtbarer Teller, warme beige Fläche, weiches Tageslicht, wenig Requisiten, genügend Abstand, keine Kontaktbögen.

## Hinweis
Diese Datei dokumentiert die verbindlichen Qualitätskriterien; sie stellt keine abgeschlossene Implementierung der 187 Rezepte dar.
