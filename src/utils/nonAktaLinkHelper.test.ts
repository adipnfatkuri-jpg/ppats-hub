import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNonAktaPrefillFromRecord,
  clearNonAktaLinkMetadata,
  formatLinkableBerkasOptionLabel,
  getLinkableBerkasRecords,
  hasSecondPartyInRecord,
} from './nonAktaLinkHelper';
import { DEFAULT_OFFICE_SETTINGS, INITIAL_SEED_RECORDS } from './seedData';
import { NonAktaDetail, ParameterAkta } from '../types/ppats';

const BASE_AKTA: ParameterAkta = {
  nomor_akta: '004/PPATS/XI/2026',
  tanggal_akta: '22-11-2026',
  nama_ppats: DEFAULT_OFFICE_SETTINGS.nama_ppats,
  jabatan_ppats: DEFAULT_OFFICE_SETTINGS.jabatan_ppats,
  nip_ppats: DEFAULT_OFFICE_SETTINGS.nip_ppats,
  harga_per_m2: 0,
  nilai_transaksi_override: null,
  npoptkp: DEFAULT_OFFICE_SETTINGS.npoptkp_umum,
  nama_kuasa_bpn: 'Default Kuasa',
  saksi_1: 'Default Saksi 1',
  saksi_2: 'Default Saksi 2',
  catatan_loket: '',
};

const BASE_NON_AKTA: NonAktaDetail = {
  pengesahan_mode: 'ppats',
  pkkpr_jenis_kegiatan: 'Non Berusaha',
  pkkpr_alamat_lokasi: '',
};

test('getLinkableBerkasRecords sorts newest first and excludes active editing record', () => {
  const list = getLinkableBerkasRecords(INITIAL_SEED_RECORDS, INITIAL_SEED_RECORDS[0].id);
  assert.equal(list.length, INITIAL_SEED_RECORDS.length - 1);
  assert.ok(list.every((r) => r.id !== INITIAL_SEED_RECORDS[0].id));
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i - 1].no_urut >= list[i].no_urut);
  }
});

test('formatLinkableBerkasOptionLabel includes kode, layanan, parties, luas, and desa', () => {
  const ajb = INITIAL_SEED_RECORDS[0];
  const label = formatLinkableBerkasOptionLabel(ajb);
  assert.match(label, /REG-2026-001/);
  assert.match(label, /AJB/);
  assert.match(label, /Slamet Raharjo/);
  assert.match(label, /Dimas Prasetyo/);
  assert.match(label, /185 m²/);
  assert.match(label, /Karangjati/);
});

test('buildNonAktaPrefillFromRecord defaults to Pihak I only and isolates state from source', () => {
  const ajb = INITIAL_SEED_RECORDS[0];
  assert.equal(hasSecondPartyInRecord(ajb), true);

  const result = buildNonAktaPrefillFromRecord({
    source: ajb,
    targetLayanan: 'Pengecekan Sertipikat',
    currentNonAkta: BASE_NON_AKTA,
    currentAkta: BASE_AKTA,
    settings: DEFAULT_OFFICE_SETTINGS,
  });

  // Only Pihak I copied (not buyer Pihak II and not Persetujuan Pasangan)
  assert.equal(result.paraPihak.length, 1);
  assert.equal(result.paraPihak[0].nama, 'Slamet Raharjo');
  assert.equal(result.paraPihak[0].peran, 'Pihak I');
  assert.notEqual(result.paraPihak[0].id, ajb.para_pihak[0].id);

  // Tanah & PBB copied accurately
  assert.equal(result.tanah.nib, ajb.tanah.nib);
  assert.equal(result.tanah.luas_m2, 185);
  assert.equal(result.tanah.desa, 'Karangjati');
  assert.equal(result.pemegangHakInput, 'Slamet Raharjo');
  assert.equal(result.pbb.nop, ajb.pbb.nop);

  // Non-Akta always clears nomor_akta and persists link reference
  assert.equal(result.akta.nomor_akta, '');
  assert.equal(result.akta.nama_kuasa_bpn, ajb.akta.nama_kuasa_bpn);
  assert.equal(result.nonAkta.linked_berkas_id, ajb.id);
  assert.equal(result.nonAkta.linked_berkas_kode, ajb.kode_berkas);
  assert.equal(result.nonAkta.linked_berkas_layanan, ajb.layanan);

  // Mutating returned array/object must not mutate source seed record
  result.tanah.pemegang_hak_sertipikat.push('MUTATED');
  assert.equal(ajb.tanah.pemegang_hak_sertipikat.includes('MUTATED'), false);
});

test('buildNonAktaPrefillFromRecord supports pihak2_only (remapped to Pihak I) and all_pihak scopes', () => {
  const ajb = INITIAL_SEED_RECORDS[0];

  const p2Only = buildNonAktaPrefillFromRecord({
    source: ajb,
    targetLayanan: 'Permohonan PKKPR',
    currentNonAkta: BASE_NON_AKTA,
    currentAkta: BASE_AKTA,
    settings: DEFAULT_OFFICE_SETTINGS,
    partyScope: 'pihak2_only',
  });
  assert.equal(p2Only.paraPihak.length, 1);
  assert.equal(p2Only.paraPihak[0].nama, 'Dimas Prasetyo');
  assert.equal(p2Only.paraPihak[0].peran, 'Pihak I');
  assert.match(p2Only.nonAkta.pkkpr_alamat_lokasi || '', /Desa Karangjati/);

  const allParties = buildNonAktaPrefillFromRecord({
    source: ajb,
    targetLayanan: 'Analisis Bidang',
    currentNonAkta: BASE_NON_AKTA,
    currentAkta: BASE_AKTA,
    settings: DEFAULT_OFFICE_SETTINGS,
    partyScope: 'all_pihak',
  });
  assert.equal(allParties.paraPihak.length, 2);
  assert.equal(allParties.paraPihak[0].nama, 'Slamet Raharjo');
  assert.equal(allParties.paraPihak[1].nama, 'Dimas Prasetyo');
});

test('clearNonAktaLinkMetadata removes only link fields while preserving other Non-Akta settings', () => {
  const linked: NonAktaDetail = {
    ...BASE_NON_AKTA,
    linked_berkas_id: 'rec-1',
    linked_berkas_kode: 'REG-2026-001',
    linked_berkas_layanan: 'AJB',
    koordinat_gps: '-7.1912, 110.4211',
  };
  const cleared = clearNonAktaLinkMetadata(linked);
  assert.equal(cleared.linked_berkas_id, undefined);
  assert.equal(cleared.linked_berkas_kode, undefined);
  assert.equal(cleared.linked_berkas_layanan, undefined);
  assert.equal(cleared.koordinat_gps, '-7.1912, 110.4211');
});
