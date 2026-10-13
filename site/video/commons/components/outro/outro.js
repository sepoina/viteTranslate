// outro: the logo and where to find viteTranslate; the music credits at the bottom. The closing.
// Sheet: outro.md. Variants: variants.yaml.
card.define(({ param, list, body, parts, enter }) => {
  const logo = parts.logo();
  logo.style.width = "min(calc(var(--logo) * 0.85), 100%)";
  const righe = list("lines", [["`npm i @sepoina/vitetranslate`"], ["VS Code Marketplace: **viteTranslate**"], ["github.com/sepoina/viteTranslate"]]);
  const lines = parts.lines(righe.map((r) => r.join("|")));
  body.append(parts.stack(logo, lines.el));
  enter(logo, 0);
  lines.items.forEach((li, i) => enter(li, 0.35 + 0.25 * i));
  // credits: from the recorder, the lines of the video's track (commons/bkmusic/credits.md).
  if (param("credits")) enter(parts.credits(param("credits").split("\n")), 1.1);
});
