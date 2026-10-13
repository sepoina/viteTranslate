// La ripresa: una sessione sola, scena dopo scena, perché lo stato passa dall'una all'altra
// (il file scritto nella scena 3 è quello che la 5 sincronizza). Ogni scena registra le sue
// pagine visibili in capture/clips/<n>-<id>-<pagina>.mp4 e dura almeno quanto la sua voce:
//   durata = max(tempo delle azioni, lead + voce + tail) + hold
// capture/takes.json dice a compose.mjs cosa c'è in ogni clip.
//
// Riprese parziali (README.md § "Partial takes"): takes.json tiene l'impronta del palco e quella di
// ogni scena, concatenata con le precedenti. Al giro dopo si gira dalla prima scena cambiata; quelle
// prima passano "avanti veloce" (le azioni senza registrare, senza voce né segni: solo per rifare lo
// stato) e tengono la loro clip. takes.json si riscrive dopo ogni scena: una ripresa interrotta
// riparte da dove si era fermata. Ogni scena girata lascia in capture/strips/ una striscia, un
// fotogramma al secondo, da guardare mentre la ripresa va avanti.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { impagina } from "./compose.mjs";
import { Director, VSCODE_SETTINGS } from "./director.mjs";
import { ffmpeg, probeDuration } from "./ffmpeg.mjs";
import { Recorder } from "./recorder.mjs";
import { startApp, startVscode, vsixStamp } from "./servers.mjs";
import { REPO_DIR, VIDEO_DIR, resolveRef } from "./storyboard.mjs";
import { readManifest } from "./tts.mjs";
import { resolveApiKey } from "../../../lib/dev/llm/apiKey.js";

/**
 * Le variabili di vscode.env coi loro valori, cercati come la chiave della voce: ambiente,
 * site/video/.env.local, site/video/.env, portachiavi. Vanno al server di VS Code, quindi ai suoi
 * terminali (un `--llm-translate` lanciato dal pannello); su disco, in capture/, non finiscono.
 */
async function variabiliVscode(nomi) {
  const env = {};
  for (const nome of nomi) {
    try {
      env[nome] = (await resolveApiKey({ connection: { apiKeyEnv: nome }, baseDir: VIDEO_DIR })).key;
    } catch {
      throw new Error(`vscode.env: ${nome} not found (environment, site/video/.env.local, site/video/.env, keyring)`);
    }
  }
  return env;
}

const SALTA = new Set(["node_modules", "dist", ".vite"]);
// Il codice che decide come viene una ripresa: cambiato lui, cambia ogni scena.
const PIPELINE = ["director.mjs", "marker.js", "recorder.mjs", "record.mjs", "servers.mjs"];

/** Copia pulita del progetto di partenza: ogni ripresa comincia dallo stesso stato. */
function copiaFixture(project) {
  const da = join(REPO_DIR, project.fixture);
  const a = join(project.paths.capture, basename(da));
  rmSync(a, { recursive: true, force: true });
  cpSync(da, a, { recursive: true, filter: (f) => !SALTA.has(basename(f)) });
  return a;
}

// ------------------------------------------------------------ impronte

const impronta = (...parti) => {
  const h = createHash("sha1");
  for (const p of parti) h.update(typeof p === "string" ? p : (JSON.stringify(p) ?? ""));
  return h.digest("hex").slice(0, 12);
};

/** Il contenuto di una cartella, file per file, saltando quello che la copia salta. */
function improntaCartella(dir) {
  const h = createHash("sha1");
  const giro = (d) => {
    for (const n of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (SALTA.has(n.name)) continue;
      const p = join(d, n.name);
      if (n.isDirectory()) giro(p);
      else h.update(relative(dir, p)).update(readFileSync(p));
    }
  };
  giro(dir);
  return h.digest("hex").slice(0, 12);
}

/**
 * Le impronte di una ripresa. `stage`: tutto quello che, cambiato, cambia ogni scena (fixture,
 * impostazioni, setup, zoom, l'estensione, il codice della pipeline). `scenes`: una per scena, a
 * catena: la scena, la sua voce, la sua card, e l'impronta di quella prima. Cambiata una scena,
 * cambiano anche tutte quelle dopo, perché ne ereditano lo stato.
 */
