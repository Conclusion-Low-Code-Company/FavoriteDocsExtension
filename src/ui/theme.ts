export const THEME_TOKENS: Record<"Light" | "Dark", Record<string, string>> = {
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

export function applyTheme(theme: "Light" | "Dark"): void {
    const tokens = THEME_TOKENS[theme];
    for (const [key, value] of Object.entries(tokens)) {
        document.documentElement.style.setProperty(key, value);
    }
}

const CSS = `
.fd-pane{font-family:var(--font-family);font-size:var(--font-size);color:var(--color-text);background:var(--color-bg);height:100%;box-sizing:border-box;display:flex;flex-direction:column}
.fd-setup{font-family:var(--font-family);font-size:var(--font-size);color:var(--color-text);padding:16px;background:var(--color-bg);height:100%;box-sizing:border-box}
.fd-setup__title{margin-top:0;margin-bottom:8px;font-weight:bold}
.fd-header{display:flex;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid var(--color-border);flex-shrink:0}
.fd-create-form{display:flex;gap:4px;padding:4px 8px;border-bottom:1px solid var(--color-border);flex-shrink:0}
.fd-content{flex:1;overflow:auto;padding:8px}

.fd-btn{font-family:var(--font-family);font-size:var(--font-size);color:var(--color-text);background:var(--color-btn-bg);border:1px solid var(--color-border);padding:4px 10px;cursor:pointer}
.fd-btn:hover:not(:disabled){background:var(--color-btn-hover)}
.fd-btn:disabled{cursor:default;opacity:0.5}
.fd-btn--sm{padding:3px 8px}
.fd-btn--icon{padding:3px 8px;font-weight:bold}
.fd-btn--full{width:100%}
.fd-btn--setup{width:100%;margin-top:6px}
.fd-btn--danger{color:#fff;background:#c0392b;border:none}

.fd-input{font-family:var(--font-family);font-size:var(--font-size);color:var(--color-text);background:var(--color-btn-bg);border:1px solid var(--color-border);padding:4px 6px;box-sizing:border-box}
.fd-input--full{width:100%}
.fd-input--flex{flex:1;padding:3px 4px}

.fd-table-wrap{outline:none}
.fd-table{font-family:var(--font-family);font-size:var(--font-size);color:var(--color-text);width:100%;border-collapse:collapse;margin-top:8px;table-layout:fixed}
.fd-col--icon{width:28px}
.fd-thead-row{border-bottom:1px solid var(--color-border);color:var(--color-text-muted)}
.fd-th--icon{cursor:pointer;padding:4px;user-select:none;font-weight:normal;text-align:center}
.fd-th--name{text-align:left;cursor:pointer;padding:4px 8px;user-select:none;font-weight:normal}
.fd-row{cursor:pointer;color:var(--color-text)}
.fd-row:hover{background-color:var(--color-row-hover)}
.fd-row--active{background-color:var(--color-row-active)!important}
.fd-row--focused{outline:1px solid var(--color-focus-border);outline-offset:-1px}
.fd-td--icon{padding:3px 4px;width:20px;line-height:0}
.fd-td--name{padding:3px 8px;max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fd-empty-msg{font-family:var(--font-family);font-size:var(--font-size);color:var(--color-text-muted);margin-top:16px}

.fd-menu-overlay{position:fixed;inset:0;z-index:999}
.fd-menu{font-family:var(--font-family);font-size:var(--font-size);color:var(--color-text);position:fixed;background:var(--color-menu-bg);border:1px solid var(--color-border);box-shadow:0 2px 8px rgba(0,0,0,.25);z-index:1000;min-width:172px}
.fd-menu-item{padding:6px 12px;cursor:pointer;color:var(--color-text)}
.fd-menu-item:hover{background:var(--color-menu-hover)}

.fd-notification{font-family:var(--font-family);font-size:var(--font-size);color:var(--color-text);background:var(--color-btn-bg);border:1px solid var(--color-border);padding:6px 10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}
.fd-notification__dismiss{font-family:var(--font-family);font-size:var(--font-size);color:var(--color-text);border:none;background:none;cursor:pointer;margin-left:8px}

.fd-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000}
.fd-modal{font-family:var(--font-family);font-size:var(--font-size);color:var(--color-text);background:var(--color-menu-bg);border:1px solid var(--color-border);padding:20px;max-width:380px;box-shadow:0 4px 16px rgba(0,0,0,.3)}
.fd-modal__body{margin:0 0 16px}
.fd-modal__actions{display:flex;gap:8px;justify-content:flex-end}
`;

export function injectStyles(): void {
    const id = "fd-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = CSS;
    document.head.appendChild(el);
}
