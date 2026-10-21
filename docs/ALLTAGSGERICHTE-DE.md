# Alltagsgerichte in Deutschland

64 aktivierte Rezepte für Frühstück, Mittag- und Abendessen, einschließlich Brote schmieren, Lunchboxen und kaltes Abendbrot. Eine redaktionelle Auswahl, keine statistische Rangliste oder Ernährungsempfehlung. Essgewohnheiten unterscheiden sich nach Haushalt, Region und Herkunft; auch Pasta, Curry und Wraps gehören zur heutigen Alltagsküche.

## Daten und Berechnung

- [Rezeptdatenbank](../data/german-everyday-meals.json): Schema 2, stabile IDs, passende Mahlzeiten-Slots, Zutatenmengen für vier Basisportionen, Zubereitungszeiten und Hinweise.
- [Zutatenreferenzen](../data/everyday-ingredients.json): Lebensmittelzustand, Einheit, Schätzwerte je 100 g/ml, Ernährungskennzeichnungen und enthaltene Allergene für neue Zutaten. Bestehende Zutaten werden aus [meals.ts](../data/meals.ts) wiederverwendet.
- [Rezeptadapter](../data/everyday-meals.ts): teilt die Vier-Portionen-Mengen durch vier und berechnet Kalorien, Eiweiß, Kohlenhydrate und Fett für eine Basisportion. Die vorhandene Planung skaliert diese nach Kalorienbedarf und Anwesenheit; die Einkaufsliste summiert die skalierten Mengen.
- Mehrere Mahlzeiten-Slots sind explizit erlaubt. Alte Rezepte ohne dieses Feld behalten die bisherige Zuordnung. Alte gespeicherte Pläne und Zutaten-IDs bleiben unverändert.

Nährwerte sind **redaktionelle Referenzschätzungen**, keine gemessenen oder markenspezifischen Produktwerte. Grammangaben beziehen sich auf essbare Roh-/Trockengewichte; Konserven auf Abtropfgewichte. Milch, Sahne, Kokosmilch und Essig sind in ml angegeben. Brühe ist Trockenpulver; Wasser kommt nach Packungsangabe hinzu. Eier sind ohne Schale erfasst. Schenkelfleisch wird ohne Knochen eingekauft. Bratkartoffeln verwenden jetzt rohe Einkaufskartoffeln; Vorkochen ist in den 60 Minuten enthalten.

Die Rezepte verwenden konkrete Basisvarianten: Vollkornbrot, Magerquark, Naturjoghurt mit 3,5 % Fett, Gouda und gegebenenfalls Käse mit mikrobiellem Lab. Konfitüre und Apfelmus sind normale, nicht zuckerreduzierte Varianten. Zusammengesetzte Produkte unterscheiden sich in Zutaten und Allergenen; Rezept-Tags ersetzen keine Produktprüfung. Die vorhandenen strengen SKU-Prüfungen bleiben aktiv, fehlende Produkte/Preise werden nicht erfunden. Neue Rezepte erhalten keine pauschale Diabetes-Kennzeichnung. Senf und Sellerie sind zusätzlich auswählbar und werden in Rezept- und Produktfiltern berücksichtigt.

**Datenbankmigration:** Vor Veröffentlichung der App-Version muss die Migration [20261021120000_everyday_meal_allergens.sql](../supabase/migrations/20261021120000_everyday_meal_allergens.sql) in der Ziel-Supabase-Instanz ausgeführt sein. Sie erweitert die erlaubten Allergene in Einstellungen, Profilen und Planteilnehmern; RLS und Bestandsdaten bleiben erhalten. Ein Git-Merge führt diese Migration nicht automatisch aus.

## Zubereitungszeiten

Aktive Zeit ist Teil der Gesamtzeit. Alle Zeiten sind Schätzungen für vier Basisportionen inklusive Vorheizen, Garen und genanntem Warten, ohne Einkauf und Aufräumen. Mengen skalieren mit dem Kalorienbedarf; Zeiten werden nicht linear hochgerechnet. Einweichzeiten, Fertigteige und Convenience-Produkte sind in den Hinweisen ausdrücklich benannt. Neue Rezepte erscheinen ohne Bild, bis passende Illustrationen vorliegen; bestehende Bilder bleiben ihren bisherigen Rezepten zugeordnet.

F = Frühstück, M = Mittagessen, A = Abendessen. Nährwerte gelten für **eine Basisportion**, Zeiten für **vier**.

