import ExcelJS, { type CellValue, type Worksheet } from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

export const STATUS_LABELS = {
  A: 'Cargada', B: 'Error Dig.', C: 'Informada', D: 'Pagada / Enviada',
  E: 'Pendiente', F: 'S/ Movi.', G: 'Postergado', H: 'Rev. por Scarlen',
} as const;
type StatusCode = keyof typeof STATUS_LABELS;

export interface ParsedClient {
  rut: string;
  legal_name: string;
  accounting_code: string | null;
  responsible_name: string | null;
  has_credentials: boolean;
}

export interface ParsedPeriod {
  rut: string;
  year: number;
  month: number;
  amount: number | null;
  filed_date: string | null;
  status_code: StatusCode | null;
  status_label: string | null;
  due_day: number | null;
  responsible_name: string | null;
  observation: string | null;
  source_sheet: string;
}

const MONTHS: Record<string, number> = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4,
  mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8,
  septiembre: 9, sept: 9, sep: 9, octubre: 10, oct: 10, noviembre: 11, nov: 11,
  diciembre: 12, dic: 12,
};

const text = (value: CellValue): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text ?? '');
    if ('result' in value) return String(value.result ?? '');
    if ('richText' in value) return value.richText.map(part => part.text).join('');
  }
  return String(value);
};
const normalized = (value: CellValue) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

