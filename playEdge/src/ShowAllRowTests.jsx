import { Fragment, useState } from 'react';
import CodeIcon from './CodeIcon.jsx';

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
export default function ShowAllTests({ data, onShow, onHide }) {
  return (
    <>
      {data.map((row, index) =>
        typeof row === 'string' ? (
          <Fragment key={index}>
            <tr>
              <th colSpan={3}>
                <h3 style={{ paddingTop: '3em', color: '#800000' }}>{row}</h3>
              </th>
            </tr>
            <tr style={{ borderBottom: '4px solid #800000' }}>
              <th scope="col" style={{ fontWeight: 'bold' }}>
                Kind
              </th>
              <th scope="col" style={{ fontWeight: 'bold' }}>
                Result
              </th>
              <th scope="col" style={{ fontWeight: 'bold' }}>
                Atteso
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
                aria-label={`Sorgente di: ${row[0]}`}
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
              <b>{row[0]}</b>
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
