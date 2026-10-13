// title: the logo, then a line with a green half. The opening.
// Sheet: title.md. Variants: variants.yaml.
card.define(({ param, body, parts, enter }) => {
  const logo = parts.logo();
  const lead = parts.lead(param("line", "Write the sentence."), param("accent", "Get the translation."));
  body.append(parts.stack(logo, lead));
  enter(logo, 0, { duration: 1 });
  enter(lead, 0.45, { duration: 1 });
});
