import ExcelJS, { type CellValue, type Workbook, type Worksheet } from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

export interface ParsedF22Row {
  rut: string;
  rut_key: string;
  legal_name: string;
  tax_year: number;
  prepared_to_send: boolean;
  sent: boolean;
  saved: boolean;
  refund_amount: number | null;
  payment_amount: number | null;
  filed_date: string | null;
  review_status: string | null;
  tax_regime: string | null;
  regime_detail: string | null;
  old_tax_regime: string | null;
  accounting_number: string | null;
  bce_date: string | null;
  bce_status: string;
  f22_ready: boolean | null;
  f22_sent: boolean;
  dj_1948: boolean | null;
  dj_1948_sent: boolean | null;
  dj_1949: boolean | null;
  provisional: boolean | null;
  utility_loss_text: string | null;
  utility_loss_amount: number | null;
  dividends_text: string | null;
  dividends_amount: number | null;
  partners: string | null;
  refund_payment_text: string | null;
  observation: string | null;
  source_sheet: string;
  source_row: number;
}

const text = (value: CellValue): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text ?? '');
    if ('result' in value) return text(value.result as CellValue);
    if ('richText' in value) return value.richText.map(part => part.text).join('');
  }
  return String(value);
};

export const rutKey = (value: CellValue) => {
  const clean = text(value).toUpperCase().replace(/[^0-9K]/g, '');
  if (clean.length < 2) return '';
  return `${clean.slice(0, -1).replace(/^0+/, '') || '0'}-${clean.slice(-1)}`;
};

const formatRut = (key: string) => {
  const [body, verifier] = key.split('-');
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${verifier}`;
};
const nullableText = (value: CellValue) => text(value).trim() || null;
const bool = (value: CellValue) => value === true || ['true', 'si', 'sí', 'x', 'ok', 'enviado', 'pagado'].includes(text(value).trim().toLowerCase());
const nullableBool = (value: CellValue): boolean | null => text(value).trim() === '' ? null : bool(value);
const amount = (value: CellValue): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const raw = text(value).trim();
  if (!raw) return null;
  const negative = raw.includes('-') || /perd/i.test(raw) || (raw.includes('(') && raw.includes(')'));
  const digits = raw.replace(/[^0-9]/g, '');
  return digits ? Number(digits) * (negative ? -1 : 1) : null;
};
const date = (value: CellValue): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && value && 'result' in value) return date(value.result as CellValue);
  if (typeof value === 'number') return new Date(Date.UTC(1899, 11, 30 + value)).toISOString().slice(0, 10);
  const raw = text(value).trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (match) return `${Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3])}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const clientRows = (sheet: Worksheet, startRow: number, rutColumn: number, nameColumn: number) => {
  const rows: number[] = [];
  for (let row = startRow; row <= sheet.rowCount; row++) if (rutKey(sheet.getCell(row, rutColumn).value) && text(sheet.getCell(row, nameColumn).value).trim()) rows.push(row);
  return rows;
};

export function parseF22Workbook(workbook: Workbook, taxYear = 2026) {
  const main = workbook.getWorksheet('Renta AT 2026');
  if (!main) throw new Error('No se encontró la hoja "Renta AT 2026".');
  const rows = new Map<string, ParsedF22Row>();
  for (const sourceRow of clientRows(main, 5, 2, 3)) {
    const key = rutKey(main.getCell(sourceRow, 2).value);
    const filedDate = date(main.getCell(sourceRow, 9).value);
    rows.set(key, {
      rut: formatRut(key), rut_key: key, legal_name: text(main.getCell(sourceRow, 3).value).trim(), tax_year: taxYear,
      prepared_to_send: bool(main.getCell(sourceRow, 4).value), sent: bool(main.getCell(sourceRow, 5).value), saved: bool(main.getCell(sourceRow, 6).value),
      refund_amount: amount(main.getCell(sourceRow, 7).value), payment_amount: amount(main.getCell(sourceRow, 8).value), filed_date: filedDate,
      review_status: nullableText(main.getCell(sourceRow, 12).value), tax_regime: nullableText(main.getCell(sourceRow, 15).value), regime_detail: nullableText(main.getCell(sourceRow, 16).value), old_tax_regime: nullableText(main.getCell(sourceRow, 17).value), accounting_number: nullableText(main.getCell(sourceRow, 18).value),
      bce_date: null, bce_status: 'Pendiente', f22_ready: null, f22_sent: bool(main.getCell(sourceRow, 5).value), dj_1948: null, dj_1948_sent: null, dj_1949: null, provisional: null,
      utility_loss_text: null, utility_loss_amount: null, dividends_text: null, dividends_amount: null, partners: null, refund_payment_text: null,
      observation: nullableText(main.getCell(sourceRow, 10).value), source_sheet: main.name, source_row: sourceRow,
    });
  }

  for (const sheetName of ['14 A', '14DN3']) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) continue;
    for (const sourceRow of clientRows(sheet, 3, 10, 12)) {
      const key = rutKey(sheet.getCell(sourceRow, 10).value);
      const target = rows.get(key);
      if (!target) continue;
      const bceDate = date(sheet.getCell(sourceRow, 11).value);
      const utilityText = nullableText(sheet.getCell(sourceRow, 19).value);
      const dividendsText = nullableText(sheet.getCell(sourceRow, 20).value);
      target.bce_date = bceDate;
      target.bce_status = bceDate ? 'Cargado' : 'Pendiente';
      target.f22_ready = nullableBool(sheet.getCell(sourceRow, 13).value);
      target.f22_sent = bool(sheet.getCell(sourceRow, 14).value);
      target.dj_1948 = nullableBool(sheet.getCell(sourceRow, 15).value);
      target.dj_1948_sent = nullableBool(sheet.getCell(sourceRow, 16).value);
      target.provisional = sheetName === '14 A' ? nullableBool(sheet.getCell(sourceRow, 17).value) : null;
      target.observation = nullableText(sheet.getCell(sourceRow, 18).value) ?? target.observation;
      target.utility_loss_text = utilityText;
      target.utility_loss_amount = amount(sheet.getCell(sourceRow, 19).value);
      target.dividends_text = dividendsText;
      target.dividends_amount = amount(sheet.getCell(sourceRow, 20).value);
      target.partners = nullableText(sheet.getCell(sourceRow, 21).value);
      target.refund_payment_text = nullableText(sheet.getCell(sourceRow, 22).value);
      target.source_sheet = sheetName;
      target.source_row = sourceRow;
    }
  }
  return [...rows.values()];
}

