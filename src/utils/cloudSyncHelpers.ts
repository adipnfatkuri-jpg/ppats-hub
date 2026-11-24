export const DEFAULT_OFFICE_ID = 'kantor_utama';
export const BOOTSTRAPPED_ADMIN_EMAIL = 'adipnfatkuri@gmail.com';
export const MAX_ALLOWED_EMAILS = 30;
export const MAX_TEMPLATE_BASE64_LEN = 800_000;

/**
 * Mengubah email menjadi ID dokumen undangan yang cocok persis dengan CEL regex di firestore.rules:
 * `email.lower().replace('[^a-z0-9]', '_')`
 */
export function emailToInviteId(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 128);
}

export function sanitizeFirestoreId(raw: string, fallbackPrefix = 'doc'): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned || `${fallbackPrefix}-${Date.now()}`;
}

export function clampString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.length > maxLen ? val.slice(0, maxLen) : val;
}

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  return (email || '').trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
}

export function sanitizeAllowedEmails(emails: string[], ensureEmail?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const pushEmail = (raw?: string) => {
    const clean = (raw || '').trim().toLowerCase();
    if (!clean || !clean.includes('@') || clean.length > 200 || seen.has(clean)) return;
    if (out.length >= MAX_ALLOWED_EMAILS) return;
    seen.add(clean);
    out.push(clean);
  };
  pushEmail(BOOTSTRAPPED_ADMIN_EMAIL);
  if (ensureEmail) pushEmail(ensureEmail);
  for (const e of emails) pushEmail(e);
  return out;
}

export const MAX_CLOUD_BERKAS_BYTES = 900_000;

const CLOUD_PHOTO_TRIM_PRIORITY = [
  'foto_sket_kasar',
  'foto_patok_4',
  'foto_patok_3',
  'foto_patok_2',
  'foto_patok_1',
  'foto_poligon',
  'foto_tampak_depan',
  'foto_sket_pecah',
] as const;

export function estimateJsonUtf8Bytes(value: unknown): number {
  const json = JSON.stringify(value) ?? '';
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).length;
  }
  return json.length;
}

/**
 * Menjaga ukuran dokumen Firestore tetap di bawah batas keras 1 MiB (1.048.576 byte).
 * Foto resolusi tinggi tetap tersimpan penuh di IndexedDB lokal perangkat,
 * sedangkan salinan cloud akan memangkas `foto_sket_kasar` (sementara) terlebih dahulu
 * dan bila masih melebihi anggaran, memangkas field `foto_*` terbesar agar sinkronisasi
 * cloud tidak gagal dengan error `exceeds maximum size`.
 */
export function fitNonAktaForCloudBudget(
  basePayload: Record<string, unknown>,
  nonAkta: Record<string, unknown>,
  maxBytes = MAX_CLOUD_BERKAS_BYTES
): { nonAkta: Record<string, unknown>; trimmedFields: string[] } {
  const clone: Record<string, unknown> = { ...nonAkta };
  const trimmedFields: string[] = [];

  const totalSize = () => estimateJsonUtf8Bytes({ ...basePayload, non_akta: clone });
  if (totalSize() <= maxBytes) {
    return { nonAkta: clone, trimmedFields };
  }

  // 1. Always drop transient rough scan first (never embedded in final Word bundle)
  if (typeof clone.foto_sket_kasar === 'string' && clone.foto_sket_kasar.length > 0) {
    clone.foto_sket_kasar = '';
    trimmedFields.push('foto_sket_kasar');
    if (totalSize() <= maxBytes) {
      return { nonAkta: clone, trimmedFields };
    }
  }

  // 2. Trim remaining optional photo fields in priority order (preferring largest strings if needed)
  for (const key of CLOUD_PHOTO_TRIM_PRIORITY) {
    if (key === 'foto_sket_kasar') continue;
    const val = clone[key];
    if (typeof val === 'string' && val.length > 0) {
      clone[key] = '';
      trimmedFields.push(key);
      if (totalSize() <= maxBytes) {
        return { nonAkta: clone, trimmedFields };
      }
    }
  }

  return { nonAkta: clone, trimmedFields };
}

