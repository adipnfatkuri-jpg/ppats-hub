import { BerkasRecord, OfficeSettings, ParaPihak, PemecahanBidangItem } from '../types/ppats';
import {
  formatNumberId,
  formatTanggalDDMMYYYY,
  formatTanggalLengkapHuruf,
  parseFlexibleDate,
  terbilang,
} from './indonesianFormatter';

export interface WarisCHeirRow {
  no: number;
  nama: string;
  tempatLahir: string;
  tanggalLahir: string;
  ttlSlash: string;
  umur: string;
  pekerjaan: string;
  alamatRingkas: string;
  alamatLengkap: string;
}

export interface WarisCRiwayatEntry {
  huruf: 'a' | 'b' | 'c';
  tahun: string;
  oleh: string;
  cara: string;
  bukti: string;
}

export interface ResolvedWarisCConfig {
  sebutanPewaris: 'Almarhum' | 'Almarhumah';
  namaPewaris: string;
  tanggalMeninggalPewaris: string;
  tahunMeninggalPewaris: string;
  tempatMeninggalPewaris: string;
  hubunganPasangan: 'Suaminya' | 'Istrinya' | 'Pasangannya';
  namaPasangan: string;
  tanggalMeninggalPasangan: string;
  tempatMeninggalPasangan: string;
  jumlahAnak: number;
  jumlahAnakTerbilang: string;
  ahliWaris: WarisCHeirRow[];
  hakAdat: string;
  atasNamaC: string;
  tahunTercatatC: string;
  jenisTanah: string;
  berdiriDiAtasnya: string;
  namaBlokDukuh: string;
  penggunaanTanah: string;
  penggunaanTanahPermohonan: string;
  luasIndukM2: number;
  luasIndukStr: string;
  penerimaBagian: string;
  luasBagianM2: number;
  luasBagianStr: string;
  hubunganPewaris: string;
  tahunWaris: string;
  menguasaiSejakTahun: string;
  batasInduk: {
    utara: string;
    timur: string;
    selatan: string;
    barat: string;
  };
  batasBagian: {
    utara: string;
    timur: string;
    selatan: string;
    barat: string;
  };
  bidangPecahan: Array<{
    no: number;
    label: string;
    luasM2: number;
    luasStr: string;
    atasNama: string;
  }>;
  sertakanKuasaPemecahan: boolean;
  namaWpPbb: string;
  nopPbb: string;
  noSuratKeterangan: string;
  noSuratRiwayat: string;
  riwayat: WarisCRiwayatEntry[];
  camatJabatan: string;
  camatNama: string;
  camatNip: string;
  camatNomor: string;
  kadesJabatan: string;
  kadesNama: string;
  kadesNip: string;
  kadesNomor: string;
}

/**
 * Menghitung umur (dalam tahun) dari tanggal lahir fleksibel (DD-MM-YYYY atau YYYY-MM-DD).
 */
export function computeAgeFromBirthDate(
  tanggalLahir?: string,
  refDate: Date = new Date()
): number | null {
  const parsed = parseFlexibleDate(tanggalLahir);
  if (!parsed) return null;
  let age = refDate.getFullYear() - parsed.year;
  const refMonth = refDate.getMonth() + 1;
  const refDay = refDate.getDate();
  if (refMonth < parsed.month || (refMonth === parsed.month && refDay < parsed.day)) {
    age -= 1;
  }
  return age >= 0 && age <= 150 ? age : null;
}

