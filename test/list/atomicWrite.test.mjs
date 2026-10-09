// replaceFileAtomic (4.7.1, doc/ImplementationPlans/4_7_1.md § S4): a language table is replaced
// through a temporary file and a rename, only if it still holds the bytes that were read.
// Failures are injected through `syncIo`, never through permissions (root ignores them).
//
//   node test/list/atomicWrite.test.mjs
import {
  mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync, chmodSync,
  symlinkSync, lstatSync, readlinkSync, utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import replaceFileAtomic from "../../lib/dev/vite/uty/replaceFileAtomic.js";
import writeLanguageFileIfChanged from "../../lib/dev/vite/uty/writeLanguageFile.js";
import readLanguageForSync from "../../lib/dev/vite/uty/readLanguageForSync.js";
import { isLanguageFileName } from "../../lib/dev/vite/uty/languageFileFormat.js";
import { SyncError } from "../../lib/dev/vite/uty/syncError.js";
import { syncIo } from "../../lib/dev/vite/uty/syncIo.js";
import creaManifest from "../../lib/dev/vite/buildManifest.js";
import migrateLegacyLanguages from "../../lib/dev/vite/uty/migrateLegacyLanguages.js";

let fail = 0;
const eq = (name, expected, got) => {
  const ok = Object.is(expected, got);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", name.padEnd(56), "->", JSON.stringify(got), ok ? "" : `(expected ${JSON.stringify(expected)})`);
};

const temp = [];
const folder = () => {
  const dir = mkdtempSync(join(tmpdir(), "vt-atomic-"));
  temp.push(dir);
  return dir;
};
const ioError = (code, message = code) => Object.assign(new Error(message), { code });
const leftovers = (dir) => readdirSync(dir).filter((f) => f.includes(".vt-tmp-"));

/** Runs `fn` with some `syncIo` members replaced; always restores them. */
function withIo(overrides, fn) {
  const saved = {};
  for (const name of Object.keys(overrides)) saved[name] = syncIo[name];
  Object.assign(syncIo, overrides);
  try {
    return fn();
  } finally {
    Object.assign(syncIo, saved);
  }
}
/** Calls `fn` and returns what it threw (or null). */
function thrown(fn) {
  try { fn(); } catch (e) { return e; }
  return null;
}
/** A file on disk plus the snapshot `readLanguageForSync` would take of it. */
function fileWithSnapshot(dir, name, content) {
  const filePath = join(dir, name);
  writeFileSync(filePath, content);
  return { filePath, snapshot: readLanguageForSync(filePath).snapshot };
}

console.log("\n== replacement: an existing file, an empty one, an absent one ==");
{
  const dir = folder();
  const { filePath, snapshot } = fileWithSnapshot(dir, "en-US.yml", "old\n");
  replaceFileAtomic(filePath, "new\n", snapshot);
  eq("existing file: new content", "new\n", readFileSync(filePath, "utf8"));
  eq("no temporary file left", 0, leftovers(dir).length);

  const empty = fileWithSnapshot(dir, "fr-FR.yml", "");
  eq("an empty file is a `file` snapshot", "file", empty.snapshot.kind);
  replaceFileAtomic(empty.filePath, "filled\n", empty.snapshot);
  eq("existing empty file: filled", "filled\n", readFileSync(empty.filePath, "utf8"));

  const absent = join(dir, "de-DE.yml");
  replaceFileAtomic(absent, "created\n", { kind: "absent" });
  eq("absent file: created", "created\n", readFileSync(absent, "utf8"));
  eq("no temporary file left (absent)", 0, leftovers(dir).length);

  const long = "x".repeat(300000) + "è\n";
  replaceFileAtomic(filePath, long, readLanguageForSync(filePath).snapshot);
  eq("a long UTF-8 text is written whole", true, long === readFileSync(filePath, "utf8"));
}

console.log("\n== a short write is completed ==");
{
  const dir = folder();
  const { filePath, snapshot } = fileWithSnapshot(dir, "en-US.yml", "old\n");
  const realWrite = syncIo.writeSync;
  const text = "0123456789".repeat(10) + "\n";
  withIo({ writeSync: (fd, buf, off, len) => realWrite(fd, buf, off, Math.min(len, 7)) }, () => {
    replaceFileAtomic(filePath, text, snapshot);
  });
  eq("every byte written despite 7-byte writes", text, readFileSync(filePath, "utf8"));
}

console.log("\n== failures leave the original intact and clean the temporary file ==");
{
  const dir = folder();
  const { filePath, snapshot } = fileWithSnapshot(dir, "en-US.yml", "precious\n");
  let e = withIo({ writeSync: () => { throw ioError("ENOSPC", "no space left"); } }, () =>
    thrown(() => replaceFileAtomic(filePath, "new\n", snapshot)));
  eq("temporary-write failure: VT_WRITE_FAILED", "VT_WRITE_FAILED", e?.code);
  eq("it is a SyncError with the file and the cause", true, e instanceof SyncError && e.filePath === filePath && e.cause?.code === "ENOSPC");
  eq("original bytes intact", "precious\n", readFileSync(filePath, "utf8"));
  eq("temporary file removed", 0, leftovers(dir).length);

  e = withIo({ renameSync: () => { throw ioError("EIO", "rename refused"); } }, () =>
    thrown(() => replaceFileAtomic(filePath, "new\n", snapshot)));
  eq("rename failure: VT_WRITE_FAILED", "VT_WRITE_FAILED", e?.code);
  eq("original bytes intact (rename)", "precious\n", readFileSync(filePath, "utf8"));
  eq("temporary file removed (rename)", 0, leftovers(dir).length);

  // Rename retry is for Windows only: on POSIX an EPERM is final and not retried.
  let calls = 0;
  e = withIo({ renameSync: () => { calls++; throw ioError("EPERM"); } }, () =>
    thrown(() => replaceFileAtomic(filePath, "new\n", snapshot)));
  eq("POSIX: EPERM is not retried", 1, calls);
  eq("POSIX: fails with VT_WRITE_FAILED", "VT_WRITE_FAILED", e?.code);

  // open fails for good (not EEXIST): same error, nothing to clean.
  e = withIo({ openSync: () => { throw ioError("EACCES"); } }, () =>
    thrown(() => replaceFileAtomic(filePath, "new\n", snapshot)));
  eq("open failure: VT_WRITE_FAILED", "VT_WRITE_FAILED", e?.code);
}

console.log("\n== a temporary name that already exists is redrawn ==");
{
  const dir = folder();
  const { filePath, snapshot } = fileWithSnapshot(dir, "en-US.yml", "old\n");
  const realOpen = syncIo.openSync;
  let tries = 0;
  withIo({ openSync: (...a) => { if (++tries <= 2) throw ioError("EEXIST"); return realOpen(...a); } }, () => {
    replaceFileAtomic(filePath, "new\n", snapshot);
  });
  eq("two collisions, then success", "new\n", readFileSync(filePath, "utf8"));
  const e = withIo({ openSync: () => { throw ioError("EEXIST"); } }, () => thrown(() => replaceFileAtomic(filePath, "x\n", snapshot)));
  eq("five collisions in a row give up", "VT_WRITE_FAILED", e?.code);
}

console.log("\n== conflicts: the file changed after it was read ==");
{
  const dir = folder();
  const { filePath, snapshot } = fileWithSnapshot(dir, "en-US.yml", "as read\n");
  writeFileSync(filePath, "edited by a human\n");
  let e = thrown(() => replaceFileAtomic(filePath, "ours\n", snapshot));
  eq("bytes changed: VT_FILE_CHANGED", "VT_FILE_CHANGED", e?.code);
  eq("the message says what to do", true, e?.message.includes("Run again once the other edit is done"));
  eq("the other edit is untouched", "edited by a human\n", readFileSync(filePath, "utf8"));
  eq("no temporary file left", 0, leftovers(dir).length);

  const gone = join(dir, "fr-FR.yml");
  const snap = fileWithSnapshot(dir, "fr-FR.yml", "x\n").snapshot;
  rmSync(gone);
  e = thrown(() => replaceFileAtomic(gone, "ours\n", snap));
  eq("the file vanished: VT_FILE_CHANGED", "VT_FILE_CHANGED", e?.code);
  eq("and it was not recreated", false, existsSync(gone));

  const created = join(dir, "de-DE.yml");
  writeFileSync(created, "somebody was faster\n");
  e = thrown(() => replaceFileAtomic(created, "ours\n", { kind: "absent" }));
  eq("absent in the snapshot, created meanwhile: VT_FILE_CHANGED", "VT_FILE_CHANGED", e?.code);
  eq("their file is untouched", "somebody was faster\n", readFileSync(created, "utf8"));

  // D6: when there is nothing to write the snapshot is not even looked at.
  const ref = writeLanguageFileIfChanged({ filePath: join(dir, "ref.yml"), tag: "it-IT", isSource: true, table: { App_a: "x" }, expected: { kind: "absent" } });
  const same = fileWithSnapshot(dir, "it-IT.yml", ref.text);
  utimesSync(same.filePath, new Date(1e9), new Date(1e9));
  const mtime = statSync(same.filePath).mtimeMs;
  writeFileSync(same.filePath, ref.text + "# changed after the read\n"); // makes the snapshot stale
  utimesSync(same.filePath, new Date(1e9), new Date(1e9));
  const noop = writeLanguageFileIfChanged({
    filePath: same.filePath, tag: "it-IT", isSource: true, table: { App_a: "x" },
    oldText: ref.text, expected: same.snapshot,
  });
  eq("a no-op write reports written: false", false, noop.written);
  eq("a no-op write leaves the mtime alone", mtime, statSync(same.filePath).mtimeMs);
}

console.log("\n== permissions ==");
if (process.platform !== "win32") {
  const dir = folder();
  const { filePath, snapshot } = fileWithSnapshot(dir, "en-US.yml", "old\n");
  chmodSync(filePath, 0o640);
  const snap = readLanguageForSync(filePath).snapshot;
  eq("the snapshot records the mode", 0o640, snap.mode);
  replaceFileAtomic(filePath, "new\n", snap);
  eq("permission bits kept", 0o640, statSync(filePath).mode & 0o7777);
  void snapshot;
} else {
  console.log("  skip  permission bits (Windows)");
}

console.log("\n== Windows: the rename is retried, once the platform says so ==");
{
  const dir = folder();
  const { filePath, snapshot } = fileWithSnapshot(dir, "en-US.yml", "old\n");
  const realRename = syncIo.renameSync;
  let calls = 0;
  const started = Date.now();
  withIo({
    platform: "win32",
    renameSync: (...a) => { if (++calls <= 2) throw ioError("EPERM"); return realRename(...a); },
  }, () => replaceFileAtomic(filePath, "new\n", snapshot));
  eq("renamed on the third attempt", 3, calls);
  eq("content replaced", "new\n", readFileSync(filePath, "utf8"));
  eq("it waited between attempts (25 + 50 ms)", true, Date.now() - started >= 60);

  calls = 0;
  const e = withIo({ platform: "win32", renameSync: () => { calls++; throw ioError("EBUSY"); } }, () =>
    thrown(() => replaceFileAtomic(filePath, "newer\n", readLanguageForSync(filePath).snapshot)));
  eq("a persistent EBUSY: 5 attempts in all", 5, calls);
  eq("then VT_WRITE_FAILED", "VT_WRITE_FAILED", e?.code);
  eq("the original is intact", "new\n", readFileSync(filePath, "utf8"));
  eq("no temporary file left", 0, leftovers(dir).length);

  // chmod errors do not matter on Windows.
  const ok = withIo({ platform: "win32", chmodSync: () => { throw ioError("EPERM"); } }, () =>
    thrown(() => replaceFileAtomic(filePath, "chmod-less\n", readLanguageForSync(filePath).snapshot)));
  eq("chmod errors are ignored on win32", null, ok);
}

console.log("\n== Windows retries recheck intervening edits ==");
for (const initiallyPresent of [true, false]) {
  const dir = folder();
  const filePath = join(dir, "fr-FR.yml");
  if (initiallyPresent) writeFileSync(filePath, "original\n");
  const snapshot = readLanguageForSync(filePath).snapshot;
  let calls = 0;
  const realRename = syncIo.renameSync;
  const e = withIo({
    platform: "win32",
    renameSync: (...args) => {
      if (++calls === 1) {
        writeFileSync(filePath, "human edit\n");
        throw ioError("EPERM");
      }
      return realRename(...args);
    },
  }, () => thrown(() => replaceFileAtomic(filePath, "generated\n", snapshot)));
  eq(`intervening ${initiallyPresent ? "edit" : "creation"}: conflict`, "VT_FILE_CHANGED", e?.code);
  eq("no second rename attempted", 1, calls);
  eq("human bytes preserved", "human edit\n", readFileSync(filePath, "utf8"));
  eq("temporary file removed after retry conflict", 0, leftovers(dir).length);
}

console.log("\n== the temporary name is invisible to the rest of the library ==");
{
  const dir = folder();
  const { filePath, snapshot } = fileWithSnapshot(dir, "en-US.yml", "old\n");
  const seen = [];
  const realOpen = syncIo.openSync;
  withIo({ openSync: (name, ...a) => { seen.push(String(name)); return realOpen(name, ...a); } }, () => {
    replaceFileAtomic(filePath, "new\n", snapshot);
  });
  const tmpName = seen[0].split(/[\\/]/).pop();
  eq("the temporary file is named .<file>.vt-tmp-<pid>-<random>", true, /^\.en-US\.yml\.vt-tmp-\d+-[0-9a-f]{8}$/.test(tmpName));
  eq("isLanguageFileName rejects it", false, isLanguageFileName(tmpName));
}

console.log("\n== symlinks: the link stays, its target is replaced ==");
{
  const dir = folder();
  const realDir = folder();
  const target = join(realDir, "en-US.yml");
  writeFileSync(target, "old\n");
  const link = join(dir, "en-US.yml");
  let linked = true;
  try {
    symlinkSync(target, link);
  } catch (e) {
    if (e.code !== "EPERM") throw e;
    linked = false;
    console.log("  skip  symlinks: cannot create one here (EPERM, Windows without developer mode)");
  }
  if (linked) {
    const snapshot = readLanguageForSync(link).snapshot;
    eq("snapshot.realPath is the target", true, snapshot.realPath.endsWith("en-US.yml") && !snapshot.realPath.startsWith(dir));
    replaceFileAtomic(link, "new\n", snapshot);
    eq("still a link", true, lstatSync(link).isSymbolicLink());
    eq("pointing at the same target", target, readlinkSync(link));
    eq("the target holds the new content", "new\n", readFileSync(target, "utf8"));
    eq("no temporary file next to the target", 0, leftovers(realDir).length);
    eq("no temporary file next to the link", 0, leftovers(dir).length);

    // The link is repointed after the read: that is a conflict, not a silent write elsewhere.
    const other = join(realDir, "other.yml");
    writeFileSync(other, "another file\n");
    const snap = readLanguageForSync(link).snapshot;
    rmSync(link);
    symlinkSync(other, link);
    const e = thrown(() => replaceFileAtomic(link, "ours\n", snap));
    eq("target swapped after the read: VT_FILE_CHANGED", "VT_FILE_CHANGED", e?.code);
    eq("neither file was written", "new\nanother file\n", readFileSync(target, "utf8") + readFileSync(other, "utf8"));

    // A retarget during the Windows retry wait must also be caught.
    const retrySnapshot = readLanguageForSync(link).snapshot;
    const realRename = syncIo.renameSync;
    let calls = 0;
    const retryError = withIo({
      platform: "win32",
      renameSync: (...args) => {
        if (++calls === 1) {
          rmSync(link);
          symlinkSync(target, link);
          throw ioError("EBUSY");
        }
        return realRename(...args);
      },
    }, () => thrown(() => replaceFileAtomic(link, "ours\n", retrySnapshot)));
    eq("target swapped during retry: conflict", "VT_FILE_CHANGED", retryError?.code);
    eq("retarget prevented the second rename", 1, calls);
    eq("both targets still untouched", "new\nanother file\n", readFileSync(target, "utf8") + readFileSync(other, "utf8"));
    eq("retry conflict cleans target temporary file", 0, leftovers(realDir).length);
    rmSync(link);
    symlinkSync(other, link);

    // A dangling link is not "missing": we do not know what it should hold.
    rmSync(other);
    const dangling = readLanguageForSync(link);
    eq("dangling link: unreadable", "unreadable", dangling.status);
    eq("dangling link: no snapshot", null, dangling.snapshot);
  }
}

console.log("\n== the snapshot keeps exactly the bytes that were read ==");
{
  const dir = folder();
  const raw = Buffer.from([0xff, 0xfe, 0x41, 0x00]); // UTF-16 BOM: not valid UTF-8
  const filePath = join(dir, "en-US.yml");
  writeFileSync(filePath, raw);
  const read = readLanguageForSync(filePath);
  eq("status", "corrupted", read.status);
  eq("snapshot.kind", "file", read.snapshot.kind);
  eq("snapshot.bytes equal the file", true, raw.equals(read.snapshot.bytes));
  eq("oldText stays null outside `ok`", null, read.oldText);
}

console.log("\n== the other writers pass the right snapshot ==");
{
  // buildManifest.bootstrapSubLanguage: an empty file is populated, one filled meanwhile is not.
  const make = (dir, extraDefs = {}) => {
    const reports = [];
    const manifest = creaManifest({
      defs: { sourceLanguage: "it-IT", localeDir: "locale", ...extraDefs },
      localeDir: dir,
      reporter: { report: (kind, message) => reports.push([kind, message]) },
      leggiStato: () => ({ isProduction: false, errorSolve: {} }),
      icuOptions: null, icuDevPath: null, devRenderPath: null,
    });
    return { manifest, reports };
  };
  const source = '# TableVersion: 1\nApp_a: "Ciao"\nApp_b: "Mondo"\n';
  const quiet = async (fn) => {
    const saved = { log: console.log, warn: console.warn };
    console.log = console.warn = () => {};
    try { return await fn(); } finally { Object.assign(console, saved); }
  };

  {
    const dir = folder();
    writeFileSync(join(dir, "it-IT.yml"), source);
    writeFileSync(join(dir, "fr-FR.yml"), "");
    const { manifest, reports } = make(dir);
    await quiet(() => manifest.generate());
    const fr = readFileSync(join(dir, "fr-FR.yml"), "utf8");
    eq("bootstrap: an empty file is populated", true, fr.includes("App_a: null") && fr.includes("App_b: null"));
    eq("bootstrap: reported", "bootstrapped", reports[0]?.[0]);
    eq("bootstrap: no temporary file left", 0, leftovers(dir).length);
  }
  {
    // The language is declared in preloadedLanguages but has no file: created from "absent".
    const dir = folder();
    writeFileSync(join(dir, "it-IT.yml"), source);
    const { manifest, reports } = make(dir, { preloadedLanguages: ["de-DE"] });
    await quiet(() => manifest.generate());
    eq("bootstrap: an absent preloaded language is created", true, existsSync(join(dir, "de-DE.yml")));
    eq("bootstrap: reported preload-missing", "preload-missing", reports[0]?.[0]);
  }
  {
    // Somebody fills the empty file between the scan and the bootstrap: their work stays.
    const dir = folder();
    writeFileSync(join(dir, "it-IT.yml"), source);
    const frPath = join(dir, "fr-FR.yml");
    writeFileSync(frPath, "");
    const mine = '# TableVersion: 1\nApp_a: "Salut"\nApp_b: null\n';
    const realRead = syncIo.readFileSync;
    let reads = 0;
    const { manifest, reports } = make(dir);
    await quiet(() => withIo({
      readFileSync: (f, ...a) => {
        if (String(f).endsWith("fr-FR.yml") && ++reads === 2) writeFileSync(frPath, mine); // the bootstrap's own read
        return realRead(f, ...a);
      },
    }, () => manifest.generate()));
    eq("bootstrap: the file filled meanwhile is left alone", mine, readFileSync(frPath, "utf8"));
    eq("bootstrap: reports bootstrap-skipped", true, reports.some(([kind]) => kind === "bootstrap-skipped"));
  }
  {
    // Same, but filled AFTER the bootstrap's own read, while the temporary file is being
    // written: the conflict check catches it, and the manifest skips instead of failing.
    const dir = folder();
    writeFileSync(join(dir, "it-IT.yml"), source);
    const frPath = join(dir, "fr-FR.yml");
    writeFileSync(frPath, "");
    const mine = '# TableVersion: 1\nApp_a: "Salut"\nApp_b: null\n';
    const realOpen = syncIo.openSync;
    let filled = false;
    const { manifest, reports } = make(dir);
    const error = await quiet(() => withIo({
      openSync: (f, ...a) => {
        if (!filled && String(f).includes("fr-FR.yml.vt-tmp-")) { filled = true; writeFileSync(frPath, mine); }
        return realOpen(f, ...a);
      },
    }, async () => { try { await manifest.generate(); return null; } catch (e) { return e; } }));
    eq("bootstrap race: the manifest does not fail", null, error);
    eq("bootstrap race: the file filled meanwhile is left alone", mine, readFileSync(frPath, "utf8"));
    eq("bootstrap race: reports bootstrap-skipped", true, reports.some(([kind]) => kind === "bootstrap-skipped"));
    eq("bootstrap race: no temporary file left", 0, leftovers(dir).length);
  }

  // migrateLegacyLanguages: the target must still be absent when it is written.
  {
    const dir = folder();
    writeFileSync(join(dir, "it-IT.js"), 'export default { "App_a": "Ciao" };\n');
    writeFileSync(join(dir, "en-US.js"), "");
    writeFileSync(join(dir, "fr-FR.js"), 'export default { "App_a": "Salut" };\n');
    writeFileSync(join(dir, "fr-FR.yml"), "keep me\n");
    const result = await quiet(() => migrateLegacyLanguages(dir, "it-IT"));
    eq("migrate: converted the free targets", "en-US.js,it-IT.js", result.migrated.sort().join(","));
    eq("migrate: an existing .yml is skipped", "fr-FR.js", result.skipped.map(([f]) => f).join(","));
    eq("migrate: and left untouched", "keep me\n", readFileSync(join(dir, "fr-FR.yml"), "utf8"));
    eq("migrate: the empty legacy file gives an empty table", "", readFileSync(join(dir, "en-US.yml"), "utf8"));
    eq("migrate: the table is written", true, readFileSync(join(dir, "it-IT.yml"), "utf8").includes('App_a: "Ciao"'));
    eq("migrate: no temporary file left", 0, leftovers(dir).length);
  }
  {
    // The target appears between the check and the write: refused, nothing overwritten.
    const dir = folder();
    writeFileSync(join(dir, "it-IT.js"), 'export default { "App_a": "Ciao" };\n');
    const target = join(dir, "it-IT.yml");
    const realLstat = syncIo.lstatSync;
    let calls = 0;
    const error = await quiet(() => withIo({
      lstatSync: (f, ...a) => {
        // 1st call: readLanguageForSync (absent). 2nd: the conflict check, after someone created it.
        if (String(f).endsWith("it-IT.yml") && ++calls === 2) writeFileSync(target, "somebody was faster\n");
        return realLstat(f, ...a);
      },
    }, () => thrown(() => migrateLegacyLanguages(dir, "it-IT"))));
    eq("migrate: a target created meanwhile is a conflict", "VT_FILE_CHANGED", error?.code);
    eq("migrate: their file is untouched", "somebody was faster\n", readFileSync(target, "utf8"));
    eq("migrate: the legacy file is not renamed away", true, existsSync(join(dir, "it-IT.js")));
  }
}

for (const dir of temp) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
