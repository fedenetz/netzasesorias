export function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Ruta de navegacion">
      {items.map((item, index) => (
        <span key={item.href || item.label}>
          {item.href ? <a href={item.href}>{item.label}</a> : <strong>{item.label}</strong>}
          {index < items.length - 1 ? <span aria-hidden="true">/</span> : null}
        </span>
      ))}
    </nav>
  );
}
