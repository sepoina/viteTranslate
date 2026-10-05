// Quello che le pagine delle webview hanno in comune: l'intestazione con la CSP e i codicons, lo
// stile di base, e quello delle pagine della sezione facoltativa (Help, LLM, Inspector). Nessun
// import di `vscode`.
//
// La CSP chiude tutto tranne lo script col `nonce` e gli stili: quelli dei componenti Lit passano
// da adoptedStyleSheets, il <style> della pagina è inline. I colori sono le variabili del tema di
// VS Code, che la webview riceve già: chiaro o scuro, nessun lavoro.

export const escape = (testo) => String(testo).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * Da `<!DOCTYPE html>` all'apertura di <style>: chi la usa aggiunge il suo stile e chiude.
 *
 * @param {object} p
 * @param {string} p.codiconsUri - dist/codicon.css come lo vede la webview: le icone di vscode-icon
 * @param {string} p.cspSource - webview.cspSource
 * @param {string} p.nonce
 */
export const pageHead = ({ codiconsUri, cspSource, nonce }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource};">
  <link id="vscode-codicon-stylesheet" rel="stylesheet" href="${codiconsUri}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>`;

/** Una colonna alta quanto la sezione, il <main> che scorre, i titoli e le righe `.ciro`. */
export const COLUMN_CSS = `
    html, body { height: 100%; margin: 0; }
    body {
      display: flex; flex-direction: column; box-sizing: border-box; padding: 0;
      font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground);
    }
    main { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px 12px 0; }
    section { margin-bottom: 12px; }
    h2 {
      margin: 8px 0 5px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
      text-transform: uppercase; color: var(--vscode-chat-linesAddedForeground);
    }
    .ciro {
     border-left: 1px solid color-mix(in srgb, var(--vscode-chat-linesAddedForeground), transparent 80%);
     margin-left: 7px;
     padding-left: 9px;
     }
    .ciro[aria-selected="true"] {
      border-left: 2px solid color-mix(in srgb, var(--vscode-chat-linesAddedForeground), transparent 44%);
      margin-left: 7px;
      padding-left: 8px;
    }
    [hidden] { display: none !important; }`;

/**
 * Le pagine della sezione facoltativa si prendono il pannello (Results e Project spariscono): uno
 * sfondo tinto dall'accento del tema, perché si veda che è un'altra modalità, e la barra in fondo,
 * ferma, con Back a sinistra (BACK_BUTTON) e le azioni della pagina a destra (`.destra`).
 * Da aggiungere dopo COLUMN_CSS.
 */
export const OPTIONAL_CSS = `
    body { background: color-mix(in srgb, var(--vscode-sideBar-background), var(--vscode-focusBorder) 8%); }
    footer {
      flex: none; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      padding: 8px 12px 10px; border-top: 1px solid var(--vscode-sideBarSectionHeader-border, transparent);
    }
    footer .destra { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }`;

/** Il tasto che rimette Results e Project: "Close" sembrava chiudere l'estensione. */
export const BACK_BUTTON = `<vscode-button data-cmd="close" secondary icon="arrow-left" title="Back to Results and Project">Back</vscode-button>`;
