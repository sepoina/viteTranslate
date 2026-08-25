// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

import fs from "fs";
import pathCmd from "path";
import { isLanguageFileName } from "./languageFileFormat.js";

/**
 * I FILE dentro `dir`, ordinati. Solo i file: niente sottocartelle, niente socket, niente
 * link rotti.
 *
 * Il filtro sul tipo è il motivo per cui questa funzione esiste invece di un `readdirSync`
 * sparso in cinque punti. `readdirSync` restituisce dei NOMI, e un nome non dice cosa c'è
 * dietro: una cartella chiamata "fr-FR.yml" — che nasce da un `mkdir` sbagliato o da un
 * archivio scompattato male — passava ogni controllo, diventava una lingua a tutti gli
 * effetti, e falliva solo al momento di leggerla, con un EISDIR in mezzo a un messaggio che
 * parlava di sintassi. Chiederlo qui costa niente: `withFileTypes` è la stessa syscall.
 *
 * @param {string} dir
 * @returns {string[]} i nomi, non i percorsi
 * @throws {Error} se la cartella non si legge: è uno stato che ogni chiamante racconta a modo
 *   suo (per il plugin è un errore, per `--status` è la notizia stessa), quindi non si
 *   decide qui.
 */
export function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => isRegularFile(entry, dir))
    .map((entry) => entry.name)
    .sort();
}

/**
 * I file di lingua dentro `dir`: quelli e basta, ordinati.
 *
 * @param {string} dir
 * @returns {string[]} i nomi, non i percorsi
 */
export default function listLanguageFiles(dir) {
  return listFiles(dir).filter(isLanguageFileName);
}

/**
 * `withFileTypes` su un link simbolico dice "link", non "file": seguirlo è un secondo accesso
 * al disco e si fa solo per quei pochi. Un file di lingua linkato da un'altra cartella è una
 * cosa che in un monorepo si vede, e scartarlo perché è un link sarebbe una regola inventata
 * qui; un link ROTTO invece va scartato — è un file che non c'è.
 */
function isRegularFile(entry, dir) {
  if (entry.isFile()) return true;
  if (!entry.isSymbolicLink()) return false;
  try {
    return fs.statSync(pathCmd.join(dir, entry.name)).isFile();
  } catch {
    return false;
  }
}
