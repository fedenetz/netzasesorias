import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

const normalizeRut = (value: string) => {
  const clean = value.toUpperCase().replace(/[^0-9K]/g, '');
  if (clean.length < 2) return '';
  const body = clean.slice(0, -1).replace(/^0+/, '') || '0';
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${clean.slice(-1)}`;
};
const normalizeName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value.trim()); value = '';
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

export function parseDriveFolderCsv(csv: string) {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const headerIndex = lines.findIndex(line => /NOMBRE O RAZON SOCIAL/i.test(line) && /ID CARPETA/i.test(line));
  if (headerIndex < 0) throw new Error('No se encontró la fila de encabezados del visor contable.');
  return lines.slice(headerIndex + 1).map(parseCsvLine).map(([name, rut, folderId]) => ({ name, rut: normalizeRut(rut), folderId: folderId?.trim() || null })).filter(row => row.rut);
}

async function main() {
  const args = process.argv.slice(2);
  const input = args.find(argument => !argument.startsWith('--'));
  if (!input) throw new Error('Uso: npm run import:drive-folders -- "Visor Contabilidad.csv" [--commit]');
  const rows = parseDriveFolderCsv(await readFile(resolve(input), 'utf8'));
  const unique = new Map(rows.map(row => [row.rut, row]));
  const duplicates = rows.length - unique.size;
  const withFolder = [...unique.values()].filter(row => row.folderId);
  const commit = args.includes('--commit');
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.');
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: clients, error } = await db.from('clients').select('id,rut,legal_name,drive_folder_id');
  if (error) throw error;
  const clientMap = new Map((clients ?? []).map(client => [normalizeRut(client.rut), client]));
  const clientsByName = (clients ?? []).reduce((groups, client) => { const key = normalizeName(client.legal_name); const current = groups.get(key) ?? []; current.push(client); groups.set(key, current); return groups; }, new Map<string, typeof clients>());
  const matchFor = (row: typeof withFolder[number]) => clientMap.get(row.rut) ?? (clientsByName.get(normalizeName(row.name))?.length === 1 ? clientsByName.get(normalizeName(row.name))![0] : undefined);
  const matched = withFolder.filter(row => matchFor(row));
  const matchedByName = matched.filter(row => !clientMap.has(row.rut));
  const unmatched = withFolder.filter(row => !matchFor(row));
  let updated = 0;
  if (commit) {
    for (const row of matched) {
      const client = matchFor(row)!;
      if (client.drive_folder_id === row.folderId) continue;
      const { error: updateError } = await db.from('clients').update({ drive_folder_id: row.folderId, updated_at: new Date().toISOString() }).eq('id', client.id);
      if (updateError) throw updateError;
      updated++;
    }
    await db.from('activity_log').insert({ action: 'drive_folders_imported', entity_type: 'csv', entity_id: new Date().toISOString(), after_data: { source_rows: rows.length, matched: matched.length, updated, unmatched: unmatched.length } });
  }
  console.log(JSON.stringify({ mode: commit ? 'committed' : 'dry-run', sourceRows: rows.length, uniqueRuts: unique.size, duplicateRuts: duplicates, withFolderId: withFolder.length, missingFolderId: [...unique.values()].filter(row => !row.folderId).length, matchedClients: matched.length, matchedByExactName: matchedByName.length, unmatchedClients: unmatched.length, updated, unmatchedSample: unmatched.slice(0, 10).map(row => ({ rut: row.rut, name: row.name })) }, null, 2));
}

if (process.argv[1]?.endsWith('import-drive-folders.ts')) main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
