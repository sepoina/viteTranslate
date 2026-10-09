// Overall architecture: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// That document is the source of truth on how the library works: if you change this file's
// behavior, update it in the same commit.

import fs from "fs";

// Every filesystem call on the table read/backup/write path goes through this object, so a test
// can replace one function and restore it in `finally`. Production code never mutates it.
export const syncIo = {
  readFileSync: fs.readFileSync, writeFileSync: fs.writeFileSync, openSync: fs.openSync,
  writeSync: fs.writeSync, closeSync: fs.closeSync, renameSync: fs.renameSync,
  unlinkSync: fs.unlinkSync, chmodSync: fs.chmodSync, realpathSync: fs.realpathSync,
  lstatSync: fs.lstatSync, statSync: fs.statSync,
  platform: process.platform,
};
