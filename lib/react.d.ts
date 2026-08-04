// Architettura d'insieme: doc/structure.md § "Distribuzione del pacchetto".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/// <reference path="./virtual.d.ts" />

import type { FC, ReactNode } from 'react';

/**
 * Valori che sostituiscono i `%s`, in ordine. Uno scalare vale come lista di un elemento;
 * un segnaposto rimasto senza valore diventa `[?]`. Un argomento può essere un nodo React.
 */
export type TranslateArgs = unknown | readonly unknown[];

/** La forma a oggetto: testo e argomenti in un valore solo. */
export interface TranslateObjectForm {
  t: string;
  a?: TranslateArgs;
}

export interface TranslateProps {
  /**
   * Il testo marcato, la forma compatta `[testo, ...argomenti]` o la forma a oggetto
   * `{ t, a }`. Alternativo a `children` e a `o`: usarne più di uno è un errore.
   */
  t?: string | readonly [string, ...unknown[]] | TranslateObjectForm;
  /** Argomenti per i `%s`. Non ammesso quando `t` porta già gli argomenti con sé. */
  a?: TranslateArgs;
  /**
   * La forma a oggetto `{ t, a }`, per chi ha testo e argomenti già impacchettati insieme —
   * è come passarli separatamente. Accetta anche le altre forme; alternativa a `t`.
   */
  o?: string | readonly [string, ...unknown[]] | TranslateObjectForm;
  /** Il testo marcato, come figlio. Alternativo a `t`. */
  children?: ReactNode;
}

/**
 * Rende una stringa marcata con `_%_..._%_`, risolvendola nella lingua corrente.
 *
 * ```tsx
 * <Translate>_%_Benvenuto_%_</Translate>
 * <Translate t={['_%_Ciao %s_%_', nome]} />
 * <Translate t="_%_Ciao %s_%_" a={[nome]} />
 * <Translate o={{ t: '_%_Ciao %s_%_', a: [nome] }} />
 * ```
 *
 * Un testo **non** marcato non è un errore: viene reso così com'è, preceduto in sviluppo dal
 * carattere `errorSolve.beginCharMalformed`. È il caso dei dati di dominio — un numero di
 * telefono, una descrizione che arriva dal server — che passano di qui senza doversi
 * annunciare.
 */
export declare const Translate: FC<TranslateProps>;

export interface TranslateContainerProps {
  /**
   * Tag BCP 47 iniziale. Default: la prima lingua precaricata — `preloadedLanguages[0]`, o la
   * `sourceLanguage` se non ne è stata dichiarata nessuna. È la stessa in sviluppo e in build,
   * ed essendo già in bundle il primo render non sospende mai.
   *
   * Passando una lingua non precaricata l'app funziona, ma il primo render attende il chunk:
   * il container lo segnala in console (anche in produzione, dove l'insieme delle precaricate
   * è diverso da quello di sviluppo).
   */
  initialLanguage?: string;
  /** Mostrato via Suspense mentre una lingua non precaricata si carica. Default: `null`. */
  fallback?: ReactNode;
  /** Esposto da `useTranslateLanguage()`. */
  debug?: boolean;
  children?: ReactNode;
}

/** Provider della lingua corrente, con il proprio boundary Suspense. Va sopra l'albero tradotto. */
export declare const TranslateContainer: FC<TranslateContainerProps>;

export interface ProposeNewLanguageOptions {
  /** Tag BCP 47 della lingua richiesta. */
  lang: string;
  /** Chiamata a inizio caricamento, solo se `lang` è una lingua esistente. */
  onStart?: () => void;
  /** Chiamata a fine caricamento con l'esito reale. */
  onDone?: (isOk: boolean) => void;
  /** Chiamata al posto del log di default in caso di errore. */
  onError?: (info: { error: Error; inexistID: string }) => void;
}

export interface TranslateLanguageInfo {
  /** Tag BCP 47. */
  readonly tag: string;
  /** Nome della lingua nella lingua stessa (autonimo), calcolato a sync-time. */
  readonly languageName: string;
}

/**
 * `readonly` non è decorativo: a runtime l'oggetto è congelato, ed è condiviso da tutta
 * l'app. Scriverci dentro lancia un TypeError, quindi TypeScript segnala a compile time
 * ciò che comunque fallirebbe. Per riordinare o filtrare, lavorare su una copia
 * (`[...languages]`).
 */
export interface UseTranslateLanguageResult {
  /** Lingua corrente; `undefined` fuori da `<TranslateContainer>`. */
  readonly id: string | undefined;
  readonly debug: boolean;
  /** Lingue trovate in `localeDir`, lingua sorgente per prima. */
  readonly languages: readonly TranslateLanguageInfo[];
  readonly sourceLanguage: string;
  /** Cambio lingua a runtime. Fuori da `<TranslateContainer>` è inerte. */
  readonly proposeNewLanguage: (options: ProposeNewLanguageOptions) => void;
}

/**
 * Tutto ciò che serve a un selettore di lingua. L'oggetto restituito è referenzialmente
 * stabile, quindi si può mettere in una lista di dipendenze.
 */
export declare function useTranslateLanguage(): UseTranslateLanguageResult;

/**
 * Restituisce `ts(t, args?)`, che risolve una stringa marcata in una **stringa** — per le
 * prop DOM che non accettano nodi (`placeholder`, `aria-label`, `title`). Un'eventuale voce
 * con markup viene appiattita a solo testo.
 *
 * Accetta le stesse forme di `<Translate>`: stringa, tupla `[testo, ...args]` e oggetto
 * `{ t, a }`.
 */
export declare function useTranslateToString(): (
  t: string | readonly [string, ...unknown[]] | TranslateObjectForm,
  a?: TranslateArgs
) => string;

/**
 * Converte una stringa con HTML elementare in nodi React, senza `dangerouslySetInnerHTML`.
 * Riconosce solo `<b> <strong> <i> <em> <u> <small> <code> <br> <hr> <wbr>` e le entità;
 * ogni altro tag viene sciolto conservandone il contenuto e nessun attributo sopravvive.
 * Richiede il DOM: senza `document` restituisce la stringa di partenza.
 */
export declare function basicHtmlToNodes(text: string, args?: TranslateArgs): ReactNode;

/** Versione del pacchetto installato, inlineata a build time. */
export declare const version: string;
