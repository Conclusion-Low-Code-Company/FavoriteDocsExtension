# FavoriteDocs UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver native-feeling Studio Pro UX: themed token system, icon-based type column, context-menu interaction model, keyboard navigation, and module tooltip.

**Architecture:** All changes stay within four existing files. `types.ts` and `storage.ts` get narrow targeted edits. `main/index.ts` reads Studio Pro preferences at startup and adds `theme` to its state + broadcasts. `pane.tsx` is substantially reworked: a CSS custom-property token system replaces hard-coded colours, the table layout drops the Module/Type columns in favour of an icon + name layout, and a right-click context menu replaces hover action buttons.

**Tech Stack:** TypeScript, React 18, `@mendix/extensions-api` ^0.8.0, esbuild (via `npm run build`)

---

## File Map

| File | Changes |
|---|---|
| `src/types.ts` | Drop `"moduleName"` from `SortColumn`; update `DEFAULT_PREFERENCES`; add `studioThemeChanged` to `MainToPaneMessage` |
| `src/main/storage.ts` | Migrate persisted `sortColumn: "moduleName"` → `"documentName"` at load time |
| `src/main/index.ts` | Add `theme` to `State`; read `studioPro.app.preferences.getPreferences()` at startup; add `studioThemeChanged` to `broadcastAll()` |
| `src/ui/pane.tsx` | `THEME_TOKENS` map + CSS property injection; `DOCUMENT_TYPE_ICONS`; new table layout (icon + name); context menu; keyboard nav; themed components |

---

### Task 1: Update types.ts

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Update `SortColumn`, `DEFAULT_PREFERENCES`, and `MainToPaneMessage`**

Replace the entire file with:

```ts
export interface FavoriteEntry {
    documentId: string;
    documentName: string;
    moduleName: string;
    documentType: string;
}

export type SortColumn = "documentName" | "documentType";
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
    sortColumn: "documentName",
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
    | { type: "studioThemeChanged"; theme: "Light" | "Dark" }
    | { type: "needsIdentity" }
    | { type: "documentNotFound"; documentId: string; documentName: string; moduleName: string }
    | { type: "notification"; message: string };
```

- [ ] **Step 2: Build to verify**

```
npm run build
```

Expected: no TypeScript errors, bundle written to `dist/FavoriteDocs/`.

- [ ] **Step 3: Commit**

```
git add src/types.ts
git commit -m "refactor: drop moduleName sort column, add studioThemeChanged message type"
```

---

### Task 2: Migrate sortColumn in storage.ts

**Files:**
- Modify: `src/main/storage.ts`

- [ ] **Step 1: Add migration inside `loadFavorites`**

After the `if (parsed.version !== 1) return emptyFile();` check, add a migration guard:

```ts
export async function loadFavorites(files: IAppFilesApi, hash: string): Promise<FavoritesFile> {
    try {
        const raw = await files.getFile(`favorites/${hash}.json`);
        const parsed = JSON.parse(raw) as FavoritesFile;
        if (parsed.version !== 1) return emptyFile();
        // Migrate legacy sort column removed in release 1
        if ((parsed.preferences.sortColumn as string) === "moduleName") {
            parsed.preferences.sortColumn = "documentName";
        }
        return parsed;
    } catch {
        return emptyFile();
    }
}
```

- [ ] **Step 2: Build to verify**

```
npm run build
```

Expected: builds cleanly.

- [ ] **Step 3: Commit**

```
git add src/main/storage.ts
git commit -m "fix: migrate persisted sortColumn 'moduleName' to 'documentName' on load"
```

---

### Task 3: Broadcast Studio Pro theme from main/index.ts

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Add `theme` to `State` and read it at startup**

Update the `State` interface (add `theme` field):

```ts
interface State {
    favorites: FavoriteEntry[];
    preferences: Preferences;
    activeDocumentId: string | null;
    activeDocumentInfo: ActiveDocumentInfo | null;
    identityHash: string | null;
    theme: "Light" | "Dark";
}
```

Update the initial state value (add `theme: "Dark"`):

```ts
const state: State = {
    favorites: [],
    preferences: { ...DEFAULT_PREFERENCES },
    activeDocumentId: null,
    activeDocumentInfo: null,
    identityHash: null,
    theme: "Dark",
};
```

- [ ] **Step 2: Read preferences at startup and add to `broadcastAll`**

Add one `await` call just before the pane is registered (before the `studioPro.ui.panes.register` call):

