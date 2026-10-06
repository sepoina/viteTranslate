# viteTranslate for VS Code

> **Experimental, 0.0.2.** It reads your setup. It never touches it.

Your [viteTranslate](https://github.com/sepoina/viteTranslate) setup at a glance, in its own panel:
click the % icon in the Activity Bar. No more opening `vite.config` to remember whether `autoWrap`
was on.

## What you see

Three sections, open and close them like any sidebar. At startup only **Selector** shows, saying
what it's reading; **Results** and **Project** join in when they have something true to say.

### Selector

What you look at, and what to do with it. Top to bottom:

- **Config**: every Vite project in the workspace, one row each: its `package.json` name and its
  folder. Click one and it's *the* project, for **Results** and **Project**. Only one project?
  Nothing to choose, so no list.
- **Filter**: what **Results** shows. **All**, **Malformed** (‼️, unreadable files too), **Not
  synced** (🔄) or **Untranslated** (🔸 🔹), each with its count. Only the ones with something inside
  show up, and when all is well the filter steps aside.
- **Search**: narrows **Results** to the entries whose text, or file path, contains what you type.
  No case, no accents: `citta` finds *Città*. It shows up once there's something to search, and
  stays while you type, even when nothing matches. <kbd>Esc</kbd>, or the × on its right, clears it.

### Results

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

Hover an entry for the details: which languages are missing, what the extraction said.

### Project

The selected project, and what to do with it. The languages scroll; the command bar stays put at
the bottom.

- **Translations**: the language files in `localeDir`, one row each, listed like **Config**: the
  language code and its name in that language, the source first. Click one to open it. An entry
  selected in **Results**? It opens right on that key, cursor on the translation: fix it there. A ♥
  next to the title says so (hover for the key); pick a file or a folder, or hide Results: gone.
  The icon tells you how it's doing: green for the source, yellow when translations are missing
  (the badge says how many), red when the file can't be read, plain when it's complete. No files
  yet? One line says why.
- **The command bar**: **Sync** runs the project's own `vtranslate-cli` in a terminal, and **LLM**
  swaps **Results** for the LLM panel (below). On the right: GitHub, ⚙ **Settings** (below), ↻
  refresh.

Keep **Project** at least as tall as its command bar: drag it to nothing and the bar goes too.

### Taking over: Settings, LLM, Help

These take the panel for themselves: **Results** and **Project** step aside and the
background takes a tint of your theme's accent. The command bar stays, same look: **← Back** on
the left, plus the page's own commands if it has any; on the right, the page's icon. Back puts
everything back where it was (so does the ← in the section title).

### Settings

Click ⚙ in **Project**. On top, the logo and a small box: the CLI version installed in the
project, and the oldest one this extension fully works with (yellow when yours is older, or
missing). Hover the icons to see which is which. Then, under **CONFIG**, one row per setting, like
LLM's actions.

- **Highlight style**: each style with a sample; click one, editors switch at once.
- **Vite config**: `vite.config`, opened right on the `vitetranslate({…})` options.
- **Detailed config**: the extension's own settings in VS Code.
- **Local file status**: what the selected project's files say.
  - **vitetranslate**: the plugin options as resolved: source language, locale
    folder, preloaded languages, auto-sync, `autoWrap`, ICU time zone, the `llm` block (model,
    endpoint, budget, the *name* of the key variable, never the key). Unset: `default`.
  - **package.json**: the dependencies that matter (`@sepoina/vitetranslate`, `vite`, …) as
    *declared → installed*, plus the scripts. Click to open.
  - **vite.config**: plugins in load order, server port and host. Click to open.

### LLM

Click **LLM ›** in **Project**. On top, three lines that answer "can I go?":

- **API key**: *where* it is (an environment variable, `.env.local`, `.env`, the system keyring),
  never what it is. Not found? It says where it looked.
- **Settings**: which model, at which host, and whether prices are set (without them, costs and
  budgets count tokens, not money).
- **Ping**: does the model answer? One tiny request, in the background, once per project. No key,
  no knocking.

Below, the `--llm-*` actions, each explained: translate, estimate the cost, retranslate,
regenerate the context, status, ping, set / check / clear the API key. Click one and it runs in a
terminal, like Sync. *Check again*, in the bar, redoes the three lines; if one went wrong, the
**?** next to it opens the setup guide.

No `llm` block in the plugin options? The button reads **LLM ?** and opens **Help** instead: how
to add one, and a button that opens the options in `vite.config`.

## Highlighting

Marked strings stand out as you type, in `.js`, `.jsx`, `.ts` and `.tsx`: `_%_…_%_`, `<Translate>…</Translate>`,
`` ts`…` ``. Same rules as the extraction: what lights up gets translated. Comments, and code samples inside
strings, stay plain.

Fifteen styles, all in your theme's colors. Pick one in **Settings**, each with a sample.
Or **viteTranslate: Choose highlight style…** tries each on your code as you move through the list: Enter keeps
it, Esc changes nothing. Or set `vitetranslate.highlightStyle`, `off` included. No panel needed.

<details><summary>The fifteen styles</summary>

| Style | Looks like |
| --- | --- |
| `framed-box` (default) | Box and frame |
| `badge` | Filled label |
| `dotted-escape` | Fine underline |
| `escape-chip` | Chip and ruler |
| `highlighter` | Marker effect |
| `inlay-hint` | Like inlay hints |
| `inset` | Inset backdrop |
| `keyword-mark` | Keyword accent |
| `link` | Dotted link |
| `neutral-italic` | Italic only |
| `outlined-chip` | Chip with border |
| `pill` | Chip on content |
| `placeholder` | Snippet style |
| `quote` | Left accent bar |
| `selection-veil` | Like selection |

</details>

## Under the hood

**Results** asks *your* installed `@sepoina/vitetranslate` (and its `@babel/core`), in a separate process:
same entries `vtranslate-cli` would find, no Babel shipped inside the extension. Line numbers and
the green shades need the library newer than 4.6.3; an older one still lists the entries, with
lines missing and a plain ✅.

It's quick because every sync (4.6.4 and later) leaves an index of the entries in
`node_modules/.viteTranslate/markers.json`, and the panel re-parses only what you changed since.
After a save Babel stays warm for two minutes, then the process goes away.

**Sync** and the LLM actions run in a terminal that tidies up after itself: when the CLI is done,
press Enter within 10 seconds to keep it, any other key to close it now, or just look away. If
something failed it stays until you press a key: the error is the part worth reading.

Opening a JS or TS file wakes the extension for the highlighting only: `vite.config` is read, and the project scanned, when you open the panel.

<details><summary>Which runtime Sync uses</summary>

They run the CLI with the editor's own runtime. Except on Windows, where that runtime goes mute
in a terminal: there they use the `node` in your PATH, the one Vite runs on. No Node in PATH? They
still run and you see the output, but they can't ask you anything (*Translate*'s confirmation, the
API key), and the terminal waits for a key the usual way. A warning says so, once.

