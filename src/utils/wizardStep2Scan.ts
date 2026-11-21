import {
  DataPBB,
  DataTanah,
  ExtractionApiResponse,
  ParaPihak,
  PersonBasicInfo,
} from '../types/ppats';
import { resolveAccurateLuasBumiM2 } from './bphtbObjectScan';
import { resolveJenisSertipikat } from './bundleGenerator';
import { formatNumberId, formatRupiah } from './indonesianFormatter';
import {
  normalizeScanGender,
  toScanTitleCase,
  toScanUpperName,
} from './scanTextCase';

function cleanRegionPrefix(val?: string, kind?: 'kec' | 'kab'): string {
  const raw = (val || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (kind === 'kec') return toScanTitleCase(raw.replace(/^(Kecamatan|Kec\.?)\s+/i, '').trim());
  if (kind === 'kab') return toScanTitleCase(raw.replace(/^(Kabupaten|Kab\.?|Kota)\s+/i, '').trim());
  return toScanTitleCase(raw);
}

/**
 * Mengecek apakah baris Para Pihak / Pemohon masih kosong sehingga scan KTP baru
 * dapat langsung mengisinya tanpa membuat kartu duplikat kosong.
 */
export function isPartyEffectivelyEmpty(p: ParaPihak): boolean {
  return !p.nama.trim() && !p.nik.trim() && !p.alamat_jalan.trim();
}

/**
 * Menggabungkan hasil pemindaian KTP (/api/extract-person) ke satu entri ParaPihak / Pemohon
 * pada Meja Verifikasi & Audit (Langkah 2) secara non-destruktif.
 */
export function mergeScannedPersonIntoParty(
  prev: ParaPihak,
  scanned: PersonBasicInfo
): ParaPihak {
  const rt = (scanned.rt || '').trim();
  const rw = (scanned.rw || '').trim();
  const combinedRtRw = rt && rw ? `${rt}/${rw}` : rt || rw ? `${rt || '000'}/${rw || '000'}` : '';

  return {
    ...prev,
    nik: scanned.nik?.trim() || prev.nik,
    nama: toScanUpperName(scanned.nama) || prev.nama,
    tempat_lahir: toScanTitleCase(scanned.tempat_lahir) || prev.tempat_lahir,
    tanggal_lahir: scanned.tanggal_lahir?.trim() || prev.tanggal_lahir,
    jenis_kelamin: normalizeScanGender(scanned.jenis_kelamin) || prev.jenis_kelamin || 'Laki-laki',
    alamat_jalan: toScanTitleCase(scanned.alamat_jalan) || prev.alamat_jalan,
    rt_rw: combinedRtRw || prev.rt_rw,
    desa_kelurahan: toScanTitleCase(scanned.desa_kelurahan) || prev.desa_kelurahan,
    kecamatan: cleanRegionPrefix(scanned.kecamatan, 'kec') || prev.kecamatan,
    kabupaten: cleanRegionPrefix(scanned.kabupaten, 'kab') || prev.kabupaten,
    pekerjaan: toScanTitleCase(scanned.pekerjaan) || prev.pekerjaan,
    status_perkawinan: toScanTitleCase(scanned.status_perkawinan) || prev.status_perkawinan,
  };
}

/**
 * Menggabungkan hasil pemindaian Sertipikat Tanah (Digital/Analog) dan/atau SPPT PBB
 * ke state `tanah`, `pbb`, dan `pemegangHakInput` pada Meja Verifikasi & Audit (Langkah 2)
 * secara non-destruktif (memindai SPPT tidak menimpa data sertipikat yang sudah terisi).
 */
export function mergeObjectScanIntoWizardTanahPbb(
  prevTanah: DataTanah,
  prevPbb: DataPBB,
  prevPemegangHakInput: string,
  data: ExtractionApiResponse,
  defaults?: { kabupaten?: string; provinsi?: string }
): {
  nextTanah: DataTanah;
  nextPbb: DataPBB;
  nextPemegangHakInput: string;
  summaryParts: string[];
} {
  const scannedTanah = data.tanah;
  const scannedPbb = data.pbb;

  const hasCertSignal = Boolean(
    scannedTanah &&
      (scannedTanah.nib?.trim() ||
        scannedTanah.nomor_hak_lama?.trim() ||
        scannedTanah.surat_ukur_nomor?.trim() ||
        scannedTanah.surat_ukur_tanggal?.trim() ||
        scannedTanah.jenis_sertipikat === 'digital' ||
        scannedTanah.jenis_sertipikat === 'analog')
  );

  const nextJenisSertipikat = hasCertSignal
    ? resolveJenisSertipikat({
        jenis_sertipikat:
          scannedTanah?.jenis_sertipikat === 'digital' ||
          scannedTanah?.jenis_sertipikat === 'analog'
            ? scannedTanah.jenis_sertipikat
            : undefined,
        surat_ukur_nomor: scannedTanah?.surat_ukur_nomor,
        nomor_hak_lama: scannedTanah?.nomor_hak_lama,
      })
    : resolveJenisSertipikat(prevTanah);

  const accurateLuas = resolveAccurateLuasBumiM2(scannedTanah?.luas_m2, scannedPbb);
  const scannedHolders = Array.isArray(scannedTanah?.pemegang_hak_sertipikat)
    ? scannedTanah.pemegang_hak_sertipikat.map((h) => toScanUpperName(h)).filter(Boolean)
    : [];

  const scannedDesa = toScanTitleCase(
    scannedTanah?.desa?.trim() || scannedPbb?.letak_objek_desa?.trim() || ''
  );
  const scannedKec = cleanRegionPrefix(
    scannedTanah?.kecamatan?.trim() || scannedPbb?.letak_objek_kecamatan?.trim(),
    'kec'
  );
  const scannedKab = cleanRegionPrefix(
    scannedTanah?.kabupaten?.trim() || scannedPbb?.letak_objek_kabupaten?.trim(),
    'kab'
  );

  const nextTanah: DataTanah = {
    ...prevTanah,
    jenis_sertipikat: nextJenisSertipikat,
    jenis_hak: toScanTitleCase(scannedTanah?.jenis_hak) || prevTanah.jenis_hak || 'Hak Milik',
    nib: scannedTanah?.nib?.trim() || prevTanah.nib,
    nomor_hak_lama:
      nextJenisSertipikat === 'analog'
        ? scannedTanah?.nomor_hak_lama?.trim() || prevTanah.nomor_hak_lama
        : prevTanah.nomor_hak_lama,
    surat_ukur_tanggal:
      scannedTanah?.surat_ukur_tanggal?.trim() || prevTanah.surat_ukur_tanggal || '',
    surat_ukur_nomor:
      scannedTanah?.surat_ukur_nomor?.trim() || prevTanah.surat_ukur_nomor || '',
    luas_m2:
      accurateLuas && accurateLuas > 0
        ? accurateLuas
        : prevTanah.luas_m2,
    desa: scannedDesa || prevTanah.desa,
    kecamatan: scannedKec || prevTanah.kecamatan,
    kabupaten: scannedKab || prevTanah.kabupaten || defaults?.kabupaten || '',
    provinsi:
      toScanTitleCase(scannedTanah?.provinsi) ||
      prevTanah.provinsi ||
      defaults?.provinsi ||
      'Jawa Tengah',
    batas_utara: toScanTitleCase(scannedTanah?.batas_utara) || prevTanah.batas_utara || '',
    batas_timur: toScanTitleCase(scannedTanah?.batas_timur) || prevTanah.batas_timur || '',
    batas_selatan: toScanTitleCase(scannedTanah?.batas_selatan) || prevTanah.batas_selatan || '',
    batas_barat: toScanTitleCase(scannedTanah?.batas_barat) || prevTanah.batas_barat || '',
    dasar_perolehan: toScanTitleCase(scannedTanah?.dasar_perolehan) || prevTanah.dasar_perolehan,
    pemegang_hak_sertipikat:
      scannedHolders.length > 0 ? scannedHolders : prevTanah.pemegang_hak_sertipikat,
  };

  const nextPemegangHakInput =
    scannedHolders.length > 0 ? scannedHolders.join(', ') : prevPemegangHakInput;

  const nextPbb: DataPBB = {
    nop: scannedPbb?.nop?.trim() || prevPbb.nop,
    tahun_pajak: scannedPbb?.tahun_pajak?.trim() || prevPbb.tahun_pajak,
    njop_bumi_m2:
      scannedPbb?.njop_bumi_m2 && scannedPbb.njop_bumi_m2 > 0
        ? scannedPbb.njop_bumi_m2
        : prevPbb.njop_bumi_m2,
    njop_bangunan:
      scannedPbb?.njop_bangunan && scannedPbb.njop_bangunan > 0
        ? scannedPbb.njop_bangunan
        : prevPbb.njop_bangunan,
  };

  const summaryParts: string[] = [];
  if (scannedTanah?.nib?.trim()) summaryParts.push(`NIB ${scannedTanah.nib.trim()}`);
  if (scannedTanah?.nomor_hak_lama?.trim()) {
    summaryParts.push(`SHM ${scannedTanah.nomor_hak_lama.trim()}`);
  }
  if (scannedPbb?.nop?.trim()) summaryParts.push(`NOP ${scannedPbb.nop.trim()}`);
  if (accurateLuas && accurateLuas > 0) {
    summaryParts.push(`Luas ${formatNumberId(accurateLuas)} m²`);
  }
  if (scannedDesa) summaryParts.push(`Desa ${scannedDesa}`);
  if (scannedPbb?.njop_bumi_m2 && scannedPbb.njop_bumi_m2 > 0) {
    summaryParts.push(`NJOP ${formatRupiah(scannedPbb.njop_bumi_m2)}/m²`);
  }

  return { nextTanah, nextPbb, nextPemegangHakInput, summaryParts };
}
