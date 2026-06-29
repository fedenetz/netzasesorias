import { config } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

config();
config({ path: '.env.local', override: false });

const migrations = ['20260618_add_f22_periods.sql','20260619_add_email_billing_foundation.sql','20260620_refine_f29_operations.sql','20260621_refine_f29_mail_delivery.sql','20260622_admin_billing_navigation.sql','20260623_operational_usability.sql','20260624_security_production_baseline.sql','20260625_transversal_quality.sql','20260626_accountant_f29_assignment.sql','20260627_f29_monthly_workflow.sql'];
const functions = ['send-email','send-reminder','send-f29-admin-review','prepare-email-attachment','register-email-attachment','drive-scan','upload-f29-document','reconcile-scheduled-emails','send-f29-deadline-reminders','create-billing-item','update-billing-item','create-payment-link'];
const envNames = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY','RESEND_API_KEY','RESEND_FROM_EMAIL','RESEND_REPLY_TO_EMAIL'];
let failed = false;
const report = (name: string, pass: boolean, detail = '') => { failed ||= !pass; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };

for (const name of migrations) report(`migration file ${name}`, existsSync(new URL(`../supabase/migrations/${name}`, import.meta.url)));
for (const name of functions) report(`Netlify function ${name}`, existsSync(new URL(`../netlify/functions/${name}.ts`, import.meta.url)));
const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
for (const name of envNames) report(`env documented ${name}`, new RegExp(`^${name}=`, 'm').test(example));
for (const name of envNames) report(`env configured ${name}`, Boolean(process.env[name]));

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc('production_readiness_report');
  report('production catalog RPC', !error, error?.message ?? '');
  if (data && typeof data === 'object') for (const [name, value] of Object.entries(data as Record<string, { pass?: boolean; missing?: unknown }>)) report(`production ${name}`, value.pass === true, JSON.stringify(value));
} else report('production catalog checks', false, 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

console.log(failed ? '\nProduction readiness: FAIL' : '\nProduction readiness: PASS');
process.exitCode = failed ? 1 : 0;
