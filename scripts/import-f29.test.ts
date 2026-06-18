import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { parseF29Sheet } from './import-f29';

test('normaliza meses y excluye credenciales', () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('2026');
  sheet.getCell('A1').value = 'Razón social'; sheet.getCell('B1').value = 'RUT'; sheet.getCell('C1').value = 'Conta';
  sheet.getCell('D1').value = 'Clave'; sheet.getCell('E1').value = 'Enero'; sheet.mergeCells('E1:G1');
  sheet.getCell('H1').value = 'Febrero'; sheet.mergeCells('H1:J1'); sheet.getCell('K1').value = 'Vence';
  sheet.getCell('L1').value = 'Responsable'; sheet.getCell('M1').value = 'Obs'; sheet.getCell('N1').value = 'Rut y clave Cert. Digital';
  ['Monto', 'Fecha', 'Ctrl', 'Monto', 'Fecha', 'Ctrl'].forEach((value, index) => { sheet.getCell(2, index + 5).value = value; });
  sheet.getRow(3).values = ['Cliente Demo SpA', '76.123.456-7', 'C-101', 'SII-SECRETO', 125000, new Date('2026-02-12T00:00:00Z'), 'D', '$0', '', 'F', 20, 'Camila Soto', 'Sin diferencias', 'CERT-SECRETO'];
  sheet.getRow(4).values = ['Cliente Futuro SpA', '77.987.654-3', 'C-102', '', new Date('2026-02-11T00:00:00Z'), '', '.', '', '', '', 12, 'Diego Pérez', '', ''];
  const result = parseF29Sheet(sheet, 2026);
  assert.equal(result.clients.length, 2);
  assert.equal(result.clients[0].has_credentials, true);
  assert.equal(result.periods.length, 4);
  assert.deepEqual(result.periods.map(period => period.status_code), ['D', 'F', null, null]);
  assert.equal(result.periods[0].amount, 125000);
  assert.equal(result.periods[0].filed_date, '2026-02-12');
  assert.equal(result.periods[2].amount, null);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('SII-SECRETO'), false);
  assert.equal(serialized.includes('CERT-SECRETO'), false);
});
