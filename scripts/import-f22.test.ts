import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { parseF22Workbook } from './import-f22';

test('normalizes annual workflow rows without importing credentials or banking data', () => {
  const workbook = new ExcelJS.Workbook();
  const main = workbook.addWorksheet('Renta AT 2026');
  main.getCell(5, 1).value = 'SECRET_PASSWORD';
  main.getCell(5, 2).value = '076.123.456-7';
  main.getCell(5, 3).value = 'CLIENTE PRUEBA SPA';
  main.getCell(5, 4).value = true;
  main.getCell(5, 5).value = false;
  main.getCell(5, 6).value = true;
  main.getCell(5, 7).value = 150000;
  main.getCell(5, 9).value = new Date('2026-04-20T00:00:00Z');
  main.getCell(5, 10).value = 'Revisar declaración';
  main.getCell(5, 13).value = 'SECRET_BANK';
  main.getCell(5, 14).value = 'SECRET_ACCOUNT';
  main.getCell(5, 15).value = '14 A';

  const detail = workbook.addWorksheet('14 A');
  detail.getCell(3, 4).value = 'ANOTHER_SECRET';
  detail.getCell(3, 10).value = '76.123.456-7';
  detail.getCell(3, 11).value = new Date('2026-03-31T00:00:00Z');
  detail.getCell(3, 12).value = 'CLIENTE PRUEBA SPA';
  detail.getCell(3, 13).value = true;
  detail.getCell(3, 14).value = true;
  detail.getCell(3, 15).value = true;
  detail.getCell(3, 16).value = true;
  detail.getCell(3, 17).value = true;
  detail.getCell(3, 18).value = 'Detalle anual';
  detail.getCell(3, 19).value = '-1250000';
  detail.getCell(3, 20).value = 350000;

  const rows = parseF22Workbook(workbook, 2026);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rut, '76.123.456-7');
  assert.equal(rows[0].bce_status, 'Cargado');
  assert.equal(rows[0].f22_sent, true);
  assert.equal(rows[0].utility_loss_amount, -1250000);
  assert.equal(rows[0].dividends_amount, 350000);
  assert.equal(rows[0].source_sheet, '14 A');
  const serialized = JSON.stringify(rows);
  assert.equal(serialized.includes('SECRET_PASSWORD'), false);
  assert.equal(serialized.includes('SECRET_BANK'), false);
  assert.equal(serialized.includes('SECRET_ACCOUNT'), false);
  assert.equal(serialized.includes('ANOTHER_SECRET'), false);
});
