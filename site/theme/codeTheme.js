// The code blocks' TextMate theme: the base16 template for TextMate and VS Code
// (https://github.com/chriskempson/base16-textmate), scope by scope, with each colour a slot of
// codeScheme.css. No colour is written here: to change style, change the scheme. Shiki reads it when
// the manual compiles (pages/docs/scripts/compileDocs.mjs) and writes the slot into the page as a class
// (`b0E` → `var(--base0E)`, code.css), so the browser gets no highlighter at all.
// SOURCE in site/theme/: the copies in src/theme/ are made by `npm run site:theme`.

const slot = (n) => `var(--base${n})`;

const rule = (name, scope, n, fontStyle) => ({ name, scope, settings: { foreground: slot(n), ...(fontStyle ? { fontStyle } : {}) } });

export default {
  name: "base16",
  type: "dark",
  colors: { "editor.background": slot("00"), "editor.foreground": slot("05") },
  tokenColors: [
    { settings: { foreground: slot("05"), background: slot("00") } },
    rule("Comments", ["comment", "punctuation.definition.comment"], "03"),
    rule("Delimiters", ["punctuation.separator", "punctuation.terminator"], "05"),
    rule("Operators", ["keyword.operator"], "05"),
    rule("Keywords", ["keyword"], "0E"),
    rule("Variables", ["variable"], "08"),
    rule("Functions", ["entity.name.function", "meta.require", "support.function.any-method", "variable.function"], "0D"),
    rule("Labels", ["entity.name.label"], "0F"),
    rule("Classes", ["support.class", "entity.name.class", "entity.name.type.class"], "0A"),
    rule("Methods", ["keyword.other.special-method"], "0D"),
    rule("Storage", ["storage"], "0E"),
    rule("Support", ["support.function"], "0C"),
    rule("Strings, Inherited Class", ["string", "constant.other.symbol", "entity.other.inherited-class"], "0B"),
    rule("Integers", ["constant.numeric"], "09"),
    rule("Constants", ["constant"], "09"),
    rule("Tags", ["entity.name.tag"], "08"),
    rule("Attributes", ["entity.other.attribute-name"], "09"),
    rule("Attribute IDs", ["entity.other.attribute-name.id", "punctuation.definition.entity"], "0D"),
    rule("Selector", ["meta.selector"], "0E"),
    rule("Headings", ["markup.heading punctuation.definition.heading", "entity.name.section"], "0D"),
    rule("Units", ["keyword.other.unit"], "09"),
    rule("Bold", ["markup.bold", "punctuation.definition.bold"], "0A", "bold"),
    rule("Italic", ["markup.italic", "punctuation.definition.italic"], "0E", "italic"),
    rule("Code", ["markup.raw.inline"], "0B"),
    rule("Link Text", ["string.other.link"], "08"),
    rule("Link Url", ["meta.link"], "09"),
    rule("Lists", ["markup.list"], "08"),
    rule("Quotes", ["markup.quote"], "09"),
    rule("Inserted", ["markup.inserted"], "0B"),
    rule("Deleted", ["markup.deleted"], "08"),
    rule("Changed", ["markup.changed"], "0E"),
    rule("Colors", ["constant.other.color"], "0C"),
    rule("Regular Expressions", ["string.regexp"], "0C"),
    rule("Escape Characters", ["constant.character.escape"], "0C"),
    rule("Embedded", ["punctuation.section.embedded", "variable.interpolation"], "0F"),
  ],
};
