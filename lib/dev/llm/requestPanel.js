// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// Le richieste al modello, una riga per connessione. Su un terminale le righe sono vive
// (liveRegion.js): uno spinner che avanza una volta al secondo finché la risposta non arriva,
// poi l'esito al suo posto. Quando si chiude, la regione lascia il posto allo stesso elenco
// scritto come log vero, con accanto a ogni riga quanto è costata. Senza un terminale — una
// pipe, una CI — si vede solo quel log, alla fine.
//
//   ⠹ > ask 6 keys italiano - Deutsch                                      3s
//   ✔ < 6 new keys American English. Full translate!                       2s
//   ✖ - error 日本語 (HTTP 401). see trace in debug mode!                   4s

import { logEchoColored, colorize, displayWidth, clipToWidth } from "../../utility.js";
import { nomeLingua } from "../vite/uty/syncReport.js";
import createLiveRegion, { isLiveTerminal } from "./liveRegion.js";

// Lo spinner braille, un fotogramma al secondo: è anche un contasecondi.
const SPINNER = [..."⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"];
const FATTO = "✔";
const FALLITO = "✖";
// Nel log finale, al posto dello spinner, per una richiesta che non ha mai avuto risposta: un
// fotogramma fermo direbbe "sta ancora girando" in un testo che non gira più.
const SOSPESO = "·";

const quanti = (n, cosa) => `${n} ${cosa}${n === 1 ? "" : "s"}`;

/**
 * Perché una richiesta è fallita, in due parole — il messaggio intero sta nella trace di
 * `--llm-debug`, ed è lì che la riga rimanda. `null` quando non c'è niente di più preciso di
 * "error" da dire (un `llm.driver` che lancia un errore suo).
 *
 * @param {{ status?: number, message?: string } | undefined} error
 * @returns {string | null}
 */
export function shortReason(error) {
  if (error?.status) return `HTTP ${error.status}`;
  const message = String(error?.message ?? "");
  if (/timeout/i.test(message)) return "timeout";
  if (/not (a )?JSON/i.test(message)) return "reply not JSON";
  if (/fetch failed|ECONN|ENOTFOUND|EAI_AGAIN/i.test(message)) return "network error";
  return null;
}

/**
 * `destra` contro il bordo della colonna, `sinistra` al suo inizio: le colonne restano ferme
 * mentre le righe cambiano, invece di inseguire la riga più lunga del momento. Solo la regione
 * viva lo usa: una riga che si riscrive non può andare a capo, quindi una `sinistra` troppo lunga
 * si tronca.
 */
function alDestra(sinistra, destra, larghezza) {
  const testo = clipToWidth(sinistra, Math.max(1, larghezza - displayWidth(destra) - 2));
  return `${testo}${" ".repeat(Math.max(2, larghezza - displayWidth(testo) - displayWidth(destra)))}${destra}`;
}

/**
 * @param {{
 *   sourceTag: string, tags?: string[],
 *   traced?: boolean, stream?: object, live?: boolean, now?: () => number,
 *   firstLabel?: string,
 * }} p
 *   `tags`: le lingue di destinazione del run, per nominarle come le nomina la sync (autonimi,
 *   disambiguati fra varianti). `traced`: `--llm-debug` è acceso, e una riga d'errore rimanda
 *   alla trace che c'è già invece di chiedere di rilanciare. `live` e `stream` si passano solo
 *   nei test: di norma la regione vive se e solo se stdout è un terminale. `firstLabel` è
 *   l'etichetta della prima riga del log finale: `""` quando il blocco è già nominato altrove
 *   (la stima di `translatePass`), com'è per il pannello del run.
 * @returns {{
 *   open(p: { kind?: "translate" | "repair" | "context", tag?: string, count: number }): {
 *     retry(info: { retry: number, maxRetries: number, error?: object }): void,
 *     done(result: object, usage?: { tokensIn: number, tokensOut: number } | null): void,
 *     fail(error: object): void,
 *   },
 *   note(text: string): void,
 *   finish(): void,
 * }}
 *   `done` riceve `{ filled, rejected, missing, unknown }` per una traduzione o una riparazione,
 *   `{ lines }` per l'abstract di contesto. `finish` si può chiamare più volte: stampa una volta.
 */
