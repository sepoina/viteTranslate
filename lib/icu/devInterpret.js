// Architettura d'insieme: doc/structure.md § "2c. ICU MessageFormat".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Interprete di sviluppo per la sola finestra "stringa scritta in questa sessione di vite dev,
// non ancora sincronizzata". La tabella non la conosce, e senza questo interprete un messaggio
// ICU apparirebbe con la sintassi grezza fino al riavvio — il manifest lo importa solo in dev
// (buildManifest.js): in produzione icuDev è null e nessuno di questi moduli entra nel bundle.

import { parseIcu, TYPE } from "./parse.js";
import { icuNumber, icuDate, icuPlural, icuSelect } from "./runtime.js";
import { argAt, argNamed } from "../namedArgs.js";

/**
 * Riduce un messaggio ICU a testo con "%s" + valori, da passare a basicHtmlToNodes. I valori
 * formattati e quelli grezzi viaggiano come argomenti, così un elemento React resta un elemento.
 * @returns {{ text: string, values: any[] } | null} null se il testo non è ICU o non è valido
 */
export function interpretIcu(text, args, locale, icu) {
  const parsed = parseIcu(text, locale);
  if (!parsed.icu || !parsed.ok) return null;
  // Stessa lettura degli helper compilati (_arg / _key), da lib/namedArgs.js: assente → undefined.
  const valueOf = (key) => (/^\d+$/.test(key) ? argAt(args, Number(key)) : argNamed(args, key));
  const out = { text: "", values: [] };
  const put = (v) => { out.text += "%s"; out.values.push(v); };
  // `h` è il numero già formattato del plurale più interno: prende il posto di "#".
  const walk = (nodes, h) => {
    for (const node of nodes) {
      const v = node.type >= 1 && node.type <= 6 ? valueOf(node.value) : undefined;
      if (node.type === TYPE.literal) {
        out.text += node.value;
      } else if (node.type === TYPE.pound) {
        if (h === undefined) out.text += "#";
        else put(h);
      } else if (node.type === TYPE.argument) {
        put(v);
      } else if (node.type === TYPE.number) {
        put(icuNumber(v, locale, node.vtOptions));
      } else if (node.type === TYPE.date || node.type === TYPE.time) {
        put(icuDate(v, locale, node.vtOptions, icu));
      } else if (node.type === TYPE.select) {
        const fns = {};
        for (const [k, b] of Object.entries(node.options)) fns[k] = () => walk(b.value, undefined);
        icuSelect(v, fns);
      } else if (node.type === TYPE.plural) {
        const exact = {};
        const cats = {};
        for (const [k, b] of Object.entries(node.options)) {
          const fn = (hh) => walk(b.value, hh);
          if (k.startsWith("=")) exact[k.slice(1)] = fn;
          else cats[k] = fn;
        }
        icuPlural(v, locale, node.pluralType === "ordinal", node.offset ?? 0, exact, cats);
      }
    }
  };
  walk(parsed.ast, undefined);
  return out;
}
