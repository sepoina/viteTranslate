// Il catalogo degli stili di evidenziazione: dati e basta. Ogni colore è l'id di un colore del tema
// (https://code.visualstudio.com/api/references/theme-color), mai un esadecimale: lo stile segue
// il tema, chiaro o scuro, e i temi che ridefiniscono quel colore. Gli altri valori sono stringhe
// CSS con i nomi di ThemableDecorationRenderOptions. Come diventano decorazioni: decorationPlan.mjs.
//
// Le parti di uno stile:
//   fg             il colore del testo del metatag (le sue parti di testo, non i buchi: tag, `{…}`,
//                  `${…}` restano come li colora il tema); null: resta il colore del contesto
//   text           fontStyle, textDecoration del testo; null: niente
//   cover          dove sta il chip: "all" il metatag (delimitatori compresi; nella forma
//                  componente il contenuto), "content" solo dentro i delimitatori
//   chip           backgroundColor, borderRadius; null: nessuno sfondo
//   border         borderColor, borderStyle, borderWidth (sullo stesso intervallo del chip)
//   delimiters     i `_%_`: opacity, letterSpacing, color (assente: quello di fg)
//   componentTags  `<Translate>`, `</Translate>`, `ts`…``: opacity; null (tutti gli stili di serie): restano
//                  nel colore che il tema dà ai componenti
//   overviewRuler  color, lane (Left, Center, Right, Full): un segno nel righello a destra
//   weakOn         i tipi di tema ("light", "dark") su cui lo stile si vede poco coi colori di serie
//
// L'ordine è quello che vede l'utente (impostazioni, Quick Pick, pagina Highlight): Off, lo stile
// di serie, poi gli altri in ordine alfabetico per nome.
//
// L'elenco delle impostazioni in idePlugin/package.json (vitetranslate.highlightStyle: enum,
// enumItemLabels, enumDescriptions) deve dire gli stessi id, nomi e descrizioni, nello stesso
// ordine: lo controlla idePluginHighlight.test.mjs.

/** Il valore dell'impostazione che spegne l'evidenziazione. */
export const HIGHLIGHT_OFF = "off";
/** Lo stile di serie: in cima al catalogo, dopo Off. */
export const DEFAULT_STYLE = "framed-box";

// I colori che prendono il posto degli scope TextMate dello schema di partenza: niente grammatica,
// il testo si colora con una decorazione (vedi il piano idePlugin_highlight, "Decisioni").
// charts.yellow è editorWarning.foreground: un oro che ogni tema definisce. textPreformat.foreground
// no: nei temi Modern di serie è quasi il colore del testo (#D0D0D0, #3B3B3B).
const ESCAPE = "charts.yellow"; // constant.character.escape
const PLACEHOLDER = "charts.blue"; // constant.other.placeholder
const KEYWORD = "charts.purple"; // keyword.control

