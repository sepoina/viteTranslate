/** L'intestazione comune alle sezioni. `eyebrow`, `title` e `text` sono elementi <Trans> già pronti. */
export default function SectionHead({ eyebrow, title, text }) {
  return (
    <div className="section-head" data-reveal>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {text && <p className="section-text">{text}</p>}
    </div>
  );
}
