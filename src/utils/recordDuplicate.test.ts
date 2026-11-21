import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SEED_RECORDS } from './seedData';
import { duplicateBerkasRecord } from './recordDuplicate';
import type { BerkasRecord } from '../types/ppats';

test('duplicateBerkasRecord deep-clones an Akta record with unique ID, kode_berkas, nomor_akta, and resets status to Pemberkasan', () => {
  const source = INITIAL_SEED_RECORDS[0]; // status '5. Selesai', AJB, REG-2026-001
  const fixedNow = new Date('2026-11-21T10:00:00.000Z');

  const copy = duplicateBerkasRecord(source, INITIAL_SEED_RECORDS, fixedNow);

  assert.notEqual(copy.id, source.id);
  assert.ok(copy.id.startsWith('reg-'));
  assert.equal(copy.no_urut, 4);
  assert.equal(copy.kode_berkas, 'REG-2026-004');
  assert.equal(copy.status, '1. Pemberkasan');
  assert.equal(copy.layanan, source.layanan);
  assert.equal(copy.akta.nomor_akta, '004/PPATS/XI/2026');
  assert.equal(copy.akta.tanggal_akta, '');
  assert.equal(copy.akta.nomor_pengantar, '04/2026');
  assert.equal(copy.para_pihak.length, source.para_pihak.length);
  assert.notEqual(copy.para_pihak[0].id, source.para_pihak[0].id);

  // Verify deep clone isolation
  copy.para_pihak[0].nama = 'BERUBAH';
  copy.tanah.pemegang_hak_sertipikat.push('BARU');
  assert.notEqual(source.para_pihak[0].nama, 'BERUBAH');
  assert.equal(source.tanah.pemegang_hak_sertipikat.includes('BARU'), false);
});

test('duplicateBerkasRecord preserves non_akta payload for Non-Akta services and keeps nomor_akta empty', () => {
  const nonAktaSource: BerkasRecord = {
    ...INITIAL_SEED_RECORDS[0],
    id: 'reg-non-akta-1',
    no_urut: 5,
    kode_berkas: 'REG-2026-005',
    layanan: 'Turun Waris',
    status: '4. Proses BPN',
    akta: {
      ...INITIAL_SEED_RECORDS[0].akta,
      nomor_akta: '',
      tanggal_akta: '',
    },
    non_akta: {
      sebutan_pewaris: 'Almarhum',
      nama_pewaris: 'H. SUPARMAN',
      tempat_meninggal: 'Boyolali',
      tanggal_meninggal: '10-02-2024',
      catatan_skw: 'SKW Desa Donohudan',
    },
  };

  const fixedNow = new Date('2026-11-21T10:00:00.000Z');
  const copy = duplicateBerkasRecord(
    nonAktaSource,
    [...INITIAL_SEED_RECORDS, nonAktaSource],
    fixedNow
  );

  assert.equal(copy.no_urut, 6);
  assert.equal(copy.kode_berkas, 'REG-2026-006');
  assert.equal(copy.layanan, 'Turun Waris');
  assert.equal(copy.status, '1. Pemberkasan');
  assert.equal(copy.akta.nomor_akta, '');
  assert.equal(copy.non_akta?.nama_pewaris, 'H. SUPARMAN');

  // Verify deep clone isolation on non_akta
  if (copy.non_akta) {
    copy.non_akta.nama_pewaris = 'UBAH';
  }
  assert.equal(nonAktaSource.non_akta?.nama_pewaris, 'H. SUPARMAN');
});
