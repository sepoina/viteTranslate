# Perché un'altra libreria di traduzioni

- **Titolo:** Why viteTranslate
- **Pubblico:** sviluppatori React che usano già, o stanno scegliendo, una libreria di traduzioni. Sanno cos'è una chiave, e quanto costa tenerla in ordine.
- **Durata:** il video finisce col brano, a 3:01 (la musica entra a 2 secondi): "viteTranslate fa il resto" verso 2:50, poi la battuta del caffè sulla coda della musica. Per starci, le frasi restano brevi (la conversione non le allunga) e le pause corte.
- **Idea:** una domanda onesta, "perché un'altra libreria di internazionalizzazione?", e la risposta di viteTranslate: tradurre dovrebbe succedere dove lavori già, nel JSX, in Vite, in VS Code. Si segue una frase dal JSX alla build, e fino al francese; ogni tappa mostra un pezzo dell'ambiente che lavora per te. VS Code è il cuore del racconto: l'editor è dove passi la giornata, e lì le traduzioni diventano parte della scrittura. Poi il sito dal vivo, il confronto, e tutto insieme.
- **Tono:** sempre in positivo. Si dice cosa fa viteTranslate, mai cosa manca agli altri. Le altre librerie si nominano una volta sola, in `compare`, con rispetto: la differenza è l'unità, tutti i pezzi nello stesso pacchetto, fatti per lavorare insieme.
- **Soggetto:** viteTranslate, mai "noi". "viteTranslate fa il resto", non "al resto pensiamo noi". In inglese niente "we", "our", "us", e niente "let's".
- **Voce:** Leda. Chi ha costruito l'attrezzo e ne è contento, senza vantarsene: racconta una scelta, non vende. Ritmo vivace, un sorriso nella voce, un filo d'ironia sulla domanda d'apertura. **Una voce sola, un tono solo**, dalla prima all'ultima parola: nessuna battuta detta come da un altro personaggio.
- **Inglese:** corretto e naturale, da parlato. I sottotitoli sono le stesse frasi, quindi si rileggono anche come testo scritto: punteggiatura giusta, niente virgola dove servono i due punti. Vanno a capo su una pausa, mai a metà di un pezzo di frase ("with a / marker").
- **Progetto filmato:** demo/Vite_8/quickApp, il quick start del README finito, in una copia sua: nel JSX i pulsanti delle lingue vengono prima delle frasi.
- **L'app di Ada:** minimalista ma in ordine. In alto i due pulsanti delle lingue, sotto tutte le frasi, una per riga, centrate: prima si sceglie la lingua, poi si legge. Carattere più piccolo di oggi, quanto basta perché nessuna frase vada a capo, nemmeno in francese, nemmeno nella metà dello split. La pagina segue l'ordine del codice: quello che si scrive nel JSX compare nello stesso punto della pagina, mai altrove.
- **Il sito:** `site`, `playground`, `edge`, `restaurant` e `compare` mostrano il sito pubblicato (sepoina.github.io/viteTranslate) dal vivo nel browser. Ogni pagina si apre in inglese.
- **Copertina:** la scena `together`, quando l'elenco è completo
- **Musica:** Chris Haugen - Mirage, presente. Entra piano 2 secondi dopo l'inizio, sulla domanda, respira nelle card, e arriva fino alla fine del brano: verso la fine si spegne da sola, sotto la battuta del caffè. Nessuna sfumatura che la tagli prima, e mai in loop.
- **Finale:** dopo "viteTranslate fa il resto" un attimo di pausa, poi, scherzando, la battuta del caffè: il timbro "open source" e il QR per il caffè. Il brano finisce, e negli ultimi 2 secondi almeno il video sfuma al nero.
- **Respiro:** la voce copre quasi tutto il video, con pause corte tra le scene; dopo `hook` e dopo `together` un secondo senza voce, perché la musica si senta salire. Attese e pause il più corte possibile: tutto deve stare dentro il brano.
- **Qualità:** il video finale è il master per YouTube: fino a 60 MB al minuto. Ne usa circa 29, il massimo che le riprese contengono: oltre, x264 è già quasi senza perdita.
- **Fonti:** la tabella "⚡ Why viteTranslate" del README e le sue note; il peso del runtime dalla nota ⁴; il confronto della landing (`site/landing/src/Compare.jsx`); le pagine del sito da `doc/live-examples.md`. Se cambiano, il video va rivisto.
- **Le dieci funzioni della tabella, scena per scena:**
  - testo naturale, senza chiavi → `write`
  - estensione ufficiale per VS Code → `extension`, `translate`
  - estrazione dentro il ciclo di Vite → `build`
  - plugin Vite ufficiale → `build`
  - lingue caricate a richiesta → `build`
  - zero dipendenze a runtime → `bundle`
  - runtime minuscolo → `bundle`
  - nessun parsing dei messaggi a runtime → `bundle`
  - ICU (plurali, select, date) → `bundle`
  - traduzione automatica con LLM → `llm`, `llm-preview`, `voila`, `restaurant`
  - tutte e dieci insieme → `compare`, `together`
  - in più, fuori tabella: il testo sorgente come ripiego, mai un buco → `fallback`

