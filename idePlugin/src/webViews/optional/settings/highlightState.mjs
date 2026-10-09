// Lo stato dell'accordion Highlight style, nella pagina Settings: gli stili di evidenziazione, Off
// in testa, ognuno col suo campione e quello in uso segnato. Il campione è lo stile stesso
// (renderOptionsOf in decorationPlan.mjs) scritto in CSS: i colori del tema diventano le variabili
// che la webview riceve già (`charts.yellow` -> `var(--vscode-charts-yellow)`), così il campione
// segue il tema come le decorazioni nell'editor. Sfondo e cornice, due parti nell'editor (lì lo
// sfondo si toglie sotto la selezione), qui stanno sullo stesso chip; il righello non ha campione.
// Nessun import di `vscode`.
import { STYLES, HIGHLIGHT_OFF } from "../../../highlight/highlightStyles.mjs";
import { renderOptionsOf, cssVar } from "../../../highlight/decorationPlan.mjs";
import { SOURCE_OPEN, SOURCE_CLOSE } from "../../../../../lib/markerSyntax.js";

/**
 * Il campione: il testo tra i delimitatori di serie della libreria. Resta su `_%_` anche in un
 * progetto con delimitatori suoi: è un'anteprima dello stile, non del progetto (4.7.0).
 */
const SAMPLE = { open: SOURCE_OPEN, text: "Hello, world", close: SOURCE_CLOSE };

// Da opzioni di decorazione a CSS inline.
const css = (...parti) =>
  parti
    .flatMap((o) => Object.entries(o ?? {}))
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${v}`)
    .join("; ");

/**
 * Il campione di uno stile: il CSS di ogni parte, e dove sta il chip ("all": anche sui
 * delimitatori, "content": solo sul testo). Off: niente.
 * @param {object | null} style - una voce di STYLES, null per Off
 * @returns {{ cover: "all" | "content", match: string, text: string, delimiters: string }}
 */
export function sampleOf(style) {
  if (!style) return { cover: "all", match: "", text: "", delimiters: "" };
  const o = renderOptionsOf(style, cssVar);
  return { cover: style.cover, match: css(o.match, o.frame), text: css(o.text), delimiters: css(o.delimiters) };
}

/**
 * @param {object} p
 * @param {string} p.current - l'id nelle impostazioni (Highlighter.configured)
 * @param {"light" | "dark" | null} [p.theme] - il tipo di tema adesso: gli stili deboli lì lo dicono
 * @returns {{ current: string, sample: typeof SAMPLE, styles: { id: string, name: string, description: string, weak: boolean, sample: object }[] }}
 */
export function highlightState({ current, theme = null }) {
  const voci = [
    { id: HIGHLIGHT_OFF, name: "Off", description: "No highlighting", weak: false, sample: sampleOf(null) },
    ...STYLES.map((s) => ({ id: s.id, name: s.name, description: s.description, weak: !!theme && s.weakOn.includes(theme), sample: sampleOf(s) })),
  ];
  return { current, sample: SAMPLE, styles: voci };
}
