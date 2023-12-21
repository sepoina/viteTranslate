var $kxAjq$path = require("path");
var $kxAjq$fnv1a = require("fnv1a");
var $kxAjq$fs = require("fs");
var $kxAjq$reactjsxruntime = require("react/jsx-runtime");
var $kxAjq$react = require("react");


function $parcel$export(e, n, v, s) {
  Object.defineProperty(e, n, {get: v, set: s, enumerable: true, configurable: true});
}

function $parcel$interopDefault(a) {
  return a && a.__esModule ? a.default : a;
}

$parcel$export(module.exports, "babelTranslate", () => $84295edbf8f3a9be$export$2e2bcd8739ae039);
$parcel$export(module.exports, "rollupTranslate", () => $e0dd7b287e043e29$export$2e2bcd8739ae039);
$parcel$export(module.exports, "TranslateContainer", () => $6071371b0fb427c2$export$2e2bcd8739ae039);
$parcel$export(module.exports, "TranslateContext", () => $6071371b0fb427c2$export$1a09d832689347c);
$parcel$export(module.exports, "Translate", () => $aa4a91616759d07b$export$2e2bcd8739ae039);
//
// restituisce il testo di un children
// o false se non è un testo recuperabile
//
function $71340dd5bfee2776$export$2e2bcd8739ae039(p) {
    // console.log('Carico dai children:', p);
    if (p?.container?.children?.length === 1) {
        const child = p.container.children[0];
        // se è un testo ok
        if (child.type === "JSXText") return child.value;
        else if (child.type === "JSXExpressionContainer" && child?.expression?.value) return child.expression.value;
        else return false;
    }
    // altrimenti è un errore
    return false;
}


//
// prende la variabile 'variableName' se esiste tra i props o torna false
function $a4096abcf95ff7f3$export$2e2bcd8739ae039(variableName, p) {
    // console.log('Carico dalle variabili in linea:', p);
    const node = p.node.attributes.find((node)=>node?.name?.name === variableName);
    if (!node) return false;
    // ok è una stringa
    if (node?.value?.type === "StringLiteral") return node.value.value;
    // o è calcolabile come stringa
    if (node?.value?.type === "JSXExpressionContainer" && node?.value?.expression?.type === "StringLiteral") return node.value.expression.value;
    return false;
}




//
// se in input trova un _%_testo_%_
// aggiunge "testo" alla tabella di traduzioni
// e trasforma "_%_testo_%_" in "_<_id_#_testo_>_"
//
function $84295edbf8f3a9be$var$ifStaticAddTable(p, state) {
    if (!p?.node?.value) return; // non trova l'oggetto
    if (!/_%_(.*?)_%_/.test(p.node.value)) return; // non trova il riconoscitore
    const strToAdd = /_%_(.*?)_%_/.exec(p.node.value)?.[1];
    if (!strToAdd) return; // è vuota o nulla
    //  console.log("trovato da rimpiazzare:", p.node.value);
    const data_translate = $84295edbf8f3a9be$var$addToTable(strToAdd, state);
    p.node.value = $84295edbf8f3a9be$var$getReplacedForTranslate(p.node.value, data_translate, strToAdd);
    if (p.node.extra.rawValue) p.node.extra.rawValue = $84295edbf8f3a9be$var$getReplacedForTranslate(p.node.extra.rawValue, data_translate, strToAdd);
    if (p.node.extra.raw) p.node.extra.raw = $84295edbf8f3a9be$var$getReplacedForTranslate(p.node.extra.raw, data_translate, strToAdd);
// console.log("rimpiazzo:", p.node.value);
}
// getta il testo da value e trasforma "_%_testo_%_" in "_<_id_/_testo_>_"
function $84295edbf8f3a9be$var$getReplacedForTranslate(value, data_translate, text) {
    const newString = `_<_${data_translate}_/_${text}_>_`;
    return value.replace(/_%_(.*?)_%_/, newString);
}
function $84295edbf8f3a9be$var$addToTable(strToAdd, state) {
    //
    //
    // recupera il nome del file su cui si trova il translate
    const nameFile = (0, ($parcel$interopDefault($kxAjq$path))).parse(state.filename).name;
    //
    //
    // calcola l'hash
    const hex = (0, ($parcel$interopDefault($kxAjq$fnv1a)))(strToAdd).toString(36);
    //
    // va iniettato
    // console.log(path);
    const data_translate = `${nameFile}_${hex}`;
    // console.log(`add to table:${data_translate} value:${strToAdd}`);
    // assegna
    globalThis["TranslateService"]["baseLng"][data_translate] = strToAdd;
    return data_translate; // id
}
var $84295edbf8f3a9be$export$2e2bcd8739ae039 = (api)=>{
    const { types: t } = api;
    return {
        visitor: {
            // Aggiungi il tuo visitor per le stringhe costanti
            StringLiteral: $84295edbf8f3a9be$var$ifStaticAddTable,
            JSXText: $84295edbf8f3a9be$var$ifStaticAddTable,
            TemplateElement: $84295edbf8f3a9be$var$ifStaticAddTable,
            JSXOpeningElement (path, state) {
                //
                // prova ad aprirlo... è translate? se no torna
                if (path.node.name.name !== "Translate") return;
                //
                // ha giù la props data-translate? torna
                const existingProp = path.node.attributes.find((node)=>node?.name?.name === "data-translate");
                if (existingProp) return;
                //
                // se contiene c come props la traduzione è differita, ritorna
                //
                if (path.node.attributes.find((n)=>n?.name.name === "c")) return;
                //
                // se ha un props chiamato 't' lo carica altrimenti carica il contenuto
                // dei children, se nessuno dei due ha un text mostra un errore
                const textInternal = path.node.attributes.find((node)=>node?.name?.name === "t");
                const text = textInternal ? (0, $a4096abcf95ff7f3$export$2e2bcd8739ae039)("t", path) : (0, $71340dd5bfee2776$export$2e2bcd8739ae039)(path);
                if (text === false) throw "Errore, Translate deve contenere solo stringhe";
                //
                // aggiunge alla tabella
                const data_translate = $84295edbf8f3a9be$var$addToTable(text, state);
                const newProp = t.jSXAttribute(t.jSXIdentifier("data-translate"), t.stringLiteral(data_translate));
                path.node.attributes.push(newProp);
            }
        }
    };
};



