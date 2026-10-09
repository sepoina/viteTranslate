import { useEffect, useState } from "react";
import { Trans } from "@sepoina/vitetranslate/react";
import { Code } from "./theme/Code.jsx";
import Marquee from "./Marquee.jsx";
import SectionHead from "./SectionHead.jsx";

// Dati della demo: sono esempi mostrati, non frasi della pagina, quindi niente <Trans>.
// `label` è il bottone, `glyph` il segno grande sulla card verde.
const DEMO = [
  { tag: "it-IT", label: "IT", glyph: "IT", text: "Benvenuto in viteTranslate" },
  { tag: "en-US", label: "EN", glyph: "EN", text: "Welcome to viteTranslate" },
  { tag: "fr-FR", label: "FR", glyph: "FR", text: "Bienvenue sur viteTranslate" },
  { tag: "de-DE", label: "DE", glyph: "DE", text: "Willkommen bei viteTranslate" },
  { tag: "pt-BR", label: "PT", glyph: "PT", text: "Bem-vindo ao viteTranslate" },
  { tag: "zh-CN", label: "中", glyph: "中", text: "欢迎使用 viteTranslate" },
  { tag: "ja-JP", label: "JA", glyph: "日", text: "viteTranslateへようこそ" },
];

// Si parte dal cinese: è la tabella che si allontana di più dal sorgente italiano.
const START = DEMO.findIndex((d) => d.tag === "zh-CN");

const SENTENCE = "Benvenuto in viteTranslate";

const SOURCE = `import { Trans } from "@sepoina/vitetranslate/react";

export default function App() {
  return (
    <h1>
      <Trans>${SENTENCE}</Trans>
    </h1>
  );
}`;

// Il sorgente resta lo stesso; cambia la tabella che il sync genera per ogni lingua e cambia ciò che si vede.
// Le lingue girano da sole finché non se ne sceglie una (mai con il movimento ridotto).
function DemoWindow() {
  const [i, setI] = useState(START);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setI((n) => (n + 1) % DEMO.length), 2600);
    return () => clearInterval(timer);
  }, [auto]);

  const { tag, glyph, text } = DEMO[i];
  const table = `# locale/${tag}.yml\n# missing key: 0\nApp_1q8xz4: "${text}"`;

  return (
    <div className="looks" data-reveal>
      <div className="looks-code">
        <Code code={SOURCE} lang="jsx" title="App.jsx" className="code-panel" mark={SENTENCE} />
        <Code code={table} lang="yaml" title={`${tag}.yml`} className="code-panel" />
      </div>
      <div className="lang-card">
        {/* Annunciata solo quando la lingua la sceglie chi legge: la rotazione automatica sarebbe un annuncio ogni 2,6 secondi. */}
        <div aria-live={auto ? "off" : "polite"}>
          <span className="lang-glyph" aria-hidden="true">
            {glyph}
          </span>
          <p key={tag} className="lang-sentence" lang={tag}>
            {text}
          </p>
        </div>
        <div className="lang-picks">
          {DEMO.map((d, n) => (
            <button
              key={d.tag}
              type="button"
              title={d.tag}
              aria-pressed={n === i}
              onClick={() => {
                setAuto(false);
                setI(n);
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CodeDemo() {
  return (
    <section className="band" data-section="looks">
      <div className="wrap">
        <SectionHead
          id="looks"
          title={<Trans t="_%_Un sorgente, <em>tante tabelle</em>._%_" />}
          text={
            <Trans>
              _%_La frase resta nel JSX. Per ogni lingua il plugin tiene una tabella YAML; cambiare lingua carica solo quella._%_
            </Trans>
          }
        />
        <DemoWindow />
        <Marquee />
      </div>
    </section>
  );
}
