import { Breadcrumbs } from '../components/Breadcrumbs.jsx';
import { CTASection } from '../components/CTASection.jsx';
import { privacyPolicy } from '../data/legal.js';

export function PrivacyPage() {
  return (
    <>
      <section className="page-hero compact-hero">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Inicio', href: '/' },
              { label: 'Politica de privacidad' },
            ]}
          />
          <p className="eyebrow">Privacidad</p>
          <h1>{privacyPolicy.title}</h1>
          <p>{privacyPolicy.intro}</p>
        </div>
      </section>

      <section className="section legal-content">
        {privacyPolicy.sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </article>
        ))}
      </section>

      <CTASection
        title="Canal de privacidad"
        text="Puedes solicitar actualizacion, rectificacion o eliminacion de datos usando los canales de contacto publicados."
        primaryLabel="Escribir a Netz"
      />
    </>
  );
}
