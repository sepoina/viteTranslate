# Perché un'altra libreria di traduzioni

- **Titolo:** Why viteTranslate
- **Pubblico:** sviluppatori React che usano già, o stanno scegliendo, una libreria di traduzioni. Sanno cos'è una chiave, e quanto costa tenerla in ordine.
- **Durata:** circa 2 minuti
- **Idea:** una domanda onesta, "perché un'altra libreria di internazionalizzazione?", e la nostra risposta: tradurre dovrebbe succedere dove lavori già. Così l'abbiamo integrato in tre posti: nel JSX, in Vite, in VS Code. Seguiamo una frase dal JSX alla build, e fino al francese; ogni tappa mostra una cosa che abbiamo integrato. VS Code è il cuore del racconto: l'editor è dove passi la giornata, e lì le traduzioni diventano parte della scrittura.
- **Tono:** sempre in positivo. Diciamo cosa abbiamo integrato, mai cosa manca agli altri. Le altre librerie si nominano una volta sola, alla fine, con rispetto, e per mandare al confronto completo del README.
- **Voce:** Leda. Chi ha costruito l'attrezzo e ne è contento, senza vantarsene: racconta una scelta, non vende. Ritmo vivace, un sorriso nella voce, un filo d'ironia sulla domanda d'apertura.
- **Progetto filmato:** demo/Vite_8/quickApp, il quick start del README finito
- **Copertina:** la scena `together`, quando l'elenco è completo
- **Musica:** Chris Haugen - Mirage, presente. Entra piano sulla domanda, respira nelle card, sfuma sulla chiusura.
- **Respiro:** la voce copre quasi tutto il video; dopo `hook` e dopo `together` un paio di secondi senza voce, perché la musica salga.
- **Fonti:** la tabella "⚡ Why viteTranslate" del README e le sue note; il peso del runtime dalla nota ⁴. Se il README cambia, il video va rivisto.
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
  - traduzione automatica con LLM → `llm`
  - anteprima traduzione automatica con LLM → `llm preview`
  - in più, fuori tabella: il testo sorgente come ripiego, mai un buco → `fallback`

## hook · La domanda

- **Scena:** card, nuova: la domanda
- **Si vede:** il fondo scuro delle card comuni. Al centro, grande, la domanda: "Another i18n library?". Un attimo fermi, poi sotto si accendono una dopo l'altra, sulle parole della voce, tre parole in verde: "JSX" · "Vite" · "VS Code".
- **Si dice:** Un'altra libreria di internazionalizzazione? Domanda giusta. La nostra risposta: tradurre ti serve dove lavori già. Nel JSX, in Vite, in VS Code. L'ambiente ti deve aiutare...
- **Note:** la domanda si dice con un mezzo sorriso, come chi se l'è sentita fare spesso. La musica entra piano sotto le tre parole. Dopo la voce, un respiro: le tre parole restano accese e la musica sale.

## title · L'abbiamo integrato

- **Scena:** card, il titolo comune
- **Si vede:** il logo e, sotto, "Scrivi la frase. Ottieni la traduzione."
- **Si dice:** Così l'abbiamo integrato in tutti e tre. viteTranslate: scrivi la frase, ottieni la traduzione.

## write · La frase è la chiave

- **Scena:** vscode
- **Si vede:** App.jsx aperto, il pannello viteTranslate a sinistra. Sotto il primo paragrafo si scrive `<p><Trans>You have three new messages.</Trans></p>` e si salva. Nel pannello compare la frase, non ancora sincronizzata: si cerchia la sua riga.
- **Si dice:** Scrivi la frase nel JSX, così come si legge. La chiave? La crea viteTranslate, alla build o dal plugin di vscode, niente da gestire.
- **Note:** la digitazione si vede tutta, senza tagli.

## extension · Dentro VS Code

