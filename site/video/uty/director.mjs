// Il regista: tre pagine Chrome pilotate da Playwright (VS Code, l'app, le card) e le azioni dello
// storyboard tradotte in tasti e clic. Ogni pagina ha il suo contesto, perché lo zoom
// (deviceScaleFactor) è per contesto e VS Code, l'app e le card ne vogliono uno diverso.
//
// Il puntatore del mouse non compare nello screencast: ne disegniamo uno finto (CURSORE), che
// scivola sul bersaglio prima di ogni clic. Il clic vero arriva subito dopo, nello stesso punto.
import { pathToFileURL } from "node:url";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { azione, resolveRef } from "./storyboard.mjs";

// Impostazioni della copia controllata di VS Code. Le stesse vanno nelle impostazioni Machine
// del server (servers.mjs) e in quelle utente del browser (applicaImpostazioniUtente): le prime
// arrivano prima che la finestra si apra, le seconde coprono lo scope "application".
export const VSCODE_SETTINGS = {
  // "Dark Modern": il nome di oggi. Con quello vecchio ("Default Dark Modern") il server migra il
  // file da sé, e la migrazione può sporcare le impostazioni utente mentre si salvano.
  "workbench.colorTheme": "Dark Modern",
  "workbench.startupEditor": "none",
  "workbench.secondarySideBar.defaultVisibility": "hidden",
  "workbench.tips.enabled": false,
  "workbench.enableExperiments": false,
  "workbench.layoutControl.enabled": false,
  "window.commandCenter": false,
  "chat.disableAIFeatures": true,
  "security.workspace.trust.enabled": false,
  "update.mode": "none",
  "telemetry.telemetryLevel": "off",
  "extensions.ignoreRecommendations": true,
  "git.enabled": false,
  "breadcrumbs.enabled": false,
  "editor.fontSize": 18,
  "editor.lineHeight": 28,
  "editor.minimap.enabled": false,
  "editor.cursorBlinking": "solid",
  "editor.cursorSmoothCaretAnimation": "on",
  "editor.renderLineHighlight": "none",
  "editor.stickyScroll.enabled": false,
  "editor.glyphMargin": false,
  "editor.folding": false,
  // Si scrive a macchina: niente chiusure automatiche né suggerimenti che rubano l'Invio.
  "editor.autoClosingBrackets": "never",
  "editor.autoClosingQuotes": "never",
  "editor.autoSurround": "never",
  "editor.quickSuggestions": { other: false, comments: false, strings: false },
  "editor.suggestOnTriggerCharacters": false,
  "editor.acceptSuggestionOnEnter": "off",
  "editor.parameterHints.enabled": false,
  "editor.hover.delay": 3000,
  "editor.inlineSuggest.enabled": false,
  // Le parole del file come suggerimenti: nei .yml spuntavano mentre si scriveva una traduzione.
  "editor.wordBasedSuggestions": "off",
  "[yaml]": { "editor.quickSuggestions": { other: "off", comments: "off", strings: "off" } },
  "editor.lightbulb.enabled": "off",
  "html.autoClosingTags": false,
  "javascript.autoClosingTags": false,
  "typescript.autoClosingTags": false,
  "files.autoSave": "off",
  "files.exclude": { "**/.stackblitzrc": true, "**/node_modules": true },
  "terminal.integrated.fontSize": 16,
  // Un terminale nuovo mostrava "Show suggestions… Don't show this again" sopra il prompt.
  "terminal.integrated.suggest.enabled": false,
};

// Ritocchi di VS Code nel browser che le impostazioni non coprono.
const VSCODE_CSS = `
  .notifications-toasts, .notification-toast-container { display: none !important; }
  #status\\.workbench\\.keyboardLayout, [id="status.workbench.keyboardLayout"] { display: none !important; }
`;

const FRECCIA = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34"><path d="M2 2 L2 27 L8.5 21 L13 31.5 L17.5 29.5 L13 19.5 L22 19.5 Z" fill="#fff" stroke="#111" stroke-width="2" stroke-linejoin="round"/></svg>`;

// Gira in ogni documento principale delle pagine (non negli iframe: i webview di VS Code sono
// iframe, e il cursore deve stare sopra a tutti). Sopravvive ai reload: è un init script.
const CURSORE = `(() => {
  if (window.top !== window) return;
  const monta = () => {
    if (document.getElementById("__vtCursor")) return;
    const c = document.createElement("div");
    c.id = "__vtCursor";
    c.innerHTML = ${JSON.stringify(FRECCIA)};
    c.style.cssText = "position:fixed;left:-60px;top:-60px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));will-change:left,top";
    const onda = document.createElement("div");
    onda.id = "__vtRipple";
    onda.style.cssText = "position:fixed;left:-60px;top:-60px;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;background:rgba(74,222,128,.55);z-index:2147483646;pointer-events:none;opacity:0;transform:scale(.3)";
    document.documentElement.append(onda, c);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", monta);
  else monta();
})();`;

