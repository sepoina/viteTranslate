import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Translate,
  useTranslateLanguage,
  useTranslateToString,
  version,
} from '@sepoina/vitetranslate/react';
import testCases from './testCases.jsx';
import autoWrapCases from './autoWrapCases.jsx';
import CaseSection, { groupCases, STATUSES, StatusLabel } from './ShowAllRowTests.jsx';
import { siteUrl } from './siteLinks.js';

const groups = groupCases(testCases, autoWrapCases);

// Il selettore di lingua della landing: una pillola, un bottone per lingua.
function LanguageSwitch() {
  const { id, languages, proposeNewLanguage } = useTranslateLanguage();
  const ts = useTranslateToString();
  return (
    <div className="lang-switch" role="group" aria-label={ts('_%_Lingua della pagina_%_')}>
      {languages.map(({ tag, languageName }) => (
        <button
          key={tag}
          type="button"
          title={languageName}
          aria-pressed={id === tag}
          onClick={() => id !== tag && proposeNewLanguage({ lang: tag })}
        >
          {tag.split('-')[0].toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// Stessa chiave della landing ("vt-theme"): il tema scelto là vale anche qui, e viceversa.
function ThemeToggle() {
  const ts = useTranslateToString();
  const [theme, setTheme] = useState(
    () =>
      document.documentElement.dataset.theme ??
      (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  );
  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('vt-theme', next);
    } catch {
      /* navigazione privata o storage bloccato: il tema vale per questa visita */
    }
    setTheme(next);
  };
  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label={ts('_%_Cambia tema_%_')}>
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}

export default function App() {
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
  // Le ancore (…/edge/#icu) arrivano prima delle tabelle: al caricamento il browser cerca
  // l'id quando React non ha ancora reso niente, e non lo trova. Si riprova qui, una volta,
  // a pagina montata.
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  //
  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <a className="back" href={siteUrl()}>
            <Translate>_%_← viteTranslate: tutte le demo_%_</Translate>
          </a>
          <div className="top-tools">
            <LanguageSwitch />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <p className="eyebrow">
            <Translate t={'_%_Casi limite · v%s_%_'} a={version} />
          </p>
          <h1>
            <Translate t={'_%_Ogni caso limite, <em>dal vivo</em>_%_'} />
          </h1>
          <p className="lead">
            <Translate>
              _%_Una riga per caso: cosa scrivi, cosa rende davvero viteTranslate, cosa ti
              aspetti. In ogni categoria prima le forme consigliate, in fondo gli errori._%_
            </Translate>
          </p>
          <div className="legend">
            {STATUSES.map((s) => (
              <span key={s} className={`chip st-${s}`}>
                <StatusLabel status={s} />
              </span>
            ))}
            <a className="legend-more" href="#note">
              <Translate>_%_Come leggere la tabella ↓_%_</Translate>
            </a>
          </div>
          <nav className="toc">
            {groups.map((g) => (
              <a key={g.id} href={`#${g.id}`}>
                <Translate t={g.title} a={['%s']} />
                <span className="toc-count">{g.rows.length}</span>
              </a>
            ))}
          </nav>
        </section>

        {groups.map((g) => (
          <CaseSection key={g.id} group={g} onShow={setSrc} onHide={() => setSrc(null)} />
        ))}

        <footer id="note" className="notes">
          <h2>
            <Translate>_%_Come leggere la tabella_%_</Translate>
          </h2>
          {/* Testi con markup: in t e su un literal solo. Nei children <b> sarebbe JSX vero,
              e spezzerebbe il marcatore (è il caso "Markup come JSX" della tabella). */}
          <ul>
            <li>
              <Translate t={'_%_<b>Ottimale</b>: rende esattamente ciò che è scritto, senza diagnostica. <b>Warning</b>: rende, ma qualcosa si perde o sorprende (un <code>⁇</code>, un tag scartato, un avviso di build). <b>Errore</b>: un mark <code>‼️</code> o <code>🚫</code>, o un errore in console: da correggere._%_'} />
            </li>
            <li>
              <Translate t={'_%_La colonna <b>atteso</b> vale in <b>sviluppo</b>, con la lingua sorgente attiva e i file di lingua già sincronizzati._%_'} />
            </li>
            <li>
              <Translate t={'_%_<code>🔸</code> (non tradotto qui) e <code>🔹</code> (non tradotto altrove) non sono riportati: dipendono dallo stato dei file di lingua, non dalla riga. <code>‼️</code>, <code>🚫</code> e <code>⁇</code> invece fanno parte del risultato atteso._%_'} />
            </li>
            <li>
              <Translate t={'_%_In un’app vera i mark diagnostici spariscono in build — dove qui si legge <code>🚫[tipo]</code> non si rende più niente — mentre <code>⁇</code> resta: non è una diagnostica, è una resa normale. Questa pagina li tiene accesi anche in build, apposta._%_'} />
            </li>
            <li>
              <Translate t={'_%_Passa sopra <code>&lt;/&gt;</code> accanto al nome di un caso per vedere il codice che l’ha prodotto._%_'} />
            </li>
            <li>
              <Translate t={'_%_Ogni categoria ha un indirizzo suo (<code>#icu</code>, <code>#html</code>, <code>#not-text</code>…): il <code>#</code> accanto al titolo è il link da condividere._%_'} />
            </li>
          </ul>
        </footer>
      </main>

      <pre className={`src-pop${src ? ' is-open' : ''}`} aria-hidden={!src}>
        <code className="hljs language-javascript" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </>
  );
}

// usato solo se hljs non è ancora disponibile: evita che il sorgente
// finisca interpretato come markup
function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
