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
2. Copies the entire `dist/FavoriteDocs/` folder into `C:\Mendix\EXT_Development-main\extensions\FavoriteDocs\` — the live Mendix app's extension directory

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
| `src/ui/*.tsx` | `<name>.js` (one per file) | UI contexts. Each runs in its own isolated webview. Currently only `tab.js` exists. |

To add a new UI entry point (e.g. a pane), add a file to `src/ui/`, push a new entry to the `entryPoints` array in `build-extension.mjs`, and add the entry to the `"ui"` map in `src/manifest.json`.

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

`@mendix/extensions-api` is pinned to `^0.8.0-mendix.11.9.0` (Studio Pro 11.9). The API is in beta. Reference docs: http://apidocs.rnd.mendix.com/11/extensions-api/index.html
