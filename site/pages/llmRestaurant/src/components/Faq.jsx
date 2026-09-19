import { Translate } from '@sepoina/vitetranslate/react';

const QUESTIONS = [
  {
    q: '_%_Posso segnalare allergie e intolleranze?_%_',
    a: "_%_Certo, e vi chiediamo di farlo già al momento della prenotazione. La cucina gestisce celiachia, allergie ai crostacei e alla frutta secca con linee di preparazione separate: ditecelo e ci organizziamo._%_",
  },
  {
    q: '_%_Ci sono proposte vegetariane?_%_',
    a: "_%_Ogni sezione della carta ha almeno un piatto vegetariano, costruito sull'orto e non come ripiego. Per un menù degustazione interamente vegetariano basta un giorno di preavviso._%_",
  },
  {
    q: '_%_I bambini sono i benvenuti?_%_',
    a: '_%_Sempre. Abbiamo seggioloni, fogli e pastelli, e un piccolo menù con la pasta al pomodoro, la cotoletta di pesce e il gelato. Per i più piccoli la sala interna è la scelta più comoda._%_',
  },
  {
    q: '_%_Posso portare il mio cane?_%_',
    a: "_%_In terrazza sì, con piacere: arriverà una ciotola d'acqua prima ancora del menù. In sala interna, per rispetto degli altri ospiti, preferiamo di no._%_",
  },
  {
    q: "_%_C'è un dress code?_%_",
    a: '_%_Nessuno. Siamo sul porto: le infradito a pranzo sono di casa, la camicia a cena è gradita ma non obbligatoria._%_',
  },
  {
    q: '_%_Come funziona la cancellazione?_%_',
    a: '_%_Potete cancellare o spostare la prenotazione gratuitamente fino a 24 ore prima. Per il bancone dello chef e per i gruppi chiediamo una caparra, restituita se avvisate entro 72 ore._%_',
  },
];

export default function Faq() {
  return (
    <section className="section">
      <div className="wrap faq">
        <header className="reveal">
          <p className="eyebrow"><Translate>_%_Domande frequenti_%_</Translate></p>
          <h2 className="title">
            <Translate t="_%_Prima di <i>sedervi a tavola</i>_%_" />
          </h2>
          <p>
            <Translate>
              _%_Non trovate la risposta che cercate? Scriveteci o chiamateci: in sala c'è sempre
              qualcuno felice di raccontarvi il ristorante._%_
            </Translate>
          </p>
        </header>
        <div className="faq__list reveal">
          {QUESTIONS.map((item, i) => (
            <details key={item.q} open={i === 0}>
              <summary><Translate t={item.q} /></summary>
              <p><Translate t={item.a} /></p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
