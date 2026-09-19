import { Fragment, useState } from 'react';
import CodeIcon from './CodeIcon.jsx';
import { Translate, useTranslateToString } from '@sepoina/vitetranslate/react';
//
// Una riga è la quaterna:
//   [ titolo, cosa rende <Translate>, cosa dovrebbe uscire, il sorgente come testo ]
//
// Il quarto elemento è scritto a mano e non ricavato dall'elemento: quando l'elemento
// arriva qui il transform ha già riscritto i marcatori in `_<_chiave_/_testo_>_`, e
// ricostruire il sorgente da lì vorrebbe dire decodificarli — cioè fidarsi di un
// secondo meccanismo per raccontare il primo. Costa che va aggiornato insieme alla
// riga: se i due divergono, la colpa è di chi ha toccato la riga e non del lettore.
//
// Una stringa da sola al posto della quaterna è un titolo di sezione.
//
//
// I titoli di riga sono marcati come tutto il resto, e alcuni contengono un `%s`
// che fa parte del nome del caso ("%s in meno"): passandone qualcuno come argomento
// ogni `%s` torna a essere se stesso invece di diventare `⁇` — è la stessa mossa
// della riga "%s letterale come dato". Gli argomenti in più vengono ignorati.
//
const S = ['%s', '%s', '%s', '%s'];

export default function ShowAllTests({ data, onShow, onHide }) {
  const ts = useTranslateToString();
  return (
    <>
      {data.map((row, index) =>
        typeof row === 'string' ? (
          <Fragment key={index}>
            <tr>
              <th colSpan={3}>
                <h3 style={{ paddingTop: '3em', color: '#800000' }}><Translate t={row} /></h3>
              </th>
            </tr>
            <tr style={{ borderBottom: '4px solid #800000' }}>
              <th scope="col" style={{ fontWeight: 'bold' }}>
                <Translate t={"_%_tipo_%_"} />
              </th>
              <th scope="col" style={{ fontWeight: 'bold' }}>
                <Translate t={"_%_risultato_%_"} />
              </th>
              <th scope="col" style={{ fontWeight: 'bold' }}>
                <Translate t={"_%_atteso in origine (IT)_%_"} />
              </th>
            </tr>
          </Fragment>
        ) : (
          <tr key={index} style={{ fontSize: '0.9em', lineHeight: '90%' }}>
            <td>
              {/* Un <button> e non uno <span>: così la tastiera ci arriva da sola,
                  e focus/blur sono gli stessi due eventi di enter/leave. */}
              <button
                type="button"
                aria-label={ts('_%_Sorgente di: %s_%_', ts(row[0], S))}
                onMouseEnter={() =>
                  onShow(row[3] ?? '// sorgente non indicato')
                }
                onFocus={() => onShow(row[3] ?? '// sorgente non indicato')}
                onMouseLeave={onHide}
                onBlur={onHide}
                style={{
                  // Pico veste i button di suo: qui va tolto tutto, o diventa
                  // un bottone vero in mezzo alla cella.
                  all: 'unset',
                  cursor: 'help',
                  marginRight: '0.45em',
                  color: '#800000',
                  opacity: 0.45,
                  fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
                  fontSize: '0.85em',
                }}
              >
                <CodeIcon />
              </button>
              <b>
                <Translate t={row[0]} a={S} />
              </b>
            </td>
            <td>
              <em>«</em>
              {row[1]}
              <em>»</em>
            </td>
            <td style={{ opacity: 0.7 }}>
              <em>«</em>
              {row[2]}
              <em>»</em>
            </td>
          </tr>
        )
      )}
    </>
  );
}
