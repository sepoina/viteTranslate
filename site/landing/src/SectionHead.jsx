import { Trans } from "@sepoina/vitetranslate/react";
import { SECTIONS } from "./sections.js";

/**
 * L'intestazione comune alle sezioni: il numero a sinistra, poi il titolo, l'etichetta della
 * sezione e il testo. `id` è la chiave in SECTIONS; `title` e `text` sono elementi <Trans> già pronti.
 */
export default function SectionHead({ id, title, text }) {
  const { n, label } = SECTIONS[id];
  return (
    <div className="section-head" data-reveal>
      <span className="section-n" aria-hidden="true">
        {n}
      </span>
      <div className="section-titles">
        <h2>{title}</h2>
        <p className="eyebrow">
          <Trans t={label} />
        </p>
        {text && <p className="section-text">{text}</p>}
      </div>
    </div>
  );
}
