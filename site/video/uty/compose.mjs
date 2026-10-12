// Il montaggio: da capture/takes.json (record.mjs) e audio/ (tts.mjs) al video.
//
// Ogni scena diventa un segmento della durata esatta della sua ripresa: le clip in scala (due
// affiancate per "split"), l'ultimo frame tenuto se la clip è corta, la voce spostata di `lead`.
// I segmenti tengono l'audio in PCM (mkv), così il concat è esatto al campione e l'AAC si
// codifica una volta sola, alla fine.
//
// La voce: le frasi, generate una per una, escono a volumi diversi. Qui ognuna va a VOCE_LUFS,
// coi picchi sotto PICCO e BORDO secondi di dissolvenza ai lati (niente click dove il taglio di
// tts.mjs incontra il silenzio). Misurato qui e non in tts: si ritocca senza ripagare la voce.
//
// La musica (music.mjs), se il progetto ne ha una, entra all'ultimo passo: sotto la voce già
// livellata, con la curva che la abbassa intorno a ogni battuta.
//
//   compose → output/<progetto>.mp4, output/<progetto>.srt, output/poster.jpg, output/credits.txt
//   preview → preview/<progetto>.mp4 a 960x540, veloce, e preview/contact.jpg: un fotogramma a
//             metà di ogni scena, per controllare lo storyboard a colpo d'occhio
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ffmpeg, measureLoudness } from "./ffmpeg.mjs";
import { musicFilter } from "./music.mjs";

const pari = (n) => Math.round(n / 2) * 2;
const DISSOLVENZA_IN = 0.5;
const DISSOLVENZA_OUT = 0.7;
const VOCE_LUFS = -16; // il loudness di ogni frase: quello abituale del parlato
const PICCO = 0.84; // circa -1,5 dBFS: sopra lo 0 l'AAC distorce
const BORDO = 0.01; // secondi di dissolvenza in testa e in coda a ogni frase

