import { ParameterAkta } from '../types/ppats';

export interface AphbTaxFraction {
  n: number;
  m: number;
  numerator: number;
  faktor: number;
  aktif: boolean;
}

/**
 * Menghitung faktor perolehan hak baru pada APHB (Pembagian Hak Bersama):
 *   faktor = (n - m) / n
 * - n: jumlah pemegang hak bersama saat ini (misal 5 orang; minimal 2 untuk APHB)
 * - m: jumlah calon penerima hak baru (1 jika dialihkan ke 1 nama, 2 jika ke 2 nama, dst.)
 * Contoh: n = 5, m = 1, luas = 200 m² -> (5 - 1) / 5 × 200 = 160 m² kena pajak.
 *         n = 5, m = 2, luas = 200 m² -> (5 - 2) / 5 × 200 = 120 m² kena pajak.
 */
export function computeAphbTaxFraction(
  rawN?: number | null,
  rawM?: number | null
): AphbTaxFraction {
  const nVal = Math.floor(Number(rawN) || 0);
  if (nVal < 2) {
    return {
      n: Math.max(0, nVal),
      m: Math.max(0, Math.floor(Number(rawM) || 0)),
      numerator: 0,
      faktor: 1,
      aktif: false,
    };
  }

  const mRaw = Math.floor(Number(rawM) || 1);
  const m = Math.min(nVal, Math.max(1, mRaw));
  const numerator = Math.max(0, nVal - m);
  return {
    n: nVal,
    m,
    numerator,
    faktor: numerator / nVal,
    aktif: true,
  };
}

/**
 * Mengambil daftar peran calon penerima hak APHB yang valid & terurut (bisa 1 atau lebih orang),
 * dengan dukungan mundur penuh terhadap field lama `pihak_penerima_aphb` (penerima tunggal).
 */
export function normalizeAphbRecipientRoles(
  paraPihak: ReadonlyArray<{ peran: string }>,
  akta?: Pick<ParameterAkta, 'pihak_penerima_aphb' | 'pihak_penerima_aphb_list'>
): string[] {
  const validPihakRoles = Array.from(
    new Set(
      paraPihak
        .filter((p) => p.peran.startsWith('Pihak '))
        .map((p) => p.peran.trim())
        .filter(Boolean)
    )
  );

  const rawList = Array.isArray(akta?.pihak_penerima_aphb_list)
    ? akta.pihak_penerima_aphb_list.map((r) => String(r || '').trim()).filter(Boolean)
    : [];

  const dedupedRaw = Array.from(new Set(rawList));
  if (dedupedRaw.length > 0) {
    if (validPihakRoles.length === 0) return dedupedRaw;
    const matched = dedupedRaw.filter((role) => validPihakRoles.includes(role));
    if (matched.length > 0) return matched;
  }

  const singleRole = (akta?.pihak_penerima_aphb || '').trim();
  if (singleRole) {
    if (validPihakRoles.length === 0 || validPihakRoles.includes(singleRole)) {
      return [singleRole];
    }
  }

  if (validPihakRoles.includes('Pihak II')) return ['Pihak II'];
  if (validPihakRoles.length > 0) return [validPihakRoles[validPihakRoles.length - 1]];
  return ['Pihak II'];
}

export function getDefaultAphbHolderCount(
  paraPihak: ReadonlyArray<{ peran: string }>,
  akta?: Pick<ParameterAkta, 'aphb_jumlah_pemegang_hak'>
): number {
  const explicit = Math.floor(Number(akta?.aphb_jumlah_pemegang_hak) || 0);
  if (explicit >= 2) return explicit;
  const partyCount = paraPihak.filter((p) => p.peran.startsWith('Pihak ')).length;
  return Math.max(2, partyCount);
}

export function getDefaultAphbRecipientCount(
  paraPihak: ReadonlyArray<{ peran: string }>,
  akta?: Pick<
    ParameterAkta,
    'pihak_penerima_aphb' | 'pihak_penerima_aphb_list' | 'aphb_jumlah_penerima'
  >
): number {
  const explicit = Math.floor(Number(akta?.aphb_jumlah_penerima) || 0);
  if (explicit >= 1) return explicit;
  const roles = normalizeAphbRecipientRoles(paraPihak, akta);
  return Math.max(1, roles.length);
}

export interface AphbResolvedRecipientItem<T extends { peran: string; nama: string }> {
  party: T;
  peran_lower: string;
  peran_title: string;
}

export interface AphbResolvedSummary<T extends { peran: string; nama: string }> {
  recipientRoles: string[];
  recipients: T[];
  givers: T[];
  totalHolders: number;
  recipientCount: number;
  isMultiRecipient: boolean;
  penerimaLabel: string;
  penerimaNamaUpper: string;
  penerimaKlausul: string;
  penerimaStatusHak: 'pemegang tunggal' | 'pemegang hak bersama';
}

function joinIndonesianList(items: string[]): string {
  if (items.length === 0) return '-';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} dan ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} dan ${items[items.length - 1]}`;
}

/**
 * Menyusun data penerima & pemberi hak APHB (mendukung 1 penerima tunggal maupun 2+ penerima hak bersama)
 * untuk naskah Akta APHB, Lampiran Bundel BPN, dan tabel Dashboard.
 */
export function resolveAphbRecipients<T extends { peran: string; nama: string }>(
  orderedParties: ReadonlyArray<T>,
  akta:
    | Pick<
        ParameterAkta,
        'pihak_penerima_aphb' | 'pihak_penerima_aphb_list' | 'aphb_jumlah_pemegang_hak'
      >
    | undefined,
  getRoleMeta: (peran: string) => { peran_lower: string; peran_title: string }
): AphbResolvedSummary<T> {
  const recipientRoles = normalizeAphbRecipientRoles(orderedParties, akta);
  const roleSet = new Set(recipientRoles);

  let recipients = orderedParties.filter((p) => roleSet.has(p.peran));
  if (recipients.length === 0 && orderedParties.length > 0) {
    recipients = [orderedParties[orderedParties.length - 1]];
  }

  const recipientRoleSetActual = new Set(recipients.map((r) => r.peran));
  const givers = orderedParties.filter((p) => !recipientRoleSetActual.has(p.peran));

  const isMultiRecipient = recipients.length > 1;
  const klausulParts = recipients.map((r) => {
    const meta = getRoleMeta(r.peran);
    const namaUpper = (r.nama || '-').trim().toUpperCase() || '-';
    return `${meta.peran_lower} atas nama ${namaUpper}`;
  });

  const labelParts = recipients.map((r) => getRoleMeta(r.peran).peran_lower);
  const nameUpperParts = recipients.map((r) => (r.nama || '-').trim().toUpperCase() || '-');

  const totalHolders = Math.max(
    orderedParties.length,
    Math.floor(Number(akta?.aphb_jumlah_pemegang_hak) || 0)
  );

  return {
    recipientRoles: Array.from(recipientRoleSetActual),
    recipients,
    givers,
    totalHolders,
    recipientCount: Math.max(1, recipients.length),
    isMultiRecipient,
    penerimaLabel: joinIndonesianList(labelParts),
    penerimaNamaUpper: joinIndonesianList(nameUpperParts),
    penerimaKlausul: joinIndonesianList(klausulParts),
    penerimaStatusHak: isMultiRecipient ? 'pemegang hak bersama' : 'pemegang tunggal',
  };
}
