//
// ordina una lista mettendo le chiavi con valori nulli alla fine
//
// @param {object} obj - oggetto da ordinare
// @param {object} service - stato condiviso della sessione di sincronizzazione (vedi cli.js),
//   fornisce notTranslatedString (separatore per le chiavi non tradotte)
export default function sortObjectByKey(obj, service) {
    const keysWithValues = [];
    const keysWithNulls = [];
    // Separo le chiavi in base al valore
    for (const key in obj) {
        if (obj[key] === null) {
            keysWithNulls.push(key);
        } else {
            keysWithValues.push(key);
        }
    }
    // Creo l'oggetto ordinato
    const sortedObject = {};
    // aggiungi le trovate ordinate
    for (const key of customSortArray(keysWithValues, service)) sortedObject[key] = obj[key];
    // se ci sono elementi nulli
    // aggiungili in coda
    if (keysWithNulls.length > 0) {
        // aggiunge separatore
        sortedObject[service.notTranslatedString.key] = service.notTranslatedString.value;
        // aggiunge le chiavi nulle
        for (const key of customSortArray(keysWithNulls, service)) sortedObject[key] = obj[key];
    }
    return sortedObject;
}

function customSortArray(arr, service) {
    const lastString = service.notTranslatedString.found;
    return arr.sort((a, b) => {
        if (a === "__lngVersion__" || b.endsWith(lastString)) return -1; // metti questo in testa
        if (a.endsWith(lastString) || b === "__lngVersion__") return 1; // metti questo in coda
        return a.localeCompare(b);
    });
}