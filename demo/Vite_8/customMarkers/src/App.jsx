import { Trans, useTrans, useTransLanguage, version } from '@sepoina/vitetranslate/react';

//
// I delimitatori di questo progetto sono ≼ e ≽ (vedi vite.config.js), non il solito _%_.
// Con autoWrap acceso (vite.config.js) basta avvolgerli intorno al testo, dove sta: niente <Trans>.
// Qui sotto, quattro casi.
//

//
// 1) Un elenco di testi come dato: nel codice sono stringhe qualunque, i delimitatori dicono
// "questa va tradotta". Si rendono più sotto con <Trans t={nota} />: l'unico <Trans> che resta,
// perché qui il testo è un dato e non sta scritto fra i tag.
const note = [
  '≼Lo spazio bianco è parte del testo.≽',
  '≼Un buon paragrafo si fa notare solo quando manca.≽',
];

export default function App() {
  //
  // hook che legge lo stato del sistema di traduzione, e fornisce la lingua corrente
  // l'elenco delle lingue disponibili e la funzione per cambiare lingua.
  //
  const { id, languages, proposeNewLanguage } = useTransLanguage();
  //
  // trans: il nome breve di useTranslateToString(). Per convenzione la variabile si chiama trans.
  const trans = useTrans();
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
      {/* 2) Un attributo: serve una stringa, non un nodo, quindi trans(...) coi delimitatori. */}
      <button
        title={trans('≼Passa alla lingua successiva≽')}
        onClick={() => next.tag && proposeNewLanguage({ lang: next.tag })}
      >
        {corrente} <span style={{ fontSize: '1.5em', verticalAlign: 'middle', opacity: 0.4 }}>&nbsp;🠊&nbsp;</span> {next.languageName}
      </button>
      <br />
      <br />
      <article>
        <header>
          <h2>
            viteTranslate
          </h2>
          {/* 4) Il testo JSX: i delimitatori direttamente fra i tag, anche con un tag e un valore in mezzo. */}
          <small>≼versione&nbsp;<b>{version}</b>≽</small>
        </header>
        <p>
          ≼Il buon carattere è invisibile finché non fallisce. Un paragrafo
          composto bene accompagna l'occhio lungo la pagina senza mai chiedere
          attenzione, bilanciando giustezza, interlinea e contrasto finché il
          lettore dimentica che una scelta sia mai stata fatta.≽
        </p>
        <blockquote>
          ≼"Il carattere è un bel gruppo di lettere, non un gruppo di belle
          lettere. Lo spazio che le separa conta quanto la loro forma."≽
          <footer>
            ≼- Mira Halvorsen, La pagina silenziosa≽
          </footer>
        </blockquote>
        <ul>
          {note.map((nota) => (
            <li key={nota}><Trans t={nota} /></li>
          ))}
        </ul>
        {/* 3) Un template trans`…`: la forma a template non ha bisogno di delimitatori. */}
        <p><small>{trans`Stai leggendo in ${corrente}`}</small></p>
      </article>
    </>
  );
}
