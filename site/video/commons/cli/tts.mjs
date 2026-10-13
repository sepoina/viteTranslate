// La voce: una traccia WAV per ogni scena con `say`, in <progetto>/audio/<id>.wav.
//
// OpenRouter, POST /api/v1/audio/speech (compatibile con l'Audio Speech di OpenAI): risponde coi
// byte dell'audio, non con un JSON. Con `response_format: "pcm"` sono campioni 16 bit little
// endian, mono; i modelli Gemini TTS li danno a 24 kHz (`voice.sampleRate` se un altro modello
// cambia). Qui si incartano in un WAV e si tolgono i silenzi in testa e in coda: i tempi delle
// scene li decide la durata vera della frase. La ripresa intera resta in audio/<id>.raw.wav: il
// taglio si rifà da lì a ogni passo tts, quindi i suoi margini si ritoccano senza ripagare la voce.
//
// audio/manifest.json ricorda per ogni scena l'hash di testo + voce: si paga solo la frase cambiata.
// Le `instructions` di una scena si aggiungono a quelle della voce, non le sostituiscono: la persona
// resta la stessa in ogni frase, la scena aggiunge solo la sua regia.
// `--silent` scrive silenzio della durata stimata, per provare riprese e montaggio senza chiave; le
// frasi che hanno già la voce vera, e non sono cambiate, la tengono.
// La chiave è quella dell'LLM della libreria (lib/dev/llm/apiKey.js): variabile d'ambiente,
// .env.local / .env in site/video, keyring.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveApiKey, redact } from "../../../../lib/dev/llm/apiKey.js";
import { VIDEO_DIR } from "./storyboard.mjs";

const ENDPOINT = "https://openrouter.ai/api/v1/audio/speech";
// Parole al secondo di una voce calma: la stima di --silent, e il controllo del sampleRate.
const PAROLE_AL_SECONDO = 2.6;

/** Un WAV PCM 16 bit dai campioni grezzi. */
export function wavFromPcm(pcm, sampleRate, channels = 1) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * channels * 2, 28);
  h.writeUInt16LE(channels * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/**
 * Toglie il silenzio in testa e in coda. Lascia `prima` secondi davanti alla prima parola (il
 * respiro, che sta sotto la soglia) e `dopo` secondi dietro l'ultima (la sua coda naturale).
 * @param {Buffer} pcm - 16 bit LE mono
 */
export function trimSilence(pcm, sampleRate, { soglia = 0.012, prima = 0.15, dopo = 0.1 } = {}) {
  const n = Math.floor(pcm.length / 2);
  const limite = soglia * 32768;
  let primo = 0;
  while (primo < n && Math.abs(pcm.readInt16LE(primo * 2)) < limite) primo++;
  let ultimo = n - 1;
  while (ultimo > primo && Math.abs(pcm.readInt16LE(ultimo * 2)) < limite) ultimo--;
  if (primo >= n) return pcm; // tutto silenzio: meglio non toccarlo e accorgersene dopo
  const davanti = Math.round(prima * sampleRate);
  const dietro = Math.round(dopo * sampleRate);
  return pcm.subarray(Math.max(0, primo - davanti) * 2, Math.min(n, ultimo + 1 + dietro) * 2);
}

function parole(testo) {
  return testo.trim().split(/\s+/).filter(Boolean).length;
}

async function sintetizza({ testo, voice, instructions, key }) {
  const body = { model: voice.model, input: testo, voice: voice.voice, response_format: "pcm" };
  if (instructions) body.instructions = instructions;
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "viteTranslate video",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const testoErrore = await r.text().catch(() => "");
    throw new Error(redact(`TTS ${r.status} for "${testo.slice(0, 40)}…": ${testoErrore.slice(0, 400)}`, key));
  }
  return Buffer.from(await r.arrayBuffer());
}

/**
 * Genera le tracce che mancano o sono cambiate.
 * @param {object} project - loadProject()
 * @param {{ silent?: boolean, force?: boolean }} opzioni
 * @returns {Promise<Record<string, { file: string, duration: number, silent: boolean, hash: string }>>}
 */
export async function runTts(project, { silent = false, force = false } = {}) {
  const { voice, paths } = project;
  mkdirSync(paths.audio, { recursive: true });
  const fileManifest = join(paths.audio, "manifest.json");
  const vecchio = existsSync(fileManifest) ? JSON.parse(readFileSync(fileManifest, "utf8")) : {};
  const manifest = {};
  let key = null;

  for (const scena of project.scenes) {
    if (!scena.say) continue;
    const testo = String(scena.say).replace(/\s+/g, " ").trim();
    const instructions = [voice.instructions, scena.instructions].filter(Boolean).join(" ");
    const hashDi = (s) =>
      createHash("sha1")
        .update(JSON.stringify({ m: voice.model, v: voice.voice, i: instructions, r: voice.sampleRate, t: testo, s }))
        .digest("hex")
        .slice(0, 12);
    const hash = hashDi(silent);
    const file = `${scena.id}.wav`;
    const traccia = join(paths.audio, file);
    const grezzo = join(paths.audio, `${scena.id}.raw.wav`);
    const salva = (pcm) => {
      writeFileSync(traccia, wavFromPcm(pcm, voice.sampleRate));
      return pcm.length / 2 / voice.sampleRate;
    };
    const prima = vecchio[scena.id];
    // --silent non scrive sopra una voce vera che vale ancora (stessa frase, stessa voce): una prova
    // non costa la voce già pagata. Le frasi cambiate, quelle sì, diventano silenzio.
    const veraBuona = silent && prima && !prima.silent && prima.hash === hashDi(false);
    if (!force && (prima?.hash === hash || veraBuona) && existsSync(traccia)) {
      // Già pagata. Con la ripresa intera il taglio si rifà, coi margini di adesso (il WAV è nostro:
      // l'intestazione è di 44 byte).
      const ritaglio = !prima.silent && existsSync(grezzo);
      const duration = ritaglio ? salva(trimSilence(readFileSync(grezzo).subarray(44), voice.sampleRate)) : prima.duration;
      manifest[scena.id] = { ...prima, duration };
      console.log(`  = ${scena.id} (${duration.toFixed(2)} s${prima.silent ? ", silent" : ""})`);
      continue;
    }

    let pcm;
    if (silent) {
      const secondi = parole(testo) / PAROLE_AL_SECONDO + 0.3;
      pcm = Buffer.alloc(Math.round(secondi * voice.sampleRate) * 2);
      rmSync(grezzo, { force: true }); // quella di una voce vera non vale per il silenzio
    } else {
      key ??= (await resolveApiKey({ connection: { apiKeyEnv: voice.apiKeyEnv }, baseDir: VIDEO_DIR })).key;
      const intera = await sintetizza({ testo, voice, instructions, key });
      writeFileSync(grezzo, wavFromPcm(intera, voice.sampleRate));
      pcm = trimSilence(intera, voice.sampleRate);
    }
    const duration = salva(pcm);
    manifest[scena.id] = { file, duration, silent, hash };
    console.log(`  + ${scena.id} (${duration.toFixed(2)} s${silent ? ", silent" : ""})`);

    // Un sampleRate sbagliato non dà errori: dà una voce da paperino o da orco, e tempi sbagliati.
    const ritmo = parole(testo) / duration;
    if (!silent && (ritmo < 1.2 || ritmo > 5))
      console.warn(`    ! ${ritmo.toFixed(1)} words/s: is voice.sampleRate (${voice.sampleRate}) right for ${voice.model}?`);
  }

  writeFileSync(fileManifest, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

export function readManifest(project) {
  const f = join(project.paths.audio, "manifest.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
}
