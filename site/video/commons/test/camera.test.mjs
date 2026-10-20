// camera.mjs: le funzioni pure, il filtro provato da ffmpeg vero, e la GIF e il video web di compose.mjs. Niente Chrome.
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CAMERA_MIN, PIENO, TORRE, controllaCamera, daRect, filtroCamera, filtroPan, finestraTorre, inquadra, posizione, ultima } from "../cli/camera.mjs";
import { gif, videoWeb } from "../cli/compose.mjs";
import { ffmpeg, probeDuration } from "../cli/ffmpeg.mjs";

const TMP = mkdtempSync(join(tmpdir(), "vt-camera-"));
after(() => rmSync(TMP, { recursive: true, force: true }));

const box = (x, y, width, height) => ({ x, y, width, height });
const e169 = (r) => Math.abs(r.width * 9 - r.height * 16) < 0.1;
const dentro = (r) => r.x >= 0 && r.y >= 0 && r.x + r.width <= 1920 + 0.01 && r.y + r.height <= 1080 + 0.01;

describe("inquadra", () => {
  test("a small box gets the narrowest frame", () => {
    const r = inquadra(box(100, 100, 200, 40));
    assert.equal(r.width, CAMERA_MIN);
    assert.equal(r.height, 270);
  });
  test("a wide box takes its width plus the pad on both sides", () => {
    assert.equal(inquadra(box(400, 400, 1000, 100)).width, 1080);
  });
  test("a tall box is framed by its height, in 16:9", () => {
    const r = inquadra(box(900, 200, 100, 600));
    assert.equal(r.width, Math.round(((600 + 80) * 16) / 9 * 100) / 100);
  });
  test("width wins over the box and is centered on it", () => {
    const r = inquadra(box(900, 500, 100, 40), { width: 960 });
    assert.equal(r.width, 960);
    assert.equal(r.x + r.width / 2, 950);
  });
  test("near the edges the frame stays inside the 1920 × 1080 frame", () => {
    for (const b of [box(0, 0, 50, 50), box(1900, 1060, 20, 20), box(1800, 0, 120, 40), box(0, 1000, 80, 80)]) assert.ok(dentro(inquadra(b)), JSON.stringify(b));
  });
  test("every result is 16:9", () => {
    for (const b of [box(10, 10, 5, 5), box(300, 200, 1500, 300), box(100, 100, 100, 900)]) assert.ok(e169(inquadra(b)), JSON.stringify(b));
  });
});

describe("daRect", () => {
  test("[x, y, width] gets its height from 16:9", () => {
    assert.deepEqual(daRect([100, 50, 960]), { x: 100, y: 50, width: 960, height: 540 });
  });
});

describe("posizione", () => {
  const k1 = { t: 1, x: 480, y: 270, width: 960, height: 540, time: 0, ease: "linear" };
  test("before the first key: the full frame", () => {
    assert.deepEqual(posizione([], 5), PIENO);
    assert.deepEqual(posizione([k1], 0.5), PIENO);
  });
  test("a key with time 0 is exact at its instant", () => {
    assert.deepEqual(posizione([k1], 1), { x: 480, y: 270, width: 960, height: 540 });
  });
  test("linear: the mean halfway", () => {
    const r = posizione([{ ...k1, time: 1 }], 1.5);
    assert.deepEqual(r, { x: 240, y: 135, width: 1440, height: 810 });
  });
  test("cubic: the mean halfway, less than a quarter of the way at a quarter of the time", () => {
    const k = { ...k1, time: 1, ease: "cubic" };
    assert.equal(posizione([k], 1.5).x, 240);
    assert.ok(posizione([k], 1.25).x < 480 / 4);
  });
  test("after the end: the target", () => {
    assert.deepEqual(posizione([{ ...k1, time: 0.5 }], 9), { x: 480, y: 270, width: 960, height: 540 });
  });
  test("a second key starts from the first one's target", () => {
    const k2 = { t: 3, x: 0, y: 0, width: 1920, height: 1080, time: 1, ease: "linear" };
    assert.deepEqual(posizione([k1, k2], 3.5), { x: 240, y: 135, width: 1440, height: 810 });
  });
});

