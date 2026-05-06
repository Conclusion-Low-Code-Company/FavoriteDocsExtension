import React, { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ComponentContext, IComponent, getStudioProApi } from "@mendix/extensions-api";
import type { MainToPaneMessage, PaneToMainMessage } from "../types.js";
import { DEFAULT_PREFERENCES } from "../types.js";
import { THEME_TOKENS, applyTheme, injectStyles } from "./theme.js";
import { applyMessage } from "./reducer.js";
import type { PaneState, MessageDispatch } from "./reducer.js";
import { FavoritesTable } from "./FavoritesTable.js";
import { Notification, DocumentNotFoundModal } from "./Dialogs.js";

export const component: IComponent = {
    async loaded(componentContext: ComponentContext) {
        const studioPro = getStudioProApi(componentContext);

        const sendToMain = async (msg: PaneToMainMessage): Promise<void> => {
            await studioPro.ui.messagePassing.sendMessage(msg);
        };

        let dispatch: MessageDispatch = () => {};

        await studioPro.ui.messagePassing.addMessageHandler<MainToPaneMessage>(async (msgInfo) => {
            dispatch(msgInfo.message);
        });

        // Apply initial theme and inject CSS before the first render to avoid a flash of unstyled content.
        const initialTheme: "Light" | "Dark" = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "Dark" : "Light";
        applyTheme(initialTheme);
        injectStyles();

        // paneReady is sent from inside onRegisterDispatch (called by useEffect after mount)
        // so that dispatch is wired up before main responds with listOptions / studioThemeChanged.
        createRoot(document.getElementById("root")!).render(
            <StrictMode>
                <FavoritesPane
                    sendToMain={sendToMain}
                    initialTheme={initialTheme}
                    onRegisterDispatch={(fn) => {
                        dispatch = fn;
                        sendToMain({ type: "paneReady" });
                    }}
                />
            </StrictMode>
        );
    },
};

function FavoritesPane({
    sendToMain,
    initialTheme,
    onRegisterDispatch,
}: {
    sendToMain: (msg: PaneToMainMessage) => Promise<void>;
    initialTheme: "Light" | "Dark";
    onRegisterDispatch: (dispatch: MessageDispatch) => void;
}) {
    const [state, setState] = useState<PaneState>({
        favorites: [],
        activeDocumentId: null,
        preferences: DEFAULT_PREFERENCES,
        theme: initialTheme,
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
        applyTheme(state.theme);
    }, [state.theme]);

    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");

    const handleCreate = async () => {
        if (!newName.trim()) return;
        await sendToMain({ type: "selectList", name: newName.trim() });
        setNewName("");
        setShowCreate(false);
    };

    if (state.listNames.length === 0) {
        return (
            <div className="fd-setup">
                <p className="fd-setup__title">Create your favorites list</p>
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                    placeholder="Your name"
                    autoFocus
                    className="fd-input fd-input--full"
                />
                <button type="button" onClick={handleCreate} disabled={!newName.trim()}
                    className="fd-btn fd-btn--setup">
                    Create
                </button>
            </div>
        );
    }

    return (
        <div className="fd-pane">
            <div className="fd-header">
                <select
                    value={state.currentList ?? ""}
                    title="Your favorites list"
                    onChange={(e) => sendToMain({ type: "selectList", name: e.target.value })}
                    className="fd-input fd-input--flex"
                >
                    {state.listNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button
                    type="button"
                    title="Create new list"
                    onClick={() => { setShowCreate(v => !v); setNewName(""); }}
                    className="fd-btn fd-btn--icon"
                >
                    +
                </button>
            </div>
            {showCreate && (
                <div className="fd-create-form">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
                        placeholder="New list name"
                        autoFocus
                        className="fd-input fd-input--flex"
                    />
                    <button type="button" onClick={handleCreate} disabled={!newName.trim()}
                        className="fd-btn fd-btn--sm">
                        Create
                    </button>
                </div>
            )}
            <div className="fd-content">
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
