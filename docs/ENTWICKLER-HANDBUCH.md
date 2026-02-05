# YouTube to Fabric Extension - Entwickler-Handbuch

> **Für wen ist dieses Handbuch?**
> Dieses Handbuch richtet sich an Junior-Entwickler, die verstehen möchten, wie eine Chrome Extension funktioniert. Wir erklären jeden Schritt im Detail mit Analogien und Beispielen.

---

## Inhaltsverzeichnis

1. [Was ist eine Chrome Extension?](#1-was-ist-eine-chrome-extension)
2. [Die Architektur verstehen](#2-die-architektur-verstehen)
3. [Die Dateien im Überblick](#3-die-dateien-im-überblick)
4. [manifest.json - Das Herzstück](#4-manifestjson---das-herzstück)
5. [background.js - Der unsichtbare Helfer](#5-backgroundjs---der-unsichtbare-helfer)
6. [content.js - Der DOM-Manipulator](#6-contentjs---der-dom-manipulator)
7. [popup.js - Die Benutzeroberfläche](#7-popupjs---die-benutzeroberfläche)
8. [options.js - Die Einstellungen](#8-optionsjs---die-einstellungen)
9. [shared/constants.js - Gemeinsamer Code](#9-sharedconstantsjs---gemeinsamer-code)
10. [Die Kommunikation zwischen den Teilen](#10-die-kommunikation-zwischen-den-teilen)
11. [Die Fabric API verstehen](#11-die-fabric-api-verstehen)
12. [Debugging und Fehlerbehebung](#12-debugging-und-fehlerbehebung)
13. [Häufige Fehler und Lösungen](#13-häufige-fehler-und-lösungen)

---

## 1. Was ist eine Chrome Extension?

### Die Analogie: Ein Schweizer Taschenmesser für den Browser

Stell dir vor, dein Chrome Browser ist wie ein Smartphone. Chrome Extensions sind wie Apps, die du installierst, um neue Funktionen hinzuzufügen.

Unsere Extension ist wie ein "Speichern"-Button, der auf YouTube erscheint und Videos direkt in deine Fabric.so Notizen speichert.

### Was kann eine Extension?

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension kann:                    │
├─────────────────────────────────────────────────────────────┤
│ ✓ Webseiten-Inhalt lesen und verändern (Content Scripts)    │
│ ✓ Eigene Buttons und UI-Elemente einblenden                 │
│ ✓ Im Hintergrund arbeiten (Service Worker)                  │
│ ✓ Daten lokal speichern (Chrome Storage)                    │
│ ✓ Mit externen APIs kommunizieren (fetch)                   │
│ ✓ Tastatur-Shortcuts registrieren                           │
│ ✓ Kontextmenüs hinzufügen (Rechtsklick)                     │
│ ✓ Benachrichtigungen anzeigen                               │
└─────────────────────────────────────────────────────────────┘
```

### Manifest V3 - Der neue Standard

Chrome Extensions gibt es in verschiedenen "Versionen". Wir nutzen **Manifest V3** - die neueste und sicherste Version. Der wichtigste Unterschied zu älteren Versionen:

| Manifest V2 (alt) | Manifest V3 (neu) |
|-------------------|-------------------|
| Background Pages (immer aktiv) | Service Worker (schläft wenn nicht gebraucht) |
| Weniger Sicherheit | Mehr Sicherheit |
| Mehr Berechtigungen | Minimale Berechtigungen |

---

## 2. Die Architektur verstehen

### Die Analogie: Ein Restaurant

Stell dir eine Chrome Extension wie ein Restaurant vor:

```
┌─────────────────────────────────────────────────────────────┐
│                      DAS RESTAURANT                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🍽️ GASTRAUM (YouTube Webseite)                             │
│  │                                                          │
│  │  Der Gast (User) sitzt hier und sieht:                  │
│  │  • Die Webseite (YouTube)                               │
│  │  • Den "Fabric" Button (von content.js eingefügt)       │
│  │                                                          │
│  └──────────────────────────────────────────────────────────│
│                           │                                  │
│                           │ Bestellung                       │
│                           ▼                                  │
│  👨‍🍳 KÜCHE (background.js / Service Worker)                  │
│  │                                                          │
│  │  Der Koch arbeitet unsichtbar im Hintergrund:           │
│  │  • Nimmt Bestellungen entgegen (Messages)               │
│  │  • Bereitet das Essen zu (API Requests)                 │
│  │  • Gibt Feedback (Notifications)                        │
│  │                                                          │
│  └──────────────────────────────────────────────────────────│
│                           │                                  │
│                           │ Zutaten bestellen               │
│                           ▼                                  │
│  🏭 LIEFERANT (Fabric.so API)                               │
│     • Nimmt Bestellungen entgegen                           │
│     • Speichert die Daten                                   │
│     • Bestätigt den Empfang                                 │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📋 SPEISEKARTE (popup.html/js)                             │
│     • Zeigt dem Gast die Optionen                          │
│     • Ermöglicht schnelles Bestellen                        │
│                                                              │
│  ⚙️ MANAGER-BÜRO (options.html/js)                          │
│     • Hier werden Einstellungen verwaltet                   │
│     • API-Schlüssel, Präferenzen, etc.                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Die echte Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                     CHROME BROWSER                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   YOUTUBE TAB   │  │   POPUP         │                   │
│  │                 │  │   (popup.html)  │                   │
│  │  ┌───────────┐  │  │                 │                   │
│  │  │ content.js│  │  │  ┌───────────┐  │                   │
│  │  │           │  │  │  │ popup.js  │  │                   │
│  │  │ [Fabric]  │  │  │  │           │  │                   │
│  │  │  Button   │  │  │  │ [Save]    │  │                   │
│  │  └─────┬─────┘  │  │  └─────┬─────┘  │                   │
│  └────────┼────────┘  └────────┼────────┘                   │
│           │                    │                             │
│           │    Messages        │                             │
│           └────────┬───────────┘                             │
│                    │                                         │
│                    ▼                                         │
│           ┌─────────────────┐                                │
│           │  background.js  │◄────── Keyboard Shortcuts      │
│           │  (Service       │◄────── Context Menu            │
│           │   Worker)       │                                │
│           └────────┬────────┘                                │
│                    │                                         │
└────────────────────┼─────────────────────────────────────────┘
                     │
                     │ HTTPS Request
                     ▼
            ┌─────────────────┐
            │   FABRIC API    │
            │ api.fabric.so   │
            └─────────────────┘
```

---

## 3. Die Dateien im Überblick

### Verzeichnisstruktur

```
fabricYoutubePlugin/
│
├── manifest.json          # 📋 Konfiguration der Extension
│
├── background.js          # 🔧 Service Worker (Hintergrund-Logik)
│
├── content.js             # 🎨 Läuft auf YouTube (DOM-Manipulation)
├── content.css            # 💅 Styles für den Floating Button
│
├── popup.html             # 🖼️ HTML für das Popup
├── popup.js               # ⚡ Logik für das Popup
├── popup.css              # 💅 Styles für das Popup
│
├── options.html           # ⚙️ HTML für die Einstellungen
├── options.js             # ⚡ Logik für die Einstellungen
│
├── shared/
│   └── constants.js       # 📦 Gemeinsame Konstanten und Funktionen
│
├── icons/                 # 🖼️ Extension Icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
│
└── docs/
    └── ENTWICKLER-HANDBUCH.md  # 📚 Diese Dokumentation
```

### Was macht welche Datei?

| Datei | Zweck | Wann wird sie geladen? |
|-------|-------|------------------------|
| `manifest.json` | Konfiguration | Beim Installieren der Extension |
| `background.js` | Hintergrund-Arbeit | Beim Starten von Chrome |
| `content.js` | YouTube manipulieren | Wenn YouTube geöffnet wird |
| `popup.js` | Popup-Logik | Wenn auf Extension-Icon geklickt |
| `options.js` | Einstellungen | Wenn Optionen geöffnet werden |
| `constants.js` | Gemeinsamer Code | Von anderen JS-Dateien importiert |

---

## 4. manifest.json - Das Herzstück

Die `manifest.json` ist wie ein Personalausweis für die Extension. Sie sagt Chrome:
- Wer bin ich?
- Was darf ich?
- Welche Dateien gehören zu mir?

### Die komplette Datei erklärt

```json
{
  // === IDENTITÄT ===
  "manifest_version": 3,        // Welche Extension-Version (immer 3 für neue)
  "name": "YouTube to Fabric",  // Name im Chrome Web Store
  "description": "Save YouTube videos as link notes to your Fabric.so account",
  "version": "1.0.0",           // Deine Versionsnummer (du bestimmst sie)

  // === BERECHTIGUNGEN ===
  // Das ist wie eine Liste von Schlüsseln, die die Extension braucht
  "permissions": [
    "activeTab",      // Darf den aktuellen Tab lesen
    "storage",        // Darf Daten lokal speichern
    "cookies",        // Darf Cookies lesen (für fabric.so)
    "contextMenus",   // Darf Rechtsklick-Menü erstellen
    "notifications",  // Darf Desktop-Benachrichtigungen zeigen
    "scripting"       // Darf Code in Tabs ausführen
  ],

  // === WELCHE WEBSEITEN DARF DIE EXTENSION BESUCHEN? ===
  "host_permissions": [
    "https://www.youtube.com/*",     // YouTube
    "https://youtube.com/*",         // YouTube ohne www
    "https://fabric.so/*",           // Fabric Webseite
    "https://*.fabric.so/*",         // Alle Fabric Subdomains
    "https://api.fabric.so/*"        // Fabric API
  ],

  // === DER SERVICE WORKER (HINTERGRUND) ===
  "background": {
    "service_worker": "background.js",  // Die Datei
    "type": "module"                    // Erlaubt ES6 imports
  },

  // === CONTENT SCRIPTS (LAUFEN AUF WEBSEITEN) ===
  "content_scripts": [
    {
      "matches": [                      // Auf welchen Seiten?
        "https://www.youtube.com/*",
        "https://youtube.com/*"
      ],
      "js": ["content.js"],             // Diese JS-Datei laden
      "css": ["content.css"]            // Diese CSS-Datei laden
    }
  ],

  // === DAS POPUP (KLICK AUF EXTENSION ICON) ===
  "action": {
    "default_popup": "popup.html",      // Welche HTML-Datei
    "default_icon": {                   // Icons in verschiedenen Größen
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  // === DIE EINSTELLUNGEN-SEITE ===
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true                 // In neuem Tab öffnen
  },

  // === TASTATUR-SHORTCUTS ===
  "commands": {
    "save-to-fabric": {                 // Interner Name
      "suggested_key": {
        "default": "Alt+Shift+F",       // Windows/Linux
        "mac": "Alt+Shift+F"            // Mac
      },
      "description": "Save current YouTube video to Fabric"
    }
  },

  // === ICONS FÜR CHROME WEB STORE ===
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### Berechtigungen im Detail

```
┌─────────────────────────────────────────────────────────────┐
│                    BERECHTIGUNGEN                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  "activeTab"                                                │
│  └── Darf den aktuellen Tab lesen, aber NUR wenn der       │
│      User aktiv mit der Extension interagiert              │
│      (Klick auf Icon, Shortcut, etc.)                      │
│                                                              │
│  "storage"                                                  │
│  └── Darf Daten in chrome.storage.local speichern          │
│      Das ist wie localStorage, aber besser:                │
│      • Synchronisiert über Geräte (mit .sync)              │
│      • Größeres Limit (5MB vs 10MB)                        │
│      • Funktioniert in Service Workers                     │
│                                                              │
│  "cookies"                                                  │
│  └── Darf Cookies von erlaubten Domains lesen              │
│      Wir nutzen das für den Fallback, falls API fehlt      │
│                                                              │
│  "contextMenus"                                             │
│  └── Darf Einträge zum Rechtsklick-Menü hinzufügen         │
│      "In Fabric speichern" erscheint beim Rechtsklick      │
│                                                              │
│  "notifications"                                            │
│  └── Darf Desktop-Benachrichtigungen zeigen                │
│      "Video wurde gespeichert!" als Toast                  │
│                                                              │
│  "scripting"                                                │
│  └── Darf JavaScript in Tabs ausführen                     │
│      Wir nutzen das für die Clipboard-Funktion             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. background.js - Der unsichtbare Helfer

### Was ist ein Service Worker?

Ein Service Worker ist wie ein Mitarbeiter, der im Hintergrund arbeitet:
- Er schläft, wenn er nicht gebraucht wird (spart Ressourcen)
- Er wacht auf, wenn ein Event passiert (Message, Shortcut, etc.)
- Er hat **keinen Zugriff auf das DOM** (kann keine Webseiten verändern)
- Er kann **keine** `window` oder `document` Objekte nutzen

### Die Struktur von background.js

```javascript
// ╔═══════════════════════════════════════════════════════════════╗
// ║                    BACKGROUND.JS STRUKTUR                      ║
// ╚═══════════════════════════════════════════════════════════════╝

// 1. IMPORTS
// ──────────────────────────────────────────────────────────────────
import {
  STORAGE_KEYS,      // Konstanten für Storage-Schlüssel
  DEFAULT_CONFIG,    // Standard-Konfiguration
  isYouTubeVideoUrl, // Hilfsfunktion: Ist das eine YouTube URL?
  extractVideoId     // Hilfsfunktion: Video-ID aus URL extrahieren
} from './shared/constants.js';

// 2. EVENT LISTENER
// ──────────────────────────────────────────────────────────────────
// Der Service Worker reagiert auf Events. Hier sind alle:

chrome.commands.onCommand          // Tastatur-Shortcuts
chrome.runtime.onMessage           // Messages von anderen Scripts
chrome.runtime.onInstalled         // Extension wurde installiert
chrome.contextMenus.onClicked      // Rechtsklick-Menü wurde geklickt

// 3. HAUPTFUNKTIONEN
// ──────────────────────────────────────────────────────────────────
handleSaveShortcut()    // Hauptlogik zum Speichern
getStoredCredentials()  // API-Key aus Storage laden
getStoredSettings()     // Einstellungen aus Storage laden
getStoredConfig()       // API-Konfiguration aus Storage laden
copyToClipboard()       // Text in Zwischenablage kopieren
saveToFabric()          // API-Request an Fabric senden
showNotification()      // Desktop-Benachrichtigung zeigen
```

### Event Listener im Detail

#### 1. Keyboard Shortcut Handler

```javascript
// Wenn der User Alt+Shift+F drückt:
chrome.commands.onCommand.addListener(async (command) => {
  // command = "save-to-fabric" (wie in manifest.json definiert)
  if (command === 'save-to-fabric') {
    await handleSaveShortcut();
  }
});
```

**Was passiert hier?**
1. Chrome erkennt den Shortcut (Alt+Shift+F)
2. Chrome weckt den Service Worker auf
3. Chrome ruft diesen Listener mit `command = "save-to-fabric"` auf
4. Wir rufen unsere Hauptfunktion `handleSaveShortcut()` auf

#### 2. Message Handler

```javascript
// Wenn ein anderer Teil der Extension eine Nachricht sendet:
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // request = die Nachricht, z.B. { action: 'saveToFabric' }
  // sender = wer hat gesendet? (Tab-ID, etc.)
  // sendResponse = Funktion um zu antworten

  if (request.action === 'saveToFabric') {
    handleSaveShortcut()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));

    return true; // WICHTIG! Sagt Chrome: "Warte auf async Antwort"
  }
});
```

**Warum `return true`?**
```
┌─────────────────────────────────────────────────────────────┐
│ OHNE return true:                                           │
│                                                              │
│ content.js ──► sendMessage() ──► background.js              │
│                    │                    │                    │
│                    │                    └──► async Arbeit... │
│                    │                                         │
│                    └──► Timeout! Keine Antwort!             │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ MIT return true:                                            │
│                                                              │
│ content.js ──► sendMessage() ──► background.js              │
│                    │                    │                    │
│                    │                    └──► async Arbeit... │
│                    │                              │          │
│                    │◄─── sendResponse() ◄────────┘          │
│                    │                                         │
│                    └──► Antwort erhalten!                   │
└─────────────────────────────────────────────────────────────┘
```

#### 3. Installation Handler

```javascript
// Wenn die Extension installiert oder aktualisiert wird:
chrome.runtime.onInstalled.addListener(() => {
  // Erstelle das Rechtsklick-Menü
  chrome.contextMenus.create({
    id: 'save-to-fabric',           // Eindeutige ID
    title: 'In Fabric speichern',   // Was der User sieht
    contexts: ['page', 'link'],     // Wann zeigen? (Seite, Link)
    documentUrlPatterns: [          // Nur auf YouTube
      'https://www.youtube.com/*',
      'https://youtube.com/*'
    ]
  });
});
```

### Die Hauptfunktion: handleSaveShortcut()

```javascript
async function handleSaveShortcut() {
  try {
    // ╔═══════════════════════════════════════════════════════════╗
    // ║ SCHRITT 1: Aktiven Tab finden                             ║
    // ╚═══════════════════════════════════════════════════════════╝
    const [tab] = await chrome.tabs.query({
      active: true,       // Nur der aktive Tab
      currentWindow: true // Nur im aktuellen Fenster
    });

    // Prüfe ob wir einen Tab gefunden haben
    if (!tab || !tab.url) {
      await showNotification('Fehler', 'Kein aktiver Tab gefunden');
      return;
    }

    // ╔═══════════════════════════════════════════════════════════╗
    // ║ SCHRITT 2: Ist es ein YouTube Video?                      ║
    // ╚═══════════════════════════════════════════════════════════╝
    if (!isYouTubeVideoUrl(tab.url)) {
      await showNotification('Kein YouTube Video', 'Bitte öffne ein YouTube Video');
      return;
    }

    // ╔═══════════════════════════════════════════════════════════╗
    // ║ SCHRITT 3: API-Key aus Storage holen                      ║
    // ╚═══════════════════════════════════════════════════════════╝
    const credentials = await getStoredCredentials();

    if (!credentials || !credentials.apiKey) {
      await showNotification('Nicht angemeldet', 'Bitte öffne das Plugin und melde dich an');
      return;
    }

    // ╔═══════════════════════════════════════════════════════════╗
    // ║ SCHRITT 4: Video-Informationen holen                      ║
    // ╚═══════════════════════════════════════════════════════════╝
    let videoInfo;
    try {
      // Frage das content.js nach den Video-Details
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getVideoInfo'
      });
      videoInfo = response.videoInfo;
    } catch (e) {
      // Fallback: Einfache Infos aus der Tab-URL
      videoInfo = {
        url: tab.url,
        title: tab.title?.replace(' - YouTube', '') || 'YouTube Video',
        videoId: extractVideoId(tab.url),
        channel: 'YouTube'
      };
    }

    // ╔═══════════════════════════════════════════════════════════╗
    // ║ SCHRITT 5: An Fabric API senden                           ║
    // ╚═══════════════════════════════════════════════════════════╝
    await showNotification('Speichern...', 'Video wird in Fabric gespeichert');

    const result = await saveToFabric(videoInfo, credentials.apiKey);

    // ╔═══════════════════════════════════════════════════════════╗
    // ║ SCHRITT 6: Ergebnis anzeigen                              ║
    // ╚═══════════════════════════════════════════════════════════╝
    if (result.success) {
      await showNotification('Gespeichert!', `"${videoInfo.title}" wurde in Fabric gespeichert`);
    } else {
      // Fallback: URL kopieren und Fabric öffnen
      const copied = await copyToClipboard(videoInfo.url, tab.id);
      chrome.tabs.create({ url: `${DEFAULT_CONFIG.baseUrl}/home` });

      if (copied) {
        await showNotification('URL kopiert', 'Füge die URL in Fabric ein (Ctrl+V)');
      } else {
        await showNotification('Fabric geöffnet', 'Kopiere die URL manuell');
      }
    }

  } catch (error) {
    console.error('Error in shortcut handler:', error);
    await showNotification('Fehler', 'Ein Fehler ist aufgetreten');
  }
}
```

### Die Clipboard-Funktion (Spezialfall)

**Problem:** Service Worker haben keinen Zugriff auf `navigator.clipboard`.

**Lösung:** Wir führen Code im Tab aus, der Zugriff hat.

```javascript
async function copyToClipboard(text, tabId) {
  try {
    // chrome.scripting.executeScript führt Code im Tab aus
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },  // In welchem Tab?

      // Diese Funktion wird IM TAB ausgeführt, nicht im Service Worker!
      func: async (textToCopy) => {
        try {
          await navigator.clipboard.writeText(textToCopy);
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },

      args: [text]  // Argumente für die Funktion
    });

    // Prüfe ob es funktioniert hat
    if (results && results[0] && results[0].result && results[0].result.success) {
      return true;
    }
    return false;

  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
```

**Visualisierung:**

```
┌─────────────────────────────────────────────────────────────┐
│                     SERVICE WORKER                           │
│                                                              │
│  copyToClipboard("https://youtube.com/...", 123)            │
│            │                                                 │
│            │ chrome.scripting.executeScript()               │
│            ▼                                                 │
├─────────────────────────────────────────────────────────────┤
│                     TAB (ID: 123)                            │
│                                                              │
│  // Diese Funktion läuft HIER:                              │
│  async (textToCopy) => {                                    │
│    await navigator.clipboard.writeText(textToCopy);         │
│    return { success: true };                                │
│  }                                                          │
│            │                                                 │
│            │ Ergebnis zurück                                │
│            ▼                                                 │
├─────────────────────────────────────────────────────────────┤
│                     SERVICE WORKER                           │
│                                                              │
│  results[0].result = { success: true }                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. content.js - Der DOM-Manipulator

### Was ist ein Content Script?

Ein Content Script ist JavaScript-Code, der **direkt in Webseiten** eingefügt wird. Es hat:
- ✅ Zugriff auf das DOM der Webseite (document, window)
- ✅ Kann Elemente hinzufügen, ändern, löschen
- ✅ Kann auf Events der Webseite reagieren
- ❌ Keinen Zugriff auf JavaScript-Variablen der Webseite
- ❌ Kann keine ES6 Module importieren

### Die IIFE-Struktur

```javascript
// IIFE = Immediately Invoked Function Expression
// Das ist ein Muster, um Code zu isolieren

(function() {
  'use strict';

  // Alles hier drin ist "privat"
  // Keine Konflikte mit YouTube's eigenem JavaScript

})();
```

**Warum IIFE?**

```
┌─────────────────────────────────────────────────────────────┐
│                    OHNE IIFE (SCHLECHT)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  YouTube's Code:    var settings = { ... }                  │
│  Unser Code:        var settings = { ... }  // ÜBERSCHREIBT!│
│                                                              │
│  → Konflikt! YouTube könnte kaputt gehen.                   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    MIT IIFE (GUT)                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  YouTube's Code:    var settings = { ... }                  │
│  Unser Code:        (function() {                           │
│                       var settings = { ... } // ISOLIERT!   │
│                     })();                                   │
│                                                              │
│  → Kein Konflikt! Beide existieren unabhängig.              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Die Hauptbereiche von content.js

```javascript
(function() {
  'use strict';

  // ╔═══════════════════════════════════════════════════════════╗
  // ║ BEREICH 1: STATUS UND EINSTELLUNGEN                       ║
  // ╚═══════════════════════════════════════════════════════════╝

  let settings = { showFloatingButton: true };
  let observer = null;        // MutationObserver Referenz
  let addButtonTimeout = null; // Timeout für Debouncing

  // ╔═══════════════════════════════════════════════════════════╗
  // ║ BEREICH 2: SETTINGS MANAGEMENT                            ║
  // ╚═══════════════════════════════════════════════════════════╝

  function loadSettings() { ... }
  // + Storage Change Listener

  // ╔═══════════════════════════════════════════════════════════╗
  // ║ BEREICH 3: VIDEO-INFO EXTRAKTION                          ║
  // ╚═══════════════════════════════════════════════════════════╝

  function getVideoInfo() { ... }

  // ╔═══════════════════════════════════════════════════════════╗
  // ║ BEREICH 4: MESSAGE HANDLING                               ║
  // ╚═══════════════════════════════════════════════════════════╝

  chrome.runtime.onMessage.addListener(...);

  // ╔═══════════════════════════════════════════════════════════╗
  // ║ BEREICH 5: FLOATING BUTTON                                ║
  // ╚═══════════════════════════════════════════════════════════╝

  function createButtonElement() { ... }
  function addFloatingSaveButton() { ... }
  function removeFloatingSaveButton() { ... }

  // ╔═══════════════════════════════════════════════════════════╗
  // ║ BEREICH 6: INITIALISIERUNG UND CLEANUP                    ║
  // ╚═══════════════════════════════════════════════════════════╝

  function cleanup() { ... }
  function init() { ... }

})();
```

### Video-Informationen extrahieren

```javascript
function getVideoInfo() {
  const info = {
    url: window.location.href,  // Die aktuelle URL
    title: null,
    channel: null,
    videoId: null,
    thumbnail: null,
    description: null,
    duration: null
  };

  try {
    // ══════════════════════════════════════════════════════════
    // VIDEO-ID EXTRAHIEREN
    // ══════════════════════════════════════════════════════════

    // Methode 1: Aus URL-Parameter (youtube.com/watch?v=xxxxx)
    const urlParams = new URLSearchParams(window.location.search);
    info.videoId = urlParams.get('v');

    // Methode 2: Aus Pfad für Shorts (youtube.com/shorts/xxxxx)
    const shortsMatch = window.location.pathname.match(/\/shorts\/([^/?]+)/);
    if (shortsMatch) {
      info.videoId = shortsMatch[1];
    }

    // ══════════════════════════════════════════════════════════
    // TITEL EXTRAHIEREN (mit Fallback-Kette)
    // ══════════════════════════════════════════════════════════

    // YouTube ändert sein DOM oft, daher mehrere Selektoren
    const titleElement =
      document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string') ||
      document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
      document.querySelector('h1.title') ||
      document.querySelector('[itemprop="name"]') ||
      document.querySelector('meta[name="title"]');

    if (titleElement) {
      // textContent für normale Elemente, content für meta-Tags
      info.title = titleElement.textContent || titleElement.content;
    } else {
      // Letzter Fallback: Browser-Tab-Titel
      info.title = document.title.replace(' - YouTube', '');
    }

    // ══════════════════════════════════════════════════════════
    // CHANNEL-NAME EXTRAHIEREN
    // ══════════════════════════════════════════════════════════

    const channelElement =
      document.querySelector('#channel-name a') ||
      document.querySelector('ytd-channel-name a') ||
      document.querySelector('[itemprop="author"] [itemprop="name"]') ||
      document.querySelector('.ytd-channel-name');

    if (channelElement) {
      info.channel = channelElement.textContent?.trim();
    }

    // ══════════════════════════════════════════════════════════
    // THUMBNAIL-URL GENERIEREN
    // ══════════════════════════════════════════════════════════

    // YouTube hat ein vorhersagbares URL-Schema für Thumbnails
    if (info.videoId) {
      info.thumbnail = `https://img.youtube.com/vi/${info.videoId}/maxresdefault.jpg`;
    }

  } catch (error) {
    console.error('Error extracting video info:', error);
  }

  return info;
}
```

### Der MutationObserver - YouTube SPA verstehen

**Problem:** YouTube ist eine Single-Page-Application (SPA). Das bedeutet:
- Bei Navigation wird die Seite **nicht** neu geladen
- JavaScript ändert nur den Inhalt
- Unser Content Script wird **nicht** neu ausgeführt

**Lösung:** MutationObserver beobachtet DOM-Änderungen

```javascript
function init() {
  let lastUrl = location.href;  // Merke aktuelle URL

  // Erstelle einen Observer, der auf DOM-Änderungen reagiert
  observer = new MutationObserver(() => {

    // ════════════════════════════════════════════════════════
    // CHECK 1: Hat sich die URL geändert?
    // ════════════════════════════════════════════════════════
    const currentUrl = location.href;

    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;

      // Altes Button entfernen
      removeFloatingSaveButton();

      // Debounce: Warte 500ms bevor neuer Button kommt
      // (verhindert Flackern bei schneller Navigation)
      if (addButtonTimeout) {
        clearTimeout(addButtonTimeout);
      }
      addButtonTimeout = setTimeout(addFloatingSaveButton, 500);
      return;
    }

    // ════════════════════════════════════════════════════════
    // CHECK 2: Ist der Video-Player geladen?
    // ════════════════════════════════════════════════════════
    const videoPlayer = document.querySelector('#movie_player') ||
                        document.querySelector('ytd-player');

    if (videoPlayer) {
      addFloatingSaveButton();  // Button hinzufügen wenn noch nicht da
    }
  });

  // Starte die Beobachtung
  observer.observe(document.body, {
    childList: true,  // Beobachte hinzugefügte/entfernte Elemente
    subtree: true     // Beobachte auch alle Kinder-Elemente
  });
}
```

**Visualisierung des MutationObserver:**

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUTUBE SEITE                             │
│                                                              │
│  <body>                                                     │
│    <div id="content">                                       │
│      <div id="movie_player">  ◄── Wird beobachtet          │
│        ...                                                  │
│      </div>                                                 │
│    </div>                                                   │
│  </body>                                                    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User klickt auf anderes Video                              │
│            │                                                 │
│            ▼                                                 │
│  YouTube ändert DOM (SPA Navigation)                        │
│            │                                                 │
│            ▼                                                 │
│  MutationObserver wird getriggert                           │
│            │                                                 │
│            ├──► URL geändert? → Button neu erstellen        │
│            │                                                 │
│            └──► Video-Player da? → Button hinzufügen        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Memory Leak Prevention (Cleanup)

**Problem:** Wenn die Seite geschlossen wird, läuft der Observer weiter → Memory Leak

**Lösung:** Cleanup-Funktion beim Schließen aufrufen

```javascript
function cleanup() {
  // Observer stoppen
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  // Pending Timeouts abbrechen
  if (addButtonTimeout) {
    clearTimeout(addButtonTimeout);
    addButtonTimeout = null;
  }

  // Button entfernen
  removeFloatingSaveButton();
}

// Cleanup bei Seiten-Wechsel
window.addEventListener('beforeunload', cleanup);
window.addEventListener('unload', cleanup);
```

---

## 7. popup.js - Die Benutzeroberfläche

### Was ist das Popup?

Das Popup erscheint, wenn du auf das Extension-Icon in der Browser-Toolbar klickst. Es ist wie eine Mini-App innerhalb des Browsers.

```
┌─────────────────────────────────────────────────────────────┐
│ Chrome Toolbar                                    [🧩]      │
└────────────────────────────────────────────────────┬────────┘
                                                     │ Klick!
                                                     ▼
                                    ┌─────────────────────────┐
                                    │ ┌─────────────────────┐ │
                                    │ │  YouTube to Fabric  │ │
                                    │ ├─────────────────────┤ │
                                    │ │                     │ │
                                    │ │  [Video Thumbnail]  │ │
                                    │ │  Video Titel        │ │
                                    │ │  Channel Name       │ │
                                    │ │                     │ │
                                    │ │ [In Fabric speichern]│ │
                                    │ │                     │ │
                                    │ └─────────────────────┘ │
                                    └─────────────────────────┘
```

### Lebenszyklus des Popups

```
┌─────────────────────────────────────────────────────────────┐
│                    POPUP LEBENSZYKLUS                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User klickt auf Extension-Icon                          │
│            │                                                 │
│            ▼                                                 │
│  2. popup.html wird geladen                                 │
│            │                                                 │
│            ▼                                                 │
│  3. popup.js wird ausgeführt                                │
│            │                                                 │
│            ▼                                                 │
│  4. DOMContentLoaded Event fires                            │
│            │                                                 │
│            ├──► loadConfig()         // API-Einstellungen   │
│            ├──► checkAuthStatus()    // Ist User eingeloggt?│
│            ├──► checkCurrentTab()    // Video-Info holen    │
│            └──► setupEventListeners()// Buttons aktivieren  │
│            │                                                 │
│            ▼                                                 │
│  5. User interagiert (klickt Save, etc.)                    │
│            │                                                 │
│            ▼                                                 │
│  6. User schließt Popup (klickt woanders)                   │
│            │                                                 │
│            ▼                                                 │
│  7. popup.js wird KOMPLETT beendet                          │
│     (Alle Variablen weg, alle Listener weg)                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Wichtig:** Das Popup "stirbt" wenn es geschlossen wird. Bei jedem Öffnen startet es neu von vorne!

### ES6 Module im Popup

Da popup.html ein `<script type="module">` hat, können wir importieren:

```html
<!-- popup.html -->
<script type="module" src="popup.js"></script>
```

```javascript
// popup.js
import {
  STORAGE_KEYS,
  DEFAULT_CONFIG,
  isYouTubeVideoUrl,
  extractVideoId,
  getThumbnailUrl
} from './shared/constants.js';
```

### API-Key Validierung

Bevor wir den API-Key speichern, testen wir ihn:

```javascript
async function validateApiKey(apiKey) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey  // Der zu testende Key
    };

    // Fabric hat einen "User Info" Endpoint
    const response = await fetch(`${config.apiUrl}/v2/user/me`, {
      method: 'GET',
      headers: headers
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'Ungültiger API Key' };
    } else {
      return { valid: false, error: `API Fehler: ${response.status}` };
    }
  } catch (error) {
    return { valid: false, error: 'Verbindung fehlgeschlagen' };
  }
}
```

### UI-States verwalten

Das Popup hat verschiedene "Zustände":

```javascript
// ╔═══════════════════════════════════════════════════════════╗
// ║                    UI ZUSTÄNDE                            ║
// ╚═══════════════════════════════════════════════════════════╝

// ZUSTAND 1: Nicht eingeloggt
function showLogin() {
  hideAllSections();
  elements.loginSection.classList.remove('hidden');
}

// ZUSTAND 2: Eingeloggt
function showLoggedIn() {
  elements.loginSection.classList.add('hidden');
  elements.loggedInSection.classList.remove('hidden');
}

// ZUSTAND 3: Video erkannt
function showVideoSection() {
  elements.noVideoSection.classList.add('hidden');
  elements.videoSection.classList.remove('hidden');
}

// ZUSTAND 4: Kein Video
function showNoVideo() {
  elements.videoSection.classList.add('hidden');
  elements.noVideoSection.classList.remove('hidden');
}

// ZUSTAND 5: Laden
function showLoading() {
  elements.saveToFabricBtn.disabled = true;
  elements.loading.classList.remove('hidden');
}

// ZUSTAND 6: Erfolg
function showSuccess(message) {
  hideLoading();
  elements.successMessage.classList.remove('hidden');
  setTimeout(() => {
    elements.successMessage.classList.add('hidden');
  }, 3000);
}

// ZUSTAND 7: Fehler
function showError(message) {
  hideLoading();
  elements.errorMessage.classList.remove('hidden');
  setTimeout(() => {
    elements.errorMessage.classList.add('hidden');
  }, 5000);
}
```

**Zustands-Diagramm:**

```
                    ┌──────────────┐
                    │   START      │
                    └──────┬───────┘
                           │
                           ▼
                 ┌──────────────────┐
          ┌──────│ API Key vorhanden?│──────┐
          │ Nein └──────────────────┘ Ja   │
          ▼                                ▼
   ┌─────────────┐                ┌─────────────────┐
   │ showLogin() │                │ showLoggedIn()  │
   └──────┬──────┘                └────────┬────────┘
          │                                │
          │ Key eingegeben                 │
          │ & validiert                    ▼
          │                     ┌──────────────────┐
          └────────────────────►│ YouTube Video?   │
                                └────────┬─────────┘
                           Nein │        │ Ja
                                ▼        ▼
                    ┌───────────────┐ ┌───────────────┐
                    │ showNoVideo() │ │showVideoSection│
                    └───────────────┘ └───────┬───────┘
                                              │
                                              │ User klickt "Speichern"
                                              ▼
                                    ┌──────────────────┐
                                    │  showLoading()   │
                                    └────────┬─────────┘
                                             │
                                    ┌────────┴────────┐
                             Fehler │                 │ Erfolg
                                    ▼                 ▼
                          ┌─────────────┐   ┌─────────────┐
                          │ showError() │   │showSuccess()│
                          └─────────────┘   └─────────────┘
```

---

## 8. options.js - Die Einstellungen

### Zweck der Options-Seite

Die Options-Seite ermöglicht Benutzern, die Extension zu konfigurieren:

```
┌─────────────────────────────────────────────────────────────┐
│              EINSTELLUNGEN - YouTube to Fabric               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  API Konfiguration                                          │
│  ─────────────────────────────────────────────────          │
│  API Base URL:     [https://api.fabric.so        ]          │
│  Endpoint:         [/v2/bookmarks                ]          │
│  API Key:          [••••••••••••••••••••         ]          │
│  Auth Type:        [API Key (X-Api-Key) ▼        ]          │
│                                                              │
│  Weitere Einstellungen                                      │
│  ─────────────────────────────────────────────────          │
│  [✓] Floating-Button auf YouTube anzeigen                   │
│  [✓] Desktop-Benachrichtigungen anzeigen                    │
│  [ ] URL automatisch kopieren (Fallback)                    │
│                                                              │
│  [Einstellungen speichern]  [Verbindung testen]             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Settings laden und speichern

```javascript
// Beim Laden der Seite: Gespeicherte Einstellungen anzeigen
async function loadSettings() {
  const settings = await new Promise((resolve) => {
    chrome.storage.local.get([
      STORAGE_KEYS.API_BASE_URL,
      STORAGE_KEYS.API_ENDPOINT,
      STORAGE_KEYS.API_KEY,
      STORAGE_KEYS.AUTH_TYPE,
      STORAGE_KEYS.SHOW_FLOATING_BUTTON,
      STORAGE_KEYS.SHOW_NOTIFICATIONS,
      STORAGE_KEYS.AUTO_COPY_URL
    ], resolve);
  });

  // Werte in die Formularfelder einsetzen
  elements.apiBaseUrl.value = settings[STORAGE_KEYS.API_BASE_URL] || DEFAULT_CONFIG.apiUrl;
  elements.apiEndpoint.value = settings[STORAGE_KEYS.API_ENDPOINT] || DEFAULT_CONFIG.endpoint;
  // ... etc
}

// Beim Klick auf "Speichern"
async function saveSettings() {
  const settings = {
    [STORAGE_KEYS.API_BASE_URL]: elements.apiBaseUrl.value.trim(),
    [STORAGE_KEYS.API_ENDPOINT]: elements.apiEndpoint.value.trim(),
    [STORAGE_KEYS.API_KEY]: elements.apiKey.value.trim(),
    // ... etc
  };

  await new Promise((resolve) => {
    chrome.storage.local.set(settings, resolve);
  });

  showMessage('success', 'Einstellungen erfolgreich gespeichert!');
}
```

### Verbindung testen

```javascript
async function testConnection() {
  const apiKey = elements.apiKey.value.trim();

  if (!apiKey) {
    showMessage('error', 'Bitte gib einen API Key ein');
    return;
  }

  // Button deaktivieren während Test
  elements.testConnectionBtn.textContent = 'Teste...';
  elements.testConnectionBtn.disabled = true;

  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    };

    // Test-Request an User-Endpoint
    const response = await fetch(`${baseUrl}/v2/user/me`, {
      method: 'GET',
      headers: headers
    });

    if (response.ok) {
      const userData = await response.json();
      showMessage('success',
        `Verbindung erfolgreich! Eingeloggt als: ${userData.email || 'Benutzer'}`
      );
    } else if (response.status === 401) {
      showMessage('error', 'Authentifizierung fehlgeschlagen. API Key prüfen.');
    } else {
      showMessage('error', `API antwortet mit Status ${response.status}`);
    }
  } catch (error) {
    showMessage('error', 'Verbindung fehlgeschlagen: ' + error.message);
  } finally {
    // Button wieder aktivieren
    elements.testConnectionBtn.textContent = 'Verbindung testen';
    elements.testConnectionBtn.disabled = false;
  }
}
```

---

## 9. shared/constants.js - Gemeinsamer Code

### Warum gemeinsamer Code?

Ohne gemeinsame Konstanten würden wir den gleichen String überall wiederholen:

```javascript
// SCHLECHT - String überall wiederholt
// background.js
chrome.storage.local.get(['fabricApiKey'], ...);

// popup.js
chrome.storage.local.get(['fabricApiKey'], ...);

// options.js
chrome.storage.local.get(['fabricApiKey'], ...);

// Was wenn wir uns vertippen?
chrome.storage.local.get(['fabricAPIKey'], ...);  // FEHLER! Aber kein Fehler gemeldet
```

Mit Konstanten:

```javascript
// GUT - Konstante einmal definiert
// shared/constants.js
export const STORAGE_KEYS = {
  API_KEY: 'fabricApiKey'
};

// Überall nutzen:
chrome.storage.local.get([STORAGE_KEYS.API_KEY], ...);

// Tippfehler wird sofort erkannt:
chrome.storage.local.get([STORAGE_KEYS.API_KEy], ...);  // ❌ ReferenceError!
```

### Die constants.js im Detail

```javascript
// ╔═══════════════════════════════════════════════════════════╗
// ║                    STORAGE KEYS                           ║
// ╚═══════════════════════════════════════════════════════════╝

// Alle Schlüssel für chrome.storage.local
export const STORAGE_KEYS = {
  API_KEY: 'fabricApiKey',
  API_BASE_URL: 'fabricApiBaseUrl',
  API_ENDPOINT: 'fabricApiEndpoint',
  AUTH_TYPE: 'fabricAuthType',
  SHOW_FLOATING_BUTTON: 'fabricShowFloatingButton',
  SHOW_NOTIFICATIONS: 'fabricShowNotifications',
  AUTO_COPY_URL: 'fabricAutoCopyUrl'
};

// ╔═══════════════════════════════════════════════════════════╗
// ║                 DEFAULT CONFIGURATION                     ║
// ╚═══════════════════════════════════════════════════════════╝

// Standard-Werte für die API-Konfiguration
export const DEFAULT_CONFIG = {
  baseUrl: 'https://fabric.so',
  apiUrl: 'https://api.fabric.so',
  endpoint: '/v2/bookmarks',
  authType: 'apikey',
  defaultParentId: '@alias::inbox'  // Speichert in "Inbox" Ordner
};

// ╔═══════════════════════════════════════════════════════════╗
// ║                  HILFSFUNKTIONEN                          ║
// ╚═══════════════════════════════════════════════════════════╝

// Prüft ob eine URL ein YouTube Video ist
export function isYouTubeVideoUrl(url) {
  if (!url) return false;
  return (
    url.includes('youtube.com/watch') ||  // Normale Videos
    url.includes('youtu.be/') ||           // Kurz-URLs
    url.includes('youtube.com/shorts/')    // Shorts
  );
}

// Extrahiert die Video-ID aus einer YouTube URL
export function extractVideoId(url) {
  if (!url) return null;

  const patterns = [
    /[?&]v=([^&]+)/,           // youtube.com/watch?v=xxxxx
    /youtu\.be\/([^?&]+)/,      // youtu.be/xxxxx
    /shorts\/([^?&]+)/          // youtube.com/shorts/xxxxx
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Generiert eine Thumbnail-URL für eine Video-ID
export function getThumbnailUrl(videoId, quality = 'mqdefault') {
  if (!videoId) return null;

  // YouTube Thumbnail URL-Schema:
  // https://img.youtube.com/vi/{VIDEO_ID}/{QUALITY}.jpg
  // Qualities: default, mqdefault, hqdefault, sddefault, maxresdefault
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}
```

### Warum kann content.js keine Module importieren?

Chrome Content Scripts laufen in einem speziellen Kontext, der keine ES6 Modules unterstützt. Deshalb:

```javascript
// content.js - Muss die Storage-Keys als String schreiben
// WICHTIG: Muss mit STORAGE_KEYS.SHOW_FLOATING_BUTTON übereinstimmen!
chrome.storage.local.get(['fabricShowFloatingButton'], ...);
```

Wir fügen Kommentare hinzu, die auf die Konstanten verweisen:

```javascript
// Key must match STORAGE_KEYS.SHOW_FLOATING_BUTTON in shared/constants.js
chrome.storage.local.get(['fabricShowFloatingButton'], ...);
```

---

## 10. Die Kommunikation zwischen den Teilen

### Übersicht der Kommunikationswege

```
┌─────────────────────────────────────────────────────────────┐
│                 KOMMUNIKATIONS-DIAGRAMM                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                  ┌───────────────────┐                       │
│                  │   background.js   │                       │
│                  │  (Service Worker) │                       │
│                  └─────────┬─────────┘                       │
│                            │                                 │
│           ┌────────────────┼────────────────┐               │
│           │                │                │               │
│           ▼                ▼                ▼               │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │ content.js  │  │  popup.js   │  │ options.js  │        │
│   │ (YouTube)   │  │  (Popup)    │  │ (Settings)  │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Kommunikations-Methoden:                                   │
│                                                              │
│  1. chrome.runtime.sendMessage()  → An background.js        │
│  2. chrome.tabs.sendMessage()     → An content.js           │
│  3. chrome.storage                → Geteilter Speicher      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Methode 1: runtime.sendMessage (→ Background)

Popup oder Content Script sendet an Background:

```javascript
// === SENDER (popup.js oder content.js) ===
const response = await chrome.runtime.sendMessage({
  action: 'saveToFabric',
  data: { videoId: 'xxx' }
});

console.log(response);  // { success: true }

// === EMPFÄNGER (background.js) ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(request);  // { action: 'saveToFabric', data: { videoId: 'xxx' } }
  console.log(sender);   // { tab: { id: 123, ... }, ... }

  // Verarbeitung...

  sendResponse({ success: true });
  return true;  // WICHTIG für async!
});
```

### Methode 2: tabs.sendMessage (→ Content Script)

Background oder Popup sendet an Content Script in einem Tab:

```javascript
// === SENDER (popup.js oder background.js) ===

// Erst den Tab finden
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

// Dann Message senden
const response = await chrome.tabs.sendMessage(tab.id, {
  action: 'getVideoInfo'
});

console.log(response);  // { videoInfo: { title: '...', ... } }

// === EMPFÄNGER (content.js) ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVideoInfo') {
    const info = getVideoInfo();
    sendResponse({ videoInfo: info });
  }
  return true;
});
```

### Methode 3: chrome.storage (Geteilter Speicher)

Alle Teile können lesen und schreiben:

```javascript
// === SCHREIBEN (z.B. in options.js) ===
await chrome.storage.local.set({
  fabricApiKey: 'sk-xxxxx',
  fabricShowFloatingButton: true
});

// === LESEN (z.B. in background.js) ===
const result = await chrome.storage.local.get(['fabricApiKey']);
console.log(result.fabricApiKey);  // 'sk-xxxxx'

// === ÄNDERUNGEN BEOBACHTEN (z.B. in content.js) ===
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.fabricShowFloatingButton) {
      console.log('Button-Einstellung geändert:');
      console.log('  Alt:', changes.fabricShowFloatingButton.oldValue);
      console.log('  Neu:', changes.fabricShowFloatingButton.newValue);
    }
  }
});
```

### Kommunikationsfluss beim Speichern

```
┌─────────────────────────────────────────────────────────────┐
│           KOMPLETTER KOMMUNIKATIONSFLUSS                     │
│           beim Klick auf "In Fabric speichern"              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User klickt Button (content.js)                         │
│            │                                                 │
│            │ chrome.runtime.sendMessage({action:'saveToFabric'})
│            ▼                                                 │
│  2. background.js empfängt Message                          │
│            │                                                 │
│            │ chrome.tabs.query() - Finde aktiven Tab        │
│            │                                                 │
│            │ chrome.tabs.sendMessage({action:'getVideoInfo'})
│            ▼                                                 │
│  3. content.js extrahiert Video-Info aus DOM                │
│            │                                                 │
│            │ sendResponse({ videoInfo: {...} })             │
│            ▼                                                 │
│  4. background.js empfängt Video-Info                       │
│            │                                                 │
│            │ chrome.storage.local.get() - API Key holen     │
│            │                                                 │
│            │ fetch() - API Request an Fabric                │
│            ▼                                                 │
│  5. Fabric API antwortet                                    │
│            │                                                 │
│            │ chrome.notifications.create() - Benachrichtigung│
│            │                                                 │
│            │ sendResponse({ success: true })                │
│            ▼                                                 │
│  6. content.js zeigt Erfolg im Button                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Die Fabric API verstehen

### Was ist eine REST API?

Eine REST API ist wie ein Kellner in einem Restaurant:
- Du gibst eine **Bestellung** (Request)
- Du bekommst das **Essen** (Response)

```
┌─────────────────────────────────────────────────────────────┐
│                    REST API KONZEPT                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Client (Extension)              Server (Fabric)            │
│       │                               │                      │
│       │  POST /v2/bookmarks           │                      │
│       │  + Headers (Auth)             │                      │
│       │  + Body (Daten)               │                      │
│       │ ─────────────────────────────►│                      │
│       │                               │                      │
│       │                               │ Verarbeitet Request  │
│       │                               │ Speichert Bookmark   │
│       │                               │                      │
│       │  201 Created                  │                      │
│       │  + Body (Ergebnis)            │                      │
│       │ ◄─────────────────────────────│                      │
│       │                               │                      │
└─────────────────────────────────────────────────────────────┘
```

### HTTP Methoden

| Methode | Zweck | Beispiel |
|---------|-------|----------|
| GET | Daten abrufen | `GET /v2/user/me` → User-Info |
| POST | Daten erstellen | `POST /v2/bookmarks` → Neues Bookmark |
| PUT | Daten aktualisieren | `PUT /v2/bookmarks/123` → Bookmark ändern |
| DELETE | Daten löschen | `DELETE /v2/bookmarks/123` → Bookmark löschen |

### Der Fabric API Request

```javascript
// Die saveToFabric Funktion im Detail

async function saveToFabric(videoInfo, apiKey) {

  // ═══════════════════════════════════════════════════════════
  // SCHRITT 1: Headers vorbereiten
  // ═══════════════════════════════════════════════════════════

  const headers = {
    'Content-Type': 'application/json',  // Wir senden JSON
    'X-Api-Key': apiKey                  // Authentifizierung
  };

  // ═══════════════════════════════════════════════════════════
  // SCHRITT 2: Request Body erstellen
  // ═══════════════════════════════════════════════════════════

  const requestBody = {
    // PFLICHTFELDER:
    url: videoInfo.url,              // Die YouTube URL
    parentId: '@alias::inbox',       // Wo speichern? → Inbox

    // OPTIONALE FELDER:
    name: videoInfo.title,           // Titel des Bookmarks
    tags: [{ name: 'YouTube' }],     // Tags zum Kategorisieren
    comment: {                        // Notiz/Kommentar
      content: `Channel: ${videoInfo.channel}`
    }
  };

  // ═══════════════════════════════════════════════════════════
  // SCHRITT 3: Request senden
  // ═══════════════════════════════════════════════════════════

  const response = await fetch('https://api.fabric.so/v2/bookmarks', {
    method: 'POST',           // Wir erstellen etwas Neues
    headers: headers,
    body: JSON.stringify(requestBody)  // Object → JSON String
  });

  // ═══════════════════════════════════════════════════════════
  // SCHRITT 4: Response verarbeiten
  // ═══════════════════════════════════════════════════════════

  if (response.ok) {  // Status 200-299
    const data = await response.json();
    return { success: true, data };
  } else {
    const errorText = await response.text();
    return { success: false, error: `API Fehler: ${response.status}` };
  }
}
```

### Visualisierung des API Requests

```
┌─────────────────────────────────────────────────────────────┐
│                    API REQUEST DETAILS                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  POST https://api.fabric.so/v2/bookmarks                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ HEADERS                                             │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ Content-Type: application/json                      │    │
│  │ X-Api-Key: sk-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ BODY (JSON)                                         │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ {                                                   │    │
│  │   "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",│    │
│  │   "parentId": "@alias::inbox",                     │    │
│  │   "name": "Rick Astley - Never Gonna Give You Up", │    │
│  │   "tags": [{ "name": "YouTube" }],                 │    │
│  │   "comment": {                                     │    │
│  │     "content": "Channel: Rick Astley"              │    │
│  │   }                                                │    │
│  │ }                                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  RESPONSE (bei Erfolg)                                      │
│                                                              │
│  Status: 201 Created                                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ BODY (JSON)                                         │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ {                                                   │    │
│  │   "id": "abc123-def456-...",                       │    │
│  │   "kind": "bookmark",                              │    │
│  │   "name": "Rick Astley - Never Gonna Give You Up", │    │
│  │   "url": "https://youtube.com/watch?v=...",        │    │
│  │   "createdAt": "2024-01-15T10:30:00Z"              │    │
│  │ }                                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### HTTP Status Codes

| Code | Bedeutung | Was tun? |
|------|-----------|----------|
| 200 | OK | Alles gut |
| 201 | Created | Bookmark wurde erstellt |
| 400 | Bad Request | Deine Daten sind falsch formatiert |
| 401 | Unauthorized | API Key fehlt oder ist falsch |
| 403 | Forbidden | Keine Berechtigung |
| 404 | Not Found | Endpoint existiert nicht |
| 429 | Too Many Requests | Zu viele Anfragen, warte kurz |
| 500 | Server Error | Fabric hat ein Problem |

---

## 12. Debugging und Fehlerbehebung

### Wo finde ich die Logs?

```
┌─────────────────────────────────────────────────────────────┐
│                    DEBUGGING LOCATIONS                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. SERVICE WORKER (background.js)                          │
│     ────────────────────────────────                        │
│     → chrome://extensions/                                  │
│     → "YouTube to Fabric" finden                           │
│     → "Service Worker" Link klicken                        │
│     → DevTools öffnet sich                                 │
│                                                              │
│  2. CONTENT SCRIPT (content.js)                             │
│     ────────────────────────────────                        │
│     → YouTube Tab öffnen                                   │
│     → F12 (DevTools)                                       │
│     → Console Tab                                          │
│     → Logs von content.js erscheinen hier                  │
│                                                              │
│  3. POPUP (popup.js)                                        │
│     ────────────────────────────────                        │
│     → Extension Icon klicken (Popup öffnet)                │
│     → Rechtsklick auf Popup                                │
│     → "Untersuchen" / "Inspect"                            │
│     → DevTools für Popup öffnet sich                       │
│                                                              │
│  4. OPTIONS (options.js)                                    │
│     ────────────────────────────────                        │
│     → Einstellungs-Seite öffnen                            │
│     → F12 (DevTools)                                       │
│     → Ganz normale Web-DevTools                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Nützliche Debug-Befehle

```javascript
// === IN DER CONSOLE ===

// Storage anschauen
chrome.storage.local.get(null, (items) => console.log(items));

// Storage leeren (zum Testen)
chrome.storage.local.clear();

// Bestimmten Wert setzen
chrome.storage.local.set({ fabricApiKey: 'test-key' });

// Extension neu laden (programmatisch)
chrome.runtime.reload();
```

### Extension neu laden

Nach Code-Änderungen:

1. Gehe zu `chrome://extensions/`
2. Finde "YouTube to Fabric"
3. Klicke auf das 🔄 Refresh-Icon
4. **WICHTIG:** Lade auch den YouTube Tab neu!

### Häufige Debug-Szenarien

#### Szenario 1: "Message port closed"

```
Uncaught (in promise) Error: The message port closed before
a response was received.
```

**Ursache:** `return true` fehlt im Message Listener

```javascript
// FALSCH
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  doAsyncStuff().then(() => sendResponse({ ok: true }));
  // Kein return true!
});

// RICHTIG
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  doAsyncStuff().then(() => sendResponse({ ok: true }));
  return true;  // ← DAS HIER!
});
```

#### Szenario 2: "Cannot read properties of null"

```
Uncaught TypeError: Cannot read properties of null (reading 'textContent')
```

**Ursache:** DOM-Element existiert nicht (YouTube hat Layout geändert)

```javascript
// FALSCH
const title = document.querySelector('.video-title').textContent;

// RICHTIG
const titleElement = document.querySelector('.video-title');
const title = titleElement?.textContent || 'Fallback Titel';
```

#### Szenario 3: API Request schlägt fehl

```javascript
// Debug-Code hinzufügen:
const response = await fetch(url, options);

console.log('Status:', response.status);
console.log('Headers:', [...response.headers.entries()]);

const text = await response.text();
console.log('Body:', text);
```

---

## 13. Häufige Fehler und Lösungen

### Fehler 1: Extension wird nicht geladen

**Symptome:**
- Extension erscheint nicht in chrome://extensions/
- Fehlermeldung beim Laden

**Lösungen:**
```
□ manifest.json auf JSON-Syntax-Fehler prüfen
  → Online JSON Validator nutzen

□ Alle referenzierten Dateien existieren?
  → Icons, JS-Dateien, HTML-Dateien

□ Manifest Version 3?
  → "manifest_version": 3
```

### Fehler 2: Content Script läuft nicht

**Symptome:**
- Floating Button erscheint nicht
- Keine Logs in YouTube Console

**Lösungen:**
```
□ URL-Pattern in manifest.json korrekt?
  "matches": ["https://www.youtube.com/*"]

□ Nach Extension-Reload auch Tab neu laden!

□ YouTube komplett schließen und neu öffnen
```

### Fehler 3: Messages kommen nicht an

**Symptome:**
- sendMessage gibt Timeout
- Listener wird nicht aufgerufen

**Lösungen:**
```
□ Listener vor sendMessage registriert?

□ return true für async Responses?

□ Tab-ID korrekt bei tabs.sendMessage?
  const [tab] = await chrome.tabs.query({...});
  chrome.tabs.sendMessage(tab.id, ...);
```

### Fehler 4: Storage leer oder falsch

**Symptome:**
- Einstellungen werden nicht gespeichert
- API Key verschwindet

**Lösungen:**
```
□ Richtige Storage-Methode?
  chrome.storage.local (nicht localStorage!)

□ Async/await korrekt?
  await chrome.storage.local.set({...});

□ Typo im Key-Namen?
  → STORAGE_KEYS Konstanten nutzen!
```

### Fehler 5: API Request fehlgeschlagen

**Symptome:**
- 401 Unauthorized
- CORS Error
- Network Error

**Lösungen:**
```
□ host_permissions in manifest.json?
  "host_permissions": ["https://api.fabric.so/*"]

□ API Key korrekt?
  → In Options-Seite "Verbindung testen"

□ Header-Name korrekt?
  'X-Api-Key' (nicht 'X-API-Key')
```

---

## Glossar

| Begriff | Erklärung |
|---------|-----------|
| **API** | Application Programming Interface - Schnittstelle zum Kommunizieren mit einem Server |
| **Content Script** | JavaScript, das direkt in Webseiten eingefügt wird |
| **DOM** | Document Object Model - Die Struktur einer Webseite als Objekt-Baum |
| **ES6 Module** | Modernes JavaScript-Import/Export-System |
| **IIFE** | Immediately Invoked Function Expression - Sofort ausgeführte Funktion |
| **Manifest** | Die Konfigurationsdatei einer Chrome Extension |
| **MutationObserver** | Browser-API zum Beobachten von DOM-Änderungen |
| **REST API** | Representational State Transfer - Standard für Web-APIs |
| **Service Worker** | Hintergrund-Script das unabhängig von Webseiten läuft |
| **SPA** | Single Page Application - Webseite die ohne Neuladen navigiert |

---

## Weiterführende Ressourcen

- [Chrome Extension Dokumentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [MDN Web Docs - JavaScript](https://developer.mozilla.org/de/docs/Web/JavaScript)
- [Fabric.so](https://fabric.so)

---

*Letzte Aktualisierung: Februar 2026*
