export function SectionHeading({ eyebrow, title, text, align = 'left' }) {
  return (
    <div className={`section-heading ${align === 'center' ? 'section-heading-center' : ''}`}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
    </div>
  );
}