```ts
const spPrefs = await studioPro.app.preferences.getPreferences();
state.theme = spPrefs.theme;
```

Update `broadcastAll()` to also send the theme:

```ts
async function broadcastAll(): Promise<void> {
    await broadcast({ type: "favoritesChanged", favorites: state.favorites });
    await broadcast({ type: "activeDocumentChanged", documentId: state.activeDocumentId });
    await broadcast({ type: "preferencesChanged", ...state.preferences });
    await broadcast({ type: "studioThemeChanged", theme: state.theme });
    if (!state.identityHash) {
        await broadcast({ type: "needsIdentity" });
    }
}
```

Note: `IPreferencesApi` has no change-listener — the theme is read once at startup. If Studio Pro's theme changes mid-session the pane will not update automatically.

- [ ] **Step 3: Build to verify**

```
npm run build
```

Expected: builds cleanly.

- [ ] **Step 4: Commit**

```
git add src/main/index.ts
git commit -m "feat: read Studio Pro theme at startup and broadcast to pane"
```

---

### Task 4: CSS token system in pane.tsx

**Files:**
- Modify: `src/ui/pane.tsx`

- [ ] **Step 1: Add `THEME_TOKENS` constant and update `PaneState`**

At the top of the file, right after the imports, add:

```ts
// ── Design tokens ─────────────────────────────────────────────────────────────

const THEME_TOKENS: Record<"Light" | "Dark", Record<string, string>> = {
    Dark: {
        "--color-bg":           "#1e1e1e",
        "--color-row-hover":    "#2a2d2e",
        "--color-row-active":   "rgba(74,171,243,0.12)",
        "--color-focus-border": "#4babf3",
        "--color-text":         "#cccccc",
        "--color-text-muted":   "#888888",
        "--color-border":       "#3c3c3c",
        "--color-btn-bg":       "#313131",
        "--color-btn-hover":    "#3d3d3d",
        "--color-menu-bg":      "#252526",
        "--color-menu-hover":   "#2a2d2e",
        "--font-family":        '"Segoe UI", system-ui, sans-serif',
        "--font-size":          "12px",
    },
    Light: {
        "--color-bg":           "#f3f3f3",
        "--color-row-hover":    "#e8e8e8",
        "--color-row-active":   "rgba(74,171,243,0.15)",
        "--color-focus-border": "#4babf3",
        "--color-text":         "#1e1e1e",
        "--color-text-muted":   "#717171",
        "--color-border":       "#d4d4d4",
        "--color-btn-bg":       "#e1e1e1",
        "--color-btn-hover":    "#d5d5d5",
        "--color-menu-bg":      "#ffffff",
        "--color-menu-hover":   "#e8e8e8",
        "--font-family":        '"Segoe UI", system-ui, sans-serif',
        "--font-size":          "12px",
    },
};
```

Update `PaneState` to include `theme`:

```ts
interface PaneState {
    favorites: FavoriteEntry[];
    activeDocumentId: string | null;
    preferences: Preferences;
    theme: "Light" | "Dark";
    needsIdentity: boolean;
    documentNotFound: { documentId: string; documentName: string; moduleName: string } | null;
    notification: string | null;
}
```

Update the initial `useState` call inside `FavoritesPane` to include `theme: "Dark"`:

```ts
const [state, setState] = useState<PaneState>({
    favorites: [],
    activeDocumentId: null,
    preferences: DEFAULT_PREFERENCES,
    theme: "Dark",
    needsIdentity: false,
    documentNotFound: null,
    notification: null,
});
```

- [ ] **Step 2: Add token injection `useEffect` and handle `studioThemeChanged` in `applyMessage`**

Add a second `useEffect` inside `FavoritesPane`, right after the existing dispatch registration one:

```ts
useEffect(() => {
    const tokens = THEME_TOKENS[state.theme];
    for (const [key, value] of Object.entries(tokens)) {
        document.documentElement.style.setProperty(key, value);
    }
}, [state.theme]);
```

Add a case to `applyMessage`:

```ts
case "studioThemeChanged":
    return { ...prev, theme: msg.theme };
```

- [ ] **Step 3: Build to verify**

```
npm run build
```

Expected: builds cleanly.

- [ ] **Step 4: Commit**

```
git add src/ui/pane.tsx
git commit -m "feat: inject CSS custom property tokens driven by Studio Pro theme"
```

---

### Task 5: Document type icon map in pane.tsx

**Files:**
- Modify: `src/ui/pane.tsx`

- [ ] **Step 1: Add icon helper, icon constants, and `getDocumentTypeIcon`**

