// Il cambio di velocità: l'azione `speed` dice da che punto della clip il video va più svelto (o più
// piano). Il regista (director.mjs, a_speed) scrive i fotogrammi chiave in capture/takes.json, in
// secondi reali della clip; il montaggio (compose.mjs, segmento) rimappa il tempo con un setpts a
// tratti. La ripresa dura quanto è durata: cambia solo quanto ci mette a passare sullo schermo.
// Qui solo funzioni pure: si provano in node, senza Chrome.
// LINKED-DATA: chiavi e limiti = README.md § "Speed". Cambiane uno, cambia l'altro.
export const SPEED_MIN = 0.25;
export const SPEED_MAX = 8;

/** La forma di un `speed` (un numero, 1 è il tempo reale), per storyboard.mjs: gli errori, o []. */
export function controllaVelocita(arg, dove) {
  if (typeof arg === "number" && arg >= SPEED_MIN && arg <= SPEED_MAX) return [];
  return [`${dove}: speed is a number from ${SPEED_MIN} to ${SPEED_MAX} (1 is real time), as speed: 2`];
}

/**
 * I tratti a velocità costante di una clip lunga `durata` secondi: dove cominciano e finiscono nella
 * ripresa (da, a), a che velocità (v), e dove cominciano nel video (o). Una scena parte a 1×.
 * @param {{ t: number, speed: number }[] | null} chiavi - i fotogrammi chiave (takes.json, take.speed)
 */
export function tratti(chiavi, durata) {
  const lista = [];
  let v = 1;
  let da = 0;
  let o = 0;
  for (const k of [...(chiavi ?? []), { t: durata, speed: 1 }]) {
    const a = Math.min(durata, Math.max(da, k.t));
    if (a > da) {
      lista.push({ da, a, v, o });
      o += (a - da) / v;
      da = a;
    }
    v = k.speed;
  }
  return { tratti: lista, durata: o };
}

/** Quanto dura la clip nel video, con le sue velocità. Senza fotogrammi chiave: quanto è durata. */
export function durataUscita(chiavi, durata) {
  return chiavi?.length ? tratti(chiavi, durata).durata : durata;
}

/** A che secondo del video cade il secondo `t` della ripresa. */
export function tempoUscita(chiavi, durata, t) {
  const { tratti: lista } = tratti(chiavi, durata);
  const r = lista.find((x) => t < x.a) ?? lista.at(-1);
  return r ? r.o + (Math.min(t, r.a) - r.da) / r.v : 0;
}

// Un numero per un'espressione di ffmpeg: mai in notazione esponenziale.
const num = (n) => String(Number(n.toFixed(4)));

/**
 * Il filtro ffmpeg della velocità per una clip: si appende alla catena video del segmento, dopo la
 * camera (i suoi movimenti vanno alla stessa velocità del resto). setpts con un if annidato per tratto,
 * poi fps: ogni fotogramma cade dove deve, a 2× ne passa uno ogni due.
 * Tra apici singoli: lì dentro le virgole non spezzano il filtergraph. Mai un apice nelle espressioni.
 * @param {{ t: number, speed: number }[]} chiavi
 * @param {{ fps: number, durata: number }} p - fps del segmento, durata della ripresa (secondi)
 */
export function filtroVelocita(chiavi, { fps, durata }) {
  const { tratti: lista, durata: uscita } = tratti(chiavi, durata);
  const X = "(PTS*TB)"; // il secondo della ripresa
  const tratto = (r) => `(${num(r.o)}+(${X}-${num(r.da)})/${num(r.v)})`;
  let e = tratto(lista.at(-1));
  for (let i = lista.length - 2; i >= 0; i--) e = `if(lt(${X},${num(lista[i].a)}),${tratto(lista[i])},${e})`;
  return [`setpts='(${e})/TB'`, `fps=${fps}`, "tpad=stop_mode=clone:stop_duration=1", `trim=duration=${num(uscita)}`, "setpts=PTS-STARTPTS"].join(",");
}
