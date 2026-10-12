// La musica di fondo: un brano di commons/bkmusic sotto la voce, che si abbassa prima di ogni
// battuta e quasi sparisce mentre si parla (il "ducking" del voice over), e i suoi credits.
//
// Niente compressore che insegue la voce: i tempi delle battute sono in capture/takes.json, quindi
// la curva del volume si scrive esatta, in dB, e ffmpeg la applica (volume con eval=frame). I livelli
// sono in dB sotto la voce (VOCE_LUFS in compose.mjs): il brano si misura e si porta lì, qualunque
// sia il suo master.
//
// I brani restano fuori da git (.gitignore); commons/bkmusic/credits.md no: per ogni brano una riga
// dell'elenco puntato che comincia col suo nome (autore, titolo, link), più le righe comuni a tutti
// (la licenza, il fornitore). I credits vanno sulla card di chiusura e in output/credits.txt.
//
// LINKED-DATA: le chiavi e i default di `music` = README.md § "Music".
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const BKMUSIC_DIR = fileURLToPath(new URL("../commons/bkmusic/", import.meta.url));
const AUDIO = [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".opus"];

export const MUSIC_DEFAULTS = {
  track: null, // il nome del file in commons/bkmusic, senza estensione
  max: -8, // dB sotto la voce, quando nessuno parla
  min: -26, // dB sotto la voce, mentre parla
  before: 0.6, // secondi: comincia a scendere così prima di una battuta
  after: 1, // secondi: per risalire dopo
  bridge: 2, // le pause più corte di così restano giù: niente su e giù tra due battute vicine
  start: 0, // secondi dall'inizio del brano
  fade: [1.5, 4], // dissolvenza in entrata all'inizio del video, in uscita alla fine (almeno FINE_MINIMA)
};
// La musica si spegne negli ultimi 4 secondi almeno: una chiusura più corta suona troncata.
export const FINE_MINIMA = 4;
const CHIAVI = Object.keys(MUSIC_DEFAULTS);

/** Il file di un brano: il nome in commons/bkmusic, senza estensione e senza badare alle maiuscole. */
export function trackFile(track) {
  if (!existsSync(BKMUSIC_DIR)) return null;
  const voluto = String(track).trim().toLowerCase();
  const nome = readdirSync(BKMUSIC_DIR).find(
    (f) => AUDIO.includes(extname(f).toLowerCase()) && [basename(f, extname(f)), f].some((n) => n.toLowerCase() === voluto),
  );
  return nome ? join(BKMUSIC_DIR, nome) : null;
}

/**
 * I credits di un brano, da credits.md: la sua riga dell'elenco puntato, poi le righe comuni (ogni
 * altra riga di testo che non è un titolo). [] se il brano non ha la sua riga.
 */
