// La tabella delle entità HTML usata a build time, verificata contro quella vera.
//
// A runtime le entità le scioglie il parser del browser; a build time c'è solo la nostra
// tabella, e ogni nome che le manca — o che le manca *storto* — è una divergenza silenziosa
// fra i due: lo stesso testo si legge in un modo prima della sincronizzazione e in un altro
// dentro la tabella compilata.
//
// L'oracolo è `entities` (fb55), la stessa tabella HTML5 che usano i parser veri: dipendenza
// di SVILUPPO di questo pacchetto, mai spedita a chi lo installa. Prima le attese erano scritte
// a mano — un centinaio di caratteri ricopiati, cioè un centinaio di occasioni di sbagliarne
// uno e congelare l'errore dentro un test che passa. Ora l'unica cosa scritta a mano è la
// nostra tabella, e il confronto è meccanico:
//
//   - `decodeHTMLStrict` è esattamente il nostro contratto (punto e virgola obbligatorio);
//   - `decodeHTML` è quello del browser (nomi storici sciolti anche senza), e compare solo
//     dove serve a mostrare una divergenza voluta per quello che è.
//
//   node test/list/decodeEntities.test.mjs
import { decodeHTML, decodeHTMLStrict } from "entities";
import decodeEntities, { NAMED_ENTITIES } from "../../lib/dev/compile/decodeEntities.js";
import parseMarkup from "../../lib/dev/compile/parseMarkup.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(50), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const nomi = Object.keys(NAMED_ENTITIES);

// ------------------------------------------------------- ogni voce, contro l'oracolo
console.log("\n== ogni nome della tabella dice quello che dice l'HTML5 ==");
{
  // Il controllo che conta, e su tutte le voci invece che su un campione: un carattere
  // sbagliato qui non rompe niente, mostra il simbolo di un'altra entità dentro una traduzione.
  const discordi = nomi.filter((n) => decodeEntities(`&${n};`) !== decodeHTMLStrict(`&${n};`));
  eq(`tutte le ${nomi.length} voci concordano con entities`, "", discordi.map((n) => `&${n};`).join(" "));

  // Nessuna voce inventata: un nome che l'HTML5 non conosce resterebbe letterale nel browser e
  // sciolto da noi — la divergenza al contrario, ancora più difficile da vedere.
  const inesistenti = nomi.filter((n) => decodeHTMLStrict(`&${n};`) === `&${n};`);
  eq("nessun nome che l'HTML5 non conosca", "", inesistenti.join(","));
}

console.log("\n== il blocco Latin-1 è completo e nell'ordine giusto ==");
{
  // È generato dai code point (vedi decodeEntities.js), quindi l'unico modo di sbagliarlo è
  // sbagliare l'ordine dei nomi: si vedrebbe qui come una lettera accentata al posto di un'altra.
  const buchi = [];
  for (let cp = 0x00a0; cp <= 0x00ff; cp++) {
    const carattere = String.fromCharCode(cp);
    const nome = nomi.find((n) => NAMED_ENTITIES[n] === carattere);
    if (nome === undefined) buchi.push(`U+${cp.toString(16).toUpperCase()}`);
    else if (decodeHTMLStrict(`&${nome};`) !== carattere) buchi.push(`&${nome};`);
  }
  eq("96 caratteri fra U+00A0 e U+00FF, tutti giusti", "", buchi.join(","));
}

// --------------------------------------------------------- testi come li scrive un umano
console.log("\n== testi realistici: stesso risultato del parser vero ==");
{
  const testi = [
    "&Aacute;lvaro ha 3 messaggi",
    "&eacute;t&eacute; &agrave; Montr&eacute;al",
    "Stra&szlig;e &uuml;ber alles",
    "espa&ntilde;ol &amp; fran&ccedil;ais",
    "50&nbsp;&euro; &mdash; sconto del 50%",
    "&laquo;citazione&raquo; e &ldquo;virgolette&rdquo;",
    "1&nbsp;&le;&nbsp;x&nbsp;&le;&nbsp;10 &rarr; &infin;",
    "&lt;b&gt;non è un tag&lt;/b&gt;",
    "&#233;&#x2014;&#X2014;&#128005;",
    "niente entità qui",
  ];
  const discordi = testi.filter((t) => decodeEntities(t) !== decodeHTMLStrict(t));
  eq(`${testi.length} testi, tutti d'accordo`, "", discordi.join(" | "));
}

