import type { OfficeSettings, PersonBasicInfo } from '../types/ppats';
import { formatTanggalDDMMYYYY, parseFlexibleDate } from './indonesianFormatter';

export interface PpatsIdentityDefaults {
  ttl: string;
  nik: string;
  pekerjaan: string;
  alamat: string;
}

/**
 * Menggabungkan tempat lahir & tanggal lahir PPATS menjadi string rapi
 * berformat "Tempat, DD-MM-YYYY" (atau salah satu jika hanya satu yang terisi).
 */
export function formatPpatsTtl(
  settings: Pick<OfficeSettings, 'tempat_lahir_ppats' | 'tanggal_lahir_ppats'>
): string {
  const tempat = (settings.tempat_lahir_ppats || '').replace(/\s+/g, ' ').trim();
  const rawTgl = (settings.tanggal_lahir_ppats || '').replace(/\s+/g, ' ').trim();
  const tgl = rawTgl ? formatTanggalDDMMYYYY(rawTgl) || rawTgl : '';

  if (tempat && tgl) return `${tempat}, ${tgl}`;
  if (tempat) return tempat;
  if (tgl) return tgl;
  return '';
}

/**
 * Memecah input gabungan "Tempat, DD-MM-YYYY" (mis. dari form Pengecekan Sertipikat)
 * kembali menjadi { tempat_lahir_ppats, tanggal_lahir_ppats } untuk disimpan ke OfficeSettings.
 */
export function parsePpatsTtlInput(ttlInput: string): {
  tempat_lahir_ppats: string;
  tanggal_lahir_ppats: string;
} {
  const cleaned = (ttlInput || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return { tempat_lahir_ppats: '', tanggal_lahir_ppats: '' };
  }

  const commaIdx = cleaned.indexOf(',');
  if (commaIdx >= 0) {
    const tempat = cleaned.slice(0, commaIdx).trim();
    const rawDate = cleaned.slice(commaIdx + 1).trim();
    const parsed = parseFlexibleDate(rawDate);
    return {
      tempat_lahir_ppats: tempat,
      tanggal_lahir_ppats: parsed ? parsed.ddMmYyyy : rawDate,
    };
  }

  // Jika tanpa koma, cek apakah keseluruhan string merupakan tanggal
  const parsedWhole = parseFlexibleDate(cleaned);
  if (parsedWhole) {
    return {
      tempat_lahir_ppats: '',
      tanggal_lahir_ppats: parsedWhole.ddMmYyyy,
    };
  }

  return {
    tempat_lahir_ppats: cleaned,
    tanggal_lahir_ppats: '',
  };
}

/**
 * Menyusun nilai bawaan identitas pribadi PPATS untuk form Non-Akta & dokumen BPN.
 * Alamat memprioritaskan alamat domisili/KTP PPATS, lalu fallback ke alamat kantor.
 */
export function resolveDefaultPpatsIdentity(
  settings: Pick<
    OfficeSettings,
    | 'nama_kecamatan'
    | 'nik_ppats'
    | 'tempat_lahir_ppats'
    | 'tanggal_lahir_ppats'
    | 'alamat_ppats'
    | 'alamat_kantor'
  >
): PpatsIdentityDefaults {
  const kecClean = (settings.nama_kecamatan || '')
    .replace(/^Kecamatan\s+/i, '')
    .trim();

  return {
    ttl: formatPpatsTtl(settings),
    nik: (settings.nik_ppats || '').trim(),
    pekerjaan: `Camat ${kecClean || '-'} / PPATS`,
    alamat: (settings.alamat_ppats || '').trim() || (settings.alamat_kantor || '').trim(),
  };
}

/**
 * Membangun alamat domisili lengkap satu baris dari hasil scan KTP.
 */
export function buildFullAddressFromScannedPerson(person: PersonBasicInfo): string {
  const direct = (person.alamat || '').replace(/\s+/g, ' ').trim();
  if (direct) return direct;

  const parts: string[] = [];
  const jalan = (person.alamat_jalan || '').replace(/\s+/g, ' ').trim();
  if (jalan) parts.push(jalan);

  const rt = (person.rt || '').trim();
  const rw = (person.rw || '').trim();
  if (rt || rw) {
    parts.push(`RT ${rt || '000'} / RW ${rw || '000'}`);
  }

  const desa = (person.desa_kelurahan || '').replace(/\s+/g, ' ').trim();
  if (desa) {
    parts.push(/^(desa|kelurahan|kel\.?)\s/i.test(desa) ? desa : `Desa ${desa}`);
  }

  const kec = (person.kecamatan || '').replace(/\s+/g, ' ').trim();
  if (kec) {
    parts.push(/^(kecamatan|kec\.?)\s/i.test(kec) ? kec : `Kecamatan ${kec}`);
  }

  const kab = (person.kabupaten || '').replace(/\s+/g, ' ').trim();
  if (kab) {
    parts.push(/^(kabupaten|kota|kab\.?)\s/i.test(kab) ? kab : `Kabupaten ${kab}`);
  }

  return parts.join(', ');
}

/**
 * Menggabungkan hasil scan KTP PPATS ke dalam OfficeSettings tanpa menimpa gelar/nama
 * resmi PPATS apabila sudah terisi sebelumnya.
 */
export function mergeScannedKtpIntoPpatsSettings(
  prev: OfficeSettings,
  scanned: PersonBasicInfo
): OfficeSettings {
  const cleanNik = (scanned.nik || '').replace(/[^\d]/g, '').trim() || (scanned.nik || '').trim();
  const parsedTgl = parseFlexibleDate(scanned.tanggal_lahir || '');
  const formattedTgl = parsedTgl
    ? parsedTgl.ddMmYyyy
    : (scanned.tanggal_lahir || '').trim();
  const fullAddr = buildFullAddressFromScannedPerson(scanned);

  return {
    ...prev,
    nama_ppats: prev.nama_ppats.trim() ? prev.nama_ppats : (scanned.nama || '').trim(),
    nik_ppats: cleanNik || prev.nik_ppats || '',
    tempat_lahir_ppats: (scanned.tempat_lahir || '').trim() || prev.tempat_lahir_ppats || '',
    tanggal_lahir_ppats: formattedTgl || prev.tanggal_lahir_ppats || '',
    alamat_ppats: fullAddr || prev.alamat_ppats || '',
  };
}

/**
 * Membangun objek OfficeSettings terbaru ketika pengguna mengklik "Simpan ke Profil PPATS"
 * dari form Pengecekan Sertipikat (Step 3 Wizard).
 */
export function buildPpatsSettingsPatchFromNonAkta(
  prev: OfficeSettings,
  input: {
    nama_ppats?: string;
    nip_ppats?: string;
    ppats_nik?: string;
    ppats_ttl?: string;
    ppats_alamat?: string;
  }
): OfficeSettings {
  const { tempat_lahir_ppats, tanggal_lahir_ppats } = parsePpatsTtlInput(
    input.ppats_ttl || ''
  );

  return {
    ...prev,
    nama_ppats: (input.nama_ppats || '').trim() || prev.nama_ppats,
    nip_ppats: (input.nip_ppats || '').trim() || prev.nip_ppats,
    nik_ppats: (input.ppats_nik || '').trim(),
    tempat_lahir_ppats,
    tanggal_lahir_ppats,
    alamat_ppats: (input.ppats_alamat || '').trim(),
  };
}
