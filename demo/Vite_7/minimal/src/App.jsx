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
          </h2><small><Translate>versione&nbsp;<b>{version}</b></Translate></small>
        </header>
        <p>
          <Translate>
            Il buon carattere è invisibile finché non fallisce. Un paragrafo
            composto bene accompagna l'occhio lungo la pagina senza mai chiedere
            attenzione, bilanciando giustezza, interlinea e contrasto finché il
            lettore dimentica che una scelta sia mai stata fatta.
          </Translate>
        </p>
        <blockquote>
          <Translate>
            "Il carattere è un bel gruppo di lettere, non un gruppo di belle
            lettere. Lo spazio che le separa conta quanto la loro forma."
          </Translate>
          <footer>
            <Translate>- Mira Halvorsen, La pagina silenziosa</Translate>
          </footer>
        </blockquote>
      </article>
    </>
  );
}
