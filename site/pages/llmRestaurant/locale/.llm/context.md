<!-- vitetranslate:generated 2026-09-19 · 229 keys · deepseek-flash -->
## Domain
Website of viteTranslate, a seaside seafood restaurant at Cala dei Gabbiani: menu, wine cellar, tasting menus, private events, gallery, story, FAQs and a booking form.
The footer states the restaurant is imaginary and the page is a demo of the viteTranslate library.

## Register
Warm, elegant hospitality, addressing guests in the plural ("vi aspettiamo", "vi chiediamo", "venite presto"); use the polite form where the target language has one.
Booking labels, notices and footer labels are short and plain; story, cellar and dish-description texts are more lyrical.

## Glossary
- viteTranslate — restaurant name and library name; never translate
- Cala dei Gabbiani — place name; keep in Italian
- Via del Molo Vecchio 14 — address; keep in Italian
- Piazza del Mercato — keep in Italian
- Sala delle Reti — event space; keep in Italian
- La Terrazza — venue name; keep
- Sottocosta · Mare aperto · Carta bianca — the three tasting menus; keep untranslated
- Tiramisù, cacciucco, pansoti, acqua pazza — traditional dishes; keep the dish name Italian, translate the rest of the string
- Vermentino — grape variety in cellar and review texts
- Coperto — cover charge (Menu_6yjjju)
- Bottarga, Pantelleria, taggiasche, Carnaroli — ingredient names kept as-is
- Ada (nonna Ada), Irene, Tommaso, Luca, Marta — personal names; keep
- %s — placeholder; preserve exactly
- <i>, <b>, <br> — inline tags; preserve exactly

## Ambiguities
Footer credit strings ("framework CSS, moduli e tendine", "caratteri tipografici, da Google Fonts", "icone", "distribuzione di CSS e icone", "Mappa segnaposto", the "%s è un ristorante immaginario" notice) describe the page's own assets and demo status, not the restaurant.
"Ora" (Booking_1ez0xpn) — a time field label or a "now" button; only the surrounding form would tell.
"%s all'etto" — price per 100 g; the unit and its formatting change by locale.
Count fragments needing plural rules: "%s persone" / "1 persona", "%s portate", "%s per due persone", "%s a persona".
Story stat labels that pair with a preceding number and may need reordering: "anni sul porto", "generazioni in cucina", "etichette in cantina", "chef e patron", "barche di pescatori amici", "il primo chiosco sul molo".
Events capacities ("Fino a 60 ospiti in piedi", "Fino a 24 ospiti seduti", "Sei posti") each sit next to one of three venue names; which space each figure belongs to is not stated in the string.
"sala" is an indoor dining room in FAQ/Booking ("sala interna", "La sala luminosa del piano superiore") but part of a proper name in "La Sala delle Reti"; do not unify.
Review locations ("Lione", "Torino", "Monaco di Baviera") are city names given alone; whether a country is appended is undecided.
"Solo la domenica e solo per due" (cacciucco) — a dish served for two or a minimum of two diners.
"Chiuso per riposo" — closing on the weekly rest day, not an unspecified closure.
<!-- /vitetranslate:generated -->

## Notes from the team
<!-- Everything outside the generated block is yours and is never overwritten. -->
- "viteTranslate" is the restaurant's name (and the name of the library): never translate it. "Cala dei Gabbiani", "Via del Molo Vecchio", "Piazza del Mercato", "Sala delle Reti" are proper names: keep them in Italian.
- Dish names stay in Italian when they are traditional (tiramisù, cacciucco, pansoti, acqua pazza); translate the rest of the name ("Trancio di ricciola" -> "Amberjack steak").
- "Sottocosta", "Mare aperto" and "Carta bianca" are the names of the three tasting menus: keep them untranslated.
- Register: warm, elegant hospitality, addressing guests in the plural ("vi aspettiamo"). Use the polite form where the language has one (Sie, vous, です/ます).
- Times use the 24-hour clock as written; the `–` between two times is a range.
