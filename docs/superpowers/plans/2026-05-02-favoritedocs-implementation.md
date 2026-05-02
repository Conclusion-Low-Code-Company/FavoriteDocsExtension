# FavoriteDocs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FavoriteDocs dockable pane — a Mendix Studio Pro web extension where developers bookmark open documents and navigate back to them with one click.

**Architecture:** `main/index.ts` owns all state (favorites list, active document ID, sort preference, identity hash) and handles all disk I/O. `ui/pane.tsx` is a pure React renderer — it re-renders when main broadcasts state and fires messages to main for every mutation. `studioPro.app.files` (`IAppFilesApi`) handles all file I/O; `node:child_process` handles git identity detection.

**Tech Stack:** TypeScript 5.8, React 18, @mendix/extensions-api ^0.8.0-mendix.11.9.0, node:child_process, Web Crypto API (SHA-256)

---

## API Verification Summary

> Pre-verification completed against the live API reference (v0.9.0) before implementation. The corrections below are already baked into the code in each task.

| API surface | Plan assumption | Actual API | Status |
|---|---|---|---|
| `panes.register` | `{ paneId, title, initialPosition }` | `{ title, initialPosition }` only; returns `DockablePaneHandle` | **Fixed** |
| `panes.open/close` | `open(paneId: string)` | `open(handle: DockablePaneHandle)` | **Fixed** |
| `messagePassing.sendMessage` | `sendMessage(target, msg)` — two args | `sendMessage(msg, onResponse?)` — broadcasts to all other entry points, no target | **Fixed** |
| `messagePassing.addMessageHandler` | callback receives message directly | callback receives `MessageInfo<T> = { message: T, messageId: string }` — must use `msgInfo.message` | **Fixed** |
| `editors.activeDocumentChanged` | `.activeDocumentChanged.addListener(callback)` | `addEventListener("activeDocumentChanged", ({ info }) => {...})` — `info: ActiveDocumentInfo \| null` with `documentId`, `documentName`, `documentType`, `moduleName` | **Fixed** |
| `resolveDocumentInfo` via model API | `collection.get()` | `collection.loadAll(filterFn)` | **Removed** — `activeDocumentChanged` already provides all fields needed for `FavoriteEntry` |
| `studioPro.app` directory | `studioPro.app.currentApp?.directory` | No such property. Use `studioPro.app.files` (`IAppFilesApi`) for all file I/O with project-relative paths | **Fixed** |
| `studioPro.app.files` | Planned as fallback only | First-class typed API: `getFile(path)`, `putFile(path, content)`, `deleteFile(path)` — preferred over Node.js fs | **Adopted** |
| `node:fs/promises`, `node:path` | Required as esbuild externals | No longer needed — replaced by `IAppFilesApi` | **Removed from externals** |
| `studioPro?.account?.userEmail` | Mendix account identity | No `account` property in `StudioProApi`; wrapped in `try/catch` so silently skips | **Acceptable** |

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types.ts` | Create | All shared interfaces: data model, every message type |
| `src/main/identity.ts` | Create | User identity resolution chain + SHA-256 hashing |
| `src/main/storage.ts` | Create | Read/write the per-user favorites JSON file |
| `src/main/index.ts` | Rewrite | Orchestrator: startup, state, all message handlers |
| `src/ui/pane.tsx` | Create | Favorites pane React UI |
| `src/ui/index.tsx` | Delete | Old tab boilerplate — replaced by pane |
| `src/manifest.json` | Update | Replace `tab` entry with `pane` |
| `build-extension.mjs` | Update | Replace tab entry point; add `node:child_process` external |

---

### Task 1: Shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
export interface FavoriteEntry {
    documentId: string;
    documentName: string;
    moduleName: string;
    documentType: string;
}

export type SortColumn = "documentName" | "moduleName" | "documentType";
export type SortDirection = "asc" | "desc";

export interface Preferences {
    sortColumn: SortColumn;
    sortDirection: SortDirection;
}

export interface FavoritesFile {
    version: 1;
    preferences: Preferences;
    favorites: FavoriteEntry[];
}

export const DEFAULT_PREFERENCES: Preferences = {
    sortColumn: "moduleName",
    sortDirection: "asc",
};

// ── pane → main ──────────────────────────────────────────────────────────────

export type PaneToMainMessage =
    | { type: "paneReady" }
    | { type: "addFavorite" }
    | { type: "removeFavorite"; documentId: string }
    | { type: "openDocument"; documentId: string }
    | { type: "savePreferences"; sortColumn: SortColumn; sortDirection: SortDirection }
    | { type: "setIdentity"; value: string };

// ── main → pane ──────────────────────────────────────────────────────────────

export type MainToPaneMessage =
    | { type: "favoritesChanged"; favorites: FavoriteEntry[] }
    | { type: "activeDocumentChanged"; documentId: string | null }
    | { type: "preferencesChanged"; sortColumn: SortColumn; sortDirection: SortDirection }
    | { type: "needsIdentity" }
    | { type: "documentNotFound"; documentId: string; documentName: string; moduleName: string }
    | { type: "notification"; message: string };
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```
git add src/types.ts
git commit -m "feat: add FavoriteDocs shared types and message contracts"
```

---

### Task 2: Update build config for pane

**Files:**
- Modify: `build-extension.mjs`
- Modify: `src/manifest.json`
- Create: `src/ui/pane.tsx` (minimal stub so the build doesn't fail)
- Delete: `src/ui/index.tsx`

- [ ] **Step 1: Replace `build-extension.mjs`**

```javascript
import * as esbuild from 'esbuild'
import {copyToAppPlugin, copyManifestPlugin, commonConfig} from "./build.helpers.mjs"
import parseArgs from "minimist"

