// La seconda sonda: elenca le voci marcate di UN progetto, file per file, con la loro riga. Qui
// solo l'ingresso del processo; il lavoro è in markedScan.mjs.
//
// Gira in un processo figlio come probe.mjs, e per la stessa ragione di fondo: usa il codice del
// progetto. Qui non il vite.config ma la libreria installata (vedi markedScan.mjs). Due modi:
//
//   - con argv[2]: risponde una volta sola e esce, come probe.mjs (i test, le prove a mano).
//     argv[2] = JSON { baseDir, srcDir, localeDir, sourceLanguage, autoWrap } come li ha risolti
//     probe.mjs; baseDir assoluto o relativo alla cwd (la cartella del progetto);
//   - senza argomenti, con il canale IPC: fa da worker per scanWorker.mjs. Riceve
//     `{ id, input, overlay }`, risponde `{ id, ...risposta, babel }`, una richiesta alla volta,
//     finché chi l'ha lanciato non lo chiude (o se ne va: `disconnect`). Quanto restare vivo lo
//     decide scanWorker.mjs, da `babel`: un processo che non ha caricato Babel non vale niente.
import { createScanner } from "./markedScan.mjs";

function rispondi(messaggio) {
  if (process.send) process.send(messaggio, () => process.exit(0));
  else {
    process.stdout.write(JSON.stringify(messaggio) + "\n");
    process.exit(0);
  }
}

const scanner = createScanner();

if (process.argv[2] !== undefined) {
  let input;
  try {
    input = JSON.parse(process.argv[2]);
  } catch (error) {
    rispondi({ ok: false, code: null, error: `bad input: ${error.message}` });
  }
  if (input) rispondi({ ...(await scanner.scan(input, {})), babel: scanner.babel });
} else if (process.send) {
  let coda = Promise.resolve();
  process.on("message", (m) => {
    coda = coda.then(async () => {
      const risposta = await scanner.scan(m?.input ?? {}, m?.overlay ?? {});
      if (process.connected) process.send({ ...risposta, id: m?.id, babel: scanner.babel });
    });
  });
  process.on("disconnect", () => process.exit(0));
} else {
  rispondi({ ok: false, code: null, error: "usage: markedProbe.mjs '<json input>'" });
}
