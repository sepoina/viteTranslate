// speed.mjs: i tratti a velocità costante, la durata nel video, il filtro provato da ffmpeg vero. Niente Chrome.
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { controllaVelocita, durataUscita, filtroVelocita, tempoUscita, tratti } from "../cli/speed.mjs";
import { ffmpeg, probeDuration } from "../cli/ffmpeg.mjs";

const TMP = mkdtempSync(join(tmpdir(), "vt-speed-"));
after(() => rmSync(TMP, { recursive: true, force: true }));

// 1× fino a 1 s, 2× da 1 a 2 s, di nuovo 1×: 3 s di ripresa fanno 1 + 0,5 + 1 = 2,5 s di video.
const CHIAVI = [{ t: 1, speed: 2 }, { t: 2, speed: 1 }];

describe("tratti", () => {
  test("a scene starts at 1×, and the keys cut it into runs", () => {
    const { tratti: r, durata } = tratti(CHIAVI, 3);
    assert.deepEqual(r.map((x) => [x.da, x.a, x.v, x.o]), [[0, 1, 1, 0], [1, 2, 2, 1], [2, 3, 1, 1.5]]);
    assert.equal(durata, 2.5);
  });
  test("a speed at the very start, and one left on to the end", () => {
    assert.equal(durataUscita([{ t: 0, speed: 2 }], 4), 2);
    assert.equal(durataUscita([{ t: 1, speed: 0.5 }], 3), 1 + 4);
  });
  test("a key past the end changes nothing", () => {
    assert.equal(durataUscita([{ t: 9, speed: 2 }], 3), 3);
  });
  test("no keys: as long as it was shot", () => {
    assert.equal(durataUscita(null, 3), 3);
    assert.equal(durataUscita([], 3), 3);
  });
});

describe("tempoUscita", () => {
  test("where a second of the shot falls in the video", () => {
    assert.equal(tempoUscita(CHIAVI, 3, 0.5), 0.5);
    assert.equal(tempoUscita(CHIAVI, 3, 1.5), 1.25);
    assert.equal(tempoUscita(CHIAVI, 3, 2.5), 2);
    assert.equal(tempoUscita(CHIAVI, 3, 3), 2.5);
  });
});

describe("controllaVelocita", () => {
  test("a number from 0.25 to 8", () => {
    for (const v of [0.25, 1, 1.5, 2, 8]) assert.deepEqual(controllaVelocita(v, "s"), [], String(v));
  });
  test("nothing else", () => {
    for (const v of [0, -1, 0.1, 9, "2", null, undefined, { x: 2 }]) assert.match(controllaVelocita(v, "s").join(), /speed is a number from 0.25 to 8/, String(v));
  });
});

describe("filtroVelocita con ffmpeg vero", () => {
  test("the clip lasts what durataUscita says", async () => {
    const file = join(TMP, "speed.mp4");
    const filtro = filtroVelocita(CHIAVI, { fps: 30, durata: 3 });
    await ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=3", "-vf", filtro, "-pix_fmt", "yuv420p", file]);
    const durata = await probeDuration(file);
    assert.ok(Math.abs(durata - 2.5) <= 1 / 30 + 0.05, `duration ${durata}`);
  });
  test("slow motion too: 0.5× doubles a run", async () => {
    const file = join(TMP, "slow.mp4");
    const chiavi = [{ t: 0, speed: 0.5 }];
    await ffmpeg(["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=1", "-vf", filtroVelocita(chiavi, { fps: 30, durata: 1 }), "-pix_fmt", "yuv420p", file]);
    assert.ok(Math.abs((await probeDuration(file)) - 2) <= 1 / 30 + 0.05);
  });
});
