# FavoriteDocs — Backlog

- **Default pane position to left** — change `initialPosition` from `"right"` to `"left"` in `main/index.ts` (one-line change) so the pane opens on the App Explorer side by default. A truly pinned/non-dockable panel is not available in the Extensions API v0.8.0.

- **Remember last selected list across restarts** — when Studio Pro is reopened, automatically pre-select the list the user had open in the previous session, so they don't have to pick from the dropdown every time. Currently the selection resets on every restart and the user must choose again.

- **Auto-identify the current user** — detect who is opening Studio Pro and automatically select their favorites list without any prompt. Could use the Studio Pro account, git username, or a similar signal when the API supports it. If implemented, would also skip the first-run creation prompt for users whose name already matches an existing list. Should not be a breaking change — fall back to the dropdown if identification fails.

- **Show version number in top-right corner** — display the extension version (from `manifest.json`) in the top-right corner of the pane for easy reference during testing and support.

- **Open all favorites** — open every favorited document as an editor tab simultaneously. Needs UX consideration for large lists.

- **Auto-refresh on document rename** — when a document is renamed in the model, update the stored name in the favorites file automatically. Currently the stored name becomes stale (the document still opens correctly via ID).

- **Clear all favorites** — a single "Remove all" action in the pane with a confirmation step to avoid accidental data loss.

- **Right-click context menu in App Explorer** — add the current document to favorites directly from the App Explorer context menu. Not available in the Studio Pro 11 web extension API yet.

---

## Won't do / API limitations

- **Always-visible fixed panel** — a non-dockable panel permanently visible above the App Explorer. Not available in Extensions API v0.8.0 (only `"left"` | `"right"` | `"bottom"` dockable panes exist).
