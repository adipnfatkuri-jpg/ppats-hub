import test from 'node:test';
import assert from 'node:assert/strict';
import { ThinkingLevel } from '@google/genai';
import {
  mergePewarisScanIntoNonAkta,
  mergeWarisCScanIntoState,
} from './warisScanHelper';
import {
  resolveGeminiExtractionAttempts,
  warisCExtractionResponseSchema,
  warisPewarisExtractionResponseSchema,
} from '../../api/_geminiExtractor';
import type { DataPBB, DataTanah, NonAktaDetail } from '../types/ppats';

const BASE_TANAH: DataTanah = {
  jenis_sertipikat: 'analog',
  jenis_hak: 'Hak Milik Adat',
  nib: '',
  nomor_hak_lama: '',
  luas_m2: 0,
  desa: '',
  kecamatan: '',
  kabupaten: '',
  dasar_perolehan: 'Warisan',
  pemegang_hak_sertipikat: [],
};

const BASE_PBB: DataPBB = {
  nop: '',
  tahun_pajak: '2026',
  njop_bumi_m2: 0,
  njop_bangunan: 0,
};

test('mergePewarisScanIntoNonAkta populates Pewaris & Pasangan cleanly with proper casing and dates', () => {
  const prev: NonAktaDetail = {
    sebutan_pewaris: 'Almarhum',
    nama_pewaris: '',
    tempat_meninggal: 'Existing Place',
    catatan_skw: 'Existing Note',
  };

  const result = mergePewarisScanIntoNonAkta(prev, {
    sebutan_pewaris: 'Almarhumah',
    nama_pewaris: 'siti aminah',
    tanggal_meninggal: '2019-08-14',
    tempat_meninggal: 'desa sindon, kec. ngemplak, boyolali',
    hubungan_pasangan_pewaris: 'Suaminya',
    nama_pasangan_pewaris: 'hadi suwarno',
    tgl_lahir_pasangan_pewaris: '12-03-1952',
    tanggal_meninggal_pasangan: '05-01-2023',
    tempat_meninggal_pasangan: 'rsud boyolali',
    jumlah_anak_waris: 4,
    catatan_skw: '',
  });

  assert.equal(result.nextNonAkta.sebutan_pewaris, 'Almarhumah');
  assert.equal(result.nextNonAkta.nama_pewaris, 'SITI AMINAH');
  assert.equal(result.nextNonAkta.tanggal_meninggal, '14-08-2019');
  assert.equal(
    result.nextNonAkta.tempat_meninggal,
    'Desa Sindon, Kec. Ngemplak, Boyolali'
  );
  assert.equal(result.nextNonAkta.hubungan_pasangan_pewaris, 'Suaminya');
  assert.equal(result.nextNonAkta.nama_pasangan_pewaris, 'HADI SUWARNO');
  assert.equal(result.nextNonAkta.tgl_lahir_pasangan_pewaris, '12-03-1952');
  assert.equal(result.nextNonAkta.tanggal_meninggal_pasangan, '05-01-2023');
  assert.equal(result.nextNonAkta.tempat_meninggal_pasangan, 'RSUD Boyolali');
  assert.equal(result.nextNonAkta.jumlah_anak_waris, 4);
  // Empty scanned catatan_skw must preserve existing note
  assert.equal(result.nextNonAkta.catatan_skw, 'Existing Note');
  assert.ok(result.updatedCount >= 9);
  assert.ok(result.summaryParts.some((p) => p.includes('SITI AMINAH')));
});

