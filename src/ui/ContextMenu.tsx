import React, { useEffect } from "react";
import type { PaneToMainMessage } from "../types.js";

function ContextMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <div className="fd-menu-item" onClick={onClick}>
            {label}
        </div>
    );
}

export function ContextMenu({
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
            <div className="fd-menu-overlay" onClick={onClose} />
            {/* left/top must be inline — they are dynamic mouse coordinates */}
            <div className="fd-menu" style={{ left: x, top: y }}>
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
