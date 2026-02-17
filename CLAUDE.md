# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projektbeschreibung

Cross-Browser Extension (Manifest V3) zum Speichern von YouTube-Videos als Bookmarks in Fabric.so. Unterstützt Chrome und Safari (macOS). Keine Build-Tools oder Paketmanager erforderlich - ES6 Module mit einfachen Shell-Scripts für Builds.

## Projektstruktur

```
fabricYoutubePlugin/
├── src/                    ← Gemeinsamer Quellcode (Chrome + Safari)
│   ├── background.js       ← Service Worker (ES6 Module)
│   ├── content.js          ← Content Script (kein Module, IIFE)
│   ├── popup.js/html/css   ← Extension Popup
│   ├── options.js/html     ← Einstellungsseite
│   ├── manifest.json       ← Chrome-Manifest (für direktes Laden aus src/)
│   ├── rules.json          ← Chrome DNR-Regeln
│   ├── shared/
│   │   ├── browser-api.js  ← Cross-Browser Polyfill (chrome.* / browser.*)
│   │   └── constants.js    ← Gemeinsame Konstanten
│   └── icons/
├── platforms/
│   ├── chrome/             ← Chrome-spezifisches Manifest + Rules
│   └── safari/             ← Safari-spezifisches Manifest + Rules
├── safari-app/             ← Xcode-Projekt (generiert)
├── scripts/
│   ├── build-chrome.sh     ← Build → dist/chrome/
│   └── build-safari.sh     ← Build → dist/safari/ + Xcode-Sync
└── dist/                   ← Build-Ausgabe (gitignored)
```

## Entwicklung

### Chrome Extension laden
1. `chrome://extensions/` öffnen, Entwicklermodus aktivieren
2. "Entpackte Erweiterung laden" → `src/` Ordner wählen
3. Nach Änderungen: Refresh-Icon in chrome://extensions/ klicken

### Safari Extension laden
1. `npm run build:safari` oder `bash scripts/build-safari.sh`
2. `npm run xcode` oder Xcode-Projekt in `safari-app/` öffnen
3. `Cmd+R` → App starten → Extension in Safari aktivieren (Einstellungen > Erweiterungen)

### Build-Commands
- `npm run build:chrome` – Chrome-Build nach dist/chrome/
- `npm run build:safari` – Safari-Build nach dist/safari/ + Xcode-Sync
- `npm run build` – Beide Builds
- `npm run xcode` – Xcode-Projekt öffnen

### Debugging
- Chrome Service Worker: "Service Worker" Link in chrome://extensions/
- Chrome Content Script: DevTools auf YouTube öffnen
- Chrome Popup: Rechtsklick auf Popup → Untersuchen
- Safari Extension: Entwickler > Web Extension Hintergrundinhalt
- Safari Content Script: Entwickler > YouTube > Web Inspector

## Architektur

```
┌─────────────┐     api.runtime.sendMessage      ┌──────────────┐
│   popup.js  │ ◄────────────────────────────────► │ background.js│
│  (Module)   │                                    │  (Module)    │
└─────────────┘                                    └──────────────┘
       │                                                  │
       │    shared/browser-api.js + shared/constants.js   │
       └──────────────────────┬───────────────────────────┘
                              │
                              │ api.tabs.sendMessage
                              ▼
                       ┌──────────────┐
                       │  content.js  │ (kein Module - Content Script)
                       │  (YouTube)   │ (Inline-Polyfill: const api = ...)
                       └──────────────┘
```

### Browser-API-Kompatibilität

Alle JS-Dateien nutzen `api.*` statt `chrome.*`. Der Polyfill in `shared/browser-api.js` löst automatisch auf:
- **Chrome**: `api` = `chrome` (da `browser` undefined)
- **Safari**: `api` = `browser` (W3C WebExtensions Standard)

`content.js` kann keine ES6-Module importieren und enthält den Polyfill inline.

### Hauptkomponenten

**shared/browser-api.js** - Cross-Browser API Polyfill
- `export const api` – Einheitlicher Namespace für Chrome/Safari

**shared/constants.js** - Gemeinsame Konstanten und Hilfsfunktionen
- `STORAGE_KEYS` - Storage Schlüssel
- `DEFAULT_CONFIG` - API-Konfiguration
- `getStorage()`, `setStorage()`, `removeStorage()` - Storage-Helpers mit lastError-Checks
- `getStoredCredentials()` - Credentials aus Storage laden
- `sanitizeText()` - Input-Sanitierung für API-Strings
- `isYouTubeVideoUrl()`, `extractVideoId()`, `getThumbnailUrl()`

**background.js** - Service Worker (ES6 Module)
- Keyboard Shortcut Handler (`Alt+Shift+F`)
- Kontextmenü mit Safari-Bug-Workaround (onStartup-Recreation)
- Fabric API Aufrufe mit Retry-Logik
- Notifications mit Graceful Degradation
- Clipboard mit execCommand-Fallback
- Settings-Cache mit 30s TTL + onChanged-Invalidierung

