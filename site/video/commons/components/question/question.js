// question: a big question, then its answer in a few words lighting up on the voice.
// Sheet: question.md. Variants: variants.yaml.
card.define(({ param, list, times, body, parts, enter }) => {
  const question = parts.headline(param("question", "Another i18n library?"), { role: "hero" });
  const words = parts.words(list("words", [["JSX"], ["Vite"], ["VS Code"]]).map(([w]) => w));
  body.append(parts.stack(question, words.el));
  enter(question, 0, { duration: 1 });
  enter(words.el, 0.3, { fx: "rise", duration: 1, y: 32 }); // the row comes in waiting, barely visible
  times(words.words.length, { first: 1.6, step: 0.6 }).forEach((t, i) => {
    enter(words.words[i], t);
    if (i) enter(words.dots[i - 1], t);
  });
});
