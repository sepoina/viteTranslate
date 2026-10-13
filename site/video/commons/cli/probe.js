// La sonda: in ogni documento di ogni pagina (iframe e webview comprese) ascolta quello che arriva
// davvero (puntatore, focus, tasti, mutazioni, overlay, spostamenti del layout) e lo manda a lotti a
// probe.mjs, tramite la binding __vtProbeSend. Non disegna e non cambia niente: ascolta soltanto.
// LINKED-DATA: i tipi di evento (k) e i loro campi sono quelli che legge Sonde in commons/cli/probe.mjs e
// che README.md § "Probes" descrive; SOPRA e APERTI sono gli overlay di README.md § "On stage".
(() => {
  if (window.__vtProbe) return;
  const ora = () => performance.timeOrigin + performance.now(); // ms epoch, confrontabili con Date.now() di node
  const coda = [];
  let timer = null;
  const invia = () => {
    timer = null;
    if (!coda.length || typeof window.__vtProbeSend !== "function") return;
    const lotto = coda.splice(0);
    window.__vtProbeSend(lotto)?.catch?.(() => {});
    for (const e of lotto) e.partito = true; // già serializzato: un treno di tasti ne apre un altro
  };
  const metti = (e, subito = false) => {
    coda.push({ t: ora(), ...e });
    if (coda.length > 2000) coda.splice(0, coda.length - 2000); // nessuna binding: non si accumula all'infinito
    if (subito) invia();
    else timer ??= setTimeout(invia, 100);
    return coda[coda.length - 1];
  };
  // I nostri strati (cursore, onda, segni) non contano come mutazioni della pagina.
  const NOSTRI = "#__vtCursor, #__vtRipple, #__vtMarks";
  const taglia = (s, n = 40) => {
    const t = String(s).replace(/\s+/g, " ").trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  };
  // Il testo di un nodo, i primi caratteri: innerText su un contenitore grande (il workbench intero)
  // costerebbe un layout a ogni passaggio del mouse.
  const testo = (n) => {
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
    let s = "";
    for (let x = w.nextNode(); x && s.length < 60; x = w.nextNode()) s += ` ${x.data}`;
    return taglia(s);
  };
  // tag#id.cls[data-cmd|data-open|data-value|aria-label|role] "testo (40)"
  const descrivi = (n) => {
    if (!n) return "null";
    if (n.nodeType !== 1) return n.nodeName;
    let d = n.localName + (n.id ? `#${n.id}` : "") + [...n.classList].slice(0, 3).map((c) => `.${c}`).join("");
    for (const a of ["data-cmd", "data-open", "data-value", "aria-label", "role"]) {
      const v = n.getAttribute(a);
      if (v != null) d += `[${a}="${taglia(v)}"]`;
    }
    const t = testo(n);
    return t ? `${d} "${t}"` : d;
  };
  const scrivibile = (n) =>
    !!n && (!!n.closest?.(".monaco-editor, .xterm") || n.isContentEditable || ["input", "textarea"].includes(n.localName));

  // Il puntatore: dove arriva davvero il clic, e se è il bersaglio che il regista ha marcato.
  const suPuntatore = (e) => {
    const m = e.target.closest?.("[data-vt-target]");
    metti({ k: e.type, x: e.clientX, y: e.clientY, target: descrivi(e.target), mirato: m?.getAttribute("data-vt-target") ?? null }, true);
  };
  let sotto = null;
  const suSopra = (e) => {
    if (e.target === sotto) return;
    sotto = e.target;
    metti({ k: "hover", target: descrivi(e.target) });
  };

  // Il focus e i tasti.
  const suFocus = (e) => metti({ k: "focus", target: descrivi(e.target), scrivibile: scrivibile(e.target) }, true);
  const suFinestra = (e) => e.target === window && metti({ k: "window", focus: e.type === "focus" }, true);
  let tasti = null; // un treno di tasti sullo stesso bersaglio: un evento solo, finché non parte
  const suTasto = (e) => {
    const target = descrivi(e.target);
    if (tasti && !tasti.partito && tasti.target === target && ora() - tasti.ultimo < 300) {
      tasti.n++;
      tasti.ultimo = ora();
      return;
    }
    tasti = metti({ k: "keys", target, scrivibile: scrivibile(e.target), n: 1, primo: e.key, ultimo: ora() });
  };

  // Le mutazioni, a secchi da 100 ms: quando la pagina reagisce e quando torna ferma.
  let secchio = null;
  const osservatore = new MutationObserver((ms) => {
    const vere = ms.filter((m) => !(m.target.closest?.(NOSTRI) || m.target.parentElement?.closest?.(NOSTRI)) && m.attributeName !== "data-vt-target");
    if (!vere.length) return;
    if (!secchio) {
      secchio = metti({ k: "dom", n: 0 });
      setTimeout(() => (secchio = null), 100);
    }
    secchio.n += vere.length;
  });

  // In ascolto sul documento di adesso. Le webview di VS Code scrivono il loro contenuto con
  // document.open/write, che cancella ogni listener della finestra: quando l'elemento radice cambia,
  // si rimonta tutto (togliere prima, così non si conta due volte).
  const ASCOLTA = [["pointerdown", suPuntatore], ["click", suPuntatore], ["mouseover", suSopra], ["focusin", suFocus], ["blur", suFinestra, false], ["focus", suFinestra, false], ["keydown", suTasto]];
  let armato = null;
  const arma = () => {
    armato = document.documentElement;
    for (const [tipo, fn, cattura = true] of ASCOLTA) {
      removeEventListener(tipo, fn, cattura);
      addEventListener(tipo, fn, cattura);
    }
    osservatore.disconnect();
    osservatore.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  };
  arma();

  // Gli spostamenti del layout e i blocchi lunghi del main thread.
  try {
    new PerformanceObserver((l) => {
      for (const s of l.getEntries()) metti({ k: "shift", value: +s.value.toFixed(4), da: s.sources?.map((x) => descrivi(x.node)) });
    }).observe({ type: "layout-shift", buffered: false });
    new PerformanceObserver((l) => {
      for (const x of l.getEntries()) metti({ k: "long", ms: Math.round(x.duration) });
    }).observe({ type: "longtask", buffered: false });
  } catch {}

  // Gli overlay: fumetti e suggerimenti (mai voluti in una clip), e ciò che non deve restare aperto
  // al taglio. Ogni 250 ms, solo i cambiamenti.
  const SOPRA = ".monaco-hover:not(.hidden), .suggest-widget.visible, .fumetto.acceso, [role=tooltip]"; // DA VERIFICARE (README.md § "Probes")
  const APERTI = ".find-widget.visible, .quick-input-widget, .context-view .monaco-menu"; // DA VERIFICARE
  const visibili = (sel) =>
    [...document.querySelectorAll(sel)]
      .filter((n) => {
        const r = n.getBoundingClientRect();
        const cs = getComputedStyle(n);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      })
      .map(descrivi);
  let prima = "";
  setInterval(() => {
    if (document.documentElement !== armato) {
      const vecchio = armato;
      arma();
      if (vecchio) metti({ k: "load", url: location.href.slice(0, 120), riarmata: true }, true);
    }
    const stato = { sopra: visibili(SOPRA), aperti: visibili(APERTI) };
    const s = JSON.stringify(stato);
    if (s !== prima) {
      prima = s;
      metti({ k: "overlay", ...stato }, true);
    }
  }, 250);

  metti({ k: "load", url: location.href.slice(0, 120) }, true);
  window.__vtProbe = { descrivi, scrivibile };
})();
