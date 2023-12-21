import * as React from "react";
import { createContext } from "react";

export const TranslateContext = createContext(null);

const last = { langID: null };

export default function TranslateContainer({ children }) {
  const [langID, setLangID] = React.useState("it");
  const [langOBJ, setLangOBJ] = React.useState(null);

  const handleChangeLanguage = newLanguage => {
    setLangID(newLanguage);
  };

  React.useEffect(() => {
    if (!langID) return;
    if (last.langID === langID) return; // già in caricamento
    last.langID = langID;

    // declare the async data fetching function
    const fetchData = async () => {
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
          setNewLanguage: handleChangeLanguage,
        });
      } catch (error) {
        console.log(`Errore nel file locale/${langID}.json `);
        return;
      }
    };

    // call the function
    fetchData()
      // make sure to catch any error
      .catch(console.error);
  }, [langID]);

  return (
    <TranslateContext.Provider value={langOBJ}>
      {children}
    </TranslateContext.Provider>
  );
}
