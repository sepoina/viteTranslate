import { Trans, useTransLanguage, version } from '@sepoina/vitetranslate/react';

export default function App() {
  //
  // hook che legge lo stato del sistema di traduzione, e fornisce la lingua corrente
  // l'elenco delle lingue disponibili e la funzione per cambiare lingua.
  //
  const { id, languages, proposeNewLanguage } = useTransLanguage();
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
          </h2><small><Trans>{languages.length} lingue · versione&nbsp;<b>{version}</b></Trans></small>
        </header>
        <p>
          <Trans>
            Questa pagina parla più lingue, ma solo una l'ha scritta una persona:
            le altre sono tabelle con tutte le caselle vuote. Non restano così — le
            riempie il modello in un colpo solo quando lanci
            vitetranslate --llm-translate, e prima di spendere qualsiasi cosa ti
            mostra la stima e ti chiede se procedere.
          </Trans>
        </p>
        <ol>
          <li>
            <Trans>Il testo si scrive dove serve, nel JSX: nessuna chiave da inventare.</Trans>
          </li>
          <li>
            <Trans>La sincronizzazione crea le tabelle e mette le stringhe nuove a null.</Trans>
          </li>
          <li>
            <Trans>La CLI stima il costo, chiede conferma, e riempie le caselle vuote.</Trans>
          </li>
          <li>
            <Trans>Il validatore confronta segnaposto e tag con il sorgente: quello che non passa resta vuoto.</Trans>
          </li>
        </ol>
        <blockquote>
          <Trans>La chiave API non entra mai in <b>vite.config.js</b>: lì vive solo il nome della variabile d'ambiente.</Trans>
          <footer>
            <Trans>- doc/llm.md, la pagina che spiega tutto il resto</Trans>
          </footer>
        </blockquote>
      </article>
    </>
  );
}
