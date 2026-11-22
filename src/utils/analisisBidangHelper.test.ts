import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ANALISIS_TEMA,
  resolveAnalisisBidangConfig,
} from './analisisBidangHelper';
import { INITIAL_SEED_RECORDS } from './seedData';

test('resolveAnalisisBidangConfig provides complete official defaults when non_akta fields are minimal', () => {
  const base = INITIAL_SEED_RECORDS[0];
  const cfg = resolveAnalisisBidangConfig({
    ...base,
    layanan: 'Analisis Bidang',
    non_akta: {},
  });

  assert.equal(cfg.temaAnalisis, DEFAULT_ANALISIS_TEMA);
  assert.equal(cfg.skalaPeta, '1 : 1000');
  assert.equal(cfg.jumlahBidang, 3);
  assert.equal(cfg.jumlahBidangTerbilangCap, 'Tiga');
  assert.equal(cfg.jumlahBidangTerbilangLower, 'tiga');
  assert.equal(cfg.keperluanUtamaUpper, 'RUMAH TINGGAL');
  assert.equal(cfg.alasanPeralihanText, 'HIBAH kepada anak');
  assert.equal(cfg.sketRows.length, 3);
  assert.equal(cfg.sketRows[0].rencanaPenggunaan, 'Rumah Tinggal');
  assert.equal(cfg.sketRows[0].alasanPemecahan, 'dihibahkan ke anak');
  assert.equal(cfg.luasRencanaJalanText, '..........');
  assert.equal(cfg.luasPelepasanJalanText, '..........');
  assert.equal(cfg.sertakanPelepasanJalan, false);
});

test('resolveAnalisisBidangConfig maps explicit bidang_pecahan rows, jalan/saluran areas, and custom metadata accurately', () => {
  const base = INITIAL_SEED_RECORDS[0];
  const cfg = resolveAnalisisBidangConfig({
    ...base,
    layanan: 'Analisis Bidang',
    non_akta: {
      analisis_no_hp: '081234567890',
      analisis_skala_peta: '1 : 500',
      analisis_rencana_penggunaan: 'Rumah Tinggal',
      analisis_alasan_peralihan: 'HIBAH kepada anak',
      analisis_alasan_tabel: 'dihibahkan ke anak',
      analisis_rencana_jalan_luas_m2: 40,
      sertakan_pelepasan_jalan: true,
      pelepasan_jalan_luas_m2: 40,
      bidang_pecahan: [
        { id: 'b1', label: 'Dwino Astuti', luas_m2: 130, rencana_penggunaan: 'Rumah Tinggal', alasan_pemecahan: 'dihibahkan ke anak' },
        { id: 'b2', label: 'Joko Darmadi', luas_m2: 130, rencana_penggunaan: 'Rumah Tinggal', alasan_pemecahan: 'dihibahkan ke anak' },
        { id: 'b3', label: 'Mulyati', luas_m2: 155, rencana_penggunaan: 'Rumah Tinggal', alasan_pemecahan: 'dihibahkan ke anak' },
      ],
    },
  });

  assert.equal(cfg.nomorHp, '081234567890');
  assert.equal(cfg.skalaPeta, '1 : 500');
  assert.equal(cfg.jumlahBidang, 3);
  assert.equal(cfg.sketRows.length, 3);
  assert.equal(cfg.sketRows[0].luasText, '130');
  assert.equal(cfg.sketRows[2].luasText, '155');
  assert.equal(cfg.luasRencanaJalanText, '40');
  assert.equal(cfg.luasPelepasanJalanText, '40');
  assert.equal(cfg.sertakanPelepasanJalan, true);
});
