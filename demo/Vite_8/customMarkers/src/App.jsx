import { Trans, useTrans, useTransLanguage } from '@sepoina/vitetranslate/react';
import RotateLanguageButton from './RotateLanguageButton';
import ShowVersion from './ShowVersion';

//
// I delimitatori di questo progetto sono ≼ e ≽ (vedi vite.config.js), non il solito _%_.
// Con autoWrap acceso (vite.config.js) basta avvolgerli intorno al testo, dove sta: niente <Trans>.
// Qui sotto, quattro casi; il 2) (un attributo) sta in RotateLanguageButton.jsx.
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
  // trans: il nome breve di useTranslateToString(). Per convenzione la variabile si chiama trans.
  const trans = useTrans();
  //
  // lingua corrente o "sconosciuta", per il caso 3)
  const { id, languages } = useTransLanguage();
  const corrente =
    languages.find((l) => l.tag === id)?.languageName ?? '[lingua sconosciuta]';
  //
  //
  return (
    <>
      <RotateLanguageButton />
      <article
        style={{
          marginTop: '5vh',
          overflow: 'hidden',
          borderRadius: '8px 25px',
        }}
      >
        <header>
          <h2>viteTranslate</h2>
          <ShowVersion />
        </header>
        {/* 4) Il testo JSX: i delimitatori direttamente fra i tag. Con un tag e un valore in mezzo: ShowVersion.jsx. */}
        <p>
          ≼Il buon carattere è invisibile finché non fallisce. Un paragrafo
          composto bene accompagna l'occhio lungo la pagina senza mai chiedere
          attenzione, bilanciando giustezza, interlinea e contrasto finché il
          lettore dimentica che una scelta sia mai stata fatta.≽
        </p>
        <blockquote>
          ≼"Il carattere è un bel gruppo di lettere, non un gruppo di belle
          lettere. Lo spazio che le separa conta quanto la loro forma."≽
          <br />
          <footer>≼- Mira Halvorsen, La pagina silenziosa≽</footer>
        </blockquote>
        <ul>
          {note.map((nota) => (
            <li key={nota}>
              <Trans t={nota} />
            </li>
          ))}
        </ul>
        {/* 3) Un template trans`…`: la forma a template non ha bisogno di delimitatori. */}
        <p>
          <small>{trans`Stai leggendo in ${corrente}`}</small>
        </p>
      </article>
    </>
  );
}
