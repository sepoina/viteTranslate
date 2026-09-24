// Codice di esempio colorato a mano, come nella landing (site/landing/src/Code.jsx, da cui è
// copiato: una pagina del sito deve restare autonoma). Pochi token, niente libreria.
// Il testo non passa da <Translate>: sono esempi, non frasi della pagina.

// Il delimitatore di viteTranslate, composto a runtime: scritto per intero in un sorgente
// verrebbe estratto come frase da tradurre, anche dentro una stringa di esempio.
const M = ["_", "%", "_"].join("");

const RULES = {
  jsx: new RegExp(
    `(?<c>//.*)|(?<m>${M}[^\\n]*?${M})|(?<s>"[^"\\n]*"|'[^'\\n]*')|(?<t></?[A-Za-z][\\w.]*|/?>)|(?<k>\\b(?:import|from|export|default|function|const|return|useState)\\b)`,
    "g"
  ),
  yaml: /(?<c>#.*)|(?<k>^[\w-]+(?=:))|(?<s>"[^"\n]*")|(?<n>\bnull\b)/gm,
  sh: /(?<c>#.*)|(?<k>--[\w-]+)|(?<s>"[^"\n]*")|(?<p>^\$)/gm,
};
const ALIAS = { js: "jsx", bash: "sh" };
const CLASS = { c: "tk-c", m: "tk-m", s: "tk-s", t: "tk-t", k: "tk-k", n: "tk-n", p: "tk-c" };

/** Divide `src` in nodi: testo semplice e <span class="tk-…"> per i token riconosciuti. */
function highlight(src, lang) {
  const rule = RULES[ALIAS[lang] ?? lang];
  if (!rule) return src; // "text": nessun colore
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

/** Un blocco di codice colorato, con il nome del file (o del terminale) nella barra. */
export default function Code({ code, language = "jsx", title }) {
  return (
    <div className="code">
      <div className="code-bar">
        <i />
        <i />
        <i />
        <span>{title ?? (language === "bash" ? "terminal" : language)}</span>
      </div>
      <pre>
        <code>{highlight(code.trim(), language)}</code>
      </pre>
    </div>
  );
}