Add after `THEME_TOKENS`, before the `component` export. Icons use outline/stroke style to match Studio Pro's App Explorer icon aesthetic. The generic icon is the "arrow-from-box" (open-in-new) icon shown in Studio Pro. Paths should be visually verified against Studio Pro in DevTools and fine-tuned if needed.

```tsx
// ── Document type icons ───────────────────────────────────────────────────────

function TypeIcon({ children }: { children: React.ReactNode }): React.ReactElement {
    return (
        <svg
            width="14" height="14" viewBox="0 0 14 14"
            fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ display: "block", flexShrink: 0 }}
        >
            {children}
        </svg>
    );
}

// Page: document outline with folded top-right corner
const PAGE_ICON = (
    <TypeIcon>
        <path d="M2 1h6l4 4v8H2z"/>
        <polyline points="8,1 8,5 12,5"/>
    </TypeIcon>
);

// Microflow: circle with play triangle inside
const MICROFLOW_ICON = (
    <TypeIcon>
        <circle cx="7" cy="7" r="5.5"/>
        <path d="M5.5 4.5l5 2.5-5 2.5z"/>
    </TypeIcon>
);

// Nanoflow: lightning bolt (outline)
const NANOFLOW_ICON = (
    <TypeIcon>
        <path d="M9 1L4 8h4l-3 5 8-8H9z"/>
    </TypeIcon>
);

// Snippet: two overlapping rectangles (reusable piece)
const SNIPPET_ICON = (
    <TypeIcon>
        <rect x="1" y="4" width="8" height="7"/>
        <path d="M5 1h8v7h-2"/>
    </TypeIcon>
);

// Generic: arrow-from-box (open-in-new) — matches Studio Pro's document icon style
const GENERIC_ICON = (
    <TypeIcon>
        <polyline points="8,1 13,1 13,6"/>
        <line x1="13" y1="1" x2="6" y2="8"/>
        <path d="M6 4H2v8h8V8"/>
    </TypeIcon>
);

const DOCUMENT_TYPE_ICONS: Partial<Record<string, React.ReactElement>> = {
    Page: PAGE_ICON,
    Microflow: MICROFLOW_ICON,
    Nanoflow: NANOFLOW_ICON,
    Snippet: SNIPPET_ICON,
};

function getDocumentTypeIcon(type: string): React.ReactElement {
    return DOCUMENT_TYPE_ICONS[type] ?? GENERIC_ICON;
}
```

- [ ] **Step 2: Build to verify**

```
npm run build
```

Expected: builds cleanly.

- [ ] **Step 3: Commit**

```
git add src/ui/pane.tsx
git commit -m "feat: add document type icon map with Page, Microflow, Nanoflow, Snippet SVGs"
```

---

### Task 6: Restructure FavoritesTable and FavoriteRow

**Files:**
- Modify: `src/ui/pane.tsx`

This task replaces the bodies of `FavoritesTable` and `FavoriteRow`. It wires up the icon column, the name column with tooltip, row visual states (active tint + focus border), and double-click open. Context menu and keyboard nav are added in the next two tasks.

- [ ] **Step 1: Replace `FavoriteRow`**

Remove the current `FavoriteRow` function entirely and replace it with:

```tsx
function FavoriteRow({
    entry,
    isActive,
    isFocused,
    onFocus,
    onDoubleClick,
    onContextMenu,
}: {
    entry: FavoriteEntry;
    isActive: boolean;
    isFocused: boolean;
    onFocus: () => void;
    onDoubleClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
}) {
    const [hovered, setHovered] = useState(false);

    const rowStyle: React.CSSProperties = {
        cursor: "pointer",
        outline: isFocused ? "1px solid var(--color-focus-border)" : "none",
        outlineOffset: "-1px",
        backgroundColor: isActive
            ? "var(--color-row-active)"
            : hovered
            ? "var(--color-row-hover)"
            : "transparent",
        color: "var(--color-text)",
    };

    return (
        <tr
            style={rowStyle}
            title={`${entry.moduleName} › ${entry.documentName}`}
            onClick={onFocus}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <td style={{ padding: "3px 4px", width: "20px", lineHeight: 0 }}>
                {getDocumentTypeIcon(entry.documentType)}
            </td>
            <td style={{
                padding: "3px 8px",
                maxWidth: "0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}>
                {entry.documentName}
            </td>
        </tr>
    );
}
```

- [ ] **Step 2: Replace `FavoritesTable`**

