import { useMemo } from 'react';
import { Translate, useTranslateToString } from '@sepoina/vitetranslate/react';
import { highlight } from './theme/Code.jsx';
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

export default function CaseSection({ group, active, onShow }) {
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
            <tr
              key={row.title}
              className={`st-${row.status}${row === active ? ' is-showing' : ''}`}
              onMouseEnter={() => onShow(row)}
            >
              <th scope="row" data-label={labels.case}>
                {/* Col mouse basta passare sulla riga; il <button> c'è per la tastiera e per il
                    tocco, che ci arrivano da soli: il focus fa la stessa cosa del passaggio. */}
                <button
                  type="button"
                  className="src-btn"
                  aria-label={ts('_%_Sorgente di: %s_%_', ts(row.title, S))}
                  onFocus={() => onShow(row)}
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

/**
 * La sezione fissa in fondo allo schermo (un quarto dell'altezza) con il sorgente dell'ultima riga
 * puntata; la riga resta accesa finché non se ne punta un'altra. Resta scura anche nel tema chiaro
 * (data-theme="dark", vedi src/theme/tokens.css).
 *
 * Il codice si ingrandisce fino a riempire la sezione: --cols e --rows dicono al CSS quanti
 * caratteri è largo il sorgente e quante righe è alto, e la dimensione del carattere la calcola il
 * CSS con le unità del container (cqw, cqh). Una riga sola viene grande, sette righe più piccole.
 *
 * @param {{ row: object | null, hint: import('react').ReactNode }} props
 *   row: la riga da mostrare, o null prima del primo passaggio; hint: cosa dire intanto
 */
export function SourceDock({ row, hint }) {
  const source = row ? row.source.trim() : '';
  // colorato con lo stesso highlight dei blocchi di codice del sito (src/theme/Code.jsx)
  const nodes = useMemo(() => highlight(source, 'jsx'), [source]);
  const lines = source.split('\n');
  const size = { '--cols': Math.max(1, ...lines.map((l) => l.length)), '--rows': lines.length };
  const status = row?.status ?? 'ok';
  return (
    <aside data-theme="dark" className={`src-dock st-${status}`}>
      <div className="dock-bar">
        <div className="wrap dock-head">
          <span className="dock-tag" aria-hidden="true">
            &lt;/&gt;
          </span>
          {row && (
            <>
              <span className="dock-title">
                <Translate t={row.title} a={S} />
              </span>
              <span className={`chip st-${status}`}>
                <StatusLabel status={status} />
              </span>
            </>
          )}
        </div>
      </div>
      <div className="wrap dock-body">
        {row ? (
          <pre key={row.title} style={size}>
            <code>{nodes}</code>
          </pre>
        ) : (
          <p className="dock-hint">{hint}</p>
        )}
      </div>
    </aside>
  );
}
