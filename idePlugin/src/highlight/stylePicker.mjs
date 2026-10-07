// Il comando "viteTranslate: Choose highlight style…" (vitetranslate.highlightStyle): gli stili in
// una Quick Pick. Quello sotto la selezione si vede subito negli editor aperti (Highlighter.preview);
// diventa l'impostazione solo con Invio. Esc, o un clic fuori, rimette lo stile di prima.
import * as vscode from "vscode";
import { STYLES, HIGHLIGHT_OFF } from "./highlightStyles.mjs";
import { HIGHLIGHT_SETTING } from "./highlighter.mjs";

/** Le voci della Quick Pick: Off, poi il catalogo; quella in uso lo dice. */
export function pickerItems(attuale) {
  const voci = [
    { id: HIGHLIGHT_OFF, label: "Off", description: "No highlighting" },
    ...STYLES.map((s) => ({ id: s.id, label: s.name, description: s.description })),
  ];
  for (const v of voci) if (v.id === attuale) v.description += " · current";
  return voci;
}

// Scrive la scelta dove l'utente l'aveva già messa: se il workspace ha la sua, scriverla nelle
// impostazioni utente non cambierebbe niente. La usa anche l'accordion Highlight style di Settings,
// nella sezione facoltativa (optionalView.mjs). Se la scrittura non riesce (un settings.json
// rotto) lo dice all'utente, e si risolve con false: mai un rifiuto.
export async function saveHighlightStyle(id) {
  const config = vscode.workspace.getConfiguration("vitetranslate");
  const dove = config.inspect(HIGHLIGHT_SETTING);
  const target = dove?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
  try {
    await config.update(HIGHLIGHT_SETTING, id, target);
    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`viteTranslate: could not save the highlight style: ${error?.message ?? error}`);
    return false;
  }
}

/**
 * Apre la scelta. Si risolve, a Quick Pick chiusa, con l'id salvato, o null se non è cambiato niente.
 * @param {import("./highlighter.mjs").Highlighter} highlighter
 * @returns {Promise<string | null>}
 */
export function pickHighlightStyle(highlighter) {
  const attuale = highlighter.configured;
  const qp = vscode.window.createQuickPick();
  qp.title = "viteTranslate: highlight style";
  qp.placeholder = "Move through the list to try each style in the editor. Enter keeps it.";
  qp.items = pickerItems(attuale);
  qp.activeItems = qp.items.filter((v) => v.id === attuale);
  let scelto = null;
  return new Promise((resolve) => {
    qp.onDidChangeActive(([v]) => v && highlighter.preview(v.id));
    qp.onDidAccept(() => {
      scelto = qp.activeItems[0] ?? null;
      qp.hide();
    });
    // Prima si salva, poi si toglie l'anteprima: al contrario lo stile vecchio tornerebbe per un
    // attimo, finché l'impostazione nuova non arriva.
    qp.onDidHide(async () => {
      qp.dispose();
      const salvato = !!scelto && scelto.id !== attuale && (await saveHighlightStyle(scelto.id));
      highlighter.preview(null);
      resolve(salvato ? scelto.id : null);
    });
    qp.show();
  });
}