export function trackCredits(track) {
  const file = join(BKMUSIC_DIR, "credits.md");
  if (!existsSync(file)) return [];
  const voluto = String(track).trim().toLowerCase();
  let suo = null;
  const comuni = [];
  for (const grezza of readFileSync(file, "utf8").split(/\r?\n/)) {
    const riga = grezza.trim().replace(/^\\#/, "#"); // "\#" è un # scritto per non fare un titolo
    if (!riga || riga.startsWith("#") || /^([-*_])\1{2,}$/.test(riga)) continue; // titoli e separatori
    const voce = /^[*+-]\s+(.*)$/.exec(riga);
    if (!voce) comuni.push(riga);
    else if (voce[1].toLowerCase().startsWith(voluto)) suo = voce[1].trim();
  }
  return suo ? [`Music: ${suo}`, ...comuni] : [];
}

/**
 * La `music` dello YAML con i default, il file e i credits; o gli errori.
 * @returns {{ music: object | null, errori: string[] }}
 */
export function resolveMusic(raw) {
  if (raw == null) return { music: null, errori: [] };
  if (typeof raw === "string") raw = { track: raw };
  if (typeof raw !== "object" || Array.isArray(raw)) return { music: null, errori: ["music: must be a track name or a map"] };
  const errori = [];
  const ignote = Object.keys(raw).filter((k) => !CHIAVI.includes(k));
  if (ignote.length) errori.push(`music: unknown keys ${ignote.join(", ")} (allowed: ${CHIAVI.join(", ")})`);
  const music = { ...MUSIC_DEFAULTS, ...raw };
  music.fade = [].concat(music.fade);
  if (music.fade.length === 1) music.fade.push(music.fade[0]);
  for (const k of ["max", "min", "before", "after", "bridge", "start"])
    if (typeof music[k] !== "number") errori.push(`music.${k}: must be a number`);
  if (music.min > music.max) errori.push("music: min must not be above max");
  if (!(music.fade[1] >= FINE_MINIMA)) errori.push(`music.fade: the fade out lasts at least ${FINE_MINIMA} s, got ${music.fade[1]}`);
  if (!music.track) errori.push("music.track: which track of commons/bkmusic");
  else {
    music.file = trackFile(music.track);
    if (!music.file) errori.push(`music.track: no "${music.track}" in commons/bkmusic (the file name, without extension)`);
    music.credits = trackCredits(music.track);
    if (!music.credits.length) errori.push(`music.track: commons/bkmusic/credits.md has no "* ${music.track} …" line: the credits are owed`);
  }
  return { music: errori.length ? null : music, errori };
}

/**
 * Il filtro della musica nel montaggio, dall'ingresso del brano a una traccia pronta da mescolare.
 * @param {object} p
 * @param {object} p.music - resolveMusic().music
 * @param {{ audio: { duration: number, offset: number } | null }[]} p.takes
 * @param {number[]} p.inizi - l'inizio di ogni scena nel video
 * @param {number} p.totale - la durata del video
 * @param {number} p.lufsBrano - il loudness misurato del brano
 * @param {number} p.voceLufs - il livello della voce (VOCE_LUFS)
 */
export function musicFilter({ music, takes, inizi, totale, lufsBrano, voceLufs }) {
  // Le battute, unite quando la pausa tra due è più corta di `bridge`.
  const battute = [];
  takes.forEach((take, i) => {
    if (!take.audio) return;
    const s = inizi[i] + take.audio.offset;
    const e = s + take.audio.duration;
    const ultima = battute.at(-1);
    if (ultima && s - ultima.e < music.bridge) ultima.e = e;
    else battute.push({ s, e });
  });
  // La curva in dB rispetto a `max`: 0 nelle pause, `min - max` sotto le battute, rampe in mezzo.
  const giu = music.min - music.max;
  const n = (x) => x.toFixed(3);
  const pezzi = battute.map(({ s, e }) => {
    const a = Math.max(0, s - music.before);
    const b = e + music.after;
    return `if(lt(t,${n(a)}),0,if(lt(t,${n(s)}),${giu}*(t-${n(a)})/${n(Math.max(0.01, s - a))},if(lt(t,${n(e)}),${giu},if(lt(t,${n(b)}),${giu}*(1-(t-${n(e)})/${n(Math.max(0.01, b - e))}),0))))`;
  });
  const curva = pezzi.length ? pezzi.reduce((acc, p) => `min(${acc},${p})`) : "0";
  const guadagno = voceLufs + music.max - lufsBrano; // il brano a `max` sotto la voce
  const [dentro, fuori] = music.fade;
  return [
    "aresample=48000",
    "aformat=sample_fmts=fltp:channel_layouts=stereo",
    `atrim=duration=${n(totale)}`,
    "asetpts=PTS-STARTPTS",
    `volume=${guadagno.toFixed(2)}dB`,
    `volume='pow(10,(${curva})/20)':eval=frame`,
    `afade=t=in:d=${dentro}`,
    `afade=t=out:st=${n(Math.max(0, totale - fuori))}:d=${fuori}`,
  ].join(",");
}
