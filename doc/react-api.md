# React API

> The [README](../README.md) covers the quick start. This is the full reference for every export of `@sepoina/vitetranslate/react`.

🧪 **[Edge cases, live](https://sepoina.github.io/viteTranslate/edge/)** — every call form, every value that is not text, side by side with what it renders.

## At a glance

| Export | Kind | For |
| :- | :- | :- |
| [`TranslateContainer`](#translatecontainer) | component | Wraps the app once, at the root: holds the current language, loads the tables |
| [`<Translate>`](#translate) | component | Translated text in JSX |
| [`useTranslateToString()`](#usetranslatetostring) | hook | Translated plain strings — `placeholder`, `aria-label`, `title` |
| [`useTranslateNode()`](#usetranslatenode) | hook | What the `autoWrap` option injects; rarely written by hand |
| [`useTranslateLanguage()`](#usetranslatelanguage) | hook | A language switcher: current language, available ones, [`proposeNewLanguage()`](#proposenewlanguage) |
| [`basicHtmlToNodes()`](#basichtmltonodes) | function | A string with basic HTML → React nodes, no `dangerouslySetInnerHTML` |
| [`version`](#version) | string | The installed package version |

And how languages load on the first render: [Preloading, Suspense and the initial flash](#preloading-suspense-and-the-initial-flash).

## `TranslateContainer`

```jsx
<TranslateContainer initialLanguage="it-IT">
  <App />
</TranslateContainer>
```

| Prop | Type | Default | Description |
| :- | :- | :- | :- |
| `initialLanguage` | `string` | the first eager language: `preloadedLanguages[0] ?? sourceLanguage` | Language to **start** from ([BCP 47](bcp47.md)). Read once at mount: to change language later, use [`proposeNewLanguage()`](#proposenewlanguage). Same default in dev and build |
| `fallback` | `node` | `null` | Shown while a non-preloaded initial language loads. Chunks are local, so `null` is a near-imperceptible empty frame |
| `debug` | `boolean` | `false` | Exposed by `useTranslateLanguage()` |
| `timeZone` | `string` | — | IANA zone (`"Europe/Rome"`) for [ICU](icu.md) `date`/`time` messages. Precedes the plugin's `icu.timeZone` option. Unlike `initialLanguage`, it **can** change after mount |
| `children` | `node` | — | The app tree that receives the translation context |

An eagerly bundled initial language renders synchronously; any other makes the container suspend until its chunk is ready. Never the wrong language — see [Preloading](#preloading-suspense-and-the-initial-flash).

## `<Translate>`

```jsx
<Translate>_%_Welcome_%_</Translate>                                 // as a child
<Translate t={["_%_Hello %s, how are you?_%_", username]} />         // tuple: [text, ...args]
<Translate t="_%_Hello %s, how are you?_%_" a={[username]} />        // text and args apart
<Translate o={{ t: "_%_Hello %s, how are you?_%_", a: [username] }} />  // one packaged value
```

### Props

| Prop | Meaning |
| :- | :- |
| `t` | The marked text, the tuple `[text, ...args]`, or the object `{ t, a }`. A number or a React element too — see [below](#what-can-sit-in-the-text-position) |
| `a` | Values for the `%s`/[ICU arguments](icu.md), when `t` doesn't already carry them. An array or scalar for `{0}`, an object (`{ name: "Aldo" }`) for `{name}` |
| `o` | The object form, for text that already travels with its arguments. Alternative to `t` |
| `children` | The marked text, as a child. Alternative to `t` |
| `skipMark` | An **un**marked string is legitimate here: no `‼️`, no console warning — see [below](#skipmark-when-unmarked-is-the-normal-case) |

### Markup and placeholders

```jsx
<Translate t="_%_<strong>Bold</strong> and <i>italic</i> text_%_" />
<Translate t={["_%_Signed in as <b>%s</b>_%_", <Link to="/me">{username}</Link>]} />
```

- **Markup:** only `<b> <strong> <i> <em> <u> <small> <code> <br> <hr> <wbr>`, compiled at build time — no HTML parser at runtime.
- **Arguments** can be any React node, markup included. A `%s` is a real JSX child, not a piece of string, so an argument is **never** interpreted as HTML: React escapes it like any other child.
- **A `%s` without a value** renders `⁇` — no argument at all, fewer than the placeholders, or `null`/`undefined` in that position. `0` and `""` are values like any other. The character is `errorSolve.mark.absentDataInArray` ([Diagnostics](diagnostics.md)).
- **[ICU arguments](icu.md)** (`{0}`, `{name}`, `{n, plural, …}`) work the same way, and add a **name** form: `a={{ name: "Aldo" }}` or `ts(t, { name })` for `{name}`, mixable with positions (`a={[{ name }, 3]}` reads `{name}` and `{1}`). Only a plain object counts as the arguments container — a class instance or a `Date` renders as itself instead.
- **TypeScript:** an argument is `TranslateArg = ReactNode | Date | bigint`; `TranslateArgs` is one of those, the named-arguments object (`TranslateNamedArgs`), or a list of either. A bare `Date` in a plain `%s`/`{0}` still isn't formatted — `String()` would use the browser's locale, not the app's — use `{0, date}` for that (see [ICU messages](icu.md)).

### What can sit in the text position

One leaf component often renders whatever its caller hands it, and that is not always text a marker could be attached to:

| In the text position | Renders | In development |
| :- | :- | :- |
| a marked string, `"_%_…_%_"` | the translation | the usual [diagnostic marks](diagnostics.md) |
| an unmarked string | the string as it is | a `‼️` in front, and a console warning |
| an unmarked string, with `skipMark` | the string as it is | nothing |
| a number — `0` included | the number (`"0"`) | nothing |
| a React element, e.g. `t={<WaitingBarSpan />}` | the element, as it is | nothing |
| a function, a symbol, an element as the *first* slot of the tuple | `""` | a console warning |

An unmarked string is not an error: it is how one component accepts both translatable text and domain data without a wrapper deciding for it — the `‼️` just shows that nobody will translate it. A number can never come from the source, and an element can't be a forgotten marker, so neither needs a diagnostic. In the tuple, though, the first slot **is** the text: an element there is an error (elements among the *arguments* are fine).

### `skipMark`: when unmarked is the normal case

A number and an element say what they are. A **string** doesn't: unmarked can mean *forgotten marker*, or *a value that will never have one* — a phone number, a URI, a field name from an admin panel, a server message. Only the call site knows which:

```jsx
<Translate t={row.label} skipMark />
```

- Text **not** marked: no `‼️`, no console warning. Everything else is unchanged, `%s` interpolation included.
- Text marked: the prop does nothing — the text is translated as usual, and `🔸` / `🔹` stay on.

So it doesn't mean "don't translate", it means "unmarked is not an error here" — exactly what a prop needs that carries marked text on some rows and domain data on others. Incompatible props are still an error either way.

The alternative that looks equivalent isn't: `errorSolve.mark.malformed = false` turns the diagnostic off **everywhere**, including where a marker really was forgotten.

## `useTranslateToString()`

For places that need a plain string instead of JSX — `placeholder`, `aria-label`, `title`:

```jsx
import { useTranslateToString } from "@sepoina/vitetranslate/react";

function SearchInput() {
  const ts = useTranslateToString();
  return <input placeholder={ts("_%_Enter your name_%_")} />;
}
```

`ts()` accepts the same forms as `<Translate>`, with the same [diagnostic prefixes](diagnostics.md) and the same [`⁇` rule](#markup-and-placeholders) for a missing `%s`:

```js
ts("_%_Hello %s_%_", name)
ts(["_%_Hello %s_%_", name])
ts({ t: "_%_Hello %s_%_", a: [name] })
ts(field.label, undefined, { skipMark: true })   // third argument: what are props on <Translate>
```

It has to return a primitive string, so a **React element** is the one form it doesn't take: a real error, with a message of its own. Other non-text values (a function, a symbol, an element inside the tuple) return `""` with a console warning in development, as in `<Translate>`.

## `useTranslateNode()`

The hook form of `<Translate>`: same lookup, without an element. It is what the `autoWrap` option injects ([plugin options](plugin-options.md)), so most projects never write it by hand.

```jsx
import { useTranslateNode } from "@sepoina/vitetranslate/react";

function Card({ compiled }) {
  const t = useTranslateNode();
  return <p>{t(compiled)}</p>;
}
```

- It takes a **compiled** marker — the string a `<Translate t={...}>` already receives — not a `_%_..._%_` you type yourself.
- A second argument fills the `%s`, like `<Translate a={...}>`.
- Given anything that isn't a compiled marker, it has no key to look up and returns the text itself, delimiters stripped — the same fallback `<Translate>` and `ts()` use for what the compiler never saw.

## `useTranslateLanguage()`

Everything a language switcher needs:

```jsx
import { useTranslateLanguage } from "@sepoina/vitetranslate/react";

function LanguageSwitcher() {
  const { id, languages, proposeNewLanguage } = useTranslateLanguage();

  return languages.map(({ tag, languageName }) => (
    <button key={tag} disabled={id === tag} onClick={() => proposeNewLanguage({ lang: tag })}>
      {languageName}
    </button>
  ));
}
```

| Field | Type | Description |
| :- | :- | :- |
| `id` | `string \| undefined` | Tag of the language **on screen** ([BCP 47](bcp47.md)). `undefined` outside `TranslateContainer`. After a failed switch, the language actually shown — not the one asked for |
| `languages` | `{ tag, languageName }[]` | Languages in `localeDir`, source language first. `languageName` is the autonym |
| `sourceLanguage` | `string` | The language the strings are written in |
| `debug` | `boolean` | The `debug` prop of `TranslateContainer` |
| `proposeNewLanguage` | `function` | Switches language — see [below](#proposenewlanguage) |

- **Stable:** the returned object keeps its identity, so it is safe in dependency arrays.
- **Frozen**, `languages` and its entries included: the same array is shared by the whole app, so a write throws a `TypeError` on the spot instead of corrupting the list for everyone. To reorder or filter, copy it first: `[...languages]`.
- **Works outside `TranslateContainer`:** `languages` and `sourceLanguage` come from a manifest built at build time — no table is loaded to list them — so you can build a language list above the translated tree. There, `id` is `undefined` and `proposeNewLanguage` does nothing (reported once in the console, in development).

### `proposeNewLanguage()`

```js
const { proposeNewLanguage } = useTranslateLanguage();
proposeNewLanguage({ lang, onStart, onDone, onError });
```

Loads the requested language's chunk and switches to it inside a React transition: the current language stays on screen until the new one is ready, with no blank frame in between.

If the chunk fails to load (a network hiccup), the container falls back to the eager table and `id` reports **that** language. The failure is not remembered: proposing the same language again really retries it. So a retry button must use the tag it asked for, not `id`:

```jsx
const [wanted, setWanted] = useState(null);
const switchTo = (tag) => {
  setWanted(tag);
  proposeNewLanguage({ lang: tag, onDone: (ok) => ok && setWanted(null) });
};
// wanted !== null -> the last switch failed, and `wanted` is the tag to retry
```

## Preloading, Suspense and the initial flash

Each language is a separate chunk loaded on demand, so it may not be ready on the **first** render. `TranslateContainer` has a built-in `Suspense` boundary, and neither path ever shows the wrong language:

| `initialLanguage` is… | Behaviour |
| :- | :- |
| **eagerly bundled** | Its table is already in the initial bundle → renders **synchronously** |
| **any other language** | The container **suspends** (showing `fallback`) until the chunk loads, then renders the right language. No wrong-language flash, no double render |

Which languages are eager:

| | Eagerly bundled |
| :- | :- |
| **dev** | `preloadedLanguages` **plus** `sourceLanguage` — the language you are writing in, so reloads never suspend |
| **build** | `preloadedLanguages` if you declared any, otherwise `sourceLanguage` |

> [!NOTE]
> A production build doesn't ship the source language just as a fallback: every compiled table is **self-contained**, each untranslated key already carrying the source text. An app that starts in `en-US` with `preloadedLanguages: ["en-US"]` ships one table, not two.

`preloadedLanguages` is an **optimization**, not what prevents the flash — Suspense already does that. It turns the brief loading frame into an instant first paint, at the cost of putting those languages in the initial bundle. Keep it to the few languages you actually show first:

```js
vitetranslate({
  localeDir: "locale",
  sourceLanguage: "it-IT",        // eager in dev, and in build if nothing is preloaded
  preloadedLanguages: ["en-US"],  // instant first paint instead of a loading frame
})
```

```jsx
<TranslateContainer initialLanguage="en-US">  {/* preloaded → synchronous first paint */}
  <App />
</TranslateContainer>
```

Without `initialLanguage`, the container starts from the first eager language (`preloadedLanguages[0] ?? sourceLanguage`) — the same in dev and in build, on purpose. Starting from a language that isn't eager still works, but costs a round trip before the first paint; it is reported once in the console, in production too (in dev the source language is always eager, so the check would never fire there).

## `basicHtmlToNodes()`

Turns a string with basic HTML into React nodes, without `dangerouslySetInnerHTML`. `<Translate>` doesn't need it — its tables are compiled at build time — except in development, for a key not synced yet. It is exported because it is useful on its own ([live in the playground](https://sepoina.github.io/viteTranslate/playground/#html-to-nodes)):

```jsx
import { basicHtmlToNodes } from "@sepoina/vitetranslate/react";

basicHtmlToNodes("Hello <b>%s</b>", "Mario");   // ["Hello ", <b>Mario</b>]
basicHtmlToNodes("you have %s messages");       // "you have ⁇ messages"
basicHtmlToNodes("no markup here");             // "no markup here" (same string back)
```

| | |
| :- | :- |
| `text` | Text, optionally with markup and `%s` placeholders |
| `args` | Optional: a value or an array of values for the `%s`, in order |
| *returns* | A string, a single element, or a fragment |

- Recognises the same tags as `<Translate>` (`<b> <strong> <i> <em> <u> <small> <code> <br> <hr> <wbr>`) and HTML entities. Any other tag is dropped, its content kept (`<div>hi</div>` → `hi`).
- **No attribute is ever forwarded**: the elements it builds carry only a `key`.
- A `%s` without a value follows the same [`⁇` rule](#markup-and-placeholders).
- A string without markup comes back untouched, allocating nothing; parsed results are cached, so each string is converted once per app.

> [!IMPORTANT]
> Before using it outside the library:
>
> - It is meant for **strings you control** — typically your own translation tables — not as a sanitiser for hostile input.
> - `args` are interpolated **before** parsing, so an argument containing markup is itself interpreted as HTML (unlike `<Translate>`).
> - It needs the DOM (it uses a `<template>` element). Where `document` doesn't exist, as in server-side rendering, it returns the original string unconverted.

## `version`

The installed package version, as a plain string — read from `package.json` at build time, so it costs nothing at runtime. Handy for a footer, an about page or a demo:

```jsx
import { version } from "@sepoina/vitetranslate/react";

<p>viteTranslate v{version}</p>
```
