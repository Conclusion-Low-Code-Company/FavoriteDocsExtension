import { ComponentContext, IComponent, getStudioProApi, ActiveDocumentInfo } from "@mendix/extensions-api";
import type { FavoriteEntry, FavoritesFile, MainToPaneMessage, PaneToMainMessage, Preferences } from "../types.js";
import { DEFAULT_PREFERENCES } from "../types.js";
import { resolveIdentityKey, sanitizeName } from "./identity.js";
import { loadFavorites, saveFavorites } from "./storage.js";

interface State {
    favorites: FavoriteEntry[];
    preferences: Preferences;
    activeDocumentId: string | null;
    activeDocumentInfo: ActiveDocumentInfo | null;
    identityKey: string | null;
    theme: "Light" | "Dark";
}

export const component: IComponent = {
    async loaded(componentContext: ComponentContext) {
        const studioPro = getStudioProApi(componentContext);
        const files = studioPro.app.files;

        const state: State = {
            favorites: [],
            preferences: { ...DEFAULT_PREFERENCES },
            activeDocumentId: null,
            activeDocumentInfo: null,
            identityKey: null,
            theme: "Dark",
        };

        // ── Helpers ───────────────────────────────────────────────────────────

        async function broadcast(msg: MainToPaneMessage): Promise<void> {
            try {
                await studioPro.ui.messagePassing.sendMessage(msg);
            } catch {
                // pane may not be open yet — ignore
            }
        }

        async function broadcastAll(): Promise<void> {
            await broadcast({ type: "favoritesChanged", favorites: state.favorites });
            await broadcast({ type: "activeDocumentChanged", documentId: state.activeDocumentId });
            await broadcast({ type: "preferencesChanged", ...state.preferences });
            await broadcast({ type: "studioThemeChanged", theme: state.theme });
            if (!state.identityKey) {
                await broadcast({ type: "needsIdentity" });
            }
        }

        async function persistAndBroadcastFavorites(): Promise<void> {
            if (!state.identityKey) return;
            const file: FavoritesFile = {
                version: 1,
                preferences: state.preferences,
                favorites: state.favorites,
            };
            try {
                await saveFavorites(files, state.identityKey, file);
            } catch {
                await broadcast({ type: "notification", message: "Favorites could not be saved. Changes may be lost." });
            }
            await broadcast({ type: "favoritesChanged", favorites: state.favorites });
        }

        // ── Startup ───────────────────────────────────────────────────────────

        try {
            const spPrefs = await studioPro.ui.preferences.getPreferences();
            state.theme = spPrefs.theme;
        } catch {
            // Preferences API unavailable — theme stays "Dark" (the default)
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
                    },
                },
            ],
        });

        const key = await resolveIdentityKey(files);
        if (key) {
            state.identityKey = key;
            const file = await loadFavorites(files, key);
            state.favorites = file.favorites;
            state.preferences = file.preferences;
        }

        studioPro.ui.editors.addEventListener("activeDocumentChanged", ({ info }) => {
            state.activeDocumentId = info?.documentId ?? null;
            state.activeDocumentInfo = info ?? null;
            broadcast({ type: "activeDocumentChanged", documentId: state.activeDocumentId });
        });

        // ── Message handler: pane → main ──────────────────────────────────────

        await studioPro.ui.messagePassing.addMessageHandler<PaneToMainMessage>(
            async (msgInfo) => {
                const message = msgInfo.message;

                switch (message.type) {
                    case "paneReady": {
                        await broadcastAll();
                        break;
                    }

                    case "setIdentity": {
                        const newKey = sanitizeName(message.value);
                        state.identityKey = newKey;
                        const file = await loadFavorites(files, newKey);
                        state.favorites = file.favorites;
                        state.preferences = file.preferences;
                        await broadcastAll();
                        break;
                    }

                    case "addFavorite": {
                        if (!state.activeDocumentInfo || !state.identityKey) break;
                        if (state.favorites.some(f => f.documentId === state.activeDocumentId)) break;
                        const info = state.activeDocumentInfo;
                        const entry: FavoriteEntry = {
                            documentId: info.documentId ?? "",
                            documentName: info.documentName ?? "",
                            moduleName: info.moduleName ?? "",
                            documentType: info.documentType ?? "",
                        };
                        state.favorites = [...state.favorites, entry];
                        await persistAndBroadcastFavorites();
                        break;
                    }

                    case "removeFavorite": {
                        if (!state.identityKey) break;
                        state.favorites = state.favorites.filter(f => f.documentId !== message.documentId);
                        await persistAndBroadcastFavorites();
                        break;
                    }

                    case "openDocument": {
                        try {
                            await studioPro.ui.editors.editDocument(message.documentId);
                        } catch {
                            const fav = state.favorites.find(f => f.documentId === message.documentId);
                            if (fav) {
                                await broadcast({
                                    type: "documentNotFound",
                                    documentId: fav.documentId,
                                    documentName: fav.documentName,
                                    moduleName: fav.moduleName,
                                });
                            }
                        }
                        break;
                    }

                    case "savePreferences": {
                        if (!state.identityKey) break;
                        state.preferences = {
                            sortColumn: message.sortColumn,
                            sortDirection: message.sortDirection,
                        };
                        const file: FavoritesFile = {
                            version: 1,
                            preferences: state.preferences,
                            favorites: state.favorites,
                        };
                        try {
                            await saveFavorites(files, state.identityKey, file);
                        } catch {
                            // non-critical — sort pref loss is acceptable
                        }
                        await broadcast({ type: "preferencesChanged", ...state.preferences });
                        break;
                    }
                }
            }
        );

        // Broadcast in case the pane was already open when the extension loaded
        await broadcastAll();
    },
};
