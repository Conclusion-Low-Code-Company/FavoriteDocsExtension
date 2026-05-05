import React, { StrictMode, useEffect, useState, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { ComponentContext, IComponent, getStudioProApi } from "@mendix/extensions-api";
import type { FavoriteEntry, MainToPaneMessage, Preferences, PaneToMainMessage, SortColumn } from "../types.js";
import { DEFAULT_PREFERENCES } from "../types.js";

// ── Design tokens ─────────────────────────────────────────────────────────────

const THEME_TOKENS: Record<"Light" | "Dark", Record<string, string>> = {
    Dark: {
        "--color-bg":           "#1e1e1e",
        "--color-row-hover":    "#2a2d2e",
        "--color-row-active":   "rgba(74,171,243,0.12)",
        "--color-focus-border": "#4babf3",
        "--color-text":         "#cccccc",
        "--color-text-muted":   "#888888",
        "--color-border":       "#3c3c3c",
        "--color-btn-bg":       "#313131",
        "--color-btn-hover":    "#3d3d3d",
        "--color-menu-bg":      "#252526",
        "--color-menu-hover":   "#2a2d2e",
        "--font-family":        '"Segoe UI", system-ui, sans-serif',
        "--font-size":          "12px",
    },
    Light: {
        "--color-bg":           "#f3f3f3",
        "--color-row-hover":    "#e8e8e8",
        "--color-row-active":   "rgba(74,171,243,0.15)",
        "--color-focus-border": "#4babf3",
        "--color-text":         "#1e1e1e",
        "--color-text-muted":   "#717171",
        "--color-border":       "#d4d4d4",
        "--color-btn-bg":       "#e1e1e1",
        "--color-btn-hover":    "#d5d5d5",
        "--color-menu-bg":      "#ffffff",
        "--color-menu-hover":   "#e8e8e8",
        "--font-family":        '"Segoe UI", system-ui, sans-serif',
        "--font-size":          "12px",
    },
};

// ── Shared style constants ────────────────────────────────────────────────────

const STYLES = {
    text: {
        fontFamily: "var(--font-family)",
        fontSize:   "var(--font-size)",
        color:      "var(--color-text)",
    },
    btn: {
        fontFamily: "var(--font-family)",
        fontSize:   "var(--font-size)",
        color:      "var(--color-text)",
        background: "var(--color-btn-bg)",
        border:     "1px solid var(--color-border)",
        padding:    "4px 10px",
        cursor:     "pointer",
    },
    input: {
        fontFamily: "var(--font-family)",
        fontSize:   "var(--font-size)",
        color:      "var(--color-text)",
        background: "var(--color-btn-bg)",
        border:     "1px solid var(--color-border)",
        padding:    "4px 6px",
        boxSizing:  "border-box" as const,
    },
} satisfies Record<string, React.CSSProperties>;

// ── Document type icons ───────────────────────────────────────────────────────

function TypeIcon({ children }: { children: React.ReactNode }): React.ReactElement {
    return (
        <svg
            width="14" height="14" viewBox="0 0 14 14"
            fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ display: "block", flexShrink: 0 }}
        >
            {children}
        </svg>
    );
}

// Page: document outline with folded top-right corner
const PAGE_ICON = (
    <TypeIcon>
        <path d="M2 1h6l4 4v8H2z"/>
        <polyline points="8,1 8,5 12,5"/>
    </TypeIcon>
);

// Microflow: circle with play triangle inside
const MICROFLOW_ICON = (
    <TypeIcon>
        <circle cx="7" cy="7" r="5.5"/>
        <path d="M5.5 4.5l5 2.5-5 2.5z"/>
    </TypeIcon>
);

// Nanoflow: rectangle with play triangle inside (like Microflow but rect instead of circle)
const NANOFLOW_ICON = (
    <TypeIcon>
        <rect x="1.5" y="1.5" width="11" height="11"/>
        <path d="M5 4.5l5 2.5-5 2.5z"/>
    </TypeIcon>
);

