# ICU messages

> The [README](../README.md) covers the quick start. This page covers plurals, `select`, numbers and dates — ICU MessageFormat, compiled at build time like everything else.

🎮 **[Live showcase](https://sepoina.github.io/viteTranslate/llmrestaurant/)** — a booking form using all three: plural guests, a formatted date, a formatted price. The Japanese translation reorders every one of them.

## When a string becomes ICU

A text is an ICU message only if it contains an ICU **argument**: `{0}`, `{name}`, or `{n, plural, …}` and friends. `%s` still works exactly as before — the two can coexist in the same table.

```jsx
<Translate t="_%_{0, plural, one {# file} other {# files}}_%_" a={[count]} />
```

A literal `{` isn't enough on its own — `{ t: null }` stays plain text — but a real argument always triggers ICU parsing, so a curly brace you mean literally needs an apostrophe or an entity: `'{name}'` or `&#123;name}`. That includes `Press {Enter}`: it reads as an argument now, and without a value it renders `⁇`.

## One example per construct

| Written | With `n = 3` | With `n = 1` |
| :- | :- | :- |
| `{n, plural, =0 {no files} one {# file} other {# files}}` | `3 files` | `1 file` |
| `{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}` | `3rd` | `1st` |
| `{n, number, percent}` | `300%` | `100%` |
| `{d, date, medium}` | `Oct 3, 2026` | |
| `{d, date, ::EEEEdMMMM}` | `Saturday, October 3` | |
| `{t, time, short}` | `8:30 PM` | |

`#` inside a `plural`/`selectordinal` branch stands for the number itself, formatted and offset-adjusted; nested inside another plural, it always refers to the nearest enclosing one.

`select` doesn't take a number — it just matches its argument against a set of keys:

```text
{gender, select, m {He} f {She} other {They}} confirmed the booking.
```

## Arguments: positions or names

| Written | Passed | Reads |
| :- | :- | :- |
| `{0}` | `a={[x, y]}`, `t={[text, x, y]}`, `ts(t, [x, y])` | `a[0]` |
| `{0}` | `a="x"` (scalar) | `"x"` for `{0}`, absent for the rest |
| `{name}` | `a={{ name: "Aldo" }}`, `ts(t, { name })` | `a.name` |
| `{name}` and `{1}` | `a={[{ name }, 3]}`, `t={[text, { name }, 3]}` | `a[0].name` and `a[1]` |

`{name}` reads a field of the **arguments object** — the object itself, or the first element when arguments come as an array or tuple. Only a **plain object** counts: a literal, `JSON.parse` output, a `Object.create(null)` — never a class instance, a `Date`, or a React element, which all render as themselves instead. A missing field shows `⁇` (`mark.absentDataInArray`, suppressible the same way as a missing `%s` — see [Diagnostics](diagnostics.md)), and it's never logged as a separate warning.

A translation can put the arguments in whatever order the target grammar needs — see the Japanese line in the showcase above — but a name is code, not text: `{name}` stays `{name}` in every language.

## Mixing `%s` with `{n}` or names

The *k*-th `%s` (counted from 0) is `{k}` under the hood, so `"%s and {1}"` is legal and both point at the same thing. A `%s` inside an ICU argument or branch is not — write it as `{n}` there instead. And once a message has named arguments, drop `%s` for the rest of it too: `%s` counts positions starting from the object that holds the names, which is rarely what you want — `{1}`, `{2}` say what you mean.

## Dates and time zones

`{d, date}` and `{d, time}` accept:

| Value | Meaning | Time zone used |
| :- | :- | :- |
| `Date` | an instant | resolved below |
| a number | milliseconds since epoch | resolved below |
| `"YYYY-MM-DD"` | a **calendar date**, not an instant | always UTC, so `"2026-10-03"` doesn't slip to the 2nd in New York |
| an ISO string with time | an instant | resolved below |
| anything else | not parsed | shown as-is |

A number under `1e11` in absolute value looks like Unix seconds, not milliseconds — a `console.warn` says so once, in development only.

Time zone, in order of precedence: a calendar date is always UTC; then the `timeZone` prop of `<TranslateContainer>` (the viewer's preference, or the request's zone in SSR); then the plugin's `icu: { timeZone: "Europe/Rome" }` option (a build-time default — a restaurant's hours, shown in the restaurant's zone regardless of who's looking); then, with none of the above, whatever zone the runtime itself is in.

> [!IMPORTANT]
> Doing SSR with dates? Set the time zone explicitly (prop or plugin option). Left to "whatever the runtime is in", the server and the browser can disagree, and React flags a hydration mismatch.

## The apostrophe trap

`dell'{0}` doesn't do what it looks like: in ICU syntax an apostrophe right before `{` opens a quote, and the argument disappears into it as literal text. It's a build-time error (`icu-apostrophe`) precisely because it's easy to miss — Italian and French write this way constantly. Use `’` (U+2019) or double the apostrophe: `dell''{0}`.

## What checks it

| Where | A broken message | Arguments that don't match the source |
| :- | :- | :- |
| Compilation | shown as plain text, with a warning | the source text is shown instead, with a warning |
| `npx vitetranslate --status` | a warning note | a warning note |
| `--llm-translate` | — | rejected, stays `null` for one repair round |

Missing plural categories (a language needs `few`/`many` and the translation only has `one`/`other`) are a warning everywhere, never a hard failure — the missing category falls back to `other` at render time.

## What ships

The ICU parser (`@formatjs/icu-messageformat-parser`) never reaches a production bundle — it only runs in the plugin, the CLI, and, in development, the dev-only interpreter for a key you just wrote and haven't synced yet. What ships is four small formatting helpers, shared in one chunk across every language and pulled in only if some table actually uses ICU — an app with no ICU messages pays nothing for this feature. See the runtime size in the [README](../README.md#-why-vitetranslate).

## Limits

- Names come from plain objects only — not class instances, `Map`s, or anything with its own prototype.
- ICU syntax needs an expression, so it can't sit directly in JSX text (`{` starts a real JSX expression there) — use `t="..."` or `ts()`.
- A markup tag can't open outside a plural/select branch and close inside it, or vice versa.
- A `Date` passed to a plain `{0}` (or a `%s`) isn't formatted — it passes through as-is, which React won't render as JSX and `ts()` turns into its raw `toString()`. Use `{0, date}` or `{0, time}` whenever the argument is a date.
- No custom named number formats (`{0, number, price}` defined in config) — only the built-in styles and `::skeleton` syntax.
