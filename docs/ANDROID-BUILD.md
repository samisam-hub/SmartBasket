# SmartBasket: GitHub und Android-APK

## Repository

- Eigenes privates Repository: https://github.com/samisam-hub/SmartBasket
- Lokaler Entwicklungsordner: `C:\Users\Samaana Zakharova\Desktop\SmartBasket`
- Hauptbranch: `main`; Remote: `origin`.
- Die vorhandene App mit Mock-Daten läuft ohne Backend und ohne Expo-Konto.
- `package-lock.json` wird eingecheckt; CI installiert mit `npm ci`.
- `android/` und `ios/` werden aus Expo erzeugt und nicht eingecheckt.
- `.env`, Signaturschlüssel, APKs, Abhängigkeiten und Build-Ausgaben sind ignoriert.

Erneut auf einem anderen Rechner einrichten:

```powershell
git clone https://github.com/samisam-hub/SmartBasket.git
cd SmartBasket
npm ci
npm start
```

Änderungen mit `git add`, `git commit` und `git push origin main` hochladen.
Ein Push auf `main` startet den APK-Build automatisch. GitHub Actions muss im
Repository erlaubt sein; bei ausgeschöpftem Actions-Kontingent kann GitHub den
Build blockieren. Es wurde kein kostenpflichtiges Zusatzprodukt eingerichtet.

## Workflow-Dateien

### `.github/workflows/build-android.yml` — Build Android APK

Startet bei Push auf `main` oder manuell über **Actions → Build Android APK →
Run workflow → main → Run workflow**. Ablauf:

1. Ubuntu 24.04, Node 24, `npm ci`, TypeScript, ESLint und Expo-Versionsprüfung.
2. Java 17 und Android SDK, npm- und Gradle-Cache.
3. `expo prebuild --platform android --clean --no-install` erzeugt das native Projekt.
4. `scripts/build-android.sh` prüft die vier Signierungs-Secrets und baut mit
   Gradle `:app:assembleRelease`. Es gibt keinen Fallback auf einen Debug-Schlüssel.
5. APK-Signatur, Paketname und Versionscode prüfen; APK und SHA-256-Prüfsumme hochladen.

Die APK enthält JavaScript und Assets und braucht weder Expo Go noch einen
laufenden Entwicklungsserver. Sie unterstützt ARM64-Geräte und x86_64-Emulatoren.
32-Bit-Geräte sind nicht enthalten. Die Mindestversion kommt aus Expo SDK 54
(Android 7 / API 24); Health Twins erzwungene API 26 wurde nicht übernommen.

`app.config.js` ergänzt `app.json` um `android.versionCode` aus
`ANDROID_VERSION_CODE = github.run_number`. Lokal ist der Standardwert 1.
Eine neue Ausführung erhält eine höhere Nummer; ein Re-run desselben Laufs
behält seine Nummer. Beim späteren Umbenennen/Ersetzen des Workflows muss der
Versionscode weiter oberhalb bereits verteilter Versionen liegen.

### `.github/workflows/ci.yml` — Pull request checks

Prüft Pull Requests nach `main`: Installation, TypeScript, ESLint, Expo-Versionen
und Android-JavaScript-Export. Dieser Workflow benötigt keine Signierungs-Secrets.
Signierte APKs entstehen erst nach dem Merge/Push oder einem manuellen Build.

## Benötigte Secrets

Unter **Settings → Secrets and variables → Actions → Repository secrets**:

| Name | Inhalt |
| --- | --- |
| `KEYSTORE_BASE64` | Vollständiger SmartBasket-JKS-Schlüssel als Base64 |
| `KEYSTORE_PASSWORD` | Passwort dieses Keystores |
| `KEY_ALIAS` | `smartbasket` |
| `KEY_PASSWORD` | Passwort des privaten Schlüssels |

SmartBasket erhält einen eigenen Schlüssel. Health Twins Schlüssel und Secrets
werden nicht benutzt. Alle vier Werte müssen gesetzt sein; sonst schlägt der
Build mit einer verständlichen Meldung fehl. Das automatisch bereitgestellte
`GITHUB_TOKEN` hat nur `contents: read`; Artifact-Upload braucht kein eigenes PAT.
`EXPO_TOKEN`, EAS-Projekt und EAS-Abonnement sind nicht erforderlich.
Backend-Secrets sind für den derzeitigen Mock-Daten-MVP nicht erforderlich.

Die lokale Sicherung liegt außerhalb des Repositorys in
`C:\Users\Samaana Zakharova\Documents\Codex\SmartBasket-Signing-Backup`.
`smartbasket.jks` ist der Schlüssel, `password.dpapi` enthält das mit Windows DPAPI
für das aktuelle Benutzerkonto verschlüsselte Passwort. Zusätzlich enthält
`README.txt` die Wiederherstellungsschritte. Diese Sicherung separat sichern;
DPAPI ist an das Windows-Benutzerprofil gebunden. Vor einem Rechnerwechsel den
Schlüssel samt Passwort in einen geeigneten Passwortmanager übernehmen.
Ein anderer Schlüssel verhindert Updates über eine bereits installierte APK.

Für eine spätere Neueinrichtung per GitHub CLI (angemeldet mit `gh auth login`):