function impronte(project, voci, { rebuildIde }) {
  // mbPerMinute pesa solo sul montaggio: cambiarlo non chiede di rigirare.
  const { scenes, music, poster, source, title, voice, output: { mbPerMinute, ...formato }, ...resto } = project;
  const palco = { ...resto, output: formato };
  const leggi = (ref) => (ref ? readFileSync(resolveRef(project.paths, ref), "utf8") : "");
  const stage = impronta(
    palco,
    VSCODE_SETTINGS,
    project.fixture ? improntaCartella(join(REPO_DIR, project.fixture)) : "",
    leggi(project.app.style),
    leggi(project.vscode.style),
    rebuildIde ? `rebuild ${Date.now()}` : (vsixStamp() ?? `missing ${Date.now()}`), // da ricostruire: diversa per forza
    ...PIPELINE.map((f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8")),
  );
  let prima = stage;
  const card = (s) => (s.stage === "card" ? [leggi(s.card), leggi("@commons/clock.js"), music?.credits ?? null] : null);
  return { stage, scenes: scenes.map((s) => (prima = impronta(prima, s, voci[s.id] ?? null, card(s)))) };
}

/**
 * Da quale scena si gira, e quali riprese di prima si tengono.
 * Senza opzioni: dalla prima scena la cui impronta non è più quella della sua clip; da capo se è
 * cambiato il palco. `full`: da capo. `from`: da lì, tenendo le clip di prima anche se il palco è
 * cambiato (lo decide chi lo chiede, e lo si avvisa: le scene tenute prendono le impronte nuove).
 * `to`: ci si ferma dopo quella scena.
 */
function piano(project, nuove, prima, { full, from, to }) {
  const ids = project.scenes.map((s) => s.id);
  const clipDir = join(project.paths.capture, "clips");
  const tenibile = (i) => {
    const t = prima?.takes?.[i];
    return t?.id === ids[i] && Object.values(t.clips ?? {}).every((c) => existsSync(join(clipDir, c.file)));
  };
  let auto = 0;
  let perché = "no takes to keep";
  if (full) perché = "--full";
  else if (prima?.stage && prima.stage !== nuove.stage) perché = "the stage changed: fixture, settings, setup, extension or pipeline";
  else if (prima?.stage) {
    auto = ids.findIndex((_, i) => !tenibile(i) || prima.takes[i].fingerprint !== nuove.scenes[i]);
    if (auto === -1) auto = ids.length;
    perché = auto < ids.length ? `"${ids[auto]}" changed since its take` : "every scene matches its take";
  }
  const indice = (id, opzione) => {
    const i = ids.indexOf(id);
    if (i < 0) throw new Error(`${opzione} ${id}: no such scene (${ids.join(", ")})`);
    return i;
  };
  let start = auto;
  const avvisi = [];
  if (from !== undefined) {
    start = indice(from, "--from");
    const mancanti = ids.slice(0, start).filter((_, i) => !tenibile(i));
    if (mancanti.length) throw new Error(`--from ${from}: no take to keep for ${mancanti.join(", ")}`);
    if (start > auto) avvisi.push(`--from ${from}: keeping ${ids.slice(auto, start).join(", ")} as they were, though ${perché}`);
    perché = `--from ${from}`;
  }
  const fine = to !== undefined ? indice(to, "--to") : ids.length - 1;
  if (fine < start && start < ids.length) throw new Error(`--to ${to} comes before the first scene to shoot, "${ids[start]}"`);
  return { start, fine, perché, avvisi };
}

// ------------------------------------------------------------ strisce

/**
 * La striscia di una scena girata: un fotogramma al secondo, quattro per riga; le pagine al loro
 * posto, come nel montaggio. Si guarda mentre la ripresa va avanti (README.md § "Partial takes").
 */
function striscia(take, clipDir, file, output) {
  const clips = Object.values(take.clips);
  const righe = Math.max(1, Math.ceil((Math.floor(take.duration) + 1) / 4)); // fps=1 dà i secondi 0, 1, … fino alla fine
  const { filtri, uscita } = impagina(clips, { W: output.width, H: output.height, scala: 1, fps: output.fps, durata: take.duration.toFixed(4) });
  return ffmpeg([
    ...clips.flatMap((c) => ["-i", join(clipDir, c.file)]),
    "-filter_complex", [...filtri, `${uscita}fps=1,scale=480:-2,tile=4x${righe}`].join(";"),
    "-frames:v", "1", "-q:v", "4", file,
  ]).catch((e) => console.warn(`    ! strip of ${take.id}: ${e.message.split("\n")[0]}`));
}

// ------------------------------------------------------------ ripresa

export async function record(project, { headed = false, rebuildIde = false, full = false, from, to } = {}) {
  const { paths, output } = project;
  const voci = readManifest(project);
  const mancanti = project.scenes.filter((s) => s.say && !voci[s.id]).map((s) => s.id);
  if (mancanti.length) throw new Error(`no audio for ${mancanti.join(", ")}: run the tts step first`);

  mkdirSync(paths.capture, { recursive: true });
  mkdirSync(paths.log, { recursive: true });
  const fileTakes = join(paths.capture, "takes.json");
  const clipDir = join(paths.capture, "clips");
  const stripDir = join(paths.capture, "strips");
  let prima = null;
  try {
    prima = JSON.parse(readFileSync(fileTakes, "utf8"));
  } catch {}

  const nuove = impronte(project, voci, { rebuildIde });
  const { start, fine, perché, avvisi } = piano(project, nuove, prima, { full, from, to });
  if (start >= project.scenes.length) {
    console.log(`  ${perché}: nothing to shoot (--full shoots it all again)`);
    return prima.takes;
  }
  console.log(start === 0 ? `  shooting every scene: ${perché}` : `  keeping ${start} take(s), shooting from "${project.scenes[start].id}": ${perché}`);
  for (const a of avvisi) console.warn(`  ! ${a}`);

  // Le clip e le strisce dalla prima scena da girare in poi se ne vanno: verranno rifatte.
  const daRifare = (f) => Number(f.slice(0, 2)) > start;
  for (const dir of [clipDir, stripDir]) {
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(dir)) if (start === 0 || daRifare(f)) rmSync(join(dir, f), { force: true });
  }

  const usa = new Set(project.scenes.map((s) => s.stage));
  const serveVscode = ["vscode", "split", "split-panel"].some((s) => usa.has(s));
  const serveApp = ["app", "split", "split-panel"].some((s) => usa.has(s));
  // music.toEnd: dove finisce il brano nel video, contato dal suo `start` e dal suo ingresso (`delay`).
  const fineBrano = project.music?.toEnd ? (await probeDuration(project.music.file)) - project.music.start + project.music.delay : null;
  const envVscode = serveVscode ? await variabiliVscode(project.vscode.env) : {};
  const fermare = [];
  const strisce = [];
  const regista = new Director(project);
  const takes = [];
  const salva = () => writeFileSync(fileTakes, JSON.stringify({ output, stage: nuove.stage, takes }, null, 2) + "\n");

  try {
    const cartella = project.fixture ? copiaFixture(project) : null;
    console.log(cartella ? `  fixture: ${project.fixture} → capture/${basename(cartella)}` : "  no fixture");

    const [vscode, app] = await Promise.all([
      serveVscode
        ? startVscode({ settings: { ...VSCODE_SETTINGS, ...project.vscode.settings }, rebuild: rebuildIde, log: join(paths.log, "vscode.log"), env: envVscode })
        : null,
      serveApp ? startApp({ dir: cartella, port: project.app.port, log: join(paths.log, "app.log") }) : null,
    ]);
    if (vscode) fermare.push(vscode.stop);
    if (app) fermare.push(app.stop);
    console.log(`  servers up${vscode ? `: VS Code ${vscode.url}` : ""}${app ? `, app ${app.url}` : ""}`);
    console.log("  setting the stage: Chrome, the workspace, the setup…"); // mezzo minuto senza altre righe

    await regista.launch({ headed });
    if (vscode) await regista.preparaVscode(vscode.url, cartella);
    if (app) await regista.preparaApp(app.url);
    if (usa.has("card")) await regista.preparaCard();
    await regista.esegui(project.setup, { stage: "vscode" });
    await regista.parcheggia();

    for (const [i, scena] of project.scenes.entries()) {
      if (i > fine) break;
      const voce = voci[scena.id];
      const minima = voce ? project.lead + voce.duration + project.tail : 0;
      const prefisso = `${String(i + 1).padStart(2, "0")}-${scena.id}`;

      // Una scena tenuta: si rifà il suo stato senza girarla. L'ultima prima del taglio va a tempo
      // pieno, segni compresi: quello che dipende dall'orologio (un terminale che si chiude da solo,
      // un reload) arriva alla scena girata come in una ripresa intera.
      if (i < start) {
        const t0 = performance.now();
        const pieno = i === start - 1;
        await regista.palco(scena);
        await regista.esegui(scena.do, scena, { veloce: !pieno });
        if (pieno) {
          const resto = Math.max(0, minima - (performance.now() - t0) / 1000) + (scena.hold ?? 0);
          await new Promise((r) => setTimeout(r, resto * 1000));
          regista.chiudiSegno();
          regista.segniBrevi.splice(0);
        }
        // L'impronta di adesso: uguale a quella di prima, o (`--from`) garantita da chi l'ha chiesto.
        takes.push({ ...prima.takes[i], fingerprint: nuove.scenes[i] });
        console.log(`  » ${prefisso} ${scena.stage} kept, ${pieno ? "played at full length" : "fast-forward"} in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
        continue;
      }

      const viste = await regista.palco(scena);
      const recorders = viste.map(
        (v) => new Recorder(regista.pages[v.page], join(clipDir, `${prefisso}-${v.page}.mp4`), { fps: output.fps, width: v.width, height: v.height }),
      );
      await Promise.all(recorders.map((r) => r.start()));
      const t0 = performance.now();
      await regista.ciak(scena);

      await regista.esegui(scena.do, scena);
      const trascorso = (performance.now() - t0) / 1000;
      let attesa = Math.max(0, minima - trascorso) + (scena.hold ?? 0);
      if (fineBrano !== null && i === project.scenes.length - 1) {
        // music.toEnd: l'ultima scena resta finché il brano finisce, e il video chiude con lui.
        const prima = takes.reduce((t, take) => t + take.duration, 0);
        const resta = fineBrano - prima - trascorso;
        if (resta > attesa) attesa = resta;
        else if (prima + trascorso + attesa > fineBrano + 0.5)
          console.warn(`    ! music.toEnd: the video runs ${(prima + trascorso + attesa - fineBrano).toFixed(1)} s past the track: silence after it`);
      }
      if (attesa > 0) await new Promise((r) => setTimeout(r, attesa * 1000));
      regista.chiudiSegno(); // il taglio: l'ultimo segno della scena finisce qui
      const segniBrevi = regista.segniBrevi.splice(0);

      const clip = await Promise.all(recorders.map((r) => r.stop()));
      const duration = Math.min(...clip.map((c) => c.duration));
      const take = {
        id: scena.id,
        stage: scena.stage,
        duration,
        clips: Object.fromEntries(viste.map((v, k) => [v.page, { file: basename(clip[k].file), x: v.x, y: v.y, width: v.width, height: v.height }])),
        audio: voce ? { file: voce.file, duration: voce.duration, offset: project.lead } : null,
        say: scena.say ?? null,
        fingerprint: nuove.scenes[i],
      };
      takes.push(take);
      salva(); // interrotta qui, la prossima ripresa riparte dalla scena dopo
      const avviso = trascorso > minima + 0.05 && voce ? ` (actions ran ${(trascorso - minima).toFixed(1)} s past the voice)` : "";
      console.log(`  ● ${prefisso} ${scena.stage} ${duration.toFixed(2)} s${avviso} · strip: capture/strips/${prefisso}.jpg`);
      for (const breve of segniBrevi) console.warn(`    ! ${breve}`);
      strisce.push(striscia(take, clipDir, join(stripDir, `${prefisso}.jpg`), output));
    }

    salva();
    if (takes.length < project.scenes.length) console.log(`  stopped after "${project.scenes[fine].id}" (--to): preview shows what there is, compose waits for the rest`);
    return takes;
  } catch (e) {
    // Uno scatto di com'era la pagina quando qualcosa non si è trovato: risparmia mezza indagine.
    for (const [nome, page] of Object.entries(regista.pages)) {
      await page.screenshot({ path: join(paths.log, `error-${nome}.png`) }).catch(() => {});
    }
    throw e;
  } finally {
    await Promise.all(strisce);
    await regista.close();
    for (const stop of fermare) stop();
  }
}
