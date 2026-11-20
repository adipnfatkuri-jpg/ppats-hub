import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScannedPersonInfo } from './personScan.ts';

test('normalizeScannedPersonInfo formats dates to DD-MM-YYYY, cleans NIK and RT/RW', () => {
  const result = normalizeScannedPersonInfo({
    nama: '  SALIMIN  ',
    nik: '3309 1103 0773 0005',
    pekerjaan: 'Perangkat Desa',
    tempat_lahir: 'Boyolali',
    tanggal_lahir: '1973-07-03',
    alamat_jalan: '  Gunungan  ',
    rt: 'RT 005',
    rw: 'RW. 008',
    desa_kelurahan: 'Giriroto',
    kecamatan: 'Ngemplak',
    kabupaten: 'Kabupaten Boyolali',
  });

  assert.deepEqual(result, {
    nama: 'SALIMIN',
    nik: '3309110307730005',
    pekerjaan: 'Perangkat Desa',
    tempat_lahir: 'Boyolali',
    tanggal_lahir: '03-07-1973',
    alamat_jalan: 'Gunungan',
    rt: '005',
    rw: '008',
    desa_kelurahan: 'Giriroto',
    kecamatan: 'Ngemplak',
    kabupaten: 'Kabupaten Boyolali',
  });
});

test('normalizeScannedPersonInfo uses fallbackName when nama is blank and preserves valid DD-MM-YYYY', () => {
  const result = normalizeScannedPersonInfo(
    {
      nama: '',
      tanggal_lahir: '10/11/1957',
      nik: '3309111011570003',
    },
    'SUWARDJO'
  );

  assert.equal(result.nama, 'SUWARDJO');
  assert.equal(result.tanggal_lahir, '10-11-1957');
  assert.equal(result.nik, '3309111011570003');
});
