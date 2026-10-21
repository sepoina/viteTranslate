// Il tooltip in HTML delle webview, al posto di quello nativo: lo stile e i modelli. Lo mostra
// tooltipScript.mjs, un fumetto solo per pagina. I colori sono invertiti rispetto al tema: lo
// sfondo è il colore del testo del pannello, il testo è il suo sfondo. Scuro su un tema chiaro,
// chiaro su uno scuro: si stacca da quello che copre in ogni tema, restando nella sua tavolozza.
// Nei temi ad alto contrasto prende anche il bordo (contrastBorder, che solo loro definiscono).
//
// Come si usa:
//   - TOOLTIP_CSS nello stile di ogni pagina, e installTooltips() (tooltipScript.mjs) nel suo
//     script: da lì ogni `title` della pagina diventa un fumetto. Testo su più righe: "\n";
//   - quando un testo non basta (righe centrate, una in rilievo: una chiave, un percorso),
//     l'elemento ha la classe `suggerito` e contiene tooltipHtml(…): un modello, nascosto, che il
//     fumetto copia. Il modello è aria-hidden: agli screen reader la frase la dà l'elemento
//     (aria-label).
// Nessun import di `vscode`.
import { escape } from "../pageCommon.mjs";

/** Lo stile del fumetto e dei suoi modelli, da aggiungere dopo COLUMN_CSS. */
export const TOOLTIP_CSS = `
    .suggerito > .fumetto { display: none; }
    .fumetto.mobile {
      position: fixed; top: 0; left: 0; z-index: 1000; box-sizing: border-box;
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      width: max-content; max-width: min(320px, calc(100vw - 12px)); padding: 6px 10px;
      font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); font-weight: normal; font-style: normal;
      letter-spacing: normal; text-transform: none; line-height: 1.4; text-align: center;
      white-space: pre-line; overflow-wrap: anywhere;
      color: var(--vscode-sideBar-background, var(--vscode-editor-background));
      background: var(--vscode-foreground);
      border: 1px solid var(--vscode-contrastBorder, transparent); border-radius: 4px;
      box-shadow: 0 2px 8px var(--vscode-widget-shadow);
      pointer-events: none; opacity: 0; transition: opacity 0.1s;
    }
    .fumetto.mobile.acceso { opacity: 1; }
    .fumetto .rilievo { font-family: var(--vscode-editor-font-family); font-weight: 600; word-break: break-all; }`;

/**
 * Il modello di un fumetto impaginato, da mettere dentro l'elemento `suggerito`. Una riga per
 * voce: un testo, o `{ text, id, strong }` — `id` per riempirla dallo script della pagina,
 * `strong` per il rilievo (il font dell'editor, in grassetto).
 * @param {(string | { text?: string, id?: string, strong?: boolean })[]} righe
 * @returns {string}
 */
export function tooltipHtml(righe) {
  const riga = (r) => {
    const { text = "", id, strong } = typeof r === "string" ? { text: r } : r;
    return `<span${id ? ` id="${id}"` : ""}${strong ? ' class="rilievo"' : ""}>${escape(text)}</span>`;
  };
  return `<span class="fumetto" aria-hidden="true">${righe.map(riga).join("")}</span>`;
}
