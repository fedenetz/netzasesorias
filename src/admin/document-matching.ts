export type DocumentMatchCandidate = {
  name: string;
  path?: string;
  mimeType?: string | null;
  modifiedAt?: string | null;
  isFolder?: boolean;
};

export type OperationalDocumentKind = 'f29' | 'f22' | 'bce' | 'rcv' | 'dj_1948' | 'dj_1949' | null;
export type OperationalDocumentArea = 'f29' | 'f22' | 'other';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const F29_NAME = /(^|[^a-z0-9])(?:f\s*[._ -]?\s*29|form(?:ulario)?\s*[._ -]?\s*29)(?=$|[^a-z0-9])/;
const F22_NAME = /(^|[^a-z0-9])(?:f\s*[._ -]?\s*22|form(?:ulario)?\s*[._ -]?\s*22)(?=$|[^a-z0-9])/;
const BCE_NAME = /(^|[^a-z0-9])b\s*[._ -]?\s*c\s*[._ -]?\s*e(?=$|[^a-z0-9])|balance(?:\s+de)?\s+comprobacion|bal\.?\s+comprobacion/;
const F29_NOISE = /(^|[^a-z0-9])(rcv|r\.?\s*[cv]\.?|registro|libro|compras?|ventas?|honorarios?|remuneraciones?|balance|din|boletas?|property.?payments?)(?=$|[^a-z0-9])/;

export const normalizeDocumentText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const filename = (document: DocumentMatchCandidate) => normalizeDocumentText(document.name);
const fullPath = (document: DocumentMatchCandidate) => normalizeDocumentText(`${document.path ?? ''}/${document.name}`);

export function isSpreadsheetDocument(document: DocumentMatchCandidate) {
  if (document.isFolder) return false;
  return /\.(xls|xlsx|xlsm)$/i.test(document.name) || document.mimeType === 'application/vnd.google-apps.spreadsheet';
}

export function pathMatchesMonthlyPeriod(value: string, year: number, month: number) {
  const normalized = normalizeDocumentText(value);
  const yyyy = String(year);
  const yy = yyyy.slice(-2);
  const monthNumber = `0?${month}`;
  const numeric = new RegExp(`(^|[^0-9])${monthNumber}[.\\/_ -](?:${yyyy}|${yy})(?=$|[^0-9])`);
  const reverse = new RegExp(`(^|[^0-9])${yyyy}[.\\/_ -]0?${month}(?=$|[^0-9])`);
  const named = new RegExp(`(^|[^a-z])${MONTHS[month - 1]}[^0-9]*(?:${yyyy}|${yy})(?=$|[^0-9])`);
  return numeric.test(normalized) || reverse.test(normalized) || named.test(normalized);
}

export function documentMatchesPeriod(document: DocumentMatchCandidate, year: number, month: number) {
  return pathMatchesMonthlyPeriod(`${document.path ?? ''}/${document.name}`, year, month);
}

export function inferDocumentArea(path: string): OperationalDocumentArea {
  const value = normalizeDocumentText(path);
  if (/(^|\/)(?:f\s*[._ -]?\s*29|form(?:ulario)?\s*[._ -]?\s*29|iva)(?=$|\/)/.test(value)) return 'f29';
  if (/(^|\/)(?:renta|f\s*[._ -]?\s*22|form(?:ulario)?\s*[._ -]?\s*22)(?=$|\/)/.test(value)) return 'f22';
  return 'other';
}

export function inferOperationalDocumentKind(document: DocumentMatchCandidate): OperationalDocumentKind {
  if (document.isFolder) return null;
  const name = filename(document);
  if (F29_NAME.test(name)) return 'f29';
  if (isSpreadsheetDocument(document) && !F29_NOISE.test(name) && (/(^|[^a-z0-9])iva(?=$|[^a-z0-9])/.test(name) || /(^|[^a-z0-9])(?:imptos?\.?|impuestos?)(?=$|[^a-z0-9])/.test(name))) return 'f29';
  if (F22_NAME.test(name)) return 'f22';
  if (BCE_NAME.test(name)) return 'bce';
  if (/(^|[^a-z0-9])rcv(?=$|[^a-z0-9])|registro.*compra.*venta/.test(name)) return 'rcv';
  if (/dj\s*[._ -]?\s*1948/.test(name)) return 'dj_1948';
  if (/dj\s*[._ -]?\s*1949/.test(name)) return 'dj_1949';
  return null;
}

export function f29DocumentRank(document: DocumentMatchCandidate, year: number, month: number) {
  if (!isSpreadsheetDocument(document) || !documentMatchesPeriod(document, year, month)) return 0;
  const name = filename(document);
  if (F29_NAME.test(name)) return 300;
  if (F29_NOISE.test(name)) return 0;
  if (/(^|[^a-z0-9])iva(?=$|[^a-z0-9])/.test(name)) return 200;
  if (/(^|[^a-z0-9])imptos?\.?|impuestos?(?=$|[^a-z0-9])/.test(name)) return 100;
  return 0;
}

export function isF29Workbook(document: DocumentMatchCandidate, year: number, month: number) {
  return f29DocumentRank(document, year, month) > 0;
}

export function compareF29Documents(left: DocumentMatchCandidate, right: DocumentMatchCandidate, year: number, month: number) {
  return f29DocumentRank(right, year, month) - f29DocumentRank(left, year, month)
    || (Date.parse(right.modifiedAt ?? '') || 0) - (Date.parse(left.modifiedAt ?? '') || 0)
    || left.name.localeCompare(right.name, 'es');
}

export function isF22Document(document: DocumentMatchCandidate, taxYear?: number) {
  if (document.isFolder || inferOperationalDocumentKind(document) !== 'f22') return false;
  return !taxYear || fullPath(document).includes(String(taxYear));
}

export function isBceDocument(document: DocumentMatchCandidate, taxYear?: number) {
  if (document.isFolder || inferOperationalDocumentKind(document) !== 'bce') return false;
  return !taxYear || fullPath(document).includes(String(taxYear));
}