export const STYLES = [
  {
    id: "framed-box", name: "Framed box", description: "Box and frame",
    fg: ESCAPE, text: null, cover: "all",
    chip: { backgroundColor: "editorBracketMatch.background", borderRadius: "2px" },
    border: { borderColor: "editorBracketMatch.border", borderStyle: "solid", borderWidth: "1px" },
    delimiters: { opacity: "0.7" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "badge", name: "Badge", description: "Filled label",
    fg: "badge.foreground", text: null, cover: "content",
    chip: { backgroundColor: "badge.background", borderRadius: "8px" }, border: null,
    delimiters: { color: "editorCodeLens.foreground" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "dotted-escape", name: "Dotted escape", description: "Fine underline",
    fg: ESCAPE, text: null, cover: "all", chip: null,
    border: { borderColor: "editorCodeLens.foreground", borderStyle: "dotted", borderWidth: "0 0 1px 0" },
    delimiters: { opacity: "0.7" }, componentTags: null, overviewRuler: null, weakOn: ["light"],
  },
  {
    id: "escape-chip", name: "Escape chip", description: "Chip and ruler",
    fg: ESCAPE, text: null, cover: "all",
    chip: { backgroundColor: "textPreformat.background", borderRadius: "3px" }, border: null,
    delimiters: { opacity: "0.7", letterSpacing: "-1px" }, componentTags: null,
    overviewRuler: { color: "editorOverviewRuler.infoForeground", lane: "Right" }, weakOn: [],
  },
  {
    id: "highlighter", name: "Highlighter", description: "Marker effect",
    fg: null, text: null, cover: "all",
    chip: { backgroundColor: "editor.rangeHighlightBackground", borderRadius: "0" }, border: null,
    delimiters: { opacity: "0.7" }, componentTags: null, overviewRuler: null, weakOn: ["dark"],
  },
  {
    id: "inlay-hint", name: "Inlay hint", description: "Like inlay hints",
    fg: "editorInlayHint.foreground", text: { fontStyle: "italic" }, cover: "all",
    chip: { backgroundColor: "editorInlayHint.background", borderRadius: "3px" }, border: null,
    delimiters: { opacity: "0.8" }, componentTags: null, overviewRuler: null, weakOn: ["light"],
  },
  {
    id: "inset", name: "Inset", description: "Inset backdrop",
    fg: ESCAPE, text: null, cover: "all",
    chip: { backgroundColor: "textCodeBlock.background", borderRadius: "3px" }, border: null,
    delimiters: { opacity: "0.7" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "keyword-mark", name: "Keyword mark", description: "Keyword accent",
    fg: KEYWORD, text: { textDecoration: "underline" }, cover: "all",
    chip: { backgroundColor: "textPreformat.background", borderRadius: "3px" }, border: null,
    delimiters: { opacity: "0.7" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "link", name: "Link", description: "Dotted link",
    fg: "textLink.foreground", text: null, cover: "all", chip: null,
    border: { borderColor: "textLink.foreground", borderStyle: "dotted", borderWidth: "0 0 1px 0" },
    delimiters: { opacity: "0.7" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "neutral-italic", name: "Neutral italic", description: "Italic only",
    fg: null, text: { fontStyle: "italic" }, cover: "all", chip: null, border: null,
    delimiters: { color: "editorCodeLens.foreground" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "outlined-chip", name: "Outlined chip", description: "Chip with border",
    fg: ESCAPE, text: null, cover: "all",
    chip: { backgroundColor: "textPreformat.background", borderRadius: "3px" },
    border: { borderColor: "editorWidget.border", borderStyle: "solid", borderWidth: "1px" },
    delimiters: { opacity: "0.7" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "pill", name: "Pill", description: "Chip on content",
    fg: ESCAPE, text: null, cover: "content",
    chip: { backgroundColor: "textPreformat.background", borderRadius: "3px" }, border: null,
    delimiters: { opacity: "0.7" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "placeholder", name: "Placeholder", description: "Snippet style",
    fg: PLACEHOLDER, text: null, cover: "all",
    chip: { backgroundColor: "editor.snippetTabstopHighlightBackground", borderRadius: "2px" }, border: null,
    delimiters: { opacity: "0.7" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
  {
    id: "quote", name: "Quote", description: "Left accent bar",
    fg: ESCAPE, text: null, cover: "all",
    chip: { backgroundColor: "textBlockQuote.background", borderRadius: "0" },
    border: { borderColor: "textBlockQuote.border", borderStyle: "solid", borderWidth: "0 0 0 2px" },
    delimiters: { opacity: "0.7" }, componentTags: null, overviewRuler: null, weakOn: ["light"],
  },
  {
    id: "selection-veil", name: "Selection veil", description: "Like selection",
    fg: ESCAPE, text: null, cover: "all",
    chip: { backgroundColor: "editor.inactiveSelectionBackground", borderRadius: "3px" }, border: null,
    delimiters: { opacity: "0.7", letterSpacing: "-1px" }, componentTags: null, overviewRuler: null, weakOn: [],
  },
];

const PER_ID = new Map(STYLES.map((s) => [s.id, s]));

/** Lo stile con questo id, o undefined. */
export const styleById = (id) => PER_ID.get(id);
