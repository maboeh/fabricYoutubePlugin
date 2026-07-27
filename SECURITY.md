# Sicherheit

## API-Keys und Credentials

Diese Extension speichert deinen **Fabric API Key nur lokal** im Browser (`chrome.storage.local`). Der Key wird **nicht** an GitHub, an Dritte oder an andere Nutzer übertragen.

### Für Nutzer

- Trage deinen API Key **nur** in der Extension (Popup oder Einstellungsseite) ein.
- Teile deinen Key **nicht** in Issues, Pull Requests, Screenshots oder Chat-Nachrichten.
- Wenn du vermutest, dass dein Key kompromittiert wurde: Key in [Fabric](https://fabric.so) widerrufen und einen neuen generieren.

### Für Entwickler und Mitwirkende

- **Niemals** echte API-Keys, Tokens oder Passwörter in den Quellcode, Tests, Commits oder die Git-Historie einchecken.
- Nutze für lokale Konfiguration eine `.env`-Datei (ist in `.gitignore` eingetragen) oder die Extension-Einstellungen im Browser.
- In Tests und Dokumentation nur offensichtliche Platzhalter verwenden (z. B. `test-api-key`, `dummy-key`).
- Vor dem Push: keine Keys in `dist/`, Playwright-Reports oder Debug-Logs committen.

## Meldung von Sicherheitsproblemen

Wenn du eine Sicherheitslücke findest, öffne **kein** öffentliches Issue mit sensiblen Details. Melde das Problem stattdessen privat an den Repository-Betreiber (z. B. per GitHub Security Advisory oder direkte Kontaktaufnahme mit dem Maintainer).

## Automatische Prüfungen

Die CI-Pipeline führt einen Secret-Scan (Gitleaks) aus, um versehentlich committete Credentials früh zu erkennen.
