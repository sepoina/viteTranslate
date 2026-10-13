// La forgia delle card in Chrome: scale, manopole, tempo, varianti, griglie, subgrid, corpo che si
// stringe, still, QR, anim, ripetibilità, curve. Chrome come nella pipeline (commons/cli/card.mjs).
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { urlCard } from "../cli/director.mjs";
import { apriChrome, carica, prototipi, scenaDi } from "../cli/card.mjs";
import { VIDEO_DIR } from "../cli/storyboard.mjs";

const NESSUNO = { paths: { dir: VIDEO_DIR }, look: {}, music: null };
let browser, page;
const apri = (nome, v = {}) => carica(page, urlCard(NESSUNO, scenaDi(nome, v)));
const vicino = (a, b, tol, cosa) => assert.ok(Math.abs(a - b) <= tol, `${cosa}: ${a} vs ${b} (±${tol})`);
/** Un token misurato su un elemento di prova: le custom property non si risolvono da sole. */
const misura = (token, prop = "width", dove = "body") =>
  page.evaluate(
    ([token, prop, dove]) => {
      const d = document.createElement("div");
      d.style[prop] = `var(${token})`;
      document.querySelector(dove).append(d);
      const v = parseFloat(getComputedStyle(d)[prop]);
      d.remove();
      return v;
    },
    [token, prop, dove],
  );
const font = (sel) => page.evaluate((s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize), sel);
const opacita = (sel) => page.evaluate((s) => Number(getComputedStyle(document.querySelector(s)).opacity), sel);
const seek = (t) => page.evaluate((t) => window.card.seek(t), t);

before(async () => ({ browser, page } = await apriChrome()));
after(() => browser?.close());

describe("scales", () => {
  test("--type-hero and --space-xl at the stock knobs", async () => {
    await apri("beats");
    vicino(await misura("--type-hero", "fontSize"), 130, 1, "--type-hero");
    vicino(await misura("--space-xl"), 40, 1, "--space-xl");
  });
  test("look { type-scale: 0.5 } halves the title", async () => {
    await apri("beats");
    const pieno = await font("h1");
    assert.deepEqual((await apri("beats", { look: { "type-scale": 0.5 } })).errors, []);
    vicino(await font("h1"), pieno / 2, 1, "title");
  });
  test("look with an unknown token is an error", async () => {
    const { errors } = await apri("beats", { look: { nope: 1 } });
    assert.match(errors.join("\n"), /look: no token --nope/);
  });
  test("a knob on .knobs: --fit on the body shrinks its type, not the foot's", async () => {
    await apri("beats", { params: { note: "a note" } });
    const [corpo, piede] = [await font("h1"), await font(".note")];
    await page.evaluate(() => document.querySelector(".frame-body").style.setProperty("--fit", "0.8"));
    vicino(await font("h1"), corpo * 0.8, 1, "body");
    assert.equal(await font(".note"), piede);
  });
});

describe("tempo", () => {
  test("look { tempo: 2 } doubles every duration, stamp and thud included", async () => {
    // Le entrate stanno a tempi assoluti (la voce): raddoppia quello che dura dopo l'ultima partenza.
    const params = { stamp: "Free", stampAt: 6 };
    const uno = (await apri("beats", { params })).duration;
    const due = (await apri("beats", { params, look: { tempo: 2 } })).duration;
    vicino(due - 6, (uno - 6) * 2, 0.01, "after the stamp");
    vicino(uno - 6, 0.42, 0.01, "stamp + thud at tempo 1");
  });
});

describe("every variant of every prototype", () => {
  for (const { nome, varianti } of prototipi())
    for (const v of varianti)
      test(`${nome} ${v.name}: ${v.expect ?? "fits"}`, async () => {
        const { errors } = await apri(nome, v);
        if ((v.expect ?? "fits") === "fits") assert.deepEqual(errors, []);
        else assert.ok(errors.length, "expected errors, got none");
      });
});

