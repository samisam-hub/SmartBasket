# Alltagsgerichte in Deutschland

Maschinenlesbare Datenbank: [`../data/german-everyday-meals.json`](../data/german-everyday-meals.json).

Eine redaktionelle Auswahl vertrauter Mahlzeiten für Familien in Deutschland, keine statistische Rangliste und keine Ernährungsempfehlung. Essgewohnheiten unterscheiden sich nach Haushalt, Region und Herkunft. Auch Pasta, Curry und Wraps gehören zur heutigen Alltagsküche. Frühstück, warmes Mittag- oder Abendessen und kaltes Abendbrot sind abgedeckt; niemand muss zweimal täglich warm kochen. Brot schmieren zählt ausdrücklich als Zubereitung.

## Datenvertrag und Verwendung

- `schemaVersion: 1`, stabile `id` je Mahlzeit, deutsche Namen und Zutaten.
- `mealSlots`: `breakfast`, `lunch`, `dinner`; mehrere Zeitpunkte sind erlaubt.
- `activeMinutes`: aktive Arbeit für **vier Portionen**; `totalMinutes`: verstrichene Zeit einschließlich aktiver Arbeit, Vorheizen und angegebenem Warten. Geschätzte Minuten, keine gemessenen Garantien; nicht einfach proportional zur Personenzahl skalieren. Einkauf und Aufräumen sind nicht enthalten.
- `method`: `assemble` (zusammenstellen/Brote schmieren), `cook`, `bake`, `soak`.
- `ingredients`: wesentliche Zutaten ohne Mengen; Salz, Pfeffer und Wasser gelten als Grundvorräte. Fertigprodukte, Dosenware und vorgekochte Zutaten werden ausdrücklich benannt.
- `preparationNote`: Zubereitung und Voraussetzungen, insbesondere Vorkochen, Fertigteig und Kühlzeiten.

Der Katalog ist versionierte JSON-Daten im Repository und benötigt keinen Datenbankserver. Er ist noch **nicht in die automatische Gerichtsauswahl eingebunden**. Die bestehenden Rezepte in `data/meals.ts`, gespeicherte Pläne und die Kalorien- und Mengenberechnung bleiben unverändert. Für eine Aktivierung als berechenbares Rezept braucht jeder Eintrag zusätzlich geprüfte Zutatenmengen, Ingredient-Keys, Nährwerte, Allergene und Ernährungskennzeichnungen. Zutatenlisten hier sind keine Allergenauskunft; Produktvarianten unterscheiden sich. Es werden bewusst keine erfundenen Kalorien oder Portionsmengen hinterlegt.

## Übersicht

F = Frühstück, M = Mittagessen, A = Abendessen. Alle Zeiten in Minuten für vier Portionen; aktive Zeit ist bereits in Gesamtzeit enthalten. Die Hinweise in der JSON-Datei gehören zu jeder Zeitangabe: etwa bereits gekochte Kartoffeln bei Bratkartoffeln und acht Stunden Kühlzeit bei Übernacht-Haferflocken.

