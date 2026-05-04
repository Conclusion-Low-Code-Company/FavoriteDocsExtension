import type { IAppFilesApi } from "@mendix/extensions-api";
import type { AllFavoritesFile, UserList } from "../types.js";
import { DEFAULT_PREFERENCES } from "../types.js";

const ALL_FILE = "favoriteDocs/favorite-docs.json";

function emptyAll(): AllFavoritesFile {
    return { version: 1, lists: {} };
}

export function emptyList(): UserList {
    return { preferences: { ...DEFAULT_PREFERENCES }, favorites: [] };
}

export async function loadAll(files: IAppFilesApi): Promise<AllFavoritesFile> {
    try {
        const raw = await files.getFile(ALL_FILE);
        const parsed = JSON.parse(raw) as AllFavoritesFile;
        if (parsed.version !== 1) return emptyAll();
        return parsed;
    } catch {
        return emptyAll();
    }
}

export async function saveAll(files: IAppFilesApi, data: AllFavoritesFile): Promise<void> {
    await files.putFile(ALL_FILE, JSON.stringify(data, null, 2));
}
