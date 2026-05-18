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

        function selectFirstListIfNeeded(): void {
            const names = Object.keys(state.allFavorites.lists);
            if (!state.identityKey && names.length > 0) {
                const firstKey = names[0];
                state.identityKey = firstKey;
                const list = state.allFavorites.lists[firstKey];
                state.favorites = list.favorites;
                state.preferences = list.preferences;
            }
        }

        function syncCurrentList(): void {
            if (!state.identityKey) return;
            state.allFavorites.lists[state.identityKey] = {
                preferences: state.preferences,
                favorites: state.favorites,
            };
        }

        async function broadcastAll(): Promise<void> {
            const names = Object.keys(state.allFavorites.lists);
            await Promise.all([
                broadcast({ type: "studioThemeChanged", theme: state.theme }),
                broadcast({ type: "activeDocumentChanged", documentId: state.activeDocumentId }),
                broadcast({ type: "listOptions", names, selected: state.identityKey }),
                broadcast({ type: "preferencesChanged", ...state.preferences }),
                broadcast({ type: "favoritesChanged", favorites: state.favorites }),
            ]);
        }

        async function documentExistsInModel(documentId: string, documentType: string): Promise<boolean> {
            const { model } = studioPro.app;
            try {
                switch (documentType) {
                    case "Pages$Page":
                        return (await model.pages.getUnitsInfo()).some(u => u.$ID === documentId);
                    case "Pages$Snippet":
                        return (await model.snippets.getUnitsInfo()).some(u => u.$ID === documentId);
                    case "Microflows$Microflow":
                        return (await model.microflows.getUnitsInfo()).some(u => u.$ID === documentId);
                    case "Microflows$Nanoflow":
                        return true; // No nanoflows API in model — skip check, assume exists
                    default:
                        return true; // Unknown type — assume exists, let editDocument handle it
                }
            } catch {
                return true; // Model API unavailable — don't show a false "not found" modal
            }
        }

        async function persistAndBroadcast(): Promise<void> {
            if (!state.identityKey) return;
            syncCurrentList();
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

        // ── Message handler: pane → main ──────────────────────────────────────
        // Registered before panes.register() so that if the pane was already open
        // from a previous session its paneReady message is not missed.

        await studioPro.ui.messagePassing.addMessageHandler<PaneToMainMessage>(
            async (msgInfo) => {
                const message = msgInfo.message;

                switch (message.type) {
                    case "paneReady": {
                        state.allFavorites = await loadAll(files);
                        selectFirstListIfNeeded();
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
                            documentName: info.documentName || info.moduleName || "",
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
                        const fav = state.favorites.find(f => f.documentId === message.documentId);
                        if (fav && !await documentExistsInModel(message.documentId, fav.documentType)) {
                            await broadcast({
                                type: "documentNotFound",
                                documentId: fav.documentId,
                                documentName: fav.documentName,
                                moduleName: fav.moduleName,
                            });
                            break;
                        }
                        try {
                            await studioPro.ui.editors.editDocument(message.documentId);
                        } catch {
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
                        syncCurrentList();
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

        // Broadcast in case the pane was already open when the extension loaded
        await broadcastAll();
    },
};
