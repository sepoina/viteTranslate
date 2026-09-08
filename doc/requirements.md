# Requirements

> The [README](../README.md) covers the quick start. This page lists supported peer dependency versions.

| Peer dependency | Supported range | Optional |
| --- | --- | --- |
| Vite | `^5 \|\| ^6 \|\| ^7 \|\| ^8` | yes |
| React | `^18 \|\| ^19` *(for the `/react` entry point)* | yes |
| `@babel/core` | `^7 \|\| ^8` | **no** |

Install them if your project doesn't already have them. `.js`/`.jsx`/`.ts`/`.tsx` sources are all scanned. TypeScript declarations ship with the package.

## Why `@babel/core` is required

The plugin parses your sources with it to find the markers. Without it nothing is extracted, the markers reach the browser in their source form, and the app renders untranslated in every string while looking like it works. So its absence stops the dev server and fails the build, rather than producing a warning nobody reads.

Being a required peer, npm and pnpm install it on their own. Yarn only warns, and note that it no longer arrives by reflection from `@vitejs/plugin-react` either, which since version 6 does not depend on Babel. If your package manager left it out, install it yourself:

```sh
npm i -D @babel/core
```

Either major works, and both produce identical extraction. Babel 8 requires Node `^22.18 || >=24.11`, which is stricter than anything this plugin asks for. Note that npm only warns about `engines`, so it will happily install Babel 8 on an older Node, where it cannot be loaded at all. If that happens you are told so, and told to move Node or stay on Babel 7 — not to reinstall what you already have.

Under Vitest neither check fires. The test runner executes the plugin's hooks, and your suite should not die over a dependency your tests never reach.

## It never reaches your bundle

Babel runs on your machine during `serve` and `build`, and nothing of it enters the bundle you ship. That holds however you place the package in your `package.json`, and it is checked rather than assumed: the test suite asserts that the browser runtime imports nothing beyond React and the virtual module, and that no trace of Babel survives in it.

One asymmetry worth knowing. With server side rendering the runtime is executed by Node in production, so there the package belongs in `dependencies`, and Babel is classified as a production dependency along with it. The same applies if you republish a library that re-exports these components.

That asymmetry has a price, and it is the price of making the peer required: in those two cases your production install pulls Babel and its tree, for something that never runs there. `npm install --omit=dev` will not drop it, because it is not a dev dependency in that arrangement. If the weight matters more to you than the automatic install, declare `@babel/core` optional in your own `peerDependenciesMeta`: the checks above are about *using* the plugin, not about how it got installed, and they keep working either way.
