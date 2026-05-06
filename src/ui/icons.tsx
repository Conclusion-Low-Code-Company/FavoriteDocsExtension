import React from "react";

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

const PAGE_ICON = (
    <TypeIcon>
        <path d="M2 1h6l4 4v8H2z"/>
        <polyline points="8,1 8,5 12,5"/>
    </TypeIcon>
);

const MICROFLOW_ICON = (
    <TypeIcon>
        <circle cx="7" cy="7" r="5.5"/>
        <path d="M5.5 4.5l5 2.5-5 2.5z"/>
    </TypeIcon>
);

const NANOFLOW_ICON = (
    <TypeIcon>
        <rect x="1.5" y="1.5" width="11" height="11"/>
        <path d="M5 4.5l5 2.5-5 2.5z"/>
    </TypeIcon>
);

const SNIPPET_ICON = (
    <TypeIcon>
        <path d="M2 1h6l4 4v8H2z"/>
        <polyline points="8,1 8,5 12,5"/>
        <polyline points="5,7 3.5,7 3.5,11 5,11"/>
        <polyline points="9,7 10.5,7 10.5,11 9,11"/>
    </TypeIcon>
);

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

export function getDocumentTypeIcon(type: string): React.ReactElement {
    return DOCUMENT_TYPE_ICONS[type] ?? GENERIC_ICON;
}
