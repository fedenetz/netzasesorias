export type F29StatusCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export const F29_STATUS_LABELS: Record<F29StatusCode, string> = {
  A: 'Cargada',
  B: 'Error Dig.',
  C: 'Informada',
  D: 'Pagada / Enviada',
  E: 'Pendiente',
  F: 'S/ Movi.',
  G: 'Postergado',
  H: 'Rev. por Scarlen',
};

export interface ClientRow {
  id: string;
  periodId?: string;
  rut: string;
  name: string;
  accountingCode?: string;
  hasCredentials?: boolean;
  accountant: string;
  initials: string;
  year: number;
  month: number;
  amount: number | null;
  filedDate: string | null;
  statusCode: F29StatusCode | null;
  statusLabel: string;
  dueDay: number | null;
  observation: string;
  documents: number;
  updated: string;
}
