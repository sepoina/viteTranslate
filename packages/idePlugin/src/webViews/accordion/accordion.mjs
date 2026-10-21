// L'accordion delle webview, nello stile delle azioni di LLM: ogni voce è una riga-azione a due
// piani (ACTION_CSS, in pageCommon.mjs) — l'icona, il nome, sotto il dettaglio, anche lungo — e il
// clic la apre sotto di sé. È un <details> con la sua <summary>: apertura, tastiera (Invio, Spazio)
// e screen reader li dà il browser. Le voci con lo stesso `group` (l'attributo `name` di <details>)
// si escludono: aprirne una chiude le altre. La voce aperta è in evidenza, come una riga
// selezionata: lo sfondo della selezione, la linea a sinistra più marcata (`.ciro`).
//
// Come si usa: COLUMN_CSS, ACTION_CSS e ACCORDION_CSS nello stile della pagina, accordionHtml(…) per
// ogni voce; perché la pagina ricordi quale è aperta, rememberAccordions (accordionScript.mjs) nel
// suo script. Nessun import di `vscode`.
import { escape } from "../pageCommon.mjs";

/** Lo stile degli accordion, da aggiungere dopo ACTION_CSS. */
export const ACCORDION_CSS = `
    .voce + .voce, .voce + .azione, .azione + .voce { margin-top: 2px; }
    .voce > summary { list-style: none; user-select: none; }
    .voce > summary::-webkit-details-marker { display: none; }
    .voce[open] > summary.ciro {
      background: var(--vscode-list-inactiveSelectionBackground);
      border-left: 2px solid color-mix(in srgb, var(--vscode-chat-linesAddedForeground), transparent 44%);
      padding-left: 8px;
    }
    .voce > .corpo { padding: 6px 0 10px 16px; }`;

/**
 * Una voce, chiusa.
 * @param {object} p
 * @param {string} p.id - per ricordarne lo stato (rememberAccordions)
 * @param {string} [p.group] - le voci dello stesso gruppo si escludono
 * @param {string} p.title - il nome
 * @param {string} p.icon - la codicon, nella prima colonna
 * @param {string} p.detail - sotto il nome, anche lungo
 * @param {string} p.body - l'HTML di quello che si apre
 * @returns {string}
 */
export function accordionHtml({ id, group, title, icon, detail, body }) {
  return `<details class="voce" id="${id}"${group ? ` name="${group}"` : ""}>
      <summary class="azione ciro"><vscode-icon name="${icon}"></vscode-icon><span>${escape(title)}</span><span class="desc">${escape(detail)}</span></summary>
      <div class="corpo">
        ${body}
      </div>
    </details>`;
}
