// ffmpeg da ffmpeg-static (devDependency di site/video): nessuna installazione di sistema.
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

/** Un processo ffmpeg con stdin aperto, per chi gli scrive i frame (recorder.mjs). */
export function spawnFfmpeg(args) {
  return spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["pipe", "ignore", "pipe"] });
}

/**
 * ffmpeg fino in fondo. Rifiuta con le ultime righe di stderr se esce male.
 * @param {string[]} args
 * @returns {Promise<string>} stderr
 */
export function ffmpeg(args, { loglevel = "error" } = {}) {
  return new Promise((ok, ko) => {
    const p = spawn(ffmpegPath, ["-hide_banner", "-loglevel", loglevel, "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", ko);
    p.on("close", (code) =>
      code === 0 ? ok(err) : ko(new Error(`ffmpeg exited ${code}:\n${err.trim().split("\n").slice(-12).join("\n")}`)),
    );
  });
}

/**
 * Il loudness integrato di un file in LUFS (EBU R128), dalla misura di `loudnorm`. Null se non è
 * misurabile: il silenzio di --silent dà -inf.
 */
export async function measureLoudness(file) {
  const err = await ffmpeg(["-i", file, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { loglevel: "info" });
  const lufs = Number(JSON.parse(err.slice(err.lastIndexOf("{"))).input_i);
  return Number.isFinite(lufs) ? lufs : null;
}

/** La durata di un file in secondi, letta dall'intestazione che `ffmpeg -i` stampa (niente ffprobe). */
export async function probeDuration(file) {
  const err = await new Promise((ok) => {
    const p = spawn(ffmpegPath, ["-hide_banner", "-i", file], { stdio: ["ignore", "ignore", "pipe"] });
    let e = "";
    p.stderr.on("data", (d) => (e += d));
    p.on("close", () => ok(e));
  });
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(err);
  if (!m) throw new Error(`cannot read the duration of ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}
