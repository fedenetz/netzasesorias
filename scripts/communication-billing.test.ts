import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { renderTemplate, sanitizeHtml, validateEmails } from '../netlify/functions/_shared';
import { effectiveBillingStatus } from '../src/admin/billing-utils';

test('renders known variables and leaves no executable HTML', () => {
  const rendered = renderTemplate('<p>{{ client_name }}</p><script>alert(1)</script>', { client_name: 'Cliente Demo' });
  assert.equal(sanitizeHtml(rendered), '<p>Cliente Demo</p>');
});

test('normalizes and deduplicates recipients', () => {
  assert.deepEqual(validateEmails([' Finanzas@Example.cl ', 'finanzas@example.cl'], true), ['finanzas@example.cl']);
  assert.throws(() => validateEmails(['correo-invalido'], true), /invalid/i);
  assert.throws(() => validateEmails([], true), /recipient/i);
});

test('derives overdue without mutating stored billing status', () => {
  assert.equal(effectiveBillingStatus('pending', '2020-01-01', null), 'overdue');
  assert.equal(effectiveBillingStatus('paid', '2020-01-01', '2020-01-01T12:00:00Z'), 'paid');
  assert.equal(effectiveBillingStatus('pending', '2999-01-01', null), 'pending');
});

test('migration includes the core tables, audited RPCs, RLS, and private bucket', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260619_add_email_billing_foundation.sql'), 'utf8');
  for (const table of ['client_contacts', 'email_templates', 'email_logs', 'services', 'client_services', 'billing_items', 'payment_links', 'payment_events', 'communication_files', 'invoices']) assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(sql, /create or replace function public\.finalize_email_delivery/);
  assert.match(sql, /create or replace function public\.upsert_f29_billing/);
  assert.match(sql, /alter table public\.email_logs enable row level security/);
  assert.match(sql, /'email-attachments'.*false/s);
  assert.doesNotMatch(sql, /\bend\s+\$\$/i, 'PL/pgSQL blocks must terminate END with a semicolon before the dollar quote');
  assert.doesNotMatch(sql, /sii_password|certificate_password|raw_credentials/i);
});

test('F29 operations refinement separates tax payment from billing', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260620_refine_f29_operations.sql'), 'utf8');
  assert.match(sql, /add column if not exists tax_paid boolean/);
  assert.match(sql, /add column if not exists last_payment_reminder_at/);
  assert.match(sql, /'f29_payment_reminder'/);
  assert.match(sql, /create or replace function public\.update_f29_admin_observation/);
  assert.match(sql, /role = 'admin'/);
  assert.match(sql, /f29_payment_reminder_sent/);
  assert.doesNotMatch(sql, /\bend\s+\$\$/i);
});

test('F29 mail refinement defines deadlines and scheduled delivery lifecycle', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260621_refine_f29_mail_delivery.sql'), 'utf8');
  assert.match(sql, /f29_electronic_payment_due_date/);
  assert.match(sql, /next_chile_business_date/);
  assert.match(sql, /America\/Santiago/);
  assert.match(sql, /mark_email_scheduled/);
  assert.match(sql, /status_code = 'C'/);
  assert.match(sql, /filed_date = coalesce/);
  assert.doesNotMatch(sql, /\bend\s+\$\$/i);
});

test('admin and billing refinement defines a safelist and audited manual charges', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260622_admin_billing_navigation.sql'), 'utf8');
  assert.match(sql, /create table if not exists public\.employee_email_allowlist/);
  assert.match(sql, /create or replace function public\.manage_employee_allowlist/);
  assert.match(sql, /role = 'admin'/);
  assert.match(sql, /employee_allowlist_(created|updated)/);
  assert.match(sql, /create or replace function public\.handle_new_user/);
  assert.doesNotMatch(sql, /sii_password|certificate_password|raw_credentials/i);
  assert.doesNotMatch(sql, /\bend\s+\$\$/i);
});
