// together: columns of ticked items, filling one after another; then every tick glows once.
// Sheet: together.md. Variants: variants.yaml.
card.define(({ param, list, times, body, parts, enter, fx }) => {
  const title = param("title") ? parts.headline(param("title")) : null;
  const groups = list("groups", [
    ["In your JSX", "Keyless, natural text", "ICU plurals, select, dates"],
    ["In VS Code", "Official extension", "LLM auto-translation"],
    ["In Vite", "Official Vite plugin", "Extraction in the Vite lifecycle", "Lazy-loaded locales"],
    ["In production", "Zero runtime dependencies", "5 kB gzip runtime", "No message parsing at runtime"],
  ]);
  const grid = parts.tiles(groups, parts.group);
  body.append(parts.stack(title, grid.el));
  enter(title, 0);
  const beat = Number(param("beat", "0.3"));
  let last = 0;
  times(groups.length, { first: 0.8, step: 1.4 }).forEach((t, g) => {
    const tile = grid.tiles[g];
    enter(tile, t, { fx: "rise", duration: 0.6 });
    tile.querySelectorAll("li").forEach((li, i) => {
      const ti = t + 0.25 + beat * i;
      enter(li, ti);
      enter(li.querySelector("path"), ti + 0.15);
      last = Math.max(last, ti);
    });
  });
  fx("glow", body.querySelectorAll(".tick"), last + 0.7); // a good frame for the poster
  card.noteAt = last + 1;
});