**content.js** - Content Script (nur YouTube, KEIN Module)
- Video-Metadaten aus DOM extrahieren (Titel, Channel, Thumbnail)
- Floating "Fabric"-Button (respektiert User-Settings)
- MutationObserver für YouTube SPA-Navigation
- Sendet `saveFromContentScript` mit videoInfo direkt (vermeidet Race Condition)

**popup.js** - Extension Popup (ES6 Module)
- API-Key Verwaltung und Validierung
- Video/Playlist anzeigen und speichern
- Custom Tags und Notizen
- Playlist-Fortschrittsbalken mit Circuit Breaker

**options.js** - Einstellungsseite (ES6 Module)
- API-Konfiguration und Verbindungstest (via Background-Script)
- Feature-Toggles
- Konfigurierbarer Ziel-Ordner

### Plattform-Unterschiede

| Feature | Chrome | Safari |
|---------|--------|--------|
| DNR-Regel | urlFilter | regexFilter |
| Kontextmenü | Stabil | Bug: Verschwindet nach Neustart |
| Notifications | Voll unterstützt | Eingeschränkt, try/catch |
| Clipboard | navigator.clipboard | + execCommand Fallback |
| Keyboard Shortcuts | User-anpassbar | Fest (Alt+Shift+F) |

## Fabric API v2

**Base URL**: `https://api.fabric.so`

**Authentifizierung**: `X-Api-Key` Header (in Fabric App unter Settings generierbar)

### Bookmark erstellen
```
POST /v2/bookmarks
Content-Type: application/json
X-Api-Key: <api-key>

{
  "url": "https://youtube.com/watch?v=...",
  "parentId": "@alias::inbox",
  "name": "Video Titel",
  "tags": [{ "name": "YouTube" }],
  "comment": { "content": "Channel: ..." }
}
```

### Weitere Endpoints
- `GET /v2/user/me` - Benutzerinfo (für Verbindungstest)
- `POST /v2/files` - Datei hochladen
- `POST /v2/notepads` - Notiz erstellen
- `GET /v2/tags` - Tags abrufen

## Storage-Keys (api.storage.local)

| Key | Beschreibung |
|-----|--------------|
| `fabricApiKey` | API Key |
| `fabricApiBaseUrl` | API URL (default: https://api.fabric.so) |
| `fabricApiEndpoint` | Endpoint (default: /v2/bookmarks) |
| `fabricAuthType` | apikey \| oauth2 |
| `fabricDefaultParentId` | Ziel-Ordner (default: @alias::inbox) |
| `fabricShowFloatingButton` | Floating Button anzeigen |
| `fabricShowNotifications` | Notifications anzeigen |
| `fabricAutoCopyUrl` | URL automatisch kopieren |

## Hinweise

- Content Scripts können keine ES6 Module importieren — `content.js` ist eigenständig und enthält einen Inline-Polyfill. Bei Änderungen an `shared/browser-api.js` muss `content.js` manuell angepasst werden.
- Service Worker hat keinen Zugriff auf `navigator.clipboard` — nutzt `api.scripting.executeScript`
- YouTube ist eine SPA — MutationObserver für Navigation-Erkennung erforderlich
- DNR-Regel (`rules.json`) entfernt den `Origin`-Header bei Requests an `api.fabric.so` — bewusster Workaround für CORS-Einschränkungen der Fabric API. Chrome nutzt `urlFilter` (performanter), Safari benötigt `regexFilter`.
- API-Strings (Titel, Channel, Beschreibung) werden vor dem Versand über `sanitizeText()` bereinigt
- `validateApiKey()` behandelt HTTP 500 als "gültig mit Warning" — die Fabric API gibt gelegentlich 500 bei gültigen Keys zurück
- Safari Extension benötigt Xcode-Projekt als App-Container
- `safari-web-extension-converter` zum Regenerieren: `xcrun safari-web-extension-converter dist/safari/ --app-name "YouTube to Fabric" --bundle-identifier "com.maboeh.youtube-to-fabric" --swift --macos-only --copy-resources --project-location safari-app/ --no-open`

## Known Limitations

- **Keyboard Shortcut `Alt+Shift+F`**: Kann mit Browser- oder OS-Shortcuts kollidieren. In Chrome unter `chrome://extensions/shortcuts` änderbar, in Safari fest.
- **Duplikat-Erkennung**: Nicht implementiert — Fabric API v2 bietet keinen "Search by URL"-Endpoint.
- **Content Script `chrome.*` API**: Nutzt aktuell direkt `chrome.*` statt des Polyfills. Bei Safari-Portierung muss dies auf `browser.*` angepasst werden (oder ein Inline-Polyfill eingebaut werden).
- **Playlist-Scraping**: Nur aktuell geladene Videos werden erkannt. YouTube lädt Playlists lazy — User muss scrollen, um mehr Videos zu laden.
