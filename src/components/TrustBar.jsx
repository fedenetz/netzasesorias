export function TrustBar({ items }) {
  return (
    <section className="trust-bar" aria-label="Razones de confianza">
      {items.map((item) => (
        <div key={item} className="trust-item">
          <span aria-hidden="true" />
          <p>{item}</p>
        </div>
      ))}
    </section>
  );
}
