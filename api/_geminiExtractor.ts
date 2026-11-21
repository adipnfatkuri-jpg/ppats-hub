import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
} from '@google/genai';

export interface UploadedDocPayload {
  name: string;
  mimeType: string;
  dataBase64: string;
}

export interface ExtractDocumentsRequestBody {
  layanan?: string;
  scanMode?: 'fast' | 'accurate';
  scope?: 'full' | 'object_only';
  files?: UploadedDocPayload[];
}

export interface ExtractPersonRequestBody {
  role?: string;
  files?: UploadedDocPayload[];
}

export interface ApiHttpError {
  status: number;
  error: string;
}

const tanahSchemaProperties = {
  jenis_sertipikat: {
    type: Type.STRING,
    description: '"digital" (NIBel) atau "analog" (No SHM + Surat Ukur).',
  },
  jenis_hak: { type: Type.STRING, description: 'Hak Milik / HGB / Hak Pakai.' },
  nib: { type: Type.STRING, description: 'NIB atau NIBel.' },
  nomor_hak_lama: { type: Type.STRING, description: 'No SHM/Hak (analog), kosongkan jika digital.' },
  surat_ukur_tanggal: { type: Type.STRING, description: 'Tanggal SU (analog).' },
  surat_ukur_nomor: { type: Type.STRING, description: 'Nomor SU (analog).' },
  luas_m2: { type: Type.NUMBER, description: 'Luas bidang tanah (m2).' },
  desa: { type: Type.STRING },
  kecamatan: { type: Type.STRING },
  kabupaten: { type: Type.STRING },
  provinsi: { type: Type.STRING },
  batas_utara: { type: Type.STRING },
  batas_timur: { type: Type.STRING },
  batas_selatan: { type: Type.STRING },
  batas_barat: { type: Type.STRING },
  dasar_perolehan: { type: Type.STRING },
  pemegang_hak_sertipikat: { type: Type.ARRAY, items: { type: Type.STRING } },
};

const pbbSchemaProperties = {
  nop: { type: Type.STRING, description: 'NOP 18 digit.' },
  tahun_pajak: { type: Type.STRING },
  letak_objek_lokasi: {
    type: Type.STRING,
    description:
      'Dukuh/dusun/jalan baris 1 kolom kiri LETAK OBJEK PAJAK (mis. GORONGAN), tanpa RT/RW, BUKAN kolom kanan WP.',
  },
  letak_objek_rt_rw: {
    type: Type.STRING,
    description: 'RT/RW kolom kiri LETAK OBJEK PAJAK format "002/003", BUKAN RT/RW kolom kanan WP.',
  },
  letak_objek_desa: { type: Type.STRING, description: 'Desa kolom kiri LETAK OBJEK PAJAK.' },
  letak_objek_kecamatan: { type: Type.STRING, description: 'Kecamatan kolom kiri LETAK OBJEK PAJAK.' },
  letak_objek_kabupaten: { type: Type.STRING, description: 'Kabupaten kolom kiri LETAK OBJEK PAJAK.' },
  luas_bumi_m2: {
    type: Type.NUMBER,
    description: 'Luas BUMI m2 (gabungkan jika angka terpotong 2 baris, cocokkan dgn njop_bumi_total/njop_bumi_m2).',
  },
  luas_bangunan_m2: { type: Type.NUMBER, description: 'Luas BANGUNAN m2 (0 bila kosong).' },
  njop_bumi_m2: { type: Type.NUMBER, description: 'NJOP Bumi per m2 (Rp).' },
  njop_bumi_total: { type: Type.NUMBER, description: 'TOTAL NJOP Bumi (Rp).' },
  njop_bangunan: { type: Type.NUMBER, description: 'Total NJOP Bangunan (Rp).' },
  nama_wp_pbb: { type: Type.STRING, description: 'Nama Wajib Pajak kolom kanan SPPT.' },
};