// Snippet: page outline with fold + opening/closing square brackets inside
const SNIPPET_ICON = (
    <TypeIcon>
        <path d="M2 1h6l4 4v8H2z"/>
        <polyline points="8,1 8,5 12,5"/>
        <polyline points="5,7 3.5,7 3.5,11 5,11"/>
        <polyline points="9,7 10.5,7 10.5,11 9,11"/>
    </TypeIcon>
);

// Generic: arrow-from-box (open-in-new) — matches Studio Pro's document icon style
const GENERIC_ICON = (
    <TypeIcon>
        <polyline points="8,1 13,1 13,6"/>
        <line x1="13" y1="1" x2="6" y2="8"/>
        <path d="M6 4H2v8h8V8"/>
    </TypeIcon>
);

const DOCUMENT_TYPE_ICONS: Partial<Record<string, React.ReactElement>> = {
    "Pages$Page": PAGE_ICON,
    "Microflows$Microflow": MICROFLOW_ICON,
    "Microflows$Nanoflow": NANOFLOW_ICON,
    "Pages$Snippet": SNIPPET_ICON,
};

function getDocumentTypeIcon(type: string): React.ReactElement {
    return DOCUMENT_TYPE_ICONS[type] ?? GENERIC_ICON;
}

interface PaneState {
    favorites: FavoriteEntry[];
    activeDocumentId: string | null;
    preferences: Preferences;
    theme: "Light" | "Dark";
    listNames: string[];
    currentList: string | null;
    documentNotFound: { documentId: string; documentName: string; moduleName: string } | null;
    notification: string | null;
}

type MessageDispatch = (msg: MainToPaneMessage) => void;

export const component: IComponent = {
    async loaded(componentContext: ComponentContext) {
        const studioPro = getStudioProApi(componentContext);

        // sendToMain broadcasts a PaneToMainMessage — main receives it via its addMessageHandler.
        const sendToMain = async (msg: PaneToMainMessage): Promise<void> => {
            await studioPro.ui.messagePassing.sendMessage(msg);
        };

        // dispatch is assigned by FavoritesPane via useEffect so the message handler
        // can forward incoming messages into React state.
        let dispatch: MessageDispatch = () => {};

        await studioPro.ui.messagePassing.addMessageHandler<MainToPaneMessage>(async (msgInfo) => {
            dispatch(msgInfo.message);
        });

        createRoot(document.getElementById("root")!).render(
            <StrictMode>
                <FavoritesPane
                    sendToMain={sendToMain}
                    onRegisterDispatch={(fn) => { dispatch = fn; }}
                />
            </StrictMode>
        );

        // Signal main that the pane is ready — main will broadcast current state.
        await sendToMain({ type: "paneReady" });
    },
};

