// I file temporanei dei test che devono stare accanto ai moduli sotto prova (lib/react,
// lib/dev/compile, questa cartella): gli import relativi di quei moduli devono risolversi, quindi
// non possono stare in tmpdir. Non è un test (il nome non finisce in .test.mjs): il lanciatore
// non lo esegue.
//
// Cancellarli bene conta: un file rimasto in lib/ finirebbe nel pacchetto npm. Su Windows un file
// appena scritto può restare bloccato un attimo (l'antivirus, l'indicizzatore dell'editor): si
// riprova con un'attesa crescente, e un file già sparito non è un errore. Se non basta lo si dice
// con una riga "  KO  " (la conta run.mjs) e il test esce con 1, anche se poi chiama
// process.exit(0): un silenzio, qui, era il difetto.
//
// Il ritentativo è nostro e non `maxRetries` di rmSync: su Node 24 (Windows) rmSync risponde
// EPERM a un file aperto da un altro processo e non riprova affatto, nemmeno con retryDelay alto
// (verificato: fallisce in 0 ms). La versione asincrona riprova davvero, ma qui non serve: si
// cancella nell'handler di "exit", dove si può solo restare sincroni.
import { rmSync } from "node:fs";

// I codici con cui Windows dice "aperto da qualcun altro": EBUSY da unlinkSync, EPERM da rmSync.
const BLOCCATO = new Set(["EBUSY", "EPERM"]);
// Attese di 50, 100, ... 450 ms: poco più di 2 s nel caso peggiore, per file.
const TENTATIVI = 10;
const PASSO_MS = 50;

// Sospende il thread senza busy loop: Atomics.wait sul thread principale è permesso in Node.
const attendi = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function cancella(percorso) {
  for (let tentativo = 1; ; tentativo++) {
    try {
      rmSync(percorso, { force: true });
      return;
    } catch (error) {
      if (tentativo >= TENTATIVI || !BLOCCATO.has(error?.code)) throw error;
      attendi(tentativo * PASSO_MS);
    }
  }
}

let rimastiInTutto = 0;
// process.exit(0) rimette a 0 il codice d'uscita: lo si rialza qui, l'ultima cosa che succede.
process.on("exit", () => {
  if (rimastiInTutto) process.exitCode = 1;
});

/**
 * Cancella i file. Quelli che restano li annuncia come KO, e il test uscirà con 1.
 *
 * @param {Iterable<string | URL>} percorsi
 * @returns {number} quanti ne sono rimasti
 */
export function rimuoviTemporanei(percorsi) {
  let rimasti = 0;
  for (const p of percorsi) {
    try {
      cancella(p);
    } catch (error) {
      rimasti++;
      console.log("  KO  ", `file temporaneo rimasto: ${p} (${error?.code ?? error?.message ?? error})`);
    }
  }
  rimastiInTutto += rimasti;
  if (rimasti) process.exitCode = 1;
  return rimasti;
}

/**
 * Un elenco di file temporanei che si cancellano all'uscita del processo, qualunque sia la via
 * (anche process.exit): ci si aggiunge con push.
 *
 * @returns {string[]}
 */
export function temporaneiAllUscita() {
  const elenco = [];
  process.on("exit", () => rimuoviTemporanei(elenco));
  return elenco;
}
