// Da uno stile del catalogo (highlightStyles.mjs) alle decorazioni dell'editor: sei al più, una per
// parte, ognuna col suo intervallo. Nessun import di `vscode`: i colori diventano
// oggetti con la funzione `themeColor` che si passa (in highlighter.mjs, new vscode.ThemeColor),
// la corsia del righello con la tabella `lanes` (vscode.OverviewRulerLane).
//
// Le parti non si pestano i piedi: il colore sta solo su `text` e `delimiters`, che non si
// sovrappongono; `match` dà solo lo sfondo, `frame` il bordo, `ruler` il segno nel righello.
// Così non conta quale decorazione l'editor disegna sopra l'altra.
//
// La selezione. L'editor la disegna sotto le decorazioni: uno sfondo opaco la nasconde, e alcuni
// temi danno colori opachi a quelli che usiamo (in Dark Modern textPreformat.background è #3C3C3C,
// textCodeBlock.background #2B2B2B). Due rimedi: lo sfondo ha l'opacità al più CHIP_MAX_ALPHA, e
// sotto la selezione si toglie (subtractRanges, in Highlighter). Per questo sfondo, bordo e
// righello sono tre parti: si toglie solo lo sfondo, la cornice e il segno restano interi.
import { lineRanges } from "./metatagScan.mjs";

/** Le parti, nell'ordine in cui si creano le decorazioni: lo sfondo prima. */
export const PARTS = ["match", "frame", "ruler", "text", "delimiters", "componentTags"];

/**
 * L'opacità massima dello sfondo del chip: un colore del tema già trasparente resta com'è, uno
 * opaco lascia intravedere quello che c'è sotto (la riga corrente, la selezione mentre si ridisegna).
 */
export const CHIP_MAX_ALPHA = 0.6;

/** Un colore del tema come variabile CSS: VS Code le definisce nell'editor e nelle webview. */
export const cssVar = (id) => `var(--vscode-${id.replace(/\./g, "-")})`;

// Lo sfondo del chip: una stringa CSS, non un ThemeColor, per poterne limitare l'opacità (relative
// color syntax). Se la variabile manca la dichiarazione non vale: nessuno sfondo, come un
// ThemeColor senza valore.
const sfondo = (id) => (id ? `rgb(from ${cssVar(id)} r g b / min(alpha, ${CHIP_MAX_ALPHA}))` : undefined);

// Le opzioni senza i valori assenti; null se non ne resta nessuno (quella parte non si disegna).
function opzioni(o) {
  const piene = Object.entries(o).filter(([, v]) => v !== undefined && v !== null);
  return piene.length ? Object.fromEntries(piene) : null;
}

/**
 * Le opzioni di createTextEditorDecorationType per ogni parte; null per una parte che lo stile non
 * disegna.
 * @param {object} style - una voce di STYLES
 * @param {(id: string) => any} themeColor
 * @param {Record<string, number>} [lanes] - Left, Center, Right, Full
 * @returns {Record<PARTS[number], object|null>}
 */
export function renderOptionsOf(style, themeColor, lanes = {}) {
  const colore = (id) => (id ? themeColor(id) : undefined);
  const { chip, border, overviewRuler, text, delimiters, componentTags } = style;
  return {
    match: chip ? opzioni({ backgroundColor: sfondo(chip.backgroundColor), borderRadius: chip.borderRadius }) : null,
    frame: border
      ? opzioni({ borderColor: colore(border.borderColor), borderStyle: border.borderStyle, borderWidth: border.borderWidth, borderRadius: chip?.borderRadius })
      : null,
    ruler: overviewRuler ? opzioni({ overviewRulerColor: colore(overviewRuler.color), overviewRulerLane: lanes[overviewRuler.lane] }) : null,
    text: opzioni({ color: colore(style.fg), fontStyle: text?.fontStyle, textDecoration: text?.textDecoration }),
    delimiters: opzioni({
      color: colore(delimiters?.color ?? style.fg),
      opacity: delimiters?.opacity,
      letterSpacing: delimiters?.letterSpacing,
    }),
    componentTags: componentTags ? opzioni({ opacity: componentTags.opacity }) : null,
  };
}

/**
 * Gli intervalli di ogni parte per un metatag (metatagScan.mjs), in offset del testo. Il chip va
 * riga per riga, senza gli spazi a inizio riga: su un <Translate> che va a capo non colora il
 * rientro.
 * @returns {Record<PARTS[number], number[][]>}
 */
export function rangesOf(style, metatag, text) {
  const coperto = style.cover === "content" ? metatag.inner : [metatag.start, metatag.end];
  const chip = lineRanges(text, coperto);
  return {
    match: chip,
    frame: chip,
    ruler: [[metatag.start, metatag.end]],
    text: metatag.text,
    delimiters: metatag.delimiters,
    componentTags: metatag.componentTags.flatMap((r) => lineRanges(text, r)),
  };
}

/**
 * Gli intervalli `ranges` senza i tratti `holes` (le selezioni): un intervallo che ne contiene
 * uno si spezza in due, uno coperto sparisce. In offset del testo.
 * @param {number[][]} ranges
 * @param {number[][]} holes
 * @returns {number[][]}
 */
export function subtractRanges(ranges, holes) {
  if (!holes.length) return ranges;
  return ranges.flatMap(([s, e]) => {
    let pezzi = [[s, e]];
    for (const [hs, he] of holes) {
      pezzi = pezzi.flatMap(([a, b]) => (he <= a || hs >= b ? [[a, b]] : [[a, hs], [he, b]].filter(([x, y]) => y > x)));
    }
    return pezzi;
  });
}