// Il pennarello (marker.js): init script come il cursore, i segni dell'azione `mark`.
const PENNARELLO = readFileSync(new URL("./marker.js", import.meta.url), "utf8");
// I secondi in cui un segno resta intero, prima che un altro lo attenui, un `unmark` o il taglio:
// meno di così l'occhio non fa in tempo a trovarlo (README.md § "Marks"). La ripresa avvisa.
export const SEGNO_MINIMO = 1.5;

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export class Director {
  constructor(project) {
    this.project = project;
    this.pages = {};
    this.posizioni = {}; // ultima posizione del cursore finto, per pagina
    this.segni = {}; // quanti `mark` per scena: il numero entra nel seme del segno
    this.segnoAperto = null; // l'ultimo segno ancora intero: { quale, pronto } (ms)
    this.segniBrevi = []; // gli avvisi dei segni rimasti meno di SEGNO_MINIMO, per record.mjs
  }

  async launch({ headed = false } = {}) {
    // Il Chrome installato (channel "chrome"): nessun browser da scaricare.
    this.browser = await chromium.launch({
      channel: process.env.VT_VIDEO_CHROME ? undefined : "chrome",
      executablePath: process.env.VT_VIDEO_CHROME || undefined,
      headless: !headed,
      args: ["--hide-scrollbars", "--force-color-profile=srgb", "--disable-features=Translate"],
    });
  }

  async apri(nome, { zoom }) {
    const { width, height } = this.project.output;
    const ctx = await this.browser.newContext({
      viewport: { width: Math.round(width / zoom), height: Math.round(height / zoom) },
      deviceScaleFactor: zoom,
      locale: "en-US",
      colorScheme: "dark",
    });
    await ctx.addInitScript(CURSORE);
    await ctx.addInitScript(PENNARELLO);
    const page = await ctx.newPage();
    this.pages[nome] = page;
    return page;
  }

  // ------------------------------------------------------------ preparazione (non registrata)

  /**
   * Gli errori di una pagina, iframe compresi, nel suo log (log/vscode.log, log/app.log), accanto a
   * quelli del server: una pagina rimasta vuota (React fermo, una webview che non parte)
   * altrimenti non lascia traccia.
   */
  registraErrori(page, file) {
    const registra = (riga) => appendFileSync(join(this.project.paths.log, file), `${new Date().toTimeString().slice(0, 8)} [page] ${riga}\n`);
    page.on("pageerror", (e) => registra(`error: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && registra(`console.error: ${m.text().slice(0, 500)}`));
  }

  async preparaVscode(url, cartella) {
    const page = await this.apri("vscode", { zoom: this.project.zoom.vscode });
    this.registraErrori(page, "vscode.log"); // le webview dell'estensione comprese
    const posix = "/" + cartella.replace(/\\/g, "/");
    const indirizzo = `${url}/?folder=${encodeURIComponent(posix)}`;
    await page.goto(indirizzo);
    await page.waitForSelector(".monaco-workbench", { timeout: 120_000 });
    await pausa(2500);
    // Ricarica: fiducia ed editor di avvio si leggono all'apertura della finestra. Il salvataggio
    // delle impostazioni utente a volte non arriva: VS Code resta in Restricted Mode, e lì
    // l'estensione non gira (il pannello resta vuoto). Si riprova, poi ci si ferma con un perché.
    for (let tentativo = 1; ; tentativo++) {
      await this.applicaImpostazioniUtente();
      await page.goto(indirizzo);
      await page.waitForSelector(".monaco-workbench", { timeout: 120_000 });
      await pausa(2500);
      if (!(await page.locator(".part.statusbar").getByText("Restricted Mode").count())) break;
      if (tentativo === 3) throw new Error("VS Code stays in Restricted Mode: the user settings didn't save, and the extension won't run");
      console.warn(`  ! VS Code in Restricted Mode: the user settings again (${tentativo + 1} of 3)`);
    }
    const css = VSCODE_CSS + (this.project.vscode.style ? readFileSync(resolveRef(this.project.paths, this.project.vscode.style), "utf8") : "");
    await page.addStyleTag({ content: css });
    await this.comando("View: Close All Editors");
    return page;
  }

  async applicaImpostazioniUtente() {
    const page = this.pages.vscode;
    const impostazioni = { ...VSCODE_SETTINGS, ...this.project.vscode.settings };
    await this.comando("Preferences: Open User Settings (JSON)");
    await pausa(1500);
    await page.keyboard.press("Control+A");
    // Su una riga sola: a capo per a capo, l'editor rientrava ogni riga più della precedente.
    await page.keyboard.insertText(JSON.stringify(impostazioni));
    await page.keyboard.press("Control+S");
    await pausa(1200);
  }

  async preparaApp(url) {
    const page = await this.apri("app", { zoom: this.project.zoom.app });
    this.registraErrori(page, "app.log");
    const stile = this.project.app.style;
    if (stile) {
      const css = readFileSync(resolveRef(this.project.paths, stile), "utf8");
      // Init script e non addStyleTag: lo stile deve tornare dopo ogni reload della pagina. Solo
      // sull'app del fixture: i siti che una scena apre con `url` restano come sono.
      await page.context().addInitScript(`(() => {
        if (location.origin !== ${JSON.stringify(new URL(url).origin)}) return;
        const s = document.createElement("style");
        s.textContent = ${JSON.stringify(css)};
        const metti = () => document.head.append(s);
        if (document.head) metti(); else document.addEventListener("DOMContentLoaded", metti);
      })();`);
    }
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    return page;
  }

  async preparaCard() {
    return this.apri("card", { zoom: this.project.zoom.card });
  }

  // ------------------------------------------------------------ palcoscenico

  /**
   * Dimensiona le pagine per lo stage della scena e dice quali registrare, con il loro posto nel
   * video (x, y, larghezza, altezza: pixel del video). compose.mjs le monta lì, una sopra l'altra.
   * @returns {Promise<{ page: string, x: number, y: number, width: number, height: number }[]>}
   */
  async palco(scena) {
    const { width: W, height: H } = this.project.output;
    const wv = pari(W * this.project.split);
    const viste = {
      vscode: [{ page: "vscode", x: 0, y: 0, width: W, height: H }],
      app: [{ page: "app", x: 0, y: 0, width: W, height: H }],
      card: [{ page: "card", x: 0, y: 0, width: W, height: H }],
      split: [
        { page: "vscode", x: 0, y: 0, width: wv, height: H },
        { page: "app", x: wv, y: 0, width: W - wv, height: H },
      ],
      // VS Code a tutto schermo, l'app sopra il suo angolo in alto a destra: sotto resta scoperto il
      // pannello, largo quanto il video. L'altezza dell'app la dà il pannello (pannello()).
      "split-panel": [
        { page: "vscode", x: 0, y: 0, width: W, height: H },
        { page: "app", x: wv, y: 0, width: W - wv, height: null },
      ],
    }[scena.stage].map((v) => ({ ...v }));
    await this.cancellaSegni(); // a ogni taglio la scena riparte pulita
    const dimensiona = (v) => {
      const zoom = this.project.zoom[v.page];
      return this.pages[v.page].setViewportSize({ width: Math.round(v.width / zoom), height: Math.round(v.height / zoom) });
    };
    for (const v of viste) if (v.height != null) await dimensiona(v);
    if (this.pages.vscode) await this.chiudiBarraSecondaria();
    if (scena.stage === "split-panel") {
      await pausa(400); // il relayout di VS Code a tutta larghezza
      viste[1].height = await this.pannello();
      await dimensiona(viste[1]);
    }
    if (scena.url) await this.visita(scena);
    if (scena.stage === "card") {
      // I parametri della scena arrivano alla card come query string (le card in commons/ li leggono).
      const url = pathToFileURL(resolveRef(this.project.paths, scena.card));
      for (const [k, v] of Object.entries(scena.params ?? {})) url.searchParams.set(k, String(v));
      // I credits della musica, una riga per voce: li mostra chi li sa mostrare (outro.html).
      if (this.project.music && !url.searchParams.has("credits")) url.searchParams.set("credits", this.project.music.credits.join("\n"));
      // Le card che seguono la voce aspettano il ciak per partire (commons/clock.js).
      url.searchParams.set("clock", "take");
      await this.pages.card.goto(url.href);
      await this.pages.card.waitForLoadState("networkidle");
    }
    await pausa(400); // il relayout di VS Code dopo il cambio di viewport
    return viste;
  }

  /**
   * Il ciak: lo zero delle card che seguono la voce è l'inizio della clip, non il caricamento.
   * Tra i due passano la pausa di `palco` e l'avvio dei recorder, che non dura mai uguale.
   * LINKED-DATA: commons/clock.js lo riceve come evento "take".
   */
  async ciak(scena) {
    if (scena.stage !== "card") return;
    await this.pages.card.evaluate(() => dispatchEvent(new Event("take")));
  }

  /**
   * Il pannello di VS Code (il terminale) aperto e alto `panel` del video, tirando il suo bordo col
   * mouse: nessuna impostazione ne fissa l'altezza. Restituisce dove comincia, in pixel del video:
   * lì finisce l'app di una scena split-panel.
   */
  async pannello() {
    const page = this.pages.vscode;
    const zoom = this.project.zoom.vscode;
    const parte = page.locator(".part.panel");
    if (!(await parte.isVisible().catch(() => false))) {
      await this.comando("View: Toggle Panel Visibility");
      await parte.waitFor({ state: "visible", timeout: 10_000 });
      await pausa(500);
    }
    const voluta = (this.project.output.height * (1 - this.project.panel)) / zoom;
    let box = await parte.boundingBox();
    if (Math.abs(box.y - voluta) > 2) {
      // Il bordo da tirare: il sash orizzontale sulla cima del pannello.
      const sash = await page.locator(".monaco-sash.horizontal").evaluateAll(
        (ns, b) =>
          ns
            .map((n) => n.getBoundingClientRect())
            .find((r) => r.width > 0 && Math.abs(r.top + r.height / 2 - b.y) < 6 && r.left < b.x + b.width && r.right > b.x),
        box,
      );
      if (!sash) throw new Error("split-panel: no border to drag above VS Code's panel");
      const x = sash.left + sash.width / 2;
      await page.mouse.move(x, sash.top + sash.height / 2);
      await page.mouse.down();
      await page.mouse.move(x, voluta, { steps: 8 });
      await page.mouse.up();
      await pausa(400);
      box = await parte.boundingBox();
      const p = this.posizioni.vscode; // il mouse vero torna dov'è quello finto: niente bordo acceso
      await page.mouse.move(p?.x ?? 0, p?.y ?? 0);
    }
    return pari(box.y * zoom);
  }

  /**
   * La pagina dell'app di una scena con `url`, caricata prima del ciak. `storage` va nel
   * localStorage della sua origine prima che la pagina parta: per esempio la lingua che un sito
   * ricorda, perché ogni scena cominci nella stessa.
   */
  async visita(scena) {
    const page = this.pages.app;
    const url = String(scena.url);
    if (scena.storage) {
      const qui = URL.canParse(page.url()) ? new URL(page.url()).origin : null;
      if (qui !== new URL(url).origin) await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.evaluate((voci) => {
        for (const [k, v] of Object.entries(voci)) localStorage.setItem(k, String(v));
      }, scena.storage);
    }
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    delete this.posizioni.app; // un documento nuovo: il cursore rientra dall'angolo
    // `preload`: la pagina si scorre tutta una volta, uno schermo alla volta, e torna in cima. Le
    // immagini lazy sono caricate e le entrate animate (quelle che partono una volta sola) già fatte:
    // uno scroll veloce nella clip non trova buchi né blocchi a metà.
    if (scena.preload) {
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
          scrollTo({ top: y, behavior: "instant" });
          await new Promise((r) => setTimeout(r, 120));
        }
        scrollTo({ top: 0, behavior: "instant" });
      });
      await page.waitForLoadState("networkidle");
      await pausa(800);
    }
    // `anchor`: la pagina si apre già scorsa fin lì. Al posto di un #hash, che un sito può usare
    // per altro (la landing manda ogni ancora al playground). Poi il tempo delle sue entrate animate.
    if (scena.anchor) {
      const el = await trova(page, { selector: scena.anchor }, 15_000);
      await el.evaluate(scorri, ["start", 0, 0]);
      await pausa(1500);
    }
  }

  // ------------------------------------------------------------ azioni

  /**
   * Esegue una lista `do` nella scena data (lo stage sceglie la pagina di default dei clic).
   * `veloce`: l'avanti veloce di una scena che non si gira (record.mjs), senza segni: contano solo
   * le azioni che cambiano lo stato. Le attese restano: alcune aspettano un reload.
   */
  async esegui(lista, scena = { stage: "vscode" }, { veloce = false } = {}) {
    for (const voce of lista ?? []) {
      const [nome, arg] = azione(voce);
      if (veloce && (nome === "mark" || nome === "unmark")) continue;
      await this[`a_${nome}`](arg, scena);
    }
  }

  paginaDi(arg, scena) {
    const nome = arg?.page ?? (scena.stage === "app" ? "app" : "vscode");
    const page = this.pages[nome];
    if (!page) throw new Error(`no page "${nome}"`);
    return { nome, page };
  }

  async a_wait(secondi) {
    await pausa(Number(secondi) * 1000);
  }

  async a_open(percorso) {
    const page = this.pages.vscode;
    const nome = String(percorso).split("/").pop();
    const casella = await this.quickInput("Control+P");
    await casella.pressSequentially(String(percorso), { delay: 30 });
    // Alla prima ricerca l'indice dei file non è pronto: un Invio a lista vuota non apre niente.
    // `:visible` perché la palette tiene nel DOM anche le righe nascoste dell'ultimo uso.
    await page.locator(".quick-input-widget .monaco-list-row:visible").first().waitFor({ timeout: 15_000 });
    await pausa(300);
    await page.keyboard.press("Enter");
    await page.locator(`.tabs-container .tab.active`).filter({ hasText: nome }).waitFor({ timeout: 10_000 });
    await pausa(500);
  }

  // goto: 9 → fine della riga 9; { line: 9, column: 4 } → lì.
  async a_goto(arg) {
    const page = this.pages.vscode;
    const riga = typeof arg === "object" ? arg.line : arg;
    const colonna = typeof arg === "object" ? arg.column : undefined;
    await page.keyboard.press("Control+G");
    await pausa(250);
    await page.keyboard.type(colonna ? `${riga}:${colonna}` : String(riga), { delay: 40 });
    await page.keyboard.press("Enter");
    if (!colonna) await page.keyboard.press("End");
    await pausa(250);
  }

  // find: "null" → seleziona la prima occorrenza; scrivere dopo la sostituisce.
  async a_find(testo) {
    const page = this.pages.vscode;
    await page.keyboard.press("Control+F");
    await pausa(250);
    await page.keyboard.insertText(String(testo));
    await pausa(300);
    await page.keyboard.press("Escape");
    await pausa(200);
  }

  async a_type(testo) {
    const page = this.pages[typeof testo === "object" ? testo.page : "vscode"];
    const t = typeof testo === "object" ? testo.text : testo;
    await page.keyboard.type(String(t), { delay: this.project.typeDelay });
  }

  async a_key(tasti) {
    const page = this.pages.vscode;
    for (const k of [].concat(tasti)) {
      await page.keyboard.press(k);
      await pausa(120);
    }
  }

  async a_save() {
    await this.pages.vscode.keyboard.press("Control+S");
    await pausa(400);
  }

  async a_command(etichetta) {
    await this.comando(String(etichetta));
  }

  // Un Invio sulla palette esegue la prima voce, qualunque sia: si preme solo se è quella giusta.
  async comando(etichetta) {
    const page = this.pages.vscode;
    const casella = await this.quickInput("Control+Shift+P");
    await casella.pressSequentially(etichetta, { delay: 8 });
    const riga = page.locator(".quick-input-widget .monaco-list-row:visible").first();
    await riga.waitFor({ timeout: 10_000 }).catch(() => {});
    const trovata = (await riga.getAttribute("aria-label").catch(() => null)) ?? "";
    if (!trovata.toLowerCase().startsWith(etichetta.toLowerCase())) {
      await page.keyboard.press("Escape");
      throw new Error(`command "${etichetta}" not in the palette (first entry: "${trovata}")`);
    }
    await page.keyboard.press("Enter");
    await pausa(500);
  }

  // Apre Quick Open o la palette e ne restituisce la casella. Si scrive lì dentro, non "alla
  // tastiera": un webview che finisce di caricarsi si prende il focus, e la palette si chiude.
  async quickInput(tasto) {
    const page = this.pages.vscode;
    const casella = page.locator(".quick-input-widget input:visible").first();
    for (let tentativo = 0; tentativo < 3; tentativo++) {
      await page.keyboard.press(tasto);
      if (await casella.waitFor({ timeout: 3000 }).then(() => true, () => false)) {
        await pausa(250);
        return casella;
      }
      await page.locator(".part.editor").click({ position: { x: 5, y: 5 } }).catch(() => {});
    }
    throw new Error(`${tasto} opened no quick input`);
  }

  // La barra laterale secondaria (quella della chat) si apre da sola qualche secondo dopo
  // l'avvio, anche vuota. Ctrl+Alt+B la alterna: si preme solo se è aperta.
  async chiudiBarraSecondaria() {
    const page = this.pages.vscode;
    if (await page.locator(".part.auxiliarybar:visible").count()) {
      await page.keyboard.press("Control+Alt+B");
      await pausa(300);
    }
  }

  async a_reload(nome) {
    const page = this.pages[nome ?? "app"];
    await page.reload();
    await page.waitForLoadState("networkidle");
  }

  async a_waitFor(arg, scena) {
    const { page } = this.paginaDi(arg, scena);
    await trova(page, arg, (arg.timeout ?? 15) * 1000);
  }

  // scroll: { text | selector, page, block: start | center, offset, time, ease }: la pagina scorre
  // fino al bersaglio in `time` secondi (1), partendo e arrivando piano. `offset`: pixel del video
  // da lasciare sopra il bersaglio (una barra fissa in cima); lo scroll-margin della pagina vale già.
  // `ease`: "cubic" (di serie), o "sine" per le corse lunghe: a metà va al più a 1,6 volte la media,
  // non a 3, e una pagina intera scorre invece di saltare.
  async a_scroll(arg, scena) {
    const { nome, page } = this.paginaDi(arg, scena);
    const curva = arg.ease ?? "cubic";
    if (!["cubic", "sine"].includes(curva)) throw new Error(`scroll: ease is "cubic" or "sine", not "${curva}"`);
    const el = await trova(page, arg, (arg.timeout ?? 15) * 1000);
    const offset = (arg.offset ?? 0) / this.project.zoom[nome];
    await el.evaluate(scorri, [arg.block ?? "start", offset, (arg.time ?? 1) * 1000, curva]);
    await pausa(200);
  }

  // click: { text: "Français", page: app } · { selector: "…" } · { role: button, name: Sync }
  async a_click(arg, scena) {
    const { nome, page } = this.paginaDi(arg, scena);
    const bersaglio = await trova(page, arg, (arg.timeout ?? 15) * 1000);
    const box = await bersaglio.boundingBox();
    if (!box) throw new Error(`click: ${JSON.stringify(arg)} has no box`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.muoviCursore(nome, x, y);
    await page.mouse.click(x, y);
    await page.evaluate(([x, y]) => {
      const o = document.getElementById("__vtRipple");
      if (!o) return;
      o.style.transition = "none";
      Object.assign(o.style, { left: `${x}px`, top: `${y}px`, opacity: "1", transform: "scale(.3)" });
      o.getBoundingClientRect();
      o.style.transition = "transform .45s ease-out, opacity .45s ease-out";
      Object.assign(o.style, { opacity: "0", transform: "scale(1.6)" });
    }, [x, y]);
    await this.aRiposo(page, bersaglio.cornice);
    await pausa(arg.after ? arg.after * 1000 : 350);
  }

  // mark: selection · { text: Sync, shape: box, … }: un segno a mano libera attorno al bersaglio
  // (marker.js). Il bersaglio si cerca come per `click`; `selection` è la selezione dell'editor,
  // per il codice: Monaco spezza il testo in tanti span e cercarlo per testo non regge.
  async a_mark(arg, scena) {
    const y = arg === "selection" ? { selection: true } : (arg ?? {});
    const { nome, page } = y.selection ? { nome: "vscode", page: this.pages.vscode } : this.paginaDi(y, scena);
    let box;
    if (y.selection) box = await selezione(page);
    else if (y.all) box = await unione(page, y, (y.timeout ?? 15) * 1000);
    else {
      const el = await trova(page, y, (y.timeout ?? 15) * 1000);
      box = y.tight ? await soloTesto(el, y.tight === true ? String(y.text) : String(y.tight)) : await sagoma(el);
    }
    if (!box) throw new Error(`mark: ${JSON.stringify(arg)} has no box`);
    const n = (this.segni[scena.id] = (this.segni[scena.id] ?? 0) + 1);
    const opzioni = { ...opzioniSegno(this.project.mark), ...opzioniSegno(y) };
    const rect = { x: box.x, y: box.y, w: box.width, h: box.height };
    const ora = performance.now();
    if ((opzioni.dim ?? 0) < 0.5) this.chiudiSegno(ora); // il nuovo segno spegne quello di prima
    const { draw } = await page.evaluate(
      ([r, o, key, scale]) => window.__vtMark.add(r, o, { key, scale }),
      [rect, opzioni, `${scena.id ?? "setup"}#${n}`, 1 / this.project.zoom[nome]],
    );
    this.segnoAperto = { quale: y.selection ? "selection" : JSON.stringify(y.text ?? y.selector ?? y.name), pronto: ora + draw * 1000 };
    await pausa((y.after ?? draw) * 1000);
  }

  /** Il segno intero finisce adesso (un altro segno, un unmark, il taglio): era rimasto abbastanza? */
  chiudiSegno(quando = performance.now()) {
    const s = this.segnoAperto;
    if (!s) return;
    this.segnoAperto = null;
    const visto = (quando - s.pronto) / 1000;
    if (visto < SEGNO_MINIMO) this.segniBrevi.push(`mark ${s.quale} stays whole ${Math.max(0, visto).toFixed(1)} s: at least ${SEGNO_MINIMO} (a hold, or a later cut)`);
  }

  // unmark · unmark: 0.8: i segni sfumano fino a sparire, in tutte le pagine.
  async a_unmark(arg) {
    this.chiudiSegno();
    const tempo = typeof arg === "number" ? arg : 0.4;
    for (const page of Object.values(this.pages)) await page.evaluate((t) => window.__vtMark?.dim(0, t), tempo).catch(() => {});
    await pausa(tempo * 1000);
  }

  async cancellaSegni() {
    for (const page of Object.values(this.pages)) await page.evaluate(() => window.__vtMark?.clear()).catch(() => {});
  }

  async muoviCursore(nome, x, y) {
    const page = this.pages[nome];
    const { width, height } = page.viewportSize();
    // Prima volta, o dopo un reload: parte dall'angolo in basso a destra.
    const da = this.posizioni[nome] ?? { x: width * 0.82, y: height * 0.86 };
    const distanza = Math.hypot(x - da.x, y - da.y);
    const ms = Math.round(Math.min(900, Math.max(350, distanza * 1.1)));
    await page.evaluate(
      ([da, a, ms]) => {
        const c = document.getElementById("__vtCursor");
        if (!c) return;
        c.style.transition = "none";
        Object.assign(c.style, { left: `${da.x - 2}px`, top: `${da.y - 2}px` });
        c.getBoundingClientRect();
        c.style.transition = `left ${ms}ms cubic-bezier(.45,.05,.25,1), top ${ms}ms cubic-bezier(.45,.05,.25,1)`;
        Object.assign(c.style, { left: `${a.x - 2}px`, top: `${a.y - 2}px` });
      },
      [da, { x, y }, ms],
    );
    // Il mouse vero arriva in un passo solo, quando il finto è quasi arrivato: l':hover del
    // bersaglio si accende come davanti a una persona. A passi, attraversava le webview e ne
    // accendeva i fumetti per strada.
    await pausa(Math.max(0, ms - 150));
    await page.mouse.move(x, y);
    this.posizioni[nome] = { x, y };
  }

  /**
   * Dopo un clic dentro una webview, il mouse vero va su un punto vuoto della stessa (il finto resta
   * dov'è). Il mouse simulato che poi esce dall'iframe non glielo fa sapere: l'iframe tiene per buono
   * l'ultimo punto, e quando lì sotto la pagina si ridisegna (un badge che cambia dopo un
   * salvataggio) Chrome ci rimanda un passaggio del mouse. Il fumetto di quella riga si accendeva
   * da solo, col puntatore altrove; su un punto vuoto non c'è niente da accendere.
   */
  async aRiposo(page, frame) {
    if (!frame || frame === page.mainFrame()) return;
    const vuoto = await frame
      .evaluate(() => {
        const pieno = "[data-tip], .suggerito, [title], a, button, input, select, textarea, summary, [role=button], [role=treeitem], [tabindex], vscode-button, vscode-icon, vscode-tree-item, vscode-badge";
        const W = document.documentElement.clientWidth;
        const H = document.documentElement.clientHeight;
        for (let y = H - 4; y > 4; y -= 12)
          for (let x = 4; x < W - 4; x += 24) if (!document.elementFromPoint(x, y)?.closest(pieno)) return { x, y };
        return null;
      })
      .catch(() => null);
    const iframe = vuoto && (await frame.frameElement().catch(() => null));
    const box = iframe && (await iframe.boundingBox().catch(() => null));
    if (box) await page.mouse.move(box.x + vuoto.x, box.y + vuoto.y);
  }

  /** Fine del setup: il cursore esce di scena, e alla prima mossa rientra dall'angolo. */
  async parcheggia() {
    await this.cancellaSegni();
    for (const [nome, page] of Object.entries(this.pages)) {
      await page.evaluate(() => {
        const c = document.getElementById("__vtCursor");
        if (c) Object.assign(c.style, { transition: "none", left: "-60px", top: "-60px" });
      });
      delete this.posizioni[nome];
      await page.mouse.move(0, 0);
    }
  }

  async close() {
    await this.browser?.close().catch(() => {});
  }
}

const pari = (n) => Math.round(n / 2) * 2;

/**
 * Gira nella pagina (el.evaluate): scorre fino all'elemento `n` in `ms` millisecondi, partendo e
 * arrivando piano (`curva` "cubic" o "sine"); 0 è un salto. `blocco` "start" (sotto lo
 * scroll-margin della pagina, più `offset` px CSS) o "center".
 */
function scorri(n, [blocco, offset, ms, curva = "cubic"]) {
  const r = n.getBoundingClientRect();
  const margine = parseFloat(getComputedStyle(n).scrollMarginTop) || 0;
  const salto = blocco === "center" ? r.top + r.height / 2 - innerHeight / 2 : r.top - margine - offset;
  const da = scrollY;
  const a = Math.max(0, Math.min(da + salto, document.documentElement.scrollHeight - innerHeight));
  if (!(ms > 0)) return scrollTo({ top: a, behavior: "instant" });
  const t0 = performance.now();
  return new Promise((fine) => {
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = curva === "sine" ? (1 - Math.cos(Math.PI * k)) / 2 : k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
      scrollTo({ top: da + (a - da) * e, behavior: "instant" });
      if (k < 1) requestAnimationFrame(passo);
      else fine();
    };
    requestAnimationFrame(passo);
  });
}

