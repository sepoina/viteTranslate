import { Trans } from '@sepoina/vitetranslate/react';
import RotateLanguageButton from './RotateLanguageButton';
import ShowVersion from './ShowVersion';

export default function App() {
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
          <br />
          <footer>
            <Trans>- Mira Halvorsen, La pagina silenziosa</Trans>
          </footer>
        </blockquote>
      </article>
    </>
  );
}