export async function compose(project, { preview = false } = {}) {
  const { paths } = project;
  const fileTakes = join(paths.capture, "takes.json");
  if (!existsSync(fileTakes)) throw new Error("no capture/takes.json: run the record step first");
  const { output, takes } = JSON.parse(readFileSync(fileTakes, "utf8"));
  // Una ripresa fermata (`--to`, o interrotta) non copre tutte le scene: la prova sì, il montaggio no.
  const ids = project.scenes.map((s) => s.id);
  const girate = takes.map((t) => t.id);
  if (girate.join() !== ids.join()) {
    const dice = ids.join().startsWith(girate.join())
      ? `capture/takes.json stops after "${girate.at(-1) ?? "nothing"}" (${girate.length} of ${ids.length} scenes)`
      : `capture/takes.json doesn't match the scenes of storyboard.yaml (${girate.join(", ")})`;
    if (!preview) throw new Error(`${dice}: record the rest first`);
    console.warn(`  ! ${dice}: previewing what there is`);
  }
  const scala = preview ? 960 / output.width : 1;
  const W = pari(output.width * scala);
  const H = pari(output.height * scala);
  const fps = output.fps;

  const segDir = join(paths.capture, preview ? "segments-preview" : "segments");
  rmSync(segDir, { recursive: true, force: true });
  mkdirSync(segDir, { recursive: true });

  // Il guadagno di ogni frase verso VOCE_LUFS, entro ±12 dB; 0 per il silenzio di --silent.
  const guadagni = {};
  for (const take of takes) {
    if (!take.audio) continue;
    const lufs = await measureLoudness(join(paths.audio, take.audio.file));
    guadagni[take.id] = lufs === null ? 0 : Math.max(-12, Math.min(12, VOCE_LUFS - lufs));
  }
  console.log(`  voice to ${VOCE_LUFS} LUFS: ${Object.entries(guadagni).map(([id, g]) => `${id} ${g >= 0 ? "+" : ""}${g.toFixed(1)} dB`).join(", ")}`);

  const lista = [];
  for (const [i, take] of takes.entries()) {
    const file = join(segDir, `${String(i + 1).padStart(2, "0")}-${take.id}.mkv`);
    const guadagno = guadagni[take.id] ?? 0;
    await segmento(take, { file, W, H, fps, scala, primo: i === 0, ultimo: i === takes.length - 1, preview, paths, guadagno });
    lista.push(`file '${file.replace(/\\/g, "/")}'`);
  }
  const fileLista = join(segDir, "list.txt");
  writeFileSync(fileLista, lista.join("\n") + "\n");

  const dir = preview ? paths.preview : paths.output;
  mkdirSync(dir, { recursive: true });
  const video = join(dir, `${project.name}.mp4`);

  const inizi = [];
  takes.reduce((t, take) => (inizi.push(t), t + take.duration), 0);
  const totale = takes.reduce((t, take) => t + take.duration, 0);

  const finale = ["-f", "concat", "-safe", "0", "-i", fileLista];
  const { music } = project;
  if (music) {
    // Il brano in loop (se è più corto del video) da `start`, poi la sua curva, poi sotto la voce.
    const lufsBrano = (await measureLoudness(music.file)) ?? VOCE_LUFS;
    const filtro = musicFilter({ music, takes, inizi, totale, lufsBrano, voceLufs: VOCE_LUFS });
    finale.push(
      "-stream_loop", "-1", "-ss", String(music.start), "-i", music.file,
      "-filter_complex", `[1:a]${filtro}[m];[0:a][m]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89:level=false:latency=true[a]`,
      "-map", "0:v", "-map", "[a]",
    );
    console.log(`  music: ${music.track}, ${music.max} dB under the voice, ${music.min} while it speaks`);
  }
  await ffmpeg([...finale, "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", video]);

  if (preview) {
    await fogliDiContatto(takes, inizi, video, dir);
  } else {
    writeFileSync(join(dir, `${project.name}.srt`), sottotitoli(takes, inizi));
    // Da incollare nella descrizione del video: la licenza della musica chiede l'attribuzione.
    if (music) writeFileSync(join(dir, "credits.txt"), music.credits.join("\n") + "\n");
    else rmSync(join(dir, "credits.txt"), { force: true });
    if (project.poster) {
      const id = project.poster.scene ?? project.poster;
      const k = takes.findIndex((t) => t.id === id);
      const t = inizi[k] + (project.poster.at ?? 1);
      await ffmpeg(["-ss", t.toFixed(3), "-i", video, "-frames:v", "1", "-q:v", "3", join(dir, "poster.jpg")]);
    }
  }
  return { video, duration: totale };
}

async function segmento(take, { file, W, H, fps, scala, primo, ultimo, preview, paths, guadagno }) {
  const D = take.duration.toFixed(4);
  const input = [];
  const filtri = [];
  const pagine = Object.entries(take.clips);

  for (const [, clip] of pagine) input.push("-i", join(paths.capture, "clips", clip.file));
  const coda = `fps=${fps},tpad=stop_mode=clone:stop_duration=5,trim=duration=${D},setpts=PTS-STARTPTS`;
  let video;
  if (pagine.length === 1) {
    video = `[0:v]scale=${W}:${H}:flags=lanczos,setsar=1,${coda}`;
  } else {
    const wl = pari(pagine[0][1].width * scala);
    filtri.push(`[0:v]scale=${wl}:${H}:flags=lanczos,setsar=1[l]`, `[1:v]scale=${W - wl}:${H}:flags=lanczos,setsar=1[r]`);
    video = `[l][r]hstack=inputs=2,${coda}`;
  }
  if (primo) video += `,fade=t=in:st=0:d=${DISSOLVENZA_IN}`;
  if (ultimo) video += `,fade=t=out:st=${(take.duration - DISSOLVENZA_OUT).toFixed(3)}:d=${DISSOLVENZA_OUT}`;
  filtri.push(`${video}[v]`);

  const k = pagine.length;
  const formato = "aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo";
  if (take.audio) {
    input.push("-i", join(paths.audio, take.audio.file));
    const ms = Math.round(take.audio.offset * 1000);
    const voce = [
      "aresample=48000",
      `afade=t=in:d=${BORDO}`,
      `afade=t=out:st=${Math.max(0, take.audio.duration - BORDO).toFixed(3)}:d=${BORDO}`,
      `volume=${guadagno.toFixed(2)}dB`,
      `alimiter=limit=${PICCO}:level=false:latency=true`,
      "aformat=sample_fmts=s16:channel_layouts=stereo",
    ].join(",");
    filtri.push(`[${k}:a]${voce},adelay=delays=${ms}:all=1,apad,atrim=duration=${D},asetpts=PTS-STARTPTS[a]`);
  } else {
    input.push("-f", "lavfi", "-t", D, "-i", "anullsrc=r=48000:cl=stereo");
    filtri.push(`[${k}:a]${formato},atrim=duration=${D}[a]`);
  }

  await ffmpeg([
    ...input,
    "-filter_complex", filtri.join(";"),
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", preview ? "ultrafast" : "slow", "-crf", preview ? "28" : "18",
    "-pix_fmt", "yuv420p", "-r", String(fps), "-g", String(fps * 2),
    "-c:a", "pcm_s16le",
    file,
  ]);
}

