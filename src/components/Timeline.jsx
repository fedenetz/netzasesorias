export function Timeline({ items }) {
  return (
    <div className="timeline">
      {items.map((item) => (
        <article key={item.year}>
          <span>{item.year}</span>
          <p>{item.text}</p>
        </article>
      ))}
    </div>
  );
}
