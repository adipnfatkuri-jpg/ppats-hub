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