Remove the current `FavoritesTable` function entirely and replace it with (keyboard nav and context menu state are stubs here, wired in the next two tasks):

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
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; documentId: string } | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const isActiveAlreadyFavorited = favorites.some(f => f.documentId === activeDocumentId);
    const sorted = sortFavorites(favorites, preferences);

    // Clear focus if focused entry was removed externally
    useEffect(() => {
        if (focusedId !== null && !favorites.some(f => f.documentId === focusedId)) {
            setFocusedId(null);
        }
    }, [favorites, focusedId]);

    function toggleSort(column: SortColumn) {
        const direction =
            preferences.sortColumn === column && preferences.sortDirection === "asc" ? "desc" : "asc";
        sendToMain({ type: "savePreferences", sortColumn: column, sortDirection: direction });
    }

    function SortIndicator({ col }: { col: SortColumn }) {
        if (preferences.sortColumn !== col) return null;
        return <span>{preferences.sortDirection === "asc" ? " ▲" : " ▼"}</span>;
    }

    if (favorites.length === 0) {
        return (
            <div>
                <AddButton disabled={!activeDocumentId} sendToMain={sendToMain} />
                <p style={{ color: "var(--color-text-muted)", marginTop: "16px", fontFamily: "var(--font-family)", fontSize: "var(--font-size)" }}>
                    No favorites yet. Open a document and click + Add current document.
                </p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            style={{ outline: "none" }}
        >
            <AddButton disabled={!activeDocumentId || isActiveAlreadyFavorited} sendToMain={sendToMain} />
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px", tableLayout: "fixed", fontFamily: "var(--font-family)", fontSize: "var(--font-size)" }}>
                <colgroup>
                    <col style={{ width: "28px" }} />
                    <col />
                </colgroup>
                <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                        <th style={{ padding: "4px 4px", userSelect: "none", fontWeight: "normal" }} />
                        <th
                            onClick={() => toggleSort("documentName")}
                            style={{ textAlign: "left", cursor: "pointer", padding: "4px 8px", userSelect: "none", fontWeight: "normal" }}
                        >
                            Name<SortIndicator col="documentName" />
                        </th>
                        <th
                            onClick={() => toggleSort("documentType")}
                            style={{ textAlign: "left", cursor: "pointer", padding: "4px 8px", userSelect: "none", fontWeight: "normal", width: "60px" }}
                        >
                            Type<SortIndicator col="documentType" />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map(entry => (
                        <FavoriteRow
                            key={entry.documentId}
                            entry={entry}
                            isActive={entry.documentId === activeDocumentId}
                            isFocused={entry.documentId === focusedId}
                            onFocus={() => {
                                setFocusedId(entry.documentId);
                                containerRef.current?.focus();
                            }}
                            onDoubleClick={() => sendToMain({ type: "openDocument", documentId: entry.documentId })}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setFocusedId(entry.documentId);
                                setContextMenu({ x: e.clientX, y: e.clientY, documentId: entry.documentId });
                            }}
                        />
                    ))}
                </tbody>
            </table>
            {/* ContextMenu is rendered here in Task 7 */}
        </div>
    );
}
```

Note: `SortColumn` is now imported from types — add it to the import at the top of the file if not already imported:

```ts
import type { FavoriteEntry, MainToPaneMessage, Preferences, PaneToMainMessage, SortColumn } from "../types.js";
```

- [ ] **Step 3: Build to verify**

```
npm run build
```

Expected: clean build. (`contextMenu` state is declared but the `ContextMenu` component render is a comment placeholder — no TypeScript error.)

- [ ] **Step 4: Commit**

```
git add src/ui/pane.tsx
git commit -m "feat: restructure table — icon+name columns, row visual states, double-click open"
```

---

### Task 7: Context menu component

**Files:**
- Modify: `src/ui/pane.tsx`

- [ ] **Step 1: Add `ContextMenuItem` and `ContextMenu` components**

Add after `FavoritesTable` (before `AddButton`). `ContextMenuItem` must be a top-level function (not nested) to satisfy React's hook rules:

```tsx
function ContextMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            style={{
                padding: "6px 12px",
                cursor: "pointer",
                background: hovered ? "var(--color-menu-hover)" : "transparent",
                color: "var(--color-text)",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={onClick}
        >
            {label}
        </div>
    );
}

