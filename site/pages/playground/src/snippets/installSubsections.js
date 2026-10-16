// Le sottosezioni di "Installazione". Gli id sono ancore pubbliche (…/playground/#install-llm),
// in inglese e mai tradotte: i vecchi id in italiano restano validi tramite LEGACY_IDS in App.jsx.
// `manual` and `manualTitle`: the manual's page behind each one, as in ZZZ_snippetList.js.
// LINKED-DATA: the same pairs are the "Explained in" column of site/pages/docs/content/getting-started/live-examples.mdx.
const installSubsections = [
  {
    id: "install-config",
    title: "_%_Config del plugin_%_",
    manual: "getting-started/installation#install-and-register-the-plugin",
    manualTitle: "_%_Installare e registrare il plugin_%_",
  },
  { id: "install-dev", title: "_%_Esecuzione dev_%_", manual: "components/translate-container", manualTitle: "_%_Il componente TranslateContainer_%_" },
  { id: "install-sync", title: "_%_Build linguistico_%_", manual: "api/cli", manualTitle: "_%_La CLI: sincronizzazione e controlli_%_" },
  { id: "install-new-language", title: "_%_Aggiunta nuova lingua_%_", manual: "concepts/languages", manualTitle: "_%_Aggiungere una lingua_%_" },
  { id: "install-llm", title: "_%_Traduzione con un LLM_%_", manual: "llm/setup#getting-started", manualTitle: "_%_Configurare l'LLM_%_" },
];

export default installSubsections;
