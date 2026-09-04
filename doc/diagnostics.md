# Diagnostics: `errorSolve`

> The [README](../README.md) covers the quick start. This is the full detail on on-screen and console diagnostics — see [plugin options](plugin-options.md) for the config shape.

🧪 **[Edge cases, live](https://sepoina.github.io/viteTranslate/edge/)** — every case below, rendered next to what it is supposed to render.

A string that doesn't reach the screen translated is not always a bug you can see. A key nobody has translated yet still renders — in the source language, indistinguishable from a real translation. A text nobody marked renders too. Both look fine, and that is the problem.

`errorSolve` puts a character in front of them, **in development only**, so you spot them by reading the page instead of by auditing the tables. Every field is optional; these are the defaults:

```js
vitetranslate({
  localeDir: "locale",
  sourceLanguage: "it-IT",
  errorSolve: {
    mark: {
      badData: "🚫",            // a value that is not text and never will be
      malformed: "‼️",          // text nobody marked, or incompatible props
      untranslated: "🔸",       // no translation in the current language
      notFullyTranslated: "🔹", // translated here, missing in some other language
      absentDataInArray: "⁇",   // a %s left without a value
    },
    markOnlyDev: true,          // in a build: just the fallback, no characters
    warningDev: true,           // runtime console in development
    warningBuild: false,        // runtime console in production
  },
})
```

Two questions, kept apart: `mark` is **what** you see, everything else is **when** — on screen with `markOnlyDev`, in the console with `warningDev` / `warningBuild`.

One prefix per string, the worst one wins: `‼️` → `🔸` → `🔹`. Set any of them to `""` or `false` to turn that one off. `🚫` never competes with the other three — it fires only where there is no text for a prefix to sit in front of; see [below](#when-there-is-no-text-at-all).

With `markOnlyDev: true` (the default) a production build ships none of this — not the characters, and not the data behind them: the untranslated-key lists never enter the language chunks and the global set stays empty. `mark.absentDataInArray` is the exception: it isn't a diagnostic but ordinary rendering, so it applies in development and in a build alike.

## Case by case

| What happened | Dev | Build (default) |
| --- | --- | --- |
| Text nobody marked — `<Translate>Mira Halvorsen</Translate>` | `‼️Mira Halvorsen` | `Mira Halvorsen` |
| Same, but declared with `skipMark` | `Mira Halvorsen` | `Mira Halvorsen` |
| Incompatible props — `t` and `children` together | `‼️` + the text that was there | the text that was there |
| No translation in this language | `🔸` + source text | source text |
| Translated here, missing elsewhere | `🔹` + translation | translation |
| A value that is not text — `t={() => {}}` | `🚫[func]` | nothing |
| A `%s` with no value | `⁇` (`mark.absentDataInArray`) | `⁇` (`mark.absentDataInArray`) |

Incompatible props never erase the text: the best available one is recovered and rendered — the string in `t`, the children, the first element of the tuple. A mistake in *your* props is not paid for by whoever is reading the screen.

## When there is no text at all

Sometimes there is genuinely nothing to recover: a function, a symbol, a React element in the first slot of the tuple, an empty tuple. "Always show something" cannot apply — there is no something — and the only useful thing left to say is **what** was there instead of the text. That is `mark.badData`, and unlike the other three it is not a prefix in front of a text: it is the whole rendering.

| Value | Dev | Build (default) |
| --- | --- | --- |
| `t={() => {}}` | `🚫[func]` | nothing |
| `t={Symbol("x")}` | `🚫[symbol]` | nothing |
| `t={true}` | `🚫[true]` | nothing |
| `t={[]}` | `🚫[array]` | nothing |
| `t={[null]}` | `🚫[nullArray]` | nothing |
| `t={[<i/>]}`, or `t` and `children` both elements | `🚫[badDom]` | nothing |
| any other unreadable shape | `🚫[badData]` | nothing |

🧪 The seven of them are live on the [edge cases page](https://sepoina.github.io/viteTranslate/edge/), under *Valori che testo non sono*.

The name comes from the **first slot that mattered** — the first element of the tuple, the `t` field of the object — because that is where the text was supposed to be: about `t={[<i/>]}` the thing worth saying is that a node sits where the text belonged, not that there is an array. `array` and `nullArray` are for the tuples where that slot doesn't exist or is empty, and there the wrapper *is* the information.

`markOnlyDev` covers this one too, and **turned off it renders nothing at all**: the type name on its own is noise for whoever is reading the page, and an empty rendering is already what the component does for its other "nothing to show" case, the object with no `t` field. The console message stays, under `warningDev`/`warningBuild` as always.

## Unmarked text is domain data, not an error

`<Translate>` used to throw in development on a string without `_%_..._%_`. But plenty of text is not translatable and never will be: a phone number, a field name configured in an admin panel, an exception message, a description coming from the server. Deciding between the two meant inspecting the marker *before* calling `<Translate>` — rewriting outside a decision that belongs here.

Now the marker is the discriminator and the component applies it: marked text is translated, unmarked text is rendered as it is. So a leaf component can take whatever its caller has:

```jsx
// all six of these work, and none of them needs a wrapper
<Translate>_%_Welcome_%_</Translate>
<Translate t={["_%_Hello %s_%_", username]} />
<Translate o={{ t: "_%_Hello %s_%_", a: [username] }} />   // object form
<Translate>{user.phoneNumber}</Translate>                  // domain data, rendered as is
<Translate t={item.count} />                               // a number, "0" included
<Translate t={<WaitingBarSpan />} />                       // an element renders itself
```

The `o` prop — and the same `{ t, a }` object passed to `t`, or to `ts()` — is for text that already travels packaged with its arguments, which is how several application cores carry it. It is exactly equivalent to passing them separately.

In development that phone number shows a `‼️`, and that is the point: the prop is receiving something nobody will translate, and you get to decide whether that is right. When the answer is "yes, and it always will be", say so with [`skipMark`](api.md#skipmark-when-unmarked-is-the-normal-case) and the `‼️` goes away for that call site only — unlike `mark: { malformed: false }`, which would turn it off everywhere.

A number and a React element don't need the declaration: neither can ever come from the source marked, so both are rendered directly, with no prefix and no warning.

🧪 Marked, unmarked, `skipMark` and everything in between are live on the [edge cases page](https://sepoina.github.io/viteTranslate/edge/), under *Testo non marcato e skipMark*.

## Console output

`warningDev` and `warningBuild` are the switch for **everything the library prints in the browser** — the diagnostics above, the missing-key report, the unknown-language and failed-chunk errors, the warning about an `initialLanguage` that isn't preloaded.

> [!IMPORTANT]
> With `warningBuild: false` (the default) a published app is completely silent, including the messages that report a real failure — a language chunk that didn't load, a tag that doesn't exist. Set `warningBuild: true` to keep them.

Plugin messages (build time, prefixed `[vitetranslate]`) are not affected: they are not runtime output.

**Plugin messages during `vite dev` follow their own rule: one warning per category, the rest on request.** A typo in a language file used to print a line on every save — the manifest regenerates each time a language file changes — and ten broken files printed ten lines at once. Now the first message in a given category (an invalid language file, an empty one, a malformed marker, and so on) prints in full; the rest of that category are just counted, closing with `+N more: run "npx vtranslate-cli --status" for the full list`. The block appears a quarter of a second after the last warning of the batch, so one page load is one block and not five. Reloading a page with the exact same problems as before prints nothing a second time — but only within the same `vite dev` process: restarting it always shows the full picture at least once, and if the count is unchanged from the previous run the closing line just says so ("same as the previous session").
