import { useState } from 'react';
import { services } from '../data/services.js';
import { company } from '../data/company.js';

export function ContactForm() {
  const [status, setStatus] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    setStatus(
      'Solicitud preparada. Mientras se define el correo corporativo, por favor contacta a Netz Asesorias por telefono para coordinar el diagnostico inicial.'
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
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
        Preparar solicitud
      </button>
      {status ? (
        <p className="form-status" role="status">
          {status} Telefono: <a href={company.phoneHref}>{company.phone}</a>.
        </p>
      ) : null}
    </form>
  );
}
