// Strato 8: apiKey.js — catena di risoluzione della chiave API.
//
//   node test/list/llmApiKey.test.mjs
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveApiKey, parseDotEnv, redact, keyringStatus } from "../../lib/dev/llm/apiKey.js";

let fail = 0;
const eq = (nome, atteso, ottenuto) => {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) fail++;
  console.log(ok ? "  ok  " : "  KO  ", nome.padEnd(52), "->", JSON.stringify(ottenuto), ok ? "" : `(atteso ${JSON.stringify(atteso)})`);
};

const temporanee = [];
function progetto() {
  const dir = mkdtempSync(join(tmpdir(), "vt-apikey-"));
  temporanee.push(dir);
  return dir;
}

const ENV_NAME = "VITETRANSLATE_API_KEY";
const connection = { apiKeyEnv: ENV_NAME };

// T50 — ordine della catena: env vince su .env.local, che vince su .env
console.log("\n== T50 ordine della catena ==");
{
  const baseDir = progetto();
  writeFileSync(join(baseDir, ".env.local"), `${ENV_NAME}=from-local\n`);
  writeFileSync(join(baseDir, ".env"), `${ENV_NAME}=from-env-file\n`);

  process.env[ENV_NAME] = "from-process-env";
  const r1 = await resolveApiKey({ connection, baseDir });
  eq("env vince su tutto", "from-process-env", r1.key);
  eq("from riporta la sorgente giusta", `env:${ENV_NAME}`, r1.from);
  delete process.env[ENV_NAME];

  const r2 = await resolveApiKey({ connection, baseDir });
  eq(".env.local vince su .env", "from-local", r2.key);
  eq("from .env.local", ".env.local", r2.from);

  unlinkSync(join(baseDir, ".env.local"));
  const r3 = await resolveApiKey({ connection, baseDir });
  eq(".env come ultimo ripiego", "from-env-file", r3.key);
  eq("from .env", ".env", r3.from);
}

// T51 — parsing di .env
console.log("\n== T51 parsing .env ==");
{
  const parsed = parseDotEnv([
    "# a comment",
    "",
    'export FOO="bar baz"',
    "BAR='single'",
    "BAZ=plain",
    "  # indented comment",
  ].join("\n"));
  eq("export tollerato", "bar baz", parsed.FOO);
  eq("virgolette singole tolte", "single", parsed.BAR);
  eq("senza virgolette", "plain", parsed.BAZ);
  eq("righe vuote/commenti ignorati", 3, Object.keys(parsed).length);
}

// T52 — chiave assente: errore che nomina tutti e tre i posti
console.log("\n== T52 chiave assente ==");
{
  const baseDir = progetto();
  delete process.env[ENV_NAME];
  let message = "";
  try {
    await resolveApiKey({ connection, baseDir });
  } catch (e) {
    message = e.message;
  }
  eq("nomina la env var", true, message.includes(ENV_NAME));
  eq("nomina .env.local", true, message.includes(".env.local"));
  eq("nomina il keyring", true, message.toLowerCase().includes("keyring"));
}

// T53 — redact toglie la chiave da un testo
console.log("\n== T53 redact ==");
eq("chiave rimossa", "Authorization: Bearer «redacted» failed", redact("Authorization: Bearer sk-secret123 failed", "sk-secret123"));
eq("nessuna chiave -> testo invariato", "plain text", redact("plain text", ""));

// T54 — keyring assente: il ramo si salta in silenzio
console.log("\n== T54 keyring assente ==");
{
  const status = await keyringStatus(ENV_NAME);
  eq("available false quando il pacchetto non è installato", false, status.available);
  eq("present false", false, status.present);
}
{
  // Nessuna .env* e nessuna env var: il fallimento del keyring non deve mai lanciare da solo,
  // deve solo far arrivare la catena fino all'errore finale "non trovata".
  const baseDir = progetto();
  let lanciatoDalKeyring = false;
  try {
    await resolveApiKey({ connection, baseDir });
  } catch (e) {
    lanciatoDalKeyring = !e.message.includes(ENV_NAME); // un errore "diverso" da quello atteso
  }
  eq("il fallimento del keyring non produce un errore diverso da quello atteso", false, lanciatoDalKeyring);
}

for (const dir of temporanee) rmSync(dir, { recursive: true, force: true });

console.log(fail ? `\n${fail} asserzioni fallite` : "\ntutto ok");
process.exit(fail ? 1 : 0);
