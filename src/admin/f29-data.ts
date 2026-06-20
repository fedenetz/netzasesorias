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
  f29_enabled: boolean;
  f22_enabled: boolean;
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
  email_status: import('./types').EmailStatus;
  sent_at: string | null;
  billing_status: import('./types').BillingStatus;
  billing_amount: number | string | null;
  billing_due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_notes: string | null;
  tax_paid: boolean;
  tax_paid_at: string | null;
  last_payment_reminder_at: string | null;
  tax_payment_due_date: string | null;
  updated_at: string;
};

export type PeriodHistory = Pick<PeriodRecord, 'id' | 'year' | 'month' | 'amount' | 'filed_date' | 'status_code' | 'status_label'>;

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '—';
const lastUpdated = (value: string) => new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export async function loadAdminRows(year: number, month: number, includeAdminObservation = false): Promise<ClientRow[]> {
  if (!supabase) return [];
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const [clientsResult, periodsResult, previousPeriodsResult, profilesResult, documentsResult] = await Promise.all([
    supabase.from('clients').select('id,rut,legal_name,accounting_code,has_credentials,drive_folder_id,is_active,f29_enabled,f22_enabled,assigned_user_id,updated_at').eq('is_active', true).order('legal_name'),
    supabase.from('f29_periods').select('id,client_id,year,month,amount,filed_date,status_code,status_label,due_day,responsible_user_id,responsible_name,observation,email_status,sent_at,billing_status,billing_amount,billing_due_date,paid_at,payment_method,payment_notes,tax_paid,tax_paid_at,last_payment_reminder_at,tax_payment_due_date,updated_at').eq('year', year).eq('month', month),
    supabase.from('f29_periods').select('client_id,amount').eq('year', previousYear).eq('month', previousMonth),
    supabase.from('profiles').select('id,full_name,email').eq('is_active', true),
    supabase.from('documents').select('client_id,mime_type'),
  ]);
  if (clientsResult.error) throw clientsResult.error;
  if (periodsResult.error) throw periodsResult.error;
  if (previousPeriodsResult.error) throw previousPeriodsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (documentsResult.error) throw documentsResult.error;

  const periods = new Map((periodsResult.data as PeriodRecord[]).map(period => [period.client_id, period]));
  const previousAmounts = new Map((previousPeriodsResult.data ?? []).map(period => [period.client_id, period.amount === null ? null : Number(period.amount)]));
  const profiles = new Map((profilesResult.data ?? []).map(profile => [profile.id, { name: profile.full_name ?? 'Sin asignar', email: profile.email ?? '' }]));
  const profilesByName = new Map((profilesResult.data ?? []).map(profile => [String(profile.full_name ?? '').trim().toLowerCase(), profile.email ?? '']));
  const documentCounts = (documentsResult.data ?? []).filter(document => document.mime_type !== 'application/vnd.google-apps.folder').reduce((counts, document) => counts.set(document.client_id, (counts.get(document.client_id) ?? 0) + 1), new Map<string, number>());

  return (clientsResult.data as ClientRecord[]).map(client => {
    const period = periods.get(client.id);
    const assignedProfile = period?.responsible_user_id ? profiles.get(period.responsible_user_id) : client.assigned_user_id ? profiles.get(client.assigned_user_id) : null;
    const accountant = period?.responsible_name || assignedProfile?.name || 'Sin asignar';
    const accountantEmail = assignedProfile?.email || profilesByName.get(accountant.trim().toLowerCase()) || '';
    const amount = period?.amount === null || period?.amount === undefined ? null : Number(period.amount);
    const taxPaid = period?.tax_paid ?? period?.status_code === 'D';
    const overdue = Boolean(period?.tax_payment_due_date && period.tax_payment_due_date < new Date().toISOString().slice(0, 10) && !taxPaid && (amount ?? 0) > 0 && period?.email_status === 'sent');
    const statusCode: F29StatusCode | null = taxPaid && (amount ?? 0) > 0 ? 'D' : overdue ? 'E' : period?.email_status === 'sent' ? 'C' : period?.status_code ?? null;
    return {
      id: client.id,
      periodId: period?.id,
      rut: client.rut,
      name: client.legal_name,
      accountingCode: client.accounting_code ?? undefined,
      hasCredentials: client.has_credentials,
      driveFolderId: client.drive_folder_id,
      isActive: client.is_active,
      f29Enabled: client.f29_enabled,
      f22Enabled: client.f22_enabled,
      accountant,
      accountantEmail,
      initials: initials(accountant),
      year,
      month,
      amount,
      previousAmount: previousAmounts.get(client.id) ?? null,
      filedDate: period?.filed_date ?? null,
      statusCode,
      statusLabel: statusCode ? F29_STATUS_LABELS[statusCode] : 'Sin estado',
      dueDay: period?.due_day ?? null,
      observation: period?.observation ?? '',
      emailStatus: period?.email_status ?? 'not_sent',
      emailSentAt: period?.sent_at ?? null,
      billingStatus: period?.billing_status ?? 'not_applicable',
      billingAmount: period?.billing_amount === null || period?.billing_amount === undefined ? null : Number(period.billing_amount),
      billingDueDate: period?.billing_due_date ?? null,
      paidAt: period?.paid_at ?? null,
      paymentMethod: period?.payment_method ?? '',
      paymentNotes: period?.payment_notes ?? '',
      taxPaid,
      taxPaidAt: period?.tax_paid_at ?? null,
      taxLastReminderAt: period?.last_payment_reminder_at ?? null,
      taxPaymentDueDate: period?.tax_payment_due_date ?? null,
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
