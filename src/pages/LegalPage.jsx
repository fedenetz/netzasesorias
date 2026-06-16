import { Breadcrumbs } from '../components/Breadcrumbs.jsx';
import { CTASection } from '../components/CTASection.jsx';
import { legalNotice } from '../data/legal.js';

export function LegalPage() {
  return (
    <>
      <section className="page-hero compact-hero">
        <div>
          <Breadcrumbs
            items={[
              { label: 'Inicio', href: '/' },
              { label: 'Aviso legal' },
            ]}
          />
          <p className="eyebrow">Legal</p>
          <h1>{legalNotice.title}</h1>
          <p>{legalNotice.intro}</p>
        </div>
      </section>

      <section className="section legal-content">
        {legalNotice.sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </article>
        ))}
      </section>

      <CTASection
        title="Necesitas revisar un caso concreto?"
        text="La informacion general del sitio ayuda a orientar, pero cada situacion requiere antecedentes y revision profesional."
        primaryLabel="Contactar"
      />
    </>
  );
}
