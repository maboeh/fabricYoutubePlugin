# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projektbeschreibung

Chrome-Extension (Manifest V3) zum Speichern von YouTube-Videos als Bookmarks in Fabric.so. Keine Build-Tools oder Paketmanager erforderlich - ES6 Module.

## Entwicklung

### Extension laden
1. `chrome://extensions/` öffnen
2. Entwicklermodus aktivieren
3. "Entpackte Erweiterung laden" → diesen Ordner wählen

### Nach Änderungen
- Extension in `chrome://extensions/` über das Refresh-Icon neu laden
- Service Worker Logs: "Service Worker" Link in chrome://extensions/ klicken
- Content Script Logs: DevTools auf YouTube öffnen
- Popup Logs: Rechtsklick auf Popup → Untersuchen

## Architektur

```
┌─────────────┐     chrome.runtime.sendMessage     ┌──────────────┐
│   popup.js  │ ◄────────────────────────────────► │ background.js│
│  (Module)   │                                    │  (Module)    │
└─────────────┘                                    └──────────────┘
       │                                                  │
       │              shared/constants.js                 │
       └──────────────────────┬───────────────────────────┘
                              │
                              │ chrome.tabs.sendMessage
                              ▼
                       ┌──────────────┐
                       │  content.js  │ (kein Module - Content Script)
                       │  (YouTube)   │
                       └──────────────┘
```

### Hauptkomponenten

**shared/constants.js** - Gemeinsame Konstanten und Hilfsfunktionen
- `STORAGE_KEYS` - Chrome Storage Schlüssel
- `DEFAULT_CONFIG` - API-Konfiguration
- `isYouTubeVideoUrl()`, `extractVideoId()`, `getThumbnailUrl()`

**background.js** - Service Worker (ES6 Module)
- Keyboard Shortcut Handler (`Alt+Shift+F`)
- Kontextmenü-Erstellung und -Handling
- Fabric API Aufrufe
- Chrome Notifications (respektiert User-Settings)

**content.js** - Content Script (nur YouTube, KEIN Module)
- Video-Metadaten aus DOM extrahieren (Titel, Channel, Thumbnail)
- Floating "Fabric"-Button (respektiert User-Settings)
- MutationObserver für YouTube SPA-Navigation

**popup.js** - Extension Popup (ES6 Module)
- API-Key Verwaltung
- Aktuelles Video anzeigen und speichern
- Fallback: URL kopieren + Fabric öffnen

**options.js** - Einstellungsseite (ES6 Module)
- API-Konfiguration
- Verbindungstest via `/v2/user/me`
- Feature-Toggles

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

## Storage-Keys (chrome.storage.local)

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

- Content Scripts können keine ES6 Module importieren — `content.js` ist eigenständig und nutzt `chrome.*` direkt. Bei Einführung eines Cross-Browser-Polyfills muss `content.js` manuell angepasst werden.
- Service Worker hat keinen Zugriff auf `navigator.clipboard` — nutzt `chrome.scripting.executeScript`
- YouTube ist eine SPA — MutationObserver für Navigation-Erkennung erforderlich
- DNR-Regel (`rules.json`) entfernt den `Origin`-Header bei Requests an `api.fabric.so` — bewusster Workaround für CORS-Einschränkungen der Fabric API. Chrome nutzt `urlFilter` (performanter), Safari benötigt `regexFilter`.
- API-Strings (Titel, Channel, Beschreibung) werden vor dem Versand über `sanitizeText()` bereinigt
- `validateApiKey()` behandelt HTTP 500 als "gültig mit Warning" — die Fabric API gibt gelegentlich 500 bei gültigen Keys zurück

## Known Limitations

- **Keyboard Shortcut `Alt+Shift+F`**: Kann mit Browser- oder OS-Shortcuts kollidieren. In Chrome unter `chrome://extensions/shortcuts` änderbar, in Safari fest.
- **Duplikat-Erkennung**: Nicht implementiert — Fabric API v2 bietet keinen "Search by URL"-Endpoint.
- **Content Script `chrome.*` API**: Nutzt direkt `chrome.*` statt eines Polyfills. Bei Safari-Portierung muss dies auf `browser.*` angepasst werden (oder ein Inline-Polyfill eingebaut werden).
- **Playlist-Scraping**: Nur aktuell geladene Videos werden erkannt. YouTube lädt Playlists lazy — User muss scrollen, um mehr Videos zu laden.
