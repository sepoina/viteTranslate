# Known limitations

> The [README](../README.md) covers the quick start. This page lists the limitations to be aware of.

> [!WARNING]
> - **Ids are a 32-bit hash** over the file's path and the text. A collision between two strings is unlikely but possible, and reported as a build warning naming both.
> - **Markers must be whole strings.** One embedded in a longer string, or a template literal with `${...}` inside, is not extracted — use a `%s` placeholder instead.
> - **The CLI loads your Vite config with Node itself**, not Vite — a TypeScript config needs a Node that strips types (23.6+).
> - **`basicHtmlToNodes()` still needs the DOM** if called directly. `<Translate>` no longer does.
> - **`autoWrap` never touches attributes.** `title="_%_x_%_"` still needs `ts()` — a component can't render inside a prop.
> - **Markup inside a JSX text marker doesn't survive, `autoWrap` or not.** `<p>_%_hi <b>there</b>_%_</p>` is split by the JSX parser itself before extraction ever sees it, and stays a plain string. Not a bug to fix — write two markers, or one with a `%s` and the tag around the call.
> - **An auto-wrapped text can't take a `%s` argument.** The tag `autoWrap` emits is self-closing, with no room for an argument list — write `<Translate t={["_%_...%s..._%_", value]} />` by hand instead. A misused one gets a build-time warning, not a silent drop.
