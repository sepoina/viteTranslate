<div align="center">

<img src="https://github.com/sepoina/viteTranslate/raw/HEAD/idePlugin/media/icon.png" alt="" width="96" height="96" />

# viteTranslate for VS Code

**The editor half of [viteTranslate](https://github.com/sepoina/viteTranslate#readme).** <br/>
Every marked string and how its translation is doing, in a panel of its own. No more opening `vite.config` to remember whether `autoWrap` was on.

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-007ACC?logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=sepoina.vitetranslate-ide)
[![npm library](https://img.shields.io/npm/v/@sepoina/vitetranslate?logo=npm&logoColor=white&label=library&color=CB3837)](https://www.npmjs.com/package/@sepoina/vitetranslate)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](https://github.com/sepoina/viteTranslate/blob/HEAD/idePlugin/LICENSE)

[**Library**](https://github.com/sepoina/viteTranslate#readme) · [**Panel guide**](https://github.com/sepoina/viteTranslate/blob/HEAD/doc/ide-panel.md) · [**Site**](https://sepoina.github.io/viteTranslate/) · [**Issues**](https://github.com/sepoina/viteTranslate/issues)

</div>

![The viteTranslate panel next to the editor](https://github.com/sepoina/viteTranslate/raw/HEAD/doc/ide/panel.png)

> **Preview.** It reads your project and never writes to it. The only things that change files are **Sync** and the LLM actions, and they run the same CLI you'd type yourself.

## 🧩 One project, two halves

[viteTranslate](https://github.com/sepoina/viteTranslate#readme) is a Vite plugin: you write sentences right in your JSX, it extracts them and keeps one `.yml` table per language in sync. This extension is its view from inside the editor, and it doesn't work without it.

| The library (npm) | The extension (here) |
| --- | --- |
| Extracts marked strings, syncs the tables | Lists them file by file, each with its status |
| Fills `null` keys through an LLM, from the CLI | Runs Sync and the LLM actions in one click |
| Reads its options from `vite.config` | Shows them as resolved, plus versions and the API key's whereabouts |

It doesn't re-implement anything: **Results** asks the library installed in *your* project, so the panel and `npx vitetranslate` never disagree.

## ✨ Features

- **🔍 Every marked string, at a glance.** File by file, in source order. One glyph says how each one is doing: ‼️ malformed, 🔄 not synced, 🔸 untranslated, 🔹 partly translated, green when all is well. Filter, search (no case, no accents), click to jump.
- **🌍 Language files, one click away.** Pick an entry, then a language: the file opens right on that key, cursor on the translation.
- **🖍️ Highlighting as you type.** `_%_…_%_` (or your project's own delimiters), `<Trans>…</Trans>` and `` trans`…` `` stand out in `.js`, `.jsx`, `.ts` and `.tsx`, with the extraction's own rules: what lights up gets translated. Fifteen styles, all in your theme's colors.
- **🤖 Sync and LLM, without typing.** **Sync** and every `--llm-*` action run the project's own CLI in a terminal. The LLM page first answers "can I go?": where the API key is (never what), which model, and whether it replies.
- **⚙️ Your setup, resolved.** Plugin options, the dependencies that matter (*declared → installed*), Vite plugins in load order, library and extension versions.
- **📁 Monorepos welcome.** Every Vite project in the workspace, and the panel follows the file you're editing.

<table>
<tr>
<td width="50%"><img src="https://github.com/sepoina/viteTranslate/raw/HEAD/doc/ide/results.png" alt="Results, filtered to untranslated entries" /></td>
<td width="50%"><img src="https://github.com/sepoina/viteTranslate/raw/HEAD/doc/ide/llm.png" alt="The LLM page" /></td>
</tr>
<tr>
<td align="center"><sub>Results: filter, search, status glyphs</sub></td>
<td align="center"><sub>LLM: key, model, ping, then the actions</sub></td>
</tr>
</table>

![Highlighted strings in the editor](https://github.com/sepoina/viteTranslate/raw/HEAD/doc/ide/highlight.png)

## 🚀 Getting started

1. **Have viteTranslate in a Vite project**, version 4.6.4 or later. New to it? The [quick start](https://github.com/sepoina/viteTranslate#-quick-start) takes two minutes.

   ```sh
   npm install @sepoina/vitetranslate
   ```

2. **Install the extension** from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=sepoina.vitetranslate-ide), or:

   ```sh
   code --install-extension sepoina.vitetranslate-ide
   ```

3. **Click the % icon** in the Activity Bar. Highlighting needs nothing: open a `.jsx` file and it's on.

Older library, or none? The panel says so and gives you the `npm install` that fixes it.

**Requirements**: VS Code 1.90+, a [trusted workspace](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust) for anything beyond `package.json`, and on Windows a `node` in your PATH, so the CLI can ask you things (confirmations, the API key).

## ⌨️ Commands

From the panel, or the Command Palette under **viteTranslate:**

| Command | Does |
| --- | --- |
| **Sync language files** | Runs `vitetranslate` in a terminal: new keys in, stale ones out |
| **LLM** | Opens the LLM page: readiness check and every `--llm-*` action |
| **Settings** | Opens the settings page: options, files, versions |
| **Choose highlight style…** | Tries every style live on your code: <kbd>Enter</kbd> keeps it, <kbd>Esc</kbd> changes nothing |
| **Refresh** | Re-reads projects and rescans **Results** (it refreshes by itself on save too) |

## 🛠️ Settings

| Setting | Default | Does |
| --- | --- | --- |
| `vitetranslate.highlightStyle` | `framed-box` | How marked strings stand out, or `off` |
| `vitetranslate.detailCommand` | `false` | Terminals also show how the CLI is really launched: folder, runtime, runner, CLI file |

## 🔒 Safe by design

- **Read-only.** `vite.config` runs in a separate process, never through Vite: no plugin hook fires, nothing gets synced. A config that hangs is dropped after 15 seconds.
- **Restricted Mode respected.** Untrusted workspace? Nothing runs: you get `package.json` only.
- **Nothing heavy inside.** No Babel bundled: it uses the one your project already has, and lets it go after two idle minutes.
- **Secrets stay secret.** The API key is located, never displayed.

## 📚 More

- 📖 **[Panel guide](https://github.com/sepoina/viteTranslate/blob/HEAD/doc/ide-panel.md)**: every section, glyph and button, the fifteen styles, what happens under the hood.
- 🌐 **[viteTranslate](https://github.com/sepoina/viteTranslate#readme)**: the library, its [CLI](https://github.com/sepoina/viteTranslate/blob/HEAD/doc/cli.md) and the [LLM guide](https://github.com/sepoina/viteTranslate/blob/HEAD/doc/llm.md).
- 🧪 **[Run it from source](https://github.com/sepoina/viteTranslate/blob/HEAD/CONTRIBUTING.md#editor-extension-experimental)**: `npm run ide:dev` in the repository.
- 💬 **[Discussions](https://github.com/sepoina/viteTranslate/discussions)** for ideas, **[Issues](https://github.com/sepoina/viteTranslate/issues)** for bugs.
- 📄 **[License](https://github.com/sepoina/viteTranslate/blob/HEAD/idePlugin/LICENSE)**: Apache License 2.0.
