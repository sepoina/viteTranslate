// Comportamento del parser HTML del browser sul corpus di markupCorpus.mjs, registrato una
// volta e congelato qui: e' il riferimento con cui `parseMarkup` (build) deve concordare.
//
// Perche' congelato invece che misurato a ogni giro: il confronto vero richiede un browser,
// e `npm test` deve girare ovunque. Il parsing di HTML e' standardizzato e stabile, quindi
// una tabella registrata e' un oracolo affidabile.
//
// Le voci di sole entita' non restano comunque sulla parola: markupParity le ricontrolla a
// ogni giro con `entities` (fb55), la tabella HTML5 completa, che gira senza browser.
//
// Per rigenerarla, con Chrome installato:
//   node test/browserMarkupParity.mjs --json
//
// La chiave e' il nome del caso in markupCorpus.mjs; il valore e' la serializzazione
// dell'albero prodotto (`<tag>figli</tag>`, `<br/>` per i void).

export const ATTESO_BROWSER = {
  "testo semplice": "ciao mondo",
  "tag ammesso": "ciao <b>mondo</b>",
  "due tag adiacenti": "<b>a</b><i>b</i>",
  "annidamento profondo": "<b><i><u>x</u></i></b>",
  "tag vuoto": "<b></b>ciao",
  "tutti i tag ammessi": "<b>a</b><strong>b</strong><i>c</i><em>d</em><u>e</u><small>f</small><code>g</code>",
  "percentuale": "100% <b>puro</b>",
  "apostrofo": "l'utente <b>attivo</b>",
  "br senza chiusura": "riga<br/>altra",
  "br autochiuso": "riga<br/>altra",
  "br con spazio": "riga<br/>altra",
  "hr": "prima<hr/>dopo",
  "wbr": "pa<wbr/>rola",
  "void con chiusura": "riga<br/><br/>altra",
  "void con figli apparenti": "<br/>ciao<br/>",
  "tag non chiuso": "ciao <b>mondo</b>",
  "due tag non chiusi": "<b>a<i>b</i></b>",
  "chiusura spaiata": "ciao  mondo",
  "chiusura spaiata iniziale": "ciao",
  "tag incrociati": "<b>ciao <i>mondo</i></b><i> ancora</i>",
  "stesso tag annidato": "<b>a <b>b</b> c</b>",
  "non-void autochiuso": "<b>ciao</b>",
  "chiusura senza apertura annidata": "<b>ab</b>",
  "tag non ammesso": "ciao",
  "tag non ammesso annidato": "<b>ciao</b>",
  "tag non ammesso non chiuso": "ciao",
  "script": "alert(1)ciao",
  "style": "a{b:c}ciao",
  "tag sconosciuto autochiuso": "ciao",
  "img": "primadopo",
  "anchor": "vai qui ora",
  "attributi ignorati": "<b>ciao</b>",
  "apice singolo": "<b>ciao</b>",
  "maggiore in attributo": "<b>ciao</b>",
  "minore in attributo": "<b>ciao</b>",
  "attributo senza valore": "<b>ciao</b>",
  "attributo con spazi": "<b>ciao</b>",
  "maiuscole": "<b>ciao</b>",
  "maiuscole miste": "<b>ciao</b>",
  "spazio prima del nome": "< b >ciao</ b >",
  "entita dentro tag": "<b>&</b>",
  "entita senza punto e virgola in un tag": "<b>a & b</b>",
  "entita fuori dalla tabella": "<b>♥ e α</b>",
  "commento": "primadopo",
  "commento con tag dentro": "ab",
  "commento non chiuso": "a",
  "minore isolato": "a < b",
  "maggiore isolato": "a > b",
  "minore finale": "finisce con <",
  "graffe": "usa {questo} valore",
  "backslash": "percorso a\\b",
  "virgolette": "dice \"ciao\" a tutti",
  "stringa vuota": "",
  "solo spazi": "   ",
  "solo un tag": "<b></b>",
  "solo una chiusura": "",
  "testo unicode": "però è così — 中文 🐅",
  "unicode dentro tag": "<b>中文</b> e <i>🐅</i>",
};
