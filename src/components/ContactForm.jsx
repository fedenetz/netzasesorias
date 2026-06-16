import { services } from '../data/services.js';
import { company } from '../data/company.js';

export function ContactForm() {
  return (
    <form
      className="contact-form"
      name="contacto-netz"
      method="POST"
      action="/contacto"
      data-netlify="true"
      netlify-honeypot="bot-field"
    >
      <input type="hidden" name="form-name" value="contacto-netz" />
      <p className="honeypot">
        <label>
          No completar
          <input name="bot-field" tabIndex="-1" autoComplete="off" />
        </label>
      </p>
      <div className="form-grid">
        <label>
          Nombre
          <input name="name" type="text" autoComplete="name" required />
        </label>
        <label>
          Empresa
          <input name="company" type="text" autoComplete="organization" />
        </label>
        <label>
          RUT empresa opcional
          <input name="rut" type="text" />
        </label>
        <label>
          Telefono
          <input name="phone" type="tel" autoComplete="tel" required />
        </label>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Servicio requerido
          <select name="service" required defaultValue="">
            <option value="" disabled>
              Selecciona una opcion
            </option>
            {services.map((service) => (
              <option key={service.slug} value={service.name}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Mensaje
        <textarea name="message" rows="6" required />
      </label>
      <button className="button button-primary" type="submit">
        Enviar solicitud
      </button>
      <p className="form-status">
        Tambien puedes escribir directamente a <a href={company.emailHref}>{company.email}</a> o por{' '}
        <a href={company.whatsappHref}>WhatsApp</a>.
      </p>
    </form>
  );
}
