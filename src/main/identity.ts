// Converts a free-text name into a safe filename stem (used as the list key).
// "Bart Heijs" → "bart_heijs", "BART" → "bart"
export function sanitizeName(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "user";
}
