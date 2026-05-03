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

## Known bugs

### Identity not persisted across Studio Pro restarts

**Symptom:** User is prompted for their name every time Studio Pro restarts. When the same name is re-entered, existing favorites are found correctly — so the data is fine, but the identity lookup fails on startup.

**Root cause — still unresolved:** The extension needs to remember *which* favorites file belongs to the current user between sessions. Several approaches have been tried, all failing for the same underlying reason: `IAppFilesApi` has severe limitations that are not documented:

1. **`getFile()` with dotfiles** (e.g. `favorites/.identity`) — silently throws; the file exists on disk but the API cannot read it.
2. **`getFile()` with extensionless files** (e.g. `favorites/identity`) — same silent failure.
3. **`getFile("favorites/identity.json")`** — file is written correctly but `getFile` still fails on read. Suspected cause: `putFile` silently fails if the `favorites/` directory does not exist yet at the time of the call (the directory is only created when the first `*.json` favorites file is written). Even after working around this by writing identity inside `persistAndBroadcastFavorites`, the read still fails — exact reason unknown.
4. **`getFiles("favorites/*.json")` auto-discovery** — lists files and extracts key from filename. Fails in two ways: (a) unknown path format returned by `getFiles` on Windows may break the filename extraction; (b) breaks as soon as more than one favorites file exists in the directory (e.g. after testing with multiple names), because the single-file auto-select logic no longer applies.

**Current state of the code:** approach 4 (`getFiles` discovery) is in place but unreliable.

**What needs to happen to fix this properly:**
- Determine the exact string format `getFiles()` returns on Windows (absolute path? relative path? forward or back slashes?) — best done with a temporary debug log in the extension.
- Determine why `getFile("favorites/identity.json")` fails when the file visibly exists on disk — inspect the actual exception message.
- Once either of those is understood, a reliable single-user identity mechanism becomes straightforward.
- Longer term: the release 2 "Rethink identity UX" item (show existing files, let user pick) would make the whole problem moot for multi-user projects.

---

## Won't do / API limitations

- **Always-visible fixed panel** — a non-dockable panel permanently visible above the App Explorer. Not available in Extensions API v0.8.0 (only `"left"` | `"right"` | `"bottom"` dockable panes exist).

- **Auto-detect user identity** — resolving identity from Git email or OS username requires Node.js APIs (`child_process`, `process.env`) that are not available in the sandboxed webview runtime. The stored `.identity` file (written after first-run prompt) is the only reliable mechanism until Mendix exposes account info in the Extensions API.