function $e0dd7b287e043e29$export$2e2bcd8739ae039(defs) {
    return {
        name: "onRollupTranslate",
        buildStart: {
            sequential: true,
            order: "pre",
            handler: ()=>{
                //
                // la public dir è di solito {workspace}/public
                //
                globalThis["TranslateService"] = defs;
                globalThis["TranslateService"].baseLng = {
                    __lngVersion__: $e0dd7b287e043e29$var$CalcolaVersion()
                }; // spazio vuoto per gli elementi
                console.log("Preparo il servizio traduzioni.");
            }
        },
        buildEnd: {
            sequential: true,
            order: "post",
            handler: ()=>{
                $e0dd7b287e043e29$var$updateFileLanguage();
            }
        }
    };
}
/**
 * Aggiorna un file di lingua JSON con dati di traduzione. Se il file non esiste, crea un nuovo file
 * utilizzando i dati di traduzione di base forniti. La funzione confronta e aggiorna i dati presenti
 * nel file con i nuovi dati di traduzione, salvando le modifiche solo se sono state apportate variazioni.
 *
 * @function
 * @returns {void}
 *
 * @description
 * Questa funzione legge il contenuto di un file JSON di lingua e lo confronta con i dati di traduzione
 * di base forniti. Se il file non esiste, viene creato utilizzando i dati di traduzione di base. Se ci
 * sono variazioni nei dati di traduzione, le modifiche vengono salvate nel file. La funzione fornisce
 * messaggi di log dettagliati durante il processo.
 *
 */ function $e0dd7b287e043e29$var$updateFileLanguage() {
    // Specifica il percorso del tuo file JSON
    const filePath = globalThis["TranslateService"].file;
    const distPath = globalThis["TranslateService"].dist;
    console.log("TRANSLATE ---------------------------------------------");
    console.log("Carico traduzione base.");
    try {
        (0, ($parcel$interopDefault($kxAjq$fs))).readFile(filePath, "utf8", (err, data)=>{
            let state = {
                newest: true,
                changed: true
            }, baseData = null;
            if (err) {
                console.log(`Non esiste ancora il file ${filePath}, tento di crearlo`);
                baseData = globalThis["TranslateService"].baseLng; // questi i dati
            } else {
                baseData = JSON.parse(data);
                const newData = globalThis["TranslateService"].baseLng;
                state = $e0dd7b287e043e29$var$decade(baseData, newData); // se ci sono variazioni
            }
            if (state.changed) {
                // sono avvenute variazioni, salva
                const stats = state.newest ? "Nuovo file," : `(${state.added} agginte, ${state.deleted} rimosse)`;
                console.log(`Update avvenuto: ${stats} salvo.`);
                (0, ($parcel$interopDefault($kxAjq$fs))).writeFile(filePath, JSON.stringify(baseData, null, 2), "utf8", (err)=>{
                    if (err) console.error(`Errore durante la scrittura su ${filePath}`, err);
                    else {
                        console.log(`Dati scritti con successo su ${filePath}`);
                        (0, ($parcel$interopDefault($kxAjq$fs))).copyFile(filePath, distPath, (err)=>{
                            if (!err) console.log(`Copiato con successo su ${distPath}`);
                            console.log("END TRANSLATE ---------------------------------------------");
                        });
                    }
                });
            } else {
                console.log("Nessun cambiamento.");
                console.log("END TRANSLATE ---------------------------------------------");
            }
        });
    } catch (error) {
        console.error(`Errore l'elaborazione di ${filePath}, cancellalo`, error);
        return;
    }
}
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
 */ function $e0dd7b287e043e29$var$decade(a, b) {
    const stats = {
        changed: false,
        deleted: 0,
        added: 0
    };
    // Rimuovi le chiavi da 'a' che non sono presenti in 'b'
    for(const keyA in a)if (!(keyA in b)) {
        delete a[keyA];
        stats.changed = true;
        stats.deleted += 1;
    }
    // Aggiungi le chiavi da 'b' che non sono presenti in 'a'
    for(const keyB in b)if (!(keyB in a)) {
        a[keyB] = b[keyB];
        stats.changed = true;
        stats.added += 1;
    }
    if (stats.changed) a["__lngVersion__"] = b["__lngVersion__"]; // riporta in a la versione corrente
    return stats;
}
function $e0dd7b287e043e29$var$CalcolaVersion() {
    return Date.now();
}




