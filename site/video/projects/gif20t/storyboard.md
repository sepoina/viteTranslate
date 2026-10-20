# viteTranslate in venti secondi, la torre

- **Titolo:** viteTranslate in twenty seconds, the tower
- **Scopo:** la GIF della campagna: in testa al README, nei post social, nelle pagine del Marketplace e di npm. **Tre finestre grandi, una sopra l'altra, e una camera che ci scivola sopra.** Ogni finestra è un 16:9 intero: niente da cercare, niente da ingrandire. Gira da sola, muta, in loop.
- **Idea:** un solo workflow, dal codice a ogni lingua. Una frase attraversa i quattro pezzi dell'ecosistema: si scrive in VS Code, Vite la porta subito nella pagina, l'LLM la traduce, React la mostra in francese. Il quadro è una torre di tre finestre, dall'alto in basso: l'anteprima, il codice con l'estensione, il terminale. La camera sale e scende; dove l'attenzione salta, la camera salta.
- **Pubblico:** sviluppatori React che scorrono un feed o un README. Nessun audio.
- **Durata:** circa 25 secondi, card finale compresa (circa 4 s). Ci sono il francese e poi l'inglese, e ogni finestra ha il tempo di essere letta. La corsa LLM, a 1,5×, ne vale da 3 a 5 e cambia a ogni ripresa.
- **Formato:** video 16:9 1920×1080, 30 fps. La torre è un quadro alto, tre finestre 16:9 larghe quanto il video, con un poco di nero tra l'una e l'altra (il carattere del terminale è ridotto del 5% rispetto agli altri riquadri: 15 invece di 16, il valore intero più vicino. A 16 il report riempie la finestra fino all'ultima colonna e può andare a capo; a 15 c'è qualche colonna di margine):
  1. **Preview**, in cima: l'app di Ada nel browser;
  2. **Code**, in mezzo: VS Code con App.jsx e il pannello viteTranslate a sinistra (da lì si clicca Translate);
  3. **Terminal**, in fondo: il terminale di VS Code, dove gira la corsa LLM.
  Il video mostra una finestra alla volta. Accanto, come sempre, l'mp4 è il prodotto; la GIF (800 px, 12 fps) si fa alla fine, quando il montaggio è approvato. Nessuna dissolvenza.
- **Camera:** non zooma mai: scivola in verticale, e ogni inquadratura è una finestra intera.
  - **Scivola** dove la storia si sposta con calma: dall'anteprima al codice (si scende), dal codice all'anteprima (si sale), dal codice al terminale (si scende, un attimo dopo il clic su Translate), dal terminale all'anteprima (si sale di due finestre, passando dal codice);
  - **Nessun salto:** in tutto il filmato ogni spostamento è uno scivolamento, anche dove l'attenzione cambia luogo di colpo (dall'anteprima al codice prima del clic su Translate, dal codice al terminale dopo il clic). Fra una scena e l'altra la camera riparte da dove era finita.
- **Ritmo (tempi da cinema):** ogni finestra nuova resta ferma il tempo di essere letta; la camera si muove solo quando c'è qualcosa di nuovo da guardare; lo scivolamento è dolce ai due capi (circa 0,9 s per una finestra, 1,3 s per due).
- **Velocità:** nessun taglio. La digitazione va a 1,5×; il puntatore verso Translate a 2×; la corsa LLM a 1,5× (a 2× passava troppo in fretta per leggere il report, a velocità normale è lenta). Il risultato resta fermo, a velocità normale, il tempo di leggerlo.
- **Voce:** nessuna. Niente sottotitoli.
- **Musica:** nessuna.
- **Progetto filmato:** una copia tutta sua di demo/Vite_8/quickApp (`fixture/`), con un blocco `llm` (OpenRouter, la stessa chiave della voce, un modello della pagina "Tested endpoints" del manuale, ragionamento spento) e nessuna domanda di conferma prima di spendere.
- **L'app di Ada:** "Welcome back, Ada!" e sotto i due pulsanti, English e Français, come nel quick start. Carattere grande, nessuna frase a capo, nemmeno in francese.
- **Copertina:** la scena `french`, con la pagina in francese.
- **Fonti:** il quick start del README; per i quattro pezzi la tabella "⚡ Why viteTranslate". Se la storia cambia, cambia anche la GIF.

