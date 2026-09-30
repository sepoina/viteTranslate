# viteTranslate for VS Code

> **Experimental, 0.0.2.** It reads your setup. It never touches it.

Your [viteTranslate](https://github.com/sepoina/viteTranslate) setup at a glance, in its own panel:
click the % icon in the Activity Bar. No more opening `vite.config` to remember whether `autoWrap`
was on.

## What you see

Three sections, open and close them like any sidebar.

### Configs

Every Vite project in the workspace, one row each: its `package.json` name and its folder. Click
one and the green ▶ jumps there at once: that is *the* project, for **Marked** and **Details**. Only one
project in the workspace? Then there is nothing to choose, and **Configs** stays out of the way.

### Marked

Every string the project marks for translation, file by file: the folders of `srcDir`, only the
files that have something marked, and under each file its entries in source order. Click an entry
and the cursor lands on it. Save a file (or a language file) and the list follows.

One glyph in front of each entry says how it's doing. Trouble wears the same glyphs your app shows
on screen: your `errorSolve.mark`, or the defaults.

| | means |
| --- | --- |
| ‼️ | *malformed*: the extraction complained right there (nested or unpaired `_%_`, a rejected macro) |
| 🔄 | *not synced*: not in the language files yet. Run the sync (this one is the panel's own) |
| 🔸 | *untranslated*: `null` in every target language |
| 🔹 | *not fully translated*: still `null` somewhere |

All good is green, and the shade tells you how it's written:

| | written as |
| --- | --- |
| 🟢 | `"_%_…_%_"` in code |
| ✅ | marked JSX text or attribute |
| ❇️ | `<Translate>…</Translate>`, or a marked sentence with tags and values (`autoWrap`) |
| ✳️ | `` ts`…` ``, or a marked template with `${…}` |

On top, the same ▶ as in **Configs** picks what you see: **Problematic only** or **All**. Hover an entry for the
details: which languages are missing, what the extraction said.

### Details

The selected project's setup:

- **vitetranslate**: the plugin options, as the plugin itself resolved them. Source language,
  locale folder, preloaded languages, auto-sync, `autoWrap`, ICU time zone, the `llm` block (model,
  endpoint, budget, and the *name* of the key variable, never the key). Whatever you did not set is
  marked `default`.
- **package.json**: the dependencies that matter (`@sepoina/vitetranslate`, `vite`, `react`,
  `@babel/core`, …) as *declared → installed*, plus the scripts.
- **vite.config**: the plugins in load order, the server port and host.

Click `package.json` or `vite.config.*` to open it.

## Under the hood

**Marked** asks *your* installed `@sepoina/vitetranslate` (and its `@babel/core`), in a separate process:
same entries `vtranslate-cli` would find, no Babel shipped inside the extension. Line numbers and
the green shades need the library newer than 4.6.3; an older one still lists the entries, with
lines missing and a plain ✅.

## Which project

The one with the green ▶. It stays there while you hop between files, and across restarts.
Until you pick one, **Marked** and **Details** wait for you.

Everything refreshes by itself when a `package.json` or `vite.config.*` changes (and, for
**Marked**, a source or language file). The ↻ button refreshes on demand.

## How it reads vite.config

It runs it, the way `vtranslate-cli` does: in a separate process and never through Vite. No plugin
hook runs, nothing gets synced, nothing gets written. A config that hangs is dropped after 15
seconds, and whatever it prints ends up in the **viteTranslate** output channel.

In **Restricted Mode** nothing runs: you get `package.json` only, and no **Marked**. Trust the
workspace to see the rest.

## Try it from the repository

```bash
npm run ide:dev       # a new window with the extension loaded from idePlugin/
npm run ide:install   # build, package (idePlugin/vitetranslate-ide-0.0.2.vsix), install
```

After `ide:install`, run **Developer: Reload Window**. On VSCodium:
`VT_CODE_CLI=codium npm run ide:install`.
