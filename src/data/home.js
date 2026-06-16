import { services } from './services.js';

export const proofPoints = [
  {
    value: '1984',
    label: 'trayectoria iniciada por Enrique Netz',
  },
  {
    value: '3 areas',
    label: 'contable, tributaria y laboral',
  },
  {
    value: 'Concepcion',
    label: 'atencion publica en Biobio',
  },
];

export const benefitBlocks = [
  {
    code: '01',
    title: 'Diagnostico antes de prometer',
    text: 'Se revisa el punto de partida, antecedentes y urgencias antes de definir un alcance de trabajo.',
    tone: 'red',
  },
  {
    code: '02',
    title: 'Obligaciones al dia',
    text: 'Acompanamiento para F29, renta, declaraciones juradas y procesos mensuales dentro de plazos legales.',
    tone: 'green',
  },
  {
    code: '03',
    title: 'Orden documental',
    text: 'Informacion contable, tributaria y laboral organizada para tomar decisiones y responder requerimientos.',
    tone: 'gold',
  },
  {
    code: '04',
    title: 'Lenguaje claro',
    text: 'Comunicacion directa para entender que corresponde hacer, que falta y cuales son los siguientes pasos.',
    tone: 'blue',
  },
  {
    code: '05',
    title: 'Respaldo profesional',
    text: 'Criterio responsable frente a SII, Tesoreria, Previred y procesos administrativos relacionados.',
    tone: 'graphite',
  },
];

export const highlightedServices = services.slice(0, 6).map((service, index) => ({
  ...service,
  code: String(index + 1).padStart(2, '0'),
}));

export const processSteps = [
  {
    title: 'Revisamos el caso',
    text: 'Se identifica el tipo de contribuyente, obligaciones activas, urgencias y antecedentes disponibles.',
  },
  {
    title: 'Ordenamos prioridades',
    text: 'Se separa lo critico de lo operativo para avanzar con un plan realista y sin ruido innecesario.',
  },
  {
    title: 'Definimos alcance',
    text: 'Se propone el servicio correspondiente, plazos, responsabilidades y documentos requeridos.',
  },
  {
    title: 'Acompanamos la gestion',
    text: 'Se mantiene seguimiento mensual o por hito, con comunicacion clara y respaldo documental.',
  },
];

export const testimonialPlaceholders = [
  {
    quote:
      'Reemplazar por testimonio real autorizado. Idealmente debe describir el problema inicial y el resultado concreto percibido.',
    name: 'Cliente por confirmar',
    context: 'Pyme o profesional independiente',
  },
  {
    quote:
      'Reemplazar por testimonio real autorizado. Mantenerlo breve, especifico y verificable para aumentar confianza.',
    name: 'Cliente por confirmar',
    context: 'Empresa en Concepcion',
  },
  {
    quote:
      'Reemplazar por testimonio real autorizado. Evitar promesas absolutas; priorizar orden, claridad y acompanamiento.',
    name: 'Cliente por confirmar',
    context: 'Proceso contable o tributario',
  },
];
