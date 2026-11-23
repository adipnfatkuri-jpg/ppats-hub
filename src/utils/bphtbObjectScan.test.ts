import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyObjectScanPatchToTaxDraft,
  mergeObjectScanIntoBphtbForm,
  normalizeObjekRtRw,
  resolveAccurateBangunanFromPbb,
  resolveAccurateLuasBumiM2,
  splitLokasiAndRtRw,
} from './bphtbObjectScan';
import { buildInitialBphtbFormData } from './bphtbSubmissionGenerator';
import { DEFAULT_OFFICE_SETTINGS } from './seedData';
import { ExtractionApiResponse } from '../types/ppats';

test('normalizeObjekRtRw normalizes SPPT PBB RT/RW variants cleanly', () => {
  assert.equal(normalizeObjekRtRw('RT. 002 RW. 003'), '002/003');
  assert.equal(normalizeObjekRtRw('RT 004 / RW 01'), '004/01');
  assert.equal(normalizeObjekRtRw('002/003'), '002/003');
  assert.equal(normalizeObjekRtRw('RT.002/RW.003'), '002/003');
  assert.equal(normalizeObjekRtRw('-'), '');
  assert.equal(normalizeObjekRtRw(''), '');
});

test('splitLokasiAndRtRw extracts Dukuh in Title Case and RT/RW even when combined in one line', () => {
  assert.deepEqual(splitLokasiAndRtRw('GORONGAN', 'RT. 002 RW. 003'), {
    lokasi: 'Gorongan',
    rtRw: '002/003',
  });
  assert.deepEqual(splitLokasiAndRtRw('GORONGAN RT. 002 RW. 003', ''), {
    lokasi: 'Gorongan',
    rtRw: '002/003',
  });
});

test('resolveAccurateLuasBumiM2 repairs line-wrapped SPPT luas (16 instead of 160) using NJOP total cross-check', () => {
  assert.equal(
    resolveAccurateLuasBumiM2(0, {
      nop: '33.09.110.005.015-0200.0',
      tahun_pajak: '2026',
      luas_bumi_m2: 16,
      njop_bumi_m2: 464000,
      njop_bumi_total: 74240000,
      njop_bangunan: 0,
    }),
    160
  );
  assert.equal(
    resolveAccurateLuasBumiM2(16, {
      nop: '33.09.110.005.015-0200.0',
      tahun_pajak: '2026',
      luas_bumi_m2: 16,
      njop_bumi_m2: 464000,
      njop_bumi_total: 74240000,
      njop_bangunan: 0,
    }),
    160
  );
  assert.equal(
    resolveAccurateLuasBumiM2(196, {
      nop: '33.09.110.005.015-0200.0',
      tahun_pajak: '2026',
      luas_bumi_m2: 160,
      njop_bumi_m2: 464000,
      njop_bumi_total: 74240000,
      njop_bangunan: 0,
    }),
    196
  );
});

test('mergeObjectScanIntoBphtbForm populates Lokasi/Dukuh GORONGAN and RT/RW 002/003 from SPPT PBB without overwriting existing Sertipikat', () => {
  const prev = buildInitialBphtbFormData(DEFAULT_OFFICE_SETTINGS, null);
  prev.nomor_sertipikat = 'Nib: 11.17.000022399.0';
  prev.letaknya_jalan = 'Donohudan';

  const spptScanResponse: ExtractionApiResponse = {
    para_pihak: [],
    tanah: {
      jenis_hak: 'Hak Milik',
      nib: '',
      nomor_hak_lama: '',
      luas_m2: 0,
      desa: 'DONOHUDAN',
      kecamatan: 'NGEMPLAK',
      kabupaten: 'BOYOLALI',
      dasar_perolehan: '',
      pemegang_hak_sertipikat: [],
    },
    pbb: {
      nop: '33.09.110.005.015-0200.0',
      tahun_pajak: '2026',
      letak_objek_lokasi: 'GORONGAN',
      letak_objek_rt_rw: 'RT. 002 RW. 003',
      letak_objek_desa: 'DONOHUDAN',
      letak_objek_kecamatan: 'NGEMPLAK',
      letak_objek_kabupaten: 'BOYOLALI',
      luas_bumi_m2: 16,
      luas_bangunan_m2: 0,
      njop_bumi_m2: 464000,
      njop_bumi_total: 74240000,
      njop_bangunan: 0,
      nama_wp_pbb: 'SUGIARTI, A.MD KOM',
    },
    audit_warnings: [],
  };

  const { nextForm, taxPatch } = mergeObjectScanIntoBphtbForm(prev, spptScanResponse);

  assert.equal(nextForm.nop, '33.09.110.005.015-0200.0');
  assert.equal(nextForm.tahun_pajak, '2026');
  assert.equal(nextForm.letaknya_jalan, 'Gorongan');
  assert.equal(nextForm.objek_rt_rw, '002/003');
  assert.equal(nextForm.desa, 'Donohudan');
  assert.equal(nextForm.kecamatan, 'Ngemplak');
  assert.equal(nextForm.kabupaten, 'Boyolali');
  assert.equal(nextForm.nomor_sertipikat, 'Nib: 11.17.000022399.0');
  assert.equal(nextForm.luas_bangunan_m2, 0);
  assert.equal(nextForm.pemberi_nama, 'SUGIARTI, A.MD KOM');
  assert.equal(taxPatch.luas_m2, 160);
  assert.equal(taxPatch.njop_bumi_m2, 464000);
});

