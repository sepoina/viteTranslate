import { Translate } from "@sepoina/vitetranslate/react";
import { Icon } from "./icons.jsx";
import SectionHead from "./SectionHead.jsx";
import SIZE from "./theme/runtimeSize.json";

const COLUMNS = ["viteTranslate", "i18next", "Lingui", "FormatJS"];

// y = sì, n = no, p = con strumenti o configurazione in più. Le righe vengono dalla tabella del README.
const ROWS = [
  { label: "_%_Traduzione automatica con LLM_%_", v: ["y", "n", "n", "n"] },
  { label: "_%_Tabelle YAML sincronizzate da sole_%_", v: ["y", "n", "n", "n"] },
  { label: "_%_Estrazione dentro il ciclo di Vite_%_", v: ["y", "n", "n", "n"] },
  { label: "_%_Zero dipendenze a runtime_%_", v: ["y", "n", "n", "n"] },
  { label: "_%_Integrazione nativa con Vite_%_", v: ["y", "n", "p", "n"] },
  { label: "_%_Sintassi senza chiavi_%_", v: ["y", "n", "y", "p"] },
  { label: "_%_Runtime %s gzip_%_", a: [SIZE.compare], v: ["y", "n", "p", "n"] },
  { label: "_%_Nessun parser dei messaggi a runtime_%_", v: ["y", "n", "p", "p"] },
  { label: "_%_Lingue caricate a richiesta_%_", v: ["y", "y", "y", "y"] },
];

const MARKS = { y: "check", n: "x", p: "minus" };

function Mark({ kind }) {
  return (
    <span className={`mk mk-${kind}`}>
      <Icon name={MARKS[kind]} size={16} strokeWidth={2.4} />
    </span>
  );
}

export default function Compare() {
  return (
    <section className="section" data-section="compare">
      <div className="wrap">
        <SectionHead
          eyebrow={<Translate>_%_Confronto_%_</Translate>}
          title={<Translate t="_%_Stesso problema, <em>meno macchina</em>._%_" />}
          text={
            <Translate>
              _%_Le altre librerie fanno bene il loro lavoro. La differenza è quanto devi configurare, e quanto finisce nel bundle._%_
            </Translate>
          }
        />

        <div className="compare" data-reveal>
          <div className="compare-scroll">
            <table>
              <thead>
                <tr>
                  <th />
                  {COLUMNS.map((c, n) => (
                    <th key={c} className={n === 0 ? "col-us" : undefined}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">
                      <Translate t={row.label} a={row.a} />
                    </th>
                    {row.v.map((kind, n) => (
                      <td key={COLUMNS[n]} className={n === 0 ? "col-us" : undefined}>
                        <Mark kind={kind} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="compare-note">
            <Icon name="minus" size={14} strokeWidth={2.4} />
            <Translate>_%_= disponibile con strumenti o configurazione aggiuntivi._%_</Translate>
          </p>
        </div>
      </div>
    </section>
  );
}
