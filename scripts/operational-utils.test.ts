import assert from 'node:assert/strict';
import test from 'node:test';
import { canEditClient, f29WorkflowPriority, filterRecentF29Workbooks, generateHistoryMonths, inferRelevantDocumentType, isF29Workbook, matchesF29Workflow, resolveOperationalAssigneeId } from '../src/admin/operational-utils';

test('F29 suggestions require a matching month, accounting name and xlsx extension', () => {
  assert.equal(isF29Workbook({ name: 'F29 mayo 2026.xlsx', path: 'Impuestos/2026/05 Mayo' }, 2026, 5), true);
  assert.equal(isF29Workbook({ name: 'Balance mayo 2026.xlsx', path: 'Impuestos/2026/05 Mayo' }, 2026, 5), false);
  assert.equal(isF29Workbook({ name: 'F29 abril 2026.xlsx', path: 'Impuestos/2026/04 Abril' }, 2026, 5), false);
  assert.equal(isF29Workbook({ name: 'F29 mayo 2026.xls', path: 'Impuestos/2026/05 Mayo' }, 2026, 5), false);
});

test('quick cache keeps only the last three period workbooks', () => {
  const result = filterRecentF29Workbooks([
    { name: 'IVA junio 2026.xlsx', path: 'Impuestos/2026/06 Junio' },
    { name: 'F29 abril 2026.xlsx', path: 'Impuestos/2026/04 Abril' },
    { name: 'F29 marzo 2026.xlsx', path: 'Impuestos/2026/03 Marzo' },
    { name: 'Balance mayo 2026.xlsx', path: 'Impuestos/2026/05 Mayo' },
  ], new Date(2026, 5, 20));
  assert.deepEqual(result.map(item => item.name), ['IVA junio 2026.xlsx', 'F29 abril 2026.xlsx']);
});

test('profile relevance is inferred from names', () => {
  assert.equal(inferRelevantDocumentType({ name: 'BCE cliente.xlsx' }), 'BCE');
  assert.equal(inferRelevantDocumentType({ name: 'contrato.pdf' }), null);
});

test('history excludes future periods and always contains the current three months', () => {
  const history = generateHistoryMonths([{ id: 'future', year: 2026, month: 7 }, { id: 'may', year: 2026, month: 5 }], new Date(2026, 5, 20));
  assert.deepEqual(history.slice(0, 3).map(item => [item.year, item.month]), [[2026, 6], [2026, 5], [2026, 4]]);
  assert.equal(history.some(item => item.id === 'future'), false);
});

test('accountants can edit only their assigned clients', () => {
  assert.equal(canEditClient('admin', 'admin', null), true);
  assert.equal(canEditClient('accountant', 'u1', 'u1'), true);
  assert.equal(canEditClient('accountant', 'u1', 'u2'), false);
  assert.equal(canEditClient('viewer', 'u1', 'u1'), false);
});

test('F29 operational names resolve to the linked accountant profile', () => {
  const profiles = [{ id: 'gabriela-id', fullName: 'GABRIELA' }, { id: 'paola-id', fullName: 'Paola Muñoz' }];
  assert.equal(resolveOperationalAssigneeId(null, null, '  gabriela ', profiles), 'gabriela-id');
  assert.equal(resolveOperationalAssigneeId(null, null, 'PAOLA MUNOZ', profiles), 'paola-id');
  assert.equal(resolveOperationalAssigneeId('period-id', 'client-id', 'GABRIELA', profiles), 'period-id');
  assert.equal(resolveOperationalAssigneeId(null, 'client-id', 'GABRIELA', profiles), 'gabriela-id');
  assert.equal(resolveOperationalAssigneeId(null, 'client-id', null, profiles), 'client-id');
  assert.equal(resolveOperationalAssigneeId(null, null, 'OTRA PERSONA', profiles), null);
});

test('F29 workflow treats every classified unpaid period as pending work', () => {
  const pending = { periodId: 'p1', statusCode: 'E', taxPaid: false };
  const loaded = { periodId: 'p2', statusCode: 'A', taxPaid: false };
  const informed = { periodId: 'p3', statusCode: 'C', taxPaid: false };
  const paid = { periodId: 'p4', statusCode: 'D', taxPaid: true };
  const noMovement = { periodId: 'p2', statusCode: 'F', taxPaid: false };
  const missing = { periodId: 'p3', statusCode: null, taxPaid: false };
  assert.equal(matchesF29Workflow(noMovement, 'no_movement'), true);
  assert.equal(matchesF29Workflow(missing, 'pending'), false);
  assert.equal(matchesF29Workflow(pending, 'pending'), true);
  assert.equal(matchesF29Workflow(loaded, 'pending'), true);
  assert.equal(matchesF29Workflow(informed, 'pending'), true);
  assert.equal(matchesF29Workflow(paid, 'pending'), false);
  assert.equal(matchesF29Workflow(noMovement, 'pending'), false);
  assert.ok(f29WorkflowPriority(missing) < f29WorkflowPriority(pending));
});