export const objectExtractionResponseSchema = {
  type: Type.OBJECT,
  properties: {
    tanah: {
      type: Type.OBJECT,
      properties: tanahSchemaProperties,
      required: ['jenis_hak', 'nib', 'nomor_hak_lama', 'luas_m2', 'desa', 'kecamatan', 'kabupaten'],
    },
    pbb: {
      type: Type.OBJECT,
      properties: pbbSchemaProperties,
      required: [
        'nop',
        'tahun_pajak',
        'letak_objek_lokasi',
        'letak_objek_rt_rw',
        'letak_objek_desa',
        'letak_objek_kecamatan',
        'letak_objek_kabupaten',
        'luas_bumi_m2',
        'luas_bangunan_m2',
        'njop_bumi_m2',
        'njop_bumi_total',
        'njop_bangunan',
        'nama_wp_pbb',
      ],
    },
  },
  required: ['tanah', 'pbb'],
};

export const extractionResponseSchema = {
  type: Type.OBJECT,
  properties: {
    para_pihak: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          peran_saran: {
            type: Type.STRING,
            description: '"Pihak I" | "Pihak II" | "Persetujuan Pasangan" | "Lampiran Lain".',
          },
          nik: { type: Type.STRING },
          nama: { type: Type.STRING },
          tempat_lahir: { type: Type.STRING },
          tanggal_lahir: { type: Type.STRING, description: 'DD-MM-YYYY.' },
          jenis_kelamin: { type: Type.STRING, description: 'Laki-laki atau Perempuan.' },
          alamat_jalan: { type: Type.STRING },
          rt_rw: { type: Type.STRING, description: 'Format 001/002.' },
          desa_kelurahan: { type: Type.STRING },
          kecamatan: { type: Type.STRING },
          kabupaten: { type: Type.STRING },
          pekerjaan: { type: Type.STRING },
          status_perkawinan: { type: Type.STRING },
        },
        required: [
          'peran_saran',
          'nik',
          'nama',
          'tempat_lahir',
          'tanggal_lahir',
          'jenis_kelamin',
          'alamat_jalan',
          'rt_rw',
          'desa_kelurahan',
          'kecamatan',
          'kabupaten',
          'pekerjaan',
          'status_perkawinan',
        ],
      },
    },
    tanah: {
      type: Type.OBJECT,
      properties: tanahSchemaProperties,
      required: [
        'jenis_hak',
        'nib',
        'nomor_hak_lama',
        'luas_m2',
        'desa',
        'kecamatan',
        'kabupaten',
        'dasar_perolehan',
        'pemegang_hak_sertipikat',
      ],
    },
    pbb: {
      type: Type.OBJECT,
      properties: pbbSchemaProperties,
      required: [
        'nop',
        'tahun_pajak',
        'letak_objek_lokasi',
        'letak_objek_rt_rw',
        'letak_objek_desa',
        'letak_objek_kecamatan',
        'letak_objek_kabupaten',
        'luas_bumi_m2',
        'luas_bangunan_m2',
        'njop_bumi_m2',
        'njop_bumi_total',
        'njop_bangunan',
        'nama_wp_pbb',
      ],
    },
    audit_warnings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tingkat: { type: Type.STRING, description: '"tinggi" | "sedang" | "info".' },
          judul: { type: Type.STRING },
          deskripsi: { type: Type.STRING },
        },
        required: ['tingkat', 'judul', 'deskripsi'],
      },
    },
  },
  required: ['para_pihak', 'tanah', 'pbb', 'audit_warnings'],
};

