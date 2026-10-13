// Il legame tra il soggetto e lo storyboard eseguibile di un progetto.
//
//   storyboard.md    il soggetto, in italiano: la fonte di verità del contenuto (cosa si vede, cosa
//                    si dice, in che ordine). Lo scrive una persona.
//   storyboard.yaml  la sua traduzione eseguibile, in inglese: la scrive l'LLM dell'editor
//                    seguendo README.md, e una persona può ritoccarne la tecnica.
//
// Il .md prevale: `stamp` scrive in fondo allo YAML l'impronta di ogni scena del .md da cui è
// stato ricavato; `check` confronta quelle impronte col .md di adesso e dice quali scene
// adattare. Gli altri passi (run.mjs) si fermano finché lo YAML è indietro.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { load as yamlLoad } from "js-yaml";

// Una scena del soggetto: `## <id> · Titolo` (anche —, –, :, |, - come separatore), o `## <id>`.
const TITOLO_SCENA = /^##\s+(.+?)\s*$/;
const ID_E_TITOLO = /^([a-z0-9-]+)(?:\s*[·—–:|-]\s*(.*))?$/;
const MARCA = "# ── source:";

const impronta = (testo) => createHash("sha1").update(testo).digest("hex").slice(0, 10);

/** Spazi in coda e righe vuote multiple non cambiano il contenuto. */
function normalizza(righe) {
  return righe
    .map((r) => r.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * @param {string} file - storyboard.md
 * @returns {{ header: string, scenes: { id: string, title: string, hash: string }[] }}
 */
export function readSubject(file) {
  if (!existsSync(file)) throw new Error(`no ${file}: every video starts from its storyboard.md`);
  const righe = readFileSync(file, "utf8").split(/\r?\n/);
  const testa = [];
  const scene = [];
  const senzaId = [];
  let corrente = null;
  let inCodice = false;
  for (const riga of righe) {
    if (/^\s*```/.test(riga)) inCodice = !inCodice;
    const m = !inCodice && TITOLO_SCENA.exec(riga);
    if (m) {
      const id = ID_E_TITOLO.exec(m[1]);
      if (!id) senzaId.push(m[1]);
      corrente = { id: id?.[1] ?? null, title: id?.[2] ?? "", righe: [riga] };
      scene.push(corrente);
    } else (corrente ? corrente.righe : testa).push(riga);
  }
  if (senzaId.length)
    throw new Error(`storyboard.md: scene headings need an id ("## my-scene · Title"): ${senzaId.map((t) => `"${t}"`).join(", ")}`);
  const doppi = scene.map((s) => s.id).filter((id, i, tutti) => tutti.indexOf(id) !== i);
  if (doppi.length) throw new Error(`storyboard.md: duplicate scene ids: ${[...new Set(doppi)].join(", ")}`);
  if (!scene.length) throw new Error("storyboard.md: no scenes (## my-scene · Title)");
  return {
    header: impronta(normalizza(testa)),
    scenes: scene.map((s) => ({ id: s.id, title: s.title, hash: impronta(normalizza(s.righe)) })),
  };
}

/**
 * Dove sta lo YAML rispetto al .md.
 * @param {{ md: string, yaml: string }} paths
 */
export function alignment(paths) {
  const soggetto = readSubject(paths.md);
  const idMd = soggetto.scenes.map((s) => s.id);
  if (!existsSync(paths.yaml)) return { aligned: false, yaml: false, soggetto, idMd };

  const yaml = yamlLoad(readFileSync(paths.yaml, "utf8")) ?? {};
  const idYaml = (yaml.scenes ?? []).map((s) => s?.id);
  const source = yaml.source ?? null;
  const prima = source?.scenes ?? {};
  const r = {
    yaml: true,
    soggetto,
    idMd,
    stamped: Boolean(source),
    header: Boolean(source) && source.header !== soggetto.header,
    added: soggetto.scenes.filter((s) => !(s.id in prima)).map((s) => s.id),
    removed: Object.keys(prima).filter((id) => !idMd.includes(id)),
    changed: soggetto.scenes.filter((s) => s.id in prima && prima[s.id] !== s.hash).map((s) => s.id),
    // Le scene dello YAML devono essere quelle del .md, nello stesso ordine.
    onlyYaml: idYaml.filter((id) => !idMd.includes(id)),
    missingYaml: idMd.filter((id) => !idYaml.includes(id)),
    order: idYaml.filter((id) => idMd.includes(id)).join() !== idMd.filter((id) => idYaml.includes(id)).join(),
  };
  r.structure = !r.onlyYaml.length && !r.missingYaml.length && !r.order;
  r.aligned = r.stamped && r.structure && !r.header && !r.added.length && !r.removed.length && !r.changed.length;
  return r;
}

/** Le righe che `check` stampa, e che un passo fermato mostra. */
export function describe(a, name) {
  if (!a.yaml) return [`no storyboard.yaml yet: convert storyboard.md (README.md), then \`node commons/cli/run.mjs ${name} stamp\``];
  if (a.aligned) return [`storyboard.yaml matches storyboard.md (${a.idMd.length} scenes)`];
  const r = [];
  if (!a.stamped) r.push("storyboard.yaml was never stamped against storyboard.md");
  else {
    if (a.header) r.push("  ~ header      (title, audience, tone, voice, fixture: check the top keys)");
    for (const id of a.changed) r.push(`  ~ ${id.padEnd(12)}changed in storyboard.md`);
    for (const id of a.added) r.push(`  + ${id.padEnd(12)}new in storyboard.md`);
    for (const id of a.removed) r.push(`  - ${id.padEnd(12)}gone from storyboard.md`);
  }
  for (const id of a.missingYaml) r.push(`  ! ${id.padEnd(12)}in storyboard.md, not in storyboard.yaml`);
  for (const id of a.onlyYaml) r.push(`  ! ${id.padEnd(12)}in storyboard.yaml, not in storyboard.md`);
  if (a.order) r.push(`  ! order       storyboard.yaml must follow storyboard.md: ${a.idMd.join(", ")}`);
  r.push(`→ adapt storyboard.yaml to storyboard.md (README.md), then \`node commons/cli/run.mjs ${name} stamp\``);
  return r;
}

/**
 * Dichiara lo YAML allineato al .md di adesso. Rifiuta se le scene non sono le stesse, nello
 * stesso ordine: il contenuto non lo può verificare, la struttura sì.
 */
export function stamp(paths, name) {
  const a = alignment(paths);
  if (!a.yaml) throw new Error(describe(a, name).join("\n"));
  if (!a.structure) throw new Error(["storyboard.yaml does not have the scenes of storyboard.md:", ...describe(a, name).filter((r) => r.includes("!"))].join("\n"));
  let testo = readFileSync(paths.yaml, "utf8");
  const i = testo.indexOf(MARCA);
  if (i >= 0) testo = testo.slice(0, i);
  const blocco = [
    `${MARCA} storyboard.md at the last \`node commons/cli/run.mjs ${name} stamp\`. Written by the tool, not by hand.`,
    "source:",
    `  header: "${a.soggetto.header}"`,
    "  scenes:",
    ...a.soggetto.scenes.map((s) => `    ${s.id}: "${s.hash}"`),
    "",
  ].join("\n");
  writeFileSync(paths.yaml, `${testo.trimEnd()}\n\n${blocco}`);
  return a.soggetto.scenes.length;
}