/**
 * Le opzioni di `mark` come le scrive lo YAML (README.md § "Marks") nei nomi di marker.js.
 * Le chiavi assenti restano ai default di marker.js.
 */
export function opzioniSegno(y = {}) {
  const o = {};
  if (y.shape != null) o.shape = y.shape;
  if (y.width != null) {
    const [a, b] = [].concat(y.width);
    o.w0 = a;
    o.w1 = b ?? a;
  }
  if (y.dashes === false) o.pen = "brush";
  else if (y.dashes != null) {
    o.pen = "dashes";
    if (typeof y.dashes === "object") {
      if (y.dashes.dash != null) o.dash = y.dashes.dash;
      if (y.dashes.gap != null) o.dashGap = y.dashes.gap;
      if (y.dashes.march != null) o.march = y.dashes.march;
    }
  }
  for (const k of ["color", "opacity", "shadow", "draw", "overshoot", "wobble", "pad", "seed"]) if (y[k] != null) o[k] = y[k];
  if (y.boil === false) o.boil = false;
  else if (typeof y.boil === "number") Object.assign(o, { boil: true, boilAmp: y.boil });
  else if (y.boil && typeof y.boil === "object") {
    o.boil = true;
    if (y.boil.size != null) o.boilAmp = y.boil.size;
    if (y.boil.rate != null) o.boilRate = y.boil.rate;
    if (y.boil.drawings != null) o.boilDrawings = y.boil.drawings;
  }
  if (typeof y.dim === "number") o.dim = y.dim;
  else if (y.dim && typeof y.dim === "object") {
    if (y.dim.to != null) o.dim = y.dim.to;
    if (y.dim.time != null) o.dimTime = y.dim.time;
  }
  return o;
}

