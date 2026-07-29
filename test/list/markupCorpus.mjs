// I casi su cui `parseMarkup` viene messo a confronto con il parser vero.
//
// Sono due liste, perché gli oracoli sono due e uno costa molto meno dell'altro:
//
//   CORPUS         struttura dei tag. L'unico riferimento possibile è un browser, quindi
//                  l'attesa va registrata (markupExpected.mjs, con browserMarkupParity.mjs) e
//                  aggiungere un caso qui vuol dire riaprire Chrome.
//   CORPUS_ENTITA  sole entità, senza tag. L'attesa la calcola `entities` a ogni giro, quindi
//                  aggiungere un caso costa una riga e nient'altro: è per questo che qui sotto
//                  ce ne sono tanti e lì sopra solo quelli che servono davvero.
//
// Ogni voce: [nome, sorgente]. I nomi del primo gruppo sono stabili: sono le chiavi della
// tabella registrata.
export const CORPUS = [
  // --- forme normali
  ["testo semplice", "ciao mondo"],
  ["tag ammesso", "ciao <b>mondo</b>"],
  ["due tag adiacenti", "<b>a</b><i>b</i>"],
  ["annidamento profondo", "<b><i><u>x</u></i></b>"],
  ["tag vuoto", "<b></b>ciao"],
  ["tutti i tag ammessi", "<b>a</b><strong>b</strong><i>c</i><em>d</em><u>e</u><small>f</small><code>g</code>"],
  ["percentuale", "100% <b>puro</b>"],
  ["apostrofo", "l'utente <b>attivo</b>"],

  // --- tag void
  ["br senza chiusura", "riga<br>altra"],
  ["br autochiuso", "riga<br/>altra"],
  ["br con spazio", "riga<br />altra"],
  ["hr", "prima<hr>dopo"],
  ["wbr", "pa<wbr>rola"],
  ["void con chiusura", "riga<br></br>altra"],
  ["void con figli apparenti", "<br>ciao</br>"],

  // --- markup malformato
  ["tag non chiuso", "ciao <b>mondo"],
  ["due tag non chiusi", "<b>a<i>b"],
  ["chiusura spaiata", "ciao </b> mondo"],
  ["chiusura spaiata iniziale", "</b>ciao"],
  ["tag incrociati", "<b>ciao <i>mondo</b> ancora</i>"],
  ["stesso tag annidato", "<b>a <b>b</b> c</b>"],
  ["non-void autochiuso", "<b/>ciao"],
  ["chiusura senza apertura annidata", "<b>a</i>b</b>"],

  // --- tag non ammessi
  ["tag non ammesso", "<div>ciao</div>"],
  ["tag non ammesso annidato", "<div><b>ciao</b></div>"],
  ["tag non ammesso non chiuso", "<div>ciao"],
  ["script", "<script>alert(1)</script>ciao"],
  ["style", "<style>a{b:c}</style>ciao"],
  ["tag sconosciuto autochiuso", "<foo/>ciao"],
  ["img", "prima<img src='x'>dopo"],
  ["anchor", "vai <a href='/x'>qui</a> ora"],

  // --- attributi
  ["attributi ignorati", '<b class="x" id="y">ciao</b>'],
  ["apice singolo", "<b class='x'>ciao</b>"],
  ["maggiore in attributo", '<b title="a>b">ciao</b>'],
  ["minore in attributo", '<b title="a<b">ciao</b>'],
  ["attributo senza valore", "<b hidden>ciao</b>"],
  ["attributo con spazi", '<b  class = "x" >ciao</b>'],

  // --- maiuscole e spazi
  ["maiuscole", "<B>ciao</B>"],
  ["maiuscole miste", "<B>ciao</b>"],
  ["spazio prima del nome", "< b >ciao</ b >"],

  // --- entita mescolate ai tag (le altre stanno in CORPUS_ENTITA, senza registrazione)
  ["entita dentro tag", "<b>&amp;</b>"],
  // Un'entità senza punto e virgola con un tag accanto: senza il tag, il pre-filtro del
  // runtime (HAS_HTML_RE, che il punto e virgola lo pretende) scarta la stringa e il parser
  // del browser non la vede nemmeno. Con il tag la vede, e le due strade divergono davvero.
  ["entita senza punto e virgola in un tag", "<b>a &amp b</b>"],
  // Un nome che il browser conosce e la nostra tabella no: è il costo dichiarato di una
  // tabella che copre un sottoinsieme invece di tutto l'HTML5.
  ["entita fuori dalla tabella", "<b>&hearts; e &alpha;</b>"],

  // --- commenti e caratteri speciali
  ["commento", "prima<!-- nascosto -->dopo"],
  ["commento con tag dentro", "a<!-- <b>x</b> -->b"],
  ["commento non chiuso", "a<!-- b"],
  ["minore isolato", "a < b"],
  ["maggiore isolato", "a > b"],
  ["minore finale", "finisce con <"],
  ["graffe", "usa {questo} valore"],
  ["backslash", "percorso a\\b"],
  ["virgolette", 'dice "ciao" a tutti'],

  // --- vuoti e limite
  ["stringa vuota", ""],
  ["solo spazi", "   "],
  ["solo un tag", "<b>"],
  ["solo una chiusura", "</b>"],
  ["testo unicode", "però è così — 中文 🐅"],
  ["unicode dentro tag", "<b>中文</b> e <i>🐅</i>"],
];

