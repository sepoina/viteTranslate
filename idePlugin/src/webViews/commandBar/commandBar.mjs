// La barra dei comandi: in fondo, ferma, la stessa per Project e per le pagine della sezione
// facoltativa (Help, LLM, Settings). Stesso <footer class="actions">, stesso stile
// (COMMAND_BAR_CSS), bottoni tutti primari come Sync. Due modi:
//   - Project: a sinistra i bottoni (ACTIONS), a destra le icone-bottone (ICONS): GitHub, Settings,
//     Refresh;
//   - facoltativa (`back`): a sinistra Back e i comandi della pagina (Check again e il ? di LLM,
//     Open the options), a destra l'icona della pagina. Se Back è solo, l'icona è preceduta da "Return to
//     project"; coi comandi della pagina la scritta non c'è (non c'è posto, e Back si spiega da sé).
// Nessun import di `vscode`.
import { escape } from "../pageCommon.mjs";

/**
 * I bottoni di Project. `cmd` è il messaggio che manda il clic. LLM è sempre cliccabile, e parte
 * "da configurare" (icona `?`, tooltip LLM_OFF): se il progetto ha `llm` lo stato gli dà la
 * freccia del sottomenu (LLM_ICON).
 */
export const ACTIONS = [
  { cmd: "sync", label: "Sync", title: "Run the sync: bring the language files in line with the source" },
  { cmd: "llm", label: "LLM", title: "Translate with an LLM, and the other --llm-* actions", iconAfter: "question", off: true },
];
/**
 * Le icone-bottone (codicon) di Project, a destra, nell'ordine. GitHub apre PROJECT_URL nel
 * browser; l'ingranaggio apre Settings, che riunisce le impostazioni: lo stile di evidenziazione,
 * vite.config, quelle dell'estensione, lo stato dei file.
 */
export const ICONS = [
  { cmd: "github", icon: "github-inverted", title: "viteTranslate on GitHub: docs, issues, releases" },
  { cmd: "settings", icon: "settings-gear", title: "Settings: highlight style, vite.config, the extension settings and the project's files, in Results' place" },
  { cmd: "refresh", icon: "refresh", title: "Refresh: read vite.config and scan the source again" },
];
/** Il progetto su GitHub: la documentazione, le issue, le release. */
export const PROJECT_URL = "https://github.com/sepoina/viteTranslate";
/** Il tooltip di LLM quando il progetto non ha `llm`: il clic apre Help. */
export const LLM_OFF = "LLM is not set up for this project: click to see how";
/** L'icona dopo LLM: il sottomenu delle azioni, o il `?` di Help. */
export const LLM_ICON = { on: "chevron-right", off: "question" };

/** Il tasto che rimette Results e Project, primario come Sync: "Close" sembrava chiudere l'estensione. */
export const BACK_BUTTON = `<vscode-button data-cmd="close" icon="arrow-left" title="Back to Results and Project">Back</vscode-button>`;
/** La scritta a destra, prima dell'icona della pagina, quando Back è l'unico bottone. */
export const BACK_LABEL = "Return to project";

/**
 * Lo stile della barra, da aggiungere dopo COLUMN_CSS. Non si restringe mai: se la sezione è
 * bassa cede prima <main>, fino a zero.
 */
export const COMMAND_BAR_CSS = `
    footer { flex: none; padding: 8px 12px 10px; border-top: 1px solid var(--vscode-sideBarSectionHeader-border, transparent); }
    .actions {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: center;
      background-color: var(--vscode-chat-inputWorkingBorderColor2);
    }
    /* Bottoni a sinistra, icone a destra: il margine automatico spinge le icone in fondo. */
    .bottoni, .icone { display: flex; align-items: center; gap: 6px; }
    .icone { margin-left: auto; gap: 2px; }
    .ritorno { margin-right: 4px; color: var(--vscode-descriptionForeground); }
    .pagina { margin-right: 3px; }
    /* Andata a capo (la classe la mette commandBarScript.mjs): le icone sulla seconda riga, tutta
       loro, con margini ampi ai lati e lo stesso spazio tra l'una e l'altra. Nelle pagine
       facoltative a destra ci sono la scritta e l'icona della pagina: si centrano e basta. */
    .actions.a-capo .icone {
      flex: 1 1 100%; box-sizing: border-box; margin-left: 0; padding: 0 10%; justify-content: space-between;
    }
    .actions.a-capo .icone:has(> .pagina) { justify-content: center; }`;

/**
 * Un comando di pagina facoltativa, nella barra dopo Back: un bottone, o con `iconOnly` un'icona-bottone
 * come quelle di Project (`label` resta il suo nome per gli screen reader). Con `hidden` parte
 * nascosto: lo mostra lo script della pagina, quando serve.
 * @typedef {{ cmd: string, label: string, title: string, icon?: string, id?: string, iconOnly?: boolean, hidden?: boolean }} Comando
 */
const bottone = (c) => {
  const id = c.id ? ` id="${c.id}"` : "";
  const nascosto = c.hidden ? " hidden" : "";
  if (c.iconOnly) {
    return `<vscode-icon${id} data-cmd="${c.cmd}" name="${c.icon}" action-icon label="${escape(c.label)}" title="${escape(c.title)}"${nascosto}></vscode-icon>`;
  }
  return `<vscode-button${id} data-cmd="${c.cmd}"${c.icon ? ` icon="${c.icon}"` : ""} title="${escape(c.title)}"${nascosto}>${escape(c.label)}</vscode-button>`;
};

/**
 * La barra. Quella di Project, o con `back` quella di una pagina facoltativa.
 *
 * @param {object} [p]
 * @param {{ icon: string, name: string }} [p.back] - la pagina facoltativa: la sua codicon e il suo nome
 * @param {Comando[]} [p.commands] - i comandi della pagina, a sinistra dopo Back
 * @returns {string}
 */
export function commandBarHtml({ back = null, commands = [] } = {}) {
  if (back) {
    const sinistra = [BACK_BUTTON, ...commands.map(bottone)].join("\n      ");
    const ritorno = commands.length ? "" : `<span class="ritorno">${escape(BACK_LABEL)}</span>\n      `;
    return `<footer class="actions">
    <div class="bottoni">
      ${sinistra}
    </div>
    <div class="icone">
      ${ritorno}<vscode-icon class="pagina" name="${back.icon}" label="${escape(back.name)}" title="${escape(back.name)}"></vscode-icon>
    </div>
  </footer>`;
  }
  const bottoni = ACTIONS.map(
    (a) => `<vscode-button id="btn-${a.cmd}" data-cmd="${a.cmd}" title="${escape(a.off ? LLM_OFF : a.title)}" data-title="${escape(a.title)}"${a.iconAfter ? ` icon-after="${a.iconAfter}"` : ""}>${escape(a.label)}</vscode-button>`
  ).join("\n      ");
  const icone = ICONS.map(
    (i) => `<vscode-icon data-cmd="${i.cmd}" name="${i.icon}" action-icon label="${escape(i.title)}" title="${escape(i.title)}"></vscode-icon>`
  ).join("\n      ");
  return `<footer class="actions">
    <div class="bottoni">
      ${bottoni}
    </div>
    <div class="icone">
      ${icone}
    </div>
  </footer>`;
}
