# FavoriteDocs

A Mendix Studio Pro web extension that lets you mark documents as favorites and access them from a persistent dockable pane.

## Features

- Add the currently open document to favorites with one click
- Dockable **Favorites** pane with sortable list (by name or type)
- Document type icons (Page, Microflow, Nanoflow, Snippet)
- Double-click a favorite to open it; right-click for context menu (Open / Remove)
- Keyboard navigation — arrow keys, Enter to open, Delete to remove
- Dark and light theme support, matching Studio Pro's current theme
- Per-user favorites file stored in the project directory and committed to git

## Requirements

- Mendix Studio Pro 11.9+
- Node.js (for building)

## Setup

```bash
npm install
```

Then update `appDir` in `build-extension.mjs` to point to your local Mendix app directory:

```js
const appDir = "C:\\Mendix\\YourApp"
```

## Development

```bash
# Build once (type-check + bundle + deploy to app directory)
npm run build

# Build and watch for changes
npm run build:dev
```

Use the VS Code launch config **"Launch StudioPro with debugger attached"** to open Studio Pro with the extension loaded and the Edge DevTools debugger attached. Breakpoints work against TypeScript source via source maps.

## How it works

The extension has two entry points:

| File | Role |
|---|---|
| `src/main/index.ts` | Background context — owns all state, handles disk I/O, broadcasts to the pane |
| `src/ui/pane.tsx` | Pane UI — pure React renderer, sends messages to main |

Favorites are stored as `favorites/<hash>.json` in the project directory. The hash is derived from a user-supplied name (entered once on first run) and persisted in `favorites/.identity` so subsequent runs don't prompt again.

## Backlog

See [docs/backlog.md](docs/backlog.md).