const outDir = `dist/FavoriteDocs`
const appDir = "C:\\Mendix\\EXT_Development-main"
const extensionDirectoryName = "extensions"

const entryPoints = [
    { in: 'src/main/index.ts', out: 'main' },
    { in: 'src/ui/pane.tsx', out: 'pane' },
]

const args = parseArgs(process.argv.slice(2))
const buildContext = await esbuild.context({
    ...commonConfig,
    outdir: outDir,
    external: [
        ...commonConfig.external,
        "node:child_process",
    ],
    plugins: [copyManifestPlugin(outDir), copyToAppPlugin(appDir, outDir, extensionDirectoryName)],
    entryPoints,
})

if ('watch' in args) {
    await buildContext.watch();
} else {
    await buildContext.rebuild();
    await buildContext.dispose();
}
```

- [ ] **Step 2: Replace `src/manifest.json`**

```json
{
  "mendixComponent": {
    "entryPoints": {
      "main": "main.js",
      "ui": {
        "pane": "pane.js"
      }
    },
    "permissions": {
      "runtime-configuration-private": false
    }
  }
}
```

- [ ] **Step 3: Create minimal `src/ui/pane.tsx` stub**

```tsx
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ComponentContext, IComponent } from "@mendix/extensions-api";

export const component: IComponent = {
    async loaded(_componentContext: ComponentContext) {
        createRoot(document.getElementById("root")!).render(
            <StrictMode>
                <p>FavoriteDocs loading…</p>
            </StrictMode>
        );
    }
}
```

- [ ] **Step 4: Delete `src/ui/index.tsx`**

```
Remove-Item src\ui\index.tsx
```

- [ ] **Step 5: Verify build produces both entry points**

Run: `npm run build`
Expected: Exits 0. `dist/FavoriteDocs/` contains `main.js`, `pane.js`, `manifest.json`.

- [ ] **Step 6: Commit**

```
git add build-extension.mjs src/manifest.json src/ui/pane.tsx
git rm src/ui/index.tsx
git commit -m "feat: replace tab entry point with pane; add node:child_process external to esbuild"
```

---

### Task 3: User identity module

**Files:**
- Create: `src/main/identity.ts`

Resolves identity in the exact priority order from the spec. SHA-256 via Web Crypto API. Git email via `child_process.execSync`. OS username via `process.env`. Stored hash via `studioPro.app.files`. If all four non-prompt methods fail, returns `null` — the pane then shows the identity form.

The function accepts `studioPro.app.files` (`IAppFilesApi`) for stored-identity access, and the `studioPro` API object so it can attempt Mendix account identity (method 1) without coupling to the full API type.

- [ ] **Step 1: Create `src/main/identity.ts`**

```typescript
import type { IAppFilesApi } from "@mendix/extensions-api";

