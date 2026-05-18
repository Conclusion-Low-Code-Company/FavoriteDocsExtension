# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Type-check and build (copies output to app extensions directory)
npm run build

# Type-check and build in watch mode (rebuilds on file changes)
npm run build:dev
```

There are no tests. Type-checking (`tsc --noEmit`) runs as part of every build.

## Deployment

The build pipeline (via `build-extension.mjs` + `build.helpers.mjs`) does two things after a successful compile:

1. Copies `src/manifest.json` into `dist/FavoriteDocs/`
2. Copies the entire `dist/FavoriteDocs/` folder into `C:\Mendix\EXT_Development-mx-11.10.0\extensions\FavoriteDocs\` — the live Mendix app's extension directory

`appDir` and `extensionDirectoryName` in `build-extension.mjs` control this. If the app directory doesn't exist the copy is skipped with a warning (build still succeeds).

## Debugging

Use the VS Code launch config **"Launch StudioPro with debugger attached"** (`.vscode/launch.json`). It opens Studio Pro with `--enable-extension-development --enable-web-extensions` flags and attaches the Edge DevTools debugger to the extension webview. Source maps are emitted, so breakpoints work against the TypeScript source.

## Architecture

This is a **Mendix Studio Pro web extension** using `@mendix/extensions-api`. Extensions run as sandboxed web contexts inside Studio Pro.

### Entry points

Declared in `src/manifest.json` and compiled by `build-extension.mjs`:

| Source file | Compiled output | Role |
|---|---|---|
| `src/main/index.ts` | `main.js` | Permanent background context. Loaded once when Studio Pro opens the extension. Registers menus, panes, and event listeners. |
| `src/ui/*.tsx` | `<name>.js` (one per file) | UI contexts. Each runs in its own isolated webview. Currently only `pane.js` exists. |

To add a new UI entry point (e.g. a pane), add a file to `src/ui/`, push a new entry to the `entryPoints` array in `build-extension.mjs`, and add the entry to the `"ui"` map in `src/manifest.json`.

### Data model

All favorites data is stored in a single file: `favoriteDocs/favorite-docs.json` (inside the Mendix project directory). The format is:

```json
{
  "version": 1,
  "lists": {
    "bart": {
      "preferences": { "sortColumn": "documentName", "sortDirection": "asc" },
      "favorites": [{ "documentId": "...", "documentName": "...", "moduleName": "...", "documentType": "..." }]
    }
  }
}
```

Each key in `lists` is a sanitized user name (lowercase, underscores). Multiple developers share the same file; each has their own named list. The file is read via `loadAll()` in `src/main/storage.ts` and written via `saveAll()`.

### State ownership

`main` (`src/main/index.ts`) owns all state: the full `AllFavoritesFile`, the currently selected identity key, and the active favorites/preferences for that key. The pane (`src/ui/pane.tsx`) is a pure renderer — it sends messages to `main` and re-renders on broadcasts.

Key messages:
- `listOptions` (main → pane): list of available user names + which is currently selected
- `selectList` (pane → main): user picks or creates a list by name
- `favoritesChanged` (main → pane): updated favorites array for the current list

### Key API surface

All interaction with Studio Pro goes through `getStudioProApi(componentContext)`:

- `studioPro.ui.extensionsMenu` — add items to the Extensions top menu
- `studioPro.ui.tabs` — open floating editor-area tabs
- `studioPro.ui.panes` — register and open dockable side panes
- `studioPro.ui.editors` — open documents by ID, listen for `activeDocumentChanged`
- `studioPro.ui.messagePassing` — communicate between `main` and UI contexts
- `studioPro.app.model.*` — read the Mendix model (pages, microflows, etc.)

### Communication pattern

`main` is the single source of truth for state. UI contexts (tabs, panes) are pure renderers that send messages to `main` and re-render when `main` broadcasts back. Use `studioPro.ui.messagePassing.sendMessage` / `addMessageHandler` for this.

### Extension API version

`@mendix/extensions-api` is pinned to `^0.8.0-mendix.11.10.0` (Studio Pro 11.10). The API is in beta. Reference docs: http://apidocs.rnd.mendix.com/11/extensions-api/index.html

---

## Lessons learned

### API calls in `loaded()` need try/catch
Any `await` in the `loaded()` startup function that throws will silently abort the entire extension startup — pane registration, menu, message handlers, and identity resolution all fail. Wrap every non-critical API call in a try/catch with a sensible default. Example: reading Studio Pro preferences for the theme at startup.

### Extensions API runtime vs type definitions
The sandboxed webview environment is more constrained than the TypeScript types suggest:
- `node:child_process`, `process.env`, and other Node.js APIs are **not available** — the extension runs in a browser context, not Node.js.
- Any API that works in the type definitions may still throw at runtime if that feature is not available in the running Studio Pro version. Always guard with try/catch.
- `studioPro.ui.preferences.getPreferences()` is the correct path for the preferences API (not `studioPro.app.preferences`).

### IAppFilesApi: read all file calls in `loaded()` at startup
`files.getFile()` and `files.getFiles()` return empty or throw when called inside `loaded()` at Studio Pro startup — even for files that exist on disk from a previous session. The API is not ready at that point. Always defer file reads to after first user interaction, e.g. inside the `paneReady` message handler rather than in `loaded()`.

### IAppFilesApi requires the directory to exist before putFile
`files.putFile("favoriteDocs/favorite-docs.json", ...)` silently fails if the `favoriteDocs/` directory does not exist yet. The directory is only created implicitly when the first file is successfully written into it. Always ensure the directory exists before writing secondary files into it.

### IAppFilesApi: putFile works, getFile does not work at root level
Writing a file to the project root (e.g. `files.putFile("myfile.json", ...)`) succeeds and the file appears on disk, but `files.getFile("myfile.json")` returns "Not Found". Root-level reads do not work. Always write files inside a subdirectory (e.g. `favoriteDocs/`).

### IAppFilesApi only reliably reads .json files
`files.getFile()` silently fails for files without a `.json` extension — the file exists on disk but the API throws when reading it. Always use `.json` filenames. Also cannot read dotfiles (names starting with `.`).

### Mendix document type strings are fully qualified
The Extensions API returns document types as fully-qualified module-scoped strings, not simple names:
- `"Pages$Page"` (not `"Page"`)
- `"Microflows$Microflow"` (not `"Microflow"`)
- `"Microflows$Nanoflow"` (not `"Nanoflow"`)
- `"Pages$Snippet"` (not `"Snippet"`)

### `editDocument` does not throw for missing documents
`studioPro.ui.editors.editDocument(documentId)` resolves silently when the document no longer exists in the model — it does not throw. Catch-based "not found" detection never fires.

To detect deleted documents, check model existence first using `getUnitsInfo()` on the appropriate API before calling `editDocument`:
- `"Pages$Page"` → `studioPro.app.model.pages.getUnitsInfo()`
- `"Pages$Snippet"` → `studioPro.app.model.snippets.getUnitsInfo()`
- `"Microflows$Microflow"` → `studioPro.app.model.microflows.getUnitsInfo()`
- `"Microflows$Nanoflow"` → **no API available** — the model API is typed to `Microflows.Microflow` only and does not include nanoflows; default to `true` (assume exists)

Each returns `ReadonlyArray<{ $ID: string; ... }>` — check `.some(u => u.$ID === documentId)`. Wrap in try/catch and default to `true` (assume exists) if the model API is unavailable, to avoid false "not found" modals.

### Build output and .gitignore
- `dist/` must be in `.gitignore` — it contains compiled JS, source maps, and esbuild chunk files that are build artifacts, not source.
- Root-level `/*.js` and `/*.js.map` should also be gitignored — esbuild can accidentally output there if `outdir` is misconfigured. Build scripts use `.mjs` so they are unaffected by this rule.
- Chunk files (e.g. `chunk-XXXXXXXX.js`) are generated by esbuild's `splitting: true` setting. They contain shared code extracted from multiple entry points (e.g. React used by both `main.js` and `pane.js`). They are normal build output, not errors.
- `.map` files are source maps. The debugger uses them to map compiled JS back to TypeScript source so breakpoints work in `.ts` files.
