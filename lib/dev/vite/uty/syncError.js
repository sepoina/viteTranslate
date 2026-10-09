// Overall architecture: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// That document is the source of truth on how the library works: if you change this file's
// behavior, update it in the same commit.

/**
 * An error of the synchronization with a stable `code`, so callers (CLI, auto-sync, LLM) can
 * tell "the tables were not touched" from "the run stopped half way" without parsing messages.
 *
 * Codes: VT_SCAN_INCOMPLETE, VT_LANGUAGE_UNREADABLE, VT_BACKUP_FAILED, VT_FILE_CHANGED,
 * VT_WRITE_FAILED (see doc/structure.md).
 */
export class SyncError extends Error {
  constructor(code, message, { filePath, paths, written, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "SyncError";
    this.code = code;
    if (filePath !== undefined) this.filePath = filePath;
    if (paths !== undefined) this.paths = paths;
    if (written !== undefined) this.written = written;
  }
}