test('mergeWarisCScanIntoState populates Letter C fields, riwayat 1-3, pewaris, and only blank tanah/pbb fields', () => {
  const prevNonAkta: NonAktaDetail = {
    waris_c_tahun_tercatat_c: '1960',
  };
  const prevTanah: DataTanah = {
    ...BASE_TANAH,
    desa: 'Giriroto', // already filled -> must NOT be overwritten
    luas_m2: 0, // empty -> should be filled from scan
  };
  const prevPbb: DataPBB = {
    ...BASE_PBB,
    nop: '', // empty -> should be filled from scan
  };

  const result = mergeWarisCScanIntoState(prevNonAkta, prevTanah, prevPbb, {
    sebutan_pewaris: 'Almarhum',
    nama_pewaris: 'kromo pawiro',
    tanggal_meninggal: '10-04-2014',
    waris_c_hak_adat: 'C-723 Persil 73-109 Kelas IIa',
    waris_c_atas_nama_c: 'kromo pawiro',
    waris_c_tahun_tercatat_c: '1959',
    waris_c_jenis_tanah: 'Sawah / Pertanian',
    waris_c_berdiri_di_atasnya: 'bangunan rumah tinggal',
    waris_c_nama_blok_dukuh: 'dukuh sidorejo rt 02 rw 01',
    waris_c_nama_wp_pbb: 'wijiati',
    waris_c_no_surat_keterangan: '593/12/2026',
    waris_c_no_surat_riwayat: '593/13/2026',
    waris_c_penerima_bagian: 'wijiati',
    waris_c_luas_bagian_m2: 1412,
    waris_c_tahun_waris: '2015',
    waris_c_hubungan_pewaris: 'orang tua kandungnya',
    waris_c_batas_bagian_utara: 'jalan desa',
    waris_c_batas_bagian_timur: 'tanah sutarno',
    waris_c_riwayat_1_tahun: '1959',
    waris_c_riwayat_1_oleh: 'kromo pawiro',
    waris_c_riwayat_1_cara: 'milik adat',
    waris_c_riwayat_1_bukti: 'buku letter c desa',
    waris_c_riwayat_2_tahun: '2014',
    waris_c_riwayat_2_oleh: 'para ahli waris',
    waris_c_riwayat_2_cara: 'warisan',
    waris_c_riwayat_2_bukti: 'surat keterangan warisan',
    luas_induk_m2: 5650,
    desa: 'Desa Lain',
    kecamatan: 'ngemplak',
    kabupaten: 'boyolali',
    nop: '33.09.110.005.004-0123.0',
  });

  assert.equal(result.nextNonAkta.nama_pewaris, 'KROMO PAWIRO');
  assert.equal(result.nextNonAkta.waris_c_hak_adat, 'C-723 Persil 73-109 Kelas IIa');
  assert.equal(result.nextNonAkta.waris_c_atas_nama_c, 'KROMO PAWIRO');
  assert.equal(result.nextNonAkta.waris_c_tahun_tercatat_c, '1959');
  assert.equal(result.nextNonAkta.waris_c_jenis_tanah, 'Pertanian');
  assert.equal(result.nextNonAkta.waris_c_berdiri_di_atasnya, 'Bangunan Rumah Tinggal');
  assert.equal(result.nextNonAkta.waris_c_nama_blok_dukuh, 'Dukuh Sidorejo RT 02 RW 01');
  assert.equal(result.nextNonAkta.waris_c_nama_wp_pbb, 'WIJIATI');
  assert.equal(result.nextNonAkta.waris_c_penerima_bagian, 'WIJIATI');
  assert.equal(result.nextNonAkta.waris_c_luas_bagian_m2, 1412);
  assert.equal(result.nextNonAkta.waris_c_batas_bagian_utara, 'Jalan Desa');
  assert.equal(result.nextNonAkta.waris_c_riwayat_1_oleh, 'KROMO PAWIRO');
  assert.equal(result.nextNonAkta.waris_c_riwayat_2_bukti, 'Surat Keterangan Warisan');

  // Non-destructive tanah & pbb checks
  assert.equal(result.nextTanah.desa, 'Giriroto');
  assert.equal(result.nextTanah.luas_m2, 5650);
  assert.equal(result.nextTanah.kecamatan, 'Ngemplak');
  assert.equal(result.nextTanah.kabupaten, 'Boyolali');
  assert.equal(result.nextPbb.nop, '33.09.110.005.004-0123.0');
  assert.ok(result.summaryParts.includes('C-723 Persil 73-109 Kelas IIa'));
});

test('resolveGeminiExtractionAttempts uses gemini-4-hydrogen as primary with valid ThinkingLevels', () => {
  const kinds = ['full', 'object_only', 'person', 'waris_pewaris', 'waris_c'] as const;

  for (const kind of kinds) {
    const fastAttempts = resolveGeminiExtractionAttempts(kind, 'fast');
    assert.ok(fastAttempts.length >= 2, `${kind} fast should have primary + fallback`);
    assert.equal(
      fastAttempts[0].model,
      'gemini-4-hydrogen',
      `${kind} primary must be gemini-4-hydrogen (not flash-lite)`
    );
    assert.equal(fastAttempts[0].level, ThinkingLevel.LOW);

    for (const attempt of fastAttempts) {
      if (attempt.model === 'gemini-4-hydrogen') {
        assert.notEqual(
          attempt.level,
          ThinkingLevel.MINIMAL,
          'gemini-4-hydrogen does not support ThinkingLevel.MINIMAL'
        );
      }
      assert.ok(attempt.timeoutMs >= 20000);
    }
  }

  const accurateAttempts = resolveGeminiExtractionAttempts('full', 'accurate');
  assert.equal(accurateAttempts[0].model, 'gemini-4-hydrogen');
  assert.equal(accurateAttempts[0].level, ThinkingLevel.MEDIUM);
  assert.equal(accurateAttempts[1].model, 'gemini-4-hydrogen');
  assert.equal(accurateAttempts[1].level, ThinkingLevel.LOW);
  assert.equal(accurateAttempts[2].model, 'gemini-3.1-flash-lite');
  assert.equal(accurateAttempts[2].level, ThinkingLevel.MINIMAL);
});

test('Waris Gemini extraction schemas declare required root containers', () => {
  assert.deepEqual(warisPewarisExtractionResponseSchema.required, ['waris_pewaris']);
  assert.deepEqual(warisCExtractionResponseSchema.required, ['waris_c']);
});
