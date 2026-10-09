import { Trans } from "@sepoina/vitetranslate/react";
import { Icon } from "./icons.jsx";
import { REPO } from "./links.js";
import SectionHead from "./SectionHead.jsx";
import SIZE from "./theme/runtimeSize.json";

const COLUMNS = ["viteTranslate", "i18next", "Lingui", "FormatJS"];

// y = sì, n = no, p = con un'aggiunta ufficiale o configurazione in più. Le righe vengono dalla
// tabella del README (manca solo la licenza), e le note che giustificano ogni casella stanno lì:
// una casella cambiata qui si cambia anche là, con la sua nota, e con la data qui sotto.
const ROWS = [
  { label: "_%_Traduzione automatica con LLM_%_", v: ["y", "p", "n", "n"] },
  { label: "_%_Estrazione dentro il ciclo di Vite_%_", v: ["y", "n", "n", "n"] },
  { label: "_%_Zero dipendenze a runtime_%_", v: ["y", "n", "n", "n"] },
  { label: "_%_Plugin Vite ufficiale_%_", v: ["y", "n", "y", "y"] },
  { label: "_%_Sintassi senza chiavi_%_", v: ["y", "p", "y", "p"] },
  { label: "_%_Runtime %s gzip_%_", a: [SIZE.compare], v: ["y", "n", "y", "n"] },
  { label: "_%_ICU MessageFormat (plurali, select, date)_%_", v: ["y", "p", "y", "y"] },
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
          eyebrow={<Trans>_%_Confronto_%_</Trans>}
          title={<Trans t="_%_Stesso problema, <em>meno macchina</em>._%_" />}
          text={
            <Trans>
              _%_Le altre librerie fanno bene il loro lavoro. La differenza è quanto devi configurare, e quanto finisce nel bundle._%_
            </Trans>
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
                      <Trans t={row.label} a={row.a} />
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
            <Trans>_%_= disponibile con strumenti o configurazione aggiuntivi._%_</Trans>
          </p>
          <p className="compare-note">
            <Icon name="x" size={14} strokeWidth={2.4} />
            <Trans>_%_= non offerto dagli strumenti del progetto: può supplire uno strumento di terzi._%_</Trans>
          </p>
          <p className="compare-note">
            <span>
              <Trans>
                _%_Confronto aggiornato a settembre 2026: i18next 26 + react-i18next 17, Lingui 6, FormatJS (react-intl 12)._%_
              </Trans>{" "}
              <a href={`${REPO}#-why-vitetranslate`}>
                <Trans>_%_Il perché di ogni casella_%_</Trans> ↗
              </a>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