/**
 * Il rettangolo da segnare. Un blocco (un paragrafo) è largo quanto la sua colonna: lì conta il
 * testo, misurato con un Range. Bottoni ed elementi in linea tengono il loro riquadro. Lo scarto
 * si misura dentro il frame dell'elemento e si somma al boundingBox, che è già nella pagina.
 */
async function sagoma(el) {
  const box = await el.boundingBox();
  if (!box) return null;
  const testo = await el
    .evaluate((n) => {
      if (!["block", "list-item", "flex", "grid", "table"].includes(getComputedStyle(n).display)) return null;
      const r = document.createRange();
      r.selectNodeContents(n);
      const t = r.getBoundingClientRect(), e = n.getBoundingClientRect();
      return t.width > 0 && t.height > 0 ? { dx: t.left - e.left, dy: t.top - e.top, w: t.width, h: t.height } : null;
    })
    .catch(() => null);
  return testo ? { x: box.x + testo.dx, y: box.y + testo.dy, width: testo.w, height: testo.h } : box;
}

/** Il rettangolo della selezione dell'editor: l'unione dei suoi pezzi, uno per riga. */
async function selezione(page) {
  const pezzi = page.locator(".monaco-editor .selected-text");
  const boxes = [];
  for (let i = 0, n = await pezzi.count(); i < n; i++) {
    const b = await pezzi.nth(i).boundingBox().catch(() => null);
    if (b && b.width > 0 && b.height > 0) boxes.push(b);
  }
  if (!boxes.length) throw new Error('mark: selection: nothing is selected in the editor (a `find` first)');
  const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.width)), y2 = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: x2 - x, height: y2 - y };
}