describe("ultima", () => {
  test("null for null and for nothing", () => {
    assert.equal(ultima(null), null);
    assert.equal(ultima([]), null);
  });
  test("the last key without t, time and ease", () => {
    assert.deepEqual(ultima([{ t: 0, x: 0, y: 0, width: 1920, height: 1080, time: 0 }, { t: 2, x: 1, y: 2, width: 960, height: 540, time: 0.5, ease: "sine" }]), { x: 1, y: 2, width: 960, height: 540 });
  });
});

describe("controllaCamera", () => {
  test("full, selection, keep and a target pass", () => {
    for (const arg of ["full", "selection", "keep", { text: "x" }, { selector: "a", width: 960, time: 0, ease: "sine" }, { rect: [0, 0, 960] }])
      assert.deepEqual(controllaCamera(arg, "c"), [], JSON.stringify(arg));
  });
  test("a tower window passes, an unknown one doesn't", () => {
    for (const w of ["preview", "code", "terminal"]) assert.deepEqual(controllaCamera({ window: w, time: 0.8 }, "c"), [], w);
    assert.match(controllaCamera({ window: "sidebar" }, "c").join("\n"), /window is one of preview, code, terminal/);
    assert.match(controllaCamera({ window: "code", text: "a" }, "c").join("\n"), /exactly one target/);
  });
  test("each of these says what is wrong", () => {
    const casi = [
      [{}, /exactly one target/],
      [{ text: "a", rect: [0, 0, 960] }, /exactly one target/],
      [{ text: "a", zoom: 2 }, /unknown keys zoom/],
      [{ text: "a", width: 100 }, /width is between/],
      [{ rect: [1500, 0, 960] }, /rect must lie inside/],
      [{ text: "a", ease: "bounce" }, /ease is one of/],
      [{ text: "a", time: -1 }, /time is seconds/],
      [null, /full, selection, keep/],
      [[1], /full, selection, keep/],
    ];
    for (const [arg, re] of casi) assert.match(controllaCamera(arg, "c").join("\n"), re, JSON.stringify(arg));
  });
});

describe("filtroCamera con ffmpeg vero", () => {
  const chiavi = [
    { t: 0, x: 0, y: 0, width: 1920, height: 1080, time: 0, ease: "linear" },
    { t: 0.5, x: 480, y: 270, width: 960, height: 540, time: 0.5, ease: "cubic" },
  ];
  test("one key with time 0 needs no curve", () => {
    assert.ok(!filtroCamera([chiavi[0]], { width: 1920, height: 1080, fps: 30 }).includes("clip("));
  });
  test("two keys: ffmpeg accepts it, the clip keeps its duration", async () => {
    const file = join(TMP, "camera.mp4");
    const filtro = filtroCamera(chiavi, { width: 1920, height: 1080, fps: 30 });
    await ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=2", "-vf", filtro, "-pix_fmt", "yuv420p", file]);
    const durata = await probeDuration(file);
    assert.ok(Math.abs(durata - 2) <= 1 / 30 + 0.05, `duration ${durata}`);
  });
});

