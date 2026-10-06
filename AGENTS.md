# AGENTE AI

## REGOLE DI DIALOGO UMANO AGENTE

- Per ogni mia richiesta esegui una preventiva e veloce messa in discussione. Se trovi che la richiesta sia incoerente o peggiori il prodotto o l'esperienza d'uso proponi modiche se le trovi (ask) o proponi di annullare (sempre ask). Se confermo la scelta di continuare continua senza esitazioni.
- Le implementazioni dubbie sono un disvalore. Ove necessario chiedi (ask) piuttosto che improvvisare.

## INTELLIGENZA LATERALE

- Se come agente senti che sono insoddisfatto di lavori precedenti o pensi che per migliorare il tuo intervento ti possa essere utile una SKILL specifica effettua una ricerca su server pubblici (ad esempio per il design https://mcpservers.org/agent-skills/author/anthropic?q=design) e proponimi di installarla.

## REGOLE DI DOCUMENTAZIONE

- README.md inferiore a 10kb, le sezioni nei tags "details" non contano, usa il codice sotto per calcolare. In caso di esubero segui le regole di compressione della documentazione. 

```bash
node -e "const s=require('fs').readFileSync('README.md','utf8').replace(/<!--[\s\S]*?-->/g,'').replace(/<details[\s\S]*?<\/details>/gi,'');console.log(Buffer.byteLength(s),'bytes',s.split('\n').length,'lines')"
```

- ogni file di documentazione deve essere rivolto all'utente, ad incentivo. Discorsività minima per una lettura veloce, elementi essenziali, eventuale ironia.
- i testi vanno scritti in inglese. Se l'originale è in italiano proporre (ask) traduzione ed adattamento.
- quando un testo va ridotto analizza i punti confusi e pensa prima a come riorganizzarlo per renderlo più leggibile, alla luce di questo procedi. 
- in chiusura di ogni bundle di release e a ogni revisione di versione, rilanciare `npm run estimateSize` (vedi `test/measureReactBundle.mjs` per cosa misura: runtime React + helper ICU). Lo script riscrive `site/runtimeSize.json` e confronta README.md: nello stesso commit si aggiorna README.md finché non stampa `README: OK` — il numero di byte esatto nella nota ⁴ sempre, le cifre arrotondate quando cambiano. Regola delle cifre: il peso reale si scrive arrotondato per difetto al kB (5,4 kB → "5 kB"), mai "< 5 kB", "sotto i 5 kB" o simili; nelle comparazioni si usa il kB superiore con "<" (5,4 kB → "<6 kB"). Non un controllo occasionale ("se cambia"): un aggiornamento sistematico ad ogni chiusura.

## REGOLE DI RILASCIO

- l'estensione (idePlugin/) legge la libreria installata nel progetto dell'utente solo per **Results**, attraverso l'export `@sepoina/vitetranslate/ide/scan` (`lib/ide/scan.js`), versionato da `IDE_API` (un intero). Il resto della libreria che le serve è impacchettato alla build. Il contratto è additivo: gli export si aggiungono, non si tolgono né cambiano significato.
- quando l'estensione comincia a usare un export nuovo, la libreria alza `IDE_API` e l'estensione alza `IDE_API_MIN` (`idePlugin/src/probes/markedScan.mjs`). In quel caso, e solo in quello, la libreria con il nuovo `IDE_API` si pubblica su npm col tag `latest` prima della .vsix: si rilascia l'estensione solo quando `npm view @sepoina/vitetranslate@latest version` risponde con quella versione o una successiva. Ogni automazione futura della pubblicazione dell'estensione fa la stessa verifica prima di procedere.

## REGOLE DI COMPRESSIONE DELLA DOCUMENTAZIONE

- In README.md usa principalmente per comprimere la tecnica di esternalizzare ad un file md doc (in folder doc) le funzioni secondarie lasciando in readme solo un richiamo/link al nuovo file di dettaglio che hai creato in doc.
- La regola generale prevede che uno sforamento fino al 10% sia trascurato, superata quella soglia la compressione vine chiesta (ask) e si tenta di riportarlo entro il 90% della dimensione massima prevista. In questo modo non si sovraccarica il sistema.
- La compressione agisce sulle singole frasi (o su gruppi di esse) cercando di costruirle al fine di sintetizzare mantenendo il costrutto.

## REGOLE DI PLAN

- il plan si fa quando lo chiedo esplicitatamente o quando tu ritieni sia strettamente necessario e io confermo il tuo ask.
- intelligenza in plan. Usa una forte concentrazione nella stesura dei piani e prevedi invece una intelligenza bassa nell'implementazione, di conseguenza sovradocumenta i passaggi necessari.
- alla fine della pianificazione metti in testa del documento di pianificazione una nota (> [!NOTE]) per un revisore umano che descrive il piano in estrema sintesi con elenco puntato. Massimo una decina di righe.
- ogni nuova implementazione va prevista in sette fasi. Implementazione, test, build, review, documentazione, pulizia, logDiary. Viene insegnato anche (dal piano all'intelligenza bassa che lo implementa) a tenersi su questo schema.

## REGOLE DI IMPLEMENTAZIONE DEL PLAN

- documenti di riferimento: si segue il piano di implementazione contenuto in doc/ImplementationPlans ed eventuali {nomepiano}.necessaryreview.md usciti da un ciclo precedente. E' la fonte di verità e le contraddizioni coi sorgenti diventano ask all'utente.
- 1.implementazione: Ogni ambiguità va risolta con ask all'utente. Al termine degli ask eventuali si procede alla modifica dei file necessari come da piano,  Eventuali test che dovessero rendersi necessari vengono appuntati in un file che si chiama {nomepiano}.necessarytest.md alla fine della procedura vengono creati tutti i test ritenuti necessari. Eventuali modifiche ai doc vengono appuntate in {nomepiano}.necessarydoc.md per essere eseguite solo alla fine. Le build vengono evitate ove possibile e ove sostituibili con sistemi di test rapido in node (lint, piccoli script).
- 2.test: segue il file {nomepiano}.necessarytest.md del piano e li implementa. A questo punto ove possibile effettua verifiche rapide in node.
- 3.build. La build può essere superata o emettere dei problemi che vengono risolti o che segnalano al passo successivo la necessità di revisione del piano.
- 4.revisione. In caso di fallimenti architetturali viene creato un file {nomepiano}.necessaryreview.md che contiene note integrative e/o riscritture emendative di piano. Viene sottoposto ad ask ogni dubbio. il processo in questo caso riparte dall'implementazione tecnica.
- 5.documentazione. Alla luce delle regole di questo file procedere con i {nomepiano}.necessarydoc.md ed eventuali percorsi extra. Se le lunghezze sono eccessive avvisare l'utente alla fine.
- 6.pulizia. Tutti i subdocumenti di piano vengono rimossi se non più necessari
- 7.logDiary. Aggiungi una nota [!TIP] (Verde) nel documento di pianificazione, subito dopo la nota per il revisore umano che riassuma le decisioni prese nel percorso. Sintesi estrema, elenco puntato. Se ci fossero scelte pericolose o avvertimenti usare [!IMPORTANT] (Viola) o [!CAUTION]. Massimo una decina di righe.
