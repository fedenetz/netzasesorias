import { company } from './company.js';

export const legalNotice = {
  title: 'Aviso legal',
  intro:
    'Este sitio web entrega informacion general sobre los servicios profesionales de Netz Asesorias. Su contenido no reemplaza una revision particular de antecedentes ni constituye una opinion profesional definitiva para un caso especifico.',
  sections: [
    {
      title: 'Identificacion',
      text: `${company.formalName}, RUT ${company.rut}, con atencion en ${company.address}.`,
    },
    {
      title: 'Uso de la informacion',
      text:
        'Los textos publicados tienen fines informativos y comerciales. Las obligaciones tributarias, contables y laborales pueden variar segun el contribuyente, sus antecedentes, plazos aplicables y normativa vigente.',
    },
    {
      title: 'Alcance profesional',
      text:
        'La contratacion de un servicio requiere diagnostico, revision de documentos, definicion de alcance y aceptacion expresa de condiciones de trabajo. No se garantizan resultados frente a instituciones cuando dependan de informacion incompleta, plazos vencidos o criterios de terceros.',
    },
    {
      title: 'Enlaces externos',
      text:
        'El sitio puede incluir enlaces a organismos publicos o fuentes externas. Netz Asesorias no controla sus contenidos, disponibilidad ni actualizaciones.',
    },
  ],
};

export const privacyPolicy = {
  title: 'Politica de privacidad',
  intro:
    'Esta politica explica como Netz Asesorias trata los datos entregados a traves del sitio web y sus canales de contacto.',
  sections: [
    {
      title: 'Datos que se pueden solicitar',
      text:
        'Nombre, empresa, RUT opcional, telefono, correo electronico, servicio requerido y mensaje enviado voluntariamente por el usuario.',
    },
    {
      title: 'Finalidad del tratamiento',
      text:
        'Los datos se usan para responder consultas, coordinar diagnosticos, evaluar solicitudes de asesoria y mantener comunicacion relacionada con servicios contables, tributarios o laborales.',
    },
    {
      title: 'Confidencialidad',
      text:
        'La informacion recibida se tratara con reserva profesional y solo sera revisada por personas involucradas en la atencion de la solicitud.',
    },
    {
      title: 'Conservacion',
      text:
        'Los datos se conservaran por el tiempo necesario para gestionar la consulta, dar seguimiento comercial o cumplir obligaciones administrativas asociadas.',
    },
    {
      title: 'Derechos del titular',
      text: `El usuario puede solicitar rectificacion, actualizacion o eliminacion de sus datos escribiendo a ${company.email}.`,
    },
    {
      title: 'Canales de contacto',
      text: `Para consultas sobre privacidad o tratamiento de informacion, escribir a ${company.email} o llamar al ${company.phone}.`,
    },
  ],
};
