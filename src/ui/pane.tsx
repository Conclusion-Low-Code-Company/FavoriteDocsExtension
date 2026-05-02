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

// ── Placeholder sub-components (replaced in Tasks 7 and 8) ───────────────────

function FavoritesTable(_props: {
    favorites: FavoriteEntry[];
    activeDocumentId: string | null;
    preferences: Preferences;
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
}) {
    return <p style={{ color: "#999" }}>Table coming in Task 7…</p>;
}

function IdentityForm({ onSubmit }: { onSubmit: (value: string) => void }) {
    return <p style={{ color: "#999" }}>Identity form coming in Task 8…</p>;
    void onSubmit;
}

function Notification({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return <p style={{ color: "#999" }}>Notification: {message} <button onClick={onDismiss}>×</button></p>;
}

function DocumentNotFoundModal(_props: {
    info: { documentId: string; documentName: string; moduleName: string };
    onRemove: () => void;
    onKeep: () => void;
}) {
    return <p style={{ color: "#999" }}>Error modal coming in Task 8…</p>;
}
