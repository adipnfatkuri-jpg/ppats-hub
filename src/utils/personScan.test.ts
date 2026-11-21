import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScannedPersonInfo } from './personScan.ts';

test('normalizeScannedPersonInfo keeps nama UPPERCASE and converts ALL CAPS KTP fields to Title Case', () => {
  const result = normalizeScannedPersonInfo({
    nama: '  salimin bin karto  ',
    nik: '3309 1103 0773 0005',
    pekerjaan: 'BURUH TANI/PERKEBUNAN',
    tempat_lahir: 'BOYOLALI',
    tanggal_lahir: '1973-07-03',
    jenis_kelamin: 'LAKI-LAKI',
    status_perkawinan: 'BELUM KAWIN',
    alamat_jalan: '  DSN. GUNUNGAN  ',
    rt: 'RT 005',
    rw: 'RW. 008',
    desa_kelurahan: 'GIRIROTO',
    kecamatan: 'NGEMPLAK',
    kabupaten: 'KABUPATEN BOYOLALI',
  });

  assert.deepEqual(result, {
    nama: 'SALIMIN BIN KARTO',
    nik: '3309110307730005',
    pekerjaan: 'Buruh Tani/Perkebunan',
    tempat_lahir: 'Boyolali',
    tanggal_lahir: '03-07-1973',
    jenis_kelamin: 'Laki-laki',
    status_perkawinan: 'Belum Kawin',
    alamat_jalan: 'Dsn. Gunungan',
    rt: '005',
    rw: '008',
    desa_kelurahan: 'Giriroto',
    kecamatan: 'Ngemplak',
    kabupaten: 'Kabupaten Boyolali',
  });
});

test('normalizeScannedPersonInfo uses fallbackName in UPPERCASE when nama is blank and preserves valid DD-MM-YYYY', () => {
  const result = normalizeScannedPersonInfo(
    {
      nama: '',
      tanggal_lahir: '10/11/1957',
      nik: '3309111011570003',
    },
    'Suwardjo'
  );

  assert.equal(result.nama, 'SUWARDJO');
  assert.equal(result.tanggal_lahir, '10-11-1957');
  assert.equal(result.nik, '3309111011570003');
});
