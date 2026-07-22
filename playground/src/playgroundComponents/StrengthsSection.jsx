import { Translate } from "@sepoina/vitetranslate/react";

export default function StrengthsSection() {
  return (
    <section id="punti-di-forza" className="doc-section">
      <h2><Translate>_%_Punti di forza_%_</Translate></h2>
      <table className="strengths-table">
        <tbody>
          <tr>
            <td className="strength-icon" aria-hidden="true">🔀</td>
            <td className="strength-text"><Translate t={"_%_<strong>Compatibile con Vite 7 e Vite 8.</strong> Stesso codice per entrambi: su Vite 7 gira su Rollup (build) ed esbuild (dev), su Vite 8 gira su Rolldown (bundler Rust) e Oxc (compilatore), senza bisogno di configurazione diversa._%_"} /></td>
          </tr>
          <tr>
            <td className="strength-icon" aria-hidden="true">🏷️</td>
            <td className="strength-text"><Translate t={"_%_<strong>Marcatura diretta del testo nel sorgente.</strong> Nessuna chiave da creare o gestire a mano._%_"} /></td>
          </tr>
          <tr>
            <td className="strength-icon" aria-hidden="true">📦</td>
            <td className="strength-text"><Translate t={"_%_<strong>Caricamento delle lingue lazy.</strong> Il cambio lingua a runtime scarica solo il chunk necessario, senza appesantire il bundle iniziale con le lingue non usate._%_"} /></td>
          </tr>
          <tr>
            <td className="strength-icon" aria-hidden="true">🛟</td>
            <td className="strength-text"><Translate t={"_%_<strong>Fallback automatico in sviluppo.</strong> Finché una traduzione non è pronta resta visibile il testo originale, mai una stringa vuota o un errore._%_"} /></td>
          </tr>
          <tr>
            <td className="strength-icon" aria-hidden="true">🔄</td>
            <td className="strength-text"><Translate t={"_%_<strong>Sincronizzazione automatica delle tabelle.</strong> Un solo comando aggiorna tutte le lingue e segnala cosa resta da tradurre._%_"} /></td>
          </tr>
          <tr>
            <td className="strength-icon" aria-hidden="true">🔍</td>
            <td className="strength-text"><Translate t={"_%_<strong>Nuove lingue rilevate in automatico.</strong> Basta aggiungere un file JSON nella cartella delle lingue, senza registrarlo altrove nel codice._%_"} /></td>
          </tr>
          <tr>
            <td className="strength-icon" aria-hidden="true">🔒</td>
            <td className="strength-text"><Translate t={"_%_<strong>File di lingua al sicuro in src, non in public.</strong> Evita di servire tabelle JSON modificabili lato client._%_"} /></td>
          </tr>
          <tr>
            <td className="strength-icon" aria-hidden="true">♻️</td>
            <td className="strength-text"><Translate t={"_%_<strong>Le traduzioni sopravvivono ai rename.</strong> Se lo stesso testo cambia solo id, la sincronizzazione eredita la traduzione già fatta invece di farla ripartire da zero._%_"} /></td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
