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
};

export function absoluteUrl(path) {
  return `${baseUrl}${path === '/' ? '/' : path}`;
}
