// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Un gruppo di righe di log che si riscrive sul posto, in fondo al terminale: la meccanica del
// pannello delle richieste (requestPanel.js), senza sapere niente di modelli né di costi.
//
// È l'unico punto della libreria che muove il cursore, e per questo l'unico che scrive su
// `stream` direttamente invece di passare da `logEchoColored`. Le righe però sono righe di log
// vere — le formatta `logLineRows` di lib/utility.js, con gli stessi prefissi — così quando la
// regione lascia il posto al log definitivo non si sposta niente.

import { logLineRows, logTextWidth, LOG_WIDTH } from "../../utility.js";

// "N righe su". Mai con N = 0: per un terminale il parametro 0 vale 1 (il default di VT100), e
// risalire di una riga che non è nostra vuol dire cancellare quella di qualcun altro.
const su = (n) => (n > 0 ? `\x1b[${n}A` : "");
const CANCELLA_RIGA = "\x1b[2K";
const CANCELLA_SOTTO = "\x1b[0J";

/**
 * Vero se `stream` è un terminale che capisce le sequenze di cursore. Una pipe, un file, il
 * log di una CI non lo sono: lì la regione non nasce, e resta solo il log finale.
 *
 * @param {{ isTTY?: boolean }} [stream]
 * @param {object} [env]
 */
export function isLiveTerminal(stream = process.stdout, env = process.env) {
  return Boolean(stream?.isTTY) && env.TERM !== "dumb";
}

/**
 * Parte subito: disegna, poi ridisegna a ogni `update()` e comunque una volta ogni
 * `intervalMs`, finché non si chiama `stop()`, che la cancella.
 *
 * @param {{
 *   render: (p: { tick: number, maxLines: number, width: number }) => string[],
 *   label?: string,
 *   stream?: { write(s: string): unknown, columns?: number, rows?: number },
 *   intervalMs?: number,
 *   patchConsole?: boolean,
 * }} p
 *   `render` restituisce il testo delle righe, al più `maxLines`: quali tenere quando non ci
 *   stanno tutte lo decide chi sa cosa sono. `width` è quanto è largo il testo di una riga in
 *   questo terminale, adesso: oltre si tronca. `tick` avanza di uno a ogni giro del timer, non a
 *   ogni `update()`: è l'orologio di uno spinner, e deve andare a passo costante. `label` è
 *   l'etichetta della prima riga, come la prima riga di un blocco di log.
 * @returns {{ update(): void, stop(): void }}
 */
export default function createLiveRegion({
  render, label = "", stream = process.stdout, intervalMs = 1000, patchConsole = stream === process.stdout,
}) {
  let disegnate = 0; // righe di terminale scritte dall'ultimo disegno: quante risalire al prossimo
  let tick = 0;
  let ferma = false;

  const togli = () => {
    if (disegnate > 0) stream.write(`${su(disegnate)}\r${CANCELLA_SOTTO}`);
    disegnate = 0;
  };

  const disegna = () => {
    if (ferma) return;
    // Una colonna in meno del terminale: scrivere fino all'ultima lascia il cursore "a capo in
    // sospeso", e più di un terminale lo risolve con una riga vuota in più — che sfasa il conto.
    const larghezza = Math.min(LOG_WIDTH, (stream.columns || LOG_WIDTH) - 1);
    // Mai più alta dello schermo: una riga uscita dal bordo in alto non si raggiunge più col
    // cursore, e ogni ridisegno ne lascerebbe una copia nello scrollback.
    const altezza = Math.max(1, (stream.rows || 24) - 1);
    const perEtichetta = logLineRows(label, "", "normale", larghezza).length - 1;
    const righe = render({ tick, maxLines: Math.max(1, altezza - perEtichetta), width: logTextWidth(larghezza) })
      .flatMap((testo, i) => logLineRows(i === 0 ? label : "", testo, "normale", larghezza));
    // Un solo `write` per disegno: il terminale non mostra mai metà regione vecchia e metà nuova.
    let out = `${su(disegnate)}\r`;
    for (const r of righe) out += `${CANCELLA_RIGA}${r}\n`;
    stream.write(out + CANCELLA_SOTTO);
    disegnate = righe.length;
  };

  // Chi stampa mentre la regione è viva — un avviso della trace di --llm-debug, un console.log
  // dentro un `llm.driver` scritto dall'utente — finisce sopra di lei: si toglie la regione, si
  // stampa, si ridisegna. Senza, la riga nuova cadrebbe in mezzo alle nostre e il ridisegno
  // successivo ne cancellerebbe un pezzo.
  const originali = {};
  if (patchConsole) {
    for (const nome of ["log", "info", "warn", "error"]) {
      originali[nome] = console[nome];
      console[nome] = (...args) => {
        togli();
        originali[nome](...args);
        disegna();
      };
    }
  }

  const timer = setInterval(() => {
    tick++;
    disegna();
  }, intervalMs);
  // La regione non è un motivo per tenere vivo il processo: le richieste in volo lo sono già.
  timer.unref?.();
  disegna();

  return {
    update: disegna,
    stop() {
      if (ferma) return;
      ferma = true;
      clearInterval(timer);
      togli();
      Object.assign(console, originali);
    },
  };
}