## hook · La domanda

- **Scena:** card, la domanda
- **Si vede:** il fondo scuro delle card comuni. Al centro, grande, la domanda: "Another i18n library?". Un attimo fermi, poi sotto si accendono una dopo l'altra, sulle parole della voce, tre parole in verde: "JSX" · "Vite" · "VS Code".
- **Si dice:** Un'altra libreria di internazionalizzazione? È una domanda giusta, e la risposta è semplice: tradurre ti serve dove lavori già. Nel JSX, in Vite, in VS Code. È il tuo ecosistema, l'ambiente in cui lavori ogni giorno, che deve aiutarti.
- **Note:**
  - **Una voce sola.** Domanda e risposta le dice la stessa persona, con lo stesso timbro e lo stesso ritmo: "È una domanda giusta" non è la battuta di un secondo personaggio. In inglese resta legata alla frase che segue ("It's a fair question, and…"), mai un frammento a sé come "Fair question.", che la voce legge come un'altra voce. Le indicazioni per la voce non chiedono di recitare la domanda in modo diverso dal resto: il mezzo sorriso c'è, uguale su tutta la frase.
  - L'ultima frase dice un concetto preciso: non "i tuoi strumenti", ma il tuo ambiente, l'ecosistema in cui lavori già, che ti dà una mano. È lui che deve aiutarti, non tu che devi aiutare lui.
  - La musica entra piano sotto le tre parole. Dopo la voce, un respiro: le tre parole restano accese e la musica sale.

## title · In tutti e tre

- **Scena:** card, il titolo comune
- **Si vede:** il logo e, sotto, "Scrivi la frase. Ottieni la traduzione."
- **Si dice:** Per questo viteTranslate vive in tutti e tre. Scrivi la frase, ottieni la traduzione.

## write · La frase è la chiave

- **Scena:** vscode
- **Si vede:** App.jsx aperto, il pannello viteTranslate a sinistra. Sotto il primo paragrafo si scrive `<p><Trans>You have three new messages.</Trans></p>` e si salva. Nel pannello compare la frase, non ancora sincronizzata: si cerchia la sua riga.
- **Si dice:** Scrivi la frase nel JSX, così come si legge. La chiave? La crea viteTranslate: niente da gestire.
- **Note:** la digitazione si vede tutta, senza tagli.

## extension · Dentro VS Code

