import type { IAppFilesApi } from "@mendix/extensions-api";
import type { FavoritesFile } from "../types.js";
import { DEFAULT_PREFERENCES } from "../types.js";

function emptyFile(): FavoritesFile {
    return {
        version: 1,
        preferences: { ...DEFAULT_PREFERENCES },
        favorites: [],
    };
}

export async function loadFavorites(files: IAppFilesApi, hash: string): Promise<FavoritesFile> {
    try {
        const raw = await files.getFile(`favorites/${hash}.json`);
        const parsed = JSON.parse(raw) as FavoritesFile;
        if (parsed.version !== 1) return emptyFile();
        return parsed;
    } catch {
        return emptyFile();
    }
}

export async function saveFavorites(
    files: IAppFilesApi,
    hash: string,
    data: FavoritesFile
): Promise<void> {
    await files.putFile(`favorites/${hash}.json`, JSON.stringify(data, null, 2));
}
