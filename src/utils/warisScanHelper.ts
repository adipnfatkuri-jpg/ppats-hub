import {
  DataPBB,
  DataTanah,
  NonAktaDetail,
  WarisCScanResult,
  WarisPewarisScanResult,
} from '../types/ppats';
import { formatTanggalDDMMYYYY } from './indonesianFormatter';
import { toScanTitleCase, toScanUpperName } from './scanTextCase';

function cleanStr(val?: string | null): string {
  return typeof val === 'string' ? val.replace(/\s+/g, ' ').trim() : '';
}

function normalizeDateField(val?: string | null): string {
  const raw = cleanStr(val);
  if (!raw) return '';
  return formatTanggalDDMMYYYY(raw);
}

function normalizeSebutanPewaris(
  val?: string | null
): 'Almarhum' | 'Almarhumah' | undefined {
  const raw = cleanStr(val).toLowerCase();
  if (!raw) return undefined;
  if (raw.includes('almarhumah') || raw === 'almh' || raw === 'almh.') {
    return 'Almarhumah';
  }
  if (raw.includes('almarhum') || raw === 'alm' || raw === 'alm.') {
    return 'Almarhum';
  }
  return undefined;
}

function normalizeHubunganPasangan(
  val?: string | null
): 'Istrinya' | 'Suaminya' | 'Pasangannya' | undefined {
  const raw = cleanStr(val).toLowerCase();
  if (!raw) return undefined;
  if (raw.includes('istri')) return 'Istrinya';
  if (raw.includes('suami')) return 'Suaminya';
  if (raw.includes('pasangan')) return 'Pasangannya';
  return undefined;
}

const VALID_WARIS_C_JENIS_TANAH = new Map<string, string>([
  ['pekarangan', 'Pekarangan'],
  ['pertanian', 'Pertanian'],
  ['sawah', 'Pertanian'],
  ['tegalan', 'Tegalan'],
  ['tanah dan bangunan', 'Tanah dan Bangunan'],
]);

function normalizeWarisCJenisTanah(val?: string | null): string | undefined {
  const raw = cleanStr(val).toLowerCase();
  if (!raw) return undefined;
  for (const [key, canonical] of VALID_WARIS_C_JENIS_TANAH.entries()) {
    if (raw.includes(key)) return canonical;
  }
  return undefined;
}

export interface MergePewarisScanOutput {
  nextNonAkta: NonAktaDetail;
  summaryParts: string[];
  updatedCount: number;
}

/**
 * Menggabungkan hasil pemindaian AI Dokumen Pewaris / SKW / Akta Kematian ke state `nonAkta`.
 * Hanya memperbarui field yang berhasil terbaca oleh AI (field kosong tidak menimpa isian lama).
 */
