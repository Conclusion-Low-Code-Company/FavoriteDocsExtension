# Contributing to FavoriteDocs

## Requirements

- Mendix Studio Pro 11.9+
- Node.js

## Setup

```bash
git clone <repo>
cd FavoriteDocs
npm install
```

Open `build-extension.mjs` and set `appDir` to your local Mendix app directory:

```js
const appDir = "C:\\Mendix\\YourApp"
```

## Building

```bash
# Type-check + bundle + deploy to app directory
npm run build

# Watch mode — rebuilds on file changes
npm run build:dev
```

There are no automated tests. `tsc --noEmit` runs as part of every build and is the primary correctness check.

## Debugging

Use the VS Code launch config **"Launch StudioPro with debugger attached"** (`.vscode/launch.json`). It opens Studio Pro with the extension loaded and attaches the Edge DevTools debugger to the extension webview. Breakpoints work against TypeScript source via source maps.

## Architecture

The extension has two entry points declared in `src/manifest.json`:

| File | Compiled output | Role |
|---|---|---|
| `src/main/index.ts` | `main.js` | Permanent background context. Owns all state, handles disk I/O, broadcasts to the pane. |
| `src/ui/pane.tsx` | `pane.js` | Pane UI. Pure React renderer — sends messages to main, re-renders on broadcast. |

`main` is the single source of truth. The pane never writes state directly — it sends a message to main and waits for main to broadcast back.

### Key API surface

```ts
studioPro.ui.panes          // register and open dockable panes
studioPro.ui.extensionsMenu // add items to the Extensions menu
studioPro.ui.editors        // open documents, listen for activeDocumentChanged
studioPro.ui.messagePassing // sendMessage / addMessageHandler between contexts
studioPro.ui.preferences    // getPreferences() — returns { theme, language }
studioPro.app.files         // getFile / putFile for project-directory storage
```

### Storage

Favorites are stored as `favorites/<hash>.json` in the project directory. The hash is a SHA-256 of the user's chosen name. The active hash is persisted in `favorites/identity` so Studio Pro can resolve it automatically on subsequent startups.

### Theming

Studio Pro's current theme (`"Light"` | `"Dark"`) is read at startup via `studioPro.ui.preferences.getPreferences()` and broadcast to the pane. The pane injects CSS custom properties onto `document.documentElement` from the `THEME_TOKENS` map in `src/ui/pane.tsx`.

## Known API limitations

- The webview sandbox has no access to Node.js APIs (`child_process`, `process.env`, etc.).
- `IAppFilesApi` cannot read files whose name starts with `.` — use plain filenames.
- `studioPro.ui.preferences` has no change listener; theme is read once at startup.
- Mendix document types are fully-qualified strings: `Pages$Page`, `Microflows$Microflow`, `Microflows$Nanoflow`, `Pages$Snippet`.
- Any unguarded `await` in `loaded()` that throws will silently abort the entire extension startup. Wrap non-critical API calls in try/catch.

## Backlog

See [docs/backlog.md](docs/backlog.md).
