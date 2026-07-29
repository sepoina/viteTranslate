// Architettura d'insieme: doc/structure.md § "Fase 1 — Precompilazione: il comando di sync".
// Quel documento è la fonte di verità sul funzionamento della libreria: se cambi il
// comportamento di questo file, aggiornalo nello stesso commit.

/**
 * Funzione per confrontare due oggetti e apportare modifiche.
 *
 * @param {Object} a - Primo oggetto da confrontare e modificare.
 * @param {Object} b - Secondo oggetto per il confronto.
 * @returns {boolean} Restituisce true se ci sono state modifiche, altrimenti false.
 *
 * @example
 * const oggettoA = { "App_f9xds4": "rob", "App_y3mo81": "Santanastaso" };
 * const oggettoB = { "App_f9xds4": "rob", "App_y3mo81": "Santanastaso", "NuovaChiave": "NuovoValore" };
 * const ciSonoVariazioni = decade(oggettoA, oggettoB);
 * console.log(oggettoA); // { "App_f9xds4": "rob", "App_y3mo81": "Santanastaso", "NuovaChiave": "NuovoValore" }
 * console.log('Ci sono variazioni:', ciSonoVariazioni); // Ci sono variazioni: true
 */
export default function updateKeys(a, b) {
    const stats = { changed: false, deleted: [], added: [], deletedValues: {} };
    const objAdded = {};
    // Rimuovi le chiavi da 'a' che non sono presenti in 'b'
    for (const keyA in a) {
        if (!(keyA in b)) {
            stats.deletedValues[keyA] = a[keyA]; // salva il valore prima di eliminarla (serve per il rilevamento dei rename)
            delete a[keyA];
            stats.changed = true;
            stats.deleted.push(keyA);
        }
    }
    // Aggiungi le chiavi da 'b' che non sono presenti in 'a'
    for (const keyB in b) {
        if (!(keyB in a)) {
            objAdded[keyB] = b[keyB];
            stats.changed = true;
            stats.added.push(keyB);
        }
    }
    a = { ...a, ...objAdded }; // aggiunge
    // "__builder__" non passa di qui: il chiamante lo riscrive sempre da zero a fine giro
    // (v/languageName correnti, incomplete ricalcolato), quindi qui non serve portarlo avanti.
    return [stats, a];
}
