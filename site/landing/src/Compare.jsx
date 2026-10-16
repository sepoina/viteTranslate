import { Trans, useTrans } from "@sepoina/vitetranslate/react";
import { REPO } from "./links.js";
import { docsUrl } from "./siteLinks.js";
import SectionHead from "./SectionHead.jsx";
import SIZE from "./theme/runtimeSize.json";

const COLUMNS = ["viteTranslate", "Lingui", "FormatJS", "i18next"];

// LINKED-DATA: README.md, tabella di «Why viteTranslate».
// y = native support; n = unavailable; p = partial support, official add-on or extra setup.
// Le righe vengono dalla
// tabella del README (manca solo la licenza), e le note che giustificano ogni casella stanno lì:
// una casella cambiata qui si cambia anche là, con la sua nota, e con la data qui sotto.
// `manual` (route#id del manuale, site/pages/docs) o `doc` (un file del repo, per le righe di
// architettura) è dove spiega la soluzione di viteTranslate per quella riga: lo stesso indirizzo
// a cui porta il nome della riga nel README. Le etichette en-US usano le parole del README.
// Prima le righe dove nessun rivale ha ✓, poi quelle dove qualcuno lo pareggia; dentro ogni
// gruppo, dal vantaggio più netto (✕ = 0, – = ½, ✓ = 1 sommati sui rivali) al più sottile; a
// parità, prima la riga con meno rivali a ✓.
const ROWS = [
  {
    label: "_%_Estrazione dentro il ciclo di Vite_%_",
    doc: "doc/structure.md#auto-sync-at-config-time",
    v: ["y", "n", "n", "n"],
  },
  {
    label: "_%_Zero dipendenze a runtime_%_",
    manual: "getting-started/installation#it-never-reaches-your-bundle",
    v: ["y", "n", "n", "n"],
  },
  { label: "_%_Estensione VS Code ufficiale_%_", manual: "vscode/install", v: ["y", "n", "n", "n"] },
  { label: "_%_Traduzione automatica con LLM_%_", manual: "llm/setup", v: ["y", "n", "n", "p"] },
  {
    label: "_%_Nessun parser dei messaggi a runtime_%_",
    doc: "doc/structure.md#2b-table-compilation-pre-building-values",
    v: ["y", "p", "p", "n"],
  },
  {
    label: "_%_Runtime %s gzip_%_",
    a: [SIZE.compare],
    doc: "doc/structure.md#phase-4--runtime-the-resolution-chain",
    v: ["y", "y", "n", "n"],
  },
  {
    label: "_%_Sintassi senza chiavi_%_",
    manual: "components/translate#write-jsx-inside-translate",
    v: ["y", "y", "p", "p"],
  },
  { label: "_%_Plugin Vite ufficiale_%_", manual: "api/plugin-options", v: ["y", "y", "y", "n"] },
  { label: "_%_ICU MessageFormat (plurali, select, date)_%_", manual: "concepts/icu", v: ["y", "y", "y", "p"] },
  {
    label: "_%_Lingue caricate a richiesta_%_",
    manual: "concepts/preloading",
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
    p: trans("_%_Supporto parziale, strumenti ufficiali o configurazione aggiuntivi_%_"),
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
                      <a href={row.manual ? docsUrl(row.manual) : `${REPO}/blob/main/${row.doc}`}>
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
              <span className="mk mk-y" aria-hidden="true">✓</span>{" "}
              <Trans>_%_Supporto nativo; può richiedere codice applicativo. Pesi in unità da 1024 byte (KiB)._%_</Trans>
            </p>
            <p>
              <span className="mk mk-p" aria-hidden="true">
                –
              </span>{" "}
              <Trans>_%_= supporto parziale, strumenti ufficiali o configurazione aggiuntivi._%_</Trans>
            </p>
            <p>
              <span className="mk mk-n" aria-hidden="true">
                ✕
              </span>{" "}
              <Trans>_%_= non offerto dagli strumenti del progetto: può supplire uno strumento di terzi._%_</Trans>
            </p>
            <p>
              <Trans>
                _%_Documentazione verificata il 10 ottobre 2026: Lingui 6, FormatJS (react-intl 12), i18next 26 + react-i18next 17._%_
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