- **Scena:** vscode
- **Si vede:** nel pannello si apre Settings (l'ingranaggio) e, sotto Highlight style, si cliccano uno dopo l'altro tre o quattro stili: a ogni clic la frase appena scritta in App.jsx cambia evidenziazione, a tempo di musica. L'ultimo resta; Back riporta il pannello com'era.
- **Si dice:** Ed ecco VS Code: un'estensione ufficiale porta le traduzioni nell'editor. Ogni frase col suo stato, evidenziata come preferisci.
- **Note:** è la scena che apre il cuore del video: l'editor come occasione, non come accessorio. Il cambio di stile deve divertire, non stancare: stili ben diversi tra loro, e l'ultimo ben leggibile. Settings e non la palette: la lista della palette coprirebbe proprio la riga nuova.

## fallback · Mai un buco

- **Scena:** split, VS Code e browser affiancati
- **Si vede:** nel browser, l'app di Ada in ordine: in alto i pulsanti delle lingue, sotto le frasi, nello stesso ordine del codice accanto. In inglese, la frase nuova c'è già, sotto "Welcome back", proprio dove è stata scritta. Clic su Français: "Bon retour, Ada !", e la frase nuova resta in inglese, col segnalino 🔸 davanti. Si sottolinea la frase inglese, poi si cerchia il segnalino.
- **Si dice:** In francese non esiste ancora? Mostra l'inglese, col segnalino, che vedrà solo chi sviluppa: in produzione non arriva. Mai un buco, mai un crash.
- **Note:** il clic su Français cade su "In francese", subito. Nessuna frase va a capo, nemmeno in francese.

## build · Dentro Vite

- **Scena:** vscode, col terminale aperto
- **Si vede:** nel terminale di VS Code si lancia `npm run build`. Prima parla viteTranslate: allinea i file di lingua. Si cerchia una riga sola, quella del francese con le sue chiavi mancanti. Poi Vite elenca i file della build: si riquadra il chunk del francese, `fr-FR-….js`.
- **Si dice:** Ora una build. Il plugin Vite rimette in pari ogni file di lingua, da solo: l'estrazione fa parte del ciclo di Vite, nessun comando in più da ricordare. E il francese diventa un chunk suo, caricato solo quando serve.
- **Note:**
  - Un cerchio solo, sulle chiavi mancanti del francese: due cerchi vicini, sull'inglese e sul francese, si confondono. Il riquadro sul chunk del francese, dopo, resta.
  - Conta l'output, non come si lancia: se il terminale non si lascia pilotare, va bene il task "npm: build" dalla palette. Se i segni non trovano il testo del terminale, meglio nessun segno che un segno fuori posto.
  - L'inglese, lingua di partenza, è precaricato nel bundle principale: un chunk suo non ce l'ha, e non va promesso.

## bundle · Leggero in produzione

- **Scena:** card, la stessa di `llm` con altri testi
- **Si vede:** in alto "In production". Tre numeri grandi, uno per battuta: "0 runtime dependencies" · "5 kB gzip" · "Precompiled". Sotto, piccolo: "ICU plurals, select, numbers and dates: compiled at build time".
- **Si dice:** E in produzione viaggia leggero. Zero dipendenze a runtime, cinque kilobyte gzip. Plurali e date ICU arrivano già compilati: il browser riceve valori pronti.
- **Note:** viene subito dopo la build: è quello che la build consegna. Il peso si scrive "5 kB", come nella nota ⁴ del README: mai "meno di 6", mai "sotto i 5". Ogni numero arriva sulla sua parola, con un piccolo colpo.

## translate · Dritti alla chiave

- **Scena:** split
- **Si vede:** il pannello è già aggiornato: la frase ora è da tradurre (🔸) e fr-FR, in Project, ha il suo badge giallo. Clic sulla riga della frase in Results, poi clic su fr-FR: il file si apre proprio sulla chiave nuova, che vale `null`; si cerchia il `null` per un paio di secondi. Al suo posto si scrive "Vous avez trois nouveaux messages." e si salva. La pagina si ricarica in inglese; clic su Français, e tutto è in francese: si riquadra la frase francese.
- **Si dice:** Il pannello sa già cosa aspetta una traduzione. Un clic sulla frase nuova, uno sul francese, e il file si apre proprio sulla chiave. Scrivi, salva, ed eccola, in francese.
- **Note:** il secondo momento VS Code: niente ricerca nei file, l'editor ti porta dove serve. La build ha già scritto i file di lingua, e la pagina si è ricaricata in inglese: la scena parte da lì. Dopo il salvataggio, appena la pagina è tornata in inglese, subito Français: il francese compare su "in francese", non dopo.

## llm · Mille chiavi

- **Scena:** card, tre battute
- **Si vede:** in alto "LLM auto-translation" e, sotto, il comando `npx vitetranslate --llm-translate`. Poi, una alla volta, sulle parole della voce, tre battute grandi: "💰 Cost first" · "✋ Asks before spending" · "🛡️ Every result validated".
- **Si dice:** Mille chiavi? viteTranslate lavora anche con un LLM, quello che preferisci. Ti mostra il costo, chiede prima di spendere, e controlla ogni risultato.
- **Note:** è una card perché ogni ripresa dal vivo costerebbe: il vivo arriva subito dopo, su poche chiavi. "Quello che preferisci" vuol dire qualsiasi API compatibile OpenAI, o un driver tuo: nessun modello per nome.

## llm-preview · Flusso pulito

- **Scena:** split, col terminale sotto tutti e due: in alto, affiancati, VS Code e la pagina; sotto, per tutta la larghezza, una striscia bassa di terminale.
- **Si vede:** in alto, da sinistra, il pannello LLM dell'estensione, il codice (fr-FR.yml, con le chiavi che aspettano) e la pagina. Clic su Translate: nella striscia in basso l'LLM lavora, chiavi e stima dei costi, ogni riga intera, senza andare a capo. Sopra, in fr-FR.yml, i `null` si riempiono.
- **Si dice:** A volte è meglio la semplicità.
- **Note:** tono asciutto e ironico, un sopracciglio alzato, ma la stessa voce di sempre. La striscia larga serve proprio a questo: l'output dell'LLM resta su una riga e non sporca la vista. Le chiavi dal .env: OpenRouter, con un modello DeepSeek (vedi il progetto demo llm).

## voila · Voilà

- **Scena:** la stessa di `llm-preview`, senza stacco visibile
- **Si vede:** la traduzione è finita e la pagina si è ricaricata. Clic su Français: le frasi che aspettavano ora sono in francese.
- **Si dice:** Voilà!
- **Note:** è l'"oplà!" della scena: vivace, divertito, sul francese che compare. Arriva almeno due secondi dopo "A volte è meglio la semplicità"; se l'LLM ci mette di più, si aspetta il francese, non l'orologio.

## site · Dal vivo

- **Scena:** card, la stessa di `bundle` e `llm`
- **Si vede:** in alto "See it live", sotto l'indirizzo `sepoina.github.io/viteTranslate`. Tre tessere, una dopo l'altra: "🎮 Playground" · "🧪 Edge cases" · "🍽️ Restaurant".
- **Si dice:** Vuoi vederlo all'opera? Sul sito ci sono tre pagine dal vivo.
- **Note:** la scheda che apre le pagine del sito: nel browser non c'è la barra degli indirizzi, e qui si legge dove sono. Le tre tessere arrivano veloci, su "tre pagine dal vivo".

## playground · Ogni funzione, col suo codice

- **Scena:** app, il sito
- **Si vede:** la pagina Playground, in inglese, scorre fino ai primi esempi: a sinistra il risultato dal vivo, a destra il codice che lo produce. Clic su ZH nella barra in alto: i risultati cambiano lingua, il codice resta lo stesso.
- **Si dice:** Il playground: ogni funzione dal vivo, accanto al suo codice.

## edge · I casi limite

- **Scena:** app, il sito
- **Si vede:** la pagina Edge cases, in inglese: la tabella delle forme di chiamata, una riga per caso, con caso, risultato e atteso. Clic su FR: la colonna dei risultati passa al francese.
- **Si dice:** I casi limite: una riga per caso, errori compresi.
- **Note:** "errori compresi" è un vanto, non una confessione: la pagina mostra anche cosa succede quando si sbaglia.

## restaurant · Un ristorante intero

- **Scena:** app, il sito
- **Si vede:** il ristorante: la terrazza sul mare, il titolo grande. Dal menu delle lingue (il globo in alto a destra) si passa al francese; poi la pagina scorre tutta, dall'alto fino in fondo, come nel playground: la storia, il menù, la cantina, le recensioni, le prenotazioni, tutto in francese. In fondo, dal globo (la barra resta in alto), il giapponese.
- **Si dice:** E un ristorante intero: duecentoventotto frasi, quattro lingue, tradotte dall'LLM.
- **Note:** è la prova in grande dell'LLM appena visto: lo scorrimento fa sentire quanto testo c'è. I numeri vengono da `doc/live-examples.md`: 228 frasi, quattro lingue oltre all'italiano di partenza.

## compare · Il confronto

- **Scena:** app, il sito
- **Si vede:** la landing, alla sezione del confronto ("Same problem, less machinery"): la tabella con le quattro colonne, viteTranslate per prima. Si riquadra la colonna di viteTranslate, tutta di ✓, dall'alto in basso. Nessun segno sulle altre colonne.
- **Si dice:** Lingui, FormatJS e i18next sono ottime librerie. La differenza non è una funzione sola: è averle tutte, fatte per lavorare insieme.
- **Note:** si giustifica con l'unità, non si umilia nessuno: le ✕ degli altri si vedono ma non si commentano, e la voce non dice "manca" né "solo viteTranslate". È l'unica scena che nomina le altre librerie. La tabella entra intera nell'inquadratura, intestazione compresa.

## together · Tutto in un posto

- **Scena:** card, l'elenco
- **Si vede:** le dieci funzioni della tabella del README, raggruppate per dove vivono, quattro colonne che si riempiono una dopo l'altra, a tempo di musica, ogni voce con il suo ✅:
  - "In your JSX": Keyless, natural text · ICU plurals, select, dates
  - "In VS Code": Official extension · LLM auto-translation
  - "In Vite": Official Vite plugin · Extraction in the Vite lifecycle · Lazy-loaded locales
  - "In production": Zero runtime dependencies · 5 kB gzip runtime · No message parsing at runtime

  Nessuna nota in basso.
- **Si dice:** Dieci funzioni, un solo pacchetto: nel JSX, in VS Code, in Vite e in produzione. Tutto in un posto: dove scrivi.
- **Note:** i punti di forza, ribaditi. Nessun accenno alle altre librerie: il confronto è appena passato. Ogni colonna entra sulla sua parola. Dopo la voce, un respiro sull'elenco completo, con la musica che sale: è la copertina.

## outro · Chiusura

- **Scena:** card, la chiusura comune
- **Si vede:** il logo, il comando npm, l'estensione nel Marketplace, il repo GitHub; i crediti della musica in basso.
- **Si dice:** viteTranslate. Su npm, nel Marketplace di VS Code e su GitHub. Tu scrivi la frase: viteTranslate fa il resto.
- **Note:** dopo la voce, un attimo di pausa: è la chiusura vera, la battuta che segue arriva come un ripensamento.

## coffee · Quasi dimenticavo

- **Scena:** card, la stessa di `outro`, senza stacco visibile
- **Si vede:** la card di chiusura, ferma com'è. Su "gratuito e open source" cade sulla scena, in basso a destra, un timbro "OPEN SOURCE", come stampato: un po' storto, inchiostro verde a buchi, sopra "FREE" e sotto "Apache-2.0". Su "un caffè", accanto al timbro, il QR di Buy me a coffee.
- **Si dice:** Ah, quasi dimenticavo: è gratuito e open source. Offri un caffè al mio autore, se ti va!
- **Note:**
  - Tono scherzoso, una cosa ricordata all'ultimo, con un mezzo sorriso: ma la stessa voce di sempre. A parlare qui è viteTranslate ("il mio autore").
  - Il QR porta a buymeacoffee.com/giancarlogy, lo stesso di `.github/FUNDING.yml`. Timbro e QR stanno sulla destra: i crediti della musica, in basso al centro, restano leggibili.
  - Dopo la voce la card resta finché il brano finisce da solo; negli ultimi 2 secondi almeno, il video sfuma al nero.
