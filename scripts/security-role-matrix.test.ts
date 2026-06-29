import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { authorizeEmployee, type EmployeeAccess } from '../netlify/functions/_shared';

const access = (role: EmployeeAccess['role'], is_active = true, safelisted = true): EmployeeAccess => ({ role, is_active, safelisted });
const allowed = (value: EmployeeAccess, required: 'view' | 'operate' | 'admin') => {
  try { authorizeEmployee(value, required); return true; } catch { return false; }
};

test('authoritative role matrix', () => {
  assert.deepEqual([
    ['admin', allowed(access('admin'), 'view'), allowed(access('admin'), 'operate'), allowed(access('admin'), 'admin')],
    ['accountant', allowed(access('accountant'), 'view'), allowed(access('accountant'), 'operate'), allowed(access('accountant'), 'admin')],
    ['viewer', allowed(access('viewer'), 'view'), allowed(access('viewer'), 'operate'), allowed(access('viewer'), 'admin')],
    ['inactive', allowed(access('accountant', false), 'view'), allowed(access('accountant', false), 'operate'), allowed(access('accountant', false), 'admin')],
    ['non-safelisted', allowed(access('admin', true, false), 'view'), allowed(access('admin', true, false), 'operate'), allowed(access('admin', true, false), 'admin')],
  ], [
    ['admin', true, true, true],
    ['accountant', true, true, false],
    ['viewer', true, false, false],
    ['inactive', false, false, false],
    ['non-safelisted', false, false, false],
  ]);
});

test('every user-triggered mutation function uses shared operator authentication', async () => {
  const files = ['send-email','send-reminder','send-f29-admin-review','prepare-email-attachment','register-email-attachment','drive-scan','scan-drive-folder','upload-f29-document','create-billing-item','update-billing-item','create-payment-link'];
  for (const name of files) {
    const source = await readFile(new URL(`../netlify/functions/${name}.ts`, import.meta.url), 'utf8');
    if (name === 'scan-drive-folder') assert.match(source, /drive-scan/);
    else assert.match(source, /authenticate\(event\)/, `${name} must require operator authentication`);
    assert.doesNotMatch(source, /select\(['"]is_active['"]\)/, `${name} must not authorize on activity alone`);
  }
});

test('scheduled reconciliation rejects public invocation', async () => {
  const source = await readFile(new URL('../netlify/functions/reconcile-scheduled-emails.ts', import.meta.url), 'utf8');
  assert.match(source, /export const handler = schedule\('/);
  assert.doesNotMatch(source, /export const handler: Handler/);
});

test('final SQL state uses operator policies and explicit RPC guards', async () => {
  const source = await readFile(new URL('../supabase/migrations/20260624_security_production_baseline.sql', import.meta.url), 'utf8');
  assert.match(source, /create or replace function public\.can_view\(\)/);
  assert.match(source, /create or replace function public\.can_operate\(\)/);
  assert.match(source, /create or replace function public\.is_admin\(\)/);
  assert.doesNotMatch(source, /for (insert|update|delete|all)[\s\S]{0,160}is_active_employee\(\)/i);
  assert.match(source, /if not public\.can_operate\(\).*Operator access required/);
});
