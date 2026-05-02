# FavoriteDocs Extension — Design Spec

**Date:** 2026-05-01  
**Status:** Approved

---

## Overview

A Mendix Studio Pro web extension that lets developers mark any document as a favorite and access their favorites from a persistent dockable pane. Favorites are stored per-user in the project directory and committed to git.

---

## Scope

**In scope (v1):**
- Add the active document to favorites via a button in the Favorites pane
- Remove a favorite via a hover × button in the pane
- Open a favorite via double-click or a hover ↗ button
- Dockable Favorites pane with a sortable table
- Highlight the currently active document in the pane
- Per-user favorites file stored in the project and committed to git
- Privacy-preserving hashed filename

**Backlog (not in v1):**
- "Open all favorites" action
- Auto-sync on document rename
- Right-click context menu in App Explorer (not available in the SP11 web extension API)

---

## Architecture

### Entry Points

| Entry point | Role |
|---|---|
| `main/index.ts` | Permanent orchestrator. Owns all state (favorites list, active document, sort preference). Handles all disk I/O. |
| `ui/pane.tsx` | Favorites pane React UI. Stateless from a persistence perspective — renders what main broadcasts. |

### Startup Sequence

1. `main` resolves user identity and derives the hash (see User Identity section).
2. `main` reads `favorites/<hash>.json` from the app directory. If absent, starts with an empty list and default preferences.
3. `main` registers the dockable pane via `studioPro.ui.panes.register` with `initialPosition: "right"`.
4. `main` subscribes to `studioPro.ui.editors.activeDocumentChanged` and broadcasts the active document ID to the pane.
5. `main` adds an Extensions menu item: **FavoriteDocs → Show Favorites** that opens/shows the pane.

### Message Passing (main ↔ pane)

| Direction | Message type | Payload | Description |
|---|---|---|---|
| pane → main | `addFavorite` | — | Add the currently active document |
| pane → main | `removeFavorite` | `{ documentId }` | Remove a specific favorite |
| pane → main | `openDocument` | `{ documentId }` | Open document in editor |
| pane → main | `savePreferences` | `{ sortColumn, sortDirection }` | Persist sort preference |
| main → pane | `favoritesChanged` | `{ favorites }` | Full updated favorites array |
| main → pane | `activeDocumentChanged` | `{ documentId \| null }` | Currently active document |
| main → pane | `preferencesChanged` | `{ sortColumn, sortDirection }` | Current sort preference |

When the pane opens, main immediately broadcasts current `favoritesChanged`, `activeDocumentChanged`, and `preferencesChanged` so the pane renders correct state from the start.

---

## Data Model

### File location

```
<app-root>/favorites/<sha256hash>.json
```

The `favorites/` folder is part of the project and should be committed to git. It must **not** be added to `.gitignore`.

### JSON structure

```json
{
  "version": 1,
  "preferences": {
    "sortColumn": "moduleName",
    "sortDirection": "asc"
  },
  "favorites": [
    {
      "documentId": "abc123",
      "documentName": "Home_Web",
      "moduleName": "MyFirstModule",
      "documentType": "Page"
    }
  ]
}
```

**Fields:**

| Field | Description |
|---|---|
| `version` | Schema version for future migrations. Currently `1`. |
| `preferences.sortColumn` | One of `"documentName"`, `"moduleName"`, `"documentType"`. Default: `"moduleName"`. |
| `preferences.sortDirection` | `"asc"` or `"desc"`. Default: `"asc"`. |
| `favorites[].documentId` | Used internally to open and highlight the document. |
| `favorites[].documentName` | Displayed in the pane. Captured at the time of favoriting. |
| `favorites[].moduleName` | Displayed alongside the document name. |
| `favorites[].documentType` | Displayed as a small type label (e.g. `Page`, `Microflow`). |

The `favorites` array is stored in insertion order. Sorting is display-only and does not affect the stored order.

---

## User Identity

Identity resolution is attempted in order. The first success is used.

