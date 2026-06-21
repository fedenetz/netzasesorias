import assert from 'node:assert/strict';
import test from 'node:test';
import { hasDriveReadScope, inferDocumentType, inferDriveModule } from '../netlify/functions/drive-scan';

test('accepts only Google scopes that can read existing Drive folders', () => {
  assert.equal(hasDriveReadScope(['openid', 'email']), false);
  assert.equal(hasDriveReadScope(['https://www.googleapis.com/auth/drive.file']), false);
  assert.equal(hasDriveReadScope(['https://www.googleapis.com/auth/drive.readonly']), true);
  assert.equal(hasDriveReadScope(['https://www.googleapis.com/auth/drive']), true);
});

test('maps nested Drive paths to the accounting workflow area', () => {
  assert.equal(inferDriveModule('Impuestos/2026/F29/Mayo/formulario.pdf'), 'f29');
  assert.equal(inferDriveModule('Renta/2026/Balances/Rectificado/bce.xlsx'), 'f22');
  assert.equal(inferDriveModule('Personal/Contratos/documento.pdf'), 'other');
});

test('infers operational document types from the filename without inheriting a folder false positive', () => {
  assert.equal(inferDocumentType('resumen.xlsx', 'Impuestos/2026/F29/06/resumen.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'excel');
  assert.equal(inferDocumentType('F.29 - 05.2026 - Cliente.xlsx', 'Impuestos/F.29/F.29 - 2026/05.2026', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'f29');
  assert.equal(inferDocumentType('certificado_vigencia.pdf', 'Legal/certificado_vigencia.pdf', 'application/pdf'), 'certificate');
  assert.equal(inferDocumentType('comprobante_transferencia.pdf', 'Pagos/comprobante_transferencia.pdf', 'application/pdf'), 'receipt');
  assert.equal(inferDocumentType('datos.xlsx', 'General/datos.xlsx', 'application/vnd.ms-excel'), 'excel');
});
