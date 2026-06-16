export function ServiceCard({ service, compact = false }) {
  return (
    <article className="service-card" id={service.slug}>
      <div>
        <p className="service-kicker">Servicio</p>
        <h3>{service.name}</h3>
        <p>{service.summary}</p>
      </div>
      {!compact ? (
        <div className="service-detail">
          <p>
            <strong>Para quien es:</strong> {service.audience}
          </p>
          <p>
            <strong>Que resuelve:</strong> {service.problem}
          </p>
          <ul>
            {service.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <a className="text-link" href={`/servicios/${service.slug}`}>
        Ver detalle
      </a>
    </article>
  );
}
