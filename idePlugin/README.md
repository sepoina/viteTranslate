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

- **Languages**: the language files in `localeDir`, one row each, listed like **Config**: the
  language code and its name in that language, the source first. Click one to open it. An entry
  selected in **Results**? It opens right on that key, cursor on the translation: fix it there. A ⚡
  next to *Languages* says so; select a file or a folder, or hide Results, and it's gone.
  The icon tells you how it's doing: green for the source, yellow when translations are missing
  (the badge says how many), red when the file can't be read, plain when it's complete. No files
  yet? One line says why.
- **The command bar**: **Sync** runs the project's own `vtranslate-cli` in a terminal, and **LLM**
  swaps **Results** for the LLM panel (below). On the right: ↻ refresh, ⓘ **Inspector** (below), 🔧
  open `vite.config` right on the `vitetranslate({…})` options, ⚙ the extension settings.

Keep **Project** at least as tall as its command bar: VS Code lets you drag a section down to
nothing, and the bar goes with it.

### Inspector

Click ⓘ and it takes the place of **Results**; click it again, or *Close*, and Results is back. A
tree you open as you like, and it stays as you left it:

- **vitetranslate**: the plugin options, as the plugin itself resolved them. Source language,
  locale folder, preloaded languages, auto-sync, `autoWrap`, ICU time zone, the `llm` block
  (model, endpoint, budget, and the *name* of the key variable, never the key). Whatever you did
  not set is marked `default`.
- **package.json**: the dependencies that matter (`@sepoina/vitetranslate`, `vite`, `react`,
  `@babel/core`, …) as *declared → installed*, plus the scripts. Click it to open it.
- **vite.config**: the plugins in load order, the server port and host. Click it to open it.

Pick another project and the tree follows.

### LLM

Click **LLM ›** and it takes the place of **Results**. On top, three lines that answer "can I go?":

- **API key**: *where* it is (an environment variable, `.env.local`, `.env`, the system keyring),
  never what it is. Not found? It says where it looked.
- **Settings**: which model, at which host, and whether prices are set (without them, costs and
  budgets count tokens, not money).
- **Ping**: does the model answer? Asked in the background, once per project, with one tiny
  request. Skipped when there's no key: no point knocking without one.

Below, the `--llm-*` actions: translate, estimate the cost, retranslate, regenerate the context,
status, ping, set / check / clear the API key. Click one and it runs in a terminal, like Sync.
*Check again* redoes the three lines; *Close*, or the × in the title, brings Results back.

No `llm` block in the plugin options? The button reads **LLM ?** and the same spot shows **Help**:
how to add one.

## Under the hood

**Results** asks *your* installed `@sepoina/vitetranslate` (and its `@babel/core`), in a separate process:
same entries `vtranslate-cli` would find, no Babel shipped inside the extension. Line numbers and
the green shades need the library newer than 4.6.3; an older one still lists the entries, with
lines missing and a plain ✅.

It's quick because every sync (4.6.4 and later) leaves an index of the entries in
`node_modules/.viteTranslate/markers.json`, and the panel re-parses only what you changed since.
After a save Babel stays warm for two minutes, then the process goes away.

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
