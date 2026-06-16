const navigation = [
  { href: '/', label: 'Inicio' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/servicios', label: 'Servicios' },
  { href: '/contacto', label: 'Contacto' },
];

export function Header() {
  const current = window.location.pathname.replace(/\/$/, '') || '/';

  return (
    <header className="site-header">
      <a className="brand-link" href="/" aria-label="Ir al inicio">
        <img src="/brand/logo-negro.png" alt="Netz Asesorias" />
      </a>
      <nav className="main-nav" aria-label="Navegacion principal">
        {navigation.map((item) => (
          <a key={item.href} href={item.href} aria-current={current === item.href ? 'page' : undefined}>
            {item.label}
          </a>
        ))}
      </nav>
      <a className="header-cta" href="/contacto">
        Solicitar asesoria
      </a>
    </header>
  );
}
