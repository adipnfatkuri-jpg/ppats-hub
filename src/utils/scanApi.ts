export interface ScanApiErrorResult {
  message: string;
  status: number;
}

export interface ScanResponseMeta {
  contentType?: string;
  redirected?: boolean;
  responseUrl?: string;
}

function looksLikeHtmlDocument(raw: string, contentType?: string): boolean {
  if (contentType && /text\/html|application\/xhtml/i.test(contentType)) {
    return true;
  }
  return /^\s*(?:<!doctype\s+html\b|<html\b|<head\b|<body\b|<script\b)/i.test(raw);
}

function looksLikeAuthRedirect(raw: string, meta?: ScanResponseMeta): boolean {
  if (meta?.redirected) {
    return true;
  }
  if (
    meta?.responseUrl &&
    /__cookie_check\.html|accounts\.google\.com|ServiceLogin|signin|\/login\b|oauth/i.test(
      meta.responseUrl
    )
  ) {
    return true;
  }
  return /__cookie_check\.html|aistudio_auth_flow_may_set_cookies|<title>\s*Cookie check\s*<\/title>|Action required to load your app|accounts\.google\.com|ServiceLogin|Sign in\s*-\s*Google|Google Accounts|Identity-Aware Proxy|__Host-GAPS/i.test(
    raw
  );
}

function looksLikeSpaIndexHtml(raw: string): boolean {
  return (
    /<div\s+id=["']root["']/i.test(raw) ||
    /SIM-PPATS/i.test(raw) ||
    /<script[^>]+src=["'][^"']*\/assets\/index-[^"']+\.js["']/i.test(raw) ||
    /<script[^>]+src=["']\/src\/main\.tsx["']/i.test(raw)
  );
}

function tryParseJsonObject(trimmed: string): Record<string, unknown> | null {
  if (!trimmed) return null;
  try {
    const candidate = JSON.parse(trimmed);
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Mengurai respons teks dari endpoint /api/extract-* secara aman agar tidak pernah
 * gagal dengan error mentah seperti `Unexpected token 'T', "The page c"... is not valid JSON`
 * saat server mengembalikan HTML/teks (404, 413, 502, 504, cookie-check/redirect login, atau fallback SPA).
 */
export function parseScanResponseText<T>(
  rawText: string,
  status: number,
  ok: boolean,
  endpointLabel: string,
  meta?: ScanResponseMeta
): T {
  const trimmed = (rawText || '').trim();
  const parsed = tryParseJsonObject(trimmed);

  if (ok && parsed) {
    return parsed as T;
  }

  const serverError =
    parsed && typeof parsed.error === 'string' && parsed.error.trim()
      ? parsed.error.trim()
      : '';

  if (serverError) {
    throw new Error(serverError);
  }

  if (status === 404 || /The page could not be found|NOT_FOUND/i.test(trimmed)) {
    throw new Error(
      `Layanan API pemindaian (${endpointLabel}) tidak aktif di server/deployment ini (404). Pastikan aplikasi di-deploy ulang bersama folder /api dan variabel GEMINI_API_KEY sudah diatur.`
    );
  }

  if (
    status === 413 ||
    /Request Entity Too Large|FUNCTION_PAYLOAD_TOO_LARGE|body exceeded/i.test(trimmed)
  ) {
    throw new Error(
      'Ukuran total foto/dokumen terlalu besar untuk dikirim sekaligus (413). Unggah 1–2 dokumen per pemindaian atau perkecil ukuran file PDF.'
    );
  }

  if (
    status === 504 ||
    status === 502 ||
    /FUNCTION_INVOCATION_TIMEOUT|Gateway Timeout/i.test(trimmed)
  ) {
    throw new Error(
      'Server pemindaian membutuhkan waktu terlalu lama (timeout). Gunakan Mode Cepat atau unggah 1–2 dokumen terlebih dahulu.'
    );
  }

  const isHtml = looksLikeHtmlDocument(trimmed, meta?.contentType);
  if (isHtml || meta?.redirected) {
    if (looksLikeAuthRedirect(trimmed, meta)) {
      throw new Error(
        'Sesi cookie keamanan browser untuk server pemindaian telah kedaluwarsa atau perlu diperbarui. Klik "Muat Ulang Halaman" (atau buka aplikasi di tab baru dengan cookie aktif), lalu ulangi pemindaian.'
      );
    }
    if (looksLikeSpaIndexHtml(trimmed)) {
      throw new Error(
        `Server pemindaian (${endpointLabel}) mengembalikan halaman HTML aplikasi alih-alih JSON. Muat ulang halaman atau pastikan layanan backend /api berjalan aktif (bukan mode hosting statis).`
      );
    }
    throw new Error(
      `Server pemindaian (${endpointLabel}) mengembalikan halaman HTML bukan JSON (HTTP ${status || 'error'}). Muat ulang halaman lalu ulangi pemindaian.`
    );
  }

  if (!ok) {
    throw new Error(
      `Gagal memproses pemindaian dokumen (HTTP ${status || 'error'}). Periksa koneksi internet perangkat Anda dan coba lagi.`
    );
  }

  if (!trimmed || trimmed === 'null') {
    throw new Error(
      'Server pemindaian mengembalikan respons kosong dari AI. Silakan coba pindai ulang dokumen atau gunakan Mode Cepat.'
    );
  }

  throw new Error(
    `Respons server pemindaian (${endpointLabel}) tidak dalam format JSON yang valid. Coba muat ulang halaman lalu ulangi pemindaian.`
  );
}

function isTransientEmptyOkResponse(
  rawText: string,
  status: number,
  ok: boolean,
  meta: ScanResponseMeta
): boolean {
  if (!ok) return false;
  if (meta.redirected) return false;
  const trimmed = (rawText || '').trim();
  if (looksLikeHtmlDocument(trimmed, meta.contentType)) return false;
  return tryParseJsonObject(trimmed) === null;
}

async function tryClearStaleServiceWorkers(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length === 0) return false;
    await Promise.all(regs.map((r) => r.unregister()));
    return true;
  } catch {
    return false;
  }
}

function delayWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

const SCAN_CACHE_TTL_MS = 10 * 60 * 1000;
const SCAN_CACHE_MAX_ENTRIES = 16;

interface ScanCacheEntry {
  expiresAt: number;
  data: unknown;
}

const scanResponseCache = new Map<string, ScanCacheEntry>();

function fastHashPayload(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ((ch + i) & 0xff), 0x01000193);
  }
  return `${input.length.toString(36)}-${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}`;
}

function cloneCachedValue<T>(value: T): T {
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : (JSON.parse(JSON.stringify(value)) as T);
  } catch {
    return value;
  }
}

