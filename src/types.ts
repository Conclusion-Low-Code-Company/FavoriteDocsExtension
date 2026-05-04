export interface FavoriteEntry {
    documentId: string;
    documentName: string;
    moduleName: string;
    documentType: string;
}

export type SortColumn = "documentName" | "documentType";
export type SortDirection = "asc" | "desc";

export interface Preferences {
    sortColumn: SortColumn;
    sortDirection: SortDirection;
}

export interface UserList {
    preferences: Preferences;
    favorites: FavoriteEntry[];
}

export interface AllFavoritesFile {
    version: 1;
    lists: Record<string, UserList>;
}

export const DEFAULT_PREFERENCES: Preferences = {
    sortColumn: "documentName",
    sortDirection: "asc",
};

// ── pane → main ──────────────────────────────────────────────────────────────

export type PaneToMainMessage =
    | { type: "paneReady" }
    | { type: "addFavorite" }
    | { type: "removeFavorite"; documentId: string }
    | { type: "openDocument"; documentId: string }
    | { type: "savePreferences"; sortColumn: SortColumn; sortDirection: SortDirection }
    | { type: "selectList"; name: string };

// ── main → pane ──────────────────────────────────────────────────────────────

export type MainToPaneMessage =
    | { type: "favoritesChanged"; favorites: FavoriteEntry[] }
    | { type: "activeDocumentChanged"; documentId: string | null }
    | { type: "preferencesChanged"; sortColumn: SortColumn; sortDirection: SortDirection }
    | { type: "studioThemeChanged"; theme: "Light" | "Dark" }
    | { type: "listOptions"; names: string[]; selected: string | null }
    | { type: "documentNotFound"; documentId: string; documentName: string; moduleName: string }
    | { type: "notification"; message: string };
