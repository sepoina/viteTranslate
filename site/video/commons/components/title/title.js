// title: the logo, then a line with a green half, and (with `words`) a second line whose words light up. The opening.
// Sheet: title.md. Variants: variants.yaml.
card.define(({ param, list, times, body, parts, enter }) => {
  const logo = parts.logo();
  const lead = parts.lead(param("line", "Write the sentence."), param("accent", "Get the translation."));
  // `words`: a second line under the claim; the row comes in waiting, then each word (and the dot before it) lights up.
  const words = list("words").length ? parts.words(list("words").map(([w]) => w), { role: "body" }) : null;
  // The words under the claim are its second line: close, at a line spacing of 160%, not a block of their own.
  const claim = words ? parts.stack(lead, words.el) : lead;
  if (words) claim.classList.add("claim");
  body.append(parts.stack(logo, claim));
  enter(logo, 0, { duration: 1 });
  enter(lead, 0.45, { duration: 1 });
  if (words) {
    enter(words.el, 0.9, { fx: "rise", duration: 1, y: 24 });
    times(words.words.length, { first: 1.6, step: 0.5 }).forEach((t, i) => {
      enter(words.words[i], t);
      if (i) enter(words.dots[i - 1], t);
    });
  }
});
