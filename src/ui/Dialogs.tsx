import React from "react";

export function Notification({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return (
        <div className="fd-notification">
            <span>{message}</span>
            <button onClick={onDismiss} className="fd-notification__dismiss" title="Dismiss">
                ×
            </button>
        </div>
    );
}

export function DocumentNotFoundModal({
    info,
    onRemove,
    onKeep,
}: {
    info: { documentId: string; documentName: string; moduleName: string };
    onRemove: () => void;
    onKeep: () => void;
}) {
    return (
        <div className="fd-modal-backdrop">
            <div className="fd-modal">
                <p className="fd-modal__body">
                    The document <strong>'{info.documentName}'</strong> ({info.moduleName}) could
                    not be opened. It may have been deleted or renamed.
                </p>
                <div className="fd-modal__actions">
                    <button onClick={onKeep} className="fd-btn">Keep</button>
                    <button onClick={onRemove} className="fd-btn fd-btn--danger">
                        Remove from Favorites
                    </button>
                </div>
            </div>
        </div>
    );
}
