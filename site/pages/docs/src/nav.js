// La colonna di sinistra del manuale: gruppi, ordine e link esterni. Le etichette delle pagine
// sono i loro `title` (frontmatter); qui stanno solo i nomi dei gruppi e i link fuori dal manuale.
// Il compilatore (scripts/compileDocs.mjs) legge questo file come testo: ogni pagina compare una volta
// sola, come stringa `sezione/pagina` tra virgolette, e ogni stringa di questo tipo deve avere la sua pagina.
// Un link esterno ha `href`: `https://…` oppure `repo:percorso` (un file del repo su GitHub).
export const NAV = [
  {
    label: "_%_Getting started_%_",
    items: [
      "getting-started/overview",
      "getting-started/installation",
      "getting-started/usage",
      "getting-started/live-examples",
      "getting-started/faq",
    ],
  },
  {
    label: "_%_Concepts_%_",
    items: [
      "concepts/markers",
      "concepts/translation-files",
      "concepts/languages",
      "concepts/icu",
      "concepts/diagnostics",
      "concepts/preloading",
      "concepts/limitations",
    ],
  },
  {
    label: "_%_Components_%_",
    items: [
      "components/translate-container",
      "components/translate",
    ],
  },
  {
    label: "_%_Hooks and helpers_%_",
    items: [
      "hooks/use-translate-to-string",
      "hooks/use-translate-node",
      "hooks/use-translate-language",
      "hooks/helpers",
    ],
  },
  {
    label: "_%_API reference_%_",
    items: [
      "api/plugin-options",
      "api/cli",
      "api/types",
    ],
  },
  {
    label: "_%_Tutorials_%_",
    items: [
      "tutorials/first-app",
      "tutorials/language-switcher",
      "tutorials/plurals-and-dates",
      "tutorials/migrating-from-3",
    ],
  },
  {
    label: "_%_LLM_%_",
    items: [
      "llm/setup",
      "llm/price",
      "llm/providers",
      "llm/context",
      "llm/running",
    ],
  },
  {
    label: "_%_VS Code extension_%_",
    items: [
      "vscode/install",
      "vscode/panel",
      "vscode/commands-settings",
    ],
  },
  {
    label: "_%_Resources_%_",
    items: [
      { label: "_%_Changelog_%_", href: "https://github.com/sepoina/viteTranslate/releases" },
      { label: "_%_Contributing_%_", href: "repo:CONTRIBUTING.md" },
      { label: "_%_Architecture_%_", href: "repo:doc/structure.md" },
    ],
  },
];
