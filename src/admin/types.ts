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
  driveFolderId?: string | null;
  isActive?: boolean;
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

export type DocumentKind = 'f29' | 'rcv' | 'bce' | 'f22' | 'dj_1948' | 'dj_1949' | 'other';

export interface ClientDocument {
  id: string;
  driveFileId: string;
  driveUrl: string | null;
  name: string;
  mimeType: string | null;
  type: DocumentKind;
  processingStatus: string;
  modifiedAt: string | null;
  drivePath: string;
  depth: number;
  module: 'f29' | 'f22' | 'other';
  isFolder: boolean;
}

export interface ClientObservation {
  id: string;
  body: string;
  resolved: boolean;
  createdAt: string;
  author: string;
}

export interface ActivityEntry {
  id: number;
  action: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  createdAt: string;
  actor: string;
}
