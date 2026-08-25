import { Fragment, useMemo, useRef, useState } from 'react';
import {
  Translate,
  useTranslateLanguage,
  version,
} from '@sepoina/vitetranslate/react';
import testCases from './testCases.jsx';
import CodeIcon from './CodeIcon.jsx';
import ShowAllTests from './ShowAllRowTests.jsx';

// Da dove si torna al playground. In build questa pagina sta in una sottocartella del
// suo dist (base "/viteTranslate/edge/"), quindi "../" è già l'indirizzo giusto e non
// va scritto a mano da nessuna parte. In sviluppo sono due server distinti: il
// playground è sulla 3000, questa pagina sulla 3001.
const PLAYGROUND_URL = import.meta.env.DEV ? 'http://localhost:3000/' : '../';

export default function App() {
  //
  // hook che legge lo stato del sistema di traduzione, e fornisce la lingua corrente
  // l'elenco delle lingue disponibili e la funzione per cambiare lingua.
  //
  const { id, languages, proposeNewLanguage } = useTranslateLanguage();
  //
  // il sorgente da mostrare nel riquadro, o null se non si sta puntando niente
  const [src, setSrc] = useState(null);
  //
  // l'ultimo sorgente mostrato resta disponibile durante la dissolvenza in
  // uscita: senza, il riquadro si svuoterebbe di scatto mentre sfuma
  const lastSrc = useRef('');
  if (src) lastSrc.current = src;
  //
  const html = useMemo(() => {
    const code = src ?? lastSrc.current;
    if (!code) return '';
    const hljs = window.hljs;
    if (!hljs) return escapeHtml(code);
    return hljs.highlight(code, { language: 'javascript' }).value;
  }, [src]);
  //
  // lingua corrente o "sconosciuta"
  const corrente =
    languages.find((l) => l.tag === id)?.languageName ?? '[lingua sconosciuta]';
  //
  // prossima lingua in sistema carousello
  const next =
    languages[
      (languages.findIndex((l) => l.tag === id) + 1) % languages.length
    ];
  //
  //
  return (
    <>
      <br />
      {/* Il playground vive una cartella sopra in build (dist/edge/ dentro il suo
          dist) e su un altro dev server mentre si lavora: PLAYGROUND_URL sa quale
          dei due. */}
      <a href={PLAYGROUND_URL} style={{ opacity: 0.6, fontSize: '0.85em' }}>
        ↖ playground
      </a>
      <br />
      <br />
      <button
        onClick={() => next.tag && proposeNewLanguage({ lang: next.tag })}
      >
        {corrente}{' '}
        <span
          style={{ fontSize: '1.5em', verticalAlign: 'middle', opacity: 0.4 }}
        >
          &nbsp;🠊&nbsp;
        </span>{' '}
        {next.languageName}
      </button>
      <br />
      <br />
      <article data-theme="light">
        <header>
          <h3>
            <Translate t={'_%_ viteTranslate &nbsp;<b>%s</b>_%_'} a={version} />
          </h3>
          <small>
            La colonna <b>Atteso</b> vale con la lingua <b>sorgente</b> attiva.
            I mark <code>🔸</code> (non tradotto qui) e <code>🔹</code> (non
            tradotto altrove) non compaiono in nessuna riga: dipendono dallo
            stato dei file di lingua, non dal caso, e qui entrambe le lingue
            sono complete. <code>‼️</code>, <code>🚫</code> e <code>⁇</code>{' '}
            invece fanno parte del risultato atteso.
            <br />
            Questa pagina tiene i mark accesi <b>anche in build</b> (
            <code>markOnlyDev: false</code> in <code>vite.config.js</code>),
            altrimenti pubblicherebbe una tabella senza la colonna che la
            giustifica. Il default della libreria è l'opposto: in un'app vera,
            dove qui si legge <code>🚫[tipo]</code> la build non rende più
            niente. <code>⁇</code> resta comunque — quello non è una
            diagnostica ma una resa normale.
            <br />
            Passando sopra <code>&lt;/&gt;</code> accanto al nome della riga si
            vede il codice che l'ha prodotta.
          </small>
        </header>
        <table>
          <tbody>
            <ShowAllTests
              onShow={(t) => setSrc(t)}
              onHide={() => setSrc(null)}
              data={testCases}
            />
          </tbody>
        </table>
      </article>

      <pre
        aria-hidden={!src}
        style={{
          position: 'fixed',
          right: '1.5rem',
          bottom: '1.5rem',
          zIndex: 50,
          margin: 0,
          padding: '2rem',
          maxWidth: 'min(46rem, 92vw)',
          maxHeight: '40vh',
          overflow: 'auto',
          background: '#1e1e1e',
          color: '#fff',
          border: '1px solid #800000',
          borderRadius: '8px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
          font: '13px/1.5 ui-monospace, Menlo, Consolas, monospace',
          fontSize: 'clamp(13px,2vw,22px)',
          whiteSpace: 'pre-wrap',
          // Il riquadro non deve mai rubare l'hover all'icona che lo ha aperto:
          // senza questo, passandoci sopra si chiuderebbe e riaprirebbe a scatti.
          pointerEvents: 'none',
          // Il nodo resta sempre montato: se lo si smonta con {src && ...} il
          // browser non ha nulla da animare, né entrando né uscendo.
          opacity: src ? 1 : 0,
          transform: src
            ? 'translateY(0) scale(1)'
            : 'translateY(8px) scale(0.98)',
          visibility: src ? 'visible' : 'hidden',
          // Longhand allineate una a una: tre proprietà, tre durate, tre
          // timing, tre delay. L'uscita è più rapida dell'entrata, e
          // visibility scatta secca a dissolvenza finita.
          transitionProperty: 'opacity, transform, visibility',
          transitionDuration: src ? '50ms, 50ms, 0ms' : '300ms, 300ms, 0ms',
          transitionTimingFunction: src
            ? 'ease-out, cubic-bezier(0.16, 1, 0.3, 1), linear'
            : 'ease-in, ease-in, linear',
          transitionDelay: src ? '0ms, 0ms, 0ms' : '0ms, 0ms, 1000ms',
        }}
      >
        <code
          className="hljs language-javascript"
          style={{ background: 'none', padding: 0 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    </>
  );
}

// usato solo se hljs non è ancora disponibile: evita che il sorgente
// finisca interpretato come markup
function escapeHtml(s) {
  return s.replace(
    /[&<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])
  );
}
