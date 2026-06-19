import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDriveFolderCsv } from './import-drive-folders';

test('reads the accounting viewer CSV after its metadata row', () => {
  const csv = '8,2,3\nNOMBRE O RAZON SOCIAL,RUT,ID CARPETA\n"CARRILLO, ALFONSO",05835784-7,folder-123\nSIN CARPETA,07600210-1,\n';
  assert.deepEqual(parseDriveFolderCsv(csv), [
    { name: 'CARRILLO, ALFONSO', rut: '5.835.784-7', folderId: 'folder-123' },
    { name: 'SIN CARPETA', rut: '7.600.210-1', folderId: null },
  ]);
});
