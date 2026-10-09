// Overall architecture: doc/structure.md § "Fase 1 — Precompilazione", "Il file di lingua prodotto".
// That document is the source of truth on how the library works: if you change this file's
// behavior, update it in the same commit.

import crypto from "crypto";
import pathCmd from "path";
import { syncIo } from "./syncIo.js";
import { SyncError } from "./syncError.js";

const RENAME_RETRY_CODES = new Set(["EPERM", "EBUSY", "EACCES"]);
const RENAME_RETRY_WAITS_MS = [25, 50, 100, 200];

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Replaces a language table with `text` through a temporary file and a rename, so a crash or a
 * full disk never leaves a half-written table behind.
 *
 * `expected` is the snapshot taken when the file was read (see readLanguageForSync): right before
 * the rename the file is compared with it, and a file edited in the meantime is NOT overwritten
 * (`VT_FILE_CHANGED`).
 *
 * Limits, on purpose: atomic per file only (no multi-file transaction), no power-loss guarantee
 * (no fsync), and the check is optimistic — a race window remains between the comparison and the
 * rename, and there is no cross-process lock. A rename breaks hard links and does not keep the
 * owner (uid/gid) of a file owned by another user.
 *
 * @param {string} filePath
 * @param {string} text
 * @param {{ kind: "absent" } | { kind: "file", bytes: Buffer, realPath: string, mode: number }} expected
 * @throws {SyncError} VT_FILE_CHANGED | VT_WRITE_FAILED
 */
export default function replaceFileAtomic(filePath, text, expected) {
  const target = expected.kind === "file" ? expected.realPath : filePath; // a link stays, its target is replaced
  const dir = pathCmd.dirname(target);
  const base = pathCmd.basename(target);
  // The leading dot and the missing ".yml" ending keep it out of isLanguageFileName, the
  // compile-locale filter and the dev watcher.
  const tempName = () => pathCmd.join(dir, `.${base}.vt-tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`);

  let tmp = null;
  try {
    let fd;
    for (let attempt = 1; ; attempt++) {
      const candidate = tempName();
      try {
        fd = syncIo.openSync(candidate, "wx", 0o666);
        tmp = candidate;
        break;
      } catch (e) {
        if (e.code !== "EEXIST" || attempt >= 5) throw e;
      }
    }
    try {
      const data = Buffer.from(text, "utf8");
      let offset = 0;
      while (offset < data.length) offset += syncIo.writeSync(fd, data, offset, data.length - offset);
    } finally {
      syncIo.closeSync(fd);
    }

    if (expected.kind === "file") {
      try {
        syncIo.chmodSync(tmp, expected.mode); // the openSync mode is masked by umask
      } catch (e) {
        if (syncIo.platform !== "win32") throw e;
      }
    }

    for (let attempt = 0; ; attempt++) {
      // A retry may follow an editor save during the wait. Recheck before EVERY attempt;
      // only the unavoidable gap between this check and rename remains.
      checkUnchanged(filePath, target, expected);
      try {
        syncIo.renameSync(tmp, target);
        break;
      } catch (e) {
        const wait = RENAME_RETRY_WAITS_MS[attempt];
        // Editors and antivirus software hold files open on Windows: a short retry there.
        if (syncIo.platform !== "win32" || !RENAME_RETRY_CODES.has(e.code) || wait === undefined) throw e;
        sleep(wait);
      }
    }
  } catch (e) {
    if (tmp !== null) {
      try { syncIo.unlinkSync(tmp); } catch { /* the temporary file may be gone already */ }
    }
    if (e instanceof SyncError) throw e;
    throw new SyncError("VT_WRITE_FAILED",
      `cannot write '${filePath}': ${e.message}. The table was not replaced.`,
      { filePath, cause: e });
  }
}

function changed(filePath) {
  return new SyncError("VT_FILE_CHANGED",
    `'${filePath}' changed after it was read, so it was not overwritten. Run again once the other edit is done.`,
    { filePath });
}

function checkUnchanged(filePath, target, expected) {
  if (expected.kind === "absent") {
    let exists = true;
    try { syncIo.lstatSync(filePath); } catch (e) { if (e.code === "ENOENT") exists = false; else throw e; }
    if (exists) throw changed(filePath);
    return;
  }
  let real;
  try {
    real = syncIo.realpathSync(filePath);
  } catch (e) {
    if (e.code === "ENOENT") throw changed(filePath);
    throw e;
  }
  if (real !== expected.realPath) throw changed(filePath);
  let current;
  try {
    current = syncIo.readFileSync(target);
  } catch (e) {
    if (e.code === "ENOENT") throw changed(filePath);
    throw e;
  }
  if (!current.equals(expected.bytes)) throw changed(filePath);
}
