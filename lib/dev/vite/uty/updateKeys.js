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
    if (stats.changed) a["__lngVersion__"] = b["__lngVersion__"]; // riporta in a la versione corrente
    return [stats, a];
}
