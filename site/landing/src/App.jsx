// Vincolo: la landing non usa href="#…" né id come ancore. main.jsx rimanda QUALUNQUE
// hash al playground (i vecchi link con l'ancora), quindi un'ancora qui non arriverebbe mai.
// La navigazione interna passa da scrollToSection() (data-section), non da un hash.
import { useEffect, useRef } from "react";
import Compare from "./Compare.jsx";
import CodeDemo from "./CodeDemo.jsx";
import Demos from "./Demos.jsx";
import Features from "./Features.jsx";
import Hero from "./Hero.jsx";
import Nav from "./Nav.jsx";
import Outro from "./Outro.jsx";
import Starters from "./Starters.jsx";
import Steps from "./Steps.jsx";
import { initMotion, scrollToSection } from "./motion.js";
import { SECTIONS } from "./sections.js";

export default function App() {
  const root = useRef(null);

  // <html lang> follows the language on screen: RememberLanguage (siteLanguage.js) sees to it.
  useEffect(() => initMotion(root.current), []);

  // ?section=demos: the Demos icon of the site bar, from the other pages (a hash would end up on the
  // playground, see main.jsx). Read once, then dropped from the address; the scroll waits for the fonts.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const name = params.get("section");
    if (!name) return;
    params.delete("section");
    const rest = params.toString();
    history.replaceState(history.state, "", `${location.pathname}${rest ? `?${rest}` : ""}`);
    if (Object.hasOwn(SECTIONS, name)) document.fonts.ready.then(() => scrollToSection(name));
  }, []);

  return (
    <div ref={root}>
      <Nav />
      <main>
        <Hero />
        <Demos />
        <CodeDemo />
        <Features />
        <Steps />
        <Compare />
        <Starters />
        <Outro />
      </main>
    </div>
  );
}
