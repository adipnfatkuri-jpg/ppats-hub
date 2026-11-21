import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeScanGender,
  toScanTitleCase,
  toScanUpperName,
} from './scanTextCase';

test('toScanUpperName keeps person names in uppercase while collapsing whitespace', () => {
  assert.equal(toScanUpperName('  okty sri lestariningSih  '), 'OKTY SRI LESTARININGSIH');
  assert.equal(toScanUpperName('SUGIARTI, A.Md Kom'), 'SUGIARTI, A.MD KOM');
  assert.equal(toScanUpperName(''), '');
});

test('toScanTitleCase converts ALL CAPS scanned text to Title Case while preserving official Indonesian acronyms', () => {
  assert.equal(toScanTitleCase('GORONGAN'), 'Gorongan');
  assert.equal(toScanTitleCase('DONOHUDAN'), 'Donohudan');
  assert.equal(toScanTitleCase('KABUPATEN BOYOLALI'), 'Kabupaten Boyolali');
  assert.equal(toScanTitleCase('JAWA TENGAH'), 'Jawa Tengah');
  assert.equal(toScanTitleCase('DKI JAKARTA'), 'DKI Jakarta');
  assert.equal(toScanTitleCase('DI YOGYAKARTA'), 'DI Yogyakarta');
  assert.equal(toScanTitleCase('BURUH TANI/PERKEBUNAN'), 'Buruh Tani/Perkebunan');
  assert.equal(toScanTitleCase('MENGURUS RUMAH TANGGA'), 'Mengurus Rumah Tangga');
  assert.equal(toScanTitleCase('PEGAWAI NEGERI SIPIL (PNS)'), 'Pegawai Negeri Sipil (PNS)');
  assert.equal(toScanTitleCase('TNI / POLRI'), 'TNI / POLRI');
  assert.equal(toScanTitleCase('KARYAWAN BUMN'), 'Karyawan BUMN');
  assert.equal(toScanTitleCase('JL. SOEKARNO-HATTA NO. 88'), 'Jl. Soekarno-Hatta No. 88');
  assert.equal(toScanTitleCase('PERUM ASABRI BLOK C-12'), 'Perum Asabri Blok C-12');
  assert.equal(toScanTitleCase('BELUM KAWIN'), 'Belum Kawin');
  assert.equal(toScanTitleCase('KAWIN'), 'Kawin');
  assert.equal(toScanTitleCase('HAK MILIK'), 'Hak Milik');
  assert.equal(toScanTitleCase('HGB'), 'HGB');
  assert.equal(toScanTitleCase('PEWARISAN (SKW DESA WUJIL)'), 'Pewarisan (SKW Desa Wujil)');
});

test('normalizeScanGender outputs Laki-laki and Perempuan cleanly', () => {
  assert.equal(normalizeScanGender('LAKI-LAKI'), 'Laki-laki');
  assert.equal(normalizeScanGender('PEREMPUAN'), 'Perempuan');
  assert.equal(normalizeScanGender('P'), 'Perempuan');
  assert.equal(normalizeScanGender('L'), 'Laki-laki');
  assert.equal(normalizeScanGender(''), '');
});
