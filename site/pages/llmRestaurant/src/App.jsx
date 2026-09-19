import { useEffect } from 'react';
import { useTranslateLanguage, useTranslateToString } from '@sepoina/vitetranslate/react';
import Header from './components/Header';
import Hero from './components/Hero';
import Story from './components/Story';
import Menu from './components/Menu';
import Signature from './components/Signature';
import Tasting from './components/Tasting';
import Cellar from './components/Cellar';
import Gallery from './components/Gallery';
import Reviews from './components/Reviews';
import Events from './components/Events';
import Booking from './components/Booking';
import Faq from './components/Faq';
import Footer from './components/Footer';

export default function App() {
  const { id } = useTranslateLanguage();
  const ts = useTranslateToString();
  //
  // anche il titolo della scheda cambia lingua
  useEffect(() => {
    document.title = ts('_%_viteTranslate — Cucina di mare a Cala dei Gabbiani_%_');
  }, [ts, id]);
  //
  // i blocchi .reveal entrano in scena quando arrivano nel viewport (una volta sola).
  // Senza IntersectionObserver, o con "riduci movimento", restano semplicemente visibili.
  useEffect(() => {
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.documentElement;
    root.classList.add('can-reveal');
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }),
      { rootMargin: '0px 0px -8% 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove('can-reveal');
    };
  }, []);

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Story />
        <Menu />
        <Signature />
        <Tasting />
        <Cellar />
        <Gallery />
        <Reviews />
        <Events />
        <Booking />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
