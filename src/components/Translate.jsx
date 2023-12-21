import { useContext, useMemo } from "react";
import { TranslateContext } from "./TranslateContainer";
/**
 * t -> testo da mostrare
 * a -> array di campi che iniettano il testo da mostrare
 * c -> testo da costante javascript iniettata
 * children -> eventuali figli
 */
export default function Translate({
  "data-translate": dataTranslate,
  t,
  c,
  a,
  children,
}) {
  const lang = useContext(TranslateContext);
  //
  // evita il rendering se non cambia lingua o array di dati
  return useMemo(() => {
    let inputString = c || t || children;
    // console.log("rerender:", inputString);
    //
    // non c'è dataTranslate, può essere che sia inlinea, se lo è è nel parametro c
    if (!dataTranslate) {
      const matches = inputString.match(/_<_(.*?)_\/_(.*?)_>_/);
      if (matches) {
        dataTranslate = matches[1]; // Contenuto tra "_<_" e "_/_"
        inputString = matches[2]; // Contenuto tra "_/_" e "_>_"
      } else {
        throw "errore nel servizio di traduzione, manca translate";
      }
    }
    //
    // c'è traduzione
    if (lang?.table?.[dataTranslate])
      return (
        <span data-from-translate={dataTranslate}>
          {a
            ? sostitui(lang.table[dataTranslate], a)
            : lang.table[dataTranslate]}
        </span>
      );
    //
    // non c'è traduzione
    return (
      <span data-not-translate={dataTranslate}>
        {a ? sostitui(inputString, a) : inputString}
      </span>
    );
  }, [lang, a]); // solo il cambio di lingua e di array obbliga il re-rendering
}

//
// filla le variabili nel template
//     es: text='Siamo al:%0/%1' e ['20%','100%']
//              'Siamo al:%0' e '20%'
//
function sostitui(text, args) {
  // se non ci sono argomenti torna sè stesso
  if (args === undefined) return text;
  // definisce il contenitore
  const list = Array.isArray(args) ? args : [args]; // se args[0] è un array è lui la lista sennò lo mette in un array monoelemento

  let counter = 0;
  const replacedString = text.replace(/%s/g, () => list[counter++]);
  return replacedString;
  /*
    // log(text, args);
    // https://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format#
    // var args = Array.prototype.slice.call(arguments, 1);
    return text.replace(/%(\d+)/g, function (match, number) {
        return typeof list[number] != 'undefined'
            ? list[number]
            : match
            ;
    });*/
}
