// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// L'orchestratore. Separato dalla sync, non innestato dentro `updateAllSubLanguages`: così è
// provabile senza rete con un driver finto, è sicuro rispetto a un `vite dev` acceso in un
// altro terminale, e costa una rilettura per lingua — niente.
//
// Cosa non deve fare, per costruzione: non tocca `service.sourceTable` (legge il file della
// lingua sorgente già scritto su disco, come chiunque altro), non cambia le chiavi, non
// riordina niente — l'ordinamento del file lo decide `splitAndSortEntries` come sempre, e non
// riscrive mai il file della lingua sorgente.

import path from "path";
import runSync, { localeDirOf } from "../vite/syncCore.js";
import listLanguageFiles from "../vite/uty/listLanguageFiles.js";
import readLanguageFile, { readLanguageText } from "../vite/uty/readLanguageFile.js";
import writeLanguageFileIfChanged from "../vite/uty/writeLanguageFile.js";
import { languageFileName, tagFromFileName } from "../vite/uty/languageFileFormat.js";
import backupLanguageFile from "../vite/uty/backupLanguageFile.js";

import normalizeLlmOptions from "./llmOptions.js";
import { resolveApiKey } from "./apiKey.js";
import buildBatches from "./buildBatches.js";
import {
  SYSTEM_CONTEXT, buildTranslateSystemPrompt, buildUserPayload, buildRepairUserPayload, buildContextUserPayload,
} from "./prompts.js";
import validateTranslation from "./validateTranslation.js";
import { isIcuCandidate } from "../../icu/parse.js";
import { requiredPluralCategories, llmSourceText } from "../compile/icu/icuSignature.js";
import readReply, { salvageTruncated } from "./readReply.js";
import { estimateRun, costOf, formatCost, formatTokens, initialRatio, itemCharsOut } from "./costModel.js";
import { checkCaps, checkCI, confirmProceed, shouldStopMidRun } from "./budgetGuard.js";
import {
  readLedger, updateLedger, recordRequest, recordFailure, clearFailure, failureCount,
  ratiosFor, recordContextGeneration,
} from "./llmLedger.js";
import {
  readContextFile, writeContextFile, replaceGeneratedRegion, shouldRegenerate, isUnmanaged,
} from "./contextFile.js";
import contextSample, { corpusHash } from "./contextSample.js";
import { callModel, runWithConcurrency } from "./callModel.js";
import { printEstimate, printRunResult } from "./llmReport.js";
import createRequestPanel from "./requestPanel.js";
import { appendRunLog } from "./runsLog.js";

