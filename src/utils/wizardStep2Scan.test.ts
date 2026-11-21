import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPartyEffectivelyEmpty,
  mergeObjectScanIntoWizardTanahPbb,
  mergeScannedPersonIntoParty,
} from './wizardStep2Scan';
import { DataPBB, DataTanah, ExtractionApiResponse, ParaPihak } from '../types/ppats';

const makeParty = (overrides?: Partial<ParaPihak>): ParaPihak => ({
  id: 'p-1',
  peran: 'Pihak I',
  nik: '',
  nama: '',
  tempat_lahir: '',
  tanggal_lahir: '',
  jenis_kelamin: 'Laki-laki',
  alamat_jalan: '',
  rt_rw: '',
  desa_kelurahan: '',
  kecamatan: '',
  kabupaten: '',
  pekerjaan: '',
  status_perkawinan: '',
  ...overrides,
});

test('mergeScannedPersonIntoParty fills all KTP fields including gender, marital status, and cleaned regions while preserving role', () => {
  const prev = makeParty({ peran: 'Pihak II' });
  assert.equal(isPartyEffectivelyEmpty(prev), true);

  const merged = mergeScannedPersonIntoParty(prev, {
    nama: 'OKTY SRI LESTARININGSIH',
    nik: '3309115811840001',
    tempat_lahir: 'Boyolali',
    tanggal_lahir: '18-11-1984',
    jenis_kelamin: 'Perempuan',
    status_perkawinan: 'KAWIN',
    pekerjaan: 'Guru',
    alamat_jalan: 'Ngesrep',
    rt: '004',
    rw: '001',
    desa_kelurahan: 'Ngesrep',
    kecamatan: 'Kecamatan Ngemplak',
    kabupaten: 'Kabupaten Boyolali',
  });

  assert.equal(isPartyEffectivelyEmpty(merged), false);
  assert.equal(merged.peran, 'Pihak II');
  assert.equal(merged.nama, 'OKTY SRI LESTARININGSIH');
  assert.equal(merged.nik, '3309115811840001');
  assert.equal(merged.jenis_kelamin, 'Perempuan');
  assert.equal(merged.status_perkawinan, 'Kawin');
  assert.equal(merged.rt_rw, '004/001');
  assert.equal(merged.kecamatan, 'Ngemplak');
  assert.equal(merged.kabupaten, 'Boyolali');
});

test('mergeObjectScanIntoWizardTanahPbb handles Analog SHM scan and subsequent SPPT PBB scan non-destructively', () => {
  const initialTanah: DataTanah = {
    jenis_sertipikat: 'digital',
    jenis_hak: 'Hak Milik',
    nib: '',
    nomor_hak_lama: '',
    surat_ukur_tanggal: '',
    surat_ukur_nomor: '',
    luas_m2: 0,
    desa: '',
    kecamatan: '',
    kabupaten: 'Boyolali',
    provinsi: 'Jawa Tengah',
    batas_utara: '',
    batas_timur: '',
    batas_selatan: '',
    batas_barat: '',
    dasar_perolehan: '',
    pemegang_hak_sertipikat: [],
  };
  const initialPbb: DataPBB = {
    nop: '',
    tahun_pajak: '2026',
    njop_bumi_m2: 0,
    njop_bangunan: 0,
  };

  // 1. Scan Analog SHM
  const shmResp: ExtractionApiResponse = {
    para_pihak: [],
    tanah: {
      jenis_sertipikat: 'analog',
      jenis_hak: 'Hak Milik',
      nib: '11.17.11.10.01450',
      nomor_hak_lama: '3354',
      surat_ukur_tanggal: '19-10-2011',
      surat_ukur_nomor: '00143/Donohudan/2011',
      luas_m2: 196,
      desa: 'Donohudan',
      kecamatan: 'Kec. Ngemplak',
      kabupaten: 'Kab. Boyolali',
      provinsi: 'Jawa Tengah',
      batas_utara: 'Jalan Kampung',
      batas_timur: 'Tanah Sdr. Supardi',
      dasar_perolehan: 'Jual Beli',
      pemegang_hak_sertipikat: ['SUGIARTI, A.MD KOM'],
    },
    pbb: {
      nop: '',
      tahun_pajak: '',
      njop_bumi_m2: 0,
      njop_bangunan: 0,
    },
    audit_warnings: [],
  };

  const afterShm = mergeObjectScanIntoWizardTanahPbb(
    initialTanah,
    initialPbb,
    '',
    shmResp
  );
  assert.equal(afterShm.nextTanah.jenis_sertipikat, 'analog');
  assert.equal(afterShm.nextTanah.nomor_hak_lama, '3354');
  assert.equal(afterShm.nextTanah.surat_ukur_nomor, '00143/Donohudan/2011');
  assert.equal(afterShm.nextTanah.luas_m2, 196);
  assert.equal(afterShm.nextTanah.kecamatan, 'Ngemplak');
  assert.equal(afterShm.nextTanah.kabupaten, 'Boyolali');
  assert.equal(afterShm.nextPemegangHakInput, 'SUGIARTI, A.MD KOM');

  // 2. Scan SPPT PBB terpisah -> tidak merusak mode Analog / No SHM yang sudah ada
  const spptResp: ExtractionApiResponse = {
    para_pihak: [],
    tanah: {
      jenis_hak: 'Hak Milik',
      nib: '',
      nomor_hak_lama: '',
      luas_m2: 16,
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
      letak_objek_rt_rw: '002/003',
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

  const afterSppt = mergeObjectScanIntoWizardTanahPbb(
    afterShm.nextTanah,
    afterShm.nextPbb,
    afterShm.nextPemegangHakInput,
    spptResp
  );
  assert.equal(afterSppt.nextTanah.jenis_sertipikat, 'analog');
  assert.equal(afterSppt.nextTanah.nomor_hak_lama, '3354');
  assert.equal(afterSppt.nextTanah.surat_ukur_nomor, '00143/Donohudan/2011');
  assert.equal(afterSppt.nextTanah.luas_m2, 160);
  assert.equal(afterSppt.nextTanah.desa, 'Donohudan');
  assert.equal(afterSppt.nextTanah.kecamatan, 'Ngemplak');
  assert.equal(afterSppt.nextTanah.kabupaten, 'Boyolali');
  assert.equal(afterSppt.nextPbb.nop, '33.09.110.005.015-0200.0');
  assert.equal(afterSppt.nextPbb.njop_bumi_m2, 464000);
  assert.equal(afterSppt.nextPemegangHakInput, 'SUGIARTI, A.MD KOM');
});
