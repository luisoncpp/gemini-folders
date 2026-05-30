# Gemini Projects - Architecture Documentation

This document provides a concise overview of the architecture, data flows, lifecycle, and module responsibilities for the **Gemini Projects** Chrome Extension.

## 1. System Lifecycle

1. **Page Load:** The extension's `content.js` and `styles.css` are injected into `https://gemini.google.com/*` as declared in `manifest.json`.
2. **ES Module Bootstrapping:** Since `content.js` runs as a standard script, it uses a dynamic import to load `main.js` (a web accessible resource) as an ES Module. It passes the `chrome` API object to `main.js`.
3. **Initialization (`main.js`):** 
   - Stores the `chrome` API reference in the state module.
   - Initializes chat capture listeners (`chatCapture.js`).
   - Starts the `MutationObserver` for the native context menu (`contextMenu.js`).
   - Loads persistent state from `chrome.storage.local`.
   - Starts the observer/interval to inject and render the custom sidebar (`ui.js`).
4. **Runtime Operations:**
   - **User Navigation:** `chatCapture.js` records the last clicked chat details via DOM events.
   - **Context Menu Interaction:** When the user opens a native Gemini menu, `contextMenu.js` detects it and injects a "Move to Project" option.
   - **Sidebar Interaction:** The custom sidebar handles project creation, editing, deletion, and delegates mapped chat navigation to the equivalent native Gemini chat entry when available. Unmapped native chats are hidden from the native list via `hideMappedChats()`.
   - **State Mutation:** Actions update the global `STATE` object, call `saveState()`, and trigger a re-render of the sidebar UI.

## 2. Data Control and Flow

- **Single Source of Truth:** The global `STATE` object in `state.js` acts as the source of truth in memory. It contains `projects`, `chatMap` (linking chat IDs to projects), and UI states like `isCollapsed`.
- **Persistence Flow:** `UI Event -> Update STATE object -> saveState() (chrome.storage.local) -> renderSidebarDOM()`.
- **Persistence Flow (File Sync):** The extension supports cloud syncing via the local file system (Google Drive Desktop).
  `UI Event -> Update STATE object -> saveState() -> Write to FileSystemFileHandle -> (Google Drive Syncs to Cloud)`.
  - **IndexedDB Bridge:** Because `chrome.storage` cannot store file handles, the `FileSystemFileHandle` is persisted across sessions using IndexedDB.
  - **Migration:** When a user initializes File Sync, `exportLocalData()` reads existing `chrome.storage.local` state and downloads a `gemini_projects_local_backup.json` blob before establishing the new file handle to prevent data loss.
- **Ephemeral State:** `ChatState.lastClickedChat` (in `chatCapture.js`) temporarily stores information about the chat the user intends to interact with, acting as a bridge between the native DOM and the extension's project mapping logic.

## 3. Module Responsibilities

### `manifest.json`
- Defines the extension metadata, permissions (`storage`), and injects the entry content script (`content.js`).
- Exposes module files via `web_accessible_resources` so they can be imported as ES Modules within the webpage context.

### `src/content.js`
- **Responsibility:** Entry point loader.
- **Details:** Overcomes Chrome's content script limitations by dynamically importing `main.js` as an ES module and passing the `chrome` API down the chain, since dynamically imported scripts run in the web page context and lose direct access to `chrome.*` APIs.

### `src/main.js`
- **Responsibility:** Application bootstrapper and orchestrator.
- **Details:** Sets up dependencies, triggers state hydration, initializes all observers, and kicks off the background tasks (like `setInterval` for hiding mapped chats).

### `src/state.js`
- **Responsibility:** State management and persistence.
- **Details:** Holds the global `STATE` object. Provides `loadState()` and `saveState()` functions using `chrome.storage.local`. Holds the reference to the `chrome` API passed from `content.js`.

### `src/chatCapture.js`
- **Responsibility:** User interaction tracking.
- **Details:** Attaches global `mousedown` listeners to detect when the user clicks on a chat in the native Gemini history. Extracts the chat ID, title, and URL, and stores it in `ChatState.lastClickedChat` so the Context Menu knows *which* chat to manipulate.

### `src/contextMenu.js`
- **Responsibility:** Native UI integration.
- **Details:** Uses a `MutationObserver` to watch for the creation of Gemini's native popup menus (`div[role="menu"]`). Injects a custom "Move to Project" item. Manages a dynamic submenu displaying the user's created projects.

### `src/ui.js`
- **Responsibility:** Custom UI rendering and DOM manipulation.
- **Details:** 
  - Resolves the correct native DOM anchor point to inject the custom sidebar.
  - Renders the HTML for the sidebar (`renderSidebarDOM()`).
  - Renders modals for creating and editing projects.
  - Binds event listeners for custom UI buttons such as edit, delete, remove chat, and toggle collapse.
  - Intercepts mapped chat clicks and delegates them to the equivalent native Gemini chat link by chat ID, avoiding direct location changes.
  - Actively hides native chat links that have been assigned to a project using `hideMappedChats()`.