describe("la torre", () => {
  test("three 16:9 windows, 40 px of black between them, one above the other", () => {
    assert.deepEqual(TORRE, { width: 1920, height: 3 * 1080 + 80 });
    assert.deepEqual(finestraTorre("preview"), PIENO);
    assert.deepEqual(finestraTorre("code"), { x: 0, y: 1120, width: 1920, height: 1080 });
    assert.deepEqual(finestraTorre("terminal"), { x: 0, y: 2240, width: 1920, height: 1080 });
    assert.throws(() => finestraTorre("sidebar"), /no window "sidebar"/);
  });
  test("with no keys the camera sits on the top window", () => {
    assert.match(filtroPan(null, { width: 1920, height: 1080, fps: 30 }), /^crop=w=1920:h=1080:x=0:y='0',setpts/);
  });

  // Un quadro alto con tre bande, rossa (anteprima), verde (codice), blu (terminale): si guarda il colore della finestra.
  const colore = async (file, t) => {
    const ppm = join(TMP, `px-${t}.ppm`);
    await ffmpeg(["-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=1:1:flags=area", "-pix_fmt", "rgb24", ppm]);
    const b = readFileSync(ppm);
    const [r, g, bl] = b.subarray(b.length - 3);
    return r > 150 && g < 100 && bl < 100 ? "red" : g > 100 && r < 100 && bl < 100 ? "green" : bl > 150 && r < 100 && g < 100 ? "blue" : `?(${r},${g},${bl})`;
  };
  test("a cut to the terminal, a slide to the code: ffmpeg crops the right window", async () => {
    const chiavi = [
      { t: 0, ...finestraTorre("preview"), time: 0, ease: "linear" },
      { t: 0.5, ...finestraTorre("terminal"), time: 0 }, // a cut
      { t: 1, ...finestraTorre("code"), time: 0.5, ease: "cubic" }, // slides up
    ];
    const quadro =
      "color=c=black:s=1920x3320:r=30:d=2,drawbox=x=0:y=0:w=1920:h=1080:c=red:t=fill,drawbox=x=0:y=1120:w=1920:h=1080:c=green:t=fill,drawbox=x=0:y=2240:w=1920:h=1080:c=blue:t=fill";
    const file = join(TMP, "torre.mp4");
    const info = await ffmpeg(["-f", "lavfi", "-i", quadro, "-vf", filtroPan(chiavi, { width: 1920, height: 1080, fps: 30 }), "-pix_fmt", "yuv420p", file], { loglevel: "info" });
    assert.match(info, /1920x1080/);
    assert.ok(Math.abs((await probeDuration(file)) - 2) <= 1 / 30 + 0.05);
    assert.equal(await colore(file, 0.2), "red");
    assert.equal(await colore(file, 0.7), "blue"); // no transition: the terminal at once
    assert.equal(await colore(file, 1.9), "green");
  });
  test("the same filter in the half-size preview (the crop follows the canvas)", async () => {
    const chiavi = [{ t: 0, ...finestraTorre("terminal"), time: 0, ease: "linear" }];
    const quadro = "color=c=black:s=960x1660:r=30:d=1,drawbox=x=0:y=1120:w=960:h=540:c=blue:t=fill";
    const file = join(TMP, "torre-meta.mp4");
    await ffmpeg(["-f", "lavfi", "-i", quadro, "-vf", filtroPan(chiavi, { width: 960, height: 540, fps: 30 }), "-pix_fmt", "yuv420p", file]);
    assert.equal(await colore(file, 0.3), "blue");
  });
});

describe("gif()", () => {
  test("colors: a smaller palette gives a smaller file", async () => {
    const input = ["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=1"];
    const grande = join(TMP, "256.gif");
    const piccola = join(TMP, "16.gif");
    await gif({ input, file: grande, width: 320, fps: 10, tmp: TMP });
    await gif({ input, file: piccola, width: 320, fps: 10, colors: 16, tmp: TMP });
    assert.ok(statSync(piccola).size < statSync(grande).size, `${statSync(piccola).size} vs ${statSync(grande).size}`);
  });
  test("a looping GIF89a, and no palette left behind", async () => {
    const file = join(TMP, "prova.gif");
    mkdirSync(TMP, { recursive: true });
    await gif({ input: ["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=1"], file, width: 320, fps: 10, tmp: TMP });
    assert.ok(existsSync(file));
    assert.equal(readFileSync(file).subarray(0, 6).toString("latin1"), "GIF89a");
    assert.ok(!existsSync(join(TMP, "palette.png")));
  });
});

