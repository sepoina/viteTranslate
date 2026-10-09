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
  // prossima lingua in sistema carousello
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
          </h2><small><Trans>versione&nbsp;<b>{version}</b></Trans></small>
        </header>
        <p>
          <Trans>
            Il buon carattere è invisibile finché non fallisce. Un paragrafo
            composto bene accompagna l'occhio lungo la pagina senza mai chiedere
            attenzione, bilanciando giustezza, interlinea e contrasto finché il
            lettore dimentica che una scelta sia mai stata fatta.
          </Trans>
        </p>
        <blockquote>
          <Trans>
            "Il carattere è un bel gruppo di lettere, non un gruppo di belle
            lettere. Lo spazio che le separa conta quanto la loro forma."
          </Trans>
          <footer>
            <Trans>- Mira Halvorsen, La pagina silenziosa</Trans>
          </footer>
        </blockquote>
      </article>
    </>
  );
}
