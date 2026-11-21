import type { BerkasRecord } from '../types/ppats';
import { toRomanMonth } from './indonesianFormatter';
import { isAktaService, suggestNextAktaNumber } from './taxAndAudit';

function deepClone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function duplicateBerkasRecord(
  source: BerkasRecord,
  existingRecords: BerkasRecord[],
  now: Date = new Date()
): BerkasRecord {
  const todayIso = formatLocalIsoDate(now);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const roman = toRomanMonth(month);

  const suggestion = suggestNextAktaNumber(existingRecords, todayIso);
  const existingCodes = new Set(existingRecords.map((r) => (r.kode_berkas || '').trim()));
  const existingAktaNumbers = new Set(
    existingRecords.map((r) => (r.akta?.nomor_akta || '').trim()).filter(Boolean)
  );

  let nextNoUrut = suggestion.noUrut;
  let nextKodeBerkas = `REG-${year}-${String(nextNoUrut).padStart(3, '0')}`;
  while (existingCodes.has(nextKodeBerkas)) {
    nextNoUrut += 1;
    nextKodeBerkas = `REG-${year}-${String(nextNoUrut).padStart(3, '0')}`;
  }

  let nextNomorAkta = '';
  if (isAktaService(source.layanan)) {
    let seq = Number(suggestion.nomorAkta.split('/')[0]) || nextNoUrut;
    nextNomorAkta = `${String(seq).padStart(3, '0')}/PPATS/${roman}/${year}`;
    while (existingAktaNumbers.has(nextNomorAkta)) {
      seq += 1;
      nextNomorAkta = `${String(seq).padStart(3, '0')}/PPATS/${roman}/${year}`;
    }
  }

  const stamp = now.getTime();
  const rand = Math.random().toString(36).slice(2, 6);
  const newId = `reg-${stamp}-${rand}`;

  const clonedParties = deepClone(source.para_pihak || []).map((party, idx) => ({
    ...party,
    id: `p-${stamp}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
  }));

  const clonedAkta = deepClone(source.akta);
  clonedAkta.nomor_akta = nextNomorAkta;
  clonedAkta.tanggal_akta = '';
  clonedAkta.nomor_pengantar = `${String(nextNoUrut).padStart(2, '0')}/${year}`;

  const duplicated: BerkasRecord = {
    id: newId,
    no_urut: nextNoUrut,
    kode_berkas: nextKodeBerkas,
    tanggal_masuk: todayIso,
    layanan: source.layanan,
    status: '1. Pemberkasan',
    para_pihak: clonedParties,
    tanah: deepClone(source.tanah),
    pbb: deepClone(source.pbb),
    audit_warnings: deepClone(source.audit_warnings || []),
    akta: clonedAkta,
    pajak: deepClone(source.pajak),
    updated_at: now.toISOString(),
  };

  if (source.non_akta !== undefined) {
    duplicated.non_akta = deepClone(source.non_akta);
  }

  return duplicated;
}