export default function createRequestPanel({
  sourceTag, tags = [], traced = false,
  stream = process.stdout, live = isLiveTerminal(stream), now = Date.now,
  firstLabel = "LLM",
}) {
  const nome = nomeLingua([sourceTag, ...tags]);
  const lingua = (tag) => colorize("nome", nome(tag));
  const voci = [];
  const note = [];
  let regione = null;
  let chiuso = false;

  /**
   * La riga di una richiesta, senza la parte destra. `tick === null`: nel log finale, dove la coda
   * è compatta — `<dettagli> / <secondi>.` — invece della colonna dei costi, che non c'è più. La
   * forma breve sta dentro le colonne di testo anche sui casi lunghi, quindi non va a capo.
   */
  function sinistra(v, tick) {
    const finale = tick === null;
    const soggetto = v.kind === "context" ? "context abstract" : lingua(v.tag);

    if (v.state === "run") {
      const indicatore = finale ? SOSPESO : SPINNER[tick % SPINNER.length];
      const domanda = v.kind === "context"
        ? `ask context abstract from ${quanti(v.count, "string")}`
        : `${v.kind === "repair" ? "repair" : "ask"} ${quanti(v.count, "key")} ${lingua(sourceTag)} - ${lingua(v.tag)}`;
      return `${indicatore} > ${domanda}`;
    }

    if (v.state === "error") {
      const perche = shortReason(v.error);
      const base = `${colorize("error", FALLITO)} - error ${soggetto}${perche ? ` (${perche})` : ""}`;
      const dove = traced ? "see the debug trace" : "see trace in debug mode";
      return finale ? `${base} / ${dove} / ${secondi(v)}.` : `${base}. ${dove}!`;
    }

    const coda = (dettagli) => ` ${dettagli} / ${secondi(v)}.`;

    if (v.kind === "context") {
      const testo = `${colorize("ok", FATTO)} < context abstract, ${quanti(v.result.lines, "line")}`;
      return finale ? `${testo}.${coda("completed")}` : testo;
    }

    const { filled = 0, rejected = 0, missing = 0, unknown = 0 } = v.result ?? {};
    const completo = filled === v.count;
    const resto = [];
    if (rejected) resto.push(`${rejected} ${v.kind === "repair" ? "still rejected" : "rejected"}`);
    if (missing) resto.push(`${missing} not returned`);
    if (unknown) resto.push(`${quanti(unknown, "unknown key")} ignored`);
    const arrivate = v.kind === "repair" ? `${quanti(filled, "key")} repaired` : quanti(filled, "new key");
    // Arancione, non verde, quando del lotto resta qualcosa di non tradotto: la riga è andata a
    // buon fine come richiesta, non come traduzione.
    const base = `${colorize(completo ? "ok" : "warning", FATTO)} < ${arrivate} ${soggetto}.`;
    if (finale) return `${base}${coda(resto.length ? resto.join(" / ") : "completed")}`;
    return `${base}${completo ? " Full translate!" : ""}${resto.length ? ` ${resto.join(", ")}` : ""}`;
  }

  const secondi = (v) => `${Math.floor(((v.endedAt ?? now()) - v.startedAt) / 1000)}s`;

  /**
   * Dal vivo, a destra: i secondi, fermi alla risposta, e il tentativo se si sta riprovando —
   * nella forma più lunga che lascia intera la riga a sinistra. In un terminale stretto il
   * "perché" del retry cede il posto per primo, poi il retry: la richiesta di cui si parla
   * conta più di come sta andando.
   */
  function destraDalVivo(v, libere) {
    const tempo = colorize("normale", secondi(v));
    if (v.state !== "run" || !v.retry) return tempo;
    const { retry, maxRetries, reason } = v.retry;
    const varianti = [
      ...(reason ? [`retry ${retry}/${maxRetries} after ${reason}`] : []),
      `retry ${retry}/${maxRetries}`,
    ].map((testo) => `${colorize("warning", testo)}  ${tempo}`);
    return varianti.find((d) => displayWidth(d) <= libere) ?? tempo;
  }

  /** Le righe dal vivo, al più `maxLines`. Quando non ci stanno tutte, le prime a restare fuori
   *  sono le più vecchie già chiuse: quelle in corso sono le sole che si muovono. */
  function render({ tick, maxLines, width }) {
    let mostrate = voci;
    let nascoste = [];
    if (voci.length > maxLines) {
      const posti = Math.max(0, maxLines - 1); // uno va al riassunto delle nascoste
      const scelte = new Set();
      for (const v of voci) if (v.state === "run" && scelte.size < posti) scelte.add(v);
      for (let i = voci.length - 1; i >= 0 && scelte.size < posti; i--) scelte.add(voci[i]);
      mostrate = voci.filter((v) => scelte.has(v));
      nascoste = voci.filter((v) => !scelte.has(v));
    }
    const righe = mostrate.map((v) => {
      const testo = sinistra(v, tick);
      return alDestra(testo, destraDalVivo(v, width - displayWidth(testo) - 2), width);
    });
    if (nascoste.length) {
      const conta = (stato) => nascoste.filter((v) => v.state === stato).length;
      const parti = [[conta("run"), "running"], [conta("done"), "done"], [conta("error"), "failed"]]
        .filter(([n]) => n > 0)
        .map(([n, cosa]) => `${n} ${cosa}`);
      righe.unshift(colorize("normale", `… ${nascoste.length} more: ${parti.join(", ")}`));
    }
    return righe;
  }

  function open({ kind = "translate", tag, count }) {
    const v = { kind, tag, count, state: "run", startedAt: now(), endedAt: null, retry: null, result: null, usage: null, error: null };
    voci.push(v);
    if (live && !chiuso) {
      regione ??= createLiveRegion({ render, label: "LLM", stream });
      regione.update();
    }
    const chiudi = (state, campi) => {
      if (v.state !== "run") return;
      Object.assign(v, { state, endedAt: now() }, campi);
      regione?.update();
    };
    return {
      retry({ retry, maxRetries, error }) {
        v.retry = { retry, maxRetries, reason: shortReason(error) };
        regione?.update();
      },
      done(result, usage = null) { chiudi("done", { result, usage }); },
      fail(error) { chiudi("error", { error }); },
    };
  }

  function finish() {
    if (chiuso) return;
    chiuso = true;
    regione?.stop();
    regione = null;
    // Una riga di testo semplice, non più una colonna di costi incolonnata a destra: come è
    // finita e in quanto lo dice la coda della frase. Il costo del run è una riga sola in fondo
    // al blocco (`printRunResult`), non una colonna per richiesta.
    voci.forEach((v, i) => logEchoColored(i === 0 ? firstLabel : "", sinistra(v, null)));
    for (const testo of note) logEchoColored("", colorize("warning", testo));
  }

  return { open, note: (testo) => note.push(testo), finish };
}
