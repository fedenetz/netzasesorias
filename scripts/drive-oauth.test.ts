import assert from 'node:assert/strict';
import test from 'node:test';
import { hasDriveReadScope, inferDriveModule } from '../netlify/functions/drive-scan';

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