export function clearScanCache(): void {
  scanResponseCache.clear();
}

function readScanCache<T>(key: string): T | null {
  const entry = scanResponseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    scanResponseCache.delete(key);
    return null;
  }
  // Refresh LRU order
  scanResponseCache.delete(key);
  scanResponseCache.set(key, entry);
  return cloneCachedValue(entry.data as T);
}

function writeScanCache(key: string, data: unknown): void {
  if (scanResponseCache.size >= SCAN_CACHE_MAX_ENTRIES) {
    const oldestKey = scanResponseCache.keys().next().value;
    if (oldestKey !== undefined) {
      scanResponseCache.delete(oldestKey);
    }
  }
  scanResponseCache.set(key, {
    expiresAt: Date.now() + SCAN_CACHE_TTL_MS,
    data: cloneCachedValue(data),
  });
}

/**
 * Mengirim permintaan POST JSON ke endpoint scan dengan penanganan error lintas perangkat
 * (termasuk cookie terpartisi pada pratinjau iframe/PWA, jaringan seluler terputus, 404 deployment statis,
 * 413 payload besar, timeout, cache hasil scan identik, dan retry otomatis 1x bila respons HTTP 200 kosong/terpotong).
 */
export async function postScanJson<T>(
  endpoint: string,
  payload: unknown,
  options?: { signal?: AbortSignal; maxTransientRetries?: number; bypassCache?: boolean }
): Promise<T> {
  const maxRetries = options?.maxTransientRetries ?? 1;
  const serializedBody = JSON.stringify(payload);
  const cacheKey = `${endpoint}::${fastHashPayload(serializedBody)}`;

  if (!options?.bypassCache) {
    const cached = readScanCache<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        signal: options?.signal,
        body: serializedBody,
      });
    } catch (err) {
      const isAbort =
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError');
      if (isAbort) {
        throw err;
      }
      throw new Error(
        'Tidak dapat terhubung ke server pemindaian. Periksa koneksi internet perangkat Anda (Wi-Fi/seluler) lalu coba lagi.'
      );
    }

    const rawText = await res.text().catch(() => '');
    const meta: ScanResponseMeta = {
      contentType: res.headers.get('content-type') || undefined,
      redirected: Boolean(res.redirected),
      responseUrl: res.url || undefined,
    };

    const isHtml = looksLikeHtmlDocument((rawText || '').trim(), meta.contentType);
    if (attempt < maxRetries && isHtml) {
      const clearedSw = await tryClearStaleServiceWorkers();
      if (clearedSw) {
        await delayWithSignal(250, options?.signal);
        continue;
      }
    }

    if (
      attempt < maxRetries &&
      isTransientEmptyOkResponse(rawText, res.status, res.ok, meta)
    ) {
      await delayWithSignal(350, options?.signal);
      continue;
    }

    const parsed = parseScanResponseText<T>(rawText, res.status, res.ok, endpoint, meta);
    writeScanCache(cacheKey, parsed);
    return parsed;
  }

  throw new Error(
    `Respons server pemindaian (${endpoint}) tidak dalam format JSON yang valid. Coba muat ulang halaman lalu ulangi pemindaian.`
  );
}
