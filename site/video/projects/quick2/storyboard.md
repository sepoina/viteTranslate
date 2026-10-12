# Quick start

- **Titolo:** viteTranslate quick start
- **Pubblico:** sviluppatori React che non conoscono viteTranslate
- **Durata:** circa 55 secondi
- **Voce:** Leda. Un collega che mostra un attrezzo a un altro: rilassato, chiaro, un mezzo sorriso. Niente tono da venditore.
- **Progetto filmato:** demo/Vite_8/quickApp, il quick start del README finito
- **Copertina:** la scena `fallback`, quando la frase nuova è già nel browser
- **Musica:** Chris Haugen - Mirage

## title · Apertura

- **Scena:** card, il titolo comune
- **Si vede:** il logo e, sotto, "Scrivi la frase. Ottieni la traduzione."
- **Si dice:** viteTranslate: le traduzioni per React e Vite, scritte proprio dove vive il testo.

## app · L'app

- **Scena:** app
- **Si vede:** "Welcome back, Ada!" e due bottoni. Un attimo di pausa, si cerchia Français, poi il clic: "Bon retour, Ada !".
- **Si dice:** Ecco una piccola app React. Un clic, e parla francese.

## write · Una frase nuova

- **Scena:** vscode
- **Si vede:** App.jsx aperto, il pannello viteTranslate a sinistra. Sotto il primo paragrafo si scrive `<p><Trans>You have three new messages.</Trans></p>` e si salva. Il pannello segna la frase come non sincronizzata, e si cerchia la sua riga nel pannello.
- **Si dice:** Serve una frase nuova? La scrivi nel JSX, così come si legge. Nessuna chiave da inventare. Salvi, e l'estensione la vede.
- **Note:** la digitazione si vede tutta, senza tagli.

## fallback · Mai un buco

- **Scena:** split, VS Code e browser affiancati
- **Si vede:** il browser, ancora in francese, mostra già la frase nuova: in inglese, col segnalino delle frasi non tradotte. Quando la voce dice che il francese mostra il testo inglese, si sottolinea la frase nel browser.
- **Si dice:** La pagina è già aggiornata. Non ancora tradotta? Il francese mostra il testo inglese. Mai uno spazio vuoto.

## sync · Sync

- **Scena:** vscode
- **Si vede:** una freccia indica Sync nel pannello, poi il clic; il terminale dice che la chiave è stata aggiunta. Si apre fr-FR.yml: la chiave nuova vale `null`, ed è già selezionata; si cerchia il `null`.
- **Si dice:** Un clic su Sync, e la chiave nuova arriva in ogni file di lingua. In francese aspetta, come null.

## translate · Si traduce

- **Scena:** split
- **Si vede:** al posto di `null` si scrive "Vous avez trois nouveaux messages." e si salva. La pagina si ricarica in inglese; clic su Français, e tutto è in francese: si riquadra la frase francese.
- **Si dice:** Scrivi la traduzione e salva. La pagina si ricarica, e il francese c'è tutto.

## outro · Chiusura

- **Scena:** card, la chiusura comune
- **Si vede:** il logo, il comando npm, l'estensione nel Marketplace, il repo GitHub.
- **Si dice:** viteTranslate. Su npm, e nel Marketplace di VS Code.
