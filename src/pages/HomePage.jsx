import { CTASection } from '../components/CTASection.jsx';
import { FAQAccordion } from '../components/FAQAccordion.jsx';
import { Hero } from '../components/Hero.jsx';
import { PlaceholderImage } from '../components/PlaceholderImage.jsx';
import { SectionHeading } from '../components/SectionHeading.jsx';
import { ServiceCard } from '../components/ServiceCard.jsx';
import { Timeline } from '../components/Timeline.jsx';
import { TrustBar } from '../components/TrustBar.jsx';
import { company, timeline, trustItems, workMethod } from '../data/company.js';
import { faq } from '../data/faq.js';
import { featuredServices } from '../data/services.js';

export function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar items={trustItems} />

      <section className="section">
        <SectionHeading
          eyebrow="Servicios principales"
          title="Orden contable, cumplimiento tributario y apoyo laboral"
          text="Servicios confirmados para empresas, emprendedores, profesionales y personas naturales que necesitan trabajar con mayor claridad."
        />
        <div className="service-grid compact">
          {featuredServices.map((service) => (
            <ServiceCard key={service.slug} service={service} compact />
          ))}
        </div>
      </section>

      <section className="section split-section">
        <div>
          <SectionHeading
            eyebrow="Por que elegir NETZ"
            title="Una asesoria cercana, seria y enfocada en cumplimiento"
            text={company.valueShort}
          />
          <div className="reason-list">
            <p>Trayectoria institucional desde 1984.</p>
            <p>Atencion directa y personalizada.</p>
            <p>Enfoque en cumplimiento tributario y resguardo del contribuyente.</p>
            <p>Experiencia en pymes, emprendedores, profesionales y personas naturales.</p>
          </div>
        </div>
        <PlaceholderImage
          src="/placeholders/placeholder-accounting.svg"
          alt="Documentos contables ordenados sobre una mesa de trabajo"
        />
      </section>

      <section className="section muted-section">
        <SectionHeading
          eyebrow="Forma de trabajo"
          title="Diagnostico, ordenamiento y acompanamiento"
          text="El proceso parte con una revision inicial y avanza segun los antecedentes disponibles y el alcance del servicio."
          align="center"
        />
        <ol className="method-list">
          {workMethod.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="section split-section reverse">
        <div>
          <SectionHeading eyebrow="Historia" title={company.foundedLabel} text={company.storyToday} />
          <Timeline items={timeline} />
        </div>
        <PlaceholderImage
          src="/placeholders/placeholder-documents.svg"
          alt="Carpeta de documentos tributarios y contables"
        />
      </section>

      <section className="section">
        <SectionHeading
          eyebrow="Preguntas frecuentes"
          title="Respuestas directas para comenzar con claridad"
          text="Informacion base validada para la primera version del sitio."
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