export function normalizeRut(value: CellValue): string {
  const clean = text(value).toUpperCase().replace(/[^0-9K]/g, '');
  if (clean.length < 2) return '';
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${body}-${clean.slice(-1)}`;
}

const parseAmount = (value: CellValue): number | null => {
  // Excel occasionally contains a date-formatted value in a Monto cell. It is
  // invalid financial data, not a large integer representation of the date.
  if (value instanceof Date) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const raw = text(value).trim();
  if (!raw) return null;
  const negative = raw.includes('(') || raw.startsWith('-');
  const digits = raw.replace(/[^0-9]/g, '');
  return digits ? Number(digits) * (negative ? -1 : 1) : null;
};

const parseDate = (value: CellValue): string | null => {
  if (!value) return null;
  let date: Date | null = value instanceof Date ? value : null;
  if (!date && typeof value === 'number') date = new Date(Date.UTC(1899, 11, 30 + value));
  if (!date) {
    const raw = text(value).trim();
    const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
    if (match) date = new Date(Date.UTC(Number(match[3] ?? new Date().getFullYear()), Number(match[2]) - 1, Number(match[1])));
  }
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
};

const parseDueDay = (value: CellValue): number | null => {
  if (value instanceof Date) return value.getUTCDate();
  const match = text(value).match(/\d{1,2}/);
  const day = match ? Number(match[0]) : null;
  return day && day >= 1 && day <= 31 ? day : null;
};

const status = (value: CellValue): StatusCode | null => {
  const code = text(value).trim().toUpperCase().charAt(0) as StatusCode;
  return code in STATUS_LABELS ? code : null;
};

function findHeaderRow(sheet: Worksheet, predicate: (values: string[]) => boolean) {
  for (let row = 1; row <= Math.min(20, sheet.rowCount); row++) {
    const values = Array.from({ length: sheet.columnCount }, (_, index) => normalized(sheet.getCell(row, index + 1).value));
    if (predicate(values)) return row;
  }
  return 0;
}

function findColumn(sheet: Worksheet, lastHeaderRow: number, terms: string[]) {
  for (let col = 1; col <= sheet.columnCount; col++) {
    for (let row = 1; row <= lastHeaderRow; row++) {
      const value = normalized(sheet.getCell(row, col).value);
      if (terms.some(term => value === term || value.includes(term))) return col;
    }
  }
  return 0;
}

function monthForColumn(sheet: Worksheet, headerRow: number, col: number): number | null {
  for (let currentCol = col; currentCol >= 1; currentCol--) {
    for (let row = headerRow - 1; row >= Math.max(1, headerRow - 4); row--) {
      const value = normalized(sheet.getCell(row, currentCol).value).replace(/[^a-z]/g, '');
      if (MONTHS[value]) return MONTHS[value];
    }
  }
  return null;
}

export function parseF29Sheet(sheet: Worksheet, year: number): { clients: ParsedClient[]; periods: ParsedPeriod[]; ignoredCredentialColumns: number[] } {
  const identityHeaderRow = findHeaderRow(sheet, values => values.some(value => value.includes('razon social')) && values.some(value => value === 'rut'));
  const monthHeaderRow = findHeaderRow(sheet, values => values.filter(value => ['monto', 'fecha', 'ctrl'].includes(value)).length >= 3);
  if (!identityHeaderRow || !monthHeaderRow) throw new Error(`No se reconoció la estructura F29 en la hoja ${sheet.name}.`);
  const lastHeaderRow = Math.max(identityHeaderRow, monthHeaderRow);
  const nameCol = findColumn(sheet, lastHeaderRow, ['razon social']);
  const rutCol = findColumn(sheet, lastHeaderRow, ['rut']);
  const accountingCol = findColumn(sheet, lastHeaderRow, ['conta']);
  const responsibleCol = findColumn(sheet, lastHeaderRow, ['responsable']);
  const dueCol = findColumn(sheet, lastHeaderRow, ['vence']);
  const observationCol = findColumn(sheet, lastHeaderRow, ['obs']);
  const credentialColumns: number[] = [];
  for (let col = 1; col <= sheet.columnCount; col++) {
    const header = Array.from({ length: lastHeaderRow }, (_, index) => normalized(sheet.getCell(index + 1, col).value)).join(' ');
    if (header.includes('clave') || header.includes('cert. digital') || header.includes('cert digital')) credentialColumns.push(col);
  }
  const monthColumns = new Map<number, { amount?: number; date?: number; status?: number }>();
  for (let col = 1; col <= sheet.columnCount; col++) {
    const subheader = normalized(sheet.getCell(monthHeaderRow, col).value);
    if (!['monto', 'fecha', 'ctrl'].includes(subheader)) continue;
    const month = monthForColumn(sheet, monthHeaderRow, col);
    if (!month) continue;
    const group = monthColumns.get(month) ?? {};
    if (subheader === 'monto') group.amount = col;
    if (subheader === 'fecha') group.date = col;
    if (subheader === 'ctrl') group.status = col;
    monthColumns.set(month, group);
  }
  if (!monthColumns.size) throw new Error(`No se encontraron grupos mensuales Monto/Fecha/Ctrl en ${sheet.name}.`);

  const clients: ParsedClient[] = [];
  const periods: ParsedPeriod[] = [];
  for (let row = lastHeaderRow + 1; row <= sheet.rowCount; row++) {
    const rut = normalizeRut(sheet.getCell(row, rutCol).value);
    const legalName = text(sheet.getCell(row, nameCol).value).trim();
    if (!rut || !legalName) continue;
    const responsibleName = responsibleCol ? text(sheet.getCell(row, responsibleCol).value).trim() || null : null;
    clients.push({
      rut, legal_name: legalName,
      accounting_code: accountingCol ? text(sheet.getCell(row, accountingCol).value).trim() || null : null,
      responsible_name: responsibleName,
      has_credentials: credentialColumns.some(col => Boolean(text(sheet.getCell(row, col).value).trim())),
    });
    for (const [month, columns] of monthColumns) {
      const code = columns.status ? status(sheet.getCell(row, columns.status).value) : null;
      periods.push({
        rut, year, month,
        amount: columns.amount ? parseAmount(sheet.getCell(row, columns.amount).value) : null,
        filed_date: columns.date ? parseDate(sheet.getCell(row, columns.date).value) : null,
        status_code: code, status_label: code ? STATUS_LABELS[code] : null,
        due_day: dueCol ? parseDueDay(sheet.getCell(row, dueCol).value) : null,
        responsible_name: responsibleName,
        observation: observationCol ? text(sheet.getCell(row, observationCol).value).trim() || null : null,
        source_sheet: sheet.name,
      });
    }
  }
  return { clients, periods, ignoredCredentialColumns: credentialColumns };
}

export async function parseWorkbook(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const clients = new Map<string, ParsedClient>();
  const clientYears = new Map<string, number>();
  const periodMap = new Map<string, ParsedPeriod>();
  const sheets: Array<{ name: string; clients: number; uniqueClients: number; duplicateClientRows: number; periods: number; uniquePeriods: number; duplicatePeriods: number; ignoredCredentialColumns: number }> = [];
  for (const sheet of workbook.worksheets) {
    if (!/^20\d{2}$/.test(sheet.name)) continue;
    const year = Number(sheet.name);
    const parsed = parseF29Sheet(sheet, year);
    const uniqueSheetClients = new Set(parsed.clients.map(client => client.rut));
    parsed.clients.forEach(client => {
      if (!clientYears.has(client.rut) || year >= clientYears.get(client.rut)!) {
        clients.set(client.rut, client);
        clientYears.set(client.rut, year);
      }
    });
    let duplicatePeriods = 0;
    for (const period of parsed.periods) {
      const key = `${period.rut}|${period.year}|${period.month}`;
      if (periodMap.has(key)) duplicatePeriods++;
      periodMap.set(key, period);
    }
    sheets.push({
      name: sheet.name, clients: parsed.clients.length, uniqueClients: uniqueSheetClients.size,
      duplicateClientRows: parsed.clients.length - uniqueSheetClients.size,
      periods: parsed.periods.length, uniquePeriods: parsed.periods.length - duplicatePeriods, duplicatePeriods,
      ignoredCredentialColumns: parsed.ignoredCredentialColumns.length,
    });
  }
  return { clients: [...clients.values()], periods: [...periodMap.values()], sheets };
}

async function commitImport(parsed: Awaited<ReturnType<typeof parseWorkbook>>) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorios con --commit.');
  const db = createClient(url, key, { auth: { persistSession: false } });
  const clientRows = parsed.clients.map(({ responsible_name: _responsible, ...client }) => client);
  const { error: clientError } = await db.from('clients').upsert(clientRows, { onConflict: 'rut' });
  if (clientError) throw clientError;
  const { data: savedClients, error: lookupError } = await db.from('clients').select('id,rut').in('rut', clientRows.map(client => client.rut));
  if (lookupError) throw lookupError;
  const clientIds = new Map(savedClients.map(client => [client.rut, client.id]));
  const { data: profiles } = await db.from('profiles').select('id,full_name').eq('is_active', true);
  const profileIds = new Map((profiles ?? []).map(profile => [profile.full_name?.trim().toLowerCase(), profile.id]));
  const importedAt = new Date().toISOString();
  const rows = parsed.periods.map(period => {
    const { rut, ...periodData } = period;
    return {
      ...periodData,
      client_id: clientIds.get(rut),
      responsible_user_id: period.responsible_name ? profileIds.get(period.responsible_name.toLowerCase()) ?? null : null,
      imported_at: importedAt,
      updated_at: importedAt,
    };
  });
  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await db.from('f29_periods').upsert(rows.slice(index, index + 500), { onConflict: 'client_id,year,month' });
    if (error) throw error;
  }
  await db.from('activity_log').insert({ action: 'f29_workbook_imported', entity_type: 'workbook', entity_id: importedAt, after_data: { clients: clientRows.length, periods: rows.length, sheets: parsed.sheets } });
}

async function main() {
  const args = process.argv.slice(2);
  const input = args.find(arg => !arg.startsWith('--'));
  if (!input) throw new Error('Uso: npm run import:f29 -- "Formulario 29.xlsx" [--commit] [--out=reports/f29-import.json]');
  const parsed = await parseWorkbook(resolve(input));
  const commit = args.includes('--commit');
  if (commit) await commitImport(parsed);
  const outputArg = args.find(arg => arg.startsWith('--out='));
  const outputPath = resolve(outputArg?.slice(6) ?? 'reports/f29-import.json');
  await mkdir(dirname(outputPath), { recursive: true });
  const periodSummaries = [...parsed.periods.reduce((groups, period) => {
    const key = `${period.year}-${String(period.month).padStart(2, '0')}`;
    const group = groups.get(key) ?? [];
    group.push(period);
    groups.set(key, group);
    return groups;
  }, new Map<string, ParsedPeriod[]>())].map(([period, rows]) => ({
    period,
    totalClients: rows.length,
    statusCounts: { ...Object.fromEntries(Object.keys(STATUS_LABELS).map(code => [code, rows.filter(row => row.status_code === code).length])), unset: rows.filter(row => !row.status_code).length },
    totalAmount: rows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    missingDate: rows.filter(row => !row.filed_date).length,
    withObservations: rows.filter(row => Boolean(row.observation)).length,
  }));
  const report = {
    source: basename(input), mode: commit ? 'committed' : 'dry-run', sheets: parsed.sheets,
    clients: parsed.clients.length, periods: parsed.periods.length,
    statusCounts: { ...Object.fromEntries(Object.keys(STATUS_LABELS).map(code => [code, parsed.periods.filter(period => period.status_code === code).length])), unset: parsed.periods.filter(period => !period.status_code).length },
    amountAudit: {
      largest: parsed.periods.filter(period => period.amount !== null).sort((a, b) => Math.abs(b.amount!) - Math.abs(a.amount!)).slice(0, 10).map(period => ({ rut: period.rut, period: `${period.year}-${String(period.month).padStart(2, '0')}`, amount: period.amount })),
    },
    periodSummaries,
    security: { rawCredentialsImported: false, credentialColumnsIgnored: parsed.sheets.reduce((sum, sheet) => sum + sheet.ignoredCredentialColumns, 0) },
    sample: parsed.periods.slice(0, 5),
  };
  await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
