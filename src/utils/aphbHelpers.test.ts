import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAphbTaxFraction,
  getDefaultAphbHolderCount,
  getDefaultAphbRecipientCount,
  normalizeAphbRecipientRoles,
  resolveAphbRecipients,
} from './aphbHelpers';

const mockRoleMeta = (peran: string) => {
  const map: Record<string, { peran_lower: string; peran_title: string }> = {
    'Pihak I': { peran_lower: 'Pihak pertama', peran_title: 'Pihak Pertama' },
    'Pihak II': { peran_lower: 'Pihak kedua', peran_title: 'Pihak Kedua' },
    'Pihak III': { peran_lower: 'Pihak ketiga', peran_title: 'Pihak Ketiga' },
    'Pihak IV': { peran_lower: 'Pihak keempat', peran_title: 'Pihak Keempat' },
    'Pihak V': { peran_lower: 'Pihak kelima', peran_title: 'Pihak Kelima' },
  };
  return map[peran] ?? { peran_lower: peran, peran_title: peran };
};

test('computeAphbTaxFraction matches exact user examples (n=5, m=1 -> 4/5 = 160/200; n=5, m=2 -> 3/5 = 120/200)', () => {
  const oneRecipient = computeAphbTaxFraction(5, 1);
  assert.equal(oneRecipient.aktif, true);
  assert.equal(oneRecipient.n, 5);
  assert.equal(oneRecipient.m, 1);
  assert.equal(oneRecipient.numerator, 4);
  assert.equal(oneRecipient.faktor, 0.8);
  assert.equal(Math.round(200 * oneRecipient.faktor), 160);

  const twoRecipients = computeAphbTaxFraction(5, 2);
  assert.equal(twoRecipients.aktif, true);
  assert.equal(twoRecipients.n, 5);
  assert.equal(twoRecipients.m, 2);
  assert.equal(twoRecipients.numerator, 3);
  assert.equal(twoRecipients.faktor, 0.6);
  assert.equal(Math.round(200 * twoRecipients.faktor), 120);

  // All holders remain recipients -> 0 new share acquired
  const allRecipients = computeAphbTaxFraction(3, 3);
  assert.equal(allRecipients.aktif, true);
  assert.equal(allRecipients.numerator, 0);
  assert.equal(allRecipients.faktor, 0);

  // Missing / <2 holders -> inactive fallback (faktor = 1)
  const inactive = computeAphbTaxFraction(undefined, undefined);
  assert.equal(inactive.aktif, false);
  assert.equal(inactive.faktor, 1);
});

test('normalizeAphbRecipientRoles handles multi-recipient list and backward-compatible single role', () => {
  const parties = [
    { peran: 'Pihak I' as const },
    { peran: 'Pihak II' as const },
    { peran: 'Pihak III' as const },
    { peran: 'Pihak IV' as const },
  ];

  assert.deepEqual(
    normalizeAphbRecipientRoles(parties, {
      pihak_penerima_aphb_list: ['Pihak II', 'Pihak IV'],
      pihak_penerima_aphb: 'Pihak II',
    }),
    ['Pihak II', 'Pihak IV']
  );

  // Legacy single recipient record
  assert.deepEqual(
    normalizeAphbRecipientRoles(parties, {
      pihak_penerima_aphb: 'Pihak III',
    }),
    ['Pihak III']
  );

  // Default fallback when unspecified
  assert.deepEqual(normalizeAphbRecipientRoles(parties, {}), ['Pihak II']);

  assert.equal(getDefaultAphbHolderCount(parties), 4);
  assert.equal(
    getDefaultAphbRecipientCount(parties, {
      pihak_penerima_aphb_list: ['Pihak II', 'Pihak III'],
    }),
    2
  );
});

test('resolveAphbRecipients formats 1-recipient (pemegang tunggal) and 2-recipient (pemegang hak bersama) deed clauses', () => {
  const ordered = [
    { peran: 'Pihak I', nama: 'Agus Triyono' },
    { peran: 'Pihak II', nama: 'Lesttorini' },
    { peran: 'Pihak III', nama: 'Purwanti' },
  ];

  const single = resolveAphbRecipients(
    ordered,
    { pihak_penerima_aphb: 'Pihak III' },
    mockRoleMeta
  );
  assert.equal(single.isMultiRecipient, false);
  assert.equal(single.recipientCount, 1);
  assert.equal(single.penerimaStatusHak, 'pemegang tunggal');
  assert.equal(single.penerimaKlausul, 'Pihak ketiga atas nama PURWANTI');
  assert.deepEqual(
    single.givers.map((g) => g.nama),
    ['Agus Triyono', 'Lesttorini']
  );

  const multi = resolveAphbRecipients(
    ordered,
    { pihak_penerima_aphb_list: ['Pihak II', 'Pihak III'] },
    mockRoleMeta
  );
  assert.equal(multi.isMultiRecipient, true);
  assert.equal(multi.recipientCount, 2);
  assert.equal(multi.penerimaStatusHak, 'pemegang hak bersama');
  assert.equal(
    multi.penerimaKlausul,
    'Pihak kedua atas nama LESTTORINI dan Pihak ketiga atas nama PURWANTI'
  );
  assert.deepEqual(
    multi.givers.map((g) => g.nama),
    ['Agus Triyono']
  );
});
