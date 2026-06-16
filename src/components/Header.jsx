import { useState } from 'react';

const navigation = [
  { href: '/', label: 'Inicio' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/servicios', label: 'Servicios' },
  { href: '/recursos', label: 'Recursos' },
  { href: '/contacto', label: 'Contacto' },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const current = window.location.pathname.replace(/\/$/, '') || '/';

  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand-link" href="/" aria-label="Ir al inicio">
          <img src="/brand/logo-negro.png" alt="Netz Asesorias" />
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-label="Abrir navegacion"
          aria-expanded={isOpen}
          aria-controls="main-navigation"
          onClick={() => setIsOpen((value) => !value)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        <nav id="main-navigation" className={`main-nav ${isOpen ? 'is-open' : ''}`} aria-label="Navegacion principal">
          {navigation.map((item) => (
            <a key={item.href} href={item.href} aria-current={current === item.href ? 'page' : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <a className="header-cta" href="/contacto">
          Hablar con Netz
        </a>
      </div>
    </header>
  );
}
