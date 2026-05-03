# FavoriteDocs — Backlog

Items marked **release 2** are the next planned batch. Everything else is unscheduled.

---

## Release 2

- **Default pane position to left** — change `initialPosition` from `"right"` to `"left"` in `main/index.ts` (one-line change) so the pane opens on the App Explorer side by default. A truly pinned/non-dockable panel is not available in the Extensions API v0.8.0.

- **Rethink identity / filename UX** — the current flow hashes a user-supplied name into an opaque filename. Improvements to consider:
  1. Keep the name human-readable in the filename so the file is recognisable in git
  2. On first run, show any existing favorites files in the project and let the user pick one (or create new) — makes cross-machine reuse easy
  3. The name could double as a display label in the pane header (e.g. "Bart's favorites")

---

## Unscheduled

- **Open all favorites** — open every favorited document as an editor tab simultaneously. Needs UX consideration for large lists.

- **Auto-refresh on document rename** — when a document is renamed in the model, update the stored name in the favorites file automatically. Currently the stored name becomes stale (the document still opens correctly via ID).

- **Clear all favorites** — a single "Remove all" action in the pane with a confirmation step to avoid accidental data loss.

- **Right-click context menu in App Explorer** — add the current document to favorites directly from the App Explorer context menu. Not available in the Studio Pro 11 web extension API yet.

---

## Won't do / API limitations

- **Always-visible fixed panel** — a non-dockable panel permanently visible above the App Explorer. Not available in Extensions API v0.8.0 (only `"left"` | `"right"` | `"bottom"` dockable panes exist).

- **Auto-detect user identity** — resolving identity from Git email or OS username requires Node.js APIs (`child_process`, `process.env`) that are not available in the sandboxed webview runtime. The stored `.identity` file (written after first-run prompt) is the only reliable mechanism until Mendix exposes account info in the Extensions API.
