// Un elenco a scelta singola, per le sezioni del pannello: righe semplici, un triangolo verde sulla
// scelta e un puntino sulle altre. Lo usano Configs (quale progetto) e Marked (quale filtro).
//
// Il segno è una codicon col suo colore di tema (MARKS). Nella riga evidenziata da VS Code prende il
// colore di selezione del tema (list.activeSelectionIconForeground): è il prezzo di una codicon, e
// lo si paga per poterla cambiare scrivendone solo il nome. Si sceglie selezionando la riga (clic,
// Invio, spazio): extension.mjs collega `onDidChangeSelection` della vista a pick().
//
// La scelta è ottimistica: pick() sposta il segno sul posto, nelle righe già consegnate a VS Code,
// e restituisce le due che sono cambiate, così chi lo usa può ridisegnare solo quelle — un
// ridisegno completo farebbe perdere a VS Code l'evidenziazione e il focus appena messi sulla riga.
//
// Nessun import di `vscode`: si prova in Node puro, come summarize.mjs e markedRows.mjs.

/**
 * I due segni: una codicon e il suo colore di tema. I nomi delle codicon sono quelli di
 * https://code.visualstudio.com/api/references/icons-in-labels, i colori quelli di
 * https://code.visualstudio.com/api/references/theme-color.
 */
export const MARKS = {
  selected: { icon: "google-gemini", iconColor: "charts.green" },
  idle: { icon: "circle-small-filled", iconColor: "disabledForeground" },
};

/** Quale segno per una riga: "selected" o "idle", una chiave di MARKS. */
export const selectionMark = (selected) => (selected ? "selected" : "idle");

// Il segno scritto nella riga: `mark` dice quale, `icon` e `iconColor` lo disegnano.
const segna = (riga, selected) => Object.assign(riga, { mark: selectionMark(selected), ...MARKS[selectionMark(selected)] });

export class ChoiceList {
  /**
   * @param {object} p
   * @param {string} p.name - distingue le righe di questo elenco dalle altre della stessa vista
   * @param {*} [p.value] - la scelta di partenza; null: nessuna
   */
  constructor({ name, value = null }) {
    this.name = name;
    this.value = value;
    this.shown = new Map(); // valore -> la riga consegnata con l'ultimo rows()
  }

  /**
   * Le righe dell'elenco. Ogni voce è una riga qualunque (label, description, tooltip, id…) più
   * il suo `value`; ne esce con il segno e con `choice`, che dice a quale elenco appartiene.
   *
   * @param {Array<{ value: *, label: string } & object>} voci
   * @returns {object[]}
   */
  rows(voci) {
    const righe = voci.map(({ value, ...riga }) =>
      segna({ key: `${this.name}:${value}`, ...riga, choice: { list: this.name, value } }, value === this.value)
    );
    this.shown = new Map(righe.map((r) => [r.choice.value, r]));
    return righe;
  }

  /** La riga è di questo elenco? */
  owns(row) {
    return row?.choice?.list === this.name;
  }

  /** La riga mostrata per `value`, se c'è. */
  rowOf(value) {
    return this.shown.get(value);
  }

  /**
   * Sposta la scelta su `value`, e il segno con lei.
   *
   * @returns {object[] | null} le righe il cui segno è cambiato (una o due; nessuna se l'elenco non
   *   è ancora stato mostrato), o null se la scelta era già quella
   */
  pick(value) {
    if (value === this.value) return null;
    const prima = this.shown.get(this.value);
    const dopo = this.shown.get(value);
    this.value = value;
    const cambiate = [prima, dopo].filter(Boolean);
    for (const r of cambiate) segna(r, r === dopo);
    return cambiate;
  }
}
