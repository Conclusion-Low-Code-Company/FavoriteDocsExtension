import React, { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ComponentContext, IComponent, getStudioProApi } from "@mendix/extensions-api";
import type { FavoriteEntry, MainToPaneMessage, Preferences, PaneToMainMessage } from "../types.js";
import { DEFAULT_PREFERENCES } from "../types.js";

interface PaneState {
    favorites: FavoriteEntry[];
    activeDocumentId: string | null;
    preferences: Preferences;
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
        needsIdentity: false,
        documentNotFound: null,
        notification: null,
    });

    useEffect(() => {
        onRegisterDispatch((msg) => {
            setState((prev) => applyMessage(prev, msg));
        });
    }, [onRegisterDispatch]);

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
            return { ...prev, favorites: msg.favorites };
        case "activeDocumentChanged":
            return { ...prev, activeDocumentId: msg.documentId };
        case "preferencesChanged":
            return { ...prev, preferences: { sortColumn: msg.sortColumn, sortDirection: msg.sortDirection } };
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
    const isActiveAlreadyFavorited = favorites.some(f => f.documentId === activeDocumentId);
    const sorted = sortFavorites(favorites, preferences);

    function toggleSort(column: typeof preferences.sortColumn) {
        const direction =
            preferences.sortColumn === column && preferences.sortDirection === "asc"
                ? "desc"
                : "asc";
        sendToMain({ type: "savePreferences", sortColumn: column, sortDirection: direction });
    }

    function SortIndicator({ col }: { col: typeof preferences.sortColumn }) {
        if (preferences.sortColumn !== col) return null;
        return <span>{preferences.sortDirection === "asc" ? " ▲" : " ▼"}</span>;
    }

    if (favorites.length === 0) {
        return (
            <div>
                <AddButton disabled={!activeDocumentId} sendToMain={sendToMain} />
                <p style={{ color: "#888", marginTop: "16px" }}>
                    No favorites yet. Open a document and click + Add current document.
                </p>
            </div>
        );
    }

    return (
        <div>
            <AddButton
                disabled={!activeDocumentId || isActiveAlreadyFavorited}
                sendToMain={sendToMain}
            />
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
                <thead>
                    <tr>
                        <th
                            onClick={() => toggleSort("moduleName")}
                            style={{ textAlign: "left", cursor: "pointer", padding: "4px 8px", userSelect: "none" }}
                        >
                            Module<SortIndicator col="moduleName" />
                        </th>
                        <th
                            onClick={() => toggleSort("documentName")}
                            style={{ textAlign: "left", cursor: "pointer", padding: "4px 8px", userSelect: "none" }}
                        >
                            Name<SortIndicator col="documentName" />
                        </th>
                        <th
                            onClick={() => toggleSort("documentType")}
                            style={{ textAlign: "left", cursor: "pointer", padding: "4px 8px", userSelect: "none" }}
                        >
                            Type<SortIndicator col="documentType" />
                        </th>
                        <th style={{ width: "24px" }} />
                        <th style={{ width: "24px" }} />
                    </tr>
                </thead>
                <tbody>
                    {sorted.map(entry => (
                        <FavoriteRow
                            key={entry.documentId}
                            entry={entry}
                            isActive={entry.documentId === activeDocumentId}
                            sendToMain={sendToMain}
                        />
                    ))}
                </tbody>
            </table>
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
    sendToMain,
}: {
    entry: FavoriteEntry;
    isActive: boolean;
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
}) {
    const [hovered, setHovered] = useState(false);
    const activeStyle: React.CSSProperties = isActive
        ? { fontWeight: "bold", backgroundColor: "#f0f4ff" }
        : {};

    return (
        <tr
            style={{ ...activeStyle, cursor: "pointer" }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onDoubleClick={() => sendToMain({ type: "openDocument", documentId: entry.documentId })}
        >
            <td style={{ padding: "3px 8px" }}>{entry.moduleName}</td>
            <td style={{ padding: "3px 8px" }}>{entry.documentName}</td>
            <td style={{ padding: "3px 8px", color: "#666" }}>{entry.documentType}</td>
            <td style={{ padding: "3px 4px", width: "24px" }}>
                {hovered && (
                    <button
                        title="Open"
                        onClick={() => sendToMain({ type: "openDocument", documentId: entry.documentId })}
                        style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
                    >
                        ↗
                    </button>
                )}
            </td>
            <td style={{ padding: "3px 4px", width: "24px" }}>
                {hovered && (
                    <button
                        title="Remove"
                        onClick={() => sendToMain({ type: "removeFavorite", documentId: entry.documentId })}
                        style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "#c00" }}
                    >
                        ×
                    </button>
                )}
            </td>
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