function FavoritesPane({
    sendToMain,
    onRegisterDispatch,
}: {
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
    onRegisterDispatch: (dispatch: MessageDispatch) => void;
}) {
    const [state, setState] = useState<PaneState>({
        favorites: [],
        activeDocumentId: null,
        preferences: DEFAULT_PREFERENCES,
        theme: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "Dark" : "Light",
        listNames: [],
        currentList: null,
        documentNotFound: null,
        notification: null,
    });

    useEffect(() => {
        onRegisterDispatch((msg) => {
            setState((prev) => applyMessage(prev, msg));
        });
    }, [onRegisterDispatch]);

    useEffect(() => {
        const tokens = THEME_TOKENS[state.theme];
        for (const [key, value] of Object.entries(tokens)) {
            document.documentElement.style.setProperty(key, value);
        }
    }, [state.theme]);

    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");

    const handleCreate = () => {
        if (!newName.trim()) return;
        sendToMain({ type: "selectList", name: newName.trim() });
        setNewName("");
        setShowCreate(false);
    };

    // No lists yet — first time setup
    if (state.listNames.length === 0) {
        return (
            <div style={{ ...STYLES.text, padding: "16px", background: "var(--color-bg)", height: "100%", boxSizing: "border-box" }}>
                <p style={{ marginTop: 0, marginBottom: "8px", fontWeight: "bold" }}>Create your favorites list</p>
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                    placeholder="Your name"
                    autoFocus
                    style={{ ...STYLES.input, width: "100%" }}
                />
                <button type="button" onClick={handleCreate} disabled={!newName.trim()}
                    style={{ ...STYLES.btn, marginTop: "6px", cursor: newName.trim() ? "pointer" : "default", opacity: newName.trim() ? 1 : 0.5 }}>
                    Create
                </button>
            </div>
        );
    }

    // Normal view — persistent dropdown header + favorites
    return (
        <div style={{ ...STYLES.text, background: "var(--color-bg)", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
            {/* List selector header */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
                <select
                    value={state.currentList ?? ""}
                    title="Your favorites list"
                    onChange={(e) => sendToMain({ type: "selectList", name: e.target.value })}
                    style={{ ...STYLES.input, flex: 1, padding: "3px 4px" }}
                >
                    {state.listNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button
                    type="button"
                    title="Create new list"
                    onClick={() => { setShowCreate(v => !v); setNewName(""); }}
                    style={{ ...STYLES.btn, padding: "3px 8px", fontWeight: "bold" }}
                >
                    +
                </button>
            </div>
            {/* Inline create form */}
            {showCreate && (
                <div style={{ display: "flex", gap: "4px", padding: "4px 8px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
                        placeholder="New list name"
                        autoFocus
                        style={{ ...STYLES.input, flex: 1, padding: "3px 4px" }}
                    />
                    <button type="button" onClick={handleCreate} disabled={!newName.trim()}
                        style={{ ...STYLES.btn, padding: "3px 8px", cursor: newName.trim() ? "pointer" : "default", opacity: newName.trim() ? 1 : 0.5 }}>
                        Create
                    </button>
                </div>
            )}
            {/* Content area */}
            <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
                {state.notification && (
                    <Notification
                        message={state.notification}
                        onDismiss={() => setState((prev) => ({ ...prev, notification: null }))}
                    />
                )}
                {state.documentNotFound && (
                    <DocumentNotFoundModal
                        info={state.documentNotFound}
                        onRemove={() => {
                            const id = state.documentNotFound!.documentId;
                            setState((prev) => ({ ...prev, documentNotFound: null }));
                            sendToMain({ type: "removeFavorite", documentId: id });
                        }}
                        onKeep={() => setState((prev) => ({ ...prev, documentNotFound: null }))}
                    />
                )}
                <FavoritesTable
                    favorites={state.favorites}
                    activeDocumentId={state.activeDocumentId}
                    preferences={state.preferences}
                    sendToMain={sendToMain}
                />
            </div>
        </div>
    );
}

function applyMessage(prev: PaneState, msg: MainToPaneMessage): PaneState {
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

// ── Favorites table ───────────────────────────────────────────────────────────

function ContextMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
    const [hovered, setHovered] = useState(false);
    return (
        <div
            style={{
                padding: "6px 12px",
                cursor: "pointer",
                background: hovered ? "var(--color-menu-hover)" : "transparent",
                color: "var(--color-text)",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={onClick}
        >
            {label}
        </div>
    );
}

function ContextMenu({
    x,
    y,
    documentId,
    onClose,
    sendToMain,
}: {
    x: number;
    y: number;
    documentId: string;
    onClose: () => void;
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
}) {
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <>
            {/* Click-outside overlay */}
            <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={onClose} />
            <div style={{
                ...STYLES.text,
                position: "fixed",
                left: x,
                top: y,
                background: "var(--color-menu-bg)",
                border: "1px solid var(--color-border)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                zIndex: 1000,
                minWidth: "172px",
            }}>
                <ContextMenuItem
                    label="Open favorite"
                    onClick={() => {
                        sendToMain({ type: "openDocument", documentId });
                        onClose();
                    }}
                />
                <ContextMenuItem
                    label="Remove as favorite"
                    onClick={() => {
                        sendToMain({ type: "removeFavorite", documentId });
                        onClose();
                    }}
                />
            </div>
        </>
    );
}

function getSortValue(entry: FavoriteEntry, col: SortColumn): string {
    switch (col) {
        case "documentName": return entry.documentName;
        case "documentType": return entry.documentType;
    }
}

function sortFavorites(favorites: FavoriteEntry[], prefs: Preferences): FavoriteEntry[] {
    return [...favorites].sort((a, b) => {
        const aVal = getSortValue(a, prefs.sortColumn).toLowerCase();
        const bVal = getSortValue(b, prefs.sortColumn).toLowerCase();
        const cmp = aVal.localeCompare(bVal);
        return prefs.sortDirection === "asc" ? cmp : -cmp;
    });
}

function SortIndicator({ col, preferences }: { col: SortColumn; preferences: Preferences }) {
    if (preferences.sortColumn !== col) return null;
    return <span>{preferences.sortDirection === "asc" ? " ▲" : " ▼"}</span>;
}

function FavoritesTable({
    favorites,
    activeDocumentId,
    preferences,
    sendToMain,
}: {
    favorites: FavoriteEntry[];
    activeDocumentId: string | null;
    preferences: Preferences;
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
}) {
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; documentId: string } | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);

    const isActiveAlreadyFavorited = useMemo(
        () => favorites.some(f => f.documentId === activeDocumentId),
        [favorites, activeDocumentId]
    );
    const sorted = useMemo(
        () => sortFavorites(favorites, preferences),
        [favorites, preferences]
    );

    // Clear focus if focused entry was removed externally
    useEffect(() => {
        if (focusedId !== null && !favorites.some(f => f.documentId === focusedId)) {
            setFocusedId(null);
        }
    }, [favorites]);

    function toggleSort(column: SortColumn) {
        const direction =
            preferences.sortColumn === column && preferences.sortDirection === "asc" ? "desc" : "asc";
        sendToMain({ type: "savePreferences", sortColumn: column, sortDirection: direction });
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (sorted.length === 0) return;
        const idx = sorted.findIndex(f => f.documentId === focusedId);

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setFocusedId(sorted[idx === -1 ? 0 : Math.min(idx + 1, sorted.length - 1)].documentId);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setFocusedId(sorted[idx === -1 ? sorted.length - 1 : Math.max(idx - 1, 0)].documentId);
        } else if (e.key === "Enter" && focusedId) {
            sendToMain({ type: "openDocument", documentId: focusedId });
        } else if ((e.key === "Delete" || e.key === "Backspace") && focusedId) {
            e.preventDefault();
            const nextIdx = idx + 1 < sorted.length ? idx + 1 : idx - 1;
            const nextId = nextIdx >= 0 ? (sorted[nextIdx]?.documentId ?? null) : null;
            sendToMain({ type: "removeFavorite", documentId: focusedId });
            setFocusedId(nextId);
        }
    }

    if (favorites.length === 0) {
        return (
            <div>
                <AddButton disabled={!activeDocumentId} sendToMain={sendToMain} />
                <p style={{ ...STYLES.text, color: "var(--color-text-muted)", marginTop: "16px" }}>
                    No favorites yet. Open a document and click + Add current document.
                </p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            style={{ outline: "none" }}
            onKeyDown={handleKeyDown}
        >
            <AddButton disabled={!activeDocumentId || isActiveAlreadyFavorited} sendToMain={sendToMain} />
            <table style={{ ...STYLES.text, width: "100%", borderCollapse: "collapse", marginTop: "8px", tableLayout: "fixed" }}>
                <colgroup>
                    <col style={{ width: "28px" }} />
                    <col />
                </colgroup>
                <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                        <th
                            onClick={() => toggleSort("documentType")}
                            style={{ cursor: "pointer", padding: "4px 4px", userSelect: "none", fontWeight: "normal", textAlign: "center" }}
                            title="Sort by type"
                        >
                            <SortIndicator col="documentType" preferences={preferences} />
                        </th>
                        <th
                            onClick={() => toggleSort("documentName")}
                            style={{ textAlign: "left", cursor: "pointer", padding: "4px 8px", userSelect: "none", fontWeight: "normal" }}
                        >
                            Name<SortIndicator col="documentName" preferences={preferences} />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map(entry => (
                        <FavoriteRow
                            key={entry.documentId}
                            entry={entry}
                            isActive={entry.documentId === activeDocumentId}
                            isFocused={entry.documentId === focusedId}
                            onFocus={() => {
                                setFocusedId(entry.documentId);
                                containerRef.current?.focus();
                            }}
                            onDoubleClick={() => sendToMain({ type: "openDocument", documentId: entry.documentId })}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setFocusedId(entry.documentId);
                                setContextMenu({ x: e.clientX, y: e.clientY, documentId: entry.documentId });
                            }}
                        />
                    ))}
                </tbody>
            </table>
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    documentId={contextMenu.documentId}
                    onClose={handleCloseContextMenu}
                    sendToMain={sendToMain}
                />
            )}
        </div>
    );
}

