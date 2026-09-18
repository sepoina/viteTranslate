// Architettura d'insieme: doc/structure.md § "Phase 5 — LLM auto-translation".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.
//
// I testi del peer opzionale `@napi-rs/keyring`, stile babelPeer.js: il keyring non è mai
// obbligatorio, e leggere una stringa da qui non deve diventare il motivo per cui il pacchetto
// viene tirato dentro prima del dovuto — questo file non lo importa, e non fa I/O.

export const KEYRING_PACKAGE = "@napi-rs/keyring";
export const KEYRING_INSTALL_COMMAND = `npm i -D ${KEYRING_PACKAGE}`;
export const KEYRING_SERVICE = "vitetranslate";

export const KEYRING_MISSING = {
  message: `the system keyring needs "${KEYRING_PACKAGE}", which is not installed.`,
  cura: "it is an optional peer dependency, only needed for `--llm-key-set|status|clear`",
  comando: KEYRING_INSTALL_COMMAND,
};

export const KEYRING_NO_BACKEND = {
  message:
    "the system keyring is not available here (no Secret Service — common in Docker, WSL, or a remote SSH session).",
  cura: "use an env var or .env.local instead",
  comando: "",
};

/** Il guasto in una riga sola, cura e comando compresi (quando c'è un comando). */
export const keyringUnaRiga = (guasto) =>
  guasto.comando ? `${guasto.message} ${guasto.cura}: \`${guasto.comando}\`.` : `${guasto.message} ${guasto.cura}.`;
