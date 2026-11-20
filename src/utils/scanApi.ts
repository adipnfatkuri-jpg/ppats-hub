export interface ScanApiErrorResult {
  message: string;
  status: number;
}

/**
 * Mengurai respons teks dari endpoint /api/extract-* secara aman agar tidak pernah
 * gagal dengan error mentah seperti `Unexpected token 'T', "The page c"... is not valid JSON`
 * saat server mengembalikan HTML/teks (404, 413, 502, 504).
 */
export function parseScanResponseText<T>(
  rawText: string,
  status: number,
  ok: boolean,
  endpointLabel: string
): T {
  const trimmed = (rawText || '').trim();
  let parsed: Record<string, unknown> | null = null;
  if (trimmed) {
    try {
      const candidate = JSON.parse(trimmed);
      if (candidate && typeof candidate === 'object') {
        parsed = candidate as Record<string, unknown>;
      }
    } catch {
      parsed = null;
    }
  }

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

  if (status === 504 || status === 502 || /FUNCTION_INVOCATION_TIMEOUT|Gateway Timeout/i.test(trimmed)) {
    throw new Error(
      'Server pemindaian membutuhkan waktu terlalu lama (timeout). Gunakan Mode Cepat atau unggah 1–2 dokumen terlebih dahulu.'
    );
  }

  if (!ok) {
    throw new Error(
      `Gagal memproses pemindaian dokumen (HTTP ${status || 'error'}). Periksa koneksi internet perangkat Anda dan coba lagi.`
    );
  }

  throw new Error(
    `Respons server pemindaian (${endpointLabel}) tidak dalam format JSON yang valid. Coba muat ulang halaman lalu ulangi pemindaian.`
  );
}

/**
 * Mengirim permintaan POST JSON ke endpoint scan dengan penanganan error lintas perangkat
 * (termasuk jaringan seluler terputus, 404 deployment statis, 413 payload besar, dan timeout).
 */
export async function postScanJson<T>(
  endpoint: string,
  payload: unknown,
  options?: { signal?: AbortSignal }
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: options?.signal,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    throw new Error(
      'Tidak dapat terhubung ke server pemindaian. Periksa koneksi internet perangkat Anda (Wi-Fi/seluler) lalu coba lagi.'
    );
  }

  const rawText = await res.text().catch(() => '');
  return parseScanResponseText<T>(rawText, res.status, res.ok, endpoint);
}
