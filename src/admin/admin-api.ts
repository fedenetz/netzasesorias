import { supabase } from './supabase';
import type { EmployeeAccess, EmployeeRole } from './types';

type AllowlistRow = { id: string; email: string; full_name: string; role: EmployeeRole; is_active: boolean; profile_id: string | null };
type ProfileRow = { id: string; email: string; full_name: string | null; role: EmployeeRole; is_active: boolean };

export async function loadEmployeeAccess(): Promise<EmployeeAccess[]> {
  if (!supabase) return [
    { id: 'preview-admin', profileId: 'preview-admin', email: 'richard@ainahue.cl', fullName: 'Richard', role: 'admin', isActive: true, hasSignedIn: true },
    { id: 'preview-gabriela', profileId: null, email: 'gabriela@netzasesorias.cl', fullName: 'GABRIELA', role: 'accountant', isActive: true, hasSignedIn: false },
  ];
  const [allowedResult, profilesResult] = await Promise.all([
    supabase.from('employee_email_allowlist').select('id,email,full_name,role,is_active,profile_id').order('full_name'),
    supabase.from('profiles').select('id,email,full_name,role,is_active').order('full_name'),
  ]);
  if (allowedResult.error) throw allowedResult.error;
  if (profilesResult.error) throw profilesResult.error;
  const allowed = (allowedResult.data ?? []) as AllowlistRow[];
  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const entries = allowed.map(item => ({ id: item.id, profileId: item.profile_id, email: item.email, fullName: item.full_name, role: item.role, isActive: item.is_active, hasSignedIn: Boolean(item.profile_id) }));
  for (const profile of profiles) {
    if (!entries.some(item => item.profileId === profile.id || item.email === profile.email.toLowerCase())) {
      entries.push({ id: profile.id, profileId: profile.id, email: profile.email, fullName: profile.full_name ?? profile.email.split('@')[0], role: profile.role, isActive: profile.is_active, hasSignedIn: true });
    }
  }
  return entries.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
}

export async function saveEmployeeAccess(entry: { id?: string; email: string; fullName: string; role: EmployeeRole; isActive: boolean }) {
  if (!supabase) return;
  const { error } = await supabase.rpc('manage_employee_allowlist', {
    p_id: entry.id ?? null,
    p_email: entry.email,
    p_full_name: entry.fullName,
    p_role: entry.role,
    p_is_active: entry.isActive,
  });
  if (error) throw error;
}
