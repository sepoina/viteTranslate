import { useEffect, useState } from 'react';
import { Translate, version } from '@sepoina/vitetranslate/react';
import testCases from './testCases.jsx';
import autoWrapCases from './autoWrapCases.jsx';
import CaseSection, { groupCases, SourceDock, STATUSES, StatusLabel } from './ShowAllRowTests.jsx';
import { siteUrl } from './siteLinks.js';
import SiteBar from './theme/SiteBar.jsx';

const groups = groupCases(testCases, autoWrapCases);

export default function App() {
  //
  // la riga il cui sorgente sta nella sezione in fondo: l'ultima puntata, finché non se ne punta
  // un'altra (null prima del primo passaggio)
  const [shown, setShown] = useState(null);
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
      <SiteBar home={siteUrl()}>
        <a className="bar-back" href={siteUrl()}>
          <Translate>_%_← viteTranslate: tutte le demo_%_</Translate>
        </a>
      </SiteBar>

      <main className="wrap">
        <section className="page-hero grid-backdrop">
          <p className="eyebrow rise" style={{ '--i': 0 }}>
            <Translate t={'_%_Casi limite · v%s_%_'} a={version} />
          </p>
          <h1 className="rise" style={{ '--i': 1 }}>
            <Translate t={'_%_Ogni caso limite, <em>dal vivo</em>_%_'} />
          </h1>
          <p className="lead rise" style={{ '--i': 2 }}>
            <Translate>
              _%_Una riga per caso: cosa scrivi, cosa rende davvero viteTranslate, cosa ti
              aspetti. In ogni categoria prima le forme consigliate, in fondo gli errori._%_
            </Translate>
          </p>
          <div className="legend rise" style={{ '--i': 3 }}>
            {STATUSES.map((s) => (
              <span key={s} className={`chip st-${s}`}>
                <StatusLabel status={s} />
              </span>
            ))}
            <a className="legend-more" href="#note">
              <Translate>_%_Come leggere la tabella ↓_%_</Translate>
            </a>
          </div>
          <nav className="toc rise" style={{ '--i': 4 }}>
            {groups.map((g) => (
              <a key={g.id} href={`#${g.id}`}>
                <Translate t={g.title} a={['%s']} />
                <span className="toc-count">{g.rows.length}</span>
              </a>
            ))}
          </nav>
        </section>

        {groups.map((g) => (
          <CaseSection key={g.id} group={g} active={shown} onShow={setShown} />
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

      {/* Lo stesso testo della nota qui sopra: stessa frase, stessa chiave. */}
      <SourceDock row={shown} hint={<Translate t={'_%_Passa sopra <code>&lt;/&gt;</code> accanto al nome di un caso per vedere il codice che l’ha prodotto._%_'} />} />
    </>
  );
}
