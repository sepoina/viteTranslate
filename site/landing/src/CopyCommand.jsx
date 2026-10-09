import { useRef, useState } from "react";
import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { INSTALL } from "./links.js";

/**
 * Il comando di installazione, da copiare con un clic.
 * `tone`: "accent" è il bottone verde dell'hero, "ink" quello scuro sulla banda verde finale.
 */
export default function CopyCommand({ command = INSTALL, tone = "accent" }) {
  const trans = useTrans();
  const [done, setDone] = useState(false);
  const timer = useRef(0);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      return; // contesto non sicuro o permesso negato: niente finto "Copiato"
    }
    setDone(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1600);
  };

  return (
    <button type="button" className={`copy copy-${tone}`} onClick={copy} aria-label={trans("_%_Copia il comando_%_")}>
      <span className="copy-prompt">$</span>
      <code>{command}</code>
      <span className="copy-state">{done ? <Trans>_%_Copiato_%_</Trans> : <Trans>_%_Copia_%_</Trans>}</span>
    </button>
  );
}
