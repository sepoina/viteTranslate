// L'ingresso `@sepoina/vitetranslate/ide/scan`: quello che legge Results, nell'estensione per
// l'editor (idePlugin/src/probes/markedScan.mjs), dalla libreria installata nel progetto, in un
// processo figlio. Gli stessi passi di dev/vite/uty/scanSource.js e le stesse letture di
// `--status`: le voci del pannello sono quelle del CLI. Sorgente e non bundle: il processo figlio
// parte ogni volta da una cache vuota.
//
// È un contratto. Gli export si aggiungono, non si tolgono e non cambiano significato. IDE_API
// sale quando se ne aggiunge uno che l'estensione comincia a usare: lei chiede un minimo
// (IDE_API_MIN in markedScan.mjs) e sotto quello dice all'utente di aggiornare. L'ordine di
// rilascio che ne segue è in AGENTS.md, "REGOLE DI RILASCIO".

/** La versione del contratto. */
export const IDE_API = 1;

export { default as walkSource } from "../dev/vite/uty/walkSource.js";
export { mayHaveMarkers } from "../markerSyntax.js";
export { listFiles } from "../dev/vite/uty/listLanguageFiles.js";
export { isLanguageFileName, tagFromFileName } from "../dev/vite/uty/languageFileFormat.js";
export { default as readLanguageFile } from "../dev/vite/uty/readLanguageFile.js";
export { readMarkerIndex, autoWrapKey } from "../dev/vite/uty/markerIndex.js";
export { hash } from "../dev/babel/markerCore.js";

/** extractMarkers, caricato solo alla prima voce da leggere con Babel: è lì che si scopre se manca. */
export const loadExtractMarkers = async () => (await import("../dev/babel/extractMarkers.js")).default;
