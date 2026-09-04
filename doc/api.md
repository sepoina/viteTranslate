# API reference

> The [README](../README.md) covers the quick start. This is the full reference for every export of `@sepoina/vitetranslate/react`.

🧪 **[Edge cases, live](https://sepoina.github.io/viteTranslate/edge/)** — every call form, every value that is not text, side by side with what it renders.

## Contents

- [`<Translate>`](#translate)
  - [Props](#props)
  - [What can sit in the text position](#what-can-sit-in-the-text-position)
  - [`skipMark`: when unmarked is the normal case](#skipmark-when-unmarked-is-the-normal-case)
- [`useTranslateToString()`](#usetranslatetostring)
- [`useTranslateLanguage()`](#usetranslatelanguage)
- [`TranslateContainer` props](#translatecontainer-props)
- [`proposeNewLanguage()`](#proposenewlanguage)
- [`basicHtmlToNodes()`](#basichtmltonodes)
- [`version`](#version)
- [Preloading, Suspense and the initial flash](#preloading-suspense-and-the-initial-flash)

## `<Translate>`

```jsx
// plain text
<Translate>_%_Welcome_%_</Translate>

// with placeholders: t=[text, ...args]
<Translate t={["_%_Hello %s, how are you?_%_", username]} />

// classic form: t="..." a=[...]
<Translate t="_%_Hello %s, how are you?_%_" a={[username]} />

// object form: text and arguments in one value
<Translate o={{ t: "_%_Hello %s, how are you?_%_", a: [username] }} />

// small inline HTML subset
<Translate t={"_%_<strong>Bold</strong> and <i>italic</i> text_%_"} />

// a placeholder can be filled with a React element, markup included
<Translate t={["_%_Signed in as <b>%s</b>_%_", <Link to="/me">{username}</Link>]} />

// not marked: domain data, rendered as it is
<Translate>{user.phoneNumber}</Translate>

// a value that will never carry a marker: no ‼️, no console warning
<Translate t={row.label} skipMark />
```

Since translation tables are compiled at build time, a `%s` inside markup is a real JSX child, not a piece of string. So an argument can be any React node, and it is **never** interpreted as HTML — React escapes it like any other child. A `%s` left without a value renders as `⁇` (configurable, see [Diagnostics](diagnostics.md)).

A string **without** the marker is not an error: it is rendered as it is, and in development it carries a `‼️` in front of it so you can see the prop is receiving something nobody will translate. That is what lets one leaf component accept both translatable text and domain data without a wrapper deciding for it.

### Props

| Prop | Meaning |
| --- | --- |
| `t` | the marked text, the compact form `[text, ...args]`, or the object form `{ t, a }`. A number or a React element are accepted too — see below |
| `a` | values for the `%s`, when `t` doesn't already carry them |
| `o` | the object form, for text that already travels packaged with its arguments. Same as passing them separately; alternative to `t` |
| `children` | the marked text, as a child. Alternative to `t` |
| `skipMark` | declares that here an **un**marked string is legitimate: no `‼️`, no console warning. See [below](#skipmark-when-unmarked-is-the-normal-case) |

### What can sit in the text position

One leaf component often has to render whatever its caller has — and that isn't always a string a marker could ever be attached to:

```jsx
<Translate t={item.count} />              // a number: rendered as is, no ‼️, no warning
<Translate t={0} />                       // renders "0" — zero is a value, not "nothing"
<Translate t={<WaitingBarSpan />} />      // a React element: returned as is, no diagnostics
```

A number can never come from the source, so it is domain data by construction; a mounted element is not ambiguous either — it can't be a forgotten marker, and it already knows how to render itself. Neither of them goes through the error path.

Two deliberate limits. Inside the tuple form the first slot **is** the text, so an element there stays an error (an element among the *arguments* has always been supported). And `ts()` does not take elements: it has to return a primitive string, so a node is a genuine error there, with a message that says so.

### `skipMark`: when unmarked is the normal case

A number and an element tell you what they are. A **string** doesn't: unmarked can mean *forgotten marker* or *value that will never have one* — a phone number, a URI, a field name configured in an admin panel, an exception message, a description coming from the server. From inside the component the two look identical; only the call site knows which is which.

```jsx
<Translate t={row.label} skipMark />
```

When `skipMark` is on **and** the text is not marked: no `‼️`, no console warning, everything else unchanged (`%s` interpolation included). When the text **is** marked, the prop does nothing at all — the resolution chain runs as usual and `🔸` / `🔹` stay on. It does not mean "don't translate", it means "unmarked is not an error here", which is exactly what a prop that carries marked text on some rows and domain data on others needs. Incompatible props are still an error, `skipMark` or not.

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

It accepts the same forms as `<Translate>` — `ts("_%_Hello %s_%_", name)`, `ts(["_%_Hello %s_%_", name])`, `ts({ t: "_%_Hello %s_%_", a: [name] })` — and applies the same [diagnostic prefixes](diagnostics.md).

An optional third argument carries what are props on `<Translate>`:

```jsx
<input placeholder={ts(field.label, undefined, { skipMark: true })} />
```

`{ skipMark: true }` says the same thing as the prop: an unmarked string is legitimate here, so no `‼️` and no console warning. A React element is the one form `ts()` does **not** take — it has to return a primitive string, so a mounted node is a real error and gets a message of its own.

## `useTranslateLanguage()`

Everything a language switcher needs, in one hook: the current language, the list of available ones and the function to change it.

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
| --- | --- | --- |
| `id` | `string \| undefined` | Tag of the language **on screen** ([BCP 47](bcp47.md)); `undefined` outside `TranslateContainer`. If a chunk failed to load the container falls back to the eager table, and `id` reports that language — not the one that was asked for |
| `languages` | `{ tag: string, languageName: string }[]` | Languages found in `localeDir`, source language first. `languageName` is the autonym, computed once at sync time |
| `sourceLanguage` | `string` | Source language tag, the one the strings are written in |
| `debug` | `boolean` | The `debug` prop passed to `TranslateContainer` |
| `proposeNewLanguage` | `function` | Runtime language switch, see below |

The returned object is referentially stable, so it is safe in dependency arrays.

It is also **frozen**, `languages` and its entries included: the very same array is shared by every component in the app for the whole life of the page, so a stray write would corrupt the list for everyone, far away from where it happened. Writing to it throws a `TypeError` on the spot instead. To reorder or filter, work on a copy — `[...languages]`.

`languages` and `sourceLanguage` come from the language manifest, known at build time: no table is ever loaded just to list them, and they stay valid even outside `TranslateContainer` — handy to build a list of languages above the translated tree. There `id` is `undefined` and `proposeNewLanguage` is inert; calling it is reported once in the console during development, since that is the only thing that cannot work without a container.

## `TranslateContainer` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `initialLanguage` | `string` | first eager language (`preloadedLanguages[0] ?? sourceLanguage`) | Language tag to **start** from ([BCP 47](bcp47.md)); read once at mount, changing it later has no effect — that is what `proposeNewLanguage()` is for. Eagerly bundled languages render synchronously; otherwise the container suspends until the chunk is ready — never the wrong language. The default is the same in dev and in build, so an app that omits it starts in the same language everywhere |
| `fallback` | `node` | `null` | Shown via `Suspense` while a non-preloaded initial language loads. Chunks are local, so the default `null` is a near-imperceptible empty frame |
| `debug` | `boolean` | `false` | Exposed by `useTranslateLanguage()` |
| `children` | `node` | — | App tree that receives the translation context |

## `proposeNewLanguage()`

Available from `useTranslateLanguage()`:

```js
const { proposeNewLanguage } = useTranslateLanguage();
proposeNewLanguage({ lang, onStart, onDone, onError });
```

Triggers a runtime language switch, lazily loading the requested chunk. The switch runs inside a React transition, so the current language stays on screen until the new one is ready — no blank frame mid-switch.

A chunk that fails to load is **not** remembered as failed: proposing the same language again really retries it, and the screen updates when it works. A chunk can fail on a network hiccup, and one bad moment must not make that language unselectable for the life of the page.

Meanwhile the container falls back to the eager table, and `id` reports **that** language — so a retry button has to use the tag it asked for, not `id`:

```jsx
const [wanted, setWanted] = useState(null);
const switchTo = (tag) => {
  setWanted(tag);
  proposeNewLanguage({ lang: tag, onDone: (ok) => ok && setWanted(null) });
};
// wanted !== null -> the last switch failed, and `wanted` is the tag to retry
```

## `basicHtmlToNodes()`

Turns a string containing basic HTML into React nodes, without `dangerouslySetInnerHTML`. It used to be what `<Translate>` ran on every render; since translation tables are compiled at build time it is no longer on that path — `<Translate>` only falls back to it in development, for a key not yet synced. It stays exported because it is useful on its own:

```jsx
import { basicHtmlToNodes } from "@sepoina/vitetranslate/react";

basicHtmlToNodes("Hello <b>%s</b>", "Mario");   // ["Hello ", <b>Mario</b>]
basicHtmlToNodes("you have %s messages");       // "you have ⁇ messages"
basicHtmlToNodes("no markup here");             // "no markup here" (same string back)
```

| | |
| --- | --- |
| `text` | Text, optionally with markup and `%s` placeholders |
| `args` | Value or array of values replacing the `%s`, in order — optional |
| *returns* | A string, a single element, or a fragment |

A `%s` left without a value renders as `⁇` — whether no argument was passed at all, fewer were passed than there are placeholders, or the value in that position is `null`/`undefined`. `0` and the empty string are values like any other and are interpolated normally. The same rule applies to `ts()` from `useTranslateToString`, and the character is the `mark.absentDataInArray` option of [`errorSolve`](diagnostics.md).

Only the formatting tags `<b> <strong> <i> <em> <u> <small> <code> <br> <hr> <wbr>` and HTML entities are recognised. Any other tag is dropped while keeping its content (`<div>hi</div>` → `hi`), and **no attribute is ever forwarded** — the elements it builds carry nothing but a `key`. A string without markup is returned untouched, allocating nothing. Parsed results are cached, so the same string is converted once per app.

> [!IMPORTANT]
> Three things to know before using it outside the library:
>
> - It is meant for **strings you control** — typically your own translation tables — not as a sanitiser for hostile input.
> - `args` are interpolated **before** parsing, so an argument that contains markup is itself interpreted as HTML.
> - It needs the DOM (it uses a `<template>` element). Where `document` does not exist, such as server-side rendering, it returns the original string unconverted.

## `version`

The installed package version, as a plain string — read from `package.json` at build time, so it costs nothing at runtime:

```jsx
import { version } from "@sepoina/vitetranslate/react";

<p>viteTranslate v{version}</p>
```

Handy to surface the running version in a footer, an about page, or a playground/demo — without hand-syncing it against `package.json`.

## Preloading, Suspense and the initial flash

Languages are code-split: each one is a separate chunk loaded on demand, so a language isn't ready on the **first** render. `TranslateContainer` handles this with a built-in `Suspense` boundary and resolves it in one of two ways, neither of which ever renders the wrong language:

| `initialLanguage` is… | Behaviour |
| --- | --- |
| **eagerly bundled** | Its table is already in the initial bundle → renders **synchronously** |
| **any other language** | The container **suspends** (showing `fallback`, `null` by default) until the chunk loads, then renders the right language directly. No wrong-language flash, no double render |

Which languages are eager depends on the environment:

| | Eagerly bundled |
| --- | --- |
| **dev** | `preloadedLanguages` **plus** `sourceLanguage` — the source is the language you are writing, keeping it synchronous avoids a suspension on every reload |
| **build** | `preloadedLanguages` if you declared any, otherwise `sourceLanguage` |

> [!NOTE]
> In a production build the source language is not shipped just to act as a fallback: every compiled table is **self-contained** — each key a language hasn't translated yet already carries the source text inside it. So an app that starts in `en-US` with `preloadedLanguages: ["en-US"]` ships one table, not two copies of the same content.

`preloadedLanguages` is therefore an **optimization**, not a requirement to avoid the flash — Suspense already avoids it. It turns the brief loading frame into an instant paint for the languages you know you'll show first, at the cost of shipping them in the initial bundle.

```js
vitetranslate({
  localeDir: "locale",
  sourceLanguage: "it-IT",        // source language: eager in dev, and in build if no preload is declared
  preloadedLanguages: ["en-US"],  // instant first paint instead of a loading frame
})
```

```jsx
<TranslateContainer initialLanguage="en-US">  {/* preloaded → synchronous first paint */}
  <App />
</TranslateContainer>
```

Keep the preloaded list to the few languages you actually show first; every other language stays a lazy chunk loaded only when switched to.

The **first** eager language (`preloadedLanguages[0] ?? sourceLanguage`) is also the one `TranslateContainer` starts from when `initialLanguage` is omitted — the same in dev and in build, on purpose. Starting from a language that isn't eager still works, it just costs a round trip before the first paint, and it is reported once in the console — in production too, since in dev the source language is eager anyway and the check would always pass there.
