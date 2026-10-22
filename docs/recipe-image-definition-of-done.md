# SmartBasket Recipe Photography – Definition of Done v1.1

**Status:** verbindliche Produktionsvorgabe für neu generierte Rezeptbilder.
**Referenzen:** zwei vom Product Owner am 2026-10-23 bereitgestellte App-Screenshots mit „Egg and chicken-ham toast“ und „Smoked salmon and soft egg toast“. Die Screenshots sind im Chat, nicht im Repository; für automatisierte visuelle Vergleiche müssen die Referenz-Crops gesondert versioniert werden.

## Visuelle Leitlinie
- Ein konsistenter realistischer, hochwertiger Editorial-Food-Fotografie-Stil über den gesamten Katalog.
- Quadratisches Bildformat 1:1. Einzelmotiv pro Datei, niemals Kontaktbogen.
- Ein vollständig sichtbarer, runder, matter Keramikteller in hellem warmem Greige/Steingut-Beige (nicht reinweiß), mit flachem breitem Rand und sehr dezenter handwerklicher Textur; bei passenden Speisen eine entsprechend schlichte Schüssel. Zentrierte Anordnung.
- Teller bei Tellergerichten ungefähr 60–75 % der Bildbreite; rundum mindestens 10 % Sicherheitsabstand. Keine engen Crops.
- Perspektive leicht von oben, typischerweise 50–70°; geringe Abweichung nur, wenn das Gericht es erfordert.
- **Tischoberfläche ausdrücklich weiß bis warmweiß**, glatt und durchgehend, ohne erkennbare Maserung, Tischdecke, Muster oder Studioverlauf. Sie wirkt wie ein echter weißer Tisch, nicht wie ein beiges Fotostudio-Backdrop. Weiches diffuses natürliches Tageslicht, zarte warme Kontaktschatten.
- Die sichtbare Umgebung ist die **weiße Tischplatte** und kein abstrakter leerer Hintergrund. Keine zusätzlichen Gegenstände: kein Besteck, keine Hände, keine Servietten, keine Deko oder zweiten Teller. Das Gericht darf durch seine echten Zutaten natürliche Struktur zeigen.
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
