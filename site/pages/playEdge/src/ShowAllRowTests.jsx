import { Translate, useTranslateToString } from '@sepoina/vitetranslate/react';
//
// I dati (testCases.jsx, autoWrapCases.jsx) sono una lista piatta di due forme:
//
//   { id, title }                                   apre una categoria
//   [ titolo, elemento, atteso, sorgente, stato? ]  un caso
//
// `id` è l'ancora della categoria (…/edge/#icu): in inglese e mai tradotto, perché la
// documentazione ci punta. Va trattato come un URL pubblico: rinominarlo rompe i link.
//
// `stato` manca per i casi ottimali; altrimenti è 'warn' (rende, ma qualcosa si perde o
// sorprende: un ⁇, un tag scartato, un avviso di build) o 'error' (un mark ‼️/🚫 o un errore
// in console). Dentro una categoria le righe si ordinano ok → warn → error; a parità di
// stato resta l'ordine del file.
//
// Il sorgente è scritto a mano e non ricavato dall'elemento: quando l'elemento arriva qui il
// transform ha già riscritto i marcatori in `_<_chiave_/_testo_>_`, e ricostruire il sorgente
// da lì vorrebbe dire decodificarli — cioè fidarsi di un secondo meccanismo per raccontare il
// primo. Costa che va aggiornato insieme alla riga: se i due divergono, la colpa è di chi ha
// toccato la riga e non del lettore.
//
// I titoli di riga sono marcati come tutto il resto, e alcuni contengono un `%s` che fa parte
// del nome del caso ("%s in meno"): passandone qualcuno come argomento ogni `%s` torna a essere
// se stesso invece di diventare `⁇` — è la stessa mossa della riga "%s letterale come dato".
// Gli argomenti in più vengono ignorati.
//
const S = ['%s', '%s', '%s', '%s'];

export const STATUSES = ['ok', 'warn', 'error'];

/** Dalla lista piatta alle categorie, con le righe già ordinate per stato. */
export function groupCases(...lists) {
  const groups = [];
  for (const item of lists.flat()) {
    if (Array.isArray(item)) {
      const [title, element, expected, source, status = 'ok'] = item;
      groups.at(-1).rows.push({ title, element, expected, source, status });
    } else {
      groups.push({ ...item, rows: [] });
    }
  }
  for (const g of groups) {
    // sort è stabile: a parità di stato resta l'ordine del file
    g.rows.sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status));
  }
  return groups;
}

/** L'etichetta di uno stato, per la legenda e per chi legge con uno screen reader. */
export function StatusLabel({ status }) {
  if (status === 'warn') return <Translate>_%_warning_%_</Translate>;
  if (status === 'error') return <Translate>_%_errore_%_</Translate>;
  return <Translate>_%_ottimale_%_</Translate>;
}

export default function CaseSection({ group, onShow, onHide }) {
  const ts = useTranslateToString();
  const { id, title, rows } = group;
  const labels = {
    case: ts('_%_caso_%_'),
    result: ts('_%_risultato_%_'),
    expected: ts('_%_atteso in origine (IT)_%_'),
  };
  return (
    <section id={id} className="cases">
      <h2>
        <a className="anchor" href={`#${id}`} aria-label={ts('_%_Link a questa sezione_%_')}>
          #
        </a>
        <Translate t={title} a={S} />
      </h2>
      <table>
        <thead>
          <tr>
            <th scope="col">{labels.case}</th>
            <th scope="col">{labels.result}</th>
            <th scope="col">{labels.expected}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.title} className={`st-${row.status}`}>
              <th scope="row" data-label={labels.case}>
                {/* Un <button> e non uno <span>: così la tastiera ci arriva da sola,
                    e focus/blur sono gli stessi due eventi di enter/leave. */}
                <button
                  type="button"
                  className="src-btn"
                  aria-label={ts('_%_Sorgente di: %s_%_', ts(row.title, S))}
                  onMouseEnter={() => onShow(row.source)}
                  onFocus={() => onShow(row.source)}
                  onMouseLeave={onHide}
                  onBlur={onHide}
                >
                  &lt;/&gt;
                </button>
                <Translate t={row.title} a={S} />
                <span className="sr-only">
                  {' ('}
                  <StatusLabel status={row.status} />)
                </span>
              </th>
              <td data-label={labels.result}>
                <span className="out">{row.element}</span>
              </td>
              <td data-label={labels.expected} className="expected">
                {row.expected}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
