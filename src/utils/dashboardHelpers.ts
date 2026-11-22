import { BerkasRecord, BerkasStatus } from '../types/ppats';
import { isAktaService } from './taxAndAudit';

export const VALID_BERKAS_STATUSES: readonly BerkasStatus[] = [
  '1. Pemberkasan',
  '2. Validasi',
  '3. Ukur Ulang',
  '4. Analisis Bidang',
  '5. Pecah',
  '6. Validasi Pajak',
  '7. Pengecekan',
  '8. Proses BPN',
  '9. Pelaporan',
  '10. Penerbitan',
  '11. Selesai',
] as const;

const VALID_STATUS_SET = new Set<string>(VALID_BERKAS_STATUSES);

/**
 * Menormalkan status berkas dari penyimpanan lokal / cloud / backup lama (5 tahap)
 * ke skema tracking lengkap 11 tahap.
 */
export function normalizeBerkasStatus(raw: string | undefined | null): BerkasStatus {
  const trimmed = (raw ?? '').trim();
  if (VALID_STATUS_SET.has(trimmed)) {
    return trimmed as BerkasStatus;
  }
  switch (trimmed) {
    case '2. Validasi Pajak':
      return '6. Validasi Pajak';
    case '3. TTD Akta':
      return '8. Proses BPN';
    case '4. Proses BPN':
      return '8. Proses BPN';
    case '5. Selesai':
      return '11. Selesai';
    default:
      return '1. Pemberkasan';
  }
}

export function isTerminalStatus(status: string | undefined | null): boolean {
  const s = (status ?? '').trim();
  return s === '11. Selesai' || s === '5. Selesai';
}

export function isAktaTerbitStatus(status: BerkasStatus): boolean {
  return (
    status === '8. Proses BPN' ||
    status === '9. Pelaporan' ||
    status === '10. Penerbitan' ||
    status === '11. Selesai'
  );
}

export interface DashboardPartySummary {
  pihakPertamaLabel: string;
  pihakPertamaText: string;
  pihakPenerimaLabel: string;
  pihakPenerimaText: string;
  avatarName: string;
  searchText: string;
}

/**
 * Mengekstrak ringkasan Pihak I / Pemohon dan Pihak Penerima secara jelas
 * untuk ditampilkan pada tabel Dashboard & Tracking Berkas.
 */
