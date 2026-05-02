import {
  DEFAULT_PREFERENCES,
  r
} from "./chunk-AABDVYGK.js";

// src/main/identity.ts
async function sha256hex(input) {
  const data = new TextEncoder().encode(input.toLowerCase().trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function resolveIdentityHash(files, studioPro) {
  try {
    const accountEmail = studioPro?.account?.userEmail;
    if (accountEmail) return sha256hex(accountEmail);
  } catch {
  }
  try {
    const { execSync } = await import("node:child_process");
    const email = execSync("git config user.email", { encoding: "utf8" }).trim();
    if (email) return sha256hex(email);
  } catch {
  }
  const osUser = typeof process !== "undefined" && (process.env["USERNAME"] ?? process.env["USER"]) || null;
  if (osUser) return sha256hex(osUser);
  try {
    const stored = (await files.getFile("favorites/.identity")).trim();
    if (stored) return stored;
  } catch {
  }
  return null;
}
async function saveIdentityHash(files, hash) {
  await files.putFile("favorites/.identity", hash);
}

// src/main/storage.ts
function emptyFile() {
  return {
    version: 1,
    preferences: { ...DEFAULT_PREFERENCES },
    favorites: []
  };
}
async function loadFavorites(files, hash) {
  try {
    const raw = await files.getFile(`favorites/${hash}.json`);
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return emptyFile();
    return parsed;
  } catch {
    return emptyFile();
  }
}
async function saveFavorites(files, hash, data) {
  await files.putFile(`favorites/${hash}.json`, JSON.stringify(data, null, 2));
}

// src/main/index.ts
var component = {
  async loaded(componentContext) {
    const studioPro = r(componentContext);
    const files = studioPro.app.files;
    const state = {
      favorites: [],
      preferences: { ...DEFAULT_PREFERENCES },
      activeDocumentId: null,
      activeDocumentInfo: null,
      identityHash: null
    };
    async function broadcast(msg) {
      try {
        await studioPro.ui.messagePassing.sendMessage(msg);
      } catch {
      }
    }
    async function broadcastAll() {
      await broadcast({ type: "favoritesChanged", favorites: state.favorites });
      await broadcast({ type: "activeDocumentChanged", documentId: state.activeDocumentId });
      await broadcast({ type: "preferencesChanged", ...state.preferences });
      if (!state.identityHash) {
        await broadcast({ type: "needsIdentity" });
      }
    }
    async function persistAndBroadcastFavorites() {
      if (!state.identityHash) return;
      const file = {
        version: 1,
        preferences: state.preferences,
        favorites: state.favorites
      };
      try {
        await saveFavorites(files, state.identityHash, file);
      } catch {
        await broadcast({ type: "notification", message: "Favorites could not be saved. Changes may be lost." });
      }
      await broadcast({ type: "favoritesChanged", favorites: state.favorites });
    }
    const paneHandle = await studioPro.ui.panes.register(
      { title: "Favorites", initialPosition: "right" },
      { componentName: "extension/FavoriteDocs", uiEntrypoint: "pane" }
    );
    await studioPro.ui.extensionsMenu.add({
      menuId: "FavoriteDocs.MainMenu",
      caption: "FavoriteDocs",
      subMenus: [
        {
          menuId: "FavoriteDocs.ShowFavorites",
          caption: "Show Favorites",
          action: async () => {
            await studioPro.ui.panes.open(paneHandle);
          }
        }
      ]
    });
    const hash = await resolveIdentityHash(files, studioPro);
    if (hash) {
      state.identityHash = hash;
      const file = await loadFavorites(files, hash);
      state.favorites = file.favorites;
      state.preferences = file.preferences;
    }
    studioPro.ui.editors.addEventListener("activeDocumentChanged", ({ info }) => {
      state.activeDocumentId = info?.documentId ?? null;
      state.activeDocumentInfo = info ?? null;
      broadcast({ type: "activeDocumentChanged", documentId: state.activeDocumentId });
    });
    await studioPro.ui.messagePassing.addMessageHandler(
      async (msgInfo) => {
        const message = msgInfo.message;
        switch (message.type) {
          case "paneReady": {
            await broadcastAll();
            break;
          }
          case "setIdentity": {
            const newHash = await sha256hex(message.value);
            state.identityHash = newHash;
            await saveIdentityHash(files, newHash);
            const file = await loadFavorites(files, newHash);
            state.favorites = file.favorites;
            state.preferences = file.preferences;
            await broadcastAll();
            break;
          }
          case "addFavorite": {
            if (!state.activeDocumentInfo || !state.identityHash) break;
            if (state.favorites.some((f) => f.documentId === state.activeDocumentId)) break;
            const info = state.activeDocumentInfo;
            const entry = {
              documentId: info.documentId ?? "",
              documentName: info.documentName ?? "",
              moduleName: info.moduleName ?? "",
              documentType: info.documentType ?? ""
            };
            state.favorites = [...state.favorites, entry];
            await persistAndBroadcastFavorites();
            break;
          }
          case "removeFavorite": {
            if (!state.identityHash) break;
            state.favorites = state.favorites.filter((f) => f.documentId !== message.documentId);
            await persistAndBroadcastFavorites();
            break;
          }
          case "openDocument": {
            try {
              await studioPro.ui.editors.editDocument(message.documentId);
            } catch {
              const fav = state.favorites.find((f) => f.documentId === message.documentId);
              if (fav) {
                await broadcast({
                  type: "documentNotFound",
                  documentId: fav.documentId,
                  documentName: fav.documentName,
                  moduleName: fav.moduleName
                });
              }
            }
            break;
          }
          case "savePreferences": {
            if (!state.identityHash) break;
            state.preferences = {
              sortColumn: message.sortColumn,
              sortDirection: message.sortDirection
            };
            const file = {
              version: 1,
              preferences: state.preferences,
              favorites: state.favorites
            };
            try {
              await saveFavorites(files, state.identityHash, file);
            } catch {
            }
            await broadcast({ type: "preferencesChanged", ...state.preferences });
            break;
          }
        }
      }
    );
    await broadcastAll();
  }
};
export {
  component
};
//# sourceMappingURL=main.js.map
