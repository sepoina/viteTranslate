// storyboard.mjs: `card` per nome, `look`, `anim`. Su un progetto temporaneo, cancellato alla fine.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dump } from "js-yaml";
import { PROJECTS_DIR, loadProject } from "../cli/storyboard.mjs";

const NOME = `zz-test-${process.pid}`;
const DIR = join(PROJECTS_DIR, NOME);

/** Scrive lo YAML del progetto di prova e lo carica: l'oggetto, o il messaggio d'errore. */
function carica(yaml) {
  writeFileSync(join(DIR, "storyboard.yaml"), dump(yaml));
  try {
    return { project: loadProject(NOME) };
  } catch (e) {
    return { errore: e.message };
  }
}
const card = (extra = {}) => ({ id: "c", stage: "card", card: "beats", ...extra });

before(() => {
  mkdirSync(join(DIR, "components", "mio"), { recursive: true });
  writeFileSync(join(DIR, "components", "mio", "mio.js"), "card.define(() => {});\n");
});
after(() => rmSync(DIR, { recursive: true, force: true }));

describe("card by name", () => {
  test("a plain name is the shared prototype", () => {
    const { project } = carica({ scenes: [card()] });
    assert.equal(project.scenes[0].card, "@commons/components/beats/beats.js");
  });
  test("./components/<name> is the project's own", () => {
    const { project } = carica({ scenes: [card({ card: "./components/mio" })] });
    assert.equal(project.scenes[0].card, "components/mio/mio.js");
  });
  test("a name that doesn't exist stops the YAML", () => {
    assert.match(carica({ scenes: [card({ card: "nope" })] }).errore, /card "nope" not found/);
    assert.match(carica({ scenes: [card({ card: "./components/nope" })] }).errore, /card "\.\/components\/nope" not found/);
  });
});

describe("look", () => {
  test("at the top and in the scene", () => {
    const { project } = carica({ look: { "type-scale": 0.9 }, scenes: [card({ look: { tempo: 1.2 } })] });
    assert.deepEqual(project.look, { "type-scale": 0.9 });
    assert.deepEqual(project.scenes[0].look, { tempo: 1.2 });
  });
  test("keys that aren't token names", () => {
    assert.match(carica({ look: { "--fit": 1 }, scenes: [card()] }).errore, /"--fit" is not a token name/);
    assert.match(carica({ scenes: [card({ look: { Tempo: 1 } })] }).errore, /"Tempo" is not a token name/);
    assert.match(carica({ scenes: [card({ look: { tempo: { a: 1 } } })] }).errore, /tempo must be a plain value/);
    assert.match(carica({ look: [1], scenes: [card()] }).errore, /look: must be a map/);
  });
  test("only on a card", () => {
    assert.match(carica({ scenes: [{ id: "v", stage: "vscode", look: { tempo: 1 } }] }).errore, /look is for stage: card/);
  });
});

describe("anim", () => {
  const prova = (anim, stage = "card") => carica({ scenes: [stage === "card" ? card({ anim }) : { id: "v", stage, anim }] });
  test("a good one loads", () => {
    const anim = [{ fx: "rise", target: "h1", at: 2, y: 40 }, { to: { opacity: 0.5 }, target: ".note", at: 3 }, { fromTo: [{ x: -40 }, { x: 0 }], target: ".tile" }];
    assert.deepEqual(prova(anim).project.scenes[0].anim, anim);
  });
  test("on a stage that isn't a card", () => {
    assert.match(prova([{ fx: "rise", target: "h1" }], "vscode").errore, /anim is for stage: card/);
  });
  test("two kinds together", () => {
    assert.match(prova([{ fx: "rise", to: { opacity: 1 }, target: "h1" }]).errore, /exactly one of fx, set, to, from, fromTo \(got fx, to\)/);
  });
  test("without a target", () => {
    assert.match(prova([{ fx: "rise" }]).errore, /needs a target/);
  });
  test("a negative at", () => {
    assert.match(prova([{ fx: "rise", target: "h1", at: -1 }]).errore, /at is seconds from the take, 0 or more/);
  });
  test("a wrong fromTo", () => {
    assert.match(prova([{ fromTo: { x: 0 }, target: "h1" }]).errore, /fromTo is \[from vars, to vars\]/);
    assert.match(prova([{ fromTo: [{ x: 0 }], target: "h1" }]).errore, /fromTo is \[from vars, to vars\]/);
  });
  test("vars next to a raw tween", () => {
    assert.match(prova([{ to: { opacity: 1 }, duration: 2, target: "h1" }]).errore, /the vars go inside to/);
  });
});

describe("output", () => {
  test("2560×1440 and 3840×2160 load: same 16:9 frame, more pixels", () => {
    for (const [width, height] of [[2560, 1440], [3840, 2160]]) assert.equal(carica({ output: { width, height }, scenes: [card()] }).errore, undefined);
  });
  test("another shape, or smaller than the frame, stops the YAML", () => {
    for (const [width, height] of [[2560, 1080], [1280, 720], [2561, 1441]])
      assert.match(carica({ output: { width, height }, scenes: [card()] }).errore, /output: 16:9, even, at least 1920×1080/);
  });
});