export function mergePewarisScanIntoNonAkta(
  prev: NonAktaDetail,
  scanned?: WarisPewarisScanResult | null
): MergePewarisScanOutput {
  if (!scanned) {
    return { nextNonAkta: prev, summaryParts: [], updatedCount: 0 };
  }

  const next: NonAktaDetail = { ...prev };
  const summaryParts: string[] = [];
  let updatedCount = 0;

  const sebutan = normalizeSebutanPewaris(scanned.sebutan_pewaris);
  if (sebutan) {
    next.sebutan_pewaris = sebutan;
    updatedCount += 1;
  }

  const namaPewaris = toScanUpperName(scanned.nama_pewaris);
  if (namaPewaris) {
    next.nama_pewaris = namaPewaris;
    summaryParts.push(`Pewaris: ${namaPewaris}`);
    updatedCount += 1;
  }

  const tglMeninggal = normalizeDateField(scanned.tanggal_meninggal);
  if (tglMeninggal) {
    next.tanggal_meninggal = tglMeninggal;
    summaryParts.push(`Wafat: ${tglMeninggal}`);
    updatedCount += 1;
  }

  const tempatMeninggal = toScanTitleCase(scanned.tempat_meninggal);
  if (tempatMeninggal) {
    next.tempat_meninggal = tempatMeninggal;
    updatedCount += 1;
  }

  const hubunganPasangan = normalizeHubunganPasangan(scanned.hubungan_pasangan_pewaris);
  if (hubunganPasangan) {
    next.hubungan_pasangan_pewaris = hubunganPasangan;
    updatedCount += 1;
  }

  const namaPasangan = toScanUpperName(scanned.nama_pasangan_pewaris);
  if (namaPasangan) {
    next.nama_pasangan_pewaris = namaPasangan;
    summaryParts.push(`Pasangan: ${namaPasangan}`);
    updatedCount += 1;
  }

  const tglLahirPasangan = normalizeDateField(scanned.tgl_lahir_pasangan_pewaris);
  if (tglLahirPasangan) {
    next.tgl_lahir_pasangan_pewaris = tglLahirPasangan;
    updatedCount += 1;
  }

  const tglMeninggalPasangan = normalizeDateField(scanned.tanggal_meninggal_pasangan);
  if (tglMeninggalPasangan) {
    next.tanggal_meninggal_pasangan = tglMeninggalPasangan;
    updatedCount += 1;
  }

  const tempatMeninggalPasangan = toScanTitleCase(scanned.tempat_meninggal_pasangan);
  if (tempatMeninggalPasangan) {
    next.tempat_meninggal_pasangan = tempatMeninggalPasangan;
    updatedCount += 1;
  }

  const jumlahAnak = Number(scanned.jumlah_anak_waris);
  if (Number.isFinite(jumlahAnak) && jumlahAnak > 0) {
    next.jumlah_anak_waris = Math.round(jumlahAnak);
    updatedCount += 1;
  }

  const catatanSkw = cleanStr(scanned.catatan_skw);
  if (catatanSkw) {
    next.catatan_skw = catatanSkw;
    updatedCount += 1;
  }

  return { nextNonAkta: next, summaryParts, updatedCount };
}

export interface MergeWarisCScanOutput {
  nextNonAkta: NonAktaDetail;
  nextTanah: DataTanah;
  nextPbb: DataPBB;
  summaryParts: string[];
  updatedCount: number;
}

/**
 * Menggabungkan hasil pemindaian AI Dokumen Khusus Waris Letter C (Buku Letter C, Surat Riwayat,
 * Pembagian Warisan, SKW, SPPT PBB, atau Word) ke state `nonAkta`, serta mengisi field `tanah`/`pbb`
 * yang masih kosong secara non-destruktif.
 */