</details>

## Settings

⚙ in **Project** opens them.

| Setting | Default | What it does |
| --- | --- | --- |
| `vitetranslate.detailCommand` | `false` | **Sync** and the LLM actions open their terminal with the command you'd type yourself, `$ npx vitetranslate --status`, colors included. Turn it on to also see how it's really launched: folder, runtime, runner, CLI file. |
| `vitetranslate.highlightStyle` | `framed-box` | How marked strings stand out in the editor, or `off`. Try them live with **Choose highlight style…**. |

## Which project

The one highlighted in **Config**, and it follows you around: switch to a file and its project
takes the highlight, while **Results** jumps to that file with its entries open. Same project?
Nothing redraws. Picked another one in **Config**? It stays until you switch editor, and across
restarts. Until there is one, **Results** and **Project** wait for you.

It works the other way too: put the cursor on a line with a marked string and **Results** selects
that entry (with *Filter* on *All* and *Search* empty, and the file saved). Your cursor stays put.

Everything refreshes by itself when a `package.json` or `vite.config.*` changes (and, for
**Results**, a source or language file). ↻ does it on demand.

While it catches up, the panel never passes off old news as fresh: a project still loading says
*Loading…*, a file you just saved shows ⏳, one with unsaved edits shows ✎, and their entries
stop jumping (the lines may have moved) until the new scan lands.

## How it reads vite.config

It runs it, the way `vtranslate-cli` does: in a separate process and never through Vite. No plugin
hook runs, nothing gets synced, nothing gets written. A config that hangs is dropped after 15
seconds, and whatever it prints ends up in the **viteTranslate** output channel.

In **Restricted Mode** nothing runs: you get `package.json` only, no **Results** and no **Sync**. Trust the
workspace to see the rest.

## Try it from the repository

```bash
npm run ide:dev       # a new window with the extension loaded from idePlugin/
npm run ide:install   # build, package (idePlugin/vitetranslate-ide-<version>.vsix), install
```

After `ide:install`, run **Developer: Reload Window**. On VSCodium:
`VT_CODE_CLI=codium npm run ide:install`.
