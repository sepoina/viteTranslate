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
import readReply from "./readReply.js";
import { estimateRun, costOf, formatCost } from "./costModel.js";
import { checkNumericCaps, checkCI, confirmProceed, shouldStopMidRun } from "./budgetGuard.js";
import {
  readLedger, updateLedger, recordUsage, recordFailure, clearFailure, failureCount,
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

  const ledger = readLedger(config.baseDir);

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
      result = await callModel({
        connection: llm.connection, driver: llm.driver, apiKey,
        systemPrompt: SYSTEM_CONTEXT, userPayload, mode: "context",
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

    const entries = keysToTranslate
      .map((key) => ({ key, text: sourceTable[key] }))
      .filter((entry) => typeof entry.text === "string");

    perLanguage.push({ tag, filePath, table, oldText, entries, skippedFailed });
  }

  // --- 7. lotti ---
  const languageBatches = perLanguage.map((lang) => ({ tag: lang.tag, batches: buildBatches(lang.entries) }));
  const allBatches = languageBatches.flatMap((lb) =>
    lb.batches.map((batch, i) => ({ tag: lb.tag, batch, n: i + 1 }))
  );

  const totalKeys = perLanguage.reduce((sum, l) => sum + l.entries.length, 0);
  const totalRequests = allBatches.length;
  const incompleteLanguages = perLanguage.filter((l) => l.entries.length > 0).length;

  const systemPromptFor = (tag) =>
    buildTranslateSystemPrompt({ targetTag: tag, sourceTag: config.sourceLanguage, tone: llm.tone, context: contextText });

  // --- 8. stima -> guardie -> rapporto -> conferma ---
  const allItems = allBatches.flatMap((b) => b.batch);
  const ratios = llm.connection.model ? ratiosFor(ledger, llm.connection.model) : undefined;
  const systemChars = targetTags.length > 0 ? systemPromptFor(targetTags[0]).length : 0;

  const estimate = estimateRun({
    items: allItems, contextChars: contextText ? contextText.length : 0,
    systemChars, nBatch: allBatches.length, ratios,
  });
  const cost = costOf({ tokensIn: estimate.tokensIn, tokensOut: estimate.tokensOut, connection: llm.connection });

  if (totalKeys === 0) {
    return { mode: "nothing-to-do" };
  }

  const capsCheck = checkNumericCaps({
    keys: totalKeys, requests: totalRequests, chars: estimate.charsIn, cost: cost?.cost,
    keysToday: ledger.keysToday, budget: llm.budget, auto, costUnity: llm.connection.costUnity,
  });
  debug?.write("estimate", {
    tags: targetTags, keys: totalKeys, requests: totalRequests, estimate, cost, ratios,
    skippedFailed: perLanguage.map((l) => ({ tag: l.tag, skipped: l.skippedFailed })),
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
  const runState = { costSoFar: 0, stopped: false };
  const applyUsage = (usage) => {
    if (!usage || llm.connection.costMillionInput == null) return;
    const batchCost = costOf({ tokensIn: usage.tokensIn, tokensOut: usage.tokensOut, connection: llm.connection });
    if (!batchCost) return;
    runState.costSoFar += batchCost.cost;
    if (shouldStopMidRun({ costSoFar: runState.costSoFar, maxCostPerRun: llm.budget.maxCostPerRun })) {
      runState.stopped = true;
    }
  };

  const resultsByTag = new Map(perLanguage.map((l) => [l.tag, new Map()]));
  const outcomes = []; // { tag, key, status: "filled" | "rejected" | "unknown-key", reason? }
  let measuredTokensIn = 0;
  let measuredTokensOut = 0;

  // Una riga per connessione, dal vivo su un terminale, e alla fine lo stesso elenco come log,
  // con i costi (requestPanel.js). Primo giro e riparazione nello stesso pannello: sono tutte
  // domande dello stesso run.
  const panel = createRequestPanel({
    sourceTag: config.sourceLanguage, tags: targetTags, traced: debug !== null,
    firstLabel: "", // il blocco è già nominato dalla stima: `LLM` / `⌘ fornitore`
  });
  let notSent = 0; // lotti saltati perché `maxCostPerRun` è stato superato a metà run

  const batchLabel = (kind, tag, n) => `${kind}-${tag}-b${String(n).padStart(2, "0")}`;

  /**
   * Un lotto: apre la sua riga nel pannello, chiama il modello, e passa la risposta ad `apply`
   * appena arriva — non a fine giro — perché la riga dica subito com'è andata; `apply`
   * restituisce i conteggi di quella riga. Un errore del modello non ferma il run: la riga lo
   * dice, e le chiavi del lotto restano `null`.
   */
  const sendBatch = async ({ kind, tag, batch, userPayload, label, apply }) => {
    if (runState.stopped) {
      notSent++;
      return;
    }
    const request = panel.open({ kind, tag, count: batch.length });
    let result;
    try {
      result = await callModel({
        connection: llm.connection, driver: llm.driver, apiKey,
        systemPrompt: systemPromptFor(tag), userPayload,
        debug, label, onRetry: request.retry,
      });
    } catch (error) {
      request.fail(error);
      return;
    }
    applyUsage(result.usage);
    if (result.usage) { measuredTokensIn += result.usage.tokensIn; measuredTokensOut += result.usage.tokensOut; }
    request.done(apply({ tag, batch, translations: result.translations }), result.usage);
  };

  // Primo giro: fonde ogni valore valido, registra fra gli esiti ogni rifiuto.
  const applyResult = (r) => {
    const langMap = resultsByTag.get(r.tag);
    const batchKeys = new Set(r.batch.map((item) => item.key));
    const counts = { filled: 0, rejected: 0, missing: 0, unknown: 0 };

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

      const validated = validateTranslation({ key: item.key, source: item.text, candidate });
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
      unknown: read.unknownKeys.length,
    };

    for (const item of r.batch) {
      const idx = outcomes.findIndex((o) => o.tag === r.tag && o.key === item.key && o.status === "rejected");
      const candidate = read.translations[item.key];
      if (candidate === undefined) {
        counts.missing++;
        continue;
      }

      const validated = validateTranslation({ key: item.key, source: item.text, candidate });
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
            key: rej.key, text: sourceTable[rej.key], where: whereFromKey(rej.key), reason: rej.reason,
          }));
          buildBatches(items).forEach((batch, batchIndex) => {
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
      panel.note(
        `maxCostPerRun (${formatCost(llm.budget.maxCostPerRun, llm.connection.costUnity)}) reached: ` +
        (notSent ? `${notSent} request(s) not sent` : "nothing else sent")
      );
    }
    panel.finish();
  }

  // --- 12. fonde e scrive, per lingua — mai la lingua sorgente ---
  const filesWritten = [];
  for (const lang of perLanguage) {
    const langMap = resultsByTag.get(lang.tag);
    if (langMap.size === 0) continue;

    const mergedTable = { ...lang.table };
    for (const [key, value] of langMap) mergedTable[key] = value;

    const writeResult = writeLanguageFileIfChanged({
      filePath: lang.filePath, tag: lang.tag, isSource: false, table: mergedTable, oldText: lang.oldText,
    });
    filesWritten.push({ tag: lang.tag, written: writeResult.written });
  }

  // --- 13. ledger, runs.log, rapporto ---
  updateLedger(config.baseDir, (l) => {
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") recordFailure(l, outcome.tag, outcome.key, outcome.reason);
      else if (outcome.status === "filled") clearFailure(l, outcome.tag, outcome.key);
    }
    if (llm.connection.model) {
      recordUsage(l, {
        model: llm.connection.model,
        keysAdded: outcomes.filter((o) => o.status === "filled").length,
        cost: runState.costSoFar,
        charsIn: estimate.charsIn, tokensIn: measuredTokensIn || estimate.tokensIn,
        charsOut: estimate.charsOut, tokensOut: measuredTokensOut || estimate.tokensOut,
      });
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

  const finalCost = runState.costSoFar > 0 || llm.connection.costMillionInput != null
    ? costOf({ tokensIn: measuredTokensIn, tokensOut: measuredTokensOut, connection: llm.connection })
    : undefined;

  printRunResult({
    tokensIn: measuredTokensIn, tokensOut: measuredTokensOut,
    cost: finalCost, costUnity: llm.connection.costUnity,
    unknownKeys: perLanguageReport.reduce((sum, l) => sum + l.unknownKeys, 0),
  });

  appendRunLog(localeDir, {
    action: "translate", subject: targetTags.join(","), requests: totalRequests,
    tokensIn: measuredTokensIn, tokensOut: measuredTokensOut,
    cost: runState.costSoFar || undefined, costUnity: llm.connection.costUnity, measured: true, now,
  });

  debug?.write("summary", {
    perLanguage: perLanguageReport, filesWritten, tokensIn: measuredTokensIn, tokensOut: measuredTokensOut,
    cost: finalCost, stoppedOnBudget: runState.stopped, durationMs: Date.now() - startedAt,
  });

  return { mode: "done", perLanguage: perLanguageReport, filesWritten, stoppedOnBudget: runState.stopped };
}