function ContextMenu({
    x,
    y,
    documentId,
    onClose,
    sendToMain,
}: {
    x: number;
    y: number;
    documentId: string;
    onClose: () => void;
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
}) {
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <>
            {/* Click-outside overlay */}
            <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={onClose} />
            <div style={{
                position: "fixed",
                left: x,
                top: y,
                background: "var(--color-menu-bg)",
                border: "1px solid var(--color-border)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                zIndex: 1000,
                fontFamily: "var(--font-family)",
                fontSize: "var(--font-size)",
                minWidth: "172px",
            }}>
                <ContextMenuItem
                    label="Open favorite"
                    onClick={() => {
                        sendToMain({ type: "openDocument", documentId });
                        onClose();
                    }}
                />
                <ContextMenuItem
                    label="Remove as favorite"
                    onClick={() => {
                        sendToMain({ type: "removeFavorite", documentId });
                        onClose();
                    }}
                />
            </div>
        </>
    );
}
```

- [ ] **Step 2: Replace the comment placeholder in `FavoritesTable` with the real render**

Inside `FavoritesTable`'s return block, find the line:

```tsx
            {/* ContextMenu is rendered here in Task 7 */}
```

Replace it with:

```tsx
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    documentId={contextMenu.documentId}
                    onClose={() => setContextMenu(null)}
                    sendToMain={sendToMain}
                />
            )}
```

- [ ] **Step 3: Build to verify (clean build)**

```
npm run build
```

Expected: no errors, bundle written to `dist/FavoriteDocs/`.

- [ ] **Step 4: Commit**

```
git add src/ui/pane.tsx
git commit -m "feat: add right-click context menu — Open favorite and Remove as favorite"
```

---

### Task 8: Keyboard navigation

**Files:**
- Modify: `src/ui/pane.tsx`

- [ ] **Step 1: Add `handleKeyDown` to `FavoritesTable` and wire it to the container**

Inside `FavoritesTable`, add this function (before the `return` statements):

```ts
function handleKeyDown(e: React.KeyboardEvent) {
    if (sorted.length === 0) return;
    const idx = sorted.findIndex(f => f.documentId === focusedId);

    if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedId(sorted[idx === -1 ? 0 : Math.min(idx + 1, sorted.length - 1)].documentId);
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedId(sorted[idx === -1 ? sorted.length - 1 : Math.max(idx - 1, 0)].documentId);
    } else if (e.key === "Enter" && focusedId) {
        sendToMain({ type: "openDocument", documentId: focusedId });
    } else if ((e.key === "Delete" || e.key === "Backspace") && focusedId) {
        e.preventDefault();
        const nextIdx = idx + 1 < sorted.length ? idx + 1 : idx - 1;
        const nextId = nextIdx >= 0 ? (sorted[nextIdx]?.documentId ?? null) : null;
        sendToMain({ type: "removeFavorite", documentId: focusedId });
        setFocusedId(nextId);
    }
}
```

Add `onKeyDown={handleKeyDown}` to the container `<div>`:

```tsx
<div
    ref={containerRef}
    tabIndex={0}
    style={{ outline: "none" }}
    onKeyDown={handleKeyDown}
