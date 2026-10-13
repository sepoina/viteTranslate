// Le sonde (commons/cli/probe.js, commons/cli/probe.mjs) su una pagina di prova: clic marcato e coperto, focus in un
// iframe, treni di tasti, fumetti, mutazioni. Chrome come nella pipeline.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { Sonde } from "../cli/probe.mjs";

const DIR = mkdtempSync(join(tmpdir(), "vt-probe-"));
const PAGINA = `<!doctype html><html><body style="margin:0">
  <button id="b" style="position:absolute;left:20px;top:20px;width:200px;height:60px">Sync</button>
  <div id="sopra" style="position:absolute;left:120px;top:20px;width:100px;height:60px;background:#333">cover</div>
  <iframe id="f" style="position:absolute;left:20px;top:120px;width:400px;height:200px"
    srcdoc="<input id='i'><div class='fumetto'>tip</div>"></iframe>
  <div id="m"></div>
</body></html>`;
let browser, page, sonde;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const prossimo = (t0, filtro) => sonde.aspetta(t0, filtro, 2000);

before(async () => {
  writeFileSync(join(DIR, "prova.html"), PAGINA);
  browser = await chromium.launch({ channel: process.env.VT_VIDEO_CHROME ? undefined : "chrome", executablePath: process.env.VT_VIDEO_CHROME || undefined, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 400 } });
  sonde = new Sonde(join(DIR, "probe.jsonl"));
  await sonde.collega(ctx, "test");
  page = await ctx.newPage();
  await page.goto(pathToFileURL(join(DIR, "prova.html")).href);
  await prossimo(0, (e) => e.k === "load" && e.frame !== "top"); // anche l'iframe ascolta
});
after(async () => {
  await browser?.close();
  rmSync(DIR, { recursive: true, force: true });
});

test("a click on the marked button: pointerdown, mirato 1", async () => {
  await page.evaluate(() => document.getElementById("b").setAttribute("data-vt-target", "1"));
  const t0 = Date.now();
  await page.mouse.click(60, 50);
  const e = await prossimo(t0, (x) => x.k === "pointerdown");
  assert.equal(e?.mirato, "1");
  assert.match(e.target, /^button#b/);
});

test("a click on the covered half lands on the cover", async () => {
  const t0 = Date.now();
  await page.mouse.click(180, 50);
  const e = await prossimo(t0, (x) => x.k === "pointerdown");
  assert.equal(e?.mirato, null);
  assert.match(e.target, /^div#sopra/);
});

test("focus in the iframe's input: writable, frame not top", async () => {
  const t0 = Date.now();
  await page.frameLocator("#f").locator("#i").focus();
  const e = await prossimo(t0, (x) => x.k === "focus" && x.target.startsWith("input#i"));
  assert.equal(e?.scrivibile, true);
  assert.notEqual(e.frame, "top");
});

// Un treno di tasti è un evento solo finché il suo lotto non parte (ogni 100 ms): poi ne apre un altro,
// o i tasti dopo andrebbero persi. Il regista somma n.
test("10 keys: one train (two if a batch leaves halfway), n adding up to 10", async () => {
  const t0 = Date.now();
  await page.keyboard.type("abcdefghij");
  await pausa(300);
  const treni = sonde.dal(t0, (x) => x.k === "keys");
  assert.ok(treni.length >= 1 && treni.length <= 2, `${treni.length} trains`);
  assert.equal(treni.reduce((n, e) => n + e.n, 0), 10);
  assert.ok(treni.every((e) => e.scrivibile));
});

test("a tooltip lit: overlay.sopra not empty", async () => {
  const t0 = Date.now();
  await page.frameLocator("#f").locator(".fumetto").evaluate((n) => n.classList.add("acceso"));
  const e = await prossimo(t0, (x) => x.k === "overlay" && x.sopra.length > 0);
  assert.match(e?.sopra[0] ?? "", /fumetto\.acceso/);
});

// Le webview di VS Code scrivono il contenuto con document.open/write: i listener vanno rimontati.
test("an iframe rewritten with document.open: the probe listens again", async () => {
  const f = page.frameLocator("#f");
  await f.locator("body").evaluate(() => {
    document.open();
    document.write("<button id='w' style='width:200px;height:60px'>Webview</button>");
    document.close();
  });
  await pausa(400); // il controllo dell'intervallo, ogni 250 ms
  const box = await page.locator("#f").boundingBox();
  const t0 = Date.now();
  await page.mouse.click(box.x + 60, box.y + 20);
  const e = await prossimo(t0, (x) => x.k === "pointerdown");
  assert.match(e?.target ?? "", /^button#w/);
  assert.notEqual(e.frame, "top");
});

test("a mutation: a dom bucket", async () => {
  const t0 = Date.now();
  await page.evaluate(() => document.getElementById("m").append("x"));
  const e = await prossimo(t0, (x) => x.k === "dom");
  assert.ok(e?.n >= 1);
});
