import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  emailToInviteId,
  estimateJsonUtf8Bytes,
  fitNonAktaForCloudBudget,
  sanitizeAllowedEmails,
  sanitizeFirestoreId,
  stripUndefinedDeep,
} from './cloudSyncHelpers.ts';

test('emailToInviteId matches Firestore CEL regex email.lower().replace("[^a-z0-9]", "_")', () => {
  assert.equal(emailToInviteId('Adipn.Fatkuri@gmail.com'), 'adipn_fatkuri_gmail_com');
  assert.equal(emailToInviteId('  Staf+Loket1@Kantor.go.id '), 'staf_loket1_kantor_go_id');
  assert.match(emailToInviteId('a.b@c.com'), /^[a-zA-Z0-9_-]+$/);
});

test('sanitizeAllowedEmails deduplicates, enforces max 30, and always retains bootstrapped admin', () => {
  const list = sanitizeAllowedEmails([
    'STAF1@gmail.com',
    'staf1@gmail.com',
    'invalid-email',
    'staf2@gmail.com',
  ]);
  assert.deepEqual(list, [BOOTSTRAPPED_ADMIN_EMAIL, 'staf1@gmail.com', 'staf2@gmail.com']);
  const oversized = sanitizeAllowedEmails(
    Array.from({ length: 50 }, (_, i) => `user${i}@example.com`)
  );
  assert.equal(oversized.length, 30);
});

test('sanitizeFirestoreId strips unsafe characters and respects 128-char bound', () => {
  assert.equal(sanitizeFirestoreId('../../bad$id!'), '______bad_id_');
  assert.equal(sanitizeFirestoreId('reg-2026-001'), 'reg-2026-001');
  assert.ok(sanitizeFirestoreId('x'.repeat(200)).length <= 128);
});

test('stripUndefinedDeep removes nested undefined properties without mutating arrays', () => {
  const cleaned = stripUndefinedDeep({
    a: 1,
    b: undefined,
    nested: { x: 'ok', y: undefined },
    arr: [{ k: 'v', z: undefined }],
  });
  assert.deepEqual(cleaned, {
    a: 1,
    nested: { x: 'ok' },
    arr: [{ k: 'v' }],
  });
});

test('fitNonAktaForCloudBudget keeps small payloads intact and trims foto_sket_kasar first when oversized', () => {
  const base = { id: 'reg-1', layanan: 'Pemecahan' };
  const smallNonAkta = {
    foto_sket_kasar: 'data:image/jpeg;base64,' + 'A'.repeat(200),
    foto_sket_pecah: 'data:image/png;base64,' + 'B'.repeat(200),
  };
  const untouched = fitNonAktaForCloudBudget(base, smallNonAkta, 5000);
  assert.deepEqual(untouched.trimmedFields, []);
  assert.equal(untouched.nonAkta.foto_sket_kasar, smallNonAkta.foto_sket_kasar);

  const largeNonAkta = {
    foto_sket_kasar: 'data:image/jpeg;base64,' + 'A'.repeat(6000),
    foto_patok_4: 'data:image/jpeg;base64,' + 'B'.repeat(3000),
    foto_sket_pecah: 'data:image/png;base64,' + 'C'.repeat(1500),
  };
  const fitted = fitNonAktaForCloudBudget(base, largeNonAkta, 5000);
  assert.equal(fitted.trimmedFields[0], 'foto_sket_kasar');
  assert.equal(fitted.nonAkta.foto_sket_kasar, '');
  assert.equal(fitted.nonAkta.foto_sket_pecah, largeNonAkta.foto_sket_pecah);
  assert.ok(estimateJsonUtf8Bytes({ ...base, non_akta: fitted.nonAkta }) <= 5000);
});

