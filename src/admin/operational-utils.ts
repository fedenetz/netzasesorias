export type OperationalRole = 'admin' | 'accountant' | 'viewer';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

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

export function documentMatchesPeriod(document: DocumentCandidate, year: number, month: number) {
  const value = normalize(`${document.path ?? ''}/${document.name}`);
  const monthPattern = new RegExp(`(^|[\\/_ .-])(?:0?${month}|${MONTHS[month - 1]})(?=$|[\\/_ .-])`, 'i');
  return value.includes(String(year)) && monthPattern.test(value);
}

export function isF29Workbook(document: DocumentCandidate, year: number, month: number) {
  if (document.isFolder || !/\.xlsx$/i.test(document.name)) return false;
  const value = normalize(`${document.path ?? ''}/${document.name}`);
  return documentMatchesPeriod(document, year, month) && /(^|[^a-z0-9])(f29|iva)([^a-z0-9]|$)|formulario\s*29|form\s*29/.test(value);
}

export function filterRecentF29Workbooks(documents: DocumentCandidate[], now = new Date()) {
  const periods = Array.from({ length: 3 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });
  return documents.filter(document => periods.some(period => isF29Workbook(document, period.year, period.month)));
}

export type RelevantDocumentType = 'F29' | 'IVA' | 'BCE' | 'Balance';
export function inferRelevantDocumentType(document: DocumentCandidate): RelevantDocumentType | null {
  if (document.isFolder) return null;
  const value = normalize(`${document.path ?? ''}/${document.name}`);
  if (/(^|[^a-z0-9])f29([^a-z0-9]|$)|formulario\s*29|form\s*29/.test(value)) return 'F29';
  if (/(^|[^a-z0-9])iva([^a-z0-9]|$)/.test(value)) return 'IVA';
  if (/(^|[^a-z0-9])bce([^a-z0-9]|$)|balance\s+de\s+comprobacion/.test(value)) return 'BCE';
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

export type F29WorkflowFilter = 'active' | 'pending' | 'loaded' | 'informed' | 'paid' | 'missing' | 'issues' | 'postponed' | 'no_movement' | 'all';
type F29WorkflowRow = { periodId?: string; statusCode: string | null; taxPaid?: boolean };

export function matchesF29Workflow(row: F29WorkflowRow, filter: F29WorkflowFilter) {
  if (filter === 'all') return true;
  if (filter === 'active') return row.statusCode !== 'F';
  if (filter === 'pending') return row.statusCode === 'E';
  if (filter === 'loaded') return row.statusCode === 'A';
  if (filter === 'informed') return row.statusCode === 'C';
  if (filter === 'paid') return row.statusCode === 'D' || Boolean(row.taxPaid);
  if (filter === 'missing') return !row.periodId || row.statusCode === null;
  if (filter === 'issues') return row.statusCode === 'B' || row.statusCode === 'H';
  if (filter === 'postponed') return row.statusCode === 'G';
  return row.statusCode === 'F';
}

export function f29WorkflowPriority(row: F29WorkflowRow) {
  if (!row.periodId || row.statusCode === null) return 0;
  return ({ B: 1, H: 1, E: 2, A: 3, C: 4, D: 5, G: 6, F: 7 } as Record<string, number>)[row.statusCode] ?? 8;
}
