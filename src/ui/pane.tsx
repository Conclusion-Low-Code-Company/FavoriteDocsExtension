import React, { StrictMode, useEffect, useState } from "react";
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
    Page: PAGE_ICON,
    Microflow: MICROFLOW_ICON,
    Nanoflow: NANOFLOW_ICON,
    Snippet: SNIPPET_ICON,
};

function getDocumentTypeIcon(type: string): React.ReactElement {
    return DOCUMENT_TYPE_ICONS[type] ?? GENERIC_ICON;
}

interface PaneState {
    favorites: FavoriteEntry[];
    activeDocumentId: string | null;
    preferences: Preferences;
    theme: "Light" | "Dark";
    needsIdentity: boolean;
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
        theme: "Dark",
        needsIdentity: false,
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

    if (state.needsIdentity) {
        return <IdentityForm onSubmit={(value) => sendToMain({ type: "setIdentity", value })} />;
    }

    return (
        <div style={{ padding: "8px", fontFamily: "sans-serif", fontSize: "13px" }}>
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
    );
}

function applyMessage(prev: PaneState, msg: MainToPaneMessage): PaneState {
    switch (msg.type) {
        case "favoritesChanged":
            return { ...prev, favorites: msg.favorites, needsIdentity: false };
        case "activeDocumentChanged":
            return { ...prev, activeDocumentId: msg.documentId };
        case "preferencesChanged":
            return { ...prev, preferences: { sortColumn: msg.sortColumn, sortDirection: msg.sortDirection } };
        case "studioThemeChanged":
            return { ...prev, theme: msg.theme };
        case "needsIdentity":
            return { ...prev, needsIdentity: true };
        case "documentNotFound":
            return { ...prev, documentNotFound: { documentId: msg.documentId, documentName: msg.documentName, moduleName: msg.moduleName } };
        case "notification":
            return { ...prev, notification: msg.message };
        default:
            return prev;
    }
}

// ── Favorites table ───────────────────────────────────────────────────────────

function sortFavorites(favorites: FavoriteEntry[], prefs: Preferences): FavoriteEntry[] {
    return [...favorites].sort((a, b) => {
        const aVal = a[prefs.sortColumn].toLowerCase();
        const bVal = b[prefs.sortColumn].toLowerCase();
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

    const isActiveAlreadyFavorited = favorites.some(f => f.documentId === activeDocumentId);
    const sorted = sortFavorites(favorites, preferences);

    // Clear focus if focused entry was removed externally
    useEffect(() => {
        if (focusedId !== null && !favorites.some(f => f.documentId === focusedId)) {
            setFocusedId(null);
        }
    }, [favorites, focusedId]);

    function toggleSort(column: SortColumn) {
        const direction =
            preferences.sortColumn === column && preferences.sortDirection === "asc" ? "desc" : "asc";
        sendToMain({ type: "savePreferences", sortColumn: column, sortDirection: direction });
    }

    if (favorites.length === 0) {
        return (
            <div>
                <AddButton disabled={!activeDocumentId} sendToMain={sendToMain} />
                <p style={{ color: "var(--color-text-muted)", marginTop: "16px", fontFamily: "var(--font-family)", fontSize: "var(--font-size)" }}>
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
        >
            <AddButton disabled={!activeDocumentId || isActiveAlreadyFavorited} sendToMain={sendToMain} />
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px", tableLayout: "fixed", fontFamily: "var(--font-family)", fontSize: "var(--font-size)" }}>
                <colgroup>
                    <col style={{ width: "28px" }} />
                    <col />
                    <col style={{ width: "60px" }} />
                </colgroup>
                <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                        <th style={{ padding: "4px 4px", userSelect: "none", fontWeight: "normal" }} />
                        <th
                            onClick={() => toggleSort("documentName")}
                            style={{ textAlign: "left", cursor: "pointer", padding: "4px 8px", userSelect: "none", fontWeight: "normal" }}
                        >
                            Name<SortIndicator col="documentName" preferences={preferences} />
                        </th>
                        <th
                            onClick={() => toggleSort("documentType")}
                            style={{ textAlign: "left", cursor: "pointer", padding: "4px 8px", userSelect: "none", fontWeight: "normal", width: "60px" }}
                        >
                            Type<SortIndicator col="documentType" preferences={preferences} />
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
                    onClose={() => setContextMenu(null)}
                    sendToMain={sendToMain}
                />
            )}
        </div>
    );
}

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
                position: "fixed",
                left: x,
                top: y,
                background: "var(--color-menu-bg)",
                border: "1px solid var(--color-border)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                zIndex: 1000,
                fontFamily: "var(--font-family)",
                fontSize: "var(--font-size)",
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

function AddButton({
    disabled,
    sendToMain,
}: {
    disabled: boolean;
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
}) {
    return (
        <button
            disabled={disabled}
            onClick={() => sendToMain({ type: "addFavorite" })}
            style={{ cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}
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
            <td style={{ width: "60px" }} />
        </tr>
    );
}

function IdentityForm({ onSubmit }: { onSubmit: (value: string) => void }) {
    const [value, setValue] = useState("");

    return (
        <div style={{ padding: "16px", fontFamily: "sans-serif", fontSize: "13px" }}>
            <p>
                Enter your name to identify your favorites file. Using a different name
                next time will create a new empty file and leave the old one behind.
                Keep note of this name.
            </p>
            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onSubmit(value.trim()); }}
                placeholder="Your name"
                style={{ width: "100%", boxSizing: "border-box", marginBottom: "8px", padding: "4px 6px" }}
                autoFocus
            />
            <button
                disabled={!value.trim()}
                onClick={() => onSubmit(value.trim())}
                style={{ opacity: value.trim() ? 1 : 0.5 }}
            >
                Save
            </button>
        </div>
    );
}

function Notification({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return (
        <div
            style={{
                background: "#fff3cd",
                border: "1px solid #ffc107",
                borderRadius: "4px",
                padding: "6px 10px",
                marginBottom: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "12px",
            }}
        >
            <span>{message}</span>
            <button
                onClick={onDismiss}
                style={{ border: "none", background: "none", cursor: "pointer", marginLeft: "8px" }}
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
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
            }}
        >
            <div
                style={{
                    background: "#fff",
                    borderRadius: "6px",
                    padding: "20px",
                    maxWidth: "380px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                    fontFamily: "sans-serif",
                    fontSize: "13px",
                }}
            >
                <p style={{ margin: "0 0 16px" }}>
                    The document <strong>'{info.documentName}'</strong> ({info.moduleName}) could
                    not be opened. It may have been deleted or renamed.
                </p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button onClick={onKeep}>Keep</button>
                    <button
                        onClick={onRemove}
                        style={{ background: "#dc3545", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 10px", cursor: "pointer" }}
                    >
                        Remove from Favorites
                    </button>
                </div>
            </div>
        </div>
    );
}
