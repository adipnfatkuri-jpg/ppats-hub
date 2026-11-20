import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type GenerateContentResponse,
} from '@google/genai';

export interface UploadedDocPayload {
  name: string;
  mimeType: string;
  dataBase64: string;
}

export interface ExtractDocumentsRequestBody {
  layanan?: string;
  scanMode?: 'fast' | 'accurate';
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

export const extractionResponseSchema = {
  type: Type.OBJECT,
  properties: {
    para_pihak: {
      type: Type.ARRAY,
      description:
        'Daftar seluruh subjek hukum / orang yang ditemukan pada KTP, KK, Sertipikat, atau SKW.',
      items: {
        type: Type.OBJECT,
        properties: {
          peran_saran: {
            type: Type.STRING,
            description:
              'Saran peran: "Pihak I", "Pihak II", "Persetujuan Pasangan", atau "Lampiran Lain".',
          },
          nik: { type: Type.STRING, description: 'Nomor Induk Kependudukan (16 digit).' },
          nama: {
            type: Type.STRING,
            description: 'Nama lengkap sesuai KTP/KK tanpa gelar jika tidak ada.',
          },
          tempat_lahir: { type: Type.STRING },
          tanggal_lahir: {
            type: Type.STRING,
            description: 'Format DD-MM-YYYY (hari-bulan-tahun, misal 28-09-1974).',
          },
          jenis_kelamin: { type: Type.STRING, description: 'Laki-laki atau Perempuan.' },
          alamat_jalan: { type: Type.STRING, description: 'Nama jalan/dukuh/dusun/kampung.' },
          rt_rw: { type: Type.STRING, description: 'Format 001/002.' },
          desa_kelurahan: { type: Type.STRING },
          kecamatan: { type: Type.STRING },
          kabupaten: { type: Type.STRING },
          pekerjaan: { type: Type.STRING },
          status_perkawinan: {
            type: Type.STRING,
            description: 'Contoh: KAWIN, BELUM KAWIN, CERAI HIDUP, CERAI MATI.',
          },
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
      description: 'Data objek bidang tanah dari Sertipikat Tanah / Sertipikat Elektronik.',
      properties: {
        jenis_sertipikat: {
          type: Type.STRING,
          description:
            'Pilih "digital" untuk Sertipikat Elektronik (hanya NIBel tanpa Nomor SHM/Surat Ukur) atau "analog" untuk Sertipikat Fisik (terdapat Nomor SHM/Hak, NIB, dan Surat Ukur).',
        },
        jenis_hak: {
          type: Type.STRING,
          description: 'Contoh: Hak Milik, Hak Guna Bangunan, Hak Pakai.',
        },
        nib: {
          type: Type.STRING,
          description: 'Nomor Identifikasi Bidang (NIB) atau NIBel (Sertipikat Elektronik).',
        },
        nomor_hak_lama: {
          type: Type.STRING,
          description:
            'Nomor Hak / SHM bila sertipikat analog (misal 01234 atau 3354). Kosongkan bila digital.',
        },
        surat_ukur_tanggal: {
          type: Type.STRING,
          description:
            'Tanggal Surat Ukur (misal 19-10-2011 atau 19/10/2011) bila sertipikat analog.',
        },
        surat_ukur_nomor: {
          type: Type.STRING,
          description: 'Nomor Surat Ukur (misal 00143/Sindon/2011) bila sertipikat analog.',
        },
        luas_m2: { type: Type.NUMBER, description: 'Luas bidang tanah dalam meter persegi.' },
        desa: { type: Type.STRING },
        kecamatan: { type: Type.STRING },
        kabupaten: { type: Type.STRING },
        provinsi: { type: Type.STRING },
        batas_utara: {
          type: Type.STRING,
          description: 'Batas bidang tanah sebelah Utara jika tertera di berkas/surat ukur.',
        },
        batas_timur: {
          type: Type.STRING,
          description: 'Batas bidang tanah sebelah Timur jika tertera di berkas/surat ukur.',
        },
        batas_selatan: {
          type: Type.STRING,
          description: 'Batas bidang tanah sebelah Selatan jika tertera di berkas/surat ukur.',
        },
        batas_barat: {
          type: Type.STRING,
          description: 'Batas bidang tanah sebelah Barat jika tertera di berkas/surat ukur.',
        },
        dasar_perolehan: {
          type: Type.STRING,
          description:
            'Dasar perolehan hak pada sertipikat, misal Jual Beli, Waris, Pemberian Hak.',
        },
        pemegang_hak_sertipikat: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Daftar nama pemegang hak yang tertulis pada sertipikat.',
        },
      },
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
      description: 'Data SPPT PBB-P2.',
      properties: {
        nop: { type: Type.STRING, description: 'Nomor Objek Pajak (NOP) 18 digit.' },
        tahun_pajak: { type: Type.STRING },
        njop_bumi_m2: { type: Type.NUMBER, description: 'NJOP Bumi per m2 dalam rupiah.' },
        njop_bangunan: { type: Type.NUMBER, description: 'Total NJOP Bangunan dalam rupiah.' },
      },
      required: ['nop', 'tahun_pajak', 'njop_bumi_m2', 'njop_bangunan'],
    },
    audit_warnings: {
      type: Type.ARRAY,
      description:
        'Temuan audit otomatis atas kejanggalan atau hal yang wajib diverifikasi petugas PPATS.',
      items: {
        type: Type.OBJECT,
        properties: {
          tingkat: {
            type: Type.STRING,
            description: 'Pilih salah satu: "tinggi", "sedang", atau "info".',
          },
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
  description: 'Identitas lengkap 1 orang (Saksi atau Penerima Kuasa BPN) hasil pembacaan KTP/KK.',
  properties: {
    nama: { type: Type.STRING, description: 'Nama lengkap sesuai KTP tanpa mengarang.' },
    nik: { type: Type.STRING, description: 'Nomor Induk Kependudukan 16 digit (hanya angka).' },
    pekerjaan: { type: Type.STRING, description: 'Pekerjaan sesuai KTP.' },
    tempat_lahir: { type: Type.STRING, description: 'Kota/Kabupaten tempat lahir sesuai KTP.' },
    tanggal_lahir: {
      type: Type.STRING,
      description: 'Format DD-MM-YYYY (hari-bulan-tahun, misal 15-05-1980).',
    },
    alamat_jalan: {
      type: Type.STRING,
      description: 'Alamat jalan/dukuh/dusun tanpa kata RT/RW.',
    },
    rt: { type: Type.STRING, description: 'Nomor RT saja (misal 003).' },
    rw: { type: Type.STRING, description: 'Nomor RW saja (misal 004).' },
    desa_kelurahan: { type: Type.STRING, description: 'Nama Kelurahan atau Desa.' },
    kecamatan: { type: Type.STRING, description: 'Nama Kecamatan.' },
    kabupaten: {
      type: Type.STRING,
      description: 'Nama Kabupaten/Kota (misal Kabupaten Boyolali atau Kota Surakarta).',
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

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateJsonWithFallback(
  ai: GoogleGenAI,
  parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }>,
  responseSchema: object,
  attempts: Array<{ model: string; level: ThinkingLevel; timeoutMs: number }>,
  label: string
): Promise<{ parsed: unknown; model: string; elapsedMs: number }> {
  const callModelWithTimeout = async (
    model: string,
    thinkingLevel: ThinkingLevel,
    timeoutMs: number
  ): Promise<GenerateContentResponse> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          abortSignal: controller.signal,
          thinkingConfig: { thinkingLevel },
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
    } finally {
      clearTimeout(timer);
    }
  };

  const startedAt = Date.now();
  let response: GenerateContentResponse | null = null;
  let usedModel = attempts[0]?.model ?? 'gemini-3.1-flash-lite';
  let lastErr: unknown = null;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    if (i > 0) {
      const backoffMs = Math.min(2500, 700 * Math.pow(2, i - 1));
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
    try {
      response = await callModelWithTimeout(
        attempt.model,
        attempt.level,
        attempt.timeoutMs
      );
      usedModel = attempt.model;
      console.log(
        `Gemini ${label} succeeded with ${attempt.model} in ${Date.now() - startedAt}ms`
      );
      break;
    } catch (callErr: unknown) {
      lastErr = callErr;
      const status =
        typeof callErr === 'object' &&
        callErr !== null &&
        'status' in callErr &&
        typeof (callErr as { status?: unknown }).status === 'number'
          ? (callErr as { status: number }).status
          : 0;
      const msg = callErr instanceof Error ? callErr.message : '';
      const isAbortOrTransient =
        status === 503 ||
        status === 502 ||
        status === 504 ||
        status === 429 ||
        /AbortError|aborted|UNAVAILABLE|high demand|try again later|ECONNRESET|ETIMEDOUT/i.test(
          msg
        );
      if (!isAbortOrTransient || i === attempts.length - 1) {
        throw callErr;
      }
      console.warn(
        `Model ${attempt.model} slow/unavailable (${status || msg}), retrying with ${attempts[i + 1].model}...`
      );
    }
  }

  if (!response) {
    throw lastErr ?? new Error('Gagal menerima respons dari Gemini API.');
  }

  const rawText = (response.text ?? '{}')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return {
    parsed: JSON.parse(rawText),
    model: usedModel,
    elapsedMs: Date.now() - startedAt,
  };
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
  const isTimeout = /AbortError|aborted|ETIMEDOUT/i.test(rawMessage);
  const httpStatus = isTimeout
    ? 504
    : isAuthError
      ? statusFromErr === 403
        ? 403
        : 401
      : statusFromErr >= 400 && statusFromErr < 600
        ? statusFromErr
        : 500;

  if (httpStatus >= 500) {
    console.error('Gemini extraction error:', err);
  } else {
    console.warn(`Gemini extraction rejected (${httpStatus}):`, rawMessage);
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
  } else if (httpStatus === 503 || /UNAVAILABLE|high demand/i.test(rawMessage)) {
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

  const parts = [
    ...files.map((f) => ({
      inlineData: {
        mimeType: f.mimeType,
        data: f.dataBase64,
      },
    })),
    {
      text: `Anda adalah asisten verifikator berkas pertanahan kantor PPATS Indonesia.
Ekstrak seluruh informasi dari dokumen-dokumen terlampir (${files.map((f) => f.name).join(', ')}) untuk layanan akta "${layanan}".

Instruksi ekstraksi ketat:
1. Ekstrak seluruh individu yang tertera pada KTP, KK, atau SKW ke dalam array "para_pihak". Jika dokumen tidak mencantumkan suatu field, isi dengan string kosong "" (jangan mengarang).
2. Tentukan "peran_saran" berdasarkan konteks dokumen dan pemegang hak sertipikat:
   - Pemilik/penjual/pemberi/pewaris atau ahli waris yang melepas hak -> "Pihak I"
   - Pembeli/penerima hak -> "Pihak II"
   - Pasangan sah dari Pihak I yang satu KK atau tercatat kawin -> "Persetujuan Pasangan"
   - Saksi atau anggota keluarga lain yang tidak ikut dalam peralihan -> "Lampiran Lain"
3. Ekstrak detail objek tanah dari Sertipikat Tanah / Sertipikat Elektronik ke "tanah": tentukan "jenis_sertipikat" ("digital" bila Sertipikat Elektronik yang hanya memakai NIBel, atau "analog" bila sertipikat buku tanah fisik), serta isi NIB/NIBel, nomor_hak_lama, surat_ukur_tanggal, surat_ukur_nomor (untuk analog), luas m2 sebagai angka, provinsi, batas utara/timur/selatan/barat bila tercantum, dan daftar nama pemegang hak di sertipikat.
4. Ekstrak data SPPT PBB ke "pbb" (NOP, tahun pajak, NJOP bumi per m2, dan NJOP bangunan).
5. Lakukan audit silang antar dokumen dan laporkan ke "audit_warnings" jika ditemukan:
   - Selisih RT/RW, desa, atau alamat antar KTP/KK/Sertipikat
   - NIK ganda
   - Nama Pihak I di KTP tidak sama atau tidak tercantum di Sertipikat
   - Pihak I berstatus KAWIN yang membutuhkan persetujuan pasangan (suami/istri)
   - Perbedaan ejaan nama antara KTP, KK, Sertipikat, atau SPPT PBB.
Jawab ringkas, padat, dan langsung dalam JSON valid sesuai skema.`,
    },
  ];

  const attempts =
    scanMode === 'accurate'
      ? [
          { model: 'gemini-4-hydrogen', level: ThinkingLevel.LOW, timeoutMs: 22000 },
          { model: 'gemini-3.1-flash-lite', level: ThinkingLevel.MINIMAL, timeoutMs: 16000 },
        ]
      : [
          { model: 'gemini-3.1-flash-lite', level: ThinkingLevel.MINIMAL, timeoutMs: 15000 },
          { model: 'gemini-4-hydrogen', level: ThinkingLevel.LOW, timeoutMs: 18000 },
        ];

  const { parsed } = await generateJsonWithFallback(
    ai,
    parts,
    extractionResponseSchema,
    attempts,
    'extraction'
  );
  return parsed;
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
      text: `Ekstrak data identitas lengkap 1 orang (${role}) dari KTP atau dokumen identitas terlampir (${files.map((f) => f.name).join(', ')}).
Aturan ketat:
- Ambil nama lengkap, NIK 16 digit (angka saja), tempat lahir, tanggal lahir format DD-MM-YYYY, pekerjaan, alamat jalan/dukuh/dusun, RT (pisah dari RW), RW (pisah dari RT), desa/kelurahan, kecamatan, dan kabupaten/kota.
- Jika bagian paling atas KTP mencantumkan "KABUPATEN BOYOLALI" atau "KOTA SURAKARTA", masukkan ke field "kabupaten".
- Jika ada field yang tidak terbaca di dokumen, isi string kosong "" (jangan mengarang).
Jawab langsung dalam JSON sesuai skema.`,
    },
  ];

  const attempts = [
    { model: 'gemini-3.1-flash-lite', level: ThinkingLevel.MINIMAL, timeoutMs: 15000 },
    { model: 'gemini-4-hydrogen', level: ThinkingLevel.LOW, timeoutMs: 18000 },
    { model: 'gemini-3.1-flash-lite', level: ThinkingLevel.MINIMAL, timeoutMs: 14000 },
  ];

  const { parsed, model, elapsedMs } = await generateJsonWithFallback(
    ai,
    parts,
    personExtractionResponseSchema,
    attempts,
    `person-extract(${role})`
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
