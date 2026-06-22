import assert from 'node:assert/strict';
import test from 'node:test';
import { canEditClient, documentGroup, f29WorkflowPriority, filterRecentF29Workbooks, generateHistoryMonths, inferRelevantDocumentType, isF29Workbook, isRecentRelevantDocument, matchesF29Workflow, resolveOperationalAssigneeId } from '../src/admin/operational-utils';
import { inferDocumentArea, inferOperationalDocumentKind, isBceDocument, isF22Document } from '../src/admin/document-matching';

test('F29 suggestions require a matching month, accounting name and xlsx extension', () => {
  assert.equal(isF29Workbook({ name: 'F29 mayo 2026.xlsx', path: 'Impuestos/2026/05 Mayo' }, 2026, 5), true);
  assert.equal(isF29Workbook({ name: 'Balance mayo 2026.xlsx', path: 'Impuestos/2026/05 Mayo' }, 2026, 5), false);
  assert.equal(isF29Workbook({ name: 'F29 abril 2026.xlsx', path: 'Impuestos/2026/04 Abril' }, 2026, 5), false);
  assert.equal(isF29Workbook({ name: 'F29 mayo 2026.xls', path: 'Impuestos/F.29/F.29 - 2026/05.2026' }, 2026, 5), true);
  assert.equal(isF29Workbook({ name: 'F.29 - 05.2026 - Cliente.xlsx', path: 'Impuestos/F.29/F.29 - 2026/05.2026' }, 2026, 5), true);
  assert.equal(isF29Workbook({ name: 'Resumen F-29 05.26.xlsx', path: 'Impuestos/F.29/F.29 - 2026/05.2026' }, 2026, 5), true);
  assert.equal(isF29Workbook({ name: 'AINAHUE CLUB DE CAMPO LTDA.xlsx', path: 'Impuestos/F.29/F.29 - 2026/05.2026' }, 2026, 5), true);
  assert.equal(isF29Workbook({ name: 'RCV_COMPRA_REGISTRO_202605.xlsx', path: 'Impuestos/F.29/F.29 - 2026/05.2026' }, 2026, 5), false);
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
  assert.equal(inferOperationalDocumentKind({ name: 'Form.22 AT 2026.pdf' }), 'f22');
  assert.equal(inferOperationalDocumentKind({ name: 'B.C.E. AT 2026.xlsx' }), 'bce');
  assert.equal(inferOperationalDocumentKind({ name: 'IVA 05.2026 Cliente.xlsx' }), 'f29');
  assert.equal(inferOperationalDocumentKind({ name: 'Libro IVA 05.2026 Cliente.xlsx' }), null);
  assert.equal(isF22Document({ name: 'Formulario 22 AT 2026.pdf', path: 'Impuestos/F.22/2026' }, 2026), true);
  assert.equal(isBceDocument({ name: 'Balance de comprobación 2026.xlsx', path: 'Renta/2026' }, 2026), true);
  assert.equal(inferDocumentArea('Impuestos/F.29/F.29 - 2026/05.2026'), 'f29');
  assert.equal(inferDocumentArea('Impuestos/F.22/2026'), 'f22');
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

test('formal F29 workflow filters review, informed unpaid and overdue rows', () => {
  const review = { periodId: 'p1', statusCode: 'A', reviewStatus: 'pending_admin_review', taxPaid: false };
  const informed = { periodId: 'p2', statusCode: 'C', reviewStatus: 'approved', taxPaid: false };
  const overdue = { ...informed, taxPaymentDueDate: '2020-01-01' };
  assert.equal(matchesF29Workflow(review, 'review'), true);
  assert.equal(matchesF29Workflow(informed, 'informed_unpaid'), true);
  assert.equal(matchesF29Workflow(overdue, 'overdue'), true);
});

test('client documents default to relevant files from the last three months', () => {
  const current = { type: 'f29', module: 'f29', name: 'F29 junio.xlsx', modifiedAt: '2026-06-10', isFolder: false };
  const old = { ...current, modifiedAt: '2026-02-10' };
  const unrelated = { type: 'other', module: 'other', name: 'foto.jpg', modifiedAt: '2026-06-10', isFolder: false };
  assert.equal(documentGroup({ type: 'contract', module: 'other', name: 'Contrato.pdf' }), 'Contratos / legales');
  assert.equal(isRecentRelevantDocument(current, new Date(2026, 5, 22)), true);
  assert.equal(isRecentRelevantDocument(old, new Date(2026, 5, 22)), false);
  assert.equal(isRecentRelevantDocument(unrelated, new Date(2026, 5, 22)), false);
});