## write · Scrivi

- **Scena:** tower, il video parte dalla finestra in cima
- **Si vede:** l'anteprima, "Welcome back, Ada!" e i due pulsanti, ferma un secondo e mezzo. Poi la camera scende fino al codice: App.jsx con il cursore a fine del primo paragrafo e, a sinistra, il pannello viteTranslate. L'utente scrive la riga nuova (a 1,5×) `<p><Trans>Nice to see you, {name}!</Trans></p>` e salva. La riga resta ferma il tempo di leggerla. Poi la camera risale all'anteprima: sotto "Welcome back, Ada!" è comparsa "Nice to see you, Ada!", ancora in inglese. Un quadrato ondeggiante, tracciato a mano e un po' tremolante, si disegna attorno alla frase aggiunta e la mette in evidenza per un secondo e mezzo; poi il taglio alla scena dopo lo porta via.
- **Note:**
  - La digitazione è svelta ma si legge tutta, senza tagli.
  - La frase nuova nel browser è la prova che Vite l'ha portata in pagina da solo, senza ricaricare.
  - Il testo resta in inglese: la traduzione non c'è ancora, ed è il punto della scena dopo.

## translate · Traduci

- **Scena:** tower, la stessa, senza stacco di scena
- **Si vede:** la camera riparte dall'anteprima e scivola giù fino alla finestra di mezzo: il pannello viteTranslate, già sulla pagina LLM, con la riga Translate. Il tempo di trovarla, poi il puntatore (a doppia velocità) ci va e clicca. Al clic si torna a velocità normale e il clic si vede per un attimo; poi la camera scivola giù fino al terminale, dove il comando è appena partito. Qui la corsa va a 1,5× e si vede riga per riga: il comando parte, il report si compone, la traduzione arriva ("Full translate!"). Da lì si torna a velocità normale e la riga resta ferma il tempo di leggerla.
- **Note:**
  - La pagina LLM è aperta prima della ripresa, non durante.
  - Translate fa anche il sync (`--llm-translate` sincronizza, poi traduce): nessun clic su Sync.
  - La corsa è vera: la traduzione l'ha fatta l'LLM, davvero, e si vede (accelerata di un terzo, non tagliata).

## french · In francese e in inglese

- **Scena:** tower, la stessa
- **Si vede:** la camera è ancora sul terminale. Sale fino all'anteprima, due finestre più su, e ci arriva con l'app ricaricata in inglese. Clic su Français: "Bon retour, Ada !" e, sotto, la frase nuova in francese. Ferma il tempo di leggerla. Clic su English: la pagina torna in inglese, con la sua frase. L'interfaccia funziona nelle due lingue.
- **Note:**
  - Il testo francese lo sceglie l'LLM: nessuna frase attesa a priori.
  - L'ultima inquadratura prima della card è la pagina in inglese, ferma.

## pillars · I quattro pezzi

- **Scena:** card, il titolo comune
- **Si vede:** il logo entra e, sotto, il claim: "One workflow." in bianco, "From code to every language." in verde. Sotto il claim, vicina, come seconda riga dello stesso testo (interlinea 160%): i quattro pezzi compaiono uno dopo l'altro, nell'ordine in cui la frase li ha attraversati: VS Code, Vite, LLM, React.
- **Note:**
  - Circa 4 secondi: l'entrata del logo e del claim, i quattro termini uno ogni mezzo secondo, poi ancora un secondo di tenuta.
  - Niente comando npm né indirizzi.