```powershell
$signingDir = 'C:\Users\Samaana Zakharova\Documents\Codex\SmartBasket-Signing-Backup'
$securePassword = (Get-Content "$signingDir\password.dpapi" -Raw).Trim() | ConvertTo-SecureString
$plainPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$signingDir\smartbasket.jks")) | gh secret set KEYSTORE_BASE64 --repo samisam-hub/SmartBasket
$plainPassword | gh secret set KEYSTORE_PASSWORD --repo samisam-hub/SmartBasket
'smartbasket' | gh secret set KEY_ALIAS --repo samisam-hub/SmartBasket
$plainPassword | gh secret set KEY_PASSWORD --repo samisam-hub/SmartBasket
Remove-Variable plainPassword, securePassword
```

Secrets nie in Repository-Dateien oder Build-Logs ausgeben. Der temporäre
Keystore im Runner wird nach dem Build auch bei Fehlern entfernt.

## APK herunterladen und installieren

1. https://github.com/samisam-hub/SmartBasket/actions öffnen und anmelden.
2. Einen erfolgreichen Lauf von **Build Android APK** auswählen.
3. Unten bei **Artifacts** auf **SmartBasket-APK-N** klicken.
4. ZIP entpacken; darin liegen `SmartBasket-0.1.0-build-N.apk` und `SHA256SUMS.txt`.
5. APK aufs Android-Gerät übertragen, öffnen und die Installation aus dieser
   Quelle bei Nachfrage erlauben. SmartBasket erscheint als eigene App.

Artifacts bleiben 14 Tage verfügbar. Danach einen neuen Build starten.
Alternativ mit GitHub CLI:

```powershell
gh run list --repo samisam-hub/SmartBasket --workflow build-android.yml
gh run download RUN_ID --repo samisam-hub/SmartBasket --dir apk-download
```

## Vergleich mit Health Twin

Nur gelesen: `Execution-Spec-Builder/.github/workflows/build-android-manual.yml`
und `release-android.yml`.

| Muster | Entscheidung für SmartBasket |
| --- | --- |
| Expo Prebuild → Java 17 / Android SDK → Gradle Release | Übernommen |
| Eigene Keystore-Signierung und laufende Buildnummer | Übernommen, mit eigenem Alias/Schlüssel und Config-Validierung |
| Manueller Start und APK als Artifact | Übernommen, zusätzlich automatischer Start auf `main` |
| pnpm-Monorepo, Babel-Symlink, NODE_PATH-Umwege | Entfallen: eigenständiges npm-Projekt |
| Alte Node-20-Konfiguration | Node 24 passend zu SmartBasket |
| Viele übersprungene Gradle-/Duplikatprüfungen | Nicht übernommen |
| Health-Twin-Backend und API-26-Override | Nicht übernommen |
| Tags/Releases und Play-Store-AAB | Für den angeforderten APK-MVP nicht nötig |

Alle verwendeten Actions sind auf überprüfte Commit-SHAs festgelegt. Die
App-Abhängigkeiten und Health Twin bleiben unverändert. Insbesondere wurde die
bereits vorhandene lokale Änderung in Health Twins `pnpm-lock.yaml` nicht bearbeitet.

## Prüfung und Grenzen

Der entscheidende Nachweis ist ein erfolgreicher GitHub-Lauf einschließlich
`apksigner verify` und herunterladbarem Artifact. Die Installation und Bedienung
auf einem echten Android-Gerät muss separat geprüft werden: alle Tabs öffnen,
Produkte suchen, Suche leeren, Basket-Setup öffnen und Zurück-Navigation testen.
Die vorhandenen SDK-54-Abhängigkeitswarnungen sind weiterhin in der README erfasst.

Referenzen: [Expo: lokale Release-Builds](https://docs.expo.dev/guides/local-app-production/),
[GitHub: Workflow-Artifacts herunterladen](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/downloading-workflow-artifacts),
[GitHub: upload-artifact](https://github.com/actions/upload-artifact).

### Erster nachgewiesener APK-Build

- Lauf: https://github.com/samisam-hub/SmartBasket/actions/runs/33996350944
- Build-Commit: `9fb5eb3`; nachfolgende Änderungen betreffen nur diese Anleitung.
- Artifact: `SmartBasket-APK-1`, APK: `SmartBasket-0.1.0-build-1.apk` (42.292.866 Bytes).
- Gradle-Release-Build, Signaturprüfung und Artifact-Upload erfolgreich.
- Heruntergeladene APK erneut lokal mit `apksigner` geprüft; Zertifikat entspricht
  dem gesicherten eigenen SmartBasket-Schlüssel, nicht dem Expo-Debug-Schlüssel.
- Paket `com.smartbasket.app`, Version `0.1.0`, Versionscode `1`, minSdk `24`,
  targetSdk `36`, Architekturen `arm64-v8a` und `x86_64` bestätigt.
- APK-SHA-256: `40e102ac7ff6a10d459901f585900262c24926e3a86648024f99d712643d8ed4`.
- Zertifikat-SHA-256: `f75b6ad0bdd56a6af6f6b24daa015fe4703eb7d040ba47e25b36cddf8925c45d`.
- Windows-DPAPI-Wiederherstellung der Schlüsselsicherung erfolgreich getestet.
- Kein Installationstest auf einem physischen Android-Gerät durchgeführt.

Hinweis zum vorhandenen lokalen Ordner: Dessen Besitzer ist noch das
Codex-Sandboxkonto. Git kann deshalb unter dem normalen Windows-Konto einen
Eigentumsfehler melden. Die Änderung des Besitzers wurde von der automatischen
Freigabeprüfung zurückgehalten und ist ohne ausdrückliche Zustimmung nicht
vorgenommen worden. Das GitHub-Repository und die APK-Builds sind davon unabhängig.
