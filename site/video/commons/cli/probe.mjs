// Le sonde lato node: ricevono gli eventi di probe.js da ogni frame, li tengono (gli ultimi 20.000)
// e li scrivono in log/probe.jsonl; il regista ci chiede cosa è successo dopo un'azione.
// LINKED-DATA: i campi degli eventi sono quelli di probe.js; README.md § "Probes".
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const SONDA = readFileSync(new URL("./probe.js", import.meta.url), "utf8");
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export class Sonde {
  constructor(file) {
    this.file = file;
    this.eventi = [];
    this.azioni = [];
    this.scena = "setup";
    writeFileSync(file, ""); // un diario per ripresa
  }
  /** In un contesto nuovo, prima di aprirne le pagine: la binding e lo script in ogni frame. */
  async collega(ctx, pagina) {
    await ctx.exposeBinding("__vtProbeSend", ({ frame }, lotto) => this.ricevi(pagina, frame, lotto));
    await ctx.addInitScript(SONDA);
  }
  ricevi(pagina, frame, lotto) {
    const f = frame?.parentFrame() ? frame.url().replace(/\?.*$/, "").slice(-60) || frame.name() : "top";
    const righe = [];
    for (const e of lotto) {
      const r = { ...e, pagina, frame: f, scena: this.scena };
      this.eventi.push(r);
      righe.push(JSON.stringify(r));
    }
    if (this.eventi.length > 20_000) this.eventi.splice(0, this.eventi.length - 20_000);
    appendFileSync(this.file, righe.join("\n") + "\n");
  }
  /** Una riga del regista nel diario: l'azione, quando comincia e quando finisce. */
  nota(r) {
    const riga = { t: Date.now(), k: "action", scena: this.scena, ...r };
    this.azioni.push(riga);
    appendFileSync(this.file, JSON.stringify(riga) + "\n");
  }
  dal(t, filtro = () => true) {
    return this.eventi.filter((e) => e.t >= t && filtro(e));
  }
  /** Il primo evento dopo `t` che soddisfa `filtro`, aspettandolo fino a `ms`; null se non arriva. */
  async aspetta(t, filtro, ms) {
    const fine = Date.now() + ms;
    for (;;) {
      const e = this.eventi.find((x) => x.t >= t && filtro(x));
      if (e || Date.now() > fine) return e ?? null;
      await pausa(20);
    }
  }
  /** L'ultimo stato degli overlay di una pagina, frame per frame (push: non costa tempo filmato). */
  overlay(pagina) {
    const per = new Map();
    for (const e of this.eventi) if (e.k === "overlay" && e.pagina === pagina) per.set(e.frame, e);
    return [...per.values()];
  }
  /**
   * Il diario di una scena (`--probe`), dalle azioni filmate: dove è arrivato il clic, quando la
   * pagina ha reagito (il primo secchio di mutazioni dopo la fine dell'azione) e quando è tornata
   * ferma (la fine dell'ultimo secchio prima di 300 ms senza). Calcolato a scena finita: non costa
   * tempo filmato.
   */
  riassunto(scena) {
    const righe = [];
    const azioni = this.azioni.filter((a) => a.scena === scena && !a.veloce);
    for (const [i, a] of azioni.entries()) {
      if (a.fase !== "start") continue;
      const fine = azioni.slice(i + 1).find((b) => b.fase === "end" && b.azione === a.azione);
      if (!fine) continue;
      const parti = [`${a.azione}${a.arg != null ? ` ${JSON.stringify(a.arg)}` : ""}`];
      if (a.azione === "click") {
        const colpo = this.eventi.find((e) => e.t >= a.t && e.t <= fine.t && e.k === "pointerdown" && e.pagina === a.pagina);
        parti.push(colpo ? `hit ${colpo.target}` : "no hit");
      }
      const dom = this.eventi.filter((e) => e.k === "dom" && e.pagina === a.pagina && e.t >= fine.t).sort((x, y) => x.t - y.t);
      if (dom.length) {
        let ultimo = dom[0];
        for (const e of dom.slice(1)) {
          if (e.t - (ultimo.t + 100) > 300) break;
          ultimo = e;
        }
        parti.push(`reaction ${Math.round(dom[0].t - fine.t)} ms`, `still at ${Math.round(ultimo.t + 100 - fine.t)} ms`);
      } else parti.push("no reaction");
      righe.push(parti.join(" · "));
    }
    return righe;
  }
}