export function extractDashboardParties(record: BerkasRecord): DashboardPartySummary {
  const pihakList = (record.para_pihak || []).filter((p) => p.peran.startsWith('Pihak '));
  const p1Names = pihakList
    .filter((p) => p.peran === 'Pihak I')
    .map((p) => p.nama.trim())
    .filter(Boolean);
  const p2Names = pihakList
    .filter((p) => p.peran === 'Pihak II')
    .map((p) => p.nama.trim())
    .filter(Boolean);
  const pOtherRecipients = pihakList
    .filter((p) => p.peran !== 'Pihak I')
    .map((p) => p.nama.trim())
    .filter(Boolean);
  const allPihakNames = pihakList.map((p) => p.nama.trim()).filter(Boolean);

  let pihakPertamaLabel = 'Pihak I';
  let pihakPertamaText = p1Names.join(', ') || '-';
  let pihakPenerimaLabel = 'Pihak Penerima';
  let pihakPenerimaText = p2Names.join(', ') || '-';

  if (record.layanan === 'AJB') {
    pihakPertamaLabel = 'Penjual (Pihak I)';
    pihakPertamaText = p1Names.join(', ') || '-';
    pihakPenerimaLabel = 'Pembeli (Pihak II)';
    pihakPenerimaText = p2Names.join(', ') || '-';
  } else if (record.layanan === 'Akta Hibah') {
    pihakPertamaLabel = 'Pemberi Hibah (I)';
    pihakPertamaText = p1Names.join(', ') || '-';
    pihakPenerimaLabel = 'Penerima Hibah (II)';
    pihakPenerimaText = p2Names.join(', ') || '-';
  } else if (record.layanan === 'APHB') {
    const designatedRole = record.akta?.pihak_penerima_aphb?.trim();
    if (designatedRole) {
      const designatedNames = pihakList
        .filter((p) => p.peran === designatedRole)
        .map((p) => p.nama.trim())
        .filter(Boolean);
      const otherNames = pihakList
        .filter((p) => p.peran !== designatedRole)
        .map((p) => p.nama.trim())
        .filter(Boolean);
      pihakPertamaLabel = otherNames.length > 1 ? 'Para Pihak' : 'Pihak I';
      pihakPertamaText = otherNames.join(', ') || p1Names.join(', ') || '-';
      pihakPenerimaLabel = `Penerima (${designatedRole})`;
      pihakPenerimaText = designatedNames.join(', ') || '-';
    } else {
      pihakPertamaLabel = 'Pihak I';
      pihakPertamaText = p1Names.join(', ') || '-';
      pihakPenerimaLabel =
        pOtherRecipients.length > p2Names.length ? 'Penerima (II+)' : 'Penerima (Pihak II)';
      pihakPenerimaText = pOtherRecipients.join(', ') || '-';
    }
  } else if (record.layanan === 'Turun Waris' || record.layanan === 'Waris C') {
    const pewaris = record.non_akta?.nama_pewaris?.trim();
    if (pewaris) {
      pihakPertamaLabel = 'Pewaris';
      pihakPertamaText = pewaris;
      pihakPenerimaLabel = 'Ahli Waris';
      pihakPenerimaText = allPihakNames.join(', ') || '-';
    } else {
      pihakPertamaLabel = 'Pemohon';
      pihakPertamaText = p1Names.join(', ') || allPihakNames.join(', ') || '-';
      if (pOtherRecipients.length > 0) {
        pihakPenerimaLabel = 'Ahli Waris / Penerima';
        pihakPenerimaText = pOtherRecipients.join(', ');
      } else if (record.akta?.nama_kuasa_bpn?.trim()) {
        pihakPenerimaLabel = 'Penerima Kuasa';
        pihakPenerimaText = record.akta.nama_kuasa_bpn.trim();
      } else {
        pihakPenerimaLabel = 'Pihak Penerima';
        pihakPenerimaText = '-';
      }
    }
  } else if (!isAktaService(record.layanan)) {
    pihakPertamaLabel = 'Pemohon';
    pihakPertamaText =
      pOtherRecipients.length > 0
        ? p1Names.join(', ') || '-'
        : allPihakNames.join(', ') || '-';

    if (pOtherRecipients.length > 0) {
      pihakPenerimaLabel = 'Pihak Penerima';
      pihakPenerimaText = pOtherRecipients.join(', ');
    } else if (
      record.layanan === 'Pengecekan Sertipikat' &&
      (record.non_akta?.pengecekan_kuasa_mode ?? 'ppats') === 'ppats'
    ) {
      pihakPenerimaLabel = 'Penerima Kuasa (PPATS)';
      pihakPenerimaText = record.akta?.nama_ppats?.trim() || 'PPATS / Camat';
    } else if (record.akta?.nama_kuasa_bpn?.trim()) {
      pihakPenerimaLabel = 'Penerima Kuasa';
      pihakPenerimaText = record.akta.nama_kuasa_bpn.trim();
    } else {
      pihakPenerimaLabel = 'Pihak Penerima';
      pihakPenerimaText = '-';
    }
  }

  const avatarName =
    pihakPertamaText !== '-'
      ? pihakPertamaText
      : pihakPenerimaText !== '-'
      ? pihakPenerimaText
      : record.kode_berkas;

  const searchText = [
    pihakPertamaText,
    pihakPenerimaText,
    record.akta?.nama_kuasa_bpn || '',
    record.non_akta?.nama_pewaris || '',
  ]
    .join(' ')
    .toLowerCase();

  return {
    pihakPertamaLabel,
    pihakPertamaText,
    pihakPenerimaLabel,
    pihakPenerimaText,
    avatarName,
    searchText,
  };
}
