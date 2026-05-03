# FavoriteDocs — UI Polish Design Spec (Release 1)

**Date:** 2026-05-03  
**Status:** Approved  
**Supersedes:** Backlog items listed in `2026-05-01-favoritedocs-design.md`

---

## Overview

This spec covers five UI improvements that ship as part of the first public release. They transform the pane from a functional prototype into something that feels built into Studio Pro: native theming, icon-based types, a context-menu interaction model, and a tighter table layout.

---

## Scope

**In scope:**
- Remove Module column; show module in row tooltip
- Document type as icons (Page, Microflow, Nanoflow, Snippet; generic fallback for all others)
- Replace hover action buttons with double-click to open + right-click context menu
- Row visual states: default, active document (subtle tint), keyboard focus (blue border)
- Dark/light mode styling driven by Studio Pro's `Preferences.theme`
- Native Mendix Studio Pro styling via CSS custom property tokens

**Out of scope (release 2):**
- "Open all favorites" action
- Auto-sync on document rename
- Row action buttons (fully replaced by gestures)

---

## Table Structure

### Columns

| # | Column | Width | Content |
|---|--------|-------|---------|
| 1 | Type icon | 20px fixed | 14×14px SVG, `fill="currentColor"` |
| 2 | Name | flex/grow | Document name, truncated with ellipsis if needed |

No Module column. No Actions column.

### Row tooltip

Every row carries a native `title` attribute: `{moduleName} › {documentName}`. This surfaces module context on hover with zero custom component overhead.

### Sorting

Sort options: **Name** and **Type** only. `"moduleName"` is removed from the `SortColumn` union type in `types.ts`.

**Migration:** `storage.ts` must handle persisted files that have `sortColumn: "moduleName"` — these are silently migrated to `"documentName"` at load time.

---

## Interaction Model

### Opening a favorite

**Double-click** a row to open the document. This matches Studio Pro's App Explorer behavior.

### Removing a favorite / secondary actions

**Right-click** a row opens a context menu with two items:

1. **Open favorite** — same as double-click
2. **Remove as favorite** — removes the row from the list

The context menu is a custom `<div>` positioned at the cursor coordinates from the `contextmenu` event. It is dismissed by clicking outside it or pressing Escape.

### Keyboard navigation

- **Single click** or arrow keys move the focus ring to a row (no action taken).
- **Enter** on a focused row opens the document (same as double-click).
- **Delete** or **Backspace** on a focused row removes it immediately (no confirmation).

### Add button

The "Add current document" button at the top of the pane is unchanged.

---

## Row Visual States

Three independent visual states that can combine:

| State | Visual |
|---|---|
| **Default** | Plain row, no decoration |
| **Active document** (matches Studio Pro's currently open document) | Subtle background tint: `var(--color-row-active)` |
| **Keyboard focus** (single click or arrow key) | 1–2px border in `var(--color-focus-border)`, matching Studio Pro's App Explorer focus ring |
| **Active + focused** | Both: subtle background tint + focus border |

The previous strong blue fill for active rows is replaced by the low-opacity tint.

---

## Theming Architecture

### Studio Pro preferences

Main reads `studioPro.app.preferences` at startup to obtain `theme: "Light" | "Dark"`. It also subscribes to preference changes. When the theme changes, main broadcasts a new `studioThemeChanged` message to the pane and includes `theme` in `broadcastAll()`.

The Studio Pro `Preferences` type (containing `theme` and `language`) is distinct from our app's internal `Preferences` type (containing `sortColumn` and `sortDirection`). The Studio Pro type is consumed only in `main/index.ts` and never imported into `types.ts`.

### CSS custom properties

`PaneState` in `pane.tsx` gains a `theme: "Light" | "Dark"` field (default: `"Dark"`).

The root `FavoritesPane` component runs a `useEffect` keyed on `state.theme` that calls `document.documentElement.style.setProperty` for every token in `THEME_TOKENS`. All components reference tokens via `var(--token-*)` in their inline style strings. No CSS files are added; no build pipeline changes are needed.

```ts
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

Token values are approximations based on visual inspection of Studio Pro. They should be verified and tuned against DevTools once the pane is running.

---

## Icon Strategy

At startup, the pane attempts to access icon assets via the Extensions API. If that surface does not exist (likely given the API is in beta), it falls back to inline SVGs.

All icons use `fill="currentColor"` so they adapt automatically to both themes without additional tokens.

A `DOCUMENT_TYPE_ICONS` map in `pane.tsx` provides icons for the four supported types plus a generic fallback:

| Type string | Icon |
|---|---|
| `"Page"` | Document/page glyph |
| `"Microflow"` | Play arrow / flow arrow |
| `"Nanoflow"` | Lightning bolt |
| `"Snippet"` | Puzzle piece |
| *(anything else)* | Generic document glyph |

Icons render at 14×14px inside the 20px fixed-width icon column, vertically centered.

---

## Message Protocol Changes

### New main → pane message

```ts
{ type: "studioThemeChanged"; theme: "Light" | "Dark" }
```

### Updated broadcastAll

`broadcastAll()` in `main/index.ts` now includes `theme` alongside favorites, active document, and preferences.

---

## Types Changes

### `SortColumn` (types.ts)

```ts
// Before
type SortColumn = "moduleName" | "documentName" | "documentType";

// After
type SortColumn = "documentName" | "documentType";
```

### `PaneState` (pane.tsx)

Gains `theme: "Light" | "Dark"` with default `"Dark"`.

### Message union (types.ts)

Adds `{ type: "studioThemeChanged"; theme: "Light" | "Dark" }` to the main→pane message union.
