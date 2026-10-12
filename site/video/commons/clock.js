// The clock of the shared cards: their entrances start with the clip, not on load. Title and outro
// only wait for it; question.html, beats.html and together.html also time their items on the voice.
//
// LINKED-DATA: time zero is the start of the clip. The recorder adds `clock=take` to every card's
// URL (palco in uty/director.mjs) and fires a "take" event on the page as soon as it's filming
// (ciak, called by uty/record.mjs); site/video/README.md tells the conversion how to use it.
// Change one, change the others.
//
// Times in the params are seconds from that zero: the voice's own seconds, where the word n
// falls at about lead + n / rate. Opened by hand in a browser, a card starts on load.
//
// Lists are one item per line; inside an item, `|` splits its parts.
(() => {
  const q = new URLSearchParams(location.search);
  const waiting = [];
  let zero = null;

  function start() {
    if (zero !== null) return;
    zero = performance.now();
    document.documentElement.classList.add("go");
    for (const fn of waiting.splice(0)) fn();
  }

  const param = (name, fallback = "") => (q.has(name) ? q.get(name) : fallback);

  window.card = {
    /** A param, or its fallback. */
    param,
    /** A list param: one item per line, each split on `|`. */
    list(name, fallback = []) {
      if (!q.has(name)) return fallback;
      return q
        .get(name)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split("|").map((part) => part.trim()));
    },
    /** `count` times from a param ("2.1, 3.4, 5"); the missing ones come every `step` seconds. */
    times(count, { name = "at", first = 1, step = 0.8 } = {}) {
      const given = param(name).split(/[\s,]+/).filter(Boolean).map(Number);
      const out = [];
      for (let i = 0; i < count; i++) out.push(given[i] ?? (i ? out[i - 1] + step : first));
      return out;
    },
    /** Runs `fn` at `seconds` from zero. */
    at(seconds, fn) {
      const run = () => setTimeout(fn, Math.max(0, seconds * 1000 - (performance.now() - zero)));
      zero === null ? waiting.push(run) : run();
    },
  };

  if (q.get("clock") === "take") {
    addEventListener("take", start);
    setTimeout(start, 6000); // no take at all: better late than a blank card
  } else if (document.readyState === "loading") addEventListener("DOMContentLoaded", start);
  else queueMicrotask(start);
})();
