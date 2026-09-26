// Codice di esempio colorato a mano: pochi token per tre linguaggi, niente libreria di highlighting.
// Il testo non passa da <Translate>: sono esempi, non frasi della pagina.
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.

// Il delimitatore di viteTranslate, composto a runtime: scritto per intero in un sorgente
// verrebbe estratto come frase da tradurre, anche dentro una stringa di esempio.
export const M = ["_", "%", "_"].join("");

const RULES = {
  jsx: new RegExp(
    `(?<c>//.*)|(?<m>${M}[^\\n]*?${M})|(?<s>"[^"\\n]*"|'[^'\\n]*')|(?<t></?[A-Za-z][\\w.]*|/?>)|(?<k>\\b(?:import|from|export|default|function|const|return|useState)\\b)`,
    "g"
  ),
  yaml: /(?<c>#.*)|(?<k>^[\w-]+(?=:))|(?<s>"[^"\n]*")|(?<n>\bnull\b)/gm,
  sh: /(?<c>#.*)|(?<k>--[\w-]+)|(?<s>"[^"\n]*")|(?<o>✓|✗)|(?<p>^\$)/gm,
};
const ALIAS = { js: "jsx", javascript: "jsx", bash: "sh" };
const CLASS = { c: "tk-c", m: "tk-m", s: "tk-s", t: "tk-t", k: "tk-k", n: "tk-n", o: "tk-o", p: "tk-p" };

/** Divide `src` in nodi: testo semplice e <span class="tk-…"> per i token riconosciuti. "text" resta senza colori. */
export function highlight(src, lang) {
  const rule = RULES[ALIAS[lang] ?? lang];
  if (!rule) return src;
  const re = new RegExp(rule);
  const out = [];
  let last = 0;
  for (const m of src.matchAll(re)) {
    if (m.index > last) out.push(src.slice(last, m.index));
    const kind = Object.keys(m.groups).find((g) => m.groups[g] !== undefined);
    out.push(
      <span key={m.index} className={CLASS[kind]}>
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

/** Un blocco di codice colorato. La barra con il titolo (nome del file, "terminal"…) c'è solo se c'è `title`. */
export function Code({ code, lang = "jsx", title, className = "" }) {
  return (
    <div className={`code ${className}`.trim()}>
      {title && (
        <div className="code-bar">
          <span>{title}</span>
        </div>
      )}
      <pre>
        <code>{highlight(code.trim(), lang)}</code>
      </pre>
    </div>
  );
}
