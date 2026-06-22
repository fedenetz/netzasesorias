export type OperationalRole = 'admin' | 'accountant' | 'viewer';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export { documentMatchesPeriod, isF29Workbook } from './document-matching';
import { inferOperationalDocumentKind, isF29Workbook } from './document-matching';

export function normalizeOperationalName(value: string | null | undefined) {
  return normalize(value ?? '').replace(/\s+/g, ' ').trim();
}

export function resolveOperationalAssigneeId(
  responsibleUserId: string | null | undefined,
  clientAssignedUserId: string | null | undefined,
  responsibleName: string | null | undefined,
  profiles: Array<{ id: string; fullName: string | null | undefined }>,
) {
  if (responsibleUserId) return responsibleUserId;
  const expectedName = normalizeOperationalName(responsibleName);
  const profileId = expectedName ? profiles.find(profile => normalizeOperationalName(profile.fullName) === expectedName)?.id : null;
  return profileId ?? clientAssignedUserId ?? null;
}

export type DocumentCandidate = { name: string; path?: string; mimeType?: string | null; modifiedAt?: string | null; isFolder?: boolean };

export function filterRecentF29Workbooks(documents: DocumentCandidate[], now = new Date()) {
  const periods = Array.from({ length: 3 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });
  return documents.filter(document => periods.some(period => isF29Workbook(document, period.year, period.month)));
}

export type RelevantDocumentType = 'F29' | 'IVA' | 'BCE' | 'Balance';
export function inferRelevantDocumentType(document: DocumentCandidate): RelevantDocumentType | null {
  const kind = inferOperationalDocumentKind(document);
  if (kind === 'f29') return 'F29';
  if (kind === 'bce') return 'BCE';
  if (document.isFolder) return null;
  const value = normalize(document.name);
  if (/(^|[^a-z0-9])iva([^a-z0-9]|$)/.test(value)) return 'IVA';
  if (/(^|[^a-z0-9])balance([^a-z0-9]|$)/.test(value)) return 'Balance';
  return null;
}

export function fileExtension(name: string) {
  return name.match(/\.([a-z0-9]{1,8})$/i)?.[1].toUpperCase() ?? 'ARCHIVO';
}

export type HistoryPeriod = { id: string; year: number; month: number; [key: string]: unknown };
export function generateHistoryMonths<T extends HistoryPeriod>(history: T[], now = new Date(), minimum = 3): Array<T | (HistoryPeriod & { placeholder: true })> {
  const currentKey = now.getFullYear() * 12 + now.getMonth();
  const valid = history.filter(item => item.year * 12 + item.month - 1 <= currentKey);
  const byPeriod = new Map<string, T | (HistoryPeriod & { placeholder: true })>(valid.map(item => [`${item.year}-${item.month}`, item]));
  for (let offset = 0; offset < minimum; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = date.getFullYear(); const month = date.getMonth() + 1; const key = `${year}-${month}`;
    if (!byPeriod.has(key)) byPeriod.set(key, { id: `empty-${key}`, year, month, placeholder: true });
  }
  return [...byPeriod.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}

export function canEditClient(role: OperationalRole, userId: string | null | undefined, assignedUserId: string | null | undefined) {
  return role === 'admin' || (role === 'accountant' && Boolean(userId) && userId === assignedUserId);
}

export type F29WorkflowFilter = 'pending' | 'review' | 'informed_unpaid' | 'overdue' | 'loaded' | 'informed' | 'paid' | 'missing' | 'issues' | 'postponed' | 'no_movement' | 'all';
type F29WorkflowRow = { periodId?: string; statusCode: string | null; taxPaid?: boolean; reviewStatus?: string; taxPaymentDueDate?: string | null };

export function matchesF29Workflow(row: F29WorkflowRow, filter: F29WorkflowFilter) {
  if (filter === 'all') return true;
  if (filter === 'pending') return Boolean(row.periodId) && row.statusCode !== null && !['D', 'F'].includes(row.statusCode) && !row.taxPaid;
  if (filter === 'loaded') return row.statusCode === 'A';
  if (filter === 'review') return row.reviewStatus === 'pending_admin_review';
  if (filter === 'informed_unpaid') return row.statusCode === 'C' && !row.taxPaid;
  if (filter === 'overdue') return !row.taxPaid && Boolean(row.taxPaymentDueDate && row.taxPaymentDueDate < new Date().toISOString().slice(0, 10));
  if (filter === 'informed') return row.statusCode === 'C';
  if (filter === 'paid') return row.statusCode === 'D' || Boolean(row.taxPaid);
  if (filter === 'missing') return !row.periodId || row.statusCode === null;
  if (filter === 'issues') return row.statusCode === 'B' || row.statusCode === 'H';
  if (filter === 'postponed') return row.statusCode === 'G';
  return row.statusCode === 'F';
}

export type DocumentGroup = 'F29 mensual' | 'F22 / Renta' | 'Comprobantes' | 'Contratos / legales' | 'Cobranza / pagos' | 'Otros documentos';
export function documentGroup(document: { type: string; module: string; name: string; path?: string }): DocumentGroup {
  if (document.type === 'f29' || document.module === 'f29') return 'F29 mensual';
  if (['f22', 'bce', 'dj_1948', 'dj_1949'].includes(document.type) || document.module === 'f22') return 'F22 / Renta';
  if (document.type === 'receipt') return 'Comprobantes';
  if (['contract', 'certificate'].includes(document.type)) return 'Contratos / legales';
  if (/cobran|pago|factur|honorario/i.test(`${document.name} ${document.path ?? ''}`)) return 'Cobranza / pagos';
  return 'Otros documentos';
}

export function isRecentRelevantDocument(document: { type: string; module: string; name: string; path?: string; modifiedAt?: string | null; isFolder?: boolean }, now = new Date()) {
  if (document.isFolder) return false;
  const relevant = documentGroup(document) !== 'Otros documentos';
  if (!relevant) return false;
  if (!document.modifiedAt) return true;
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return new Date(document.modifiedAt) >= cutoff;
}

export function f29WorkflowPriority(row: F29WorkflowRow) {
  if (!row.periodId || row.statusCode === null) return 0;
  return ({ B: 1, H: 1, E: 2, A: 3, C: 4, D: 5, G: 6, F: 7 } as Record<string, number>)[row.statusCode] ?? 8;
}