describe("impagina: un ritaglio della clip (stack)", () => {
  test("two windows of one clip and a third page make a 1080×1920 frame", async () => {
    const { impagina } = await import("../cli/compose.mjs");
    // VS Code ripreso 1080×1296, mostrato come due finestre 1080×608 (sopra il pannello, e da lì in giù); l'app 1080×608 in mezzo.
    const clips = [
      { x: 0, y: 25, width: 1080, height: 608, crop: { x: 0, y: 0, width: 1080, height: 608 } },
      { x: 0, y: 658, width: 1080, height: 608 },
      { x: 0, y: 1291, width: 1080, height: 608, crop: { x: 0, y: 608, width: 1080, height: 608 } },
    ];
    const { filtri, uscita } = impagina(clips, { W: 1080, H: 1920, scala: 1, fps: 30, durata: "1" });
    assert.ok(filtri.some((f) => f.includes("crop=1080:608:0:608")), "the second crop is in the filter");
    const file = join(TMP, "stack.mp4");
    const err = await ffmpeg(
      [
        "-f", "lavfi", "-i", "testsrc2=size=1080x1296:rate=30:duration=1",
        "-f", "lavfi", "-i", "testsrc2=size=1080x608:rate=30:duration=1",
        "-f", "lavfi", "-i", "testsrc2=size=1080x1296:rate=30:duration=1",
        "-filter_complex", filtri.join(";"), "-map", uscita, "-pix_fmt", "yuv420p", file,
      ],
      { loglevel: "info" },
    );
    assert.match(err, /1080x1920/);
  });
});

describe("videoWeb()", () => {
  const input = ["-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=2"];
  const info = (f) => ffmpeg(["-i", f, "-f", "null", "-"], { loglevel: "info" });
  const finale = async () => {
    const video = join(TMP, "web-finale.mp4");
    if (!existsSync(video)) await ffmpeg([...input, "-pix_fmt", "yuv420p", video]);
    return video;
  };
  test("an mp4 and a webm with no sound, at the width and the fps asked, and a webp poster", async () => {
    const f = await videoWeb({ input, video: await finale(), base: join(TMP, "w1"), width: 640, fps: 12, poster: 1 });
    const mp4 = await info(f.mp4);
    assert.match(mp4, /Video: h264/);
    assert.match(mp4, /640x360/);
    assert.match(mp4, /12 fps/);
    assert.doesNotMatch(mp4, /Audio:/);
    const webm = await info(f.webm);
    assert.match(webm, /Video: vp9/);
    assert.doesNotMatch(webm, /Audio:/);
    assert.equal(readFileSync(f.poster).subarray(8, 12).toString("latin1"), "WEBP");
  });
  test("webm: false makes no webm and takes an old one away", async () => {
    const base = join(TMP, "w2");
    const con = await videoWeb({ input, video: await finale(), base, width: 320, fps: 12 });
    assert.ok(existsSync(con.webm));
    const senza = await videoWeb({ input, video: await finale(), base, width: 320, fps: 12, webm: false });
    assert.equal(senza.webm, null);
    assert.ok(!existsSync(`${base}.webm`));
    assert.ok(existsSync(senza.mp4));
  });
  test("a higher crf is a lighter file", async () => {
    const buona = await videoWeb({ input, video: await finale(), base: join(TMP, "w3"), width: 640, fps: 12, crf: 22, webm: false });
    const leggera = await videoWeb({ input, video: await finale(), base: join(TMP, "w4"), width: 640, fps: 12, crf: 38, webm: false });
    assert.ok(statSync(leggera.mp4).size < statSync(buona.mp4).size, `${statSync(leggera.mp4).size} vs ${statSync(buona.mp4).size}`);
  });
});
