import { company } from '../data/company.js';
import { proofPoints } from '../data/home.js';

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-overlay section-shell">
        <div className="hero-content reveal-in">
          <p className="eyebrow hero-kicker">{company.foundedLabel}</p>
          <h1>Asesoria contable, tributaria y laboral para operar con orden y tranquilidad.</h1>
          <p>
            Acompanamos a empresas, emprendedores y profesionales con una mirada tecnica, directa y responsable.
          </p>
          <div className="hero-actions" aria-label="Acciones principales">
            <a className="button button-primary" href="/contacto">
              Hablar con Netz
            </a>
            <a className="button button-secondary" href="/servicios">
              Ver servicios
            </a>
          </div>
          <div className="hero-proof" aria-label="Pruebas de confianza">
            {proofPoints.map((point) => (
              <div key={point.label}>
                <strong>{point.value}</strong>
                <span>{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
