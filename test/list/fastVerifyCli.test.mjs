// vtranslate-cli --fastverify, dalla riga di comando: il secondo lancio su un progetto invariato
// deve uscire velocemente senza toccare nessun file, e un file marcato modificato deve far
// tornare il comando al giro tradizionale.
//
//   node test/list/fastVerifyCli.test.mjs
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, statSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = atteso === ottenuto;
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(resolve(HERE, "../.."), "lib/dev/vite/cli.js");
const PLUGIN = pathToFileURL(join(resolve(HERE, "../.."), "lib/index.js")).href;

const temporanee = [];

function progetto() {
  const radice = mkdtempSync(join(tmpdir(), "vt-fastverifycli-"));
  temporanee.push(radice);
  // Il record di --fastverify vive in node_modules/.viteTranslate/ (vedi scanRecord.js): senza
  // questa cartella scriviJson non scrive nulla, e --fastverify troverebbe sempre "no-record".
  mkdirSync(join(radice, "node_modules"));
  mkdirSync(join(radice, "src"));
  writeFileSync(join(radice, "package.json"), '{ "type": "module" }');
  writeFileSync(join(radice, "src", "App.jsx"), 'export const a = "_%_Ciao dal comando_%_";\n');
  writeFileSync(join(radice, "vite.config.mjs"),
    `import { vitetranslate } from ${JSON.stringify(PLUGIN)};\n` +
    `export default { plugins: [vitetranslate({ localeDir: "locale", sourceLanguage: "it-IT" })] };\n`);
  return radice;
}

const lancia = (radice, argv = []) => {
  const esito = spawnSync(process.execPath, [CLI, ...argv], { cwd: radice, encoding: "utf8" });
  return { ...esito, uscita: (esito.stdout ?? "") + (esito.stderr ?? "") };
};

/** mtime di ogni file dentro `dir`, ricorsivo, per confrontare "nessuna scrittura" fra due istanti. */
function fotografia(dir) {
  const righe = [];
  const cammina = (d) => {
    for (const nome of readdirSync(d)) {
      const p = join(d, nome);
      const s = statSync(p);
      if (s.isDirectory()) cammina(p);
      else righe.push(`${p}:${s.mtimeMs}:${s.size}`);
    }
  };
  cammina(dir);
  return righe.sort().join("\n");
}

// ------------------------------------------------------- il caso comune
console.log("\n== progetto invariato: la seconda sync veloce non scrive niente ==");
{
  const radice = progetto();

  const primo = lancia(radice);
  eq("primo lancio (sync normale): esce 0", 0, primo.status);

  const prima = fotografia(radice);
  const secondo = lancia(radice, ["--fastverify"]);
  const dopo = fotografia(radice);

  eq("--fastverify: esce 0", 0, secondo.status);
  eq("--fastverify: dice che non è cambiato niente", true, secondo.uscita.includes("nothing changed"));
  eq("--fastverify: non tocca nessun file", prima, dopo);
}

// ------------------------------------------------------- il fallback
console.log("\n== un file marcato modificato fa tornare al giro lungo ==");
{
  const radice = progetto();
  lancia(radice);
  writeFileSync(join(radice, "src", "App.jsx"), 'export const a = "_%_Ciao dal comando, di nuovo_%_";\n');

  const terzo = lancia(radice, ["--fastverify"]);
  eq("il giro lungo gira davvero: esce 0", 0, terzo.status);
  eq("e lo dice", true, terzo.uscita.includes("skip fastverify:"));
  eq("la tabella riflette la modifica", true,
    readFileSync(join(radice, "locale", "it-IT.yml"), "utf8").includes("Ciao dal comando, di nuovo"));
}

// ------------------------------------------------------- le combinazioni vietate
console.log("\n== --fastverify non si combina con --add / --status / --migrate ==");
{
  const radice = progetto();
  lancia(radice);
  for (const argv of [["--fastverify", "--status"], ["--fastverify", "--add", "fr-FR"], ["--fastverify", "--migrate"]]) {
    const { status, uscita } = lancia(radice, argv);
    eq(`${argv.join(" ")}: esce in errore`, 1, status);
    eq(`${argv.join(" ")}: spiega perché`, true, uscita.includes("cannot be combined"));
  }
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail === 0 ? "\nTUTTI OK" : `\n${fail} FALLITI`);
process.exit(fail === 0 ? 0 : 1);