export function mergeWarisCScanIntoState(
  prevNonAkta: NonAktaDetail,
  prevTanah: DataTanah,
  prevPbb: DataPBB,
  scanned?: WarisCScanResult | null
): MergeWarisCScanOutput {
  if (!scanned) {
    return {
      nextNonAkta: prevNonAkta,
      nextTanah: prevTanah,
      nextPbb: prevPbb,
      summaryParts: [],
      updatedCount: 0,
    };
  }

  // Mulai dari merge field Pewaris / Pasangan yang mungkin ikut terbaca di bundel Waris C
  const pewarisMerged = mergePewarisScanIntoNonAkta(prevNonAkta, scanned);
  const nextNonAkta: NonAktaDetail = { ...pewarisMerged.nextNonAkta };
  const nextTanah: DataTanah = { ...prevTanah };
  const nextPbb: DataPBB = { ...prevPbb };
  const summaryParts: string[] = [];
  let updatedCount = pewarisMerged.updatedCount;

  const hakAdat = cleanStr(scanned.waris_c_hak_adat);
  if (hakAdat) {
    nextNonAkta.waris_c_hak_adat = hakAdat;
    summaryParts.push(hakAdat);
    updatedCount += 1;
  }

  const atasNamaC = toScanUpperName(scanned.waris_c_atas_nama_c);
  if (atasNamaC) {
    nextNonAkta.waris_c_atas_nama_c = atasNamaC;
    summaryParts.push(`a.n. ${atasNamaC}`);
    updatedCount += 1;
  }

  const tahunC = cleanStr(scanned.waris_c_tahun_tercatat_c);
  if (tahunC) {
    nextNonAkta.waris_c_tahun_tercatat_c = tahunC;
    updatedCount += 1;
  }

  const jenisTanah = normalizeWarisCJenisTanah(scanned.waris_c_jenis_tanah);
  if (jenisTanah) {
    nextNonAkta.waris_c_jenis_tanah = jenisTanah;
    updatedCount += 1;
  }

  const berdiri = toScanTitleCase(scanned.waris_c_berdiri_di_atasnya);
  if (berdiri) {
    nextNonAkta.waris_c_berdiri_di_atasnya = berdiri;
    updatedCount += 1;
  }

  const blokDukuh = toScanTitleCase(scanned.waris_c_nama_blok_dukuh);
  if (blokDukuh) {
    nextNonAkta.waris_c_nama_blok_dukuh = blokDukuh;
    updatedCount += 1;
  }

  const namaWp = toScanUpperName(scanned.waris_c_nama_wp_pbb);
  if (namaWp) {
    nextNonAkta.waris_c_nama_wp_pbb = namaWp;
    updatedCount += 1;
  }

  const noSuket = cleanStr(scanned.waris_c_no_surat_keterangan);
  if (noSuket) {
    nextNonAkta.waris_c_no_surat_keterangan = noSuket;
    updatedCount += 1;
  }

  const noRiwayat = cleanStr(scanned.waris_c_no_surat_riwayat);
  if (noRiwayat) {
    nextNonAkta.waris_c_no_surat_riwayat = noRiwayat;
    updatedCount += 1;
  }

  const penerima = toScanUpperName(scanned.waris_c_penerima_bagian);
  if (penerima) {
    nextNonAkta.waris_c_penerima_bagian = penerima;
    summaryParts.push(`Penerima: ${penerima}`);
    updatedCount += 1;
  }

  const luasBagian = Number(scanned.waris_c_luas_bagian_m2);
  if (Number.isFinite(luasBagian) && luasBagian > 0) {
    nextNonAkta.waris_c_luas_bagian_m2 = Math.round(luasBagian * 100) / 100;
    summaryParts.push(`Bagian ${nextNonAkta.waris_c_luas_bagian_m2} m²`);
    updatedCount += 1;
  }

  const tahunWaris = cleanStr(scanned.waris_c_tahun_waris);
  if (tahunWaris) {
    nextNonAkta.waris_c_tahun_waris = tahunWaris;
    updatedCount += 1;
  }

  const hubunganPewaris = cleanStr(scanned.waris_c_hubungan_pewaris);
  if (hubunganPewaris) {
    nextNonAkta.waris_c_hubungan_pewaris = hubunganPewaris;
    updatedCount += 1;
  }

  const batasFields: Array<
    [
      keyof Pick<
        WarisCScanResult,
        | 'waris_c_batas_bagian_utara'
        | 'waris_c_batas_bagian_timur'
        | 'waris_c_batas_bagian_selatan'
        | 'waris_c_batas_bagian_barat'
      >,
      keyof Pick<
        NonAktaDetail,
        | 'waris_c_batas_bagian_utara'
        | 'waris_c_batas_bagian_timur'
        | 'waris_c_batas_bagian_selatan'
        | 'waris_c_batas_bagian_barat'
      >,
    ]
  > = [
    ['waris_c_batas_bagian_utara', 'waris_c_batas_bagian_utara'],
    ['waris_c_batas_bagian_timur', 'waris_c_batas_bagian_timur'],
    ['waris_c_batas_bagian_selatan', 'waris_c_batas_bagian_selatan'],
    ['waris_c_batas_bagian_barat', 'waris_c_batas_bagian_barat'],
  ];

  for (const [srcKey, dstKey] of batasFields) {
    const val = toScanTitleCase(scanned[srcKey]);
    if (val) {
      nextNonAkta[dstKey] = val;
      updatedCount += 1;
    }
  }

  const riwayatKeys: Array<
    keyof Pick<
      NonAktaDetail,
      | 'waris_c_riwayat_1_tahun'
      | 'waris_c_riwayat_1_oleh'
      | 'waris_c_riwayat_1_cara'
      | 'waris_c_riwayat_1_bukti'
      | 'waris_c_riwayat_2_tahun'
      | 'waris_c_riwayat_2_oleh'
      | 'waris_c_riwayat_2_cara'
      | 'waris_c_riwayat_2_bukti'
      | 'waris_c_riwayat_3_tahun'
      | 'waris_c_riwayat_3_oleh'
      | 'waris_c_riwayat_3_cara'
      | 'waris_c_riwayat_3_bukti'
    >
  > = [
    'waris_c_riwayat_1_tahun',
    'waris_c_riwayat_1_oleh',
    'waris_c_riwayat_1_cara',
    'waris_c_riwayat_1_bukti',
    'waris_c_riwayat_2_tahun',
    'waris_c_riwayat_2_oleh',
    'waris_c_riwayat_2_cara',
    'waris_c_riwayat_2_bukti',
    'waris_c_riwayat_3_tahun',
    'waris_c_riwayat_3_oleh',
    'waris_c_riwayat_3_cara',
    'waris_c_riwayat_3_bukti',
  ];

  let riwayatUpdated = 0;
  for (const key of riwayatKeys) {
    const rawVal = cleanStr(scanned[key]);
    if (!rawVal) continue;
    nextNonAkta[key] = key.endsWith('_oleh')
      ? toScanUpperName(rawVal)
      : key.endsWith('_tahun')
        ? rawVal
        : toScanTitleCase(rawVal);
    riwayatUpdated += 1;
    updatedCount += 1;
  }
  if (riwayatUpdated > 0) {
    summaryParts.push('Riwayat Tanah terisi');
  }

  // Isi data objek tanah / NOP jika masih kosong (non-destruktif)
  const luasInduk = Number(scanned.luas_induk_m2);
  if ((!nextTanah.luas_m2 || nextTanah.luas_m2 <= 0) && Number.isFinite(luasInduk) && luasInduk > 0) {
    nextTanah.luas_m2 = Math.round(luasInduk * 100) / 100;
    updatedCount += 1;
  }
  const desa = toScanTitleCase(scanned.desa);
  if (!cleanStr(nextTanah.desa) && desa) {
    nextTanah.desa = desa;
    updatedCount += 1;
  }
  const kecamatan = toScanTitleCase(scanned.kecamatan);
  if (!cleanStr(nextTanah.kecamatan) && kecamatan) {
    nextTanah.kecamatan = kecamatan;
    updatedCount += 1;
  }
  const kabupaten = toScanTitleCase(scanned.kabupaten);
  if (!cleanStr(nextTanah.kabupaten) && kabupaten) {
    nextTanah.kabupaten = kabupaten;
    updatedCount += 1;
  }
  const nop = cleanStr(scanned.nop);
  if (!cleanStr(nextPbb.nop) && nop) {
    nextPbb.nop = nop;
    updatedCount += 1;
  }

  // Tambahkan ringkasan pewaris jika summaryParts masih pendek
  for (const part of pewarisMerged.summaryParts) {
    if (!summaryParts.includes(part) && summaryParts.length < 4) {
      summaryParts.push(part);
    }
  }

  return {
    nextNonAkta,
    nextTanah,
    nextPbb,
    summaryParts,
    updatedCount,
  };
}