// ------------------------------------------------------------ sottotitoli

function tempo(s) {
  const ms = Math.round(s * 1000);
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

/** Al massimo due righe di ~42 caratteri per cue: le frasi lunghe si dividono a tempo proporzionale. */
function sottotitoli(takes, inizi) {
  const cue = [];
  for (const [i, take] of takes.entries()) {
    if (!take.say || !take.audio) continue;
    const testo = take.say.replace(/\s+/g, " ").trim();
    const frasi = testo.match(/[^.!?]+[.!?]*\s*/g).map((f) => f.trim()).filter(Boolean);
    const pezzi = [];
    for (const f of frasi) {
      const ultimo = pezzi[pezzi.length - 1];
      if (ultimo && ultimo.length + f.length + 1 <= 84) pezzi[pezzi.length - 1] = `${ultimo} ${f}`;
      else pezzi.push(f);
    }
    const lettere = pezzi.reduce((n, p) => n + p.length, 0);
    let t = inizi[i] + take.audio.offset;
    for (const p of pezzi) {
      const d = (take.audio.duration * p.length) / lettere;
      cue.push([t, t + d, a_capo(p)]);
      t += d;
    }
  }
  return cue.map(([a, b, testo], n) => `${n + 1}\n${tempo(a)} --> ${tempo(b)}\n${testo}\n`).join("\n");
}

function a_capo(testo, max = 42) {
  if (testo.length <= max) return testo;
  // Il punto di taglio più vicino a metà, su uno spazio.
  const meta = testo.length / 2;
  let migliore = -1;
  for (let i = 0; i < testo.length; i++) if (testo[i] === " " && (migliore < 0 || Math.abs(i - meta) < Math.abs(migliore - meta))) migliore = i;
  return migliore < 0 ? testo : `${testo.slice(0, migliore)}\n${testo.slice(migliore + 1)}`;
}

// ------------------------------------------------------------ anteprima

async function fogliDiContatto(takes, inizi, video, dir) {
  const thumbDir = join(dir, "thumbs");
  rmSync(thumbDir, { recursive: true, force: true });
  mkdirSync(thumbDir, { recursive: true });
  for (const [i, take] of takes.entries()) {
    const t = inizi[i] + take.duration / 2;
    await ffmpeg(["-ss", t.toFixed(3), "-i", video, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", join(thumbDir, `${String(i + 1).padStart(2, "0")}-${take.id}.jpg`)]);
  }
  // tile vuole i fotogrammi come un flusso solo: su Windows ffmpeg non ha il glob, quindi una lista concat.
  const lista = join(thumbDir, "list.txt");
  writeFileSync(lista, takes.map((t, i) => `file '${join(thumbDir, `${String(i + 1).padStart(2, "0")}-${t.id}.jpg`).replace(/\\/g, "/")}'\nduration 1`).join("\n") + "\n");
  const colonne = Math.min(3, takes.length);
  const righe = Math.ceil(takes.length / colonne);
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", lista, "-vf", `tile=${colonne}x${righe}:padding=6:margin=6:color=0x0b0f0d`, "-frames:v", "1", "-q:v", "3", join(dir, "contact.jpg")]);
}
