# YouTube to Fabric - Chrome Extension

Eine Chrome-Erweiterung zum Speichern von YouTube-Videos als Link-Notes in deinem [Fabric.so](https://fabric.so) Account.

## Features

- **Ein-Klick-Speichern**: Speichere YouTube-Videos direkt in Fabric
- **Keyboard Shortcut**: `Alt+Shift+F` zum schnellen Speichern
- **Floating Button**: Optionaler Button direkt auf YouTube-Seiten
- **Kontextmenü**: Rechtsklick-Option zum Speichern
- **Video-Metadaten**: Speichert Titel, Channel, Thumbnail automatisch

## Installation

### 1. Extension herunterladen

```bash
git clone <repository-url>
cd fabricYoutubePlugin
```

### 2. Icons generieren (optional)

```bash
node generate-icons.js
```

Oder öffne `icons/create-icons.html` im Browser für bessere Icons.

### 3. In Chrome laden

1. Öffne Chrome und gehe zu `chrome://extensions/`
2. Aktiviere **Entwicklermodus** (oben rechts)
3. Klicke auf **Entpackte Erweiterung laden**
4. Wähle den `fabricYoutubePlugin` Ordner aus

## Konfiguration

### API-Einstellungen

1. Klicke mit Rechtsklick auf das Extension-Icon
2. Wähle **Optionen** oder gehe zu `chrome://extensions/` und klicke auf "Details" > "Erweiterungsoptionen"
3. Konfiguriere:
   - **API Base URL**: Die Basis-URL der Fabric API
   - **Endpoint**: Der API-Endpoint zum Erstellen von Links
   - **API Token**: Dein Fabric API Token/Key
   - **Authentifizierung**: Bearer Token, API Key, oder Cookie-basiert

### API Token finden

1. Öffne [fabric.so](https://fabric.so) und logge dich ein
2. Öffne die Entwicklertools (`F12` oder Rechtsklick > Untersuchen)
3. Gehe zum Tab "Network" (Netzwerk)
4. Führe eine Aktion aus (z.B. speichere einen Link)
5. Klicke auf eine API-Anfrage und suche in den Headers nach:
   - `Authorization: Bearer <token>`
   - oder `X-API-Key: <key>`

## Verwendung

### Popup

1. Öffne ein YouTube-Video
2. Klicke auf das Extension-Icon
3. Klicke auf **"In Fabric speichern"**

### Keyboard Shortcut

- `Alt+Shift+F` - Speichert das aktuelle Video direkt

### Kontextmenü

1. Rechtsklick auf einer YouTube-Seite
2. Wähle **"In Fabric speichern"**

### Floating Button

Auf YouTube-Seiten erscheint ein schwebendes "Fabric"-Button zum schnellen Speichern.

## Dateistruktur

```
fabricYoutubePlugin/
├── manifest.json        # Chrome Extension Konfiguration
├── popup.html          # Popup UI
├── popup.css           # Popup Styles
├── popup.js            # Popup Logik
├── options.html        # Einstellungs-Seite
├── options.js          # Einstellungs-Logik
├── background.js       # Service Worker
├── content.js          # YouTube Content Script
├── content.css         # YouTube Styles
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Fehlerbehebung

### "API nicht erreichbar"

- Überprüfe die API-Einstellungen in den Optionen
- Stelle sicher, dass du bei fabric.so eingeloggt bist
- Prüfe, ob dein API Token noch gültig ist

### "Nicht angemeldet"

- Öffne die Extension-Optionen und gib deinen API Token ein
- Alternativ: Logge dich bei fabric.so im Browser ein (für Cookie-basierte Auth)

### Keyboard Shortcut funktioniert nicht

- Gehe zu `chrome://extensions/shortcuts`
- Überprüfe, ob `Alt+Shift+F` für "YouTube to Fabric" konfiguriert ist

## Entwicklung

### Änderungen testen

1. Mache Änderungen am Code
2. Gehe zu `chrome://extensions/`
3. Klicke auf das Refresh-Icon bei der Extension

### Debugging

- Background Script: Klicke auf "Service Worker" Link in chrome://extensions/
- Popup: Rechtsklick auf Popup > Untersuchen
- Content Script: Developer Tools auf YouTube öffnen

## Lizenz

MIT License
