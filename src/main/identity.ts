import type { IAppFilesApi } from "@mendix/extensions-api";

// Converts a free-text name into a safe filename stem.
// "Bart Heijs" → "bart_heijs", "BART" → "bart"
export function sanitizeName(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "user";
}

// Returns the favorites key (filename stem without .json) for this user,
// or null if a prompt is required.
export async function resolveIdentityKey(files: IAppFilesApi): Promise<string | null> {
    // Auto-discover: if exactly one favorites file exists, use it — no prompt needed.
    // Works for every restart after the first name entry.
    try {
        const all = await files.getFiles("favorites/*.json");
        const userFiles = all.filter(p => {
            const filename = p.split(/[/\\]/).pop() ?? "";
            return filename.endsWith(".json") && filename !== "identity.json";
        });
        if (userFiles.length === 1) {
            const filename = userFiles[0].split(/[/\\]/).pop()!;
            return filename.replace(".json", "");
        }
    } catch {
        // directory empty or API unavailable
    }

    return null;
}