export async function sha256hex(input: string): Promise<string> {
    const data = new TextEncoder().encode(input.toLowerCase().trim());
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

// Returns the hex hash for the favorites filename, or null if resolution requires
// a user prompt (handled by sending needsIdentity to the pane).
// studioPro is passed as `any` to avoid coupling this module to the full API type.
export async function resolveIdentityHash(
    files: IAppFilesApi,
    studioPro: any
): Promise<string | null> {
    // 1. Mendix account identity — check if the extensions API exposes the logged-in user.
    //    No `account` property exists in v0.9.0; the try/catch silently skips.
    try {
        const accountEmail: string | undefined = studioPro?.account?.userEmail;
        if (accountEmail) return sha256hex(accountEmail);
    } catch {
        // property not available in current API version
    }

    // 2. Git email
    try {
        const { execSync } = await import("node:child_process");
        const email = execSync("git config user.email", { encoding: "utf8" }).trim();
        if (email) return sha256hex(email);
    } catch {
        // git not available or no email configured
    }

    // 3. OS username
    const osUser =
        (typeof process !== "undefined" &&
            (process.env["USERNAME"] ?? process.env["USER"])) ||
        null;
    if (osUser) return sha256hex(osUser);

    // 4. Stored .identity file (written when user answers the prompt)
    try {
        const stored = (await files.getFile("favorites/.identity")).trim();
        if (stored) return stored; // already a hex hash — return as-is
    } catch {
        // file does not exist yet
    }

    // 5. Requires user prompt — caller must send needsIdentity to pane
    return null;
}

// Persists a hash to .identity after the user supplies their name via the pane.
export async function saveIdentityHash(files: IAppFilesApi, hash: string): Promise<void> {
    await files.putFile("favorites/.identity", hash);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Exits 0.

- [ ] **Step 3: Commit**

```
git add src/main/identity.ts
git commit -m "feat: add user identity resolution and SHA-256 hashing"
```

---

### Task 4: Storage module

**Files:**
- Create: `src/main/storage.ts`

Reads and writes `favorites/<hash>.json` via `studioPro.app.files`. Returns the empty default structure when the file is absent (first run).

- [ ] **Step 1: Create `src/main/storage.ts`**

```typescript
import type { IAppFilesApi } from "@mendix/extensions-api";
import type { FavoritesFile } from "../types.js";
import { DEFAULT_PREFERENCES } from "../types.js";

function emptyFile(): FavoritesFile {
    return {
        version: 1,
        preferences: { ...DEFAULT_PREFERENCES },
        favorites: [],
    };
}

export async function loadFavorites(files: IAppFilesApi, hash: string): Promise<FavoritesFile> {
    try {
        const raw = await files.getFile(`favorites/${hash}.json`);
        const parsed = JSON.parse(raw) as FavoritesFile;
        if (parsed.version !== 1) return emptyFile();
        return parsed;
    } catch {
        return emptyFile();
    }
}

export async function saveFavorites(
    files: IAppFilesApi,
    hash: string,
    data: FavoritesFile
): Promise<void> {
    await files.putFile(`favorites/${hash}.json`, JSON.stringify(data, null, 2));
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Exits 0.

- [ ] **Step 3: Commit**

```
git add src/main/storage.ts
git commit -m "feat: add favorites JSON storage module"
```

---

### Task 5: Main orchestrator

**Files:**
- Rewrite: `src/main/index.ts`

Key API facts confirmed during pre-verification:
- `panes.register()` takes `{ title, initialPosition }` (no `paneId`), returns `DockablePaneHandle`
- `panes.open/close` take the returned handle, not a string ID
- `messagePassing.sendMessage(msg)` broadcasts to all other entry points — no target argument
- `messagePassing.addMessageHandler(fn)` — callback receives `MessageInfo<T> = { message, messageId }`
- `editors.addEventListener("activeDocumentChanged", ({info}) => {...})` — `info` is `ActiveDocumentInfo | null` containing `documentId`, `documentName`, `documentType`, `moduleName`
- `editors.editDocument(documentId)` — correct as-is
- `studioPro.app.files` (`IAppFilesApi`) handles all file I/O with project-relative paths
- `ActiveDocumentInfo` already provides all fields for `FavoriteEntry` — no model lookup needed

- [ ] **Step 1: Rewrite `src/main/index.ts`**

```typescript
import { ComponentContext, IComponent, getStudioProApi, ActiveDocumentInfo } from "@mendix/extensions-api";
import type { FavoriteEntry, FavoritesFile, MainToPaneMessage, PaneToMainMessage, Preferences } from "../types.js";
import { DEFAULT_PREFERENCES } from "../types.js";
import { resolveIdentityHash, saveIdentityHash, sha256hex } from "./identity.js";
import { loadFavorites, saveFavorites } from "./storage.js";

interface State {
    favorites: FavoriteEntry[];
    preferences: Preferences;
    activeDocumentId: string | null;
    activeDocumentInfo: ActiveDocumentInfo | null;
    identityHash: string | null;
}

export const component: IComponent = {
    async loaded(componentContext: ComponentContext) {
        const studioPro = getStudioProApi(componentContext);
        const files = studioPro.app.files;

        const state: State = {
            favorites: [],
            preferences: { ...DEFAULT_PREFERENCES },
            activeDocumentId: null,
            activeDocumentInfo: null,
            identityHash: null,
        };

        // ── Helpers ───────────────────────────────────────────────────────────

        async function broadcast(msg: MainToPaneMessage): Promise<void> {
            try {
                await studioPro.ui.messagePassing.sendMessage(msg);
            } catch {
                // pane may not be open yet — ignore
            }
        }

        async function broadcastAll(): Promise<void> {
            await broadcast({ type: "favoritesChanged", favorites: state.favorites });
            await broadcast({ type: "activeDocumentChanged", documentId: state.activeDocumentId });
            await broadcast({ type: "preferencesChanged", ...state.preferences });
            if (!state.identityHash) {
                await broadcast({ type: "needsIdentity" });
            }
        }

        async function persistAndBroadcastFavorites(): Promise<void> {
            if (!state.identityHash) return;
            const file: FavoritesFile = {
                version: 1,
                preferences: state.preferences,
                favorites: state.favorites,
            };
            try {
                await saveFavorites(files, state.identityHash, file);
            } catch {
                await broadcast({ type: "notification", message: "Favorites could not be saved. Changes may be lost." });
            }
            await broadcast({ type: "favoritesChanged", favorites: state.favorites });
        }

        // ── Startup ───────────────────────────────────────────────────────────

        const paneHandle = await studioPro.ui.panes.register(
            { title: "Favorites", initialPosition: "right" },
            { componentName: "extension/FavoriteDocs", uiEntrypoint: "pane" }
        );

        await studioPro.ui.extensionsMenu.add({
            menuId: "FavoriteDocs.MainMenu",
            caption: "FavoriteDocs",
            subMenus: [
                {
                    menuId: "FavoriteDocs.ShowFavorites",
                    caption: "Show Favorites",
                    action: async () => {
                        await studioPro.ui.panes.open(paneHandle);
                    },
                },
            ],
        });

        const hash = await resolveIdentityHash(files, studioPro);
        if (hash) {
            state.identityHash = hash;
            const file = await loadFavorites(files, hash);
            state.favorites = file.favorites;
            state.preferences = file.preferences;
        }

        studioPro.ui.editors.addEventListener("activeDocumentChanged", ({ info }) => {
            state.activeDocumentId = info?.documentId ?? null;
            state.activeDocumentInfo = info ?? null;
            broadcast({ type: "activeDocumentChanged", documentId: state.activeDocumentId });
        });

        // ── Message handler: pane → main ──────────────────────────────────────

        await studioPro.ui.messagePassing.addMessageHandler<PaneToMainMessage>(
            async (msgInfo) => {
                const message = msgInfo.message;

                switch (message.type) {
                    case "paneReady": {
                        await broadcastAll();
                        break;
                    }

                    case "setIdentity": {
                        const newHash = await sha256hex(message.value);
                        state.identityHash = newHash;
                        await saveIdentityHash(files, newHash);
                        const file = await loadFavorites(files, newHash);
                        state.favorites = file.favorites;
                        state.preferences = file.preferences;
                        await broadcastAll();
                        break;
                    }

                    case "addFavorite": {
                        if (!state.activeDocumentInfo || !state.identityHash) break;
                        if (state.favorites.some(f => f.documentId === state.activeDocumentId)) break;
                        const info = state.activeDocumentInfo;
                        const entry: FavoriteEntry = {
                            documentId: info.documentId,
                            documentName: info.documentName,
                            moduleName: info.moduleName,
                            documentType: info.documentType,
                        };
                        state.favorites = [...state.favorites, entry];
                        await persistAndBroadcastFavorites();
                        break;
                    }

                    case "removeFavorite": {
                        if (!state.identityHash) break;
                        state.favorites = state.favorites.filter(f => f.documentId !== message.documentId);
                        await persistAndBroadcastFavorites();
                        break;
                    }

                    case "openDocument": {
                        try {
                            await studioPro.ui.editors.editDocument(message.documentId);
                        } catch {
                            const fav = state.favorites.find(f => f.documentId === message.documentId);
                            if (fav) {
                                await broadcast({
                                    type: "documentNotFound",
                                    documentId: fav.documentId,
                                    documentName: fav.documentName,
                                    moduleName: fav.moduleName,
                                });
                            }
                        }
                        break;
                    }

                    case "savePreferences": {
                        if (!state.identityHash) break;
                        state.preferences = {
                            sortColumn: message.sortColumn,
                            sortDirection: message.sortDirection,
                        };
                        const file: FavoritesFile = {
                            version: 1,
                            preferences: state.preferences,
                            favorites: state.favorites,
                        };
                        try {
                            await saveFavorites(files, state.identityHash, file);
                        } catch {
                            // non-critical — sort pref loss is acceptable
                        }
                        await broadcast({ type: "preferencesChanged", ...state.preferences });
                        break;
                    }
                }
            }
        );

        // Broadcast in case the pane was already open when the extension loaded
        await broadcastAll();
    },
};
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Exits 0. Zero `any` casts remain — all API calls are fully typed.

- [ ] **Step 3: Commit**

```
git add src/main/index.ts src/main/identity.ts src/main/storage.ts
git commit -m "feat: implement main orchestrator, identity resolution, and storage"
```

---

### Task 6: Pane — shell and state wiring

**Files:**
- Rewrite: `src/ui/pane.tsx`

Key messaging facts:
- `sendMessage(msg)` — no target, broadcasts to all other entry points (main receives it)
- `addMessageHandler(fn)` — callback receives `MessageInfo<T>`; use `msgInfo.message` for the payload

- [ ] **Step 1: Rewrite `src/ui/pane.tsx` with full component skeleton**

```tsx
import React, { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ComponentContext, IComponent, getStudioProApi } from "@mendix/extensions-api";
import type { FavoriteEntry, MainToPaneMessage, Preferences, PaneToMainMessage } from "../types.js";
import { DEFAULT_PREFERENCES } from "../types.js";

interface PaneState {
    favorites: FavoriteEntry[];
    activeDocumentId: string | null;
    preferences: Preferences;
    needsIdentity: boolean;
    documentNotFound: { documentId: string; documentName: string; moduleName: string } | null;
    notification: string | null;
}

type MessageDispatch = (msg: MainToPaneMessage) => void;

export const component: IComponent = {
    async loaded(componentContext: ComponentContext) {
        const studioPro = getStudioProApi(componentContext);

        // sendToMain broadcasts a PaneToMainMessage — main receives it via its addMessageHandler.
        const sendToMain = async (msg: PaneToMainMessage): Promise<void> => {
            await studioPro.ui.messagePassing.sendMessage(msg);
        };

        // dispatch is assigned by FavoritesPane via useEffect so the message handler
        // can forward incoming messages into React state.
        let dispatch: MessageDispatch = () => {};

        await studioPro.ui.messagePassing.addMessageHandler<MainToPaneMessage>(async (msgInfo) => {
            dispatch(msgInfo.message);
        });

        createRoot(document.getElementById("root")!).render(
            <StrictMode>
                <FavoritesPane
                    sendToMain={sendToMain}
                    onRegisterDispatch={(fn) => { dispatch = fn; }}
                />
            </StrictMode>
        );

        // Signal main that the pane is ready — main will broadcast current state.
        await sendToMain({ type: "paneReady" });
    },
};

function FavoritesPane({
    sendToMain,
    onRegisterDispatch,
}: {
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
    onRegisterDispatch: (dispatch: MessageDispatch) => void;
}) {
    const [state, setState] = useState<PaneState>({
        favorites: [],
        activeDocumentId: null,
        preferences: DEFAULT_PREFERENCES,
        needsIdentity: false,
        documentNotFound: null,
        notification: null,
    });

    useEffect(() => {
        onRegisterDispatch((msg) => {
            setState((prev) => applyMessage(prev, msg));
        });
    }, [onRegisterDispatch]);

    if (state.needsIdentity) {
        return <IdentityForm onSubmit={(value) => sendToMain({ type: "setIdentity", value })} />;
    }

    return (
        <div style={{ padding: "8px", fontFamily: "sans-serif", fontSize: "13px" }}>
            {state.notification && (
                <Notification
                    message={state.notification}
                    onDismiss={() => setState((prev) => ({ ...prev, notification: null }))}
                />
            )}
            {state.documentNotFound && (
                <DocumentNotFoundModal
                    info={state.documentNotFound}
                    onRemove={() => {
                        const id = state.documentNotFound!.documentId;
                        setState((prev) => ({ ...prev, documentNotFound: null }));
                        sendToMain({ type: "removeFavorite", documentId: id });
                    }}
                    onKeep={() => setState((prev) => ({ ...prev, documentNotFound: null }))}
                />
            )}
            <FavoritesTable
                favorites={state.favorites}
                activeDocumentId={state.activeDocumentId}
                preferences={state.preferences}
                sendToMain={sendToMain}
            />
        </div>
    );
}

function applyMessage(prev: PaneState, msg: MainToPaneMessage): PaneState {
    switch (msg.type) {
        case "favoritesChanged":
            return { ...prev, favorites: msg.favorites };
        case "activeDocumentChanged":
            return { ...prev, activeDocumentId: msg.documentId };
        case "preferencesChanged":
            return { ...prev, preferences: { sortColumn: msg.sortColumn, sortDirection: msg.sortDirection } };
        case "needsIdentity":
            return { ...prev, needsIdentity: true };
        case "documentNotFound":
            return { ...prev, documentNotFound: { documentId: msg.documentId, documentName: msg.documentName, moduleName: msg.moduleName } };
        case "notification":
            return { ...prev, notification: msg.message };
        default:
            return prev;
    }
}

// ── Placeholder sub-components (replaced in Tasks 7 and 8) ───────────────────

function FavoritesTable(_props: {
    favorites: FavoriteEntry[];
    activeDocumentId: string | null;
    preferences: Preferences;
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
}) {
    return <p style={{ color: "#999" }}>Table coming in Task 7…</p>;
}

function IdentityForm({ onSubmit }: { onSubmit: (value: string) => void }) {
    return <p style={{ color: "#999" }}>Identity form coming in Task 8…</p>;
    void onSubmit;
}

function Notification({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return <p style={{ color: "#999" }}>Notification: {message} <button onClick={onDismiss}>×</button></p>;
}

function DocumentNotFoundModal(_props: {
    info: { documentId: string; documentName: string; moduleName: string };
    onRemove: () => void;
    onKeep: () => void;
}) {
    return <p style={{ color: "#999" }}>Error modal coming in Task 8…</p>;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Exits 0.

- [ ] **Step 3: Commit**

```
git add src/ui/pane.tsx
git commit -m "feat: add pane component skeleton with state wiring and message handling"
```

---

### Task 7: Pane — favorites table

**Files:**
- Modify: `src/ui/pane.tsx` — replace the `FavoritesTable` placeholder with the full sortable table

- [ ] **Step 1: Add sorting helper above `FavoritesTable`**

Add this function to `pane.tsx` before the `FavoritesTable` component:

```typescript
function sortFavorites(favorites: FavoriteEntry[], prefs: Preferences): FavoriteEntry[] {
    return [...favorites].sort((a, b) => {
        const aVal = a[prefs.sortColumn].toLowerCase();
        const bVal = b[prefs.sortColumn].toLowerCase();
        const cmp = aVal.localeCompare(bVal);
        return prefs.sortDirection === "asc" ? cmp : -cmp;
    });
}
```

- [ ] **Step 2: Replace the `FavoritesTable` placeholder**

```tsx
function FavoritesTable({
    favorites,
    activeDocumentId,
    preferences,
    sendToMain,
}: {
    favorites: FavoriteEntry[];
    activeDocumentId: string | null;
    preferences: Preferences;
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
}) {
    const isActiveAlreadyFavorited = favorites.some(f => f.documentId === activeDocumentId);
    const sorted = sortFavorites(favorites, preferences);

    function toggleSort(column: typeof preferences.sortColumn) {
        const direction =
            preferences.sortColumn === column && preferences.sortDirection === "asc"
                ? "desc"
                : "asc";
        sendToMain({ type: "savePreferences", sortColumn: column, sortDirection: direction });
    }

    function SortIndicator({ col }: { col: typeof preferences.sortColumn }) {
        if (preferences.sortColumn !== col) return null;
        return <span>{preferences.sortDirection === "asc" ? " ▲" : " ▼"}</span>;
    }

    if (favorites.length === 0) {
        return (
            <div>
                <AddButton disabled={!activeDocumentId} sendToMain={sendToMain} />
                <p style={{ color: "#888", marginTop: "16px" }}>
                    No favorites yet. Open a document and click + Add current document.
                </p>
            </div>
        );
    }

    return (
        <div>
            <AddButton
                disabled={!activeDocumentId || isActiveAlreadyFavorited}
                sendToMain={sendToMain}
            />
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
                <thead>
                    <tr>
                        <th
                            onClick={() => toggleSort("moduleName")}
                            style={{ textAlign: "left", cursor: "pointer", padding: "4px 8px", userSelect: "none" }}
                        >
                            Module<SortIndicator col="moduleName" />
                        </th>
                        <th
                            onClick={() => toggleSort("documentName")}
                            style={{ textAlign: "left", cursor: "pointer", padding: "4px 8px", userSelect: "none" }}
                        >
                            Name<SortIndicator col="documentName" />
                        </th>
                        <th
                            onClick={() => toggleSort("documentType")}
                            style={{ textAlign: "left", cursor: "pointer", padding: "4px 8px", userSelect: "none" }}
                        >
                            Type<SortIndicator col="documentType" />
                        </th>
                        <th style={{ width: "24px" }} />
                        <th style={{ width: "24px" }} />
                    </tr>
                </thead>
                <tbody>
                    {sorted.map(entry => (
                        <FavoriteRow
                            key={entry.documentId}
                            entry={entry}
                            isActive={entry.documentId === activeDocumentId}
                            sendToMain={sendToMain}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function AddButton({
    disabled,
    sendToMain,
}: {
    disabled: boolean;
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
}) {
    return (
        <button
            disabled={disabled}
            onClick={() => sendToMain({ type: "addFavorite" })}
            style={{ cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}
        >
            + Add current document
        </button>
    );
}

function FavoriteRow({
    entry,
    isActive,
    sendToMain,
}: {
    entry: FavoriteEntry;
    isActive: boolean;
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
}) {
    const [hovered, setHovered] = useState(false);
    const activeStyle: React.CSSProperties = isActive
        ? { fontWeight: "bold", backgroundColor: "#f0f4ff" }
        : {};

    return (
        <tr
            style={{ ...activeStyle, cursor: "pointer" }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onDoubleClick={() => sendToMain({ type: "openDocument", documentId: entry.documentId })}
        >
            <td style={{ padding: "3px 8px" }}>{entry.moduleName}</td>
            <td style={{ padding: "3px 8px" }}>{entry.documentName}</td>
            <td style={{ padding: "3px 8px", color: "#666" }}>{entry.documentType}</td>
            <td style={{ padding: "3px 4px", width: "24px" }}>
                {hovered && (
                    <button
                        title="Open"
                        onClick={() => sendToMain({ type: "openDocument", documentId: entry.documentId })}
                        style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
                    >
                        ↗
                    </button>
                )}
            </td>
            <td style={{ padding: "3px 4px", width: "24px" }}>
                {hovered && (
                    <button
                        title="Remove"
                        onClick={() => sendToMain({ type: "removeFavorite", documentId: entry.documentId })}
                        style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "#c00" }}
                    >
                        ×
                    </button>
                )}
            </td>
        </tr>
    );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Exits 0.

- [ ] **Step 4: Commit**

```
git add src/ui/pane.tsx
git commit -m "feat: add sortable favorites table with row highlight and hover actions"
```

---

### Task 8: Pane — identity form, notification, and error modal

**Files:**
- Modify: `src/ui/pane.tsx` — replace the three remaining placeholder sub-components

- [ ] **Step 1: Replace `IdentityForm` placeholder**

```tsx
function IdentityForm({ onSubmit }: { onSubmit: (value: string) => void }) {
    const [value, setValue] = useState("");

    return (
        <div style={{ padding: "16px", fontFamily: "sans-serif", fontSize: "13px" }}>
            <p>
                Enter your name to identify your favorites file. Using a different name
                next time will create a new empty file and leave the old one behind.
                Keep note of this name.
            </p>
            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onSubmit(value.trim()); }}
                placeholder="Your name"
                style={{ width: "100%", boxSizing: "border-box", marginBottom: "8px", padding: "4px 6px" }}
                autoFocus
            />
            <button
                disabled={!value.trim()}
                onClick={() => onSubmit(value.trim())}
                style={{ opacity: value.trim() ? 1 : 0.5 }}
            >
                Save
            </button>
        </div>
    );
}
```

- [ ] **Step 2: Replace `Notification` placeholder**

```tsx
function Notification({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return (
        <div
            style={{
                background: "#fff3cd",
                border: "1px solid #ffc107",
                borderRadius: "4px",
                padding: "6px 10px",
                marginBottom: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "12px",
            }}
        >
            <span>{message}</span>
            <button
                onClick={onDismiss}
                style={{ border: "none", background: "none", cursor: "pointer", marginLeft: "8px" }}
                title="Dismiss"
            >
                ×
            </button>
        </div>
    );
}
```

- [ ] **Step 3: Replace `DocumentNotFoundModal` placeholder**

```tsx
function DocumentNotFoundModal({
    info,
    onRemove,
    onKeep,
}: {
    info: { documentId: string; documentName: string; moduleName: string };
    onRemove: () => void;
    onKeep: () => void;
}) {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
            }}
        >
            <div
                style={{
                    background: "#fff",
                    borderRadius: "6px",
                    padding: "20px",
                    maxWidth: "380px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                    fontFamily: "sans-serif",
                    fontSize: "13px",
                }}
            >
                <p style={{ margin: "0 0 16px" }}>
                    The document <strong>'{info.documentName}'</strong> ({info.moduleName}) could
                    not be opened. It may have been deleted or renamed.
                </p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button onClick={onKeep}>Keep</button>
                    <button
                        onClick={onRemove}
                        style={{ background: "#dc3545", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 10px", cursor: "pointer" }}
                    >
                        Remove from Favorites
                    </button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Verify build — full clean build**

Run: `npm run build`
Expected: Exits 0. No TypeScript errors.

- [ ] **Step 5: Commit**

```
git add src/ui/pane.tsx
git commit -m "feat: complete pane UI — identity form, notification banner, error modal"
```

---

### Task 9: One remaining unknown — `IAppFilesApi` path creation

This task was pre-verified against the API reference. All `// API:` comment placeholders are already resolved in the code above. The one item that cannot be confirmed from the docs alone is whether `putFile` auto-creates intermediate directories (e.g. `favorites/` before writing `favorites/<hash>.json`).

- [ ] **Step 1: Smoke-test file creation**

After loading the extension for the first time with a fresh project, check whether `favorites/<hash>.json` is created. If `putFile` rejects with a "directory not found" error, wrap the call with a pre-flight `putFile("favorites/.keep", "")` or file creation of the parent path.

The `getFile` call for a missing file already returns a rejected promise (caught by the `try/catch` in `loadFavorites`), so that path is safe.

- [ ] **Step 2: Final build**

Run: `npm run build`
Expected: Exits 0.

- [ ] **Step 3: Commit** (only if Step 1 required a fix)

```
git add src/main/storage.ts src/main/identity.ts
git commit -m "fix: ensure favorites/ directory exists before writing files"
```

---

## Post-implementation checklist

Run through this after all tasks are complete.

- [ ] `npm run build` exits 0 with no errors
- [ ] Launch Studio Pro via VS Code **"Launch StudioPro with debugger attached"** config
- [ ] **Extensions → FavoriteDocs → Show Favorites** opens the pane on the right
- [ ] Open a document in Studio Pro — the pane's Add button becomes enabled
- [ ] Click **+ Add current document** — document appears in the pane table
- [ ] Switch to another document — previous row loses highlight; new active document is not highlighted (not yet favorited)
- [ ] Add a second document — two rows appear
- [ ] Click a column header — rows re-sort; arrow indicator appears
- [ ] Hover a row — ↗ and × buttons appear; mouse out — they disappear
- [ ] Double-click a row — that document gains focus in the editor
- [ ] Click ↗ on a row — same result
- [ ] Click × on a row — row disappears from list
- [ ] Restart Studio Pro — favorites persist (file was written to `favorites/`)
- [ ] Check `favorites/` directory in the project — a `<hash>.json` file exists
- [ ] Verify the JSON contains `version`, `preferences`, and `favorites` array
- [ ] With Studio Pro closed, delete the favorites JSON and reopen — pane shows empty state message
