import { useState } from 'react';
import { Trans, useTrans } from '@sepoina/vitetranslate/react';
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
  const trans = useTrans();
  const [form, setForm] = useState({ date: '', time: '20:30', guests: 2, room: 'sala', name: '', email: '', phone: '', notes: '' });
  const [sent, setSent] = useState(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const guestsLabel = (n) => trans('_%_{0, plural, one {# persona} other {# persone}}_%_', Number(n));

  const submit = (e) => {
    e.preventDefault();
    setSent({ ...form });
  };

  return (
    <section className="section booking" id="prenota">
      <Photo photo={PHOTOS.flames} w={2000} className="booking__bg" />
      <div className="booking__shade" aria-hidden="true" />
      <div className="wrap booking__grid">
        <div className="booking__intro reveal">
          <p className="eyebrow eyebrow--light"><Trans>Prenotazioni</Trans></p>
          <h2 className="title">
            <Trans>Il vostro tavolo <i>vi aspetta</i></Trans>
          </h2>
          <p className="lead">
            <Trans>
              Rispondiamo a ogni richiesta entro due ore. Per gruppi di oltre otto persone, o per
              la terrazza nelle sere di luglio e agosto, vi consigliamo di chiamarci: a volte un
              tavolo si libera all'ultimo momento.
            </Trans>
          </p>

          <h3 className="booking__subtitle"><Trans>Orari</Trans></h3>
          <dl className="hours">
            {HOURS.map((h) => (
              <div key={h.days}>
                <dt><Trans t={h.days} /></dt>
                <dd><Trans t={h.time} /></dd>
              </div>
            ))}
          </dl>

          <h3 className="booking__subtitle"><Trans>Contatti</Trans></h3>
          <ul className="contacts">
            <li><i className="ph ph-map-pin" aria-hidden="true" /> <Trans>Via del Molo Vecchio 14, Cala dei Gabbiani</Trans></li>
            <li><i className="ph ph-phone" aria-hidden="true" /> <a href="tel:+390100000000">+39 010 000 0000</a></li>
            <li><i className="ph ph-envelope-simple" aria-hidden="true" /> <a href="mailto:tavoli@vitetranslate.example">tavoli@vitetranslate.example</a></li>
          </ul>
        </div>

        <article className="booking__card reveal">
          {sent ? (
            <div className="booking__done" aria-live="polite">
              <i className="ph ph-check" aria-hidden="true" />
              <h3><Trans>Richiesta ricevuta</Trans></h3>
              <p>
                <Trans
                  t="_%_Grazie, <b>{name}</b>! Abbiamo registrato la richiesta per {guests, plural, one {# persona} other {# persone}}, {date, date, ::EEEEdMMMM} alle {time}. Vi scriveremo entro due ore per confermare il tavolo._%_"
                  a={{ name: sent.name, guests: Number(sent.guests), date: sent.date, time: sent.time }}
                />
              </p>
              <button className="outline" onClick={() => setSent(null)}>
                <Trans>Nuova prenotazione</Trans>
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h3><Trans>Richiedi un tavolo</Trans></h3>
              <div className="grid">
                <label>
                  <Trans>Data</Trans>
                  <input type="date" required min={today()} value={form.date} onChange={set('date')} />
                </label>
                <label>
                  <Trans>Ora</Trans>
                  <select value={form.time} onChange={set('time')}>
                    {TIMES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label>
                  <Trans>Ospiti</Trans>
                  <select value={form.guests} onChange={set('guests')}>
                    {GUESTS.map((n) => <option key={n} value={n}>{guestsLabel(n)}</option>)}
                  </select>
                </label>
              </div>

              <fieldset className="room-pick">
                <legend><Trans>Dove preferite sedervi?</Trans></legend>
                {ROOMS.map((r) => (
                  <label key={r.value}>
                    <input type="radio" name="room" value={r.value} checked={form.room === r.value} onChange={set('room')} />
                    <Trans t={r.label} />
                  </label>
                ))}
              </fieldset>

              <label>
                <Trans>Nome e cognome</Trans>
                <input required autoComplete="name" value={form.name} onChange={set('name')} placeholder={trans('_%_Come vi chiamiamo al tavolo_%_')} />
              </label>
              <div className="grid">
                <label>
                  <Trans>Email</Trans>
                  <input type="email" required autoComplete="email" value={form.email} onChange={set('email')} placeholder={trans('_%_nome@esempio.it_%_')} />
                </label>
                <label>
                  <Trans>Telefono</Trans>
                  <input type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="+39 …" />
                </label>
              </div>
              <label>
                <Trans>Note per la cucina</Trans>
                <textarea rows={3} value={form.notes} onChange={set('notes')} placeholder={trans('_%_Allergie, ricorrenze, un seggiolone, una sorpresa da organizzare…_%_')} />
              </label>
              <button type="submit">
                <Trans>Invia la richiesta</Trans> <i className="ph ph-arrow-right" aria-hidden="true" />
              </button>
              <small className="booking__privacy">
                <Trans>Usiamo i vostri dati solo per gestire la prenotazione. Niente newsletter, a meno che non ce la chiediate voi.</Trans>
              </small>
            </form>
          )}
        </article>
      </div>
    </section>
  );
}
