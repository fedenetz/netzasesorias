import { supabase } from './supabase';
import { F29_STATUS_LABELS, type ClientRow, type F29StatusCode } from './types';
import { resolveOperationalAssigneeId } from './operational-utils';
import { compareF29Documents, isF29Workbook } from './document-matching';

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
  tax_regime: string | null;
  legal_type: string | null;
  legal_representative_email: string | null;
  economic_activity: string | null;
  address: string | null;
  phone: string | null;
  bank_name: string | null;
  checking_account: string | null;
  accounting_type: 'simplified' | 'complete' | null;
  last_drive_scan_at: string | null;
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
const isPeriodExcel = (document: { file_name: string; mime_type: string | null; drive_metadata: unknown }, year: number, month: number) => {
  const metadata = document.drive_metadata && typeof document.drive_metadata === 'object' && !Array.isArray(document.drive_metadata) ? document.drive_metadata as Record<string, unknown> : {};
  return isF29Workbook({ name: document.file_name, path: String(metadata.path ?? ''), mimeType: document.mime_type }, year, month);
};

export async function loadAdminRows(year: number, month: number, includeAdminObservation = false): Promise<ClientRow[]> {
  if (!supabase) return [];
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const [clientsResult, periodsResult, previousPeriodsResult, profilesResult, documentsResult] = await Promise.all([
    supabase.from('clients').select('id,rut,legal_name,accounting_code,has_credentials,drive_folder_id,is_active,f29_enabled,f22_enabled,assigned_user_id,tax_regime,legal_type,legal_representative_email,economic_activity,address,phone,bank_name,checking_account,accounting_type,last_drive_scan_at,updated_at').eq('is_active', true).order('legal_name'),
    supabase.from('f29_periods').select('id,client_id,year,month,amount,filed_date,status_code,status_label,due_day,responsible_user_id,responsible_name,observation,email_status,sent_at,billing_status,billing_amount,billing_due_date,paid_at,payment_method,payment_notes,tax_paid,tax_paid_at,last_payment_reminder_at,tax_payment_due_date,updated_at').eq('year', year).eq('month', month),
    supabase.from('f29_periods').select('client_id,amount').eq('year', previousYear).eq('month', previousMonth),
    supabase.from('profiles').select('id,full_name,email').eq('is_active', true),
    supabase.from('documents').select('id,client_id,file_name,mime_type,drive_web_view_link,drive_metadata'),
  ]);
  if (clientsResult.error) throw clientsResult.error;
  if (periodsResult.error) throw periodsResult.error;
  if (previousPeriodsResult.error) throw previousPeriodsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (documentsResult.error) throw documentsResult.error;

  const periods = new Map((periodsResult.data as PeriodRecord[]).map(period => [period.client_id, period]));
  const previousAmounts = new Map((previousPeriodsResult.data ?? []).map(period => [period.client_id, period.amount === null ? null : Number(period.amount)]));
  const profileRows = (profilesResult.data ?? []).map(profile => ({ id: profile.id, fullName: profile.full_name, email: profile.email ?? '' }));
  const profiles = new Map(profileRows.map(profile => [profile.id, { name: profile.fullName ?? 'Sin asignar', email: profile.email }]));
  const documentCounts = (documentsResult.data ?? []).filter(document => document.mime_type !== 'application/vnd.google-apps.folder').reduce((counts, document) => counts.set(document.client_id, (counts.get(document.client_id) ?? 0) + 1), new Map<string, number>());
  const periodDocuments = new Map<string, { id: string; name: string; url: string | null; mimeType: string | null; path: string }>();
  for (const document of documentsResult.data ?? []) {
    if (!isPeriodExcel(document, year, month)) continue;
    const path = String((document.drive_metadata as Record<string, unknown> | null)?.path ?? '');
    const candidate = { name: document.file_name, path, mimeType: document.mime_type };
    const current = periodDocuments.get(document.client_id);
    if (!current || compareF29Documents(candidate, { name: current.name, path: current.path, mimeType: current.mimeType }, year, month) < 0) {
      periodDocuments.set(document.client_id, { id: document.id, name: document.file_name, url: document.drive_web_view_link, mimeType: document.mime_type, path });
    }
  }

  return (clientsResult.data as ClientRecord[]).map(client => {
    const period = periods.get(client.id);
    const effectiveAssignedUserId = resolveOperationalAssigneeId(period?.responsible_user_id, client.assigned_user_id, period?.responsible_name, profileRows);
    const assignedProfile = effectiveAssignedUserId ? profiles.get(effectiveAssignedUserId) : null;
    const accountant = period?.responsible_name || assignedProfile?.name || 'Sin asignar';
    const accountantEmail = assignedProfile?.email || '';
    const amount = period?.amount === null || period?.amount === undefined ? null : Number(period.amount);
    const taxPaid = period?.tax_paid ?? period?.status_code === 'D';
    const overdue = Boolean(period?.tax_payment_due_date && period.tax_payment_due_date < new Date().toISOString().slice(0, 10) && !taxPaid && (amount ?? 0) > 0 && period?.email_status === 'sent');
    const statusCode: F29StatusCode | null = taxPaid && (amount ?? 0) > 0 ? 'D' : overdue ? 'E' : period?.email_status === 'sent' ? 'C' : period?.status_code ?? null;
    return {
      id: client.id,
      assignedUserId: effectiveAssignedUserId,
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
      lastDriveScanAt: client.last_drive_scan_at,
      f29Document: periodDocuments.has(client.id) ? (() => { const document = periodDocuments.get(client.id)!; return { id: document.id, name: document.name, url: document.url }; })() : null,
      taxRegime: client.tax_regime ?? '',
      legalType: client.legal_type ?? '',
      legalRepresentativeEmail: client.legal_representative_email ?? '',
      economicActivity: client.economic_activity ?? '',
      address: client.address ?? '',
      phone: client.phone ?? '',
      bankName: client.bank_name ?? '',
      checkingAccount: client.checking_account ?? '',
      accountingType: client.accounting_type ?? '',
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
