import { CTASection } from '../components/CTASection.jsx';
import { PlaceholderImage } from '../components/PlaceholderImage.jsx';
import { SectionHeading } from '../components/SectionHeading.jsx';
import { Timeline } from '../components/Timeline.jsx';
import { company, timeline, values } from '../data/company.js';

export function NosotrosPage() {
  return (
    <>
      <section className="page-hero compact-hero">
        <div>
          <p className="eyebrow">Nosotros</p>
          <h1>Trayectoria contable y tributaria desde 1984</h1>
          <p>{company.story}</p>
        </div>
      </section>

      <section className="section split-section">
        <div>
          <SectionHeading eyebrow="Identidad" title="Una firma familiar con criterio profesional" text={company.storyToday} />
          <Timeline items={timeline} />
        </div>
        <PlaceholderImage
          src="/placeholders/placeholder-office.svg"
          alt="Oficina corporativa sobria con documentos y luz natural"
        />
      </section>

      <section className="section two-column-text">
        <article>
          <p className="eyebrow">Mision</p>
          <h2>Ayudar a cumplir con orden, claridad y confianza</h2>
          <p>{company.mission}</p>
        </article>
        <article>
          <p className="eyebrow">Vision</p>
          <h2>Ser una firma reconocida en Concepcion por su seriedad</h2>
          <p>{company.vision}</p>
        </article>
      </section>

      <section className="section muted-section">
        <SectionHeading
          eyebrow="Valores"
          title="Principios para una relacion profesional de largo plazo"
          text="La confianza se construye con cumplimiento, transparencia y comunicacion responsable."
          align="center"
        />
        <div className="values-grid">
          {values.map((value) => (
            <article key={value.name}>
              <h3>{value.name}</h3>
              <p>{value.description}</p>
            </article>
          ))}
        </div>
      </section>

      <CTASection
        title="Conversemos sobre las obligaciones de tu empresa"
        text="Una revision inicial permite entender el punto de partida y ordenar prioridades sin promesas excesivas."
      />
    </>
  );
}