const $6071371b0fb427c2$export$1a09d832689347c = /*#__PURE__*/ (0, $kxAjq$react.createContext)(null);
const $6071371b0fb427c2$var$last = {
    langID: null
};
function $6071371b0fb427c2$export$2e2bcd8739ae039({ children: children }) {
    const [langID, setLangID] = $kxAjq$react.useState("it");
    const [langOBJ, setLangOBJ] = $kxAjq$react.useState(null);
    const handleChangeLanguage = (newLanguage)=>{
        setLangID(newLanguage);
    };
    $kxAjq$react.useEffect(()=>{
        if (!langID) return;
        if ($6071371b0fb427c2$var$last.langID === langID) return; // già in caricamento
        $6071371b0fb427c2$var$last.langID = langID;
        // declare the async data fetching function
        const fetchData = async ()=>{
            try {
                // get the data from the api
                // console.log("Carico:", langID);
                const response = await fetch(`./locale/${langID}.json`);
                // convert the data to json
                const json = await response.json();
                // set state with the result
                // console.log("Fatto.");
                setLangOBJ({
                    id: langID,
                    table: json,
                    setNewLanguage: handleChangeLanguage
                });
            } catch (error) {
                console.log(`Errore nel file locale/${langID}.json `);
                return;
            }
        };
        // call the function
        fetchData()// make sure to catch any error
        .catch(console.error);
    }, [
        langID
    ]);
    return /*#__PURE__*/ (0, $kxAjq$reactjsxruntime.jsx)($6071371b0fb427c2$export$1a09d832689347c.Provider, {
        value: langOBJ,
        children: children
    });
}





function $aa4a91616759d07b$export$2e2bcd8739ae039({ "data-translate": dataTranslate, t: t, c: c, a: a, children: children }) {
    const lang = (0, $kxAjq$react.useContext)((0, $6071371b0fb427c2$export$1a09d832689347c));
    //
    // evita il rendering se non cambia lingua o array di dati
    return (0, $kxAjq$react.useMemo)(()=>{
        let inputString = c || t || children;
        // console.log("rerender:", inputString);
        //
        // non c'è dataTranslate, può essere che sia inlinea, se lo è è nel parametro c
        if (!dataTranslate) {
            const matches = inputString.match(/_<_(.*?)_\/_(.*?)_>_/);
            if (matches) {
                dataTranslate = matches[1]; // Contenuto tra "_<_" e "_/_"
                inputString = matches[2]; // Contenuto tra "_/_" e "_>_"
            } else throw "errore nel servizio di traduzione, manca translate";
        }
        //
        // c'è traduzione
        if (lang?.table?.[dataTranslate]) return /*#__PURE__*/ (0, $kxAjq$reactjsxruntime.jsx)("span", {
            "data-from-translate": dataTranslate,
            children: a ? $aa4a91616759d07b$var$sostitui(lang.table[dataTranslate], a) : lang.table[dataTranslate]
        });
        //
        // non c'è traduzione
        return /*#__PURE__*/ (0, $kxAjq$reactjsxruntime.jsx)("span", {
            "data-not-translate": dataTranslate,
            children: a ? $aa4a91616759d07b$var$sostitui(inputString, a) : inputString
        });
    }, [
        lang,
        a
    ]); // solo il cambio di lingua e di array obbliga il re-rendering
}
//
// filla le variabili nel template
//     es: text='Siamo al:%0/%1' e ['20%','100%']
//              'Siamo al:%0' e '20%'
//
function $aa4a91616759d07b$var$sostitui(text, args) {
    // se non ci sono argomenti torna sè stesso
    if (args === undefined) return text;
    // definisce il contenitore
    const list = Array.isArray(args) ? args : [
        args
    ]; // se args[0] è un array è lui la lista sennò lo mette in un array monoelemento
    let counter = 0;
    const replacedString = text.replace(/%s/g, ()=>list[counter++]);
    return replacedString;
/*
    // log(text, args);
    // https://stackoverflow.com/questions/610406/javascript-equivalent-to-printf-string-format#
    // var args = Array.prototype.slice.call(arguments, 1);
    return text.replace(/%(\d+)/g, function (match, number) {
        return typeof list[number] != 'undefined'
            ? list[number]
            : match
            ;
    });*/ }




//# sourceMappingURL=main.js.map
