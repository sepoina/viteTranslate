import { Translate, useTranslateLanguage, version } from '@sepoina/vitetranslate/react';

export default function App() {
  //
  // hook che legge lo stato del sistema di traduzione, e fornisce la lingua corrente
  // l'elenco delle lingue disponibili e la funzione per cambiare lingua.
  //
  const { id, languages, proposeNewLanguage } = useTranslateLanguage();
  //
  // lingua corrente o "sconosciuta"
  const corrente = languages.find(l => l.tag === id)?.languageName ?? '[lingua sconosciuta]';
  //
  // prossima lingua in sistema carosello
  const next = languages[(languages.findIndex(l => l.tag === id) + 1) % languages.length];
  //
  //
  return (
    <>
      <br />
      <button onClick={() => next.tag && proposeNewLanguage({ lang: next.tag })}>
        {corrente} <span style={{ fontSize: '1.5em', verticalAlign: 'middle', opacity: 0.4 }}>&nbsp;🠊&nbsp;</span> {next.languageName}
      </button>
      <br />
      <br />
      <article>
        <header>
          <h2>
            viteTranslate
          </h2><small><Translate>{languages.length} lingue · versione&nbsp;<b>{version}</b></Translate></small>
        </header>
        <p>
          <Translate>
            Questa pagina parla più lingue, ma solo una l'ha scritta una persona:
            le altre sono tabelle con tutte le caselle vuote. Non restano così — le
            riempie il modello in un colpo solo quando lanci
            vitetranslate --llm-translate, e prima di spendere qualsiasi cosa ti
            mostra la stima e ti chiede se procedere.
          </Translate>
        </p>
        <ol>
          <li>
            <Translate>Il testo si scrive dove serve, nel JSX: nessuna chiave da inventare.</Translate>
          </li>
          <li>
            <Translate>La sincronizzazione crea le tabelle e mette le stringhe nuove a null.</Translate>
          </li>
          <li>
            <Translate>La CLI stima il costo, chiede conferma, e riempie le caselle vuote.</Translate>
          </li>
          <li>
            <Translate>Il validatore confronta segnaposto e tag con il sorgente: quello che non passa resta vuoto.</Translate>
          </li>
        </ol>
        <blockquote>
          <Translate>La chiave API non entra mai in <b>vite.config.js</b>: lì vive solo il nome della variabile d'ambiente.</Translate>
          <footer>
            <Translate>- doc/llm.md, la pagina che spiega tutto il resto</Translate>
          </footer>
        </blockquote>
      </article>
    </>
  );
}
