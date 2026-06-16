export function Footer({ company }) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <img className="footer-logo" src="/brand/logo-blanco.png" alt="Netz Asesorias" />
          <p>{company.positioning}</p>
        </div>
        <div>
          <h2>Contacto</h2>
          <address>
            {company.address}
            <br />
            <a href={company.phoneHref}>{company.phone}</a>
            <br />
            <a href={company.whatsappHref}>WhatsApp publico</a>
            <br />
            <a href={company.emailHref}>{company.email}</a>
            <br />
            Horario informado: {company.schedule}
          </address>
        </div>
        <div>
          <h2>Legal</h2>
          <p>
            {company.formalName}
            <br />
            RUT {company.rut}
          </p>
          <nav className="footer-links" aria-label="Enlaces legales">
            <a href="/privacidad">Privacidad</a>
            <a href="/aviso-legal">Aviso legal</a>
            <a href="/recursos">Recursos</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
