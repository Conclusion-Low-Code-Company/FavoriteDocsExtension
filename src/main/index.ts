import { ComponentContext, IComponent, getStudioProApi, ActiveDocumentInfo } from "@mendix/extensions-api";
import type { AllFavoritesFile, FavoriteEntry, MainToPaneMessage, PaneToMainMessage, Preferences } from "../types.js";
import { DEFAULT_PREFERENCES } from "../types.js";
import { sanitizeName } from "./identity.js";
import { loadAll, saveAll, emptyList } from "./storage.js";

interface State {
    allFavorites: AllFavoritesFile;
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
            allFavorites: { version: 1, lists: {} },
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
            const names = Object.keys(state.allFavorites.lists);
            // Auto-select the first list when none is selected and lists exist.
            if (!state.identityKey && names.length > 0) {
                const firstKey = names[0];
                state.identityKey = firstKey;
                const list = state.allFavorites.lists[firstKey];
                state.favorites = list.favorites;
                state.preferences = list.preferences;
            }
            await broadcast({ type: "studioThemeChanged", theme: state.theme });
            await broadcast({ type: "activeDocumentChanged", documentId: state.activeDocumentId });
            await broadcast({ type: "listOptions", names, selected: state.identityKey });
            await broadcast({ type: "preferencesChanged", ...state.preferences });
            await broadcast({ type: "favoritesChanged", favorites: state.favorites });
        }

        async function persistAndBroadcast(): Promise<void> {
            if (!state.identityKey) return;
            state.allFavorites.lists[state.identityKey] = {
                preferences: state.preferences,
                favorites: state.favorites,
            };
            try {
                await saveAll(files, state.allFavorites);
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
            // Preferences API unavailable — theme stays "Dark"
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
                        state.allFavorites = await loadAll(files);
                        await broadcastAll();
                        break;
                    }

                    case "selectList": {
                        const key = sanitizeName(message.name);
                        state.identityKey = key;
                        if (!state.allFavorites.lists[key]) {
                            state.allFavorites.lists[key] = emptyList();
                            try { await saveAll(files, state.allFavorites); } catch { /* non-critical */ }
                        }
                        const list = state.allFavorites.lists[key];
                        state.favorites = list.favorites;
                        state.preferences = list.preferences;
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
                        await persistAndBroadcast();
                        break;
                    }

                    case "removeFavorite": {
                        if (!state.identityKey) break;
                        state.favorites = state.favorites.filter(f => f.documentId !== message.documentId);
                        await persistAndBroadcast();
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
                        state.allFavorites.lists[state.identityKey] = {
                            preferences: state.preferences,
                            favorites: state.favorites,
                        };
                        try {
                            await saveAll(files, state.allFavorites);
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