export const personExtractionResponseSchema = {
  type: Type.OBJECT,
  properties: {
    nama: { type: Type.STRING },
    nik: { type: Type.STRING, description: '16 digit angka.' },
    pekerjaan: { type: Type.STRING },
    tempat_lahir: { type: Type.STRING },
    tanggal_lahir: { type: Type.STRING, description: 'DD-MM-YYYY.' },
    alamat_jalan: { type: Type.STRING, description: 'Dukuh/jalan tanpa RT/RW.' },
    rt: { type: Type.STRING, description: 'Nomor RT saja.' },
    rw: { type: Type.STRING, description: 'Nomor RW saja.' },
    desa_kelurahan: { type: Type.STRING },
    kecamatan: { type: Type.STRING },
    kabupaten: { type: Type.STRING, description: 'Kabupaten/Kota dari header KTP.' },
    jenis_kelamin: { type: Type.STRING, description: 'Laki-laki atau Perempuan.' },
    status_perkawinan: {
      type: Type.STRING,
      description: 'KAWIN, BELUM KAWIN, CERAI HIDUP, atau CERAI MATI.',
    },
  },
  required: [
    'nama',
    'nik',
    'pekerjaan',
    'tempat_lahir',
    'tanggal_lahir',
    'alamat_jalan',
    'rt',
    'rw',
    'desa_kelurahan',
    'kecamatan',
    'kabupaten',
  ],
};

const SUPPORTED_GEMINI_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'application/pdf',
]);

function inferMimeFromBase64Prefix(base64: string): string | null {
  const head = base64.slice(0, 24);
  if (head.startsWith('JVBERi0')) return 'application/pdf';
  if (head.startsWith('/9j/')) return 'image/jpeg';
  if (head.startsWith('iVBORw0KGgo')) return 'image/png';
  if (head.startsWith('UklGR')) return 'image/webp';
  if (head.startsWith('R0lGOD')) return 'image/gif';
  return null;
}

function inferMimeFromFilename(name: string): string | null {
  const lower = (name || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.jfif')) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  if (lower.endsWith('.gif')) return 'image/gif';
  return null;
}

export function sanitizeUploadedDoc(raw: UploadedDocPayload): {
  name: string;
  mimeType: string;
  dataBase64: string;
} {
  const name = typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : 'dokumen.jpg';
  let dataBase64 = typeof raw?.dataBase64 === 'string' ? raw.dataBase64.trim() : '';
  let declaredMime = typeof raw?.mimeType === 'string' ? raw.mimeType.trim().toLowerCase() : '';

  const dataUrlMatch = /^data:([^;]+);base64,(.+)$/i.exec(dataBase64);
  if (dataUrlMatch) {
    if (!declaredMime) {
      declaredMime = dataUrlMatch[1].trim().toLowerCase();
    }
    dataBase64 = dataUrlMatch[2].trim();
  }

  // Strip accidental whitespace/newlines from mobile encoders
  dataBase64 = dataBase64.replace(/\s+/g, '');

  if (declaredMime === 'image/jpg' || declaredMime === 'image/pjpeg') {
    declaredMime = 'image/jpeg';
  } else if (declaredMime === 'image/x-png') {
    declaredMime = 'image/png';
  }

  let mimeType = SUPPORTED_GEMINI_MIME_TYPES.has(declaredMime) ? declaredMime : '';
  if (!mimeType) {
    mimeType = inferMimeFromBase64Prefix(dataBase64) || inferMimeFromFilename(name) || 'image/jpeg';
  }

  return { name, mimeType, dataBase64 };
}

const PLACEHOLDER_API_KEYS = new Set([
  'MY_GEMINI_API_KEY',
  'YOUR_GEMINI_API_KEY',
  'GEMINI_API_KEY',
  'REPLACE_ME',
]);

/**
 * Membaca dan membersihkan GEMINI_API_KEY dari environment server:
 * menghapus spasi dan tanda kutip yang tidak sengaja ikut tersalin, serta menolak placeholder.
 */
export function resolveGeminiApiKey(rawKey: string | undefined): string | null {
  if (typeof rawKey !== 'string') return null;
  let cleaned = rawKey.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (!cleaned || PLACEHOLDER_API_KEYS.has(cleaned.toUpperCase())) {
    return null;
  }
  return cleaned;
}

const geminiClientCache = new Map<string, GoogleGenAI>();

function createGeminiClient(apiKey: string): GoogleGenAI {
  const cached = geminiClientCache.get(apiKey);
  if (cached) return cached;
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  if (geminiClientCache.size >= 8) {
    const firstKey = geminiClientCache.keys().next().value;
    if (firstKey) geminiClientCache.delete(firstKey);
  }
  geminiClientCache.set(apiKey, client);
  return client;
}

function isAbortOrTimeoutError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const obj = err as { name?: unknown; isTimeout?: unknown; message?: unknown };
    if (obj.isTimeout === true) return true;
    if (typeof obj.name === 'string' && obj.name === 'AbortError') return true;
    if (
      typeof obj.message === 'string' &&
      /AbortError|aborted|ETIMEDOUT|timed out|timeout/i.test(obj.message)
    ) {
      return true;
    }
  }
  return false;
}

