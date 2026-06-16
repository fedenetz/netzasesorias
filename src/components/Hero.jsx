import { company } from '../data/company.js';
import { proofPoints } from '../data/home.js';

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-overlay section-shell">
        <div className="hero-content reveal-in">
          <p className="eyebrow hero-kicker">{company.foundedLabel}</p>
          <h1>Contabilidad e impuestos en orden.</h1>
          <p>
            Asesoria contable, tributaria y laboral en Concepcion para empresas, emprendedores y profesionales que
            necesitan cumplimiento claro, documentos ordenados y acompanamiento responsable.
          </p>
          <div className="hero-actions" aria-label="Acciones principales">
            <a className="button button-primary" href="/contacto">
              Solicitar diagnostico gratuito
            </a>
            <a className="button button-secondary" href="/servicios">
              Revisar servicios
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
