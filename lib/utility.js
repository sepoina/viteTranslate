// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

// Estratto da private/viteScripts/utility.js: unica funzione (+ helper) usata dal plugin di traduzione.

export function fit(s, length) {
    if (!Number.isFinite(length) || length < 0) return "";
    if (length === 0) return "";
    if (length === 1) return "…"; // non c’è spazio per altro
    const seg = (globalThis).Intl?.Segmenter
        ? new Intl.Segmenter("it", { granularity: "grapheme" })
        : null;
    const units = seg
        ? Array.from(seg.segment(s), (x) => x.segment)
        : Array.from(s); // fallback: codepoint
    if (units.length > length) {
        return units.slice(0, length - 1).join("") + "…";
    }
    return units.join("") + " ".repeat(length - units.length);
}

/**
 * Gli intervalli che nel terminale occupano DUE colonne pur essendo un carattere solo (CJK,
 * hangul, kana, forme "fullwidth"). Contarli uno solo sfalsa gli allineamenti proprio sulle
 * lingue per cui questa libreria esiste: "中文（中国）" è lungo 6 e largo 12.
 */
const WIDE_RE = /[ᄀ-ᅟ⺀-꓏ꥠ-꥿가-힣豈-﫿︐-︙︰-﹯＀-｠￠-￦]/;

