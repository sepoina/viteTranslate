import { useState } from 'react';
import { Translate, useTranslateLanguage, useTranslateToString } from '@sepoina/vitetranslate/react';
import Photo from './Photo';
import { PHOTOS } from '../photos';

const TIMES = ['19:30', '20:00', '20:30', '21:00', '21:30', '22:00'];
const GUESTS = [1, 2, 3, 4, 5, 6, 7, 8];

const ROOMS = [
  { value: 'sala', label: '_%_Sala interna_%_' },
  { value: 'terrazza', label: '_%_Terrazza vista mare_%_' },
  { value: 'bancone', label: '_%_Bancone dello chef_%_' },
];

const HOURS = [
  { days: '_%_Martedì – venerdì_%_', time: '_%_19:30 – 23:30_%_' },
  { days: '_%_Sabato e domenica_%_', time: '_%_12:30 – 14:30 · 19:30 – 23:30_%_' },
  { days: '_%_Lunedì_%_', time: '_%_Chiuso per riposo_%_' },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function Booking() {
  const { id } = useTranslateLanguage();
  const ts = useTranslateToString();
  const [form, setForm] = useState({ date: '', time: '20:30', guests: 2, room: 'sala', name: '', email: '', phone: '', notes: '' });
  const [sent, setSent] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const guestsLabel = (n) => (Number(n) === 1 ? ts('_%_1 persona_%_') : ts('_%_%s persone_%_', n));

  const submit = (e) => {
    e.preventDefault();
    setSent({ ...form });
  };

  // la data scritta nella lingua sullo schermo: "sabato 3 ottobre", "Saturday, October 3"…
  const dateLabel = (iso) =>
    new Intl.DateTimeFormat(id || 'it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${iso}T12:00`));

  return (
    <section className="section booking" id="prenota">
      <Photo photo={PHOTOS.flames} w={2000} className="booking__bg" />
      <div className="booking__shade" aria-hidden="true" />
      <div className="wrap booking__grid">
        <div className="booking__intro reveal">
          <p className="eyebrow eyebrow--light"><Translate>_%_Prenotazioni_%_</Translate></p>
          <h2 className="title">
            <Translate t="_%_Il vostro tavolo <i>vi aspetta</i>_%_" />
          </h2>
          <p className="lead">
            <Translate>
              _%_Rispondiamo a ogni richiesta entro due ore. Per gruppi di oltre otto persone, o per
              la terrazza nelle sere di luglio e agosto, vi consigliamo di chiamarci: a volte un
              tavolo si libera all'ultimo momento._%_
            </Translate>
          </p>

          <h3 className="booking__subtitle"><Translate>_%_Orari_%_</Translate></h3>
          <dl className="hours">
            {HOURS.map((h) => (
              <div key={h.days}>
                <dt><Translate t={h.days} /></dt>
                <dd><Translate t={h.time} /></dd>
              </div>
            ))}
          </dl>

          <h3 className="booking__subtitle"><Translate>_%_Contatti_%_</Translate></h3>
          <ul className="contacts">
            <li><i className="ph ph-map-pin" aria-hidden="true" /> <Translate>_%_Via del Molo Vecchio 14, Cala dei Gabbiani_%_</Translate></li>
            <li><i className="ph ph-phone" aria-hidden="true" /> <a href="tel:+390100000000">+39 010 000 0000</a></li>
            <li><i className="ph ph-envelope-simple" aria-hidden="true" /> <a href="mailto:tavoli@vitetranslate.example">tavoli@vitetranslate.example</a></li>
          </ul>
        </div>

        <article className="booking__card reveal">
          {sent ? (
            <div className="booking__done" aria-live="polite">
              <i className="ph ph-check" aria-hidden="true" />
              <h3><Translate>_%_Richiesta ricevuta_%_</Translate></h3>
              <p>
                <Translate
                  t="_%_Grazie, <b>%s</b>! Abbiamo registrato la richiesta per %s, %s alle %s. Vi scriveremo entro due ore per confermare il tavolo._%_"
                  a={[sent.name, guestsLabel(sent.guests), dateLabel(sent.date), sent.time]}
                />
              </p>
              <button className="outline" onClick={() => setSent(null)}>
                <Translate>_%_Nuova prenotazione_%_</Translate>
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h3><Translate>_%_Richiedi un tavolo_%_</Translate></h3>
              <div className="grid">
                <label>
                  <Translate>_%_Data_%_</Translate>
                  <input type="date" required min={today()} value={form.date} onChange={set('date')} />
                </label>
                <label>
                  <Translate>_%_Ora_%_</Translate>
                  <select value={form.time} onChange={set('time')}>
                    {TIMES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label>
                  <Translate>_%_Ospiti_%_</Translate>
                  <select value={form.guests} onChange={set('guests')}>
                    {GUESTS.map((n) => <option key={n} value={n}>{guestsLabel(n)}</option>)}
                  </select>
                </label>
              </div>

              <fieldset className="room-pick">
                <legend><Translate>_%_Dove preferite sedervi?_%_</Translate></legend>
                {ROOMS.map((r) => (
                  <label key={r.value}>
                    <input type="radio" name="room" value={r.value} checked={form.room === r.value} onChange={set('room')} />
                    <Translate t={r.label} />
                  </label>
                ))}
              </fieldset>

              <label>
                <Translate>_%_Nome e cognome_%_</Translate>
                <input required autoComplete="name" value={form.name} onChange={set('name')} placeholder={ts('_%_Come vi chiamiamo al tavolo_%_')} />
              </label>
              <div className="grid">
                <label>
                  <Translate>_%_Email_%_</Translate>
                  <input type="email" required autoComplete="email" value={form.email} onChange={set('email')} placeholder={ts('_%_nome@esempio.it_%_')} />
                </label>
                <label>
                  <Translate>_%_Telefono_%_</Translate>
                  <input type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="+39 …" />
                </label>
              </div>
              <label>
                <Translate>_%_Note per la cucina_%_</Translate>
                <textarea rows={3} value={form.notes} onChange={set('notes')} placeholder={ts('_%_Allergie, ricorrenze, un seggiolone, una sorpresa da organizzare…_%_')} />
              </label>
              <button type="submit">
                <Translate>_%_Invia la richiesta_%_</Translate> <i className="ph ph-arrow-right" aria-hidden="true" />
              </button>
              <small className="booking__privacy">
                <Translate>_%_Usiamo i vostri dati solo per gestire la prenotazione. Niente newsletter, a meno che non ce la chiediate voi._%_</Translate>
              </small>
            </form>
          )}
        </article>
      </div>
    </section>
  );
}