/**
 * Casi di sole entità, senza tag: qui l'attesa non è registrata da nessuna parte, la calcola
 * `entities` quando il test gira (vedi markupParity.test.mjs). Aggiungerne uno è una riga.
 *
 * Sono solo nomi che la nostra tabella copre: quelli che non copre, e le altre differenze
 * volute rispetto al browser, stanno in ENTITA_DIVERGENTI qui sotto — dove ognuna deve dire
 * perché.
 */
export const CORPUS_ENTITA = [
  // --- forme, e dove capitano nella stringa
  "&amp;",
  "&eacute;",
  "a &amp; b",
  "&hellip;in coda",
  "in testa&hellip;",
  "prima&mdash;dopo",
  "&eacute;&eacute;&eacute;",
  "&laquo;&nbsp;citazione&nbsp;&raquo;",
  "&lt;b&gt;grassetto&lt;/b&gt;",
  "a&nbsp;b",

  // --- numeriche, in tutte e tre le scritture, dentro e fuori dal BMP
  "&#60;b&#62;",
  "&#x3C;b&#x3E;",
  "&#X3C;b&#X3E;",
  "&#233;t&eacute;",
  "&#128005; &#x1F405;",
  "&#8212;&#x2014;",

  // --- lingue vere, che è il motivo per cui la tabella esiste
  "&Aacute;lvaro e &Oacute;scar",
  "&eacute;t&eacute; &agrave; Montr&eacute;al",
  "Stra&szlig;e, gr&ouml;&szlig;er, &Uuml;bung",
  "espa&ntilde;ol: &iexcl;hola! &iquest;qu&eacute; tal?",
  "portugu&ecirc;s: informa&ccedil;&atilde;o, &uacute;til",
  "dansk: r&oslash;dgr&oslash;d, &Aring;rhus",
  "&Eth;&thorn; islandese, &yacute; e &yuml;",
  "fran&ccedil;ais: c&oelig;ur, &OElig;uvre",
  "&Scaron;koda, &scaron;e&scaron;i",

  // --- tipografia e simboli
  "&laquo;&raquo; &ldquo;&rdquo; &lsquo;&rsquo; &bdquo;&sbquo; &lsaquo;&rsaquo;",
  "&copy; &reg; &trade; &sect; &para; &dagger; &Dagger; &bull; &middot; &permil;",
  "&prime; e &Prime; per piedi e pollici",
  "&euro; &pound; &yen; &cent; &curren;",
  "&frac12; &frac14; &frac34; &sup1; &sup2; &sup3; &deg; &micro;",
  "&ordf; &ordm; &brvbar; &uml; &macr; &acute; &cedil; &not;",
  "&AMP; &LT; &GT; &QUOT; &COPY; &REG; &TRADE;",

  // --- matematica e frecce
  "1 &le; x &le; 10, x &ne; 5",
  "&minus;3 &plusmn; 2 &times; 4 &divide; 2",
  "&radic;2 &asymp; 1,41 &rarr; &infin;",
  "&larr; &uarr; &darr; &harr; &sum; &prod;",
  "&hearts; &diams; &clubs; &spades; &loz;",

  // --- invisibili: si scrivono come entità proprio perché non si vedono
  "ossi&shy;geno",
  "a&ensp;b&emsp;c&thinsp;d",
  "&zwnj; e &zwj;",
  "&lrm;testo misto&rlm;",

  // --- e commerciali che entità non sono
  "Tizio & Caio",
  "AT&T",
  "R&D",
  "&",
  "&&",
  "&;",
  "&#;",
  "&#x;",
  "&123;",
  "& amp;",
  "a &nonesiste; b",
  "&amp;lt; resta scritto",
  "&amp;amp;",

  // --- misti
  "50&nbsp;&euro; &mdash; sconto del 50%",
  "&copy; 2026 &mdash; tutti i diritti riservati",
  "niente entita qui",
  "",
];

/**
 * Le differenze volute rispetto al browser, ognuna con il suo perché. Il test verifica che
 * siano ancora esattamente queste: che il nostro risultato sia quello dichiarato, e che
 * l'oracolo la pensi davvero diversamente — una divergenza che si risolve da sola smette di
 * essere una nota e diventa una riga da cancellare.
 */
export const ENTITA_DIVERGENTI = [
  {
    sorgente: "&alpha; e &Omega;",
    nostro: "&alpha; e &Omega;",
    perche: "fuori tabella: l'alfabeto greco non entra in un testo tradotto abbastanza spesso da spedirlo a tutti",
  },
  {
    sorgente: "&starf; e &check;",
    nostro: "&starf; e &check;",
    perche: "fuori tabella: simboli decorativi, per cui esiste già il carattere vero",
  },
  {
    sorgente: "a &amp b",
    nostro: "a &amp b",
    perche: "il punto e virgola è obbligatorio: è la stessa regola per cui il browser legge `&notthing` come `¬thing`",
  },
  {
    sorgente: "&notthing",
    nostro: "&notthing",
    perche: "senza punto e virgola: qui si vede perché la regola del browser, dentro una traduzione, è un guaio",
  },
];
