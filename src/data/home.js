import { services } from './services.js';

export const proofPoints = [
  {
    value: '+40',
    label: 'anos de experiencia',
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
    text: 'Acompañamiento para F29, renta, declaraciones juradas y procesos mensuales dentro de plazos legales.',
    tone: 'green',
  },
  {
    code: '03',
    title: 'Orden documental',
    text: 'Informacion contable, tributaria y laboral organizada para tomar decisiones y responder requerimientos.',
    tone: 'gold',
  },
];

export const highlightedServices = services.slice(0, 4).map((service, index) => ({
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
    title: 'Acompañamos la gestión',
    text: 'Se mantiene seguimiento mensual o por hito, con comunicación clara y respaldo documental.',
  },
];