/**
 * Il primo elemento visibile che corrisponde, cercato nel documento e in tutti i suoi frame
 * (i pannelli dell'estensione sono webview: iframe dentro iframe).
 * Criteri: `selector`, oppure `role` (+ `name`), oppure `text` (`exact: false` per una parte).
 */
/**
 * Il riquadro del solo testo `testo` (mark `tight`): un glifo, una parola, dentro l'elemento
 * trovato o, se lì non c'è, nei suoi antenati più vicini (il 🔸 di una frase può stare un livello
 * sopra). Non trovato: l'elemento intero, come senza `tight`.
 */
async function soloTesto(el, testo) {
  const box = await el.boundingBox();
  if (!box) return null;
  const r = await el
    .evaluate((n, t) => {
      const e = n.getBoundingClientRect();
      for (let su = n, livello = 0; su && livello < 3; su = su.parentElement, livello++) {
        const w = document.createTreeWalker(su, NodeFilter.SHOW_TEXT);
        for (let x = w.nextNode(); x; x = w.nextNode()) {
          const i = x.data.indexOf(t);
          if (i < 0) continue;
          const g = document.createRange();
          g.setStart(x, i);
          g.setEnd(x, i + t.length);
          const b = g.getBoundingClientRect();
          return { dx: b.left - e.left, dy: b.top - e.top, w: b.width, h: b.height };
        }
      }
      return null;
    }, testo)
    .catch(() => null);
  return r && r.w > 0 ? { x: box.x + r.dx, y: box.y + r.dy, width: r.w, height: r.h } : sagoma(el);
}

