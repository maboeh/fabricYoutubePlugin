# YouTube to Fabric - Chrome Extension

Eine Chrome-Erweiterung zum Speichern von YouTube-Videos in deinem [Fabric.so](https://fabric.so) Account.

## Features

- **Ein-Klick-Speichern** - Speichere YouTube-Videos direkt in deinen Fabric Inbox
- **Keyboard Shortcut** - `Alt+Shift+F` zum schnellen Speichern
- **Floating Button** - Optionaler Button direkt auf YouTube-Seiten
- **Kontextmenü** - Rechtsklick-Option zum Speichern
- **Video-Metadaten** - Speichert Titel, Channel und Thumbnail automatisch
- **YouTube Shorts** - Unterstützt auch YouTube Shorts

## Installation

### Von GitHub

```bash
git clone https://github.com/maboeh/fabricYoutubePlugin.git
```

### In Chrome laden

1. Öffne Chrome und gehe zu `chrome://extensions/`
2. Aktiviere **Entwicklermodus** (Schalter oben rechts)
3. Klicke auf **Entpackte Erweiterung laden**
4. Wähle den `fabricYoutubePlugin` Ordner aus
5. Fertig! Das Extension-Icon erscheint in der Toolbar

## Einrichtung

### 1. Fabric API Key holen

1. Gehe zu [fabric.so](https://fabric.so) und logge dich ein
2. Öffne **Einstellungen** in der Fabric App
3. Generiere einen neuen **API Key**
4. Kopiere den Key

### 2. API Key in der Extension eingeben

1. Klicke auf das Extension-Icon in Chrome
2. Füge deinen API Key ein
3. Klicke **Anmelden**

Der Key wird lokal gespeichert und für alle zukünftigen Anfragen verwendet.

## Verwendung

### Option 1: Popup
1. Öffne ein YouTube-Video
2. Klicke auf das Extension-Icon
3. Klicke auf **"In Fabric speichern"**

### Option 2: Keyboard Shortcut
- `Alt+Shift+F` - Speichert das aktuelle Video direkt

### Option 3: Floating Button
- Auf YouTube-Seiten erscheint ein "Fabric"-Button zum schnellen Speichern
- Kann in den Einstellungen deaktiviert werden

### Option 4: Kontextmenü
1. Rechtsklick auf einer YouTube-Seite
2. Wähle **"In Fabric speichern"**

## Einstellungen

Rechtsklick auf das Extension-Icon → **Optionen**

| Einstellung | Beschreibung |
|-------------|--------------|
| API Base URL | Standard: `https://api.fabric.so` |
| Bookmark Endpoint | Standard: `/v2/bookmarks` |
| API Key | Dein Fabric API Key |
| Floating-Button | Button auf YouTube anzeigen (an/aus) |
| Benachrichtigungen | Desktop-Notifications (an/aus) |

## Dateistruktur

```
fabricYoutubePlugin/
├── manifest.json          # Chrome Extension Manifest V3
├── background.js          # Service Worker (API, Shortcuts, Context Menu)
├── content.js             # YouTube Content Script (Floating Button)
├── content.css            # Styles für den Floating Button
├── popup.html/js          # Popup Interface
├── options.html/js        # Einstellungsseite
├── shared/
│   └── constants.js       # Gemeinsame Konstanten und Hilfsfunktionen
├── icons/                 # Extension Icons
├── docs/
│   └── ENTWICKLER-HANDBUCH.md  # Ausführliche Entwickler-Dokumentation
└── Fabric API.json        # OpenAPI Spezifikation
```

## Entwicklung

### Änderungen testen

1. Code ändern
2. Gehe zu `chrome://extensions/`
3. Klicke auf das Refresh-Icon bei der Extension

### Debugging

| Komponente | Wie debuggen |
|------------|--------------|
| Background | Klicke auf "Service Worker" in chrome://extensions/ |
| Popup | Rechtsklick auf Popup → Untersuchen |
| Content Script | DevTools auf YouTube öffnen → Console |

### Dokumentation

Siehe [`docs/ENTWICKLER-HANDBUCH.md`](docs/ENTWICKLER-HANDBUCH.md) für eine ausführliche Entwickler-Dokumentation.

## Technologie

- **Manifest V3** - Aktuelle Chrome Extension API
- **ES6 Modules** - Modernes JavaScript
- **Fabric API v2** - POST `/v2/bookmarks` mit X-Api-Key Header

## Fehlerbehebung

### "Ungültiger API Key"
- Überprüfe, ob der API Key korrekt kopiert wurde
- Generiere ggf. einen neuen Key in Fabric

### "Verbindung fehlgeschlagen"
- Prüfe deine Internetverbindung
- Fabric API könnte temporär nicht erreichbar sein

### Keyboard Shortcut funktioniert nicht
- Gehe zu `chrome://extensions/shortcuts`
- Überprüfe, ob `Alt+Shift+F` konfiguriert ist
- Bei Konflikten: Anderen Shortcut wählen

### Floating Button erscheint nicht
- Prüfe die Einstellung in den Extension-Optionen
- Seite neu laden nach Aktivierung

## Lizenz

MIT License

## Autor

Erstellt mit Unterstützung von Claude Code.
