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
          <br />
          <footer>
            <Trans>- doc/llm.md, la pagina che spiega tutto il resto</Trans>
          </footer>
        </blockquote>
      </article>
    </>
  );
}
