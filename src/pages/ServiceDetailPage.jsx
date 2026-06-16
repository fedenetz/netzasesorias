import { Breadcrumbs } from '../components/Breadcrumbs.jsx';
import { CTASection } from '../components/CTASection.jsx';
import { FAQAccordion } from '../components/FAQAccordion.jsx';
import { SectionHeading } from '../components/SectionHeading.jsx';
import { services } from '../data/services.js';

const defaultRequirements = [
  'Identificacion del contribuyente o empresa.',
  'Antecedentes contables, tributarios o laborales disponibles.',
  'Plazos, notificaciones o urgencias conocidas.',
  'Accesos o documentos que permitan revisar el caso con responsabilidad.',
];

function buildFaq(service) {
  return [
    {
      question: `Para quien es ${service.name}?`,
      answer: service.audience,
    },
    {
      question: 'Que se revisa antes de proponer un alcance?',
      answer:
        'Se revisan antecedentes, obligaciones activas, plazos y prioridades para evitar promesas sin informacion suficiente.',
    },
    {
      question: 'El servicio garantiza resultados ante instituciones?',
      answer:
        'No se prometen resultados absolutos. El trabajo busca ordenar informacion, cumplir correctamente y acompanar gestiones segun antecedentes disponibles.',
    },
  ];
}

export function ServiceDetailPage({ service }) {
  const related = services.filter((item) => item.slug !== service.slug).slice(0, 3);

  return (
    <>
      <section className="page-hero services-hero">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Inicio', href: '/' },
              { label: 'Servicios', href: '/servicios' },
              { label: service.name },
            ]}
          />
          <p className="eyebrow">Servicio</p>
          <h1>{service.name}</h1>
          <p>{service.summary}</p>
        </div>
      </section>

      <section className="section service-detail-page">
        <div>
          <SectionHeading
            eyebrow="Alcance"
            title="Una revision con antecedentes antes de definir compromisos"
            text="El servicio se trabaja con informacion disponible, plazos visibles y una propuesta de trabajo coherente con el caso."
          />
          <div className="detail-block">
            <h2>Para quien es</h2>
            <p>{service.audience}</p>
          </div>
          <div className="detail-block">
            <h2>Que resuelve</h2>
            <p>{service.problem}</p>
          </div>
        </div>

        <aside className="detail-panel">
          <h2>Que puede incluir</h2>
          <ul>
            {service.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="section muted-section">
        <div className="section-shell">
          <SectionHeading
            eyebrow="Antecedentes"
            title="Documentos y datos que ayudan a partir con orden"
            text="La lista exacta se confirma en el diagnostico inicial, pero estos puntos suelen acelerar la revision."
            align="center"
          />
          <div className="process-grid">
            {defaultRequirements.map((item, index) => (
              <article key={item}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{item}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section faq-section">
        <SectionHeading
          eyebrow="Preguntas frecuentes"
          title="Dudas habituales antes de solicitar apoyo"
          text="Respuestas breves para entender como se aborda el servicio antes de contactar."
        />
        <FAQAccordion items={buildFaq(service)} />
      </section>

      <section className="section related-section">
        <SectionHeading
          eyebrow="Servicios relacionados"
          title="Otras areas que pueden complementar esta revision"
          text="El alcance final depende del diagnostico y de las obligaciones activas del contribuyente."
        />
        <div className="service-grid compact">
          {related.map((item) => (
            <article key={item.slug} className="mini-card">
              <h3>{item.name}</h3>
              <p>{item.summary}</p>
              <a className="text-link" href={`/servicios/${item.slug}`}>
                Ver detalle
              </a>
            </article>
          ))}
        </div>
      </section>

      <CTASection
        title="Hablemos con antecedentes claros"
        text="Comparte tu situacion y coordinaremos una revision inicial para definir si este servicio corresponde a tu caso."
        primaryLabel="Agenda diagnostico"
      />
    </>
  );
}
