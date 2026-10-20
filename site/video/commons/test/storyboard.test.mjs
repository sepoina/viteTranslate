// storyboard.mjs: `card` per nome, `look`, `anim`, `output`, `before`, `camera`, `output.gif`. Su un progetto temporaneo, cancellato alla fine.
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

// Le scene di prova stanno su `vscode`: non chiede una fixture (la chiedono solo app, split e split-panel).
const vs = (extra = {}) => ({ id: "v", stage: "vscode", ...extra });

describe("before", () => {
  test("a waitFor passes", () => {
    assert.equal(carica({ scenes: [vs({ before: [{ waitFor: { text: "done", exact: false } }] })] }).errore, undefined);
  });
  test("it is never filmed: no mark, unmark or camera", () => {
    for (const azione of [{ mark: { text: "a" } }, "unmark", { camera: "full" }])
      assert.match(carica({ scenes: [vs({ before: [azione] })] }).errore, /before is played before the clip/);
  });
  test("a list, not a number", () => {
    assert.match(carica({ scenes: [vs({ before: 3 })] }).errore, /before: "do" must be a list/);
  });
});

describe("camera", () => {
  test("the scene's first frame", () => {
    assert.equal(carica({ scenes: [vs({ camera: { text: "a" } })] }).errore, undefined);
    assert.equal(carica({ scenes: [vs({ camera: "keep" })] }).errore, undefined);
  });
  test("the first frame has no time or ease", () => {
    assert.match(carica({ scenes: [vs({ camera: { text: "a", time: 1 } })] }).errore, /first frame: no time or ease/);
    assert.match(carica({ scenes: [vs({ camera: { text: "a", ease: "sine" } })] }).errore, /first frame: no time or ease/);
  });
  test("not on a card", () => {
    assert.match(carica({ scenes: [card({ camera: { text: "a" } })] }).errore, /a card moves with anim/);
    assert.match(carica({ scenes: [card({ do: [{ camera: "full" }] })] }).errore, /a card moves with anim/);
  });
  test("the action: full passes, keep is for the scene, unknown keys stop", () => {
    assert.equal(carica({ scenes: [vs({ do: [{ camera: "full" }, { camera: { text: "a", width: 960 } }] })] }).errore, undefined);
    assert.match(carica({ scenes: [vs({ do: [{ camera: "keep" }] })] }).errore, /keep is for the scene's camera/);
    assert.match(carica({ scenes: [vs({ do: [{ camera: { zoom: 2 } }] })] }).errore, /unknown keys zoom/);
  });
  test("the setup is not filmed", () => {
    assert.match(carica({ setup: [{ camera: "full" }], scenes: [vs()] }).errore, /the setup is not filmed/);
  });
});

describe("output.gif", () => {
  test("{ width, fps } loads and is kept", () => {
    const { project, errore } = carica({ output: { gif: { width: 800, fps: 12 } }, scenes: [card()] });
    assert.equal(errore, undefined);
    assert.deepEqual(project.output.gif, { width: 800, fps: 12 });
  });
  test("no gif by default", () => {
    assert.equal(carica({ scenes: [card()] }).project.output.gif, null);
  });
  test("a missing fps, an fps above output.fps, a width out of range", () => {
    assert.match(carica({ output: { gif: { width: 800 } }, scenes: [card()] }).errore, /output\.gif\.fps/);
    assert.match(carica({ output: { gif: { width: 800, fps: 60 } }, scenes: [card()] }).errore, /output\.gif\.fps/);
    assert.match(carica({ output: { gif: { width: 100, fps: 12 } }, scenes: [card()] }).errore, /output\.gif\.width/);
  });
  test("colors: the palette size, 2 to 256, an integer", () => {
    assert.equal(carica({ output: { gif: { width: 800, fps: 12, colors: 128 } }, scenes: [card()] }).project.output.gif.colors, 128);
    for (const colors of [1, 300, 12.5, "128"])
      assert.match(carica({ output: { gif: { width: 800, fps: 12, colors } }, scenes: [card()] }).errore, /output.gif.colors/);
  });
  test("another key, or a list, stops the YAML", () => {
    assert.match(carica({ output: { gif: { width: 800, fps: 12, loop: 1 } }, scenes: [card()] }).errore, /output\.gif: \{ width, fps \}/);
    assert.match(carica({ output: { gif: [800, 12] }, scenes: [card()] }).errore, /output\.gif: \{ width, fps \}/);
  });
});

describe("speed", () => {
  test("a number, as an action, in a scene with no voice", () => {
    assert.equal(carica({ scenes: [vs({ do: [{ speed: 1.5 }, { wait: 1 }, { speed: 1 }] })] }).errore, undefined);
  });
  test("a number from 0.25 to 8, nothing else", () => {
    for (const speed of [0, 20, "2", null, { x: 2 }]) assert.match(carica({ scenes: [vs({ do: [{ speed }] })] }).errore, /speed is a number from 0.25 to 8/, String(speed));
    assert.match(carica({ scenes: [vs({ do: ["speed"] })] }).errore, /speed is a number/);
  });
  test("not with a voice: it would go out of step", () => {
    assert.match(carica({ scenes: [vs({ say: "Hello there.", do: [{ speed: 2 }] })] }).errore, /speed is for a scene with no voice/);
  });
  test("not in before or setup: they are not filmed", () => {
    assert.match(carica({ scenes: [vs({ before: [{ speed: 2 }] })] }).errore, /no mark, unmark, camera or speed there/);
    assert.match(carica({ setup: [{ speed: 2 }], scenes: [vs()] }).errore, /no camera or speed there/);
  });
});

describe("vertical output", () => {
  const vert = { width: 1080, height: 1920 };
  const stack = (extra = {}) => ({ id: "s", stage: "stack", ...extra });
  const fix = { fixture: "demo/Vite_8/quickApp" };
  test("1080×1920 and 1440×2560 load: the 9:16 frame, more pixels", () => {
    for (const output of [vert, { width: 1440, height: 2560 }]) assert.equal(carica({ ...fix, output, scenes: [stack()] }).errore, undefined);
  });
  test("another vertical shape, or smaller than the frame, stops the YAML", () => {
    for (const [width, height] of [[1080, 1900], [720, 1280], [1081, 1921]])
      assert.match(carica({ ...fix, output: { width, height }, scenes: [card()] }).errore, /or 9:16, even, at least 1080×1920/);
  });
  test("stack needs a vertical output", () => {
    assert.match(carica({ ...fix, scenes: [stack()] }).errore, /stage "stack" is for a vertical output/);
  });
  test("a vertical output has stack and card, not the 16:9 stages", () => {
    for (const stage of ["vscode", "app", "split", "split-panel", "tower"])
      assert.match(carica({ ...fix, output: vert, scenes: [{ id: "x", stage }] }).errore, /a vertical output has the stages stack and card/, stage);
    assert.equal(carica({ ...fix, output: vert, scenes: [stack(), card()] }).errore, undefined);
  });
  test("no camera in a vertical output", () => {
    assert.match(carica({ ...fix, output: vert, scenes: [stack({ camera: { rect: [0, 0, 960] } })] }).errore, /camera is a 16:9 crop/);
    assert.match(carica({ ...fix, output: vert, scenes: [stack({ do: [{ camera: "full" }] })] }).errore, /camera is a 16:9 crop/);
  });
  test("stack asks for a fixture, as the stages with the app do", () => {
    assert.match(carica({ output: vert, scenes: [stack()] }).errore, /needs a fixture/);
  });
});

describe("tower", () => {
  const torre = (extra = {}) => ({ id: "t", stage: "tower", ...extra });
  const fix = { fixture: "demo/Vite_8/quickApp" };
  test("a 16:9 output, a window for the camera: it loads", () => {
    const scena = torre({ camera: { window: "preview" }, do: [{ camera: { window: "code", time: 0.8, ease: "sine" } }, { camera: { window: "terminal", time: 0 } }] });
    assert.equal(carica({ ...fix, scenes: [scena, card()] }).errore, undefined);
    assert.equal(carica({ ...fix, scenes: [torre({ camera: "keep" })] }).errore, undefined);
  });
  test("with no camera at all it loads: the camera sits on the preview", () => {
    assert.equal(carica({ ...fix, scenes: [torre()] }).errore, undefined);
  });
  test("it asks for a fixture, as the stages with the app do", () => {
    assert.match(carica({ scenes: [torre()] }).errore, /needs a fixture/);
  });
  test("the camera goes to a window: no target, no full, no zoom", () => {
    for (const camera of [{ text: "Welcome" }, { rect: [0, 0, 960] }, "full", "selection"])
      assert.match(carica({ ...fix, scenes: [torre({ camera })] }).errore, /in a tower the camera goes to a window/, JSON.stringify(camera));
    assert.match(carica({ ...fix, scenes: [torre({ do: [{ camera: { selector: "h1" } }] })] }).errore, /in a tower the camera goes to a window/);
    assert.match(carica({ ...fix, scenes: [torre({ do: [{ camera: { window: "code", width: 960 } }] })] }).errore, /the camera slides, it doesn't zoom/);
  });
  test("a window that isn't there says so", () => {
    assert.match(carica({ ...fix, scenes: [torre({ camera: { window: "sidebar" } })] }).errore, /window is one of preview, code, terminal/);
  });
  test("camera window is for the tower only", () => {
    assert.match(carica({ ...fix, scenes: [{ id: "v", stage: "vscode", camera: { window: "code" } }] }).errore, /camera window is for stage: tower/);
    assert.match(carica({ ...fix, scenes: [{ id: "v", stage: "split", do: [{ camera: { window: "code" } }] }] }).errore, /camera window is for stage: tower/);
  });
});

describe("mark: the arrow's side", () => {
  const fix = { fixture: "demo/Vite_8/quickApp" };
  const marca = (m) => ({ id: "m", stage: "app", do: [{ mark: m }] });
  test("an arrow from the left or the right (or a corner) loads, in a scene and at the top", () => {
    for (const from of ["left", "right", "top-left", "top-right", "bottom-left", "bottom-right"])
      assert.equal(carica({ ...fix, scenes: [marca({ text: "Hi", shape: "arrow", from })] }).errore, undefined, from);
    assert.equal(carica({ ...fix, mark: { shape: "arrow", from: "right" }, scenes: [marca({ text: "Hi" })] }).errore, undefined);
  });
  test("another side stops the YAML", () => {
    assert.match(carica({ ...fix, scenes: [marca({ text: "Hi", shape: "arrow", from: "up" })] }).errore, /from \(the arrow's side\) must be one of left, right/);
  });
});

describe("output.web", () => {
  const web = (w) => carica({ output: { web: w }, scenes: [card()] });
  test("a width alone is enough; fps, crf and webm are optional", () => {
    assert.equal(web({ width: 960 }).errore, undefined);
    assert.equal(web({ width: 960, fps: 24, crf: 28, webm: false }).errore, undefined);
    assert.equal(web({ width: 1280, fps: 30, crf: 40 }).errore, undefined);
  });
  test("each of these says what is wrong", () => {
    const casi = [
      [{}, /output\.web\.width: pixels, an even integer/],
      [{ width: 961 }, /output\.web\.width: pixels, an even integer/],
      [{ width: 100 }, /output\.web\.width: pixels, an even integer/],
      [{ width: 960, fps: 60 }, /output\.web\.fps: frames a second, between 1 and output\.fps \(30/],
      [{ width: 960, crf: 12 }, /output\.web\.crf: the x264 quality, an integer between 18 and 40/],
      [{ width: 960, crf: 30.5 }, /output\.web\.crf/],
      [{ width: 960, webm: "yes" }, /output\.web\.webm: true or false/],
      [{ width: 960, colors: 64 }, /output\.web: \{ width \}/],
      [[960], /output\.web: \{ width \}/],
    ];
    for (const [w, re] of casi) assert.match(web(w).errore, re, JSON.stringify(w));
  });
  test("it is not part of the stage: the project loads without it", () => {
    assert.equal(carica({ scenes: [card()] }).project.output.web, null);
  });
});
