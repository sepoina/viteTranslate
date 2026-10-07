// Quello che le pagine delle webview hanno in comune: l'intestazione con la CSP e i codicons, lo
// stile di base, e quello delle pagine della sezione facoltativa (Help, LLM, Settings). La barra
// dei comandi sta in commandBar/commandBar.mjs. Nessun import di `vscode`.
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
 * Le righe-azione delle pagine (le azioni di LLM, le voci di Settings): a due piani, l'icona nella
 * prima colonna, il nome e sotto la descrizione nella seconda (la descrizione va a capo lì, sotto il
 * nome; un vscode-tree-item è alto una riga sola). Da aggiungere dopo COLUMN_CSS, con `.ciro`.
 */
export const ACTION_CSS = `
    .azione {
      display: grid; grid-template-columns: 16px 1fr; column-gap: 6px; align-items: center;
      padding: 3px 6px 4px 9px; cursor: pointer;
    }
    .azione + .azione { margin-top: 2px; }
    .azione:hover { background: var(--vscode-list-hoverBackground); }
    .azione:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    .azione .desc { grid-column: 2; line-height: 1.35; color: var(--vscode-descriptionForeground); }`;

/**
 * Una riga-azione scritta nell'HTML (quelle di LLM le fa lo script): un clic, Invio o Spazio
 * mandano `{ cmd }`, come i bottoni. Accanto agli accordion (accordion.mjs) ha la loro stessa
 * faccia, ma non si apre: fa.
 * @param {{ cmd: string, title: string, icon: string, detail: string }} p
 * @returns {string}
 */
export const actionRowHtml = ({ cmd, title, icon, detail }) =>
  `<div class="azione ciro" role="button" tabindex="0" data-cmd="${cmd}"><vscode-icon name="${icon}"></vscode-icon><span>${escape(title)}</span><span class="desc">${escape(detail)}</span></div>`;

/**
 * Le pagine della sezione facoltativa si prendono il pannello (Selector, Results e Project
 * spariscono): uno sfondo tinto dall'accento del tema, perché si veda che è un'altra modalità (14%:
 * si nota, senza gridare), e più aria sopra ogni capitolo (h2: 22px invece degli 8 di COLUMN_CSS).
 * La barra in fondo è quella di Project, con Back (commandBar.mjs). Da aggiungere dopo COLUMN_CSS.
 */
export const OPTIONAL_CSS = `
    body { background: color-mix(in srgb, var(--vscode-sideBar-background), var(--vscode-focusBorder) 14%); }
    h2 { margin-top: 22px; }`;