test('applyObjectScanPatchToTaxDraft merges SPPT PBB then Sertipikat without wiping NJOP values', () => {
  const initial = {
    layanan: 'AJB' as const,
    luas_m2: 0,
    njop_bumi_m2: 0,
    njop_bangunan: 0,
    harga_per_m2: 1500000,
    nilai_transaksi_override: null,
    npoptkp: 80000000,
  };

  // 1. Scan SPPT PBB fills luas, NJOP Bumi/m2, and NJOP Bangunan
  const afterSppt = applyObjectScanPatchToTaxDraft(
    initial,
    { luas_m2: 160, njop_bumi_m2: 464000, njop_bangunan: 35000000 },
    'sppt'
  );
  assert.equal(afterSppt.luas_m2, 160);
  assert.equal(afterSppt.njop_bumi_m2, 464000);
  assert.equal(afterSppt.njop_bangunan, 35000000);
  assert.equal(afterSppt.harga_per_m2, 1500000);

  // 2. Subsequent Scan Sertipikat updates authoritative luas_m2 (196) while keeping NJOP intact
  const afterSertipikat = applyObjectScanPatchToTaxDraft(
    afterSppt,
    { luas_m2: 196 },
    'sertipikat'
  );
  assert.equal(afterSertipikat.luas_m2, 196);
  assert.equal(afterSertipikat.njop_bumi_m2, 464000);
  assert.equal(afterSertipikat.njop_bangunan, 35000000);
});

test('resolveAccurateBangunanFromPbb cross-checks SPPT luas_bangunan_m2, njop_bangunan_m2, and total NJOP Bangunan', () => {
  // Derives njop_bangunan_m2 when SPPT OCR reads luas + total
  assert.deepEqual(
    resolveAccurateBangunanFromPbb({
      nop: '33.09.110.005.015-0200.0',
      tahun_pajak: '2026',
      luas_bangunan_m2: 60,
      njop_bumi_m2: 500000,
      njop_bangunan: 48000000,
    }),
    {
      luas_bangunan_m2: 60,
      njop_bangunan_m2: 800000,
      njop_bangunan: 48000000,
    }
  );

  // Computes total accurately from luas x per-m2
  assert.deepEqual(
    resolveAccurateBangunanFromPbb({
      nop: '33.09.110.005.015-0200.0',
      tahun_pajak: '2026',
      luas_bangunan_m2: 50,
      njop_bumi_m2: 500000,
      njop_bangunan_m2: 968000,
      njop_bangunan: 0,
    }),
    {
      luas_bangunan_m2: 50,
      njop_bangunan_m2: 968000,
      njop_bangunan: 48400000,
    }
  );

  // Applies per-m2 building fields into TaxDraftPrefill
  const patched = applyObjectScanPatchToTaxDraft(
    {
      layanan: 'AJB',
      luas_m2: 200,
      njop_bumi_m2: 600000,
      luas_bangunan_m2: 0,
      njop_bangunan_m2: 0,
      njop_bangunan: 0,
      harga_per_m2: 0,
      nilai_transaksi_override: null,
      npoptkp: 80000000,
    },
    { luas_bangunan_m2: 50, njop_bangunan_m2: 968000 },
    'sppt'
  );
  assert.equal(patched.luas_bangunan_m2, 50);
  assert.equal(patched.njop_bangunan_m2, 968000);
  assert.equal(patched.njop_bangunan, 48400000);
});