function capitalizeWords(val: string): string {
  return val
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function formatFlexibleDisplayDate(raw?: string): string {
  const clean = (raw || '').trim();
  if (!clean) return '......................';
  const parsed = parseFlexibleDate(clean);
  if (parsed) {
    return formatTanggalLengkapHuruf(clean).tanggal_biasa;
  }
  return clean;
}

function extractYearFromFlexible(raw?: string): string {
  const clean = (raw || '').trim();
  if (!clean) return '........';
  const parsed = parseFlexibleDate(clean);
  if (parsed) return String(parsed.year);
  const match = /\b(19\d{2}|20\d{2})\b/.exec(clean);
  return match ? match[1] : clean;
}

function formatHeirShortAddress(p: ParaPihak): string {
  const parts = [p.alamat_jalan, p.desa_kelurahan].map((s) => (s || '').trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  return [p.kecamatan, p.kabupaten].map((s) => (s || '').trim()).filter(Boolean).join(', ') || '-';
}

function formatHeirFullAddress(p: ParaPihak): string {
  const rtParts = (p.rt_rw || '').split('/').map((s) => s.trim());
  const rtRwPart =
    rtParts[0] || rtParts[1] ? `RT ${rtParts[0] || '000'} / RW ${rtParts[1] || '000'}` : '';
  return (
    [
      [p.alamat_jalan, rtRwPart].filter(Boolean).join(' '),
      p.desa_kelurahan ? `Desa ${p.desa_kelurahan}` : '',
      p.kecamatan ? `Kecamatan ${p.kecamatan}` : '',
      p.kabupaten ? `Kabupaten ${p.kabupaten.replace(/^Kabupaten\s+/i, '')}` : '',
    ]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ') || '-'
  );
}

/**
 * Menormalkan seluruh data & fallback untuk Bundel F4 Waris C
 * (Konversi / Pendaftaran Hak Bekas Hak Milik Adat Letter C).
 */
export function resolveWarisCConfig(
  record: BerkasRecord,
  settings: OfficeSettings,
  refDate: Date = new Date()
): ResolvedWarisCConfig {
  const na = record.non_akta;
  const desaClean = (record.tanah.desa || '').trim() || '..............';
  const kecClean =
    (record.tanah.kecamatan || settings.nama_kecamatan || '')
      .replace(/^Kecamatan\s+/i, '')
      .trim() || '..............';
  const kabClean =
    (record.tanah.kabupaten || settings.nama_kabupaten || '')
      .replace(/^(Kabupaten|Kota)\s+/i, '')
      .trim() || '..............';

  const defaultLocation = `Desa ${desaClean}, Kecamatan ${kecClean}, Kabupaten ${kabClean}`;

  const rawHeirs = record.para_pihak.filter((p) => p.peran !== 'Persetujuan Pasangan');
  const heirsToUse = rawHeirs.length > 0 ? rawHeirs : record.para_pihak;

  const ahliWaris: WarisCHeirRow[] = heirsToUse.map((p, idx) => {
    const tglFormatted = p.tanggal_lahir ? formatTanggalDDMMYYYY(p.tanggal_lahir) : '-';
    const tempat = (p.tempat_lahir || '').trim() || kabClean;
    const age = computeAgeFromBirthDate(p.tanggal_lahir, refDate);
    return {
      no: idx + 1,
      nama: (p.nama || '').trim() || `AHLI WARIS ${idx + 1}`,
      tempatLahir: tempat,
      tanggalLahir: tglFormatted,
      ttlSlash: `${tempat}/ ${tglFormatted}`,
      umur: age !== null ? String(age) : '-',
      pekerjaan: (p.pekerjaan || '').trim() || '-',
      alamatRingkas: formatHeirShortAddress(p),
      alamatLengkap: formatHeirFullAddress(p),
    };
  });

  const jumlahAnak = Math.max(
    1,
    Number(na?.jumlah_anak_waris) || ahliWaris.length || 1
  );
  const jumlahAnakTerbilang = capitalizeWords(terbilang(jumlahAnak));

  const namaPewaris =
    na?.nama_pewaris?.trim() ||
    record.tanah.pemegang_hak_sertipikat?.[0]?.trim() ||
    '........................';

  const hakAdat =
    na?.waris_c_hak_adat?.trim() ||
    record.tanah.nomor_hak_lama?.trim() ||
    record.tanah.nib?.trim() ||
    'C-...... Persil ...... Kelas ......';

  const atasNamaC = na?.waris_c_atas_nama_c?.trim() || namaPewaris;
  const luasIndukM2 = Math.max(0, Number(record.tanah.luas_m2) || 0);
  const luasIndukStr = luasIndukM2 > 0 ? formatNumberId(luasIndukM2) : '..........';

  const penerimaBagian =
    na?.waris_c_penerima_bagian?.trim() ||
    ahliWaris[0]?.nama ||
    '........................';

  const luasBagianM2 =
    Number(na?.waris_c_luas_bagian_m2) > 0
      ? Number(na?.waris_c_luas_bagian_m2)
      : luasIndukM2;
  const luasBagianStr = luasBagianM2 > 0 ? formatNumberId(luasBagianM2) : '..........';

  const batasInduk = {
    utara: record.tanah.batas_utara?.trim() || '........................',
    timur: record.tanah.batas_timur?.trim() || '........................',
    selatan: record.tanah.batas_selatan?.trim() || '........................',
    barat: record.tanah.batas_barat?.trim() || '........................',
  };

  const batasBagian = {
    utara: na?.waris_c_batas_bagian_utara?.trim() || batasInduk.utara,
    timur: na?.waris_c_batas_bagian_timur?.trim() || batasInduk.timur,
    selatan: na?.waris_c_batas_bagian_selatan?.trim() || batasInduk.selatan,
    barat: na?.waris_c_batas_bagian_barat?.trim() || batasInduk.barat,
  };

  const rawBidang: PemecahanBidangItem[] =
    na?.bidang_pecahan && na.bidang_pecahan.length > 0
      ? na.bidang_pecahan
      : ahliWaris.length > 1 && luasIndukM2 > 0
      ? ahliWaris.map((aw, idx) => ({
          id: `waris-c-${idx + 1}`,
          label: `Bidang ${idx + 1}`,
          luas_m2: Math.floor(luasIndukM2 / ahliWaris.length),
          atas_nama: aw.nama,
        }))
      : [
          {
            id: 'waris-c-1',
            label: 'Bidang 1',
            luas_m2: luasBagianM2,
            atas_nama: penerimaBagian,
          },
        ];

  const bidangPecahan = rawBidang.map((b, idx) => {
    const l = Math.max(0, Number(b.luas_m2) || 0);
    return {
      no: idx + 1,
      label: b.label?.trim() || `Bidang ${idx + 1}`,
      luasM2: l,
      luasStr: l > 0 ? formatNumberId(l) : '..........',
      atasNama: b.atas_nama?.trim() || ahliWaris[idx]?.nama || penerimaBagian,
    };
  });

  const penggunaanTanah =
    record.tanah.penggunaan_tanah?.trim() ||
    (record.tanah.status_tanah === 'Pertanian' ? 'Pertanian' : 'Non Pertanian');

  const penggunaanTanahPermohonan =
    record.tanah.status_tanah === 'Pertanian'
      ? 'Pertanian'
      : record.tanah.status_tanah === 'Non-Pertanian'
      ? 'Non Pertanian'
      : penggunaanTanah;

  const tahunMeninggalPewaris = extractYearFromFlexible(na?.tanggal_meninggal);
  const tahunWaris =
    na?.waris_c_tahun_waris?.trim() ||
    (tahunMeninggalPewaris !== '........' ? tahunMeninggalPewaris : '........');

  const riwayat: WarisCRiwayatEntry[] = [
    {
      huruf: 'a',
      tahun: na?.waris_c_riwayat_1_tahun?.trim() || '...................',
      oleh: na?.waris_c_riwayat_1_oleh?.trim() || '........................................',
      cara: na?.waris_c_riwayat_1_cara?.trim() || 'jual beli/hibah/warisan',
      bukti:
        na?.waris_c_riwayat_1_bukti?.trim() ||
        'Akta/Segel/Surat dibawah tangan/Kwitansi/Lisan*)',
    },
    {
      huruf: 'b',
      tahun: na?.waris_c_riwayat_2_tahun?.trim() || '...................',
      oleh: na?.waris_c_riwayat_2_oleh?.trim() || '........................................',
      cara: na?.waris_c_riwayat_2_cara?.trim() || 'jual beli/hibah/warisan',
      bukti:
        na?.waris_c_riwayat_2_bukti?.trim() ||
        'Akta/Segel/Surat dibawah tangan/Kwitansi/Lisan*)',
    },
    {
      huruf: 'c',
      tahun: na?.waris_c_riwayat_3_tahun?.trim() || '...................',
      oleh: na?.waris_c_riwayat_3_oleh?.trim() || '........................................',
      cara: na?.waris_c_riwayat_3_cara?.trim() || 'jual beli/hibah/warisan',
      bukti:
        na?.waris_c_riwayat_3_bukti?.trim() ||
        'Akta/Segel/Surat dibawah tangan/Kwitansi/Lisan*)',
    },
  ];

  const defaultCamatJabatan = `Camat ${kecClean}`;
  const defaultKadesJabatan = `Kepala Desa ${desaClean}`;

  return {
    sebutanPewaris: na?.sebutan_pewaris || 'Almarhum',
    namaPewaris,
    tanggalMeninggalPewaris: formatFlexibleDisplayDate(na?.tanggal_meninggal),
    tahunMeninggalPewaris,
    tempatMeninggalPewaris: na?.tempat_meninggal?.trim() || defaultLocation,
    hubunganPasangan: na?.hubungan_pasangan_pewaris || 'Istrinya',
    namaPasangan: na?.nama_pasangan_pewaris?.trim() || '........................',
    tanggalMeninggalPasangan: formatFlexibleDisplayDate(na?.tanggal_meninggal_pasangan),
    tempatMeninggalPasangan:
      na?.tempat_meninggal_pasangan?.trim() ||
      na?.tempat_meninggal?.trim() ||
      defaultLocation,
    jumlahAnak,
    jumlahAnakTerbilang,
    ahliWaris,
    hakAdat,
    atasNamaC,
    tahunTercatatC: na?.waris_c_tahun_tercatat_c?.trim() || '........',
    jenisTanah: na?.waris_c_jenis_tanah?.trim() || '....................',
    berdiriDiAtasnya: na?.waris_c_berdiri_di_atasnya?.trim() || '..........................',
    namaBlokDukuh:
      na?.waris_c_nama_blok_dukuh?.trim() ||
      (record.para_pihak[0]?.alamat_jalan
        ? `${record.para_pihak[0].alamat_jalan} RT.${record.para_pihak[0].rt_rw || '000/00'}`
        : `${desaClean} RT.000/00`),
    penggunaanTanah,
    penggunaanTanahPermohonan,
    luasIndukM2,
    luasIndukStr,
    penerimaBagian,
    luasBagianM2,
    luasBagianStr,
    hubunganPewaris: na?.waris_c_hubungan_pewaris?.trim() || 'Ayah Kandung',
    tahunWaris,
    menguasaiSejakTahun:
      record.tanah.menguasai_sejak_tahun?.trim() ||
      (tahunWaris !== '........' ? tahunWaris : '........'),
    batasInduk,
    batasBagian,
    bidangPecahan,
    sertakanKuasaPemecahan: na?.waris_c_sertakan_kuasa_pemecahan !== false,
    namaWpPbb: na?.waris_c_nama_wp_pbb?.trim() || atasNamaC,
    nopPbb: record.pbb.nop?.trim() || '....................................',
    noSuratKeterangan: na?.waris_c_no_surat_keterangan?.trim() || '',
    noSuratRiwayat: na?.waris_c_no_surat_riwayat?.trim() || '',
    riwayat,
    camatJabatan: na?.camat_pengesahan_jabatan?.trim() || defaultCamatJabatan,
    camatNama: na?.camat_pengesahan_nama?.trim() || settings.nama_ppats || '........................',
    camatNip: na?.camat_pengesahan_nip?.trim() || settings.nip_ppats || '',
    camatNomor: na?.camat_pengesahan_nomor?.trim() || '',
    kadesJabatan: na?.kades_pengesahan_jabatan?.trim() || defaultKadesJabatan,
    kadesNama: na?.kades_pengesahan_nama?.trim() || '........................',
    kadesNip: na?.kades_pengesahan_nip?.trim() || '',
    kadesNomor: na?.kades_pengesahan_nomor?.trim() || '',
  };
}
