# Known limitations

> The [README](../README.md) covers the quick start. This page lists the limitations to be aware of.

> [!WARNING]
> - **Ids are a 32-bit hash** over the file's path and the text. A collision between two strings is unlikely but possible, and reported as a build warning naming both.
> - **Markers must be whole strings.** One embedded in a longer string, or a template literal with `${...}` inside, is not extracted — use a `%s` placeholder instead.
> - **The CLI loads your Vite config with Node itself**, not Vite — a TypeScript config needs a Node that strips types (23.6+).
> - **`basicHtmlToNodes()` still needs the DOM** if called directly. `<Translate>` no longer does.
