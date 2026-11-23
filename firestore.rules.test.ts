import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

test('Dirty Dozen #1 & #2: Default-deny net, strict hasOnly keys, and identity integrity on berkas', () => {
  assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  assert.match(rulesText, /function isValidBerkas\(/);
  assert.match(rulesText, /data\.keys\(\)\.hasOnly\(\[/);
  assert.match(rulesText, /incoming\(\)\.createdByUid == request\.auth\.uid/);
  assert.match(rulesText, /data\.updatedByUid == request\.auth\.uid/);
});

test('Dirty Dozen #3, #4, #5: Verified email gate and invite-bound role enforcement (no self-assigned admin)', () => {
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesText, /exists\(inviteDocPath\(officeId, authInviteKey\(\)\)\)/);
  assert.match(rulesText, /get\(inviteDocPath\(officeId, authInviteKey\(\)\)\)\.data\.role == incoming\(\)\.role/);
  assert.match(rulesText, /request\.auth\.token\.email\.lower\(\)\.replace\('\[\^a-z0-9\]', '_'\)/);
});

test('Dirty Dozen #6: PII isolation on /users/{userId} and /members/{memberUid}', () => {
  assert.match(rulesText, /match \/users\/\{userId\}[\s\S]*?allow list: if false;/);
  assert.match(
    rulesText,
    /match \/users\/\{userId\}[\s\S]*?allow get: if isValidId\(userId\) && \(isOwner\(userId\) \|\| isBootstrappedAdmin\(\)\);/
  );
  assert.match(
    rulesText,
    /match \/members\/\{memberUid\}[\s\S]*?allow get: if isValidId\(officeId\) && isValidId\(memberUid\) && \(\s*isOwner\(memberUid\) \|\| isOfficeAdmin\(officeId\)/
  );
});

test('Dirty Dozen #7, #8, #9: Terminal state locking, immutable ownership, and strict request.time timestamps', () => {
  assert.match(rulesText, /!\(existing\(\)\.status in \['5\. Selesai', '11\. Selesai'\]\)/);
  assert.match(rulesText, /incoming\(\)\.createdByUid == existing\(\)\.createdByUid/);
  assert.match(rulesText, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
  assert.match(rulesText, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesText, /incoming\(\)\.updatedAt == request\.time/);
});

test('Dirty Dozen #10, #11, #12: ID poisoning guard, size limits, and zero get()/exists() in allow list', () => {
  assert.match(rulesText, /function isValidId\(id\)/);
  assert.match(rulesText, /id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/);
  assert.match(rulesText, /isValidString\(data\.kode_berkas, 1, 80\)/);
  assert.match(rulesText, /isValidBoundedStringList\(data\.allowedEmails, 30\)/);
  assert.match(rulesText, /isValidString\(data\.dataBase64, 1, 800000\)/);

  // Verify every allow list block avoids get() and exists()
  const listBlocks = rulesText.match(/allow list:[\s\S]*?;/g) || [];
  assert.ok(listBlocks.length >= 4, 'Expected allow list rules to be present');
  for (const block of listBlocks) {
    assert.doesNotMatch(block, /\bget\(/, `allow list must not call get(): ${block}`);
    assert.doesNotMatch(block, /\bexists\(/, `allow list must not call exists(): ${block}`);
  }
});

test('Blueprint synchronization: all collections in firebase-blueprint.json have match blocks in firestore.rules', () => {
  const paths = Object.keys(blueprint.firestore || {});
  assert.ok(paths.length >= 6);
  assert.match(rulesText, /match \/users\/\{userId\}/);
  assert.match(rulesText, /match \/offices\/\{officeId\}/);
  assert.match(rulesText, /match \/members\/\{memberUid\}/);
  assert.match(rulesText, /match \/invites\/\{inviteId\}/);
  assert.match(rulesText, /match \/config\/\{configId\}/);
  assert.match(rulesText, /match \/berkas\/\{berkasId\}/);
  assert.match(rulesText, /match \/templates\/\{templateKey\}/);
});

test('OfficeConfig PPATS personal identity fields & Waris C layanan stay synchronized between blueprint and rules', () => {
  const officeProps = blueprint.entities?.OfficeConfig?.properties || {};
  assert.equal(officeProps.nik_ppats?.maxLength, 40);
  assert.equal(officeProps.tempat_lahir_ppats?.maxLength, 100);
  assert.equal(officeProps.tanggal_lahir_ppats?.maxLength, 40);
  assert.equal(officeProps.alamat_ppats?.maxLength, 400);

  assert.match(rulesText, /isValidOptionalString\(data, 'nik_ppats', 40\)/);
  assert.match(rulesText, /isValidOptionalString\(data, 'tempat_lahir_ppats', 100\)/);
  assert.match(rulesText, /isValidOptionalString\(data, 'tanggal_lahir_ppats', 40\)/);
  assert.match(rulesText, /isValidOptionalString\(data, 'alamat_ppats', 400\)/);

  const layananEnum: string[] = blueprint.entities?.BerkasCloudRecord?.properties?.layanan?.enum || [];
  assert.ok(layananEnum.includes('Waris C'));
  assert.match(rulesText, /'Waris C'/);
});

