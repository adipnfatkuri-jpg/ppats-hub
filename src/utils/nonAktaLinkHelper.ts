import {
  BerkasRecord,
  DataPBB,
  DataTanah,
  NonAktaDetail,
  OfficeSettings,
  ParaPihak,
  ParameterAkta,
  PersonBasicInfo,
  ServiceType,
} from '../types/ppats';
import { extractDashboardParties } from './dashboardHelpers';
import { formatNumberId } from './indonesianFormatter';

export type NonAktaPartyCopyScope = 'pihak1_only' | 'pihak2_only' | 'all_pihak';

export interface NonAktaLinkPrefillResult {
  paraPihak: ParaPihak[];
  tanah: DataTanah;
  pemegangHakInput: string;
  pbb: DataPBB;
  akta: ParameterAkta;
  nonAkta: NonAktaDetail;
  copiedPartyCount: number;
}

function clonePersonBasicInfo(info?: PersonBasicInfo): PersonBasicInfo | undefined {
  if (!info) return undefined;
  return { ...info };
}

function makeFreshPartyId(index: number, seed: string): string {
  return `p-link-${seed}-${index + 1}-${Math.random().toString(36).slice(2, 6)}`;
}

export function getLinkableBerkasRecords(
  existingRecords: BerkasRecord[],
  excludeRecordId?: string | null
): BerkasRecord[] {
  return [...existingRecords]
    .filter((rec) => !excludeRecordId || rec.id !== excludeRecordId)
    .sort((a, b) => b.no_urut - a.no_urut);
}

export function hasSecondPartyInRecord(record: BerkasRecord): boolean {
  return record.para_pihak.some(
    (p) => p.peran === 'Pihak II' && p.nama.trim().length > 0
  );
}

export function formatLinkableBerkasOptionLabel(record: BerkasRecord): string {
  const parties = extractDashboardParties(record);
  const partyText =
    parties.pihakPenerimaText !== '-'
      ? `${parties.pihakPertamaText} → ${parties.pihakPenerimaText}`
      : parties.pihakPertamaText;
  const luasLabel = `${formatNumberId(record.tanah.luas_m2)} m²`;
  const desaSuffix = record.tanah.desa?.trim() ? ` · ${record.tanah.desa.trim()}` : '';
  return `${record.kode_berkas} · ${record.layanan} · ${partyText} (${luasLabel}${desaSuffix})`;
}

function selectPartiesForScope(
  sourceParties: ParaPihak[],
  scope: NonAktaPartyCopyScope,
  idSeed: string
): ParaPihak[] {
  const nonSpouse = sourceParties.filter((p) => p.peran !== 'Persetujuan Pasangan');
  const pool = nonSpouse.length > 0 ? nonSpouse : sourceParties;

  let chosen: ParaPihak[] = [];
  if (scope === 'pihak1_only') {
    const p1 = pool.filter((p) => p.peran === 'Pihak I');
    chosen = p1.length > 0 ? p1 : pool.slice(0, 1);
    return chosen.map((p, idx) => ({
      ...p,
      id: makeFreshPartyId(idx, idSeed),
      peran: 'Pihak I',
    }));
  }

  if (scope === 'pihak2_only') {
    const p2 = pool.filter((p) => p.peran === 'Pihak II');
    if (p2.length > 0) {
      return p2.map((p, idx) => ({
        ...p,
        id: makeFreshPartyId(idx, idSeed),
        peran: 'Pihak I',
      }));
    }
    const p1 = pool.filter((p) => p.peran === 'Pihak I');
    chosen = p1.length > 0 ? p1 : pool.slice(0, 1);
    return chosen.map((p, idx) => ({
      ...p,
      id: makeFreshPartyId(idx, idSeed),
      peran: 'Pihak I',
    }));
  }

  return pool.map((p, idx) => ({
    ...p,
    id: makeFreshPartyId(idx, idSeed),
  }));
}

function resolveDefaultJenisSertipikat(tanah: DataTanah): 'digital' | 'analog' {
  if (tanah.jenis_sertipikat === 'digital' || tanah.jenis_sertipikat === 'analog') {
    return tanah.jenis_sertipikat;
  }
  const hasSuratUkur = Boolean(tanah.surat_ukur_nomor?.trim() || tanah.surat_ukur_tanggal?.trim());
  if (hasSuratUkur && !tanah.nib?.trim()) {
    return 'analog';
  }
  return 'digital';
}

