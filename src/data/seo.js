const baseUrl = 'https://netzasesorias.cl';

export const seo = {
  home: {
    title: 'Netz Asesorias | Contabilidad y asesoria tributaria en Concepcion',
    description:
      'Asesoria contable, tributaria y laboral en Concepcion. Contabilidad mensual, F29, Operacion Renta, remuneraciones y diagnostico inicial gratuito.',
    path: '/',
  },
  servicios: {
    title: 'Servicios contables y tributarios en Concepcion | Netz Asesorias',
    description:
      'Contabilidad mensual, IVA/F29, Operacion Renta/F22, Declaraciones Juradas, remuneraciones, inicio de actividades y acompanamiento ante instituciones.',
    path: '/servicios',
  },
  recursos: {
    title: 'Recursos tributarios y laborales | Netz Asesorias',
    description:
      'Guias, alertas y checklists tributarios y laborales para empresas, profesionales y personas naturales en Chile.',
    path: '/recursos',
  },
  nosotros: {
    title: 'Nosotros | Netz Asesorias desde 1984',
    description:
      'Conoce la trayectoria de Netz Asesorias, firma contable y tributaria en Concepcion fundada por Enrique Netz, con foco en cumplimiento, orden y confianza.',
    path: '/nosotros',
  },
  contacto: {
    title: 'Contacto | Netz Asesorias Concepcion',
    description:
      'Contacta a Netz Asesorias en Concepcion. Solicita diagnostico inicial gratuito para servicios contables, tributarios y laborales.',
    path: '/contacto',
  },
  avisoLegal: {
    title: 'Aviso legal | Netz Asesorias',
    description:
      'Informacion legal general sobre el uso del sitio, alcance profesional, enlaces externos y datos de Netz Asesorias.',
    path: '/aviso-legal',
  },
  privacidad: {
    title: 'Politica de privacidad | Netz Asesorias',
    description:
      'Politica de privacidad y tratamiento de datos personales entregados a traves del sitio web de Netz Asesorias.',
    path: '/privacidad',
  },
};

export function absoluteUrl(path) {
  return `${baseUrl}${path === '/' ? '/' : path}`;
}
