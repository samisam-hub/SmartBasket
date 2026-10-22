# SmartBasket Recipe Photography – Definition of Done v1.0

**Status:** verbindliche Produktionsvorgabe für neu generierte Rezeptbilder.
**Referenzen:** zwei vom Product Owner am 2026-10-23 bereitgestellte App-Screenshots mit „Egg and chicken-ham toast“ und „Smoked salmon and soft egg toast“. Die Screenshots sind im Chat, nicht im Repository; für automatisierte visuelle Vergleiche müssen die Referenz-Crops gesondert versioniert werden.

## Visuelle Leitlinie
- Ein konsistenter realistischer, hochwertiger Editorial-Food-Fotografie-Stil über den gesamten Katalog.
- Quadratisches Bildformat 1:1. Einzelmotiv pro Datei, niemals Kontaktbogen.
- Ein vollständig sichtbarer schlichter matter creme-/beigefarbener Keramikteller oder eine passende Schüssel, zentriert.
- Teller bei Tellergerichten ungefähr 60–75 % der Bildbreite; rundum mindestens 10 % Sicherheitsabstand. Keine engen Crops.
- Perspektive leicht von oben, typischerweise 50–70°; geringe Abweichung nur, wenn das Gericht es erfordert.
- Warme, sehr helle beige/off-white Tischfläche, weiches diffuses natürliches Tageslicht, zurückhaltende natürliche Schatten.
- Hintergrund ruhig, keine aufwendigen Requisiten, kein Besteck, keine Hände, keine Servietten oder zusätzlichen Teller.
- Natürliche, appetitliche Lebensmitteltexturen; keine CGI-, Illustration-, Hochglanz-Werbe- oder übersättigte Optik.
- Gericht bleibt auch als kleine quadratische App-Kachel erkennbar.

## Rezepttreue
- Ausschließlich vorhandene, validierte Rezept-ID mit Zutatenliste und Zubereitungsart bebildern.
- Erkennbare Hauptzutaten und Zubereitungsform müssen der Rezeptdefinition entsprechen.
- Keine nicht aufgeführten Hauptzutaten oder unrealistische Garnitur.
- Alltagstaugliche deutsche Küche, keine inszenierten erfundenen Kombinationen.
- Deutsche Pfannkuchen dünn und gefaltet/gerollt, nicht American-Pancake-Stapel.
- Kein bereits bebildertes Gericht erneut generieren, außer ein Ersatz wurde ausdrücklich beschlossen.

## Technische Abnahme
- Pro Rezept genau eine eigenständig generierte Masterdatei >=1536×1536 px, kein Upscale kleiner Kontaktbogen-Crops.
- Export: WebP 1024×1024 px, sRGB, ohne sichtbare Kompressionsartefakte.
- Datei: `assets/meals/<recipe-id>.webp` (tatsächlicher App-Asset-Pfad vor Integration verifizieren).
- Manifest: recipeId, filename, status, imagePromptVersion, width, height, sha256, referenceStyle, reviewedAt.
- Status: missing -> generated -> reviewed -> approved; nur approved darf die App-Produktionszuordnung ersetzen.
- Prüfen: Bilddatei öffnet, Maße/Format stimmen, Bild- und Rezeptzuordnung korrekt, keine Duplikate, keine visuell identischen Motive, keine Regression bei bestehenden Bildern.
- Keine Änderung an bestehender Einkaufsdemo oder Live-App ohne separaten geprüften PR.

## Abnahme-Checkliste pro Bild
- [ ] Rezept-ID existiert und Bild fehlt tatsächlich oder Austausch ist genehmigt
- [ ] Gericht/Zutaten entsprechen Rezept
- [ ] 1:1 und Teller vollständig mit ausreichendem Rand
- [ ] Perspektive, Keramik, Hintergrund, Licht und Farbtemperatur entsprechen App-Referenz
- [ ] Keine unnötigen Requisiten, Text, Hände, Logos
- [ ] Natürlich und appetitlich, nicht künstlich
- [ ] Master und WebP-Export in echter Auflösung vorhanden
- [ ] Dateiname, Manifest und Hash stimmen
- [ ] Menschliche Sichtprüfung bestanden
- [ ] Keine bestehende App-Funktion beeinträchtigt

**Definition of Done:** Alle Kriterien sind erfüllt, der Bildstatus ist `approved`, und die korrekte Rezeptzuordnung wurde geprüft. Die bloße Generierung ist keine Produktionsfreigabe.
