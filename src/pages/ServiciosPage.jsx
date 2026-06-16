import { CTASection } from '../components/CTASection.jsx';
import { SectionHeading } from '../components/SectionHeading.jsx';
import { ServiceCard } from '../components/ServiceCard.jsx';
import { services } from '../data/services.js';

export function ServiciosPage() {
  return (
    <>
      <section className="page-hero services-hero">
        <div>
          <p className="eyebrow">Servicios</p>
          <h1>Asesoria contable, tributaria y laboral en Concepcion</h1>
          <p>
            Servicios confirmados para mantener obligaciones al dia, ordenar informacion y acompanar procesos
            administrativos segun cada caso.
          </p>
        </div>
      </section>

      <section className="section">
        <SectionHeading
          eyebrow="Oferta confirmada"
          title="Servicios para empresas, emprendedores y profesionales"
          text="Cada servicio se trabaja con alcance definido, antecedentes disponibles y foco en cumplimiento correcto."
        />
        <div className="service-grid">
          {services.map((service) => (
            <ServiceCard key={service.slug} service={service} />
          ))}
        </div>
      </section>

      <CTASection
        title="No sabes por donde partir?"
        text="El diagnostico inicial ayuda a revisar antecedentes, identificar prioridades y definir una propuesta de trabajo."
        primaryLabel="Hablar con Netz"
      />
    </>
  );
}
