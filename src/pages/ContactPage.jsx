import { ContactForm } from '../components/ContactForm.jsx';
import { PlaceholderImage } from '../components/PlaceholderImage.jsx';
import { SectionHeading } from '../components/SectionHeading.jsx';
import { company } from '../data/company.js';

export function ContactPage() {
  return (
    <>
      <section className="page-hero contact-hero">
        <div>
          <p className="eyebrow">Contacto</p>
          <h1>Solicita un diagnostico inicial gratuito</h1>
          <p>
            Comparte tu situacion contable, tributaria o laboral. El equipo revisara el alcance y los antecedentes
            necesarios para avanzar con orden.
          </p>
        </div>
      </section>

      <section className="section contact-layout">
        <div>
          <SectionHeading
            eyebrow="Formulario"
            title="Cuentanos que necesitas revisar"
            text="El formulario queda preparado para conectar correo corporativo o backend cuando esos datos esten confirmados."
          />
          <ContactForm />
        </div>

        <aside className="contact-panel">
          <PlaceholderImage
            src="/placeholders/placeholder-meeting.svg"
            alt="Mesa de reunion profesional con documentos y laptop, sin rostros"
          />
          <div className="contact-details">
            <h2>Datos de atencion</h2>
            <p>
              <strong>Telefono:</strong> <a href={company.phoneHref}>{company.phone}</a>
            </p>
            <p>
              <strong>Ubicacion:</strong> {company.address}
            </p>
            <p>
              <strong>Horario informado:</strong> {company.schedule}
            </p>
            <p>
              <strong>Cobertura publica:</strong> {company.publicArea}
            </p>
          </div>
        </aside>
      </section>
    </>
  );
}