/**
 * Il rettangolo di tutti gli elementi visibili che corrispondono (mark `all`), nel frame del primo:
 * le celle di una colonna di tabella, per esempio, che nessun elemento contiene da solo.
 */
async function unione(page, arg, ms) {
  const primo = await trova(page, arg, ms);
  const loc = localizza(primo.cornice, arg);
  const boxes = [];
  for (let i = 0, n = await loc.count(); i < n; i++) {
    const el = loc.nth(i);
    const b = (await el.isVisible().catch(() => false)) ? await sagoma(el) : null;
    if (b && b.width > 0 && b.height > 0) boxes.push(b);
  }
  const x = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.width)), y2 = Math.max(...boxes.map((b) => b.y + b.height));
  return { x, y, width: x2 - x, height: y2 - y };
}

function localizza(frame, arg) {
  if (arg.selector) return frame.locator(arg.selector);
  if (arg.role) return frame.getByRole(arg.role, { name: arg.name, exact: arg.exact ?? true });
  return frame.getByText(String(arg.text), { exact: arg.exact ?? true });
}

async function trova(page, arg, ms) {
  const fine = Date.now() + ms;
  while (Date.now() < fine) {
    for (const frame of page.frames()) {
      const loc = localizza(frame, arg);
      const n = await loc.count().catch(() => 0);
      for (let i = 0; i < n; i++) {
        const el = loc.nth(i);
        if (await el.isVisible().catch(() => false)) return Object.assign(el, { cornice: frame }); // il frame: per aRiposo
      }
    }
    await pausa(200);
  }
  throw new Error(`not found within ${ms / 1000} s: ${JSON.stringify(arg)}`);
}
