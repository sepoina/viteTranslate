## REGOLE 

- README.md inferiore a 10kb, le sezioni nei tags "details" non contano, usa il codice sotto per calcolare. In caso di esubero in README.md un richiamo a funzioni e un link a nuovo file di dettaglio in doc.

```bash
node -e "const s=require('fs').readFileSync('README.md','utf8').replace(/<!--[\s\S]*?-->/g,'').replace(/<details[\s\S]*?<\/details>/gi,'');console.log(Buffer.byteLength(s),'bytes',s.split('\n').length,'lines')"
```

## REGOLE DI DOCUMENTAZIONE
- ogni file di documentazione deve essere rivolto all'utente, ad incentivo. Discorsività minima per una lettura veloce, elementi essenziali, eventuale ironia.
- i testi vanno scritti in inglese. Se l'originale è in italiano proporre (ask) traduzione ed adattamento.
- quando un testo va ridotto analizza i punti confusi e pensa prima a come riorganizzarlo per renderlo più leggibile, alla luce di questo procedi. 

## REGOLE DI PLAN

- intelligenza in plan. Usa una forte concentrazione nella stesura dei piani e prevedi una intelligenza bassa nell'implementazione, di conseguenza sovradocumenta i passaggi necessari.
- alla fine della stesura metti in testa una nota per un revisore umano che descrive il piano in estrema sintesi con elenco puntato
- ogni nuova implementazione viene fatta in quattro fasi. Implementazione, test, build, review, documentazione.
- implementazione: Ogni ambiguità va risolta con ask all'utente. Al termine di procede alla modifica dei file necessari come da piano, seguendo un piano di implementazione contenuto in doc/ImplementationPlans ed eventuali {nomepiano}.necessaryreview.md usciti da un ciclo precedente. Eventuali test che dovessero rendersi necessari vengono appuntati in un file che si chiama {nomepiano}.necessarytest.md alla fine della procedura vengono creati tutti i test ritenuti necessari. Eventuali modifiche ai doc vengono appuntate in {nomepiano}.necessarydoc.md per essere eseguite solo alla fine. Le build vengono evitate ove possibile e ove sostituibili con sistemi di test rapido in node (lint, piccoli script).
- implementazione test: segue il file {nomepiano}.necessarytest.md del piano e li implementa. A questo punto ove possibile effettua verifiche rapide in node.
- build. La build può essere superata o emettere dei problemi che vengono risolti o che segnalano al passo successivo la necessità di revisione del piano.
- revisione. In caso di fallimenti architetturali viene creato un file {nomepiano}.necessaryreview.md che contiene note integrative e/o riscritture emendative di piano. Viene sottoposto ad ask ogni dubbio. il processo in questo caso riparte dall'implementazione tecnica.
- revisione della documentazione. Alla luce delle regole di questo file procedere con i {nomepiano}.necessarydoc.md ed eventuali percorsi extra. Se le lunghezze sono eccessive avvisare l'utente alla fine. 