export function buildNonAktaPrefillFromRecord(params: {
  source: BerkasRecord;
  targetLayanan: ServiceType;
  currentNonAkta: NonAktaDetail;
  currentAkta: ParameterAkta;
  settings: OfficeSettings;
  partyScope?: NonAktaPartyCopyScope;
}): NonAktaLinkPrefillResult {
  const {
    source,
    targetLayanan,
    currentNonAkta,
    currentAkta,
    settings,
    partyScope = 'pihak1_only',
  } = params;

  const idSeed = source.kode_berkas.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'rec';
  const clonedParties = selectPartiesForScope(source.para_pihak, partyScope, idSeed);

  const clonedTanah: DataTanah = {
    jenis_sertipikat: resolveDefaultJenisSertipikat(source.tanah),
    jenis_hak: source.tanah.jenis_hak || 'Hak Milik',
    nib: source.tanah.nib || '',
    nomor_hak_lama: source.tanah.nomor_hak_lama || '',
    surat_ukur_tanggal: source.tanah.surat_ukur_tanggal || '',
    surat_ukur_nomor: source.tanah.surat_ukur_nomor || '',
    luas_m2: source.tanah.luas_m2 || 0,
    desa: source.tanah.desa || '',
    kecamatan:
      source.tanah.kecamatan ||
      settings.nama_kecamatan.replace(/^Kecamatan\s+/i, ''),
    kabupaten: source.tanah.kabupaten || settings.nama_kabupaten,
    provinsi: source.tanah.provinsi || settings.nama_provinsi || 'Jawa Tengah',
    batas_utara: source.tanah.batas_utara || '',
    batas_timur: source.tanah.batas_timur || '',
    batas_selatan: source.tanah.batas_selatan || '',
    batas_barat: source.tanah.batas_barat || '',
    penggunaan_tanah: source.tanah.penggunaan_tanah || 'Pekarangan',
    status_tanah: source.tanah.status_tanah || 'Non-Pertanian',
    tanggal_pernyataan_pertanian: source.tanah.tanggal_pernyataan_pertanian || '',
    menguasai_sejak_tahun: source.tanah.menguasai_sejak_tahun || '',
    dasar_perolehan: source.tanah.dasar_perolehan || '',
    pemegang_hak_sertipikat: [...(source.tanah.pemegang_hak_sertipikat ?? [])],
  };

  const clonedPbb: DataPBB = {
    nop: source.pbb.nop || '',
    tahun_pajak: source.pbb.tahun_pajak || String(new Date().getFullYear()),
    njop_bumi_m2: source.pbb.njop_bumi_m2 || 0,
    njop_bangunan: source.pbb.njop_bangunan || 0,
  };

  const nextAkta: ParameterAkta = {
    ...currentAkta,
    nomor_akta: '',
    nama_kuasa_bpn: source.akta.nama_kuasa_bpn || currentAkta.nama_kuasa_bpn,
    kuasa_bpn_detail:
      clonePersonBasicInfo(source.akta.kuasa_bpn_detail) ??
      clonePersonBasicInfo(currentAkta.kuasa_bpn_detail),
    saksi_1: source.akta.saksi_1 || currentAkta.saksi_1,
    saksi_1_detail:
      clonePersonBasicInfo(source.akta.saksi_1_detail) ??
      clonePersonBasicInfo(currentAkta.saksi_1_detail),
    saksi_2: source.akta.saksi_2 || currentAkta.saksi_2,
    saksi_2_detail:
      clonePersonBasicInfo(source.akta.saksi_2_detail) ??
      clonePersonBasicInfo(currentAkta.saksi_2_detail),
  };

  const sourceNa = source.non_akta;
  const locationParts = [
    clonedTanah.desa ? `Desa ${clonedTanah.desa}` : '',
    clonedTanah.kecamatan ? `Kecamatan ${clonedTanah.kecamatan}` : '',
    clonedTanah.kabupaten || '',
  ].filter(Boolean);
  const derivedLocation = locationParts.join(', ');

  const primaryHolderName = clonedTanah.pemegang_hak_sertipikat[0] ?? '';
  const primaryApplicantName = clonedParties[0]?.nama ?? '';

  const nextNonAkta: NonAktaDetail = {
    ...currentNonAkta,
    linked_berkas_id: source.id,
    linked_berkas_kode: source.kode_berkas,
    linked_berkas_layanan: source.layanan,
    koordinat_gps: sourceNa?.koordinat_gps || currentNonAkta.koordinat_gps,
    link_maps: sourceNa?.link_maps || currentNonAkta.link_maps,
    koordinat_poligon: sourceNa?.koordinat_poligon || currentNonAkta.koordinat_poligon,
    kades_pengesahan_jabatan:
      clonedTanah.desa
        ? `Kepala Desa ${clonedTanah.desa}`
        : currentNonAkta.kades_pengesahan_jabatan,
    pkkpr_alamat_lokasi:
      targetLayanan === 'Permohonan PKKPR'
        ? currentNonAkta.pkkpr_alamat_lokasi?.trim() || derivedLocation
        : currentNonAkta.pkkpr_alamat_lokasi,
    nama_di_sertipikat:
      targetLayanan === 'Ralat Data'
        ? primaryHolderName || currentNonAkta.nama_di_sertipikat
        : currentNonAkta.nama_di_sertipikat,
    nama_di_ktp_kk:
      targetLayanan === 'Ralat Data'
        ? primaryApplicantName || currentNonAkta.nama_di_ktp_kk
        : currentNonAkta.nama_di_ktp_kk,
    nama_pewaris:
      targetLayanan === 'Turun Waris' || targetLayanan === 'Waris C'
        ? sourceNa?.nama_pewaris || primaryHolderName || currentNonAkta.nama_pewaris
        : currentNonAkta.nama_pewaris,
    waris_c_hak_adat:
      targetLayanan === 'Waris C'
        ? sourceNa?.waris_c_hak_adat ||
          clonedTanah.nomor_hak_lama ||
          clonedTanah.nib ||
          currentNonAkta.waris_c_hak_adat
        : currentNonAkta.waris_c_hak_adat,
    waris_c_atas_nama_c:
      targetLayanan === 'Waris C'
        ? sourceNa?.waris_c_atas_nama_c ||
          sourceNa?.nama_pewaris ||
          primaryHolderName ||
          currentNonAkta.waris_c_atas_nama_c
        : currentNonAkta.waris_c_atas_nama_c,
  };

  return {
    paraPihak: clonedParties,
    tanah: clonedTanah,
    pemegangHakInput: clonedTanah.pemegang_hak_sertipikat.join(', '),
    pbb: clonedPbb,
    akta: nextAkta,
    nonAkta: nextNonAkta,
    copiedPartyCount: clonedParties.length,
  };
}

export function clearNonAktaLinkMetadata(currentNonAkta: NonAktaDetail): NonAktaDetail {
  const next = { ...currentNonAkta };
  delete next.linked_berkas_id;
  delete next.linked_berkas_kode;
  delete next.linked_berkas_layanan;
  return next;
}