1. **Mendix account identity** — check if the extension API exposes the logged-in user at implementation time.
2. **Git email** — `git config user.email` via shell.
3. **OS username** — `process.env.USERNAME` (Windows) / `process.env.USER` (Mac/Linux).
4. **Stored identity file** — if `favorites/.identity` exists, use the hash stored there (from a previous prompt).
5. **User prompt** — show a modal dialog asking the user to enter a name. Warn clearly:
   > "This name identifies your favorites file. Using a different name next time will create a new empty file and leave the old one behind. Keep note of this name."

   The entered value is hashed and saved to `favorites/.identity` so the user is prompted only once.

**Hashing:** The resolved identity value is lowercased, trimmed, and SHA-256 hashed. The raw value is never written to disk or logged.

**Failure:** If all five methods fail, the extension shows a notification and disables itself gracefully without crashing.

---

## Pane UI

### Table layout

The pane renders a table with three sortable columns:

| Module | Name | Type |  |  |
|---|---|---|---|---|
| OrderModule | SUB_CreateOrder | Microflow | ↗ | × |
| MyFirstModule | Home_Web | Page | ↗ | × |

- Column headers are clickable. Clicking a header sorts by that column ascending; clicking again reverses to descending. An arrow indicator shows the active sort column and direction.
- The ↗ (open) and × (remove) action buttons appear on row hover only.
- The row matching the currently active document is highlighted (bold or background tint).
- Sorting is client-side in the pane. When sort preference changes, the pane sends `savePreferences` to main.

### Opening a document

- **Double-click** a row, or click the **↗ button** on hover.
- Sends `openDocument` to main → main calls `studioPro.ui.editors.editDocument(documentId)`.
- If the document is already open in an editor tab, Studio Pro brings it to focus.

### Adding a favorite

- A **"+ Add current document"** button at the top of the pane.
- Disabled when no document is active or the active document is already in the list.
- Clicking sends `addFavorite` to main.

### Removing a favorite

- The **× button** appears on row hover.
- Clicking sends `removeFavorite` to main. No confirmation dialog.

### Empty state

When the list is empty:
> "No favorites yet. Open a document and click + Add current document."

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Document not found when opening (deleted/renamed) | Show modal dialog: "The document **'Name'** (Module) could not be opened. It may have been deleted or renamed." Buttons: **Remove from Favorites** / **Keep**. |
| Duplicate add | "Add current document" button is disabled if the active document is already in the list. |
| File write failure | Show notification: "Favorites could not be saved. Changes may be lost." In-memory state still updated for the session. |
| No active document | "Add current document" button is disabled. Highlight shows nothing. |
| Pane opened before any document is active | Correct state — no highlight, button disabled. |
| Document renamed | Stored name becomes stale for v1. Document still opens correctly via ID. Rename sync is backlog. |

---

## File Structure (after implementation)

```
src/
  main/
    index.ts          # Orchestrator, startup, message handling, disk I/O
  ui/
    pane.tsx          # Favorites pane React component
  manifest.json
favorites/            # Created at runtime, committed to git
  <hash>.json         # Per-user favorites + preferences
  .identity           # Hash only, written when user is prompted (fallback 4/5)
```

---

## Backlog

- "Open all favorites" — open every favorited document as an editor tab simultaneously. Needs UX consideration for large lists.
- Auto-refresh document names when a document is renamed in the model.
- Right-click context menu in App Explorer — not yet available in the SP11 web extension API.
- **Remove all favorites button** — a single "Clear all" action in the pane (with a confirmation step to avoid accidental data loss).
- **Row action buttons always visible** — show ↗ and × inline at all times instead of on hover only; reduces discoverability friction, especially for keyboard/touch users.
- **Dark / light mode styling** — detect and respond to the OS or Studio Pro theme preference so the pane feels consistent in both modes.
- **Native Mendix Studio Pro styling** — adopt Studio Pro's UI design language (fonts, colors, spacing, control shapes) so the pane looks built-in rather than like an embedded web page.
- **Remove Module column** — drop the Module column from the table to save horizontal space; module context can be inferred from the document name or shown on hover.
- **Document type as icons** — replace the Type text column with a small icon per document type (Page, Microflow, etc.) to reduce column width and improve scannability.
