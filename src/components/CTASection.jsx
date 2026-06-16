export function CTASection({ title, text, primaryLabel = 'Agenda diagnostico' }) {
  return (
    <section className="cta-section">
      <div>
        <p className="eyebrow">Conversemos con informacion clara</p>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <a className="button button-primary" href="/contacto">
        {primaryLabel}
      </a>
    </section>
  );
}
