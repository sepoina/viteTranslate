// La barra in alto di ogni progetto del sito: il logo (porta alla landing), ciò che la pagina ci
// mette (menu o link di ritorno), poi lingua, tema ed eventuali bottoni in più.
// SORGENTE in site/theme/: la copia in src/theme/ la rigenera `npm run site:theme`.
import LanguageSwitch from "./LanguageSwitch.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import logo from "./logo.svg";

/**
 * @param {object} props
 * @param {string} props.home l'indirizzo della landing: siteUrl() nelle pagine, import.meta.env.BASE_URL nella landing
 * @param {import("react").ReactNode} [props.children] ciò che sta dopo il logo
 * @param {import("react").ReactNode} [props.tools] bottoni in più, dopo lingua e tema
 */
export default function SiteBar({ home, children, tools }) {
  return (
    <header className="bar">
      <div className="wrap bar-in">
        <a className="bar-brand" href={home}>
          <img src={logo} alt="viteTranslate" width="112" height="20" />
        </a>
        {children}
        <div className="bar-tools">
          <LanguageSwitch />
          <ThemeToggle />
          {tools}
        </div>
      </div>
    </header>
  );
}