describe("layout", () => {
  for (const [n, cols] of [[5, 3], [7, 4], [8, 4]])
    test(`${n} tiles: --cols ${cols}`, async () => {
      await apri("beats", { params: { beats: Array.from({ length: n }, (_, i) => `${i + 1}|item`).join("\n") } });
      assert.equal(await page.evaluate(() => document.querySelector(".grid").style.getPropertyValue("--cols")), String(cols));
    });
  test("subgrid: the big lines of a row share their top, whatever the small ones", async () => {
    await apri("beats", { params: { beats: "1|short\n2|a small line long enough to wrap on three lines in its tile\n3|two lines of small text here" } });
    const tops = await page.evaluate(() => [...document.querySelectorAll(".big")].map((b) => b.getBoundingClientRect().top));
    for (const t of tops) vicino(t, tops[0], 1, "top");
  });
  test("the body tightens: a variant that fits only tight has --fit < 1 and no errors", async () => {
    const { errors } = await apri("outro", { params: { lines: Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join("\n") } });
    assert.deepEqual(errors, []);
    const fit = await page.evaluate(() => Number(document.querySelector(".frame-body").style.getPropertyValue("--fit")));
    assert.ok(fit > 0 && fit < 1, `--fit ${fit}`);
  });
  test("still: composed at zero; the stamp and the QR enter anyway", async () => {
    await apri("outro", { params: { still: 1, stamp: "Free", stampAt: 1, qr: "coffee-qr.svg", qrAt: 1.5 } });
    await seek(0);
    assert.equal(await opacita(".logo"), 1);
    assert.equal(await opacita(".stamp"), 0);
    assert.equal(await opacita(".qr"), 0);
    await seek(3);
    vicino(await opacita(".stamp"), 0.9, 0.01, "stamp");
    assert.equal(await opacita(".qr"), 1);
  });
  test("corner: the stamp goes bottom right by default, top right when asked", async () => {
    const dove = () => page.evaluate(() => document.querySelector(".stamp").getBoundingClientRect().toJSON());
    await apri("outro", { params: { stamp: "Free" } });
    const sotto = await dove();
    assert.deepEqual((await apri("outro", { params: { stamp: "Free", corner: "top-right" } })).errors, []);
    const sopra = await dove();
    assert.ok(sotto.top > 540 && sotto.left > 960, `default: ${sotto.left}, ${sotto.top}`);
    assert.ok(sopra.bottom < 540 && sopra.left > 960, `top-right: ${sopra.left}, ${sopra.bottom}`);
  });
  test("corner with an unknown value is an error", async () => {
    const { errors } = await apri("outro", { params: { stamp: "Free", corner: "middle" } });
    assert.match(errors.join("\n"), /corner: one of bottom-right, top-right/);
  });
  test("a QR over a tile is an error", async () => {
    const { errors } = await apri("beats", { params: { beats: "1\n2\n3\n4\n5\n6\n7\n8", qr: "../outro/coffee-qr.svg" } });
    assert.match(errors.join("\n"), /the QR covers/);
  });
});

describe("anim", () => {
  test("an unknown effect lists the effects", async () => {
    const { errors } = await apri("beats", { anim: [{ fx: "nope", target: "h1" }] });
    assert.match(errors.join("\n"), /no effect "nope" in motion\.js \(.*rise.*\)/);
  });
  test("an empty target is an error", async () => {
    const { errors } = await apri("beats", { anim: [{ fx: "rise", target: ".nothing" }] });
    assert.match(errors.join("\n"), /no element matches "\.nothing"/);
  });
  test("{ fx: rise, target: .small, at: 2 }: hidden before, shown after", async () => {
    assert.deepEqual((await apri("beats", { anim: [{ fx: "rise", target: ".small", at: 2 }] })).errors, []);
    await seek(1.9);
    assert.equal(await opacita(".small"), 0);
    await seek(3);
    assert.equal(await opacita(".small"), 1);
  });
});

describe("timeline", () => {
  test("repeatable: two seek(2.3) give the same picture", async () => {
    await apri("beats", { params: { note: "a note", stamp: "Free", stampAt: 2.2 } });
    const hash = async () => {
      await seek(2.3);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      return createHash("sha1").update(await page.screenshot()).digest("hex");
    };
    const a = await hash();
    await seek(0.5);
    assert.equal(await hash(), a);
  });
  test('the "vt" curve is cubic-bezier(.2, .7, .2, 1)', async () => {
    await apri("beats");
    // La bezier: x(t) risolta per bisezione, poi y(t).
    const b = (p1, p2, t) => 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3;
    const bezier = (x) => {
      let lo = 0, hi = 1;
      for (let i = 0; i < 60; i++) {
        const m = (lo + hi) / 2;
        if (b(0.2, 0.2, m) < x) lo = m;
        else hi = m;
      }
      return b(0.7, 1, (lo + hi) / 2);
    };
    const gsapY = await page.evaluate(() => [0.25, 0.5, 0.75].map((x) => gsap.parseEase("vt")(x)));
    [0.25, 0.5, 0.75].forEach((x, i) => vicino(gsapY[i], bezier(x), 0.01, `vt(${x})`));
  });
});
