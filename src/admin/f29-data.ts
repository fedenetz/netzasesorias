import { supabase } from './supabase';
import { F29_STATUS_LABELS, type ClientRow, type F29StatusCode } from './types';

type ClientRecord = {
  id: string;
  rut: string;
  legal_name: string;
  accounting_code: string | null;
  has_credentials: boolean;
  drive_folder_id: string | null;
  is_active: boolean;
  assigned_user_id: string | null;
  updated_at: string;
};

type PeriodRecord = {
  id: string;
  client_id: string;
  year: number;
  month: number;
  amount: number | string | null;
  filed_date: string | null;
  status_code: F29StatusCode | null;
  status_label: string | null;
  due_day: number | null;
  responsible_user_id: string | null;
  responsible_name: string | null;
  observation: string | null;
  updated_at: string;
};

export type PeriodHistory = Pick<PeriodRecord, 'id' | 'year' | 'month' | 'amount' | 'filed_date' | 'status_code' | 'status_label'>;

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '—';
const lastUpdated = (value: string) => new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export async function loadAdminRows(year: number, month: number): Promise<ClientRow[]> {
  if (!supabase) return [];
  const [clientsResult, periodsResult, profilesResult, documentsResult] = await Promise.all([
    supabase.from('clients').select('id,rut,legal_name,accounting_code,has_credentials,drive_folder_id,is_active,assigned_user_id,updated_at').eq('is_active', true).order('legal_name'),
    supabase.from('f29_periods').select('id,client_id,year,month,amount,filed_date,status_code,status_label,due_day,responsible_user_id,responsible_name,observation,updated_at').eq('year', year).eq('month', month),
    supabase.from('profiles').select('id,full_name').eq('is_active', true),
    supabase.from('documents').select('client_id,mime_type'),
  ]);
  if (clientsResult.error) throw clientsResult.error;
  if (periodsResult.error) throw periodsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (documentsResult.error) throw documentsResult.error;

  const periods = new Map((periodsResult.data as PeriodRecord[]).map(period => [period.client_id, period]));
  const profiles = new Map((profilesResult.data ?? []).map(profile => [profile.id, profile.full_name ?? 'Sin asignar']));
  const documentCounts = (documentsResult.data ?? []).filter(document => document.mime_type !== 'application/vnd.google-apps.folder').reduce((counts, document) => counts.set(document.client_id, (counts.get(document.client_id) ?? 0) + 1), new Map<string, number>());

  return (clientsResult.data as ClientRecord[]).map(client => {
    const period = periods.get(client.id);
    const accountant = period?.responsible_name || (period?.responsible_user_id ? profiles.get(period.responsible_user_id) : null) || (client.assigned_user_id ? profiles.get(client.assigned_user_id) : null) || 'Sin asignar';
    const statusCode = period?.status_code ?? null;
    return {
      id: client.id,
      periodId: period?.id,
      rut: client.rut,
      name: client.legal_name,
      accountingCode: client.accounting_code ?? undefined,
      hasCredentials: client.has_credentials,
      driveFolderId: client.drive_folder_id,
      isActive: client.is_active,
      accountant,
      initials: initials(accountant),
      year,
      month,
      amount: period?.amount === null || period?.amount === undefined ? null : Number(period.amount),
      filedDate: period?.filed_date ?? null,
      statusCode,
      statusLabel: period?.status_label || (statusCode ? F29_STATUS_LABELS[statusCode] : 'Sin estado'),
      dueDay: period?.due_day ?? null,
      observation: period?.observation ?? '',
      documents: documentCounts.get(client.id) ?? 0,
      updated: lastUpdated(period?.updated_at ?? client.updated_at),
    };
  });
}

export async function loadClientHistory(clientId: string): Promise<PeriodHistory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('f29_periods')
    .select('id,year,month,amount,filed_date,status_code,status_label')
    .eq('client_id', clientId)
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return data as PeriodHistory[];
}