/** Le sequenze di colore: occupano zero colonne, e vanno tolte prima di contare. */
const ANSI_RE = /\x1b\[[0-9;]*m/g;

/**
 * Quante colonne di terminale occupa una stringa. Le sequenze ANSI non contano: senza toglierle
 * una cella colorata risulterebbe larga il doppio, e a sfasarsi sarebbe la tabella intera.
 */
export const displayWidth = (s) =>
    [...String(s).replace(ANSI_RE, "")].reduce((n, c) => n + (WIDE_RE.test(c) ? 2 : 1), 0);

/** Larghezza totale della riga di log, gutter compreso. */
export const LOG_WIDTH = 100;

const LABEL = 20;
// ":::" + spazio + etichetta + " ║  ": la colonna in cui comincia il testo.
const GUTTER = 3 + 1 + LABEL + 4;

// Dove cade il montante, contando da inizio riga: ":::" + spazio + etichetta + spazio.
// Il "║" delle righe di testo e il "╟" delle traverse stanno entrambi qui.
const MONTANTE = 3 + 1 + LABEL + 1;

/**
 * Quanto è lungo il filetto della traversa: tutto quello che resta dopo il montante.
 *
 * Calcolato e non scritto a mano. Erano due numeri indipendenti, e il primo che ha spostato
 * `LOG_WIDTH` li ha fatti divergere: con 76 su una riga da 100 la traversa misurava 102
 * colonne e sfondava il riquadro, cioè rompeva l'unica cosa che l'incolonnamento deve
 * garantire — proprio la riga che serve a dare struttura al resto.
 */
const RULE_WIDTH = LOG_WIDTH - MONTANTE - 1;

/** Le colonne disponibili per il testo, dopo il gutter: quello con cui fare i conti. */
export const TEXT_WIDTH = LOG_WIDTH - GUTTER;
// Le righe di continuazione rientrano di due, altrimenti una riga spezzata sarebbe
// indistinguibile da un messaggio nuovo che comincia lì.
const HANG = 2;

/**
 * Manda a capo un testo dentro la colonna del log, restituendo le righe già suddivise.
 * Va a capo sugli spazi; una parola più lunga della colonna (un percorso, un id) viene
 * spezzata di forza, perché l'alternativa è sfondare la larghezza e perdere l'allineamento
 * proprio sui messaggi lunghi, che sono quelli per cui l'allineamento serve.
 *
 * @param {string} text - gli "\n" già presenti restano a capo dove sono
 * @param {number} [first] - colonne disponibili sulla prima riga
 * @param {number} [rest] - colonne disponibili su quelle dopo
 * @returns {string[]}
 */
export function wrapLog(text, first = LOG_WIDTH - GUTTER, rest = LOG_WIDTH - GUTTER - HANG) {
    const righe = [];
    const limite = () => (righe.length === 0 ? first : rest);
    for (const paragrafo of String(text).split("\n")) {
        // Ci sta tutto: si passa com'è, spazi interni compresi. Non è un'ottimizzazione — è
        // l'unico modo di far sopravvivere una riga incolonnata a mano, come quelle del
        // rapporto di --status: il ciclo qui sotto ragiona a parole e riduce ogni sequenza di
        // spazi a uno solo, che su una tabella vuol dire sfasciarla.
        if (displayWidth(paragrafo) <= limite()) {
            righe.push(paragrafo);
            continue;
        }
        let corrente = "";
        for (const parola of paragrafo.split(/ +/)) {
            let pezzo = parola;
            // Parola più larga della colonna: si taglia finché non ci sta.
            while (displayWidth(pezzo) > limite()) {
                if (corrente) { righe.push(corrente); corrente = ""; }
                const unita = [...pezzo];
                let quante = 0, larghezza = 0;
                while (quante < unita.length && larghezza + displayWidth(unita[quante]) <= limite()) {
                    larghezza += displayWidth(unita[quante]);
                    quante++;
                }
                righe.push(unita.slice(0, quante).join(""));
                pezzo = unita.slice(quante).join("");
            }
            const candidata = corrente ? `${corrente} ${pezzo}` : pezzo;
            if (displayWidth(candidata) > limite()) {
                righe.push(corrente);
                corrente = pezzo;
            } else {
                corrente = candidata;
            }
        }
        righe.push(corrente);
    }
    return righe;
}

const VERDE = "\x1b[32m";
const TENUE = "\x1b[2m";
const FINE = "\x1b[0m";

/**
 * Come si veste l'etichetta nella colonna di sinistra. Le righe normali restano tenui — sono
 * il rumore di fondo di una sincronizzazione andata bene — mentre WARNING e ERROR sono le due
 * che vanno trovate scorrendo l'output con l'occhio, senza leggerlo.
 *
 * L'arancione è a 256 colori: il giallo di base è lo stesso di troppe altre cose in un
 * terminale, e la distanza fra "attenzione" e "errore" va vista prima di leggere la parola.
 */
const STILE = {
    normale: (s) => `${TENUE}${s}${FINE}`,
    // Giallo semplice, non l'arancione acceso di "warning": serve a NOMINARE il soggetto di
    // una riga (un file, una lingua), non a dire che c'è un problema. Tenere separate le due
    // cose è quello che permette all'arancione di voler dire una cosa sola.
    nome: (s) => `\x1b[33m${s}${FINE}`,
    ok: (s) => `${VERDE}${s}${FINE}`,
    warning: (s) => `\x1b[1;38;5;208m${s}${FINE}`,
    error: (s) => `\x1b[1;31m${s}${FINE}`,
};

/**
 * Una riga di log nella colonna del comando. Il testo che non ci sta prosegue sotto,
 * incolonnato: prima usciva per intero su una riga sola, e un messaggio lungo — un percorso
 * assoluto, il testo di un marcatore — rompeva l'unica cosa che rende leggibile l'output di
 * una sincronizzazione, cioè che tutti i messaggi comincino nello stesso punto.
 */
function riga(etichetta, stile, text) {
    const [prima, ...dopo] = wrapLog(text);
    console.log(`${VERDE}:::${FINE}${TENUE} ${FINE}${STILE[stile](fit(etichetta, LABEL))}${TENUE} ║  ${FINE}${prima}`);
    for (const r of dopo) {
        console.log(`${VERDE}:::${FINE}${TENUE} ${" ".repeat(LABEL)} ║  ${FINE}${" ".repeat(HANG)}${r}`);
    }
}

/**
 * @param {string} msg - l'etichetta nella colonna di sinistra
 * @param {string} text
 * @param {"normale"|"ok"|"warning"|"error"} [stile] - come si accende l'etichetta. Serve a chi
 *   ha una colonna di righe con esiti diversi (il rapporto di --status): la parola in colonna
 *   è già l'identificativo della riga, e colorarla evita di aggiungere una colonna di simboli
 *   che direbbe la stessa cosa.
 */
export function logEchoColored(msg, text, stile = "normale") {
    riga(msg, stile, text);
}

/**
 * Accende un pezzo di testo con uno degli stili del log. Serve a chi ha una colonna dentro il
 * testo — il codice di lingua nel rapporto di --status — invece che nell'etichetta: l'etichetta
 * dice quale parte del comando sta parlando, e un dato non è quella cosa lì.
 *
 * @param {"normale"|"nome"|"ok"|"warning"|"error"} stile
 * @param {string} testo
 */
export const colorize = (stile, testo) => (STILE[stile] ?? STILE.normale)(testo);

/** La riga vuota che apre un blocco: la colonna resta, il testo no. */
const stacco = () => riga("", "normale", "");

/**
 * La traversa che separa due blocchi: `╟` sul montante — stessa colonna del `║`, così la
 * verticale non si spezza — e un filetto a destra.
 *
 * È l'alternativa alla riga vuota per separare: dentro un output fatto di righe tutte uguali,
 * uno stacco vuoto si confonde con la riga vuota che apre un avviso, mentre una traversa si
 * vede per quello che è — la fine di una cosa e l'inizio di un'altra. L'etichetta a sinistra
 * resta disponibile perché la PRIMA traversa di un blocco è anche il posto dove nominarlo.
 *
 * @param {string} [etichetta] - il nome del blocco che si apre, se ne ha uno
 * @param {"normale"|"nome"|"ok"|"warning"|"error"} [stile]
 */
export function logRule(etichetta = "", stile = "normale") {
    console.log(
        `${VERDE}:::${FINE}${TENUE} ${FINE}${STILE[stile](fit(etichetta, LABEL))}` +
        `${TENUE} ╟${"─".repeat(RULE_WIDTH)}${FINE}`
    );
}

/**
 * L'intestazione del comando: nome sulla traversa che apre, versione nella colonna
 * dell'etichetta, e sotto la riga che dice su quali cartelle si sta lavorando.
 *
 * La versione sta qui e in nessun altro punto dell'output. È l'informazione che serve una
 * volta sola — quando quello che si vede a schermo non torna con quello che dice la
 * documentazione — e metterla in cima costa una riga che c'era già.
 *
 * @param {string} nome - come si chiama il comando
 * @param {string} versione - già formattata ("v4.0.2"); stringa vuota per ometterla
 * @param {string} testo
 */
export function logHeader(nome, versione, testo) {
    logRule(nome);
    // Il glifo accompagna la versione, non la colonna: senza numero da mostrare resterebbe
    // un simbolo solo in mezzo al vuoto, che si legge come un dato mancante invece che come
    // una riga che non ha nulla da dire.
    riga(versione ? `⌘ ${versione}` : "", "normale", testo);
    logRule();
}

/**
 * L'apertura di un blocco di avviso: una riga vuota sopra e l'etichetta accesa. Lo stacco fa
 * parte del segnale quanto il colore — dentro venti righe tutte uguali di una sincronizzazione,
 * è quello che si vede scorrendo senza leggere. Le righe di dettaglio che seguono restano
 * `logEchoColored("", …)`, così il blocco si legge come una cosa sola.
 *
 * @param {string} text
 * @param {{ stacco?: boolean }} [opts] - `stacco: false` dove a separare c'è già una traversa:
 *   due separatori di fila sono uno spreco di righe e un segnale più debole, non più forte.
 */
export function logWarning(text, { stacco: conStacco = true } = {}) {
    if (conStacco) stacco();
    riga("WARNING", "warning", text);
}

/** Come logWarning, per ciò che è andato storto e non solo storto-ma-recuperato. */
export function logError(text, { stacco: conStacco = true } = {}) {
    if (conStacco) stacco();
    riga("ERROR", "error", text);
}
