import type { ServiceType } from '../types/ppats';

export type AppNavSection =
  | 'dashboard'
  | 'wizard'
  | 'tax'
  | 'register'
  | 'report'
  | 'non_akta_rekap'
  | 'settings';

export const VALID_NAV_SECTIONS: readonly AppNavSection[] = [
  'dashboard',
  'wizard',
  'tax',
  'register',
  'report',
  'non_akta_rekap',
  'settings',
] as const;

export const ACTIVE_SECTION_STORAGE_KEY = 'sim_ppats_active_section';
export const WIZARD_SESSION_STORAGE_KEY = 'sim_ppats_wizard_session_v1';

export interface WizardSessionDraft {
  layanan: ServiceType;
  step: 1 | 2 | 3 | 4;
}

export function isValidNavSection(value: unknown): value is AppNavSection {
  return (
    typeof value === 'string' &&
    (VALID_NAV_SECTIONS as readonly string[]).includes(value)
  );
}

/**
 * Menentukan halaman aktif awal dari parameter URL (?section=...) atau sessionStorage.
 * Mencegah pengguna terlempar kembali ke Dashboard apabila browser HP/PWA memuat ulang tab
 * saat membuka File Picker atau Kamera di dalam halaman Buat Berkas Baru.
 */
export function resolveInitialNavSection(
  search: string,
  savedSessionSection?: string | null
): AppNavSection {
  try {
    const requested = new URLSearchParams(search || '').get('section');
    if (isValidNavSection(requested)) {
      return requested;
    }
  } catch {
    // Abaikan jika URLSearchParams gagal
  }

  if (isValidNavSection(savedSessionSection)) {
    return savedSessionSection;
  }

  return 'dashboard';
}

/**
 * Membangun path URL bersih dengan menyinkronkan ?section=... untuk halaman selain dashboard.
 */
export function buildUrlForNavSection(currentHref: string, section: AppNavSection): string | null {
  try {
    const url = new URL(currentHref);
    if (section === 'dashboard') {
      url.searchParams.delete('section');
    } else {
      url.searchParams.set('section', section);
    }
    const qs = url.searchParams.toString();
    return `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;
  } catch {
    return null;
  }
}

export function persistNavSection(section: AppNavSection): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ACTIVE_SECTION_STORAGE_KEY, section);
  } catch {
    // Abaikan jika sessionStorage dibatasi browser
  }
  try {
    const nextPath = buildUrlForNavSection(window.location.href, section);
    if (nextPath) {
      window.history.replaceState(window.history.state, '', nextPath);
    }
  } catch {
    // Abaikan jika history API dibatasi (mis. sandbox iframe)
  }
}

export function loadSavedNavSection(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(ACTIVE_SECTION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveWizardSessionDraft(draft: WizardSessionDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(WIZARD_SESSION_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Abaikan jika sessionStorage dibatasi
  }
}

export function loadWizardSessionDraft(): WizardSessionDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(WIZARD_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WizardSessionDraft>;
    const validStep =
      parsed.step === 1 || parsed.step === 2 || parsed.step === 3 || parsed.step === 4
        ? parsed.step
        : 1;
    if (typeof parsed.layanan === 'string' && parsed.layanan.trim()) {
      return {
        layanan: parsed.layanan as ServiceType,
        step: validStep,
      };
    }
  } catch {
    // Abaikan JSON rusak
  }
  return null;
}

export function clearWizardSessionDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(WIZARD_SESSION_STORAGE_KEY);
  } catch {
    // Abaikan
  }
}
