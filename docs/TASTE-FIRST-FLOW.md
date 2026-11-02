# Vom Geschmack direkt zum Wochenplan

Referenz: `samisam-hub/SmartBasket-website`, Stand `2df0389`, insbesondere `dist/de/app-entwurf.js` und `dist/de/app-entwurf-screens.js` (Geschmack → Wochenplan → Tauschen → Korb). Das Webseiten-Repository wurde nur gelesen.

Der App-Ablauf ist jetzt:

1. Haushalt, Mahlzeitenstandard, Ernährungsregeln und Budget einrichten. Nach dem ersten Speichern direkt zur Wochenauswahl; beim Bearbeiten vorhandener Einstellungen bleibt die bisherige Rückkehr bestehen.
2. Tage und regelmäßige Abwesenheit auswählen.
3. Nach Mahlzeit gegliedert Gerichte wischen: rechts mögen, links nicht mögen; Buttons sind gleichwertig. Letzte Bewertung zurücknehmen und später weiterbewerten ist möglich. Bewerten legt noch kein Gericht auf einen Tag. Ohne Bewertungen darf ebenfalls geplant werden.
4. „Wochenplan erstellen“ ergänzt alle offenen Mahlzeiten in einem Schritt. Gemochte Gerichte haben Vorrang vor neutralen; Nährwert-/Portionsberechnung, Produktverfügbarkeit, Budgetgewichtung und Abwechslung bleiben erhalten. Allergien und Ernährungsregeln können nie durch ein Like überstimmt werden. Anders als die Demo werden abgelehnte Gerichte nicht als stiller Ersatz verwendet: Ist der Pool erschöpft, bleibt der Slot sichtbar offen.
5. Die Wochenübersicht zeigt alle gewählten Tage und Mahlzeiten. Einzelne Gerichte und Anwesenheit bleiben änderbar. Ein Tausch übernimmt das neue Gericht erst bei Bestätigung; Zurück behält das bisherige Gericht. Aus dem Wochenplan gestartete Änderungen führen direkt zur Übersicht zurück.
6. Nach Prüfung des vollständigen Plans zur Einkaufsliste; dieselbe vorhandene Mengen-, Packungs- und Warenkorblogik wird verwendet.

## Speicherung und Kompatibilität

`mealRatings` ist ein optionales Feld im bestehenden lokalen Wochenplan-Cache v2 (`mealId → boolean`). Ohne Feld gilt eine leere Bewertungsliste; v1-Pläne bleiben lesbar. Die Bewertungen gelten für den Haushalt des aktuellen Kontos auf diesem Gerät, wochenübergreifend. Kein Konto-übergreifendes Kopieren, keine gemeinsame Bearbeitung und keine neue Cloud-Synchronisierung. Die Website-Demo setzt ihren Zustand beim Neuladen zurück; die App behält ihn ausdrücklich bei.

Änderungen an Bewertungen überschreiben keine bereits gewählten Gerichte, getrennten Gerichte oder ausgelassenen Mahlzeiten. „Wochenplan erstellen“ ergänzt nur offene Slots. Bestehende Entscheidungen lassen sich in der Übersicht gezielt tauschen. Abwesenheitsregeln wirken auf neu erzeugte Gerichte; ein auswärts gegessenes Mittagessen wird nicht durch ein größeres Abendessen kompensiert.

Vor dem Übergang zur Übersicht muss der lokale Schreibvorgang erfolgreich abgeschlossen sein. Ein Schreibfehler bleibt sichtbar und kann erneut versucht werden. Ein unlesbarer Cache wird nicht überschrieben.

## Nachweise

- `tests/taste-planning.test.cjs`: Bewertung/Rangfolge, Allergien, Anwesenheit, Planergänzung, Einkauf, Wiederherstellung und Kontotrennung.
- `tests/taste-flow-ui.test.cjs`: Tage → Wischen → automatische Woche → Tagesbearbeitung/Einkauf; Speicherfehler und Wiederholung.
- `tests/week-plan-ui.test.cjs`: echte Wischgesten und Buttons, einschließlich Ablehnen der letzten Karte.
- `tests/navigation.test.cjs`: direkter Einstieg nach Ersteinrichtung ohne Zurücksprung ins Onboarding.
