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
        </div>
      </div>
    </footer>
  );
}