function isTransientGeminiError(err: unknown): boolean {
  const status =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 0;
  const msg = err instanceof Error ? err.message : '';
  return (
    isAbortOrTimeoutError(err) ||
    status === 503 ||
    status === 502 ||
    status === 504 ||
    status === 429 ||
    /UNAVAILABLE|high demand|try again later|ECONNRESET/i.test(msg)
  );
}

/**
 * Menjalankan permintaan Gemini dengan pola hedged fallback:
 * - Memanggil model utama terlebih dahulu (tanpa duplikasi kuota bila respons normal 2–5 dtk).
 * - Bila model utama belum merespons setelah `hedgeDelayMs` atau gagal transient, model cadangan
 *   dijalankan paralel dan respons valid pertama langsung dipakai sambil membatalkan yang lebih lambat.
 */
async function generateJsonWithFallback(
  ai: GoogleGenAI,
  parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }>,
  responseSchema: object,
  attempts: Array<{ model: string; level: ThinkingLevel; timeoutMs: number }>,
  label: string,
  hedgeDelayMs = 6000
): Promise<{ parsed: unknown; model: string; elapsedMs: number }> {
  const startedAt = Date.now();
  const controllers: AbortController[] = [];
  const timers: Array<ReturnType<typeof setTimeout>> = [];

  const cleanup = () => {
    timers.forEach((t) => clearTimeout(t));
    controllers.forEach((c) => {
      try {
        if (!c.signal.aborted) c.abort();
      } catch {
        // ignore
      }
    });
  };

  const runAttempt = async (attempt: {
    model: string;
    level: ThinkingLevel;
    timeoutMs: number;
  }): Promise<{ parsed: unknown; model: string }> => {
    const controller = new AbortController();
    controllers.push(controller);
    let didTimeout = false;
    const timer = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, attempt.timeoutMs);
    timers.push(timer);

    try {
      const response = await ai.models.generateContent({
        model: attempt.model,
        contents: { parts },
        config: {
          abortSignal: controller.signal,
          thinkingConfig: { thinkingLevel: attempt.level },
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
      const rawText = (response.text ?? '{}')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');
      const parsed = JSON.parse(rawText);
      return { parsed, model: attempt.model };
    } catch (err) {
      if (didTimeout) {
        const timeoutErr = new Error(
          `Permintaan model ${attempt.model} melebihi batas waktu (${Math.round(attempt.timeoutMs / 1000)} detik).`
        ) as Error & { status?: number; isTimeout?: boolean };
        timeoutErr.status = 504;
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  if (attempts.length === 0) {
    throw new Error('Tidak ada konfigurasi model Gemini yang tersedia.');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let backupStarted = false;
    let remaining = 1;
    let lastErr: unknown = null;
    let hedgeTimer: ReturnType<typeof setTimeout> | null = null;

    const finishOk = (result: { parsed: unknown; model: string }) => {
      if (settled) return;
      settled = true;
      if (hedgeTimer) clearTimeout(hedgeTimer);
      cleanup();
      const elapsedMs = Date.now() - startedAt;
      console.log(`Gemini ${label} succeeded with ${result.model} in ${elapsedMs}ms`);
      resolve({ ...result, elapsedMs });
    };

    const finishErr = (err: unknown) => {
      if (settled) return;
      settled = true;
      if (hedgeTimer) clearTimeout(hedgeTimer);
      cleanup();
      reject(err);
    };

    const launchBackup = (reason: string) => {
      if (settled || backupStarted || attempts.length < 2) return;
      backupStarted = true;
      remaining += 1;
      console.warn(
        `Gemini ${label}: ${reason} — launching hedged fallback ${attempts[1].model}...`
      );
      runAttempt(attempts[1])
        .then(finishOk)
        .catch((err) => {
          lastErr = err;
          remaining -= 1;
          if (!settled && remaining <= 0) {
            finishErr(lastErr);
          }
        });
    };

    if (attempts.length >= 2 && hedgeDelayMs > 0) {
      hedgeTimer = setTimeout(() => {
        launchBackup(`primary ${attempts[0].model} >${hedgeDelayMs}ms`);
      }, hedgeDelayMs);
      timers.push(hedgeTimer);
    }

    runAttempt(attempts[0])
      .then(finishOk)
      .catch((err) => {
        lastErr = err;
        remaining -= 1;
        if (settled) return;

        if (!isTransientGeminiError(err)) {
          finishErr(err);
          return;
        }

        if (hedgeTimer) clearTimeout(hedgeTimer);
        if (!backupStarted && attempts.length >= 2) {
          launchBackup(`primary ${attempts[0].model} transient error`);
          return;
        }

        if (remaining <= 0) {
          finishErr(lastErr);
        }
      });
  });
}

export function mapGeminiError(err: unknown, fallbackLabel: string): ApiHttpError {
  const rawMessage = err instanceof Error ? err.message : fallbackLabel;

  const statusFromErr =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 500;
  const isAuthError =
    statusFromErr === 401 ||
    statusFromErr === 403 ||
    /UNAUTHENTICATED|PERMISSION_DENIED|API_KEY_INVALID|API key not valid|ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(
      rawMessage
    );
  const isTimeout = statusFromErr === 504 || isAbortOrTimeoutError(err);
  const isUnavailable = statusFromErr === 503 || /UNAVAILABLE|high demand/i.test(rawMessage);
  const httpStatus = isTimeout
    ? 504
    : isAuthError
      ? statusFromErr === 403
        ? 403
        : 401
      : isUnavailable
        ? 503
        : statusFromErr >= 400 && statusFromErr < 600
          ? statusFromErr
          : 500;

  if (httpStatus >= 500 && httpStatus !== 503 && httpStatus !== 504) {
    console.error('Gemini extraction error:', err);
  } else {
    console.warn(`Gemini extraction notice (${httpStatus}):`, rawMessage);
  }

  let clientMessage = rawMessage;
  if (isAuthError) {
    clientMessage =
      'Kunci API Gemini tidak valid atau belum aktif (401/403). Silakan periksa atau pilih API key yang valid di panel Settings > Secrets (AI Studio) atau Environment Variables (Vercel).';
  } else if (httpStatus === 429 || /RESOURCE_EXHAUSTED/i.test(rawMessage)) {
    clientMessage =
      'Kuota API Gemini sementara habis (429). Coba lagi beberapa saat atau periksa konfigurasi API key di Settings > Secrets.';
  } else if (httpStatus === 504 || isTimeout) {
    clientMessage =
      'Waktu pemindaian dokumen melebihi batas (timeout). Coba unggah 1–2 gambar lebih kecil atau gunakan Mode Cepat.';
  } else if (httpStatus === 503 || isUnavailable) {
    clientMessage =
      'Layanan Gemini AI sedang mengalami lonjakan permintaan sementara (503). Silakan coba pindai ulang beberapa saat lagi.';
  } else if (
    httpStatus === 400 &&
    /Unsupported MIME|Unable to process input image|INVALID_ARGUMENT/i.test(rawMessage)
  ) {
    clientMessage =
      'Format gambar/dokumen tidak dapat dibaca oleh AI. Gunakan foto JPG/PNG/WebP atau PDF yang jelas, lalu coba lagi.';
  } else if (httpStatus === 404 || /NOT_FOUND/i.test(rawMessage)) {
    clientMessage = `Model AI tidak tersedia (404): ${rawMessage}`;
  }

  return { status: httpStatus, error: clientMessage };
}

export async function extractDocumentsWithGemini(
  apiKey: string,
  body: ExtractDocumentsRequestBody
): Promise<unknown> {
  const rawFiles = Array.isArray(body?.files) ? body.files : [];
  const files = rawFiles.map(sanitizeUploadedDoc).filter((f) => f.dataBase64.length > 0);
  if (files.length === 0) {
    const err = new Error(
      'Minimal satu dokumen (KTP, KK, Sertipikat, SPPT PBB, atau SKW) yang valid harus diunggah.'
    ) as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const ai = createGeminiClient(apiKey);
  const layanan = body.layanan || 'AJB';
  const scanMode = body.scanMode === 'accurate' ? 'accurate' : 'fast';
  const isObjectOnly = body.scope === 'object_only';

  const fileNames = files.map((f) => f.name).join(', ');
  const promptText = isObjectOnly
    ? `Ekstrak data sertipikat tanah & SPPT PBB dari dokumen (${fileNames}) ke JSON sesuai skema.
Aturan singkat:
- Sertipikat -> "tanah": jenis_sertipikat ("digital" NIBel / "analog" No SHM+Surat Ukur), jenis_hak, nib, nomor_hak_lama, surat_ukur_tanggal, surat_ukur_nomor, luas_m2, desa, kecamatan, kabupaten, provinsi, batas_utara/timur/selatan/barat, dasar_perolehan, pemegang_hak_sertipikat.
- SPPT PBB -> "pbb": NOP, tahun_pajak, njop_bumi_m2, njop_bumi_total, njop_bangunan, luas_bumi_m2 (gabung angka terpotong 2 baris; cocokkan luas_bumi_m2 * njop_bumi_m2 ≈ njop_bumi_total), luas_bangunan_m2.
- Pisahkan kolom kiri LETAK OBJEK PAJAK vs kolom kanan WAJIB PAJAK:
  * letak_objek_lokasi = dukuh/jalan baris 1 kolom kiri (mis. "GORONGAN"), BUKAN desa & BUKAN alamat WP.
  * letak_objek_rt_rw = RT/RW kolom kiri format "002/003", BUKAN RT/RW WP.
  * letak_objek_desa/kecamatan/kabupaten = dari kolom kiri; nama_wp_pbb = nama WP kolom kanan.
- Field yang tidak ada isi "" atau 0.`
    : `Ekstrak data berkas PPATS (${fileNames}) untuk layanan "${layanan}" ke JSON sesuai skema.
Aturan:
1. KTP/KK/SKW -> "para_pihak" (peran_saran: "Pihak I"=pemilik/penjual/pemberi, "Pihak II"=pembeli/penerima, "Persetujuan Pasangan"=pasangan Pihak I, "Lampiran Lain"=saksi/lainnya). Tanggal lahir DD-MM-YYYY. Field kosong isi "".
2. Sertipikat -> "tanah": jenis_sertipikat ("digital" NIBel / "analog" No SHM+SU), jenis_hak, nib, nomor_hak_lama, surat_ukur_tanggal/nomor, luas_m2, desa, kecamatan, kabupaten, provinsi, batas, dasar_perolehan, pemegang_hak_sertipikat.
3. SPPT PBB -> "pbb": NOP, tahun_pajak, njop_bumi_m2, njop_bumi_total, njop_bangunan, luas_bumi_m2 (gabung jika terpotong 2 baris; pastikan luas_bumi_m2 * njop_bumi_m2 ≈ njop_bumi_total), luas_bangunan_m2.
   WAJIB pisahkan kolom kiri LETAK OBJEK PAJAK (letak_objek_lokasi=dukuh baris 1 mis. "GORONGAN" bukan desa, letak_objek_rt_rw="002/003", letak_objek_desa/kecamatan/kabupaten) vs kolom kanan WAJIB PAJAK (nama_wp_pbb).
4. "audit_warnings": ${scanMode === 'fast' ? 'isi [] kecuali ada ketidakcocokan nama/NIK/sertipikat yang jelas (maks 2 butir singkat).' : 'laporkan selisih alamat/RT/RW, NIK ganda, beda nama KTP vs sertipikat, atau Pihak I kawin tanpa pasangan.'}`;

  const parts = [
    ...files.map((f) => ({
      inlineData: {
        mimeType: f.mimeType,
        data: f.dataBase64,
      },
    })),
    { text: promptText },
  ];

  const attempts =
    scanMode === 'accurate' && !isObjectOnly
      ? [
          { model: 'gemini-4-hydrogen', level: ThinkingLevel.LOW, timeoutMs: 28000 },
          { model: 'gemini-3.1-flash-lite', level: ThinkingLevel.MINIMAL, timeoutMs: 18000 },
        ]
      : [
          { model: 'gemini-3.1-flash-lite', level: ThinkingLevel.MINIMAL, timeoutMs: 20000 },
          { model: 'gemini-4-hydrogen', level: ThinkingLevel.LOW, timeoutMs: 20000 },
        ];

  const hedgeDelayMs = isObjectOnly ? 5500 : scanMode === 'accurate' ? 9000 : 7000;

  const { parsed } = await generateJsonWithFallback(
    ai,
    parts,
    isObjectOnly ? objectExtractionResponseSchema : extractionResponseSchema,
    attempts,
    isObjectOnly ? 'object-extract' : `extraction(${scanMode})`,
    hedgeDelayMs
  );

  if (isObjectOnly && parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    obj.para_pihak = [];
    obj.audit_warnings = [];
  }

  return normalizeExtractionOutput(parsed);
}

function normalizeSpptRtRwServer(raw?: unknown): string {
  const text = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (!text || text === '-' || text === '/') return '';
  const explicit = /\bRT\.?\s*[:.]?\s*(\d{1,3})\s*[/,-]?\s*RW\.?\s*[:.]?\s*(\d{1,3})\b/i.exec(text);
  if (explicit) return `${explicit[1]}/${explicit[2]}`;
  const slash = /\b(\d{1,3})\s*[/\-]\s*(\d{1,3})\b/.exec(text);
  if (slash) return `${slash[1]}/${slash[2]}`;
  return '';
}

function normalizeExtractionOutput(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const obj = parsed as Record<string, unknown>;
  const pbb = obj.pbb && typeof obj.pbb === 'object' ? (obj.pbb as Record<string, unknown>) : null;
  const tanah =
    obj.tanah && typeof obj.tanah === 'object' ? (obj.tanah as Record<string, unknown>) : null;

  if (pbb) {
    const rawLokasi =
      typeof pbb.letak_objek_lokasi === 'string' ? pbb.letak_objek_lokasi.replace(/\s+/g, ' ').trim() : '';
    const directRtRw = normalizeSpptRtRwServer(pbb.letak_objek_rt_rw);
    const embeddedRtRw = normalizeSpptRtRwServer(rawLokasi);
    const cleanedLokasi = rawLokasi
      .replace(/,?\s*\bRT\.?\s*[:.]?\s*\d{1,3}\s*[/,-]?\s*RW\.?\s*[:.]?\s*\d{1,3}\b/gi, '')
      .replace(/,?\s*\bRT\.?\s*[:.]?\s*\d{1,3}\b/gi, '')
      .replace(/,?\s*\bRW\.?\s*[:.]?\s*\d{1,3}\b/gi, '')
      .replace(/^[,.\s-]+|[,.\s-]+$/g, '')
      .trim();

    pbb.letak_objek_lokasi = cleanedLokasi;
    pbb.letak_objek_rt_rw = directRtRw || embeddedRtRw;

    const origPbbLuas = Number(pbb.luas_bumi_m2) || 0;
    const njopPerM2 = Number(pbb.njop_bumi_m2) || 0;
    const njopTotal = Number(pbb.njop_bumi_total) || 0;

    if (njopPerM2 > 0 && njopTotal > 0) {
      const derived = njopTotal / njopPerM2;
      const isCleanInteger = Math.abs(derived - Math.round(derived)) < 0.01;
      const repairedLuas = isCleanInteger ? Math.round(derived) : Math.round(derived * 100) / 100;

      const pbbDisagrees =
        origPbbLuas <= 0 ||
        (isCleanInteger && Math.abs(origPbbLuas * njopPerM2 - njopTotal) > njopPerM2 * 0.5);

      if (pbbDisagrees && repairedLuas > 0) {
        pbb.luas_bumi_m2 = repairedLuas;
        if (tanah) {
          const origTanahLuas = Number(tanah.luas_m2) || 0;
          if (origTanahLuas <= 0 || origTanahLuas === origPbbLuas) {
            tanah.luas_m2 = repairedLuas;
          }
        }
      }
    }
  }

  return obj;
}

export async function extractPersonWithGemini(
  apiKey: string,
  body: ExtractPersonRequestBody
): Promise<{ person: unknown; model: string; elapsed_ms: number }> {
  const rawFiles = Array.isArray(body?.files) ? body.files : [];
  const files = rawFiles.map(sanitizeUploadedDoc).filter((f) => f.dataBase64.length > 0);
  if (files.length === 0) {
    const err = new Error('Minimal satu file foto/PDF KTP yang valid harus diunggah.') as Error & {
      status?: number;
    };
    err.status = 400;
    throw err;
  }

  const ai = createGeminiClient(apiKey);
  const role = (body?.role || 'Saksi / Kuasa').trim();

  const parts = [
    ...files.map((f) => ({
      inlineData: {
        mimeType: f.mimeType,
        data: f.dataBase64,
      },
    })),
    {
      text: `Ekstrak identitas 1 orang (${role}) dari KTP (${files.map((f) => f.name).join(', ')}) ke JSON.
Ambil nama, NIK 16 digit, tempat_lahir, tanggal_lahir (DD-MM-YYYY), jenis_kelamin ("Laki-laki"/"Perempuan"), status_perkawinan, pekerjaan, alamat_jalan (tanpa RT/RW), rt, rw, desa_kelurahan, kecamatan, kabupaten (dari header KTP). Field tidak terbaca isi "".`,
    },
  ];

  const attempts = [
    { model: 'gemini-3.1-flash-lite', level: ThinkingLevel.MINIMAL, timeoutMs: 18000 },
    { model: 'gemini-4-hydrogen', level: ThinkingLevel.LOW, timeoutMs: 18000 },
  ];

  const { parsed, model, elapsedMs } = await generateJsonWithFallback(
    ai,
    parts,
    personExtractionResponseSchema,
    attempts,
    `person-extract(${role})`,
    5000
  );

  return {
    person: parsed,
    model,
    elapsed_ms: elapsedMs,
  };
}

export interface ServerlessRequest {
  method?: string;
  body?: unknown;
  on?: (event: string, listener: (chunk: Buffer | string) => void) => void;
}

export interface ServerlessResponse {
  status: (code: number) => ServerlessResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
}

export async function parseServerlessJsonBody<T>(req: ServerlessRequest): Promise<T> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as T;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as T;
  }
  if (Buffer.isBuffer(req.body) && req.body.length > 0) {
    return JSON.parse(req.body.toString('utf8')) as T;
  }
  if (typeof req.on === 'function') {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on?.('data', (chunk) => {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      });
      req.on?.('end', () => resolve());
      req.on?.('error', (err) => reject(err));
    });
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (raw) {
      return JSON.parse(raw) as T;
    }
  }
  return {} as T;
}
