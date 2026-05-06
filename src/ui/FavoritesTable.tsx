import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { FavoriteEntry, Preferences, PaneToMainMessage, SortColumn } from "../types.js";
import { getDocumentTypeIcon } from "./icons.js";
import { ContextMenu } from "./ContextMenu.js";

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
            className="fd-btn fd-btn--full"
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
    const cls = ["fd-row", isActive && "fd-row--active", isFocused && "fd-row--focused"]
        .filter(Boolean).join(" ");

    return (
        <tr
            className={cls}
            title={`${entry.moduleName} › ${entry.documentName}`}
            onClick={onFocus}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
        >
            <td className="fd-td--icon">{getDocumentTypeIcon(entry.documentType)}</td>
            <td className="fd-td--name">{entry.documentName}</td>
        </tr>
    );
}

export function FavoritesTable({
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

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
    }, [sorted, focusedId, sendToMain]);

    if (favorites.length === 0) {
        return (
            <div>
                <AddButton disabled={!activeDocumentId} sendToMain={sendToMain} />
                <p className="fd-empty-msg">
                    No favorites yet. Open a document and click + Add current document.
                </p>
            </div>
        );
    }

    return (
        <div ref={containerRef} tabIndex={0} className="fd-table-wrap" onKeyDown={handleKeyDown}>
            <AddButton disabled={!activeDocumentId || isActiveAlreadyFavorited} sendToMain={sendToMain} />
            <table className="fd-table">
                <colgroup>
                    <col className="fd-col--icon" />
                    <col />
                </colgroup>
                <thead>
                    <tr className="fd-thead-row">
                        <th className="fd-th--icon" onClick={() => toggleSort("documentType")} title="Sort by type">
                            <SortIndicator col="documentType" preferences={preferences} />
                        </th>
                        <th className="fd-th--name" onClick={() => toggleSort("documentName")}>
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
