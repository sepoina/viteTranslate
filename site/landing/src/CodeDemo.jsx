import { useEffect, useState } from "react";
import { Translate } from "@sepoina/vitetranslate/react";
import { Code, M } from "./Code.jsx";
import SectionHead from "./SectionHead.jsx";

// Dati della demo: sono esempi mostrati, non frasi della pagina, quindi niente <Translate>.
const DEMO = [
  { tag: "it-IT", label: "IT", text: "Benvenuto in viteTranslate" },
  { tag: "en-US", label: "EN", text: "Welcome to viteTranslate" },
  { tag: "fr-FR", label: "FR", text: "Bienvenue sur viteTranslate" },
  { tag: "de-DE", label: "DE", text: "Willkommen bei viteTranslate" },
  { tag: "pt-BR", label: "PT", text: "Bem-vindo ao viteTranslate" },
  { tag: "zh-CN", label: "中", text: "欢迎使用 viteTranslate" },
  { tag: "ja-JP", label: "JA", text: "viteTranslateへようこそ" },
];

const SOURCE = `import { Translate } from "@sepoina/vitetranslate/react";

export default function App() {
  return (
    <h1>
      <Translate>${M}Benvenuto in viteTranslate${M}</Translate>
    </h1>
  );
}`;

// Il sorgente resta lo stesso; cambia la tabella che il sync genera per ogni lingua e cambia ciò che si vede.
function DemoWindow() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setI((n) => (n + 1) % DEMO.length), 2600);
    return () => clearInterval(timer);
  }, [auto]);

  const { tag, label, text } = DEMO[i];
  const table = `# locale/${tag}.yml\n# missing key: 0\nApp_1q8xz4: "${text}"`;

  return (
    <div className="demo" data-reveal>
      <div className="demo-glow" aria-hidden="true" />
      <div className="demo-grid">
        <Code src={SOURCE} lang="jsx" title="App.jsx" />
        <div className="demo-side">
          <Code src={table} lang="yaml" title={`${tag}.yml`} className="demo-yaml" />
          <div className="demo-out" aria-live="polite">
            <span className="demo-chip">{label}</span>
            <p key={tag}>{text}</p>
          </div>
        </div>
      </div>
      <div className="demo-tabs" role="group" aria-label="demo">
        {DEMO.map((d, n) => (
          <button
            key={d.tag}
            type="button"
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
  );
}

export default function CodeDemo() {
  return (
    <section className="section code-sec">
      <div className="wrap">
        <SectionHead
          eyebrow={<Translate>_%_Come si vede_%_</Translate>}
          title={<Translate t="_%_Un sorgente, <em>tante tabelle</em>._%_" />}
          text={
            <Translate>
              _%_La frase resta nel JSX. Per ogni lingua il plugin tiene una tabella YAML; cambiare lingua carica solo quella._%_
            </Translate>
          }
        />
        <DemoWindow />
      </div>
    </section>
  );
}
