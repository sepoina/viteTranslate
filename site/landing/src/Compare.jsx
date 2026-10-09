import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { REPO } from "./links.js";
import SectionHead from "./SectionHead.jsx";
import SIZE from "./theme/runtimeSize.json";

const COLUMNS = ["viteTranslate", "i18next", "Lingui", "FormatJS"];

// LINKED-DATA: README.md, tabella di «Why viteTranslate».
// y = sì, n = no, p = con un'aggiunta ufficiale o configurazione in più. Le righe vengono dalla
// tabella del README (manca solo la licenza), e le note che giustificano ogni casella stanno lì:
// una casella cambiata qui si cambia anche là, con la sua nota, e con la data qui sotto.
// `doc` è la guida del repo che spiega la soluzione di viteTranslate per quella riga: la stessa
// a cui porta il nome della riga nel README. Le etichette en-US usano le parole del README.
const ROWS = [
  { label: "_%_Traduzione automatica con LLM_%_", doc: "doc/llm.md", v: ["y", "p", "n", "n"] },
  {
    label: "_%_Estrazione dentro il ciclo di Vite_%_",
    doc: "doc/structure.md#auto-sync-at-config-time",
    v: ["y", "n", "n", "n"],
  },
  {
    label: "_%_Zero dipendenze a runtime_%_",
    doc: "doc/requirements.md#it-never-reaches-your-bundle",
    v: ["y", "n", "n", "n"],
  },
  { label: "_%_Plugin Vite ufficiale_%_", doc: "doc/plugin-options.md", v: ["y", "n", "y", "y"] },
  { label: "_%_Estensione VS Code ufficiale_%_", doc: "doc/ide-panel.md", v: ["y", "n", "n", "n"] },
  {
    label: "_%_Sintassi senza chiavi_%_",
    doc: "doc/react-api.md#write-jsx-inside-translate",
    v: ["y", "p", "y", "p"],
  },
  {
    label: "_%_Runtime %s gzip_%_",
    a: [SIZE.compare],
    doc: "doc/structure.md#phase-4--runtime-the-resolution-chain",
    v: ["y", "n", "y", "n"],
  },
  { label: "_%_ICU MessageFormat (plurali, select, date)_%_", doc: "doc/icu.md", v: ["y", "p", "y", "y"] },
  {
    label: "_%_Nessun parser dei messaggi a runtime_%_",
    doc: "doc/structure.md#2b-table-compilation-pre-building-values",
    v: ["y", "n", "p", "p"],
  },
  {
    label: "_%_Lingue caricate a richiesta_%_",
    doc: "doc/react-api.md#preloading-suspense-and-the-initial-flash",
    v: ["y", "y", "y", "y"],
  },
];

const GLYPHS = { y: "✓", p: "–", n: "✕" };

// Il segno si vede, il suo significato si legge: per i lettori di schermo "✓" non vuol dire niente.
function Mark({ kind, label }) {
  return (
    <>
      <span className={`mk mk-${kind}`} aria-hidden="true" title={label}>
        {GLYPHS[kind]}
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}

export default function Compare() {
  const trans = useTrans();
  const labels = {
    y: trans("_%_Disponibile_%_"),
    p: trans("_%_Con strumenti o configurazione aggiuntivi_%_"),
    n: trans("_%_Non offerto dal progetto_%_"),
  };

  return (
    <section className="section" data-section="compare">
      <div className="wrap">
        <SectionHead
          id="compare"
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
                      <a href={`${REPO}/blob/main/${row.doc}`}>
                        <Trans t={row.label} a={row.a} />
                      </a>
                    </th>
                    {row.v.map((kind, n) => (
                      <td key={COLUMNS[n]} className={n === 0 ? "col-us" : undefined}>
                        <Mark kind={kind} label={labels[kind]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="compare-notes">
            <p>
              <span className="mk mk-p" aria-hidden="true">
                –
              </span>{" "}
              <Trans>_%_= disponibile con strumenti o configurazione aggiuntivi._%_</Trans>
            </p>
            <p>
              <span className="mk mk-n" aria-hidden="true">
                ✕
              </span>{" "}
              <Trans>_%_= non offerto dagli strumenti del progetto: può supplire uno strumento di terzi._%_</Trans>
            </p>
            <p>
              <Trans>
                _%_Confronto aggiornato a settembre 2026: i18next 26 + react-i18next 17, Lingui 6, FormatJS (react-intl 12)._%_
              </Trans>{" "}
              <a href={`${REPO}#-why-vitetranslate`}>
                <Trans>_%_Il perché di ogni casella_%_</Trans> ↗
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
