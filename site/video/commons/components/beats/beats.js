// beats: a title, a command, then tiles landing one by one on the voice (2 to 8; more rows past 4).
// Sheet: beats.md. Variants: variants.yaml.
card.define(({ param, list, times, body, parts, enter }) => {
  const title = parts.headline(param("title", "LLM auto-translation"));
  const chip = param("code") ? parts.chip(param("code")) : null;
  const items = list("beats", [["💰", "Cost first"], ["✋", "Asks before spending"], ["🛡️", "Every result validated"]]);
  const grid = parts.tiles(items, parts.bigSmall);
  body.append(parts.stack(title, chip, grid.el));
  enter(title, 0);
  enter(chip, 0.25);
  times(items.length, { first: 1.5, step: 1.2 }).forEach((t, i) => enter(grid.tiles[i], t));
});
