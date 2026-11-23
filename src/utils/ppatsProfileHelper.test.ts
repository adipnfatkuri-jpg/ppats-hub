import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFullAddressFromScannedPerson,
  buildPpatsSettingsPatchFromNonAkta,
  formatPpatsTtl,
  mergeScannedKtpIntoPpatsSettings,
  parsePpatsTtlInput,
  resolveDefaultPpatsIdentity,
} from './ppatsProfileHelper';
import { DEFAULT_OFFICE_SETTINGS } from './seedData';

test('formatPpatsTtl formats tempat + DD-MM-YYYY tanggal lahir cleanly', () => {
  assert.equal(
    formatPpatsTtl({
      tempat_lahir_ppats: 'Boyolali',
      tanggal_lahir_ppats: '1978-04-12',
    }),
    'Boyolali, 12-04-1978'
  );
  assert.equal(
    formatPpatsTtl({
      tempat_lahir_ppats: 'Semarang',
      tanggal_lahir_ppats: '05-11-1980',
    }),
    'Semarang, 05-11-1980'
  );
  assert.equal(
    formatPpatsTtl({ tempat_lahir_ppats: 'Solo', tanggal_lahir_ppats: '' }),
    'Solo'
  );
  assert.equal(
    formatPpatsTtl({ tempat_lahir_ppats: '', tanggal_lahir_ppats: '1978-04-12' }),
    '12-04-1978'
  );
  assert.equal(formatPpatsTtl({}), '');
});

test('parsePpatsTtlInput splits Tempat, Tanggal Lahir and normalizes date format', () => {
  assert.deepEqual(parsePpatsTtlInput('Boyolali, 12-04-1978'), {
    tempat_lahir_ppats: 'Boyolali',
    tanggal_lahir_ppats: '12-04-1978',
  });
  assert.deepEqual(parsePpatsTtlInput('Kab. Semarang, 1978-04-12'), {
    tempat_lahir_ppats: 'Kab. Semarang',
    tanggal_lahir_ppats: '12-04-1978',
  });
  assert.deepEqual(parsePpatsTtlInput('1978-04-12'), {
    tempat_lahir_ppats: '',
    tanggal_lahir_ppats: '12-04-1978',
  });
  assert.deepEqual(parsePpatsTtlInput('Boyolali'), {
    tempat_lahir_ppats: 'Boyolali',
    tanggal_lahir_ppats: '',
  });
  assert.deepEqual(parsePpatsTtlInput(''), {
    tempat_lahir_ppats: '',
    tanggal_lahir_ppats: '',
  });
});

test('resolveDefaultPpatsIdentity prioritizes alamat_ppats and falls back to alamat_kantor', () => {
  const withDomisili = resolveDefaultPpatsIdentity({
    nama_kecamatan: 'Kecamatan Ngemplak',
    nik_ppats: '3309111204780001',
    tempat_lahir_ppats: 'Boyolali',
    tanggal_lahir_ppats: '12-04-1978',
    alamat_ppats: 'Dukuh Krajan RT 001/RW 002, Desa Sindon, Ngemplak',
    alamat_kantor: 'Jl. Raya Donohudan No. 1',
  });
  assert.equal(withDomisili.nik, '3309111204780001');
  assert.equal(withDomisili.ttl, 'Boyolali, 12-04-1978');
  assert.equal(withDomisili.pekerjaan, 'Camat Ngemplak / PPATS');
  assert.equal(
    withDomisili.alamat,
    'Dukuh Krajan RT 001/RW 002, Desa Sindon, Ngemplak'
  );

  const fallbackKantor = resolveDefaultPpatsIdentity({
    nama_kecamatan: 'Kecamatan Bergas',
    nik_ppats: '',
    tempat_lahir_ppats: '',
    tanggal_lahir_ppats: '',
    alamat_ppats: '',
    alamat_kantor: 'Jl. Soekarno-Hatta No. 88',
  });
  assert.equal(fallbackKantor.alamat, 'Jl. Soekarno-Hatta No. 88');
  assert.equal(fallbackKantor.ttl, '');
  assert.equal(fallbackKantor.nik, '');
});

test('mergeScannedKtpIntoPpatsSettings fills NIK, TTL, Alamat without overwriting official titled name', () => {
  const prev = {
    ...DEFAULT_OFFICE_SETTINGS,
    nama_ppats: 'H. Ahmad Suryono, S.STP., M.Si.',
    nik_ppats: '',
    tempat_lahir_ppats: '',
    tanggal_lahir_ppats: '',
    alamat_ppats: '',
  };

  const merged = mergeScannedKtpIntoPpatsSettings(prev, {
    nama: 'AHMAD SURYONO',
    nik: '3322 1112 0478 0001',
    tempat_lahir: 'Semarang',
    tanggal_lahir: '1978-04-12',
    alamat_jalan: 'Dukuh Krajan',
    rt: '002',
    rw: '003',
    desa_kelurahan: 'Bergas Lor',
    kecamatan: 'Bergas',
    kabupaten: 'Semarang',
  });

  assert.equal(merged.nama_ppats, 'H. Ahmad Suryono, S.STP., M.Si.');
  assert.equal(merged.nik_ppats, '3322111204780001');
  assert.equal(merged.tempat_lahir_ppats, 'Semarang');
  assert.equal(merged.tanggal_lahir_ppats, '12-04-1978');
  assert.equal(
    merged.alamat_ppats,
    'Dukuh Krajan, RT 002 / RW 003, Desa Bergas Lor, Kecamatan Bergas, Kabupaten Semarang'
  );
});

test('buildFullAddressFromScannedPerson prefers direct alamat when available', () => {
  assert.equal(
    buildFullAddressFromScannedPerson({
      nama: 'TEST',
      alamat: 'Jl. Merpati No. 5, Boyolali',
      alamat_jalan: 'Ignored',
    }),
    'Jl. Merpati No. 5, Boyolali'
  );
});

test('buildPpatsSettingsPatchFromNonAkta saves NIK, parsed TTL, and Alamat back to OfficeSettings', () => {
  const updated = buildPpatsSettingsPatchFromNonAkta(DEFAULT_OFFICE_SETTINGS, {
    nama_ppats: 'Drs. Budi Santoso, M.M.',
    nip_ppats: '19750505 199603 1 002',
    ppats_nik: '3309110505750002',
    ppats_ttl: 'Boyolali, 05-05-1975',
    ppats_alamat: 'Jl. Diponegoro No. 12, Boyolali',
  });

  assert.equal(updated.nama_ppats, 'Drs. Budi Santoso, M.M.');
  assert.equal(updated.nip_ppats, '19750505 199603 1 002');
  assert.equal(updated.nik_ppats, '3309110505750002');
  assert.equal(updated.tempat_lahir_ppats, 'Boyolali');
  assert.equal(updated.tanggal_lahir_ppats, '05-05-1975');
  assert.equal(updated.alamat_ppats, 'Jl. Diponegoro No. 12, Boyolali');
});
