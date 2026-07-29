// Architettura d'insieme: doc/structure.md § "Fase 2 — Compilazione", "Il dialetto HTML, in un posto solo".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
// Vincolo dichiarato lì in § "Invarianti da non rompere", punto 2.

// Il sottoinsieme di HTML ammesso dentro una stringa tradotta, in un posto solo.
//
// Le stesse liste servivano a due lettori diversi — il parser a build time
// (lib/dev/compile/parseMarkup.js) e quello a runtime sul DOM (lib/react/basicHtmlToNodes.js) —
// e stavano scritte a mano in entrambi, con un commento che chiedeva di tenerle allineate.
// Due sorgenti di verità per la stessa regola: la prima divergenza avrebbe prodotto un testo
// che si comporta in un modo in sviluppo e in un altro nel bundle, senza che nulla lo segnali.
//
// Il file non importa nulla e non dipende né da React né da Node: entrambi i lati lo prendono
// così com'è.

/** Tag di formattazione conservati. Qualunque altro tag viene sciolto, mantenendone il contenuto. */
export const ALLOWED_TAGS = new Set(["br", "b", "hr", "strong", "i", "em", "u", "small", "code", "wbr"]);

/** Sottoinsieme dei precedenti che non può avere figli. */
export const VOID_TAGS = new Set(["br", "wbr", "hr"]);

/**
 * Riconosce a colpo d'occhio se una stringa contiene qualcosa da parsare: un tag QUALSIASI,
 * un commento o un'entità HTML. Serve come pre-scarto, non come validazione — chi la usa
 * risparmia il parsing sulla grande maggioranza dei testi, che markup non ne hanno.
 *
 * Deve riconoscere anche i tag NON ammessi, che è la parte controintuitiva. Il dialetto dice
 * che un tag fuori lista viene sciolto conservandone il contenuto (`<div>ciao</div>` ->
 * `ciao`): se il pre-scarto guardasse solo i tag ammessi, una stringa che contiene soltanto
 * `<div>` non entrerebbe mai nel parser e quei tag finirebbero a schermo alla lettera —
 * l'opposto di ciò che il dialetto promette, e in disaccordo con il parser di build, che
 * invece li scioglie sempre. Stesso motivo per i commenti e per le entità esadecimali, che
 * la versione precedente non contemplava.
 */
export const HAS_HTML_RE = /<\/?[a-zA-Z]|<!--|&[a-zA-Z][a-zA-Z0-9]*;|&#\d+;|&#[xX][0-9a-fA-F]+;/;
