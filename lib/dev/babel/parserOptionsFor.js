/**
 * Parser plugin di Babel da usare per un file, dedotti dalla sua estensione.
 *
 * Il plugin di estrazione legge il JSX (attributi e testo) ma non lo trasforma, e non
 * tocca affatto i tipi TypeScript: gli serve solo che il parser li **accetti**. Dichiarare
 * i parser plugin invece di caricare `@babel/preset-react` ha tre conseguenze volute:
 *
 *  - i file `.ts` / `.tsx` smettono di far esplodere il transform ("Missing initializer in
 *    const declaration" su una qualunque annotazione di tipo): prima l'estensione era
 *    accettata dal filtro ma la sintassi no;
 *  - il JSX arriva intatto al plugin React del progetto, che resta l'unico a decidere
 *    `jsxDEV`, `jsxImportSource` e Fast Refresh — prima veniva compilato qui, in `pre`,
 *    e quelle scelte andavano perse;
 *  - `@babel/preset-react` non è più una dipendenza di runtime del pacchetto.
 *
 * In `.ts` (non `.tsx`) il plugin JSX non va attivato: `<T>x` lì è un cast, non un
 * elemento, ed è la stessa distinzione che fa `tsc`.
 *
 * @param {string} filename - percorso o id del file (la query string di Vite è tollerata)
 * @returns {{ plugins: any[] }} `parserOpts` per `transformSync`
 */
export default function parserOptionsFor(filename) {
  const clean = filename.split("?")[0].toLowerCase();

  if (clean.endsWith(".tsx")) {
    return { plugins: ["jsx", ["typescript", { isTSX: true, disallowAmbiguousJSXLike: true }]] };
  }
  if (clean.endsWith(".ts") || clean.endsWith(".mts") || clean.endsWith(".cts")) {
    return { plugins: ["typescript"] };
  }
  return { plugins: ["jsx"] };
}
