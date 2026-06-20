export type F29StatusCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type EmailStatus = 'not_sent' | 'sending' | 'sent' | 'failed';
export type BillingStatus = 'not_applicable' | 'pending' | 'sent' | 'paid' | 'overdue';
export type EmployeeRole = 'admin' | 'accountant' | 'viewer';

export interface EmployeeAccess {
  id: string;
  profileId: string | null;
  email: string;
  fullName: string;
  role: EmployeeRole;
  isActive: boolean;
  hasSignedIn: boolean;
}

export const F29_STATUS_LABELS: Record<F29StatusCode, string> = {
  A: 'Cargada',
  B: 'Error e-dig',
  C: 'Informada',
  D: 'Pagada / Enviada',
  E: 'Pago pendiente / vencido',
  F: 'Sin movimiento',
  G: 'Postergado',
  H: 'Revisión requerida',
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
  f29Enabled: boolean;
  f22Enabled: boolean;
  accountant: string;
  accountantEmail: string;
  initials: string;
  year: number;
  month: number;
  amount: number | null;
  previousAmount: number | null;
  filedDate: string | null;
  statusCode: F29StatusCode | null;
  statusLabel: string;
  dueDay: number | null;
  observation: string;
  emailStatus: EmailStatus;
  emailSentAt: string | null;
  billingStatus: BillingStatus;
  billingAmount: number | null;
  billingDueDate: string | null;
  paidAt: string | null;
  paymentMethod: string;
  paymentNotes: string;
  taxPaid: boolean;
  taxPaidAt: string | null;
  taxLastReminderAt: string | null;
  taxPaymentDueDate: string | null;
  documents: number;
  updated: string;
}

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  email: string;
  contactType: 'general' | 'billing' | 'legal' | 'operations';
  isBilling: boolean;
  isPrimary: boolean;
  isActive: boolean;
}

export interface BillingItem {
  id: string;
  clientId: string;
  clientName: string;
  rut: string;
  f29PeriodId: string | null;
  description: string;
  amount: number;
  dueDate: string | null;
  status: BillingStatus;
  paidAt: string | null;
  paymentMethod: string;
  notes: string;
  lastReminderAt: string | null;
  paymentLink?: string | null;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  key: string;
  subject: string;
  bodyHtml: string;
}

export interface EmailAttachment {
  id?: string;
  source: 'drive' | 'storage';
  documentId?: string;
  path?: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
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

export interface F22Row {
  id: string;
  clientId: string;
  rut: string;
  name: string;
  taxYear: number;
  preparedToSend: boolean;
  sent: boolean;
  saved: boolean;
  refundAmount: number | null;
  paymentAmount: number | null;
  filedDate: string | null;
  reviewStatus: string;
  taxRegime: string;
  regimeDetail: string;
  bceDate: string | null;
  bceStatus: string;
  f22Ready: boolean | null;
  f22Sent: boolean;
  dj1948: boolean | null;
  dj1948Sent: boolean | null;
  dj1949: boolean | null;
  provisional: boolean | null;
  utilityLossText: string;
  utilityLossAmount: number | null;
  dividendsText: string;
  dividendsAmount: number | null;
  partners: string;
  refundPaymentText: string;
  observation: string;
  responsibleName: string;
  updatedAt: string;
}
