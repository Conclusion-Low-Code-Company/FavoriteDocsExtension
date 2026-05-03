import type { IAppFilesApi } from "@mendix/extensions-api";

export async function sha256hex(input: string): Promise<string> {
    const data = new TextEncoder().encode(input.toLowerCase().trim());
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

// Returns the hex hash for the favorites filename, or null if resolution requires
// a user prompt (handled by sending needsIdentity to the pane).
// studioPro is passed as `any` to avoid coupling this module to the full API type.
export async function resolveIdentityHash(
    files: IAppFilesApi,
    studioPro: any
): Promise<string | null> {
    // 1. Mendix account identity — check if the extensions API exposes the logged-in user.
    //    No `account` property exists in v0.9.0; the try/catch silently skips.
    try {
        const accountEmail: string | undefined = studioPro?.account?.userEmail;
        if (accountEmail) return sha256hex(accountEmail);
    } catch {
        // property not available in current API version
    }

    // 2. Git email
    try {
        const { execSync } = await import("node:child_process");
        const email = execSync("git config user.email", { encoding: "utf8" }).trim();
        if (email) return sha256hex(email);
    } catch {
        // git not available or no email configured
    }

    // 3. OS username
    const osUser =
        (typeof process !== "undefined" &&
            (process.env["USERNAME"] ?? process.env["USER"])) ||
        null;
    if (osUser) return sha256hex(osUser);

    // 4. Stored identity file (written when user answers the prompt).
    //    Try the current filename first, then fall back to the legacy dotfile name
    //    (.identity) which the IAppFilesApi cannot read on some Studio Pro versions.
    for (const path of ["favorites/identity", "favorites/.identity"]) {
        try {
            const stored = (await files.getFile(path)).trim();
            if (stored) {
                // Migrate legacy dotfile to the new name on first successful read
                if (path === "favorites/.identity") {
                    await files.putFile("favorites/identity", stored);
                }
                return stored;
            }
        } catch {
            // file does not exist — try next
        }
    }

    // 5. Requires user prompt — caller must send needsIdentity to pane
    return null;
}

// Persists a hash to identity file after the user supplies their name via the pane.
export async function saveIdentityHash(files: IAppFilesApi, hash: string): Promise<void> {
    await files.putFile("favorites/identity", hash);
}
