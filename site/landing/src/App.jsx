// Vincolo: la landing non usa href="#…" né id come ancore. main.jsx rimanda QUALUNQUE
// hash al playground (i vecchi link con l'ancora), quindi un'ancora qui non arriverebbe mai.
// La navigazione interna passa da scrollToSection() (data-section), non da un hash.
import { useEffect, useRef } from "react";
import { useTranslateLanguage } from "@sepoina/vitetranslate/react";
import Compare from "./Compare.jsx";
import CodeDemo from "./CodeDemo.jsx";
import Features from "./Features.jsx";
import Hero from "./Hero.jsx";
import Marquee from "./Marquee.jsx";
import Nav from "./Nav.jsx";
import Outro from "./Outro.jsx";
import Steps from "./Steps.jsx";
import { initMotion } from "./motion.js";

export default function App() {
  const root = useRef(null);
  const { id } = useTranslateLanguage();

  // <html lang> segue la lingua scelta: conta per lettori di schermo e per l'ortografia del browser.
  useEffect(() => {
    if (id) document.documentElement.lang = id;
  }, [id]);

  useEffect(() => initMotion(root.current), []);

  return (
    <div ref={root}>
      <Nav />
      <main>
        <Hero />
        <CodeDemo />
        <Marquee />
        <Features />
        <Steps />
        <Compare />
        <Outro />
      </main>
    </div>
  );
}
