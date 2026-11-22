import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_OPTIONS, INITIAL_SEED_RECORDS } from './seedData';
import {
  extractDashboardParties,
  isAktaTerbitStatus,
  isTerminalStatus,
  normalizeBerkasStatus,
} from './dashboardHelpers';
import type { BerkasRecord } from '../types/ppats';

test('STATUS_OPTIONS exposes all 11 tracking stages in exact requested order', () => {
  assert.deepEqual(STATUS_OPTIONS, [
    '1. Pemberkasan',
    '2. Validasi',
    '3. Ukur Ulang',
    '4. Analisis Bidang',
    '5. Pecah',
    '6. Validasi Pajak',
    '7. Pengecekan',
    '8. Proses BPN',
    '9. Pelaporan',
    '10. Penerbitan',
    '11. Selesai',
  ]);
});

test('normalizeBerkasStatus preserves all 11 stages and migrates legacy 5-stage statuses seamlessly', () => {
  for (const stage of STATUS_OPTIONS) {
    assert.equal(normalizeBerkasStatus(stage), stage);
  }
  assert.equal(normalizeBerkasStatus('2. Validasi Pajak'), '6. Validasi Pajak');
  assert.equal(normalizeBerkasStatus('3. TTD Akta'), '8. Proses BPN');
  assert.equal(normalizeBerkasStatus('4. Proses BPN'), '8. Proses BPN');
  assert.equal(normalizeBerkasStatus('5. Selesai'), '11. Selesai');
  assert.equal(normalizeBerkasStatus(''), '1. Pemberkasan');
  assert.equal(normalizeBerkasStatus(undefined), '1. Pemberkasan');

  assert.equal(isTerminalStatus('11. Selesai'), true);
  assert.equal(isTerminalStatus('5. Selesai'), true);
  assert.equal(isTerminalStatus('10. Penerbitan'), false);

  assert.equal(isAktaTerbitStatus('8. Proses BPN'), true);
  assert.equal(isAktaTerbitStatus('9. Pelaporan'), true);
  assert.equal(isAktaTerbitStatus('10. Penerbitan'), true);
  assert.equal(isAktaTerbitStatus('11. Selesai'), true);
  assert.equal(isAktaTerbitStatus('6. Validasi Pajak'), false);
});

test('extractDashboardParties returns explicit Pihak I / Pemohon and Pihak Penerima across Akta & Non-Akta services', () => {
  // AJB
  const ajbSummary = extractDashboardParties(INITIAL_SEED_RECORDS[0]);
  assert.equal(ajbSummary.pihakPertamaLabel, 'Penjual (Pihak I)');
  assert.equal(ajbSummary.pihakPertamaText, 'Slamet Raharjo');
  assert.equal(ajbSummary.pihakPenerimaLabel, 'Pembeli (Pihak II)');
  assert.equal(ajbSummary.pihakPenerimaText, 'Dimas Prasetyo');

  // Akta Hibah
  const hibahSummary = extractDashboardParties(INITIAL_SEED_RECORDS[2]);
  assert.equal(hibahSummary.pihakPertamaLabel, 'Pemberi Hibah (I)');
  assert.equal(hibahSummary.pihakPertamaText, 'Sudirman Hadi');
  assert.equal(hibahSummary.pihakPenerimaLabel, 'Penerima Hibah (II)');
  assert.equal(hibahSummary.pihakPenerimaText, 'Nadia Putri Hadi');

  // APHB with custom penerima_hak_peran (Pihak III)
  const aphbRecord: BerkasRecord = {
    ...INITIAL_SEED_RECORDS[1],
    para_pihak: [
      { ...INITIAL_SEED_RECORDS[1].para_pihak[0], peran: 'Pihak I', nama: 'SUTARNO' },
      { ...INITIAL_SEED_RECORDS[1].para_pihak[1], peran: 'Pihak II', nama: 'SUTARNI' },
      { ...INITIAL_SEED_RECORDS[1].para_pihak[1], id: 'p-3', peran: 'Pihak III', nama: 'BAGUS PRATAMA' },
    ],
    akta: {
      ...INITIAL_SEED_RECORDS[1].akta,
      pihak_penerima_aphb: 'Pihak III',
    },
  };
  const aphbSummary = extractDashboardParties(aphbRecord);
  assert.equal(aphbSummary.pihakPenerimaLabel, 'Penerima (Pihak III)');
  assert.equal(aphbSummary.pihakPenerimaText, 'BAGUS PRATAMA');
  assert.equal(aphbSummary.pihakPertamaText, 'SUTARNO, SUTARNI');

  // Non-Akta Pengecekan Sertipikat (PPATS mode, no Pihak II -> shows Penerima Kuasa PPATS)
  const cekRecord: BerkasRecord = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'Pengecekan Sertipikat',
    para_pihak: [{ ...INITIAL_SEED_RECORDS[0].para_pihak[0], peran: 'Pihak I', nama: 'SUPARNO' }],
    non_akta: { pengecekan_kuasa_mode: 'ppats' },
  };
  const cekSummary = extractDashboardParties(cekRecord);
  assert.equal(cekSummary.pihakPertamaLabel, 'Pemohon');
  assert.equal(cekSummary.pihakPertamaText, 'SUPARNO');
  assert.equal(cekSummary.pihakPenerimaLabel, 'Penerima Kuasa (PPATS)');
  assert.equal(cekSummary.pihakPenerimaText, 'H. Ahmad Suryono, S.STP., M.Si.');

  // Non-Akta with explicit Pihak II -> shows Pihak Penerima directly
  const cekWithP2: BerkasRecord = {
    ...cekRecord,
    para_pihak: [
      { ...INITIAL_SEED_RECORDS[0].para_pihak[0], peran: 'Pihak I', nama: 'SUPARNO' },
      { ...INITIAL_SEED_RECORDS[0].para_pihak[2], peran: 'Pihak II', nama: 'JOKO SUMANTO' },
    ],
  };
  const cekP2Summary = extractDashboardParties(cekWithP2);
  assert.equal(cekP2Summary.pihakPenerimaLabel, 'Pihak Penerima');
  assert.equal(cekP2Summary.pihakPenerimaText, 'JOKO SUMANTO');

  // Turun Waris with Pewaris -> Pewaris & Ahli Waris
  const warisRecord: BerkasRecord = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'Turun Waris',
    para_pihak: [
      { ...INITIAL_SEED_RECORDS[0].para_pihak[0], peran: 'Pihak I', nama: 'SITI AMINAH' },
      { ...INITIAL_SEED_RECORDS[0].para_pihak[2], peran: 'Pihak II', nama: 'BUDI SANTOSO' },
    ],
    non_akta: { nama_pewaris: 'H. SUPARMAN' },
  };
  const warisSummary = extractDashboardParties(warisRecord);
  assert.equal(warisSummary.pihakPertamaLabel, 'Pewaris');
  assert.equal(warisSummary.pihakPertamaText, 'H. SUPARMAN');
  assert.equal(warisSummary.pihakPenerimaLabel, 'Ahli Waris');
  assert.equal(warisSummary.pihakPenerimaText, 'SITI AMINAH, BUDI SANTOSO');
});
