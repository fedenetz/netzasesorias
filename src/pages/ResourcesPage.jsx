import { Breadcrumbs } from '../components/Breadcrumbs.jsx';
import { CTASection } from '../components/CTASection.jsx';
import { SectionHeading } from '../components/SectionHeading.jsx';
import { company } from '../data/company.js';
import { resources } from '../data/resources.js';

export function ResourcesPage() {
  return (
    <>
      <section className="page-hero compact-hero">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Inicio', href: '/' },
              { label: 'Recursos' },
            ]}
          />
          <p className="eyebrow">Recursos</p>
          <h1>Actualidad tributaria y laboral explicada con claridad</h1>
          <p>
            Espacio editorial para publicar guias, alertas y checklists practicos basados en fuentes oficiales y
            actualizacion continua.
          </p>
        </div>
      </section>

      <section className="section split-section">
        <div>
          <SectionHeading
            eyebrow="Criterio editorial"
            title="Contenido util, sobrio y sujeto a actualizacion"
            text="Los recursos no reemplazan una revision profesional. Sirven para orientar, ordenar preguntas y ayudar a preparar antecedentes antes de una asesoria."
          />
          <div className="reason-list">
            <p>Fuentes oficiales como SII, Direccion del Trabajo y Tesoreria.</p>
            <p>Lenguaje practico para empresas, profesionales y personas naturales.</p>
            <p>{company.editorialOwner}</p>
          </div>
        </div>
        <aside className="solution-panel">
          <p className="eyebrow">Nota importante</p>
          <h2>La normativa puede cambiar.</h2>
          <p>
            Antes de tomar decisiones, valida fechas, obligaciones y criterios aplicables al caso concreto con una
            revision profesional.
          </p>
        </aside>
      </section>

      <section className="section muted-section">
        <div className="section-shell">
          <SectionHeading
            eyebrow="Primer paquete editorial"
            title="Recursos preparados para desarrollo continuo"
            text="Estos bloques quedan listos para convertirse en articulos completos, alertas mensuales o enlaces de apoyo para clientes."
            align="center"
          />
          <div className="resource-grid">
            {resources.map((resource) => (
              <article key={resource.slug} className="resource-card">
                <div>
                  <p className="service-kicker">{resource.category}</p>
                  <h3>{resource.title}</h3>
                  <p>{resource.summary}</p>
                </div>
                <div className="resource-meta">
                  <span>{resource.status}</span>
                  <a href={resource.sourceUrl} target="_blank" rel="noreferrer">
                    {resource.sourceLabel}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title="Tienes una duda tributaria o laboral concreta?"
        text="Comparte los antecedentes disponibles y revisaremos que servicio corresponde antes de avanzar."
        primaryLabel="Hablar con Netz"
      />
    </>
  );
}