- **Scena:** vscode
- **Si vede:** nel pannello si apre Settings (l'ingranaggio) e, sotto Highlight style, si cliccano uno dopo l'altro tre o quattro stili: a ogni clic la frase appena scritta in App.jsx cambia evidenziazione, a tempo di musica. L'ultimo resta; Back riporta il pannello com'era.
- **Si dice:** Ed ecco VS Code: un'estensione ufficiale porta le traduzioni nell'editor. Ogni frase col suo stato, evidenziata come preferisci.
- **Note:** è la scena che apre il cuore del video: l'editor come occasione, non come accessorio. Il cambio di stile deve divertire, non stancare: stili ben diversi tra loro, e l'ultimo ben leggibile. Settings e non la palette: la lista della palette coprirebbe proprio la riga nuova.

## fallback · Mai un buco

- **Scena:** split, VS Code e browser affiancati
- **Si vede:** nel browser, in inglese, la frase nuova c'è già. Clic su Français: "Bon retour, Ada !", e la frase nuova resta in inglese, col segnalino 🔸 davanti. Si sottolinea la frase inglese, poi si cerchia il segnalino.
- **Si dice:** Nel browser la frase c'è già. In francese non esiste ancora? Mostra l'inglese, col segnalino, che vedrà solo chi sviluppa, non finirà in produzione. Mai un buco, mai un crash.
- **Note:** il clic su Français cade su "In francese".

## build · Dentro Vite

- **Scena:** vscode, col terminale aperto
- **Si vede:** nel terminale di VS Code si lancia `npm run build`. Prima parla viteTranslate: allinea i file di lingua, una chiave aggiunta in inglese, una che manca in francese; si cerchiano quelle righe. Poi Vite elenca i file della build: si riquadra il chunk del francese, `fr-FR-….js`.
- **Si dice:** Ma proviamo una build. Il plugin Vite rimette in pari ogni file di lingua, da solo: l'estrazione fa parte del ciclo di Vite, nessun comando in più da ricordare. E il francese diventa un chunk suo, caricato solo quando serve.
- **Note:** conta l'output, non come si lancia: se il terminale non si lascia pilotare, va bene il task "npm: build" dalla palette. Se i segni non trovano il testo del terminale, meglio nessun segno che un segno fuori posto. L'inglese, lingua di partenza, è precaricato nel bundle principale: un chunk suo non ce l'ha, e non va promesso.

## bundle · Leggero in produzione

- **Scena:** card, la stessa di `llm` con altri testi
- **Si vede:** in alto "In production". Tre numeri grandi, uno per battuta: "0 runtime dependencies" · "5 kB gzip" · "Precompiled". Sotto, piccolo: "ICU plurals, select, numbers and dates: compiled at build time".
- **Si dice:** E in produzione viaggia leggero. Zero dipendenze a runtime, cinque kilobyte gzip. Plurali e date ICU arrivano già compilati: il browser riceve valori pronti.
- **Note:** viene subito dopo la build: è quello che la build consegna. Il peso si scrive "5 kB", come nella nota ⁴ del README: mai "meno di 6", mai "sotto i 5". Ogni numero arriva sulla sua parola, con un piccolo colpo.

## translate · Dritti alla chiave

- **Scena:** split
- **Si vede:** il pannello è già aggiornato: la frase ora è da tradurre (🔸) e fr-FR, in Project, ha il suo badge giallo. Clic sulla riga della frase in Results, poi clic su fr-FR: il file si apre proprio sulla chiave nuova, che vale `null`; si cerchia il `null` per un paio di secondi. Al suo posto si scrive "Vous avez trois nouveaux messages." e si salva. La pagina si ricarica in inglese; clic su Français, e tutto è in francese: si riquadra la frase francese.
- **Si dice:** Il pannello lo sa già: una frase da tradurre. Un clic su di lei, uno sul francese, e il file si apre proprio sulla chiave. Scrivi, salva, e la pagina parla francese.
- **Note:** il secondo momento VS Code: niente ricerca nei file, l'editor ti porta dove serve. La build ha già scritto i file di lingua, e la pagina si è ricaricata in inglese: la scena parte da lì.

## llm · Mille chiavi

- **Scena:** card, nuova: tre battute
- **Si vede:** in alto "LLM auto-translation" e, sotto, il comando `npx vitetranslate --llm-translate`. Poi, una alla volta, sulle parole della voce, tre battute grandi: "💰 Cost first" · "✋ Asks before spending" · "🛡️ Every result validated".
- **Si dice:** Mille chiavi? Abbiamo integrato anche un LLM, quello che preferisci. Ti mostra il costo, chiede prima di spendere, e controlla ogni risultato.
- **Note:** è una card perché quickApp non ha `llm` configurato, e ogni ripresa costerebbe. "Quello che preferisci" vuol dire qualsiasi API compatibile OpenAI, o un driver tuo: nessun modello per nome.

## llm-preview · Flusso pulito

- **Scena:** split
- **Si vede:** a sinistra il pannello llm dell'estensione, a destra del codice, sotto il codice l'esecuzione dell'llm che si completa con delle chiavi e delle stime di costi. Alla destra del codice infine l'anteprima del sito. Al completamento della traduzione si aggiorna la visualizzazione che aspettava le frasi assenti.  
- **Si dice:** A volte meglio la semplicità.
- **Note:** utilizza la .env con le chiavi di openrouter e deepseek per risolvere le traduzioni nella demo (vedi progetto demo llm). Usa un tono ironico per la frase.

## together · Tutto in un posto

- **Scena:** card, nuova: l'elenco
- **Si vede:** le dieci funzioni della tabella del README, raggruppate per dove vivono, quattro colonne che si riempiono una dopo l'altra, a tempo di musica, ogni voce con il suo ✅:
  - "In your JSX": Keyless, natural text · ICU plurals, select, dates
  - "In VS Code": Official extension · LLM auto-translation
  - "In Vite": Official Vite plugin · Extraction in the Vite lifecycle · Lazy-loaded locales
  - "In production": Zero runtime dependencies · 5 kB gzip runtime · No message parsing at runtime

  In basso, piccolo: "Side by side with Lingui, FormatJS and i18next: see the README".
- **Si dice:** Dieci funzioni, un solo pacchetto, pensate per lavorare insieme. Lingui, FormatJS e i18next sono ottime librerie, e il confronto completo è nel README. Noi abbiamo scelto di mettere tutto in un posto: dove scrivi.
- **Note:** nessuna colonna degli altri, nessun ❌: qui si mostra solo cosa abbiamo integrato, il confronto resta nel README. Dopo la voce, un respiro sull'elenco completo, con la musica che sale: è la copertina.

## outro · Chiusura

- **Scena:** card, la chiusura comune
- **Si vede:** il logo, il comando npm, l'estensione nel Marketplace, il repo GitHub; i crediti della musica in basso.
- **Si dice:** viteTranslate. Su npm, nel Marketplace di VS Code e su GitHub. Tu scrivi la frase: al resto pensiamo noi.
- **Note:** la musica sfuma qui, dopo la voce.
