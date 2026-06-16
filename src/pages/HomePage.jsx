import { CTASection } from '../components/CTASection.jsx';
import { FAQAccordion } from '../components/FAQAccordion.jsx';
import { Hero } from '../components/Hero.jsx';
import { PlaceholderImage } from '../components/PlaceholderImage.jsx';
import { SectionHeading } from '../components/SectionHeading.jsx';
import { Timeline } from '../components/Timeline.jsx';
import { TrustBar } from '../components/TrustBar.jsx';
import { company, timeline, trustItems } from '../data/company.js';
import { faq } from '../data/faq.js';
import { benefitBlocks, highlightedServices, processSteps, testimonialPlaceholders } from '../data/home.js';
import { resources } from '../data/resources.js';

export function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar items={trustItems} />

      <section className="section split-section problem-section">
        <div>
          <SectionHeading
            eyebrow="Problema que resolvemos"
            title="Cuando la informacion esta dispersa, cumplir se vuelve lento y riesgoso"
            text="La contabilidad, los impuestos y las obligaciones laborales no necesitan mas ruido. Necesitan antecedentes claros, plazos visibles y una gestion que priorice cumplimiento responsable."
          />
          <div className="reason-list">
            <p>Menos incertidumbre frente a declaraciones, renta y requerimientos.</p>
            <p>Mas orden para bancos, instituciones y decisiones internas.</p>
            <p>Un punto de partida claro antes de contratar un servicio mensual.</p>
          </div>
        </div>
        <div className="solution-panel">
          <p className="eyebrow">Solucion</p>
          <h2>Diagnostico inicial, alcance definido y acompanamiento directo.</h2>
          <p>
            La primera revision permite entender el caso, ordenar prioridades y definir que servicio corresponde sin
            promesas excesivas ni informacion inventada.
          </p>
          <a className="text-link" href="/contacto">
            Coordinar diagnostico
          </a>
        </div>
      </section>

      <section className="section muted-section">
        <div className="section-shell">
          <SectionHeading
            eyebrow="Beneficios"
            title="Una asesoria pensada para reducir friccion y aumentar control"
            text="Cada bloque apunta a una necesidad concreta: entender, cumplir, ordenar, decidir o responder ante instituciones."
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
          title="Cobertura para las obligaciones que mas impacto tienen en tu operacion"
          text="Servicios confirmados para empresas, emprendedores, profesionales y personas naturales que necesitan trabajar con mayor claridad."
        />
        <div className="service-bento">
          {highlightedServices.map((service, index) => (
            <article key={service.slug} className={index === 0 || index === 4 ? 'service-feature' : ''}>
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
          title="De la primera revision a una gestion ordenada"
          text="El proceso evita saltar directo a una propuesta sin conocer antecedentes. Eso reduce friccion y mejora la calidad de la decision."
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

      <section className="section split-section visual-section">
        <div>
          <SectionHeading
            eyebrow="Experiencia"
            title="Criterio profesional con una comunicacion mas simple"
            text={company.valueShort}
          />
          <div className="visual-list">
            <p>Revision de antecedentes antes de definir alcance.</p>
            <p>Seguimiento de obligaciones contables, tributarias y laborales.</p>
            <p>Respaldo documental para procesos administrativos.</p>
          </div>
        </div>
        <PlaceholderImage
          src="/placeholders/placeholder-accounting.svg"
          alt="Documentos contables ordenados sobre una mesa de trabajo"
        />
      </section>

      <section className="section split-section reverse history-section">
        <div>
          <SectionHeading eyebrow="Trayectoria" title={company.foundedLabel} text={company.storyToday} />
          <Timeline items={timeline} />
        </div>
        <PlaceholderImage
          src="/placeholders/placeholder-documents.svg"
          alt="Carpeta de documentos tributarios y contables"
        />
      </section>

      <section className="section muted-section">
        <div className="section-shell">
          <SectionHeading
            eyebrow="Testimonios"
            title="Espacios reservados para prueba social autorizada"
            text="No se publican resultados inventados. Estos bloques quedan como placeholder hasta contar con testimonios o casos autorizados."
            align="center"
          />
          <div className="testimonial-grid">
            {testimonialPlaceholders.map((testimonial) => (
              <article key={testimonial.context} className="testimonial-card">
                <p>{testimonial.quote}</p>
                <div>
                  <strong>{testimonial.name}</strong>
                  <span>{testimonial.context}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <SectionHeading
          eyebrow="Recursos"
          title="Guias y alertas para ordenar dudas frecuentes"
          text="Un espacio editorial en desarrollo continuo para explicar temas tributarios y laborales con apoyo de fuentes oficiales."
        />
        <div className="resource-grid compact">
          {resources.slice(0, 3).map((resource) => (
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
          title="Respuestas directas para avanzar sin dudas basicas"
          text="Preguntas orientadas a reducir objeciones antes de solicitar el diagnostico inicial."
        />
        <FAQAccordion items={faq.slice(0, 6)} />
      </section>

      <CTASection
        title="Solicita un diagnostico inicial gratuito"
        text="Comparte tu situacion y coordinaremos una revision inicial para definir el alcance de trabajo que corresponde."
      />
    </>
  );
}