function formatDateOnly(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function whereFromKey(key) {
  const cut = key.lastIndexOf("_");
  return cut === -1 ? key : key.slice(0, cut);
}

// Quante volte le chiavi di una risposta troncata tornano al modello, in lotti ogni volta di al
// più metà: tre giri bastano anche al primo run di un modello che ragiona, senza taratura (100
// chiavi -> 50 -> 25 -> 12; con due, la simulazione sulle stringhe della demo del 2026-09-19
// lasciava al run dopo 46 chiavi giapponesi), e fermano il conto di una stringa che non ci sta
// comunque: solo il lotto che la contiene si tronca, una volta per giro.
const MAX_SPLIT_ROUNDS = 3;

/**
 * @param {{
 *   config: object, tags?: string[] | null, dryRun?: boolean, auto?: boolean, noAsk?: boolean,
 *   contextOnly?: boolean, retranslateTags?: string[] | null, now?: Date,
 *   debug?: { write(label: string, data: any): void, setSecret(key?: string): void } | null,
 * }} options
 */
export default async function translatePass(options) {
  const {
    config,
    tags = null,
    dryRun = false,
    auto = false,
    noAsk = false,
    contextOnly = false,
    forceContext = false,
    retranslateTags = null,
    now = new Date(),
    debug = null,
  } = options;

  const startedAt = Date.now();

  const llm = normalizeLlmOptions(config);
  if (llm === null) {
    throw new Error(
      "[vitetranslate] llm is not configured in vite.config — add an `llm` block. See doc/llm.md."
    );
  }

  const localeDir = localeDirOf(config);

  const ciCheck = checkCI({ noAsk });
  if (!ciCheck.ok) {
    debug?.write("refused", ciCheck.message);
    return { mode: "refused", message: ciCheck.message };
  }

  let apiKey;
  if (!llm.driver) {
    const resolved = await resolveApiKey({ connection: llm.connection, baseDir: config.baseDir });
    apiKey = resolved.key;
    debug?.setSecret(resolved.key);
    debug?.write("api-key", { from: resolved.from });
  }

  // 3. Sync fresca: l'insieme dei `null` dev'essere aggiornato prima di leggerlo.
  await runSync({ config, showTranslateHint: false });

  const sourceFilePath = path.join(localeDir, languageFileName(config.sourceLanguage));
  const { table: sourceTableRaw } = readLanguageFile(sourceFilePath);
  const sourceTable = sourceTableRaw ?? {};

  let ledger = readLedger(config.baseDir);

  // La chiave del ledger per modello: un driver utente senza `model` è "custom-driver", come
  // già in `replaceGeneratedRegion`.
  const modelKey = llm.connection.model ?? "custom-driver";
  const { modelClass } = llm.connection;

  // Ogni tentativo che ha un `usage` entra nel ledger **subito**, riuscito o no: un Ctrl-C a
  // metà run non azzera la spesa del giorno. Per questo il ledger si aggiorna per richiesta e non
  // a fine run (e `models[model].requests` lo incrementa `recordRequest`, una volta sola).
  // La taratura si passa solo per il tentativo riuscito (vedi `sendBatch`).
  const costFor = (usage) =>
    costOf({ tokensIn: usage.tokensIn, tokensOut: usage.tokensOut, connection: llm.connection })?.cost ?? 0;
  const recordUsageInLedger = ({ usage, tag }) => {
    const attemptCost = costFor(usage);
    updateLedger(config.baseDir, (l) => recordRequest(l, { model: modelKey, tag, usage, cost: attemptCost }));
    return attemptCost;
  };

  // --- contesto: una volta per l'intero run, mai per lingua ---
  let contextText = readContextFile(localeDir);
  const unmanagedContext = isUnmanaged(contextText);
  const keysNow = Object.keys(sourceTable).length;

  const wantsRegeneration =
    llm.context.mode !== "off" &&
    !unmanagedContext &&
    (contextOnly || forceContext ||
      shouldRegenerate({
        mode: llm.context.mode,
        existingText: contextText,
        keysNow,
        keysAtGeneration: ledger.context?.keysAtGeneration,
        refreshEvery: llm.context.refreshEvery,
      }));

  let contextRegenerated = false;
  if (wantsRegeneration && !dryRun) {
    const sourceEntries = Object.entries(sourceTable).map(([key, text]) => ({ key, text }));
    const sample = contextSample(sourceEntries, llm.context.sample);
    const userPayload = buildContextUserPayload({ existingFile: contextText, sample });

    // Una richiesta sola, ma con un modello che ragiona può durare decine di secondi: anche lei
    // ha la sua riga dal vivo, invece di un terminale fermo prima della stima.
    const panel = createRequestPanel({
      sourceTag: config.sourceLanguage, traced: debug !== null,
    });
    const request = panel.open({ kind: "context", count: sample.length });
    let result;
    try {
      // Il costo del contesto entra nel giorno, senza `tag`: non tocca la taratura di uscita.
      result = await callModel({
        connection: llm.connection, driver: llm.driver, apiKey,
        systemPrompt: SYSTEM_CONTEXT, userPayload, mode: "context",
        maxTokens: modelClass.maxTokens,
        onUsage: (usage) => recordUsageInLedger({ usage }),
        debug, label: "context", onRetry: request.retry,
      });
      request.done({ lines: result.text.split("\n").filter((line) => line.trim() !== "").length }, result.usage);
    } catch (error) {
      request.fail(error);
      throw error;
    } finally {
      panel.finish();
    }

    const newText = replaceGeneratedRegion(contextText, result.text, {
      date: formatDateOnly(now), keys: keysNow, model: llm.connection.model ?? "custom-driver",
    });
    writeContextFile(localeDir, newText);
    debug?.write("context-result", newText);
    contextText = newText;
    contextRegenerated = true;

    const hash = corpusHash(sourceEntries);
    updateLedger(config.baseDir, (l) => {
      recordContextGeneration(l, { keysAtGeneration: keysNow, corpusHash: String(hash) });
    });
    // Il contesto ha già scritto il suo costo nel ledger: i tetti del giorno lo contano.
    ledger = readLedger(config.baseDir);

    const contextCost = result.usage
      ? costOf({ tokensIn: result.usage.tokensIn, tokensOut: result.usage.tokensOut, connection: llm.connection })
      : undefined;
    appendRunLog(localeDir, {
      action: "context", subject: `${sample.length} sampled`, requests: 1,
      tokensIn: result.usage?.tokensIn ?? 0, tokensOut: result.usage?.tokensOut ?? 0,
      cost: contextCost?.cost, costUnity: llm.connection.costUnity, measured: Boolean(result.usage), now,
    });
  }

  if (contextOnly) {
    const reason = contextRegenerated
      ? undefined
      : llm.context.mode === "off"
        ? "off"
        : unmanagedContext
          ? "unmanaged"
          : undefined;
    return { mode: "context", regenerated: contextRegenerated, text: contextText, reason };
  }

  // --- 4. sceglie le lingue ---
  const availableTags = listLanguageFiles(localeDir).map(tagFromFileName).filter((tag) => tag !== config.sourceLanguage);

  const isRetranslate = retranslateTags !== null && retranslateTags.length > 0;
  let targetTags;
  if (isRetranslate) {
    targetTags = retranslateTags;
  } else {
    targetTags = (llm.languages ?? availableTags).filter((tag) => tag !== config.sourceLanguage);
    if (tags && tags.length > 0) targetTags = targetTags.filter((tag) => tags.includes(tag));
  }

  // --- 5. raccoglie, per lingua, le chiavi da tradurre ---
  const perLanguage = [];
  for (const tag of targetTags) {
    const filePath = path.join(localeDir, languageFileName(tag));
    let oldText;
    let table;
    try {
      oldText = readLanguageText(filePath);
      ({ table } = readLanguageFile(filePath, oldText));
      table ??= {};
    } catch {
      continue; // file di lingua non leggibile: non è compito di questo passo ripararlo
    }

    if (isRetranslate) {
      backupLanguageFile(filePath, languageFileName(tag), oldText, {
        kind: "erased", reason: "--llm-retranslate requested",
      });
    }

    const wantedKeys = isRetranslate
      ? Object.keys(table).filter((key) => key in sourceTable)
      : Object.keys(table).filter((key) => table[key] === null);

    let skippedFailed = 0;
    const keysToTranslate = wantedKeys.filter((key) => {
      if (auto) return true;
      if (failureCount(ledger, tag, key) >= 2) { skippedFailed++; return false; }
      return true;
    });

    // llmSourceText: se il testo è ICU e misto con "%s", il k-esimo "%s" diventa "{k}" prima
    // di uscire verso l'LLM, così un modello che riordina gli argomenti scrive già {k} e
    // compareIcu la trova compatibile col sorgente in "%s" (piano 4.6.3).
    const entries = keysToTranslate
      .map((key) => ({ key, text: llmSourceText(sourceTable[key]) }))
      .filter((entry) => typeof entry.text === "string");

    perLanguage.push({ tag, filePath, table, entries, skippedFailed });
  }

  // Le regole ICU nel prompt costano token solo alle lingue che ne hanno bisogno: quelle le
  // cui voci da tradurre contengono almeno un messaggio ICU (piano 4.6.3).
  const icuByTag = new Map(perLanguage.map(({ tag, entries }) => [
    tag,
    entries.some((e) => isIcuCandidate(e.text))
      ? { cardinal: requiredPluralCategories(tag, false), ordinal: requiredPluralCategories(tag, true) }
      : undefined,
  ]));

  // --- 7. lotti, in token ---
  const systemPromptFor = (tag) =>
    buildTranslateSystemPrompt({ targetTag: tag, sourceTag: config.sourceLanguage, tone: llm.tone, context: contextText, icu: icuByTag.get(tag) });

  // I rapporti: `ratioIn` per modello, `ratioOut` e il ragionamento per chiave per (modello,
  // lingua). Il ledger vince, altrimenti la costante del sistema di scrittura del **sorgente**
  // (primo run: i caratteri della stima d'uscita sono i suoi, vedi costModel.js) e nessun
  // ragionamento. Si leggono da `ledger` a ogni chiamata: i giri dei lotti troncati lo rileggono,
  // e si tarano su quello che il run ha appena misurato.
  const ratioIn = ratiosFor(ledger, modelKey).ratioIn ?? initialRatio(config.sourceLanguage);
  const ratioOutFor = (tag) => ratiosFor(ledger, modelKey, tag).ratioOut ?? initialRatio(config.sourceLanguage);
  const reasoningFor = (tag) => ratiosFor(ledger, modelKey, tag).reasoningPerKey ?? 0;

  // L'overhead O è il prompt di sistema, contesto compreso, in token di input. Vale per i lotti
  // di riparazione allo stesso modo: il loro payload porta anche il `reason`, ma la differenza è piccola.
  // `maxKeys` stringe il soffitto della classe: serve ai lotti che rimandano chiavi troncate.
  const batchesFor = (tag, entries, { maxKeys } = {}) => buildBatches(entries, {
    overheadTokens: systemPromptFor(tag).length / ratioIn,
    modelClass: maxKeys ? { ...modelClass, maxKeys: Math.min(modelClass.maxKeys, maxKeys) } : modelClass,
    ratioIn, ratioOut: ratioOutFor(tag), reasoningPerKey: reasoningFor(tag),
  });

  const languageBatches = perLanguage.map((lang) => ({ tag: lang.tag, batches: batchesFor(lang.tag, lang.entries) }));
  const allBatches = languageBatches.flatMap((lb) =>
    lb.batches.map((batch, i) => ({ tag: lb.tag, batch, n: i + 1 }))
  );

  const totalKeys = perLanguage.reduce((sum, l) => sum + l.entries.length, 0);
  const totalRequests = allBatches.length;
  const incompleteLanguages = perLanguage.filter((l) => l.entries.length > 0).length;

  // --- 8. stima -> guardie -> rapporto -> conferma ---
  const estimate = estimateRun({
    languages: languageBatches.map((lb) => ({
      systemChars: systemPromptFor(lb.tag).length, batches: lb.batches,
      ratioIn, ratioOut: ratioOutFor(lb.tag), reasoningPerKey: reasoningFor(lb.tag),
    })),
  });
  const cost = costOf({ tokensIn: estimate.tokensIn, tokensOut: estimate.tokensOut, connection: llm.connection });

  if (totalKeys === 0) {
    return { mode: "nothing-to-do" };
  }

  const capsCheck = checkCaps({
    estimate: { cost: cost?.cost, tokens: estimate.tokensIn + estimate.tokensOut },
    today: { cost: ledger.costToday, tokens: ledger.tokensToday },
    budget: llm.budget, auto, costUnity: llm.connection.costUnity,
  });
  debug?.write("estimate", {
    tags: targetTags, keys: totalKeys, requests: totalRequests, estimate, cost,
    ratioIn, ratioOut: Object.fromEntries(targetTags.map((tag) => [tag, ratioOutFor(tag)])),
    reasoningPerKey: Object.fromEntries(targetTags.map((tag) => [tag, reasoningFor(tag)])),
    modelClass, skippedFailed: perLanguage.map((l) => ({ tag: l.tag, skipped: l.skippedFailed })),
    capsCheck,
  });
  if (!capsCheck.ok) {
    debug?.write("refused", capsCheck.message);
    return { mode: "refused", message: capsCheck.message, estimate, cost };
  }

  printEstimate({
    connection: llm.connection, incomplete: incompleteLanguages, total: targetTags.length,
    keys: totalKeys, requests: totalRequests,
    tokensIn: estimate.tokensIn, tokensOut: estimate.tokensOut,
    cost, costGuard: llm.costGuard, costUnity: llm.connection.costUnity,
  });

  if (dryRun) {
    return { mode: "dry-run", estimate, cost, totalKeys, totalRequests };
  }

  const confirm = await confirmProceed({ noAsk, cost: cost?.cost, costGuard: llm.costGuard });
  debug?.write("confirm", confirm);
  if (!confirm.ok) {
    debug?.write("refused", confirm.message);
    return { mode: "refused", message: confirm.message, declined: confirm.message === "declined." };
  }
  // --- 9. esegue ---
  // `stopped` è il nome del tetto che ha fermato il run, o `false`. `today` è il totale del
  // giorno all'inizio del run: i tetti giornalieri si confrontano con `today + spent`.
  // `requests` sono le chiamate HTTP vere: lotti, ritentativi, lotti rimandati e riparazioni.
  const runState = { spent: { cost: 0, tokens: 0 }, stopped: false, requests: 0 };
  const todayAtStart = { cost: ledger.costToday, tokens: ledger.tokensToday };

  const resultsByTag = new Map(perLanguage.map((l) => [l.tag, new Map()]));
  const outcomes = []; // { tag, key, status: "filled" | "rejected" | "unknown-key", reason? }
  let measuredTokensIn = 0;
  let measuredTokensOut = 0;
  let measuredReasoningOut = 0;

  // Una riga per connessione, dal vivo su un terminale, e alla fine lo stesso elenco come log,
  // con i costi (requestPanel.js). Primo giro e riparazione nello stesso pannello: sono tutte
  // domande dello stesso run.
  const panel = createRequestPanel({
    sourceTag: config.sourceLanguage, tags: targetTags, traced: debug !== null,
    firstLabel: "", // il blocco è già nominato dalla stima: `LLM` / `⌘ fornitore`
  });
  let notSent = 0; // lotti saltati perché un tetto del budget è stato superato a metà run

  const batchLabel = (kind, tag, n) => `${kind}-${tag}-b${String(n).padStart(2, "0")}`;

  const langByTag = new Map(perLanguage.map((l) => [l.tag, l]));
  const writtenTags = new Set();

  /**
   * Scrive su disco quello che una lingua ha già ottenuto, a ogni lotto e non a fine run: un run
   * interrotto (Ctrl-C, rete, `maxCostPerRun`) perde al più i lotti in volo, non quelli già
   * pagati. Il file si rilegge ogni volta invece di riusare la fotografia del passo 5: nel
   * frattempo una sync (un `npx vitetranslate`, un `vite dev` riavviato) può aver tolto chiavi,
   * o qualcuno averne tradotta una a mano — la chiave sparita non torna, quella già riempita
   * non si sovrascrive (salvo `--llm-retranslate`, che esiste per sovrascrivere). Nessun rischio
   * di ciclo con `vite dev`: il suo watcher sui file di lingua ricarica la pagina, non scrive.
   *
   * @returns {number} le chiavi ancora da tradurre per quella lingua, dopo la scrittura
   */
  const persist = (tag) => {
    const lang = langByTag.get(tag);
    const langMap = resultsByTag.get(tag);
    const stillToDo = (table) => isRetranslate
      ? lang.entries.filter((entry) => !langMap.has(entry.key)).length
      : Object.keys(table).filter((key) => table[key] === null && !langMap.has(key)).length;

    let text;
    let table;
    try {
      text = readLanguageText(lang.filePath);
      ({ table } = readLanguageFile(lang.filePath, text));
    } catch {
      table = undefined;
    }
    // Illeggibile, fuori formato o svuotato proprio adesso: niente scrittura (ricostruirlo dalle
    // sole chiavi di questo run lo mutilerebbe), riprova il lotto dopo o la chiusura del run.
    if (table === undefined) return stillToDo(lang.table);

    const merged = { ...table };
    let changed = false;
    for (const [key, value] of langMap) {
      if (!(key in merged) || merged[key] === value) continue;
      if (!isRetranslate && merged[key] !== null) continue;
      merged[key] = value;
      changed = true;
    }
    if (changed) {
      const writeResult = writeLanguageFileIfChanged({
        filePath: lang.filePath, tag, isSource: false, table: merged, oldText: text,
      });
      if (writeResult.written) writtenTags.add(tag);
    }
    return isRetranslate ? stillToDo(merged) : Object.values(merged).filter((value) => value === null).length;
  };

  // Le chiavi di una risposta troncata che non sono tornate complete: al modello di nuovo, dopo il
  // giro in corso, in lotti di al più metà di quello troncato. Non è la stessa domanda — quella con
  // lo stesso `max_tokens` si troncherebbe di nuovo, ed è per questo che `callModel` non la
  // ritenta —: metà chiavi, circa metà risposta e metà ragionamento. La riparazione no: ha il suo
  // giro unico, e le sue chiavi restano com'erano.
  const pendingSplits = []; // { tag, items, maxKeys }
  let truncatedLeft = 0; // chiavi troncate che in questo run non tornano più al modello
  const splitLater = ({ kind, tag, batch, left }) => {
    if (left.length === 0) return;
    const maxKeys = Math.floor(batch.length / 2);
    if (kind === "repair" || maxKeys < 1) {
      truncatedLeft += left.length;
      return;
    }
    pendingSplits.push({ tag, items: left, maxKeys });
  };

  /**
   * Un lotto: apre la sua riga nel pannello, chiama il modello, e passa la risposta ad `apply`
   * appena arriva — non a fine giro — perché la riga dica subito com'è andata; `apply`
   * restituisce i conteggi di quella riga, `persist` li scrive e dice quante ne mancano alla
   * lingua. Un errore del modello non ferma il run: la riga lo dice, e le chiavi del lotto
   * restano `null`. Una risposta troncata tiene le coppie già chiuse e rimanda le altre
   * (`splitLater`).
   */
  const sendBatch = async ({ kind, tag, batch, userPayload, label, apply }) => {
    if (runState.stopped) {
      notSent++;
      return;
    }
    const request = panel.open({ kind, tag, count: batch.length });
    const systemPrompt = systemPromptFor(tag);
    runState.requests++;

    // Chiamato una volta per tentativo che ha un `usage`: anche uno fallito o troncato si paga, e
    // va nel ledger subito. Quello riuscito ci va dopo `apply`, che sa a quali chiavi la risposta
    // ha dato un valore: la taratura d'uscita si fa su quelle (llmLedger.js, `recordRequest`).
    let paid = null;
    const onUsage = (usage, { ok }) => {
      const attemptCost = ok ? costFor(usage) : recordUsageInLedger({ usage, tag });
      if (ok) paid = { usage, cost: attemptCost };
      runState.spent.cost += attemptCost;
      runState.spent.tokens += usage.tokensIn + usage.tokensOut;
      measuredTokensIn += usage.tokensIn;
      measuredTokensOut += usage.tokensOut;
      measuredReasoningOut += usage.reasoningOut ?? 0;
      runState.stopped ||= shouldStopMidRun({ spent: runState.spent, today: todayAtStart, budget: llm.budget });
    };
    const onRetry = (info) => {
      runState.requests++;
      request.retry(info);
    };

    let result;
    try {
      result = await callModel({
        connection: llm.connection, driver: llm.driver, apiKey,
        systemPrompt, userPayload, maxTokens: modelClass.maxTokens, onUsage,
        debug, label, onRetry,
      });
    } catch (error) {
      const salvaged = error?.truncated && typeof error.partialContent === "string"
        ? salvageTruncated(error.partialContent)
        : {};
      if (error?.truncated) {
        const answered = new Set(Object.keys(salvaged));
        splitLater({ kind, tag, batch, left: batch.filter((item) => !answered.has(item.key)) });
      }
      if (Object.keys(salvaged).length === 0) {
        request.fail(error);
        return;
      }
      // Troncata, ma con coppie complete: si tengono. La taratura no, la risposta non è intera.
      const { filled, rejected, missing, unknown } = apply({ tag, batch, translations: salvaged });
      if (filled > 0) updateLedger(config.baseDir, (l) => { l.keysToday += filled; });
      request.done({ filled, rejected, missing, unknown, truncated: true, remaining: persist(tag) }, error.usage ?? null);
      return;
    }
    const { answeredChars, ...counts } = apply({ tag, batch, translations: result.translations });
    // `keysToday` è solo informazione per `--llm-status`: si scrive dopo `apply`, che sa quante
    // chiavi sono state davvero riempite. Nella stessa scrittura, il tentativo riuscito e la taratura.
    if (paid || counts.filled > 0) {
      updateLedger(config.baseDir, (l) => {
        if (!paid) {
          l.keysToday += counts.filled;
          return;
        }
        recordRequest(l, {
          model: modelKey, tag, usage: paid.usage, cost: paid.cost, keysAdded: counts.filled,
          charsIn: systemPrompt.length + userPayload.length,
          charsOut: answeredChars > 0 ? answeredChars : undefined,
          keys: batch.length,
        });
      });
    }
    request.done({ ...counts, remaining: persist(tag) }, result.usage);
  };

  // Primo giro: fonde ogni valore valido, registra fra gli esiti ogni rifiuto. `answeredChars`
  // è la stima d'uscita (`itemCharsOut`) delle sole voci a cui la risposta ha dato un valore,
  // valido o no: è la grandezza su cui si tara `ratioOut`.
  const applyResult = (r) => {
    const langMap = resultsByTag.get(r.tag);
    const batchKeys = new Set(r.batch.map((item) => item.key));
    const counts = { filled: 0, rejected: 0, missing: 0, unknown: 0, answeredChars: 0 };

    // La forma della risposta si legge in un posto solo, readReply.js: l'oggetto piatto chiesto dal
    // prompt, la forma del payload ricopiata (`{ items: [{ k, t, where }] }`) o un involucro in più.
    // Le chiavi fuori lotto — il nome dell'involucro compreso — sono le stesse sconosciute di prima.
    const read = readReply(r.translations, batchKeys);
    for (const responseKey of read.unknownKeys) {
      outcomes.push({ tag: r.tag, key: responseKey, status: "unknown-key" });
      counts.unknown++;
    }

    for (const item of r.batch) {
      const candidate = read.translations[item.key];
      if (candidate === undefined) { // resta `null`: non è un errore
        counts.missing++;
        continue;
      }
      counts.answeredChars += itemCharsOut(item);

      const validated = validateTranslation({ key: item.key, source: item.text, candidate, targetTag: r.tag });
      if (validated.ok) {
        langMap.set(item.key, validated.value);
        outcomes.push({ tag: r.tag, key: item.key, status: "filled" });
        counts.filled++;
      } else {
        outcomes.push({ tag: r.tag, key: item.key, status: "rejected", reason: validated.reason, candidate });
        counts.rejected++;
      }
    }
    return counts;
  };

  // Riparazione: sostituisce l'esito "rejected" precedente con quello del giro di riparazione,
  // qualunque sia — un solo giro, non due: non si ritenta più oltre questo punto.
  const applyRepair = (r) => {
    const langMap = resultsByTag.get(r.tag);
    const batchKeys = new Set(r.batch.map((item) => item.key));
    const read = readReply(r.translations, batchKeys);
    const counts = {
      filled: 0, rejected: 0, missing: 0,
      unknown: read.unknownKeys.length, answeredChars: 0,
    };

    for (const item of r.batch) {
      const idx = outcomes.findIndex((o) => o.tag === r.tag && o.key === item.key && o.status === "rejected");
      const candidate = read.translations[item.key];
      if (candidate === undefined) {
        counts.missing++;
        continue;
      }
      counts.answeredChars += itemCharsOut(item);

      const validated = validateTranslation({ key: item.key, source: item.text, candidate, targetTag: r.tag });
      if (validated.ok) {
        langMap.set(item.key, validated.value);
        if (idx !== -1) outcomes[idx] = { tag: r.tag, key: item.key, status: "filled" };
        counts.filled++;
      } else {
        if (idx !== -1) outcomes[idx] = { tag: r.tag, key: item.key, status: "rejected", reason: validated.reason, candidate };
        counts.rejected++;
      }
    }
    return counts;
  };

  // `finally`: qualunque cosa succeda, la regione dal vivo si chiude e lascia il suo log — una
  // regione rimasta aperta ridisegnerebbe sé stessa sotto il messaggio d'errore della CLI.
  try {
    await runWithConcurrency(
      allBatches.map(({ tag, batch, n }) => () => sendBatch({
        kind: "translate", tag, batch, userPayload: buildUserPayload(batch),
        label: batchLabel("translate", tag, n), apply: applyResult,
      })),
      llm.connection.maxConcurrency
    );

    // --- 10. le chiavi delle risposte troncate, in lotti più piccoli, nello stesso run ---
    // Un giro dopo l'altro, al più MAX_SPLIT_ROUNDS: ognuno rilegge il ledger, così i lotti nuovi
    // sono tarati anche su quello che il giro prima ha misurato (un modello che ragiona si scopre
    // qui, al primo run), e non superano comunque metà del lotto troncato.
    const splitCounts = new Map();
    for (let round = 1; round <= MAX_SPLIT_ROUNDS && pendingSplits.length > 0 && !runState.stopped; round++) {
      ledger = readLedger(config.baseDir);
      const tasks = pendingSplits.splice(0).flatMap(({ tag, items, maxKeys }) =>
        batchesFor(tag, items, { maxKeys }).map((batch) => {
          const n = (splitCounts.get(tag) ?? 0) + 1;
          splitCounts.set(tag, n);
          return () => sendBatch({
            kind: "split", tag, batch, userPayload: buildUserPayload(batch),
            label: batchLabel("split", tag, n), apply: applyResult,
          });
        }));
      await runWithConcurrency(tasks, llm.connection.maxConcurrency);
    }

    if (debug) {
      for (const tag of new Set(perLanguage.map((l) => l.tag))) {
        const rejected = outcomes
          .filter((o) => o.tag === tag && o.status === "rejected")
          .map((o) => ({ key: o.key, source: sourceTable[o.key], candidate: o.candidate, reason: o.reason }));
        if (rejected.length) debug.write(`validate-${tag}-rejected`, rejected);

        const unknownKeys = outcomes.filter((o) => o.tag === tag && o.status === "unknown-key").map((o) => o.key);
        if (unknownKeys.length) debug.write(`validate-${tag}-unknown-keys`, unknownKeys);
      }
    }

    // --- 11. un solo giro di riparazione, sui soli rifiutati ---
    if (!runState.stopped) {
      const rejectedByTag = new Map();
      for (const outcome of outcomes) {
        if (outcome.status !== "rejected") continue;
        if (!rejectedByTag.has(outcome.tag)) rejectedByTag.set(outcome.tag, []);
        rejectedByTag.get(outcome.tag).push(outcome);
      }

      if (rejectedByTag.size > 0) {
        const repairTasks = [];
        for (const [tag, rejections] of rejectedByTag) {
          const items = rejections.map((rej) => ({
            key: rej.key, text: llmSourceText(sourceTable[rej.key]), where: whereFromKey(rej.key), reason: rej.reason,
          }));
          batchesFor(tag, items).forEach((batch, batchIndex) => {
            const reasons = Object.fromEntries(items.filter((it) => batch.some((b) => b.key === it.key)).map((it) => [it.key, it.reason]));
            repairTasks.push({ tag, batch, reasons, n: batchIndex + 1 });
          });
        }

        await runWithConcurrency(
          repairTasks.map(({ tag, batch, reasons, n }) => () => sendBatch({
            kind: "repair", tag, batch, userPayload: buildRepairUserPayload(batch, reasons),
            label: batchLabel("repair", tag, n), apply: applyRepair,
          })),
          llm.connection.maxConcurrency
        );

        if (debug) {
          for (const tag of rejectedByTag.keys()) {
            const stillRejected = outcomes
              .filter((o) => o.tag === tag && o.status === "rejected")
              .map((o) => ({ key: o.key, source: sourceTable[o.key], candidate: o.candidate, reason: o.reason }));
            if (stillRejected.length) debug.write(`revalidate-${tag}-rejected`, stillRejected);
          }
        }
      }
    }
  } finally {
    if (runState.stopped) {
      const cap = runState.stopped;
      const capValue = cap.startsWith("maxCost")
        ? formatCost(llm.budget[cap], llm.connection.costUnity)
        : formatTokens(llm.budget[cap]);
      panel.note(
        `${cap} (${capValue}) reached: ` +
        (notSent ? `${notSent} request(s) not sent` : "nothing else sent")
      );
    } else {
      // Troncate anche dopo i giri più piccoli: il tetto è stretto per questo modello, e la riga
      // di ogni richiesta lo dice già; qui si dice cosa farne.
      const stillCut = truncatedLeft + pendingSplits.reduce((sum, pending) => sum + pending.items.length, 0);
      if (stillCut > 0) {
        panel.note(`${stillCut} key(s) still truncated: raise modelClass or turn reasoning off`);
      }
    }
    panel.finish();
  }

  // --- 12. le scritture le ha già fatte `persist`, lotto per lotto — mai la lingua sorgente.
  // Un ultimo passaggio raccoglie quelle rimandate perché il file in quel momento non si leggeva.
  const filesWritten = [];
  for (const lang of perLanguage) {
    if (resultsByTag.get(lang.tag).size === 0) continue;
    persist(lang.tag);
    filesWritten.push({ tag: lang.tag, written: writtenTags.has(lang.tag) });
  }

  // --- 13. ledger, runs.log, rapporto ---
  // Costo, token e taratura li ha già scritti `recordRequest`, richiesta per richiesta: qui restano
  // solo i fallimenti di convalida, che si conoscono a fine run.
  updateLedger(config.baseDir, (l) => {
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") recordFailure(l, outcome.tag, outcome.key, outcome.reason);
      else if (outcome.status === "filled") clearFailure(l, outcome.tag, outcome.key);
    }
  });

  const perLanguageReport = perLanguage.map((lang) => {
    const langOutcomes = outcomes.filter((o) => o.tag === lang.tag);
    const filled = langOutcomes.filter((o) => o.status === "filled").length;
    const unknownKeys = langOutcomes.filter((o) => o.status === "unknown-key").length;
    const rejectedByReason = {};
    for (const o of langOutcomes) {
      if (o.status !== "rejected") continue;
      rejectedByReason[o.reason] = (rejectedByReason[o.reason] ?? 0) + 1;
    }
    return { tag: lang.tag, filled, rejectedByReason, unknownKeys, skipped: lang.skippedFailed };
  });

  const finalCost = costOf({ tokensIn: measuredTokensIn, tokensOut: measuredTokensOut, connection: llm.connection });

  printRunResult({
    tokensIn: measuredTokensIn, tokensOut: measuredTokensOut, reasoningOut: measuredReasoningOut,
    cost: finalCost, costUnity: llm.connection.costUnity,
    unknownKeys: perLanguageReport.reduce((sum, l) => sum + l.unknownKeys, 0),
  });

  // Le chiamate fatte davvero, non i lotti pianificati: ritentativi e lotti rimandati compresi.
  appendRunLog(localeDir, {
    action: "translate", subject: targetTags.join(","), requests: runState.requests,
    tokensIn: measuredTokensIn, tokensOut: measuredTokensOut,
    cost: runState.spent.cost || undefined, costUnity: llm.connection.costUnity, measured: true, now,
  });

  debug?.write("summary", {
    perLanguage: perLanguageReport, filesWritten, requests: runState.requests,
    tokensIn: measuredTokensIn, tokensOut: measuredTokensOut, tokensReasoning: measuredReasoningOut,
    cost: finalCost, stoppedOnBudget: Boolean(runState.stopped), stoppedBy: runState.stopped || undefined, durationMs: Date.now() - startedAt,
  });

  return { mode: "done", perLanguage: perLanguageReport, filesWritten, stoppedOnBudget: Boolean(runState.stopped) };
}
