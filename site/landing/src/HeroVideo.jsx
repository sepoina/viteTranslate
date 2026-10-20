import { useEffect, useRef, useState } from "react";
import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { VIDEO_URL } from "./links.js";

// Il loop "una frase, quattro pezzi" (public/video/workflow.webm e .mp4, il poster .webp: i file di output.web di
// site/video/projects/gif20t, copiati a mano). Muto e in loop, ~340 kB la webm. Il video lungo, quello con la voce,
// sta su YouTube e si apre dal link della didascalia: niente player incorporato, perché l'embed a volte chiede
// "Accedi per confermare di non essere un bot" (controllo di YouTube su IP e sessione, non aggirabile da qui).
// Non parte da solo fuori dalla vista né con prefers-reduced-motion; il lettore lo ferma e lo riprende col
// comando (o cliccando lo schermo), e la sua scelta di fermarlo vale anche rientrando nella vista (WCAG 2.2.2).
// Una banda a tutta larghezza in fondo all'hero, data-theme="dark": resta scura anche nel tema chiaro, come il video.
// LINKED-DATA: i file in public/video vengono da site/video/projects/gif20t (output.web). Rifatto il compose,
// vanno ricopiati qui (README del sito, § "The video in the hero").
const FILE = `${import.meta.env.BASE_URL}video/workflow`;

export default function HeroVideo() {
  const trans = useTrans();
  const video = useRef(null);
  const scelta = useRef(null); // "play" o "pause": l'ultima cosa che ha chiesto il lettore; null finché non tocca nulla
  const [gira, setGira] = useState(false);

  // Parte quando lo schermo entra in vista e si ferma quando esce: un video che gira fuori campo consuma e basta.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const ridotto = matchMedia("(prefers-reduced-motion: reduce)");
    const vai = (visibile) => {
      const parte = visibile && scelta.current !== "pause" && (scelta.current === "play" || !ridotto.matches);
      if (parte) el.play().catch(() => {}); // il browser può rifiutare: resta il poster e il comando
      else el.pause();
    };
    const osserva = new IntersectionObserver(([e]) => vai(e.isIntersecting), { threshold: 0.4 });
    osserva.observe(el);
    return () => osserva.disconnect();
  }, []);

  const alterna = () => {
    const el = video.current;
    scelta.current = el.paused ? "play" : "pause";
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  return (
    <figure className="video" data-theme="dark">
      <div className="video-frame" data-reveal>
        <div className="video-screen">
          {/* At the hero's foot, under the fold on most screens: preload none, the observer starts it when it is seen. */}
          <video
            ref={video}
            muted
            loop
            playsInline
            preload="none"
            poster={`${FILE}.webp`}
            width="960"
            height="540"
            aria-label={trans("_%_Una frase scritta nel codice compare subito nella pagina; un LLM la traduce dal terminale e la pagina passa al francese e torna all'inglese._%_")}
            onClick={alterna}
            onPlay={() => setGira(true)}
            onPause={() => setGira(false)}
          >
            <source src={`${FILE}.webm`} type="video/webm" />
            <source src={`${FILE}.mp4`} type="video/mp4" />
          </video>
          <button
            type="button"
            className="video-toggle"
            onClick={alterna}
            aria-label={gira ? trans("_%_Metti in pausa il video_%_") : trans("_%_Riprendi il video_%_")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {gira ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.5v13l11-6.5z" />}
            </svg>
          </button>
        </div>
      </div>

      <figcaption className="video-cap">
        <span className="video-tag">
          <Trans>_%_In 30 secondi_%_</Trans>
        </span>
        <span>
          <Trans>_%_Una frase, quattro pezzi: VS Code, Vite, LLM, React._%_</Trans>
        </span>
        <a className="video-yt" href={VIDEO_URL} target="_blank" rel="noopener">
          <Trans>_%_Il video completo su YouTube_%_</Trans> <span aria-hidden="true">↗</span>
        </a>
      </figcaption>
    </figure>
  );
}
