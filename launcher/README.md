# vitetranslate

The `vitetranslate` command, installed once for every project on your machine.

```bash
npm i -g vitetranslate
cd my-app
vitetranslate --status
```

It is a launcher and nothing more. It finds [`@sepoina/vitetranslate`](https://www.npmjs.com/package/@sepoina/vitetranslate) in the project you are in (`./node_modules`, then every folder above, the way Node does) and runs **that copy's** command with your options.

So the version that runs is always the project's own, newer or older than this launcher. On purpose: the command and the Vite plugin write the same translation tables, and two versions writing the same files is a debugging session nobody asked for. It also means you never update this package to get a new release of the library: you update the library in the project, as usual.

## When there's nothing to launch

It tells you what to type:

| Situation | Suggestion |
| :- | :- |
| No `package.json` here or above | run it from your project's root, or create a Vite app |
| In `package.json`, not installed | `npm install` |
| Not a dependency at all | `npm i -D @sepoina/vitetranslate` |
| Yarn Plug'n'Play | `yarn vtranslate-cli`: there is no `node_modules` for a global command to look into |

The package manager comes from your lockfile: pnpm, Yarn and Bun get their own commands.

## Options of its own

- `--version`: this launcher's version, plus which copy it would run and where that copy lives.
- `--help`: the project's own help. This launcher's shows up only when there is no copy to ask.

Everything else goes straight to the project's command: see the [CLI reference](https://github.com/sepoina/viteTranslate/blob/main/doc/cli.md).

## No global install?

Not required. Inside a project, `npx vtranslate-cli` runs the same command, and in `package.json` scripts the bare name is enough. `npx vitetranslate` works too: npx fetches this launcher for the occasion.

Works with projects on `@sepoina/vitetranslate` 2.0 and later.
