export function PlaceholderImage({ src, alt }) {
  return (
    <figure className="placeholder-figure">
      <img src={src} alt={alt} loading="lazy" />
    </figure>
  );
}
