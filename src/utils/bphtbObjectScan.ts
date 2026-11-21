import { ExtractionApiResponse } from '../types/ppats';
import { BphtbSubmissionFormData } from './bphtbSubmissionGenerator';
import { formatNumberId, formatRupiah } from './indonesianFormatter';
import { toScanTitleCase, toScanUpperName } from './scanTextCase';

export interface ObjectTaxScanSyncPayload {
  luas_m2?: number;
  njop_bumi_m2?: number;
  njop_bangunan?: number;
}

function cleanRegionPrefix(val?: string, kind?: 'kec' | 'kab'): string {
  const raw = (val || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (kind === 'kec') return toScanTitleCase(raw.replace(/^(Kecamatan|Kec\.?)\s+/i, '').trim());
  if (kind === 'kab') return toScanTitleCase(raw.replace(/^(Kabupaten|Kab\.?|Kota)\s+/i, '').trim());
  return toScanTitleCase(raw);
}

/**
 * Menormalkan berbagai penulisan RT/RW dari SPPT PBB atau Sertipikat
 * (misal "RT. 002 RW. 003", "RT 002 / RW 003", "002 / 003", "002-003")
 * menjadi format ringkas "002/003".
 */
export function normalizeObjekRtRw(raw?: string): string {
  const text = (raw || '').replace(/\s+/g, ' ').trim();
  if (!text || text === '-' || text === '/') return '';

  const rtRwExplicit =
    /\bRT\.?\s*[:.]?\s*(\d{1,3})\s*[/,-]?\s*RW\.?\s*[:.]?\s*(\d{1,3})\b/i.exec(text);
  if (rtRwExplicit) {
    return `${rtRwExplicit[1]}/${rtRwExplicit[2]}`;
  }

  const slashPair = /\b(\d{1,3})\s*[/\-]\s*(\d{1,3})\b/.exec(text);
  if (slashPair) {
    return `${slashPair[1]}/${slashPair[2]}`;
  }

  return '';
}

/**
 * Memisahkan nama Lokasi/Dukuh dan RT/RW apabila hasil scan menggabungkan keduanya
 * pada satu string (contoh: "GORONGAN RT. 002 RW. 003" -> { lokasi: "GORONGAN", rtRw: "002/003" }).
 */
export function splitLokasiAndRtRw(
  rawLokasi?: string,
  rawRtRw?: string
): { lokasi: string; rtRw: string } {
  const cleanLoc = (rawLokasi || '').replace(/\s+/g, ' ').trim();
  const directRtRw = normalizeObjekRtRw(rawRtRw);
  const embeddedRtRw = normalizeObjekRtRw(cleanLoc);

  const strippedLokasi = cleanLoc
    .replace(/,?\s*\bRT\.?\s*[:.]?\s*\d{1,3}\s*[/,-]?\s*RW\.?\s*[:.]?\s*\d{1,3}\b/gi, '')
    .replace(/,?\s*\bRT\.?\s*[:.]?\s*\d{1,3}\b/gi, '')
    .replace(/,?\s*\bRW\.?\s*[:.]?\s*\d{1,3}\b/gi, '')
    .replace(/^[,.\s-]+|[,.\s-]+$/g, '')
    .trim();

  return {
    lokasi: toScanTitleCase(strippedLokasi),
    rtRw: directRtRw || embeddedRtRw,
  };
}

/**
 * Menentukan luas tanah yang paling akurat dari Sertipikat atau SPPT PBB.
 * Jika angka luas SPPT terpotong baris (misal "16" + "0" terbaca "16" padahal TOTAL NJOP / NJOP per m2 = 160),
 * fungsi ini memverifikasi silang terhadap njop_bumi_total / njop_bumi_m2.
 */
export function resolveAccurateLuasBumiM2(
  tanahLuas?: number,
  pbb?: ExtractionApiResponse['pbb']
): number | undefined {
  const certLuas = Number(tanahLuas) || 0;
  const pbbLuas = Number(pbb?.luas_bumi_m2) || 0;
  const njopPerM2 = Number(pbb?.njop_bumi_m2) || 0;
  const njopTotal = Number(pbb?.njop_bumi_total) || 0;

  let verifiedPbbLuas = pbbLuas;
  let repairedFromTotal = false;

  if (njopPerM2 > 0 && njopTotal > 0) {
    const derivedLuas = njopTotal / njopPerM2;
    const roundedDerived = Math.round(derivedLuas * 100) / 100;
    const isCleanInteger = Math.abs(derivedLuas - Math.round(derivedLuas)) < 0.01;
    if (pbbLuas <= 0 && roundedDerived > 0) {
      verifiedPbbLuas = isCleanInteger ? Math.round(derivedLuas) : roundedDerived;
      repairedFromTotal = true;
    } else if (
      pbbLuas > 0 &&
      isCleanInteger &&
      Math.abs(pbbLuas * njopPerM2 - njopTotal) > njopPerM2 * 0.5
    ) {
      // Hasil OCR pbbLuas (mis. 16 dari "16\n0") tidak cocok dengan rasio eksak TOTAL NJOP / NJOP per m2 (160)
      verifiedPbbLuas = Math.round(derivedLuas);
      repairedFromTotal = true;
    }
  }

  // Jika luas sertipikat valid dan bukan sekadar salinan angka SPPT yang terpotong, prioritaskan sertipikat
  if (certLuas > 0) {
    if (repairedFromTotal && certLuas === pbbLuas && verifiedPbbLuas > 0) {
      return verifiedPbbLuas;
    }
    return certLuas;
  }

  return verifiedPbbLuas > 0 ? verifiedPbbLuas : undefined;
}

/**
 * Menggabungkan hasil pemindaian SPPT PBB dan/atau Sertipikat ke formulir BPHTB
 * tanpa menimpa field yang tidak ada di dokumen yang dipindai.
 */
export function mergeObjectScanIntoBphtbForm(
  prev: BphtbSubmissionFormData,
  data: ExtractionApiResponse
): {
  nextForm: BphtbSubmissionFormData;
  taxPatch: ObjectTaxScanSyncPayload;
  summaryParts: string[];
} {
  const tanah = data.tanah;
  const pbb = data.pbb;

  const scannedCertNumber = (() => {
    if (!tanah) return '';
    const hasNib = Boolean(tanah.nib?.trim());
    const hasNomorLama = Boolean(tanah.nomor_hak_lama?.trim());
    if (!hasNib && !hasNomorLama) return '';

    const isDigital = tanah.jenis_sertipikat === 'digital' || (!hasNomorLama && hasNib);
    if (isDigital && hasNib) {
      return `Elektronik Nib: ${tanah.nib.trim()}`;
    }
    return [
      hasNomorLama ? `No. ${tanah.nomor_hak_lama.trim()}` : '',
      hasNib ? `NIB ${tanah.nib.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' / ');
  })();

  const { lokasi: pbbLokasi, rtRw: pbbRtRw } = splitLokasiAndRtRw(
    pbb?.letak_objek_lokasi,
    pbb?.letak_objek_rt_rw
  );

  const scannedDesa = toScanTitleCase(
    tanah?.desa?.trim() || pbb?.letak_objek_desa?.trim() || ''
  );
  const scannedKec = cleanRegionPrefix(
    tanah?.kecamatan?.trim() || pbb?.letak_objek_kecamatan?.trim(),
    'kec'
  );
  const scannedKab = cleanRegionPrefix(
    tanah?.kabupaten?.trim() || pbb?.letak_objek_kabupaten?.trim(),
    'kab'
  );

  // Prioritaskan nama dukuh/lokasi dari SPPT PBB (misal "Gorongan").
  // Jangan timpa dengan nama desa jika dukuh tidak ditemukan dan field sebelumnya sudah terisi.
  const nextLokasi = pbbLokasi || prev.letaknya_jalan || scannedDesa;
  const nextRtRw = pbbRtRw || prev.objek_rt_rw;

  const scannedOwner = toScanUpperName(
    tanah?.pemegang_hak_sertipikat?.find((n) => n?.trim())?.trim() ||
      pbb?.nama_wp_pbb?.trim() ||
      ''
  );

  const hasValidBuildingArea =
    typeof pbb?.luas_bangunan_m2 === 'number' &&
    Number.isFinite(pbb.luas_bangunan_m2) &&
    pbb.luas_bangunan_m2 >= 0 &&
    Boolean(pbb?.nop?.trim());

  const nextForm: BphtbSubmissionFormData = {
    ...prev,
    nop: pbb?.nop?.trim() || prev.nop,
    tahun_pajak: pbb?.tahun_pajak?.trim() || prev.tahun_pajak,
    jenis_hak: toScanTitleCase(tanah?.jenis_hak) || prev.jenis_hak,
    nomor_sertipikat: scannedCertNumber || prev.nomor_sertipikat,
    letaknya_jalan: nextLokasi,
    objek_rt_rw: nextRtRw,
    desa: scannedDesa || prev.desa,
    kecamatan: scannedKec || prev.kecamatan,
    kabupaten: scannedKab || prev.kabupaten,
    luas_bangunan_m2: hasValidBuildingArea
      ? Math.max(0, pbb!.luas_bangunan_m2!)
      : prev.luas_bangunan_m2,
    pemberi_nama: prev.pemberi_nama.trim() ? prev.pemberi_nama : scannedOwner,
  };

  const taxPatch: ObjectTaxScanSyncPayload = {};
  const summaryParts: string[] = [];

  if (pbb?.nop?.trim()) summaryParts.push(`NOP ${pbb.nop.trim()}`);
  if (pbbLokasi) summaryParts.push(`Lokasi ${pbbLokasi}`);
  if (pbbRtRw) summaryParts.push(`RT/RW ${pbbRtRw}`);
  if (scannedCertNumber) summaryParts.push(scannedCertNumber);
  if (scannedDesa) summaryParts.push(`Desa ${scannedDesa}`);

  const accurateLuas = resolveAccurateLuasBumiM2(tanah?.luas_m2, pbb);
  if (accurateLuas && accurateLuas > 0) {
    taxPatch.luas_m2 = accurateLuas;
    summaryParts.push(`Luas ${formatNumberId(accurateLuas)} m²`);
  }
  if (pbb?.njop_bumi_m2 && pbb.njop_bumi_m2 > 0) {
    taxPatch.njop_bumi_m2 = pbb.njop_bumi_m2;
    summaryParts.push(`NJOP Bumi ${formatRupiah(pbb.njop_bumi_m2)}/m²`);
  }
  if (pbb?.njop_bangunan && pbb.njop_bangunan > 0) {
    taxPatch.njop_bangunan = pbb.njop_bangunan;
    summaryParts.push(`NJOP Bangunan ${formatRupiah(pbb.njop_bangunan)}`);
  }

  return { nextForm, taxPatch, summaryParts };
}
