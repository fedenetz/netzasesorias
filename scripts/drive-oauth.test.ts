import assert from 'node:assert/strict';
import test from 'node:test';
import { hasDriveReadScope } from '../netlify/functions/drive-scan';

test('accepts only Google scopes that can read existing Drive folders', () => {
  assert.equal(hasDriveReadScope(['openid', 'email']), false);
  assert.equal(hasDriveReadScope(['https://www.googleapis.com/auth/drive.file']), false);
  assert.equal(hasDriveReadScope(['https://www.googleapis.com/auth/drive.readonly']), true);
  assert.equal(hasDriveReadScope(['https://www.googleapis.com/auth/drive']), true);
});
