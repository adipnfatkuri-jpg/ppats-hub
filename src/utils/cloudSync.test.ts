import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  emailToInviteId,
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