| Gericht | Mahlzeit | Aktiv | Gesamt |
| --- | --- | ---: | ---: |
| Käsebrot mit Gurke | F, M, A | 10 | 10 |
| Wurstbrot mit Tomate | F, M, A | 10 | 10 |
| Frischkäsebrot mit Paprika | F, M, A | 10 | 10 |
| Marmeladenbrot | F, M | 5 | 5 |
| Honigbrot | F, M | 5 | 5 |
| Brötchen mit Käse und Marmelade | F | 10 | 10 |
| Aufbackbrötchen mit Belag | F | 10 | 25 |
| Müsli mit Milch und Apfel | F | 10 | 10 |
| Naturjoghurt mit Banane und Haferflocken | F | 5 | 5 |
| Quark mit Beeren | F | 10 | 10 |
| Haferbrei mit Apfel und Zimt | F | 10 | 20 |
| Übernacht-Haferflocken mit Banane | F | 10 | 490 |
| Rührei mit Brot | F, A | 15 | 15 |
| Gekochtes Ei mit Brot | F, A | 10 | 20 |
| Spiegelei auf Brot | F, A | 15 | 15 |
| Hummusbrot mit Gurke | F, M, A | 10 | 10 |
| Pfannkuchen mit Apfelmus | F | 30 | 35 |
| Arme Ritter mit Obst | F | 25 | 25 |
| Spaghetti mit Tomatensoße | M, A | 15 | 25 |
| Spaghetti Bolognese | M, A | 25 | 50 |
| Spaghetti mit Linsenbolognese | M, A | 20 | 40 |
| Nudeln mit Pesto und Tomaten | M, A | 10 | 20 |
| Nudelauflauf mit Brokkoli | M, A | 25 | 50 |
| Lasagne mit Hackfleisch | M, A | 35 | 80 |
| Käsespätzle mit Zwiebeln | M, A | 20 | 25 |
| Gemüsereispfanne | M, A | 20 | 35 |
| Hähnchen mit Reis und Gemüse | M, A | 25 | 35 |
| Hähnchengeschnetzeltes mit Reis | M, A | 25 | 40 |
| Mildes Gemüse-Kichererbsen-Curry | M, A | 20 | 35 |
| Chili con Carne mit Reis | M, A | 20 | 45 |
| Chili sin Carne mit Reis | M, A | 20 | 35 |
| Kartoffeln mit Kräuterquark | M, A | 15 | 35 |
| Kartoffeln mit Spinat und Ei | M, A | 20 | 35 |
| Bratkartoffeln mit Ei | M, A | 25 | 30 |
| Kartoffelgratin mit Gurkensalat | M, A | 25 | 70 |
| Fischstäbchen mit Kartoffelpüree und Erbsen | M, A | 25 | 40 |
| Ofenlachs mit Kartoffeln und Brokkoli | M, A | 20 | 50 |
| Frikadellen mit Kartoffeln und Möhren | M, A | 35 | 45 |
| Bratwurst mit Kartoffelpüree | M, A | 25 | 40 |
| Schnitzel mit Kartoffeln und Gurkensalat | M, A | 40 | 50 |
| Kartoffelsuppe mit Brot | M, A | 25 | 45 |
| Linseneintopf mit Würstchen | M, A | 25 | 60 |
| Gemüsesuppe mit kleinen Nudeln | M, A | 20 | 35 |
| Tortellini in Tomatensoße | M, A | 10 | 20 |
| Gnocchipfanne mit Tomate und Mozzarella | M, A | 15 | 25 |
| Gemüseomelett mit Brot | M, A | 20 | 25 |
| Wraps mit Hähnchen und Gemüse | M, A | 25 | 30 |
| Wraps mit Bohnen und Gemüse | M, A | 20 | 25 |
| Pizza mit Gemüse vom Blech | M, A | 25 | 50 |
| Reibekuchen mit Apfelmus | M, A | 40 | 50 |
| Milchreis mit Apfelmus | M, A | 15 | 40 |
| Grießbrei mit Kirschen | M, A | 15 | 20 |
| Ofenhähnchen mit Kartoffeln und Möhren | M, A | 25 | 90 |
| Brotzeit mit Käse und Rohkost | M, A | 15 | 15 |
| Brotzeit mit Aufschnitt und Gewürzgurken | M, A | 10 | 10 |
| Käsebrot-Lunchbox mit Apfel und Möhre | M, A | 15 | 15 |
| Wurstbrot-Lunchbox mit Gurke und Apfel | M, A | 15 | 15 |
| Tomate-Mozzarella mit Brot | M, A | 15 | 15 |
| Gemischter Salat mit Ei und Brot | M, A | 20 | 25 |
| Nudelsalat mit Erbsen und Käse | M, A | 25 | 60 |
| Kartoffelsalat mit Würstchen | M, A | 30 | 75 |
| Überbackener Käsetoast mit Tomate | M, A | 15 | 25 |
| Flammkuchen mit Zwiebeln und Speck | M, A | 15 | 35 |
| Maultaschen in Gemüsebrühe | M, A | 10 | 20 |
