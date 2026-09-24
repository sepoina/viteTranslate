// Architettura d'insieme: doc/structure.md § "2c. ICU MessageFormat".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// La regola di lettura degli argomenti per chi non passa dal chunk compilato:
// lib/react/interpolate.js, e con lui basicHtmlToNodes e il fallback di sviluppo, più
// l'interprete ICU di dev (lib/icu/devInterpret.js). Gli helper inline _named/_arg/_key emessi
// da lib/dev/compile/compileTable.js ne sono la copia dentro il chunk. Due copie, quindi, e la
// loro parità è un test (namedArgs.test.mjs), non una promessa: il chunk deve restare
// autosufficiente e non importare questo file.

/** Un oggetto semplice: il contenitore degli argomenti con nome, e mai un valore da mostrare. */
export function isNamedArgs(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v) || v.$$typeof !== undefined) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}

/** `{n}` / `%s`: `undefined` se assente. Array per indice, oggetto per proprietà, scalare solo in posizione 0. */
export function argAt(list, i) {
  if (list === false || list == null) return undefined;
  const v = Array.isArray(list) ? list[i] : isNamedArgs(list) ? (Object.hasOwn(list, i) ? list[i] : undefined) : i === 0 ? list : undefined;
  return v == null || isNamedArgs(v) ? undefined : v;
}

/** `{nome}`: il campo dell'oggetto degli argomenti, cioè l'argomento stesso o il primo della lista. `undefined` se assente. */
export function argNamed(list, k) {
  const o = Array.isArray(list) ? list[0] : list;
  const v = isNamedArgs(o) && Object.hasOwn(o, k) ? o[k] : undefined;
  return v == null || isNamedArgs(v) ? undefined : v;
}