>
```

- [ ] **Step 2: Build to verify**

```
npm run build
```

Expected: builds cleanly.

- [ ] **Step 3: Commit**

```
git add src/ui/pane.tsx
git commit -m "feat: add keyboard navigation — arrow keys, Enter to open, Delete to remove"
```

---

### Task 9: Theme remaining components

**Files:**
- Modify: `src/ui/pane.tsx`

This task updates `FavoritesPane` (root container), `AddButton`, `Notification`, `DocumentNotFoundModal`, and `IdentityForm` to use CSS tokens instead of hard-coded colours/fonts.

- [ ] **Step 1: Update `FavoritesPane` root container style**

Change the root `<div>` in `FavoritesPane` (the one returned when `!needsIdentity`):

```tsx
<div style={{ padding: "8px", fontFamily: "var(--font-family)", fontSize: "var(--font-size)", background: "var(--color-bg)", color: "var(--color-text)", height: "100%", boxSizing: "border-box" }}>
```

- [ ] **Step 2: Update `AddButton`**

Replace the current `AddButton` function with:

```tsx
function AddButton({
    disabled,
    sendToMain,
}: {
    disabled: boolean;
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            disabled={disabled}
            onClick={() => sendToMain({ type: "addFavorite" })}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                fontFamily: "var(--font-family)",
                fontSize: "var(--font-size)",
                color: "var(--color-text)",
                background: hovered && !disabled ? "var(--color-btn-hover)" : "var(--color-btn-bg)",
                border: "1px solid var(--color-border)",
                padding: "4px 10px",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.5 : 1,
                width: "100%",
            }}
        >
            + Add current document
        </button>
    );
}
```

- [ ] **Step 3: Update `Notification`**

Replace the current `Notification` function with:

```tsx
function Notification({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return (
        <div style={{
            background: "var(--color-btn-bg)",
            border: "1px solid var(--color-border)",
            padding: "6px 10px",
            marginBottom: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "var(--font-family)",
            fontSize: "var(--font-size)",
            color: "var(--color-text)",
        }}>
            <span>{message}</span>
            <button
                onClick={onDismiss}
                style={{ border: "none", background: "none", cursor: "pointer", marginLeft: "8px", color: "var(--color-text)", fontSize: "var(--font-size)" }}
                title="Dismiss"
            >
                ×
            </button>
        </div>
    );
}
```

- [ ] **Step 4: Update `DocumentNotFoundModal`**

Replace the current `DocumentNotFoundModal` function with:

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
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
        }}>
            <div style={{
                background: "var(--color-menu-bg)",
                border: "1px solid var(--color-border)",
                padding: "20px",
                maxWidth: "380px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                fontFamily: "var(--font-family)",
                fontSize: "var(--font-size)",
                color: "var(--color-text)",
            }}>
                <p style={{ margin: "0 0 16px" }}>
                    The document <strong>'{info.documentName}'</strong> ({info.moduleName}) could
                    not be opened. It may have been deleted or renamed.
                </p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button
                        onClick={onKeep}
                        style={{ fontFamily: "var(--font-family)", fontSize: "var(--font-size)", color: "var(--color-text)", background: "var(--color-btn-bg)", border: "1px solid var(--color-border)", padding: "4px 10px", cursor: "pointer" }}
                    >
                        Keep
                    </button>
                    <button
                        onClick={onRemove}
                        style={{ fontFamily: "var(--font-family)", fontSize: "var(--font-size)", color: "#fff", background: "#c0392b", border: "none", padding: "4px 10px", cursor: "pointer" }}
                    >
                        Remove from Favorites
                    </button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 5: Update `IdentityForm`**

Replace the current `IdentityForm` function with:

```tsx
function IdentityForm({ onSubmit }: { onSubmit: (value: string) => void }) {
    const [value, setValue] = useState("");

    return (
        <div style={{ padding: "16px", fontFamily: "var(--font-family)", fontSize: "var(--font-size)", background: "var(--color-bg)", color: "var(--color-text)", height: "100%", boxSizing: "border-box" }}>
            <p style={{ marginTop: 0 }}>
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
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginBottom: "8px",
                    padding: "4px 6px",
                    fontFamily: "var(--font-family)",
                    fontSize: "var(--font-size)",
                    background: "var(--color-btn-bg)",
                    color: "var(--color-text)",
                    border: "1px solid var(--color-border)",
                }}
                autoFocus
            />
            <button
                disabled={!value.trim()}
                onClick={() => onSubmit(value.trim())}
                style={{
                    fontFamily: "var(--font-family)",
                    fontSize: "var(--font-size)",
                    color: "var(--color-text)",
                    background: "var(--color-btn-bg)",
                    border: "1px solid var(--color-border)",
                    padding: "4px 10px",
                    cursor: value.trim() ? "pointer" : "default",
                    opacity: value.trim() ? 1 : 0.5,
                }}
            >
                Save
            </button>
        </div>
    );
}
```

- [ ] **Step 6: Build to verify (full clean build)**

```
npm run build
```

Expected: no errors, bundle written to `dist/FavoriteDocs/`. Verify the extension deploys to `C:\Mendix\EXT_Development-main\extensions\FavoriteDocs\`.

- [ ] **Step 7: Manual smoke test in Studio Pro**

Open Studio Pro with the debug launch config. Verify:
- Pane background and text match Studio Pro's current theme (dark or light)
- Table shows icon column + Name column (no Module or Type columns)
- Hovering a row shows a tooltip: `{module} › {name}`
- Double-clicking opens the document
- Right-clicking shows context menu with "Open favorite" / "Remove as favorite"
- Context menu dismisses on click-outside or Escape
- Arrow up/down navigates rows (focus ring appears on focused row)
- Enter opens the focused document
- Delete/Backspace removes the focused document and moves focus to the next row
- Active document row has a subtle blue tint (not the strong blue fill)

- [ ] **Step 8: Commit**

```
git add src/ui/pane.tsx
git commit -m "feat: apply CSS token theming to all pane components"
```