function AddButton({
    disabled,
    sendToMain,
}: {
    disabled: boolean;
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            disabled={disabled}
            onClick={() => sendToMain({ type: "addFavorite" })}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                ...STYLES.btn,
                background: hovered && !disabled ? "var(--color-btn-hover)" : "var(--color-btn-bg)",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.5 : 1,
                width: "100%",
            }}
        >
            + Add current document
        </button>
    );
}

function FavoriteRow({
    entry,
    isActive,
    isFocused,
    onFocus,
    onDoubleClick,
    onContextMenu,
}: {
    entry: FavoriteEntry;
    isActive: boolean;
    isFocused: boolean;
    onFocus: () => void;
    onDoubleClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
}) {
    const [hovered, setHovered] = useState(false);

    const rowStyle: React.CSSProperties = {
        cursor: "pointer",
        outline: isFocused ? "1px solid var(--color-focus-border)" : "none",
        outlineOffset: "-1px",
        backgroundColor: isActive
            ? "var(--color-row-active)"
            : hovered
            ? "var(--color-row-hover)"
            : "transparent",
        color: "var(--color-text)",
    };

    return (
        <tr
            style={rowStyle}
            title={`${entry.moduleName} › ${entry.documentName}`}
            onClick={onFocus}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <td style={{ padding: "3px 4px", width: "20px", lineHeight: 0 }}>
                {getDocumentTypeIcon(entry.documentType)}
            </td>
            <td style={{
                padding: "3px 8px",
                maxWidth: "0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}>
                {entry.documentName}
            </td>
        </tr>
    );
}


function Notification({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return (
        <div style={{
            ...STYLES.text,
            background: "var(--color-btn-bg)",
            border: "1px solid var(--color-border)",
            padding: "6px 10px",
            marginBottom: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
        }}>
            <span>{message}</span>
            <button
                onClick={onDismiss}
                style={{ ...STYLES.text, border: "none", background: "none", cursor: "pointer", marginLeft: "8px" }}
                title="Dismiss"
            >
                ×
            </button>
        </div>
    );
}

function DocumentNotFoundModal({
    info,
    onRemove,
    onKeep,
}: {
    info: { documentId: string; documentName: string; moduleName: string };
    onRemove: () => void;
    onKeep: () => void;
}) {
    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
        }}>
            <div style={{
                ...STYLES.text,
                background: "var(--color-menu-bg)",
                border: "1px solid var(--color-border)",
                padding: "20px",
                maxWidth: "380px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}>
                <p style={{ margin: "0 0 16px" }}>
                    The document <strong>'{info.documentName}'</strong> ({info.moduleName}) could
                    not be opened. It may have been deleted or renamed.
                </p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button
                        onClick={onKeep}
                        style={{ ...STYLES.btn }}
                    >
                        Keep
                    </button>
                    <button
                        onClick={onRemove}
                        style={{ ...STYLES.btn, color: "#fff", background: "#c0392b", border: "none" }}
                    >
                        Remove from Favorites
                    </button>
                </div>
            </div>
        </div>
    );
}