// ------------------------------------------------------------------ divergenze volute
console.log("\n== le differenze rimaste, tutte volute ==");
{
  // 1. Sottoinsieme. La tabella completa sono più di duemila nomi, per lo più greco e
  //    matematica: quelli fuori restano letterali. Quali siano dentro e quali fuori lo decide
  //    l'oracolo, non l'idea che me ne sono fatto scrivendo il test.
  const prova = ["alpha", "Omega", "sum", "harr", "starf", "hearts"];
  const conosciuti = prova.filter((n) => decodeHTMLStrict(`&${n};`) !== `&${n};`);
  eq("nomi di prova, tutti veri per l'HTML5", prova.join(","), conosciuti.join(","));

  const coperti = conosciuti.filter((n) => Object.hasOwn(NAMED_ENTITIES, n));
  const scoperti = conosciuti.filter((n) => !Object.hasOwn(NAMED_ENTITIES, n));
  eq(`coperti (${coperti.join(",")}): sciolti come l'oracolo`, "",
    coperti.filter((n) => decodeEntities(`&${n};`) !== decodeHTMLStrict(`&${n};`)).join(","));
  eq(`non coperti (${scoperti.join(",")}): lasciati letterali`, "",
    scoperti.filter((n) => decodeEntities(`&${n};`) !== `&${n};`).join(","));

  // 2. Punto e virgola obbligatorio. Il browser scioglie una manciata di nomi storici anche
  //    senza — la stessa regola per cui legge `&notthing` come `¬thing`, che dentro una
  //    traduzione è un guaio e non una comodità.
  for (const testo of ["a &amp b", "&notthing", "AT&T e altri"]) {
    eq(`senza ';' resta com'è: ${JSON.stringify(testo)}`, decodeHTMLStrict(testo), decodeEntities(testo));
  }
  eq("...mentre il browser scioglierebbe", "¬thing", decodeHTML("&notthing"));

  // 3. Passata unica: un testo già codificato due volte non si scodifica da solo.
  eq("doppia codifica come l'oracolo", decodeHTMLStrict("&amp;lt;"), decodeEntities("&amp;lt;"));
  eq("...cioè si ferma a metà strada", "&lt;", decodeEntities("&amp;lt;"));
}

console.log("\n== forme numeriche e code point impossibili ==");
{
  const valide = ["&#60;", "&#x3c;", "&#X3C;", "&#233;", "&#x1F405;"];
  eq(`${valide.length} forme numeriche valide`, "", valide.filter((n) => decodeEntities(n) !== decodeHTMLStrict(n)).join(","));
  // Dove il code point non esiste (surrogato isolato, oltre il piano Unicode) `entities` mette
  // U+FFFD e noi lasciamo l'entità letterale: nessuna delle due strade fa fallire la build né
  // mostra un carattere sbagliato, e lasciarla scritta si legge come un errore da correggere.
  eq("surrogato isolato: lasciato letterale", "&#xD800;", decodeEntities("&#xD800;"));
  eq("oltre Unicode: lasciato letterale", "&#x110000;", decodeEntities("&#x110000;"));
}

// ------------------------------------------------- come si vede dal parser di markup
console.log("\n== dentro parseMarkup: prima i tag, poi le entità ==");
{
  const rendi = (nodi) => nodi.map(function uno(n) {
    return n.type === "text" ? n.value : `<${n.tag}>${n.children.map(uno).join("")}</${n.tag}>`;
  }).join("");

  eq("accenti dentro un tag", `<b>${decodeHTMLStrict("caff&egrave;")}</b>`, rendi(parseMarkup("<b>caff&egrave;</b>")));
  // L'ordine conta: le entità si sciolgono DOPO il riconoscimento dei tag, così `&lt;b&gt;`
  // resta il testo `<b>` invece di diventare un elemento. È anche ciò che fa il browser.
  eq("un tag scritto come entità resta testo", "<b>", rendi(parseMarkup("&lt;b&gt;")));
  eq("nbsp non spezza il testo", decodeHTMLStrict("50&nbsp;&euro;"), rendi(parseMarkup("50&nbsp;&euro;")));
  const senza = "nessuna entita qui";
  eq("senza '&' torna la stessa stringa", true, decodeEntities(senza) === senza);
}

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
