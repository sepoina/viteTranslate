import { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { stackblitzUrl } from "./links.js";
import { DEMOS } from "./pages.js";
import ProjectLinks from "./ProjectLinks.jsx";
import SectionHead from "./SectionHead.jsx";

/** La versione di Vite di una demo, dalla sua cartella: demo/Vite_8/minimal → "8". */
const viteOf = (source) => /\/Vite_(\d+)\//.exec(`${source}/`)?.[1];

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Le demo di demo/, in fondo alla pagina prima della chiusura: una galleria che scorre di lato a
// scatti (scroll-snap), con due frecce sotto; su un touch basta il dito. Si vede sempre un pezzo
// della card dopo, così si capisce che continua. Il fondo della card dice la versione di Vite
// (data-vite), il glifo grande in alto a destra il contenuto della demo. Non hanno una pagina nel
// sito, quindi la card apre il progetto su StackBlitz; sotto, gli stessi tre tasti delle pagine.
export default function Starters() {
  const trans = useTrans();
  const track = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  // Le frecce si spengono ai due capi della galleria. Gira a ogni evento di scroll: si ridisegna
  // solo quando un capo cambia davvero.
  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const next = { start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 };
    setEdge((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Uno scatto è una card: la sua larghezza più lo spazio fra due card.
  const step = (dir) => {
    const el = track.current;
    const card = el?.firstElementChild;
    if (!card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: reducedMotion() ? "auto" : "smooth" });
  };

  return (
    <section className="section" data-section="starters">
      <div className="wrap">
        <SectionHead
          id="starters"
          title={<Trans>_%_Un progetto minimo per ogni idea._%_</Trans>}
          text={<Trans>_%_Un clic e gira su StackBlitz, nel browser, senza installare niente. Lo zip è lo stesso progetto, da aprire in locale._%_</Trans>}
        />
        <div className="starters-box">
          <div className="starters" ref={track} onScroll={measure} data-stagger>
            {DEMOS.map((demo) => (
              <article key={demo.slug} className="card starter-card" data-vite={viteOf(demo.source)}>
                <span className="starter-glyph" aria-hidden="true">
                  {demo.glyph}
                </span>
                <a className="starter-main" href={stackblitzUrl(demo.source)} target="_blank" rel="noopener">
                  <p className="starter-top">
                    <span>{demo.stack}</span>
                    <span aria-hidden="true">↗</span>
                  </p>
                  <h3>
                    <Trans t={demo.title} />
                  </h3>
                  <p className="demo-path">{demo.source}/</p>
                  <p className="demo-text">
                    <Trans t={demo.text} />
                  </p>
                </a>
                <ProjectLinks source={demo.source} zip={`zip/demo/${demo.slug}.zip`} />
              </article>
            ))}
          </div>
          <div className="starters-nav">
            <button type="button" className="icon-btn" onClick={() => step(-1)} disabled={edge.start} aria-label={trans("_%_Demo precedenti_%_")}>
              ‹
            </button>
            <button type="button" className="icon-btn" onClick={() => step(1)} disabled={edge.end} aria-label={trans("_%_Demo successive_%_")}>
              ›
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