| Gericht | Mahlzeit | Aktiv (Min.) | Gesamt (Min.) | kcal | Eiweiß (g) | Kohlenhydrate (g) | Fett (g) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Käsebrot mit Gurke | F, M, A | 10 | 10 | 469 | 20.7 | 41.9 | 23.6 |
| Wurstbrot mit Tomate | F, M, A | 10 | 10 | 387 | 21.0 | 43.2 | 13.9 |
| Frischkäsebrot mit Paprika | F, M, A | 10 | 10 | 367 | 13.4 | 46.6 | 13.1 |
| Marmeladenbrot | F, M | 5 | 5 | 389 | 10.2 | 58.1 | 12.2 |
| Honigbrot | F, M | 5 | 5 | 375 | 10.1 | 55.1 | 12.2 |
| Brötchen mit Käse und Marmelade | F | 10 | 10 | 555 | 18.4 | 75.7 | 19.0 |
| Aufbackbrötchen mit Belag | F | 10 | 25 | 555 | 18.4 | 75.7 | 19.0 |
| Müsli mit Milch und Apfel | F | 10 | 10 | 462 | 14.8 | 74.0 | 11.5 |
| Naturjoghurt mit Banane und Haferflocken | F | 5 | 5 | 420 | 14.7 | 67.0 | 10.9 |
| Quark mit Beeren | F | 10 | 10 | 241 | 27.1 | 26.9 | 2.8 |
| Haferbrei mit Apfel und Zimt | F | 10 | 20 | 499 | 17.8 | 75.3 | 14.0 |
| Übernacht-Haferflocken mit Banane | F | 10 | 490 | 526 | 18.8 | 81.5 | 14.0 |
| Rührei mit Brot | F, A | 15 | 15 | 434 | 23.8 | 42.1 | 18.8 |
| Gekochtes Ei mit Brot | F, A | 10 | 20 | 457 | 23.1 | 41.1 | 22.2 |
| Spiegelei auf Brot | F, A | 15 | 15 | 445 | 23.9 | 43.6 | 19.2 |
| Hummusbrot mit Gurke | F, M, A | 10 | 10 | 396 | 14.8 | 50.2 | 14.4 |
| Pfannkuchen mit Apfelmus | F | 30 | 35 | 711 | 21.8 | 104.7 | 21.4 |
| Arme Ritter mit Obst | F | 25 | 25 | 578 | 22.4 | 74.6 | 21.8 |
| Spaghetti mit Tomatensoße | M, A | 15 | 25 | 517 | 15.5 | 82.8 | 12.5 |
| Spaghetti Bolognese | M, A | 25 | 50 | 770 | 41.0 | 88.0 | 26.3 |
| Spaghetti mit Linsenbolognese | M, A | 20 | 40 | 617 | 26.7 | 103.5 | 8.3 |
| Nudeln mit Pesto und Tomaten | M, A | 10 | 20 | 545 | 15.1 | 76.0 | 19.1 |
| Nudelauflauf mit Brokkoli | M, A | 25 | 50 | 716 | 30.8 | 84.1 | 28.1 |
| Lasagne mit Hackfleisch | M, A | 35 | 80 | 855 | 44.9 | 80.5 | 37.2 |
| Käsespätzle mit Zwiebeln | M, A | 20 | 25 | 728 | 31.1 | 76.6 | 32.6 |
| Gemüsereispfanne | M, A | 20 | 35 | 601 | 13.4 | 104.6 | 11.9 |
| Hähnchen mit Reis und Gemüse | M, A | 25 | 35 | 684 | 46.3 | 87.6 | 16.2 |
| Hähnchengeschnetzeltes mit Reis | M, A | 25 | 40 | 776 | 47.0 | 81.9 | 28.9 |
| Mildes Gemüse-Kichererbsen-Curry | M, A | 20 | 35 | 799 | 19.9 | 109.9 | 29.1 |
| Chili con Carne mit Reis | M, A | 20 | 45 | 809 | 42.9 | 92.8 | 26.7 |
| Chili sin Carne mit Reis | M, A | 20 | 35 | 721 | 24.4 | 116.7 | 13.9 |
| Kartoffeln mit Kräuterquark | M, A | 15 | 35 | 425 | 32.2 | 69.2 | 1.8 |
| Kartoffeln mit Spinat und Ei | M, A | 20 | 35 | 494 | 25.1 | 56.1 | 19.3 |
| Bratkartoffeln mit Ei | M, A | 35 | 60 | 569 | 20.6 | 65.9 | 25.4 |
| Kartoffelgratin mit Gurkensalat | M, A | 25 | 70 | 673 | 24.1 | 71.1 | 32.1 |
| Fischstäbchen mit Kartoffelpüree und Erbsen | M, A | 25 | 40 | 778 | 35.7 | 96.9 | 24.1 |
| Ofenlachs mit Kartoffeln und Brokkoli | M, A | 20 | 50 | 705 | 42.2 | 61.6 | 30.7 |
| Frikadellen mit Kartoffeln und Möhren | M, A | 35 | 45 | 833 | 43.5 | 82.3 | 36.0 |
| Bratwurst mit Kartoffelpüree | M, A | 25 | 40 | 843 | 31.4 | 65.9 | 49.5 |
| Schnitzel mit Kartoffeln und Gurkensalat | M, A | 40 | 50 | 732 | 49.0 | 79.3 | 23.6 |
| Kartoffelsuppe mit Brot | M, A | 25 | 45 | 585 | 16.4 | 96.0 | 14.2 |
| Linseneintopf mit Würstchen | M, A | 25 | 60 | 731 | 36.2 | 77.5 | 27.4 |
| Gemüsesuppe mit kleinen Nudeln | M, A | 20 | 35 | 502 | 19.2 | 92.5 | 3.3 |
| Tortellini in Tomatensoße | M, A | 10 | 20 | 748 | 28.5 | 100.3 | 23.0 |
| Gnocchipfanne mit Tomate und Mozzarella | M, A | 15 | 25 | 750 | 27.4 | 86.2 | 31.9 |
| Gemüseomelett mit Brot | M, A | 20 | 25 | 592 | 31.4 | 49.1 | 29.5 |
| Wraps mit Hähnchen und Gemüse | M, A | 25 | 30 | 666 | 47.9 | 69.2 | 21.6 |
| Wraps mit Bohnen und Gemüse | M, A | 20 | 25 | 700 | 25.6 | 101.6 | 18.9 |
| Pizza mit Gemüse vom Blech | M, A | 25 | 50 | 826 | 33.6 | 107.0 | 27.5 |
| Reibekuchen mit Apfelmus | M, A | 40 | 50 | 679 | 13.0 | 104.3 | 23.2 |
| Milchreis mit Apfelmus | M, A | 15 | 40 | 587 | 15.8 | 104.1 | 11.5 |
| Grießbrei mit Kirschen | M, A | 15 | 20 | 550 | 18.4 | 91.2 | 11.5 |
| Ofenhähnchen mit Kartoffeln und Möhren | M, A | 25 | 90 | 827 | 44.3 | 69.4 | 41.0 |
| Brotzeit mit Käse und Rohkost | M, A | 15 | 15 | 610 | 26.8 | 61.1 | 27.6 |
| Brotzeit mit Aufschnitt und Gewürzgurken | M, A | 10 | 10 | 448 | 24.5 | 51.9 | 15.0 |
| Käsebrot-Lunchbox mit Apfel und Möhre | M, A | 15 | 15 | 576 | 21.5 | 70.1 | 23.9 |
| Wurstbrot-Lunchbox mit Gurke und Apfel | M, A | 15 | 15 | 459 | 21.1 | 63.4 | 14.2 |
| Tomate-Mozzarella mit Brot | M, A | 15 | 15 | 687 | 34.8 | 47.8 | 38.3 |
| Gemischter Salat mit Ei und Brot | M, A | 20 | 25 | 514 | 25.3 | 46.3 | 24.6 |
| Nudelsalat mit Erbsen und Käse | M, A | 25 | 60 | 666 | 32.5 | 84.2 | 19.9 |
| Kartoffelsalat mit Würstchen | M, A | 30 | 75 | 680 | 19.9 | 67.9 | 35.7 |
| Überbackener Käsetoast mit Tomate | M, A | 15 | 25 | 633 | 26.0 | 62.8 | 30.1 |
| Flammkuchen mit Zwiebeln und Speck | M, A | 15 | 35 | 842 | 24.4 | 88.0 | 42.7 |
| Maultaschen in Gemüsebrühe | M, A | 10 | 20 | 510 | 25.3 | 61.3 | 17.8 |
