import { CTASection } from '../components/CTASection.jsx';
import { FAQAccordion } from '../components/FAQAccordion.jsx';
import { Hero } from '../components/Hero.jsx';
import { SectionHeading } from '../components/SectionHeading.jsx';
import { faq } from '../data/faq.js';
import { benefitBlocks, highlightedServices, processSteps } from '../data/home.js';
import { resources } from '../data/resources.js';

export function HomePage() {
  return (
    <>
      <Hero />

      <section className="section split-section problem-section">
        <div>
          <SectionHeading
            eyebrow="Problema que resolvemos"
            title="Cuando la información está dispersa, cumplir se vuelve lento y riesgoso"
            text="Ordenamos antecedentes, plazos y prioridades para que la gestión contable, tributaria y laboral sea más clara."
          />
          <ul className="home-points">
            <li>Menos incertidumbre frente a declaraciones y requerimientos.</li>
            <li>Más orden para responder y tomar decisiones.</li>
            <li>Un alcance claro antes de comenzar.</li>
          </ul>
        </div>
        <div className="solution-panel">
          <p className="eyebrow">Solución</p>
          <h2>Diagnóstico inicial, alcance definido y acompañamiento directo.</h2>
          <p>
            Revisamos el caso, ordenamos prioridades y definimos el servicio que corresponde con información concreta.
          </p>
          <a className="text-link" href="/contacto">
            Coordinar diagnóstico
          </a>
        </div>
      </section>

      <section className="section muted-section">
        <div className="section-shell">
          <SectionHeading
            eyebrow="Beneficios"
            title="Una asesoría pensada para reducir fricción y aumentar control"
            text="Tres prioridades que sostienen el trabajo: diagnóstico, cumplimiento y orden documental."
            align="center"
          />
          <div className="bento-grid">
            {benefitBlocks.map((benefit, index) => (
              <article key={benefit.title} className={`bento-card bento-${benefit.tone} ${index === 0 ? 'is-large' : ''}`}>
                <span>{benefit.code}</span>
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <SectionHeading
          eyebrow="Servicios principales"
          title="Cobertura para las obligaciones que más impactan tu operación"
          text="Una selección de los servicios más solicitados. El detalle completo está disponible en la sección Servicios."
        />
        <div className="service-bento">
          {highlightedServices.map((service) => (
            <article key={service.slug}>
              <span>{service.code}</span>
              <h3>{service.name}</h3>
              <p>{service.summary}</p>
              <a className="text-link" href={`/servicios/${service.slug}`}>
                Ver alcance
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="section process-section">
        <SectionHeading
          eyebrow="Proceso"
          title="De la primera revisión a una gestión ordenada"
          text="Un proceso breve para conocer el punto de partida antes de proponer una solución."
        />
        <div className="process-grid">
          {processSteps.map((step, index) => (
            <article key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeading
          eyebrow="Recursos"
          title="Guías y alertas para ordenar dudas frecuentes"
          text="Contenido práctico sobre temas tributarios y laborales, respaldado por fuentes oficiales."
        />
        <div className="resource-grid compact">
          {resources.slice(0, 2).map((resource) => (
            <article key={resource.slug} className="resource-card">
              <div>
                <p className="service-kicker">{resource.category}</p>
                <h3>{resource.title}</h3>
                <p>{resource.summary}</p>
              </div>
              <a className="text-link" href="/recursos">
                Ver recursos
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="section faq-section">
        <SectionHeading
          eyebrow="Preguntas frecuentes"
          title="Respuestas directas para avanzar sin dudas básicas"
          text="Lo esencial antes de solicitar el diagnóstico inicial."
        />
        <FAQAccordion items={faq.slice(0, 4)} />
      </section>

      <CTASection
        title="Solicita un diagnóstico inicial gratuito"
        text="Comparte tu situación y coordinaremos una revisión para definir el alcance que corresponde."
      />
    </>
  );
}
