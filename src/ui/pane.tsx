import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ComponentContext, IComponent } from "@mendix/extensions-api";

export const component: IComponent = {
    async loaded(_componentContext: ComponentContext) {
        createRoot(document.getElementById("root")!).render(
            <StrictMode>
                <p>FavoriteDocs loading…</p>
            </StrictMode>
        );
    }
}
