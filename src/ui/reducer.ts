import type { FavoriteEntry, MainToPaneMessage, Preferences } from "../types.js";

export interface PaneState {
    favorites: FavoriteEntry[];
    activeDocumentId: string | null;
    preferences: Preferences;
    theme: "Light" | "Dark";
    listNames: string[];
    currentList: string | null;
    documentNotFound: { documentId: string; documentName: string; moduleName: string } | null;
    notification: string | null;
}

export type MessageDispatch = (msg: MainToPaneMessage) => void;

export function applyMessage(prev: PaneState, msg: MainToPaneMessage): PaneState {
    switch (msg.type) {
        case "favoritesChanged":
            return { ...prev, favorites: msg.favorites };
        case "activeDocumentChanged":
            return { ...prev, activeDocumentId: msg.documentId };
        case "preferencesChanged":
            return { ...prev, preferences: { sortColumn: msg.sortColumn, sortDirection: msg.sortDirection } };
        case "studioThemeChanged":
            return { ...prev, theme: msg.theme };
        case "listOptions":
            return { ...prev, listNames: msg.names, currentList: msg.selected };
        case "documentNotFound":
            return { ...prev, documentNotFound: { documentId: msg.documentId, documentName: msg.documentName, moduleName: msg.moduleName } };
        case "notification":
            return { ...prev, notification: msg.message };
        default:
            return prev;
    }
}