async function commitImport(rows: ParsedF22Row[], source: string) {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.');
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error: schemaError } = await db.from('f22_periods').select('id').limit(1);
  if (schemaError) throw new Error(`Primero ejecuta supabase/migrations/20260618_add_f22_periods.sql. ${schemaError.message}`);
  const { data: existingClients, error: clientReadError } = await db.from('clients').select('id,rut,f29_enabled,f22_enabled');
  if (clientReadError) throw clientReadError;
  const existingByKey = new Map((existingClients ?? []).map(client => [rutKey(client.rut), client]));
  const clientRowsToSave = rows.map(row => {
    const existing = existingByKey.get(row.rut_key);
    return { rut: existing?.rut ?? row.rut, legal_name: row.legal_name, f29_enabled: existing?.f29_enabled ?? false, f22_enabled: true, updated_at: new Date().toISOString() };
  });
  for (let index = 0; index < clientRowsToSave.length; index += 500) {
    const { error } = await db.from('clients').upsert(clientRowsToSave.slice(index, index + 500), { onConflict: 'rut' });
    if (error) throw error;
  }
  const clientIds = new Map<string, string>();
  for (let index = 0; index < clientRowsToSave.length; index += 200) {
    const { data, error } = await db.from('clients').select('id,rut').in('rut', clientRowsToSave.slice(index, index + 200).map(client => client.rut));
    if (error) throw error;
    for (const client of data ?? []) clientIds.set(rutKey(client.rut), client.id);
  }
  const importedAt = new Date().toISOString();
  const periodRows = rows.map(({ rut, rut_key, legal_name, ...row }) => ({ ...row, client_id: clientIds.get(rut_key), imported_at: importedAt, updated_at: importedAt }));
  for (let index = 0; index < periodRows.length; index += 500) {
    const { error } = await db.from('f22_periods').upsert(periodRows.slice(index, index + 500), { onConflict: 'client_id,tax_year' });
    if (error) throw error;
  }
  await db.from('activity_log').insert({ action: 'f22_workbook_imported', entity_type: 'workbook', entity_id: importedAt, after_data: { source, clients: rows.length, detailed_rows: rows.filter(row => row.source_sheet !== 'Renta AT 2026').length, tax_year: rows[0]?.tax_year } });
}

async function main() {
  const args = process.argv.slice(2);
  const input = args.find(argument => !argument.startsWith('--'));
  if (!input) throw new Error('Uso: npm run import:f22 -- "RENTA AT 2026.xlsx" [--commit]');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await readFile(resolve(input)));
  const yearMatch = basename(input).match(/20\d{2}/);
  const taxYear = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
  const rows = parseF22Workbook(workbook, taxYear);
  const commit = args.includes('--commit');
  if (commit) await commitImport(rows, basename(input));
  const report = {
    source: basename(input), mode: commit ? 'committed' : 'dry-run', taxYear, clients: rows.length,
    detailedRows: rows.filter(row => row.source_sheet !== 'Renta AT 2026').length,
    prepared: rows.filter(row => row.prepared_to_send).length, sent: rows.filter(row => row.f22_sent).length, saved: rows.filter(row => row.saved).length,
    bceLoaded: rows.filter(row => row.bce_status === 'Cargado').length, dj1948Sent: rows.filter(row => row.dj_1948_sent).length,
    withObservations: rows.filter(row => row.observation).length,
    security: { rawCredentialsImported: false, bankingDataImported: false, ignoredSensitiveColumns: ['CLAVE', 'BANCO', 'Nº CTA CTE', 'ID PLANILLA', 'ID CARPETA'] },
  };
  const output = resolve('reports/f22-import.json');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
