import { company } from '../data/company.js';

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-overlay">
        <div className="hero-content">
          <p className="eyebrow">{company.foundedLabel}</p>
          <h1>{company.claim}</h1>
          <p>{company.positioning}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="/contacto">
              Solicitar diagnostico gratuito
            </a>
            <a className="button button-secondary" href="/servicios">
              Ver servicios
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
