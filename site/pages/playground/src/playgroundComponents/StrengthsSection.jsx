import { Trans } from "@sepoina/vitetranslate/react";
import SIZE from "../theme/runtimeSize.json";

// Una card per punto di forza: icona, poi un testo che si apre con il titolo in <strong>.
// Il titolo sta nella stessa frase marcata del testo, così chi traduce li vede insieme.
const STRENGTHS = [
  ["⚖️", ["_%_<strong>%s gzip nel bundle finale.</strong> Il runtime che arriva al browser (<code>&#60;Trans&#62;</code>, <code>TransContainer</code>, <code>useTransLanguage</code>) pesa %s gzip, helper ICU compresi, misurati dalla suite di test. Il payload delle traduzioni scala con i tuoi contenuti, non con la libreria._%_", SIZE.real, SIZE.real]],
  ["🏷️", "_%_<strong>Il testo resta nel JSX, variabili e tag compresi.</strong> Nessuna chiave da creare o gestire a mano._%_"],
  ["🧮", "_%_<strong>ICU MessageFormat, compilato in build.</strong> Plurali, select, numeri e date senza un parser nel browser: gli helper arrivano solo se una tabella li usa._%_"],
  ["🤖", "_%_<strong>Traduzione con un LLM, dalla CLI.</strong> Un comando riempie le chiavi mancanti con il modello che scegli: stima il costo prima, scarta ciò che romperebbe il runtime._%_"],
  ["🔄", "_%_<strong>Sincronizzazione automatica delle tabelle.</strong> Un solo comando aggiorna tutte le lingue e segnala cosa resta da tradurre._%_"],
  ["♻️", "_%_<strong>Le traduzioni sopravvivono ai rename.</strong> Se lo stesso testo cambia solo id, la sincronizzazione eredita la traduzione già fatta invece di farla ripartire da zero._%_"],
  ["📦", "_%_<strong>Caricamento delle lingue lazy.</strong> Il cambio lingua a runtime scarica solo il chunk necessario, senza appesantire il bundle iniziale con le lingue non usate._%_"],
  ["🔍", "_%_<strong>Nuove lingue rilevate in automatico.</strong> Basta aggiungere un file .yml nella cartella delle lingue, senza registrarlo altrove nel codice._%_"],
  ["🛟", "_%_<strong>Fallback automatico in sviluppo.</strong> Finché una traduzione non è pronta resta visibile il testo originale, mai una stringa vuota o un errore._%_"],
  ["🔒", "_%_<strong>Le tabelle sono dati, non moduli JS.</strong> Un file di lingua non porta codice eseguibile: viene compilato in fase di build, non servito com’è._%_"],
  ["🧩", "_%_<strong>Nessuna dipendenza a runtime.</strong> Babel e Vite sono peer dependency: lavorano sulla tua macchina e non entrano nel bundle. React è quello che la tua app ha già._%_"],
  ["🔀", "_%_<strong>Da Vite 5 a Vite 8, stesso codice.</strong> Rollup ed esbuild fino a Vite 7, Rolldown e Oxc su Vite 8: nessuna configurazione diversa._%_"],
];

export default function StrengthsSection() {
  return (
    <section id="strengths" className="part">
      <h2>
        <Trans>_%_Punti di forza_%_</Trans>
      </h2>
      <ul className="strengths">
        {STRENGTHS.map(([icon, text]) => (
          <li key={icon}>
            <span className="icon" aria-hidden="true">
              {icon}
            </span>
            <span>
              <Trans t={text} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
