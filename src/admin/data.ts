import { F29_STATUS_LABELS, type ClientRow, type F29StatusCode } from './types';

const make = (id: string, rut: string, name: string, accountant: string, statusCode: F29StatusCode, amount: number | null, filedDate: string | null, dueDay: number, observation = '', documents = 0): ClientRow => ({
  id, periodId: `preview-${id}`, rut, name, accountant, initials: accountant.split(' ').map(part => part[0]).join('').slice(0, 2), f29Enabled: true, f22Enabled: true,
  year: 2026, month: 5, statusCode, statusLabel: F29_STATUS_LABELS[statusCode], amount, filedDate,
  dueDay, observation, documents, updated: id === '1' ? 'Hace 12 min' : id === '2' ? 'Hace 24 min' : 'Ayer',
});

export const clients: ClientRow[] = [
  make('1', '76.432.891-7', 'Comercial Los Alerces SpA', 'Camila Soto', 'A', 1840290, '2026-06-12', 20, 'Revisar nota de crédito 483', 3),
  make('2', '77.105.224-3', 'Inversiones Río Claro Ltda.', 'Diego Pérez', 'D', 732410, '2026-06-10', 20, '', 2),
  make('3', '96.784.120-5', 'Transportes Cordillera S.A.', 'Camila Soto', 'B', null, null, 12, 'Error de digitación; faltan facturas de compra', 1),
  make('4', '76.991.438-K', 'Servicios Médicos Aurora SpA', 'Sofía Muñoz', 'C', 429780, '2026-06-14', 20, 'Esperando cartola bancaria', 2),
  make('5', '77.883.991-6', 'Constructora Norte Sur Ltda.', 'Diego Pérez', 'E', null, null, 12, '', 0),
  make('6', '76.355.027-6', 'Tecnología Puelche SpA', 'Camila Soto', 'F', 0, '2026-06-11', 20, '', 1),
  make('7', '78.204.119-8', 'Agrícola Santa Elena Ltda.', 'Sofía Muñoz', 'G', 920000, null, 20, 'Pago postergado al próximo período', 4),
  make('8', '76.558.310-4', 'Gastronomía Borde Río SpA', 'Scarlen Rojas', 'H', 218450, null, 12, 'Diferencia RCV $218.450', 2),
];

export const docs = [
  { name: 'RCV_2026-05.xlsx', type: 'RCV', mime: 'Excel', modified: '17 jun 2026, 09:41', period: 'Mayo 2026', status: 'Procesado' },
  { name: 'Facturas_compra_mayo.pdf', type: 'F29', mime: 'PDF', modified: '16 jun 2026, 16:22', period: 'Mayo 2026', status: 'Revisar' },
  { name: 'BCE_2025_final.xlsx', type: 'BCE', mime: 'Excel', modified: '28 abr 2026, 11:04', period: 'AT 2026', status: 'Procesado' },
  { name: 'F22_AT2026.pdf', type: 'F22', mime: 'PDF', modified: '25 abr 2026, 18:30', period: 'AT 2026', status: 'Procesado' },
];
