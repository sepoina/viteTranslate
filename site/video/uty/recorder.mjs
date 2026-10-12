// Registra una pagina in un mp4 a frame rate costante.
//
// Il recordVideo di Playwright ha un bitrate fisso e basso: il testo del codice si impasta. Qui
// invece lo screencast di Chrome (CDP Page.startScreencast) manda un JPEG di qualità alta a ogni
// cambiamento della pagina; un orologio scrive in ffmpeg l'ultimo arrivato `fps` volte al
// secondo. Il numero di frame scritti segue il tempo vero: la clip dura quanto la scena, e
// il montaggio può fidarsi delle durate.
import { spawnFfmpeg } from "./ffmpeg.mjs";

export class Recorder {
  /**
   * @param {import("playwright-core").Page} page
   * @param {string} file - l'mp4 da scrivere
   * @param {{ fps: number, width: number, height: number }} formato - in pixel del video
   */
  constructor(page, file, { fps, width, height }) {
    Object.assign(this, { page, file, fps, width, height });
    this.ultimo = null;
    this.scritti = 0;
  }

  async start() {
    const { page, fps, width, height } = this;
    this.cdp = await page.context().newCDPSession(page);
    this.cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
      this.ultimo = Buffer.from(data, "base64");
      this.cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    this.ff = spawnFfmpeg([
      "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(fps), "-i", "-",
      "-vf", `scale=${width}:${height}:flags=lanczos,format=yuv420p`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-r", String(fps), this.file,
    ]);
    this.errFf = "";
    this.ff.stderr.on("data", (d) => (this.errFf += d));
    this.chiuso = new Promise((ok) => this.ff.on("close", ok));

    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: width, maxHeight: height });
    // Di solito il primo frame arriva subito; su una pagina ferma può non arrivare mai.
    for (let i = 0; i < 30 && !this.ultimo; i++) await new Promise((r) => setTimeout(r, 25));
    this.ultimo ??= await page.screenshot({ type: "jpeg", quality: 92 });

    this.t0 = performance.now();
    this.timer = setInterval(() => this.pompa(), 1000 / fps / 2);
  }

  pompa() {
    const dovuti = Math.floor(((performance.now() - this.t0) / 1000) * this.fps);
    while (this.scritti < dovuti) {
      this.ff.stdin.write(this.ultimo);
      this.scritti++;
    }
  }

  /** @returns {Promise<{ file: string, duration: number }>} */
  async stop() {
    this.pompa();
    clearInterval(this.timer);
    await this.cdp.send("Page.stopScreencast").catch(() => {});
    await this.cdp.detach().catch(() => {});
    this.ff.stdin.end();
    const code = await this.chiuso;
    if (code !== 0) throw new Error(`recording ${this.file} failed (ffmpeg ${code}): ${this.errFf.slice(-400)}`);
    return { file: this.file, duration: this.scritti / this.fps };
  }
}
