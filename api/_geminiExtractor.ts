import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
} from '@google/genai';
import {
  DOCX_MIME,
  DOC_MIME,
  extractWordDocumentForAi,
  isWordFilename,
  isWordMimeType,
} from '../src/utils/wordDocExtractor.ts';

export interface UploadedDocPayload {
  name: string;
  mimeType: string;
  dataBase64: string;
}

export type ExtractionScope = 'full' | 'object_only' | 'waris_pewaris' | 'waris_c';

export interface ExtractDocumentsRequestBody {
  layanan?: string;
  scanMode?: 'fast' | 'accurate';
  scope?: ExtractionScope;
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
  njop_bangunan_m2: { type: Type.NUMBER, description: 'NJOP Bangunan per m2 (Rp, kolom NJOP PER M2 baris BANGUNAN, 0 bila kosong).' },
  njop_bangunan: { type: Type.NUMBER, description: 'Total NJOP Bangunan (Rp, kolom TOTAL NJOP baris BANGUNAN).' },
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
        'njop_bangunan_m2',
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
        'njop_bangunan_m2',
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

const warisPewarisProperties = {
  sebutan_pewaris: {
    type: Type.STRING,
    description: '"Almarhum" (laki-laki) atau "Almarhumah" (perempuan).',
  },
  nama_pewaris: {
    type: Type.STRING,
    description: 'Nama lengkap pewaris (pemegang hak yang meninggal), HURUF KAPITAL.',
  },
  tanggal_meninggal: {
    type: Type.STRING,
    description: 'Tanggal meninggal pewaris format DD-MM-YYYY (kosongkan jika tidak ada).',
  },
  tempat_meninggal: {
    type: Type.STRING,
    description: 'Tempat meninggal dan/atau nomor Akta Kematian / Surat Keterangan Kematian.',
  },
  hubungan_pasangan_pewaris: {
    type: Type.STRING,
    description: '"Istrinya", "Suaminya", atau "Pasangannya".',
  },
  nama_pasangan_pewaris: {
    type: Type.STRING,
    description: 'Nama lengkap janda/duda/pasangan pewaris, HURUF KAPITAL.',
  },
  tgl_lahir_pasangan_pewaris: {
    type: Type.STRING,
    description: 'Tanggal lahir pasangan pewaris format DD-MM-YYYY.',
  },
  tanggal_meninggal_pasangan: {
    type: Type.STRING,
    description: 'Tanggal meninggal pasangan pewaris format DD-MM-YYYY jika juga sudah almarhum/almarhumah.',
  },
  tempat_meninggal_pasangan: {
    type: Type.STRING,
    description: 'Tempat meninggal pasangan pewaris jika sudah meninggal.',
  },
  jumlah_anak_waris: {
    type: Type.NUMBER,
    description: 'Jumlah anak kandung / ahli waris (0 jika tidak disebut).',
  },
  catatan_skw: {
    type: Type.STRING,
    description: 'Catatan tambahan SKW (misal nomor kutipan akta nikah KUA, nomor akta kematian, keterangan waris).',
  },
};

export const warisPewarisExtractionResponseSchema = {
  type: Type.OBJECT,
  properties: {
    waris_pewaris: {
      type: Type.OBJECT,
      properties: warisPewarisProperties,
      required: [
        'sebutan_pewaris',
        'nama_pewaris',
        'tanggal_meninggal',
        'tempat_meninggal',
        'hubungan_pasangan_pewaris',
        'nama_pasangan_pewaris',
        'tgl_lahir_pasangan_pewaris',
        'tanggal_meninggal_pasangan',
        'tempat_meninggal_pasangan',
        'jumlah_anak_waris',
        'catatan_skw',
      ],
    },
  },
  required: ['waris_pewaris'],
};

export const warisCExtractionResponseSchema = {
  type: Type.OBJECT,
  properties: {
    waris_c: {
      type: Type.OBJECT,
      properties: {
        ...warisPewarisProperties,
        waris_c_hak_adat: {
          type: Type.STRING,
          description: 'Nomor Buku Letter C / Persil / Kelas, contoh: "C-723 Persil 73-109 Kelas IIa".',
        },
        waris_c_atas_nama_c: {
          type: Type.STRING,
          description: 'Atas nama pemilik tercatat di Buku Letter C Desa, HURUF KAPITAL.',
        },
        waris_c_tahun_tercatat_c: {
          type: Type.STRING,
          description: 'Tahun tercatat di Buku Letter C (misal "1960" atau "1959").',
        },
        waris_c_jenis_tanah: {
          type: Type.STRING,
          description: '"Pekarangan", "Pertanian", "Tegalan", atau "Tanah dan Bangunan".',
        },
        waris_c_berdiri_di_atasnya: {
          type: Type.STRING,
          description: 'Bangunan/tanaman yang berdiri di atas tanah (misal "Bangunan Rumah Tinggal" atau "Kosong").',
        },
        waris_c_nama_blok_dukuh: {
          type: Type.STRING,
          description: 'Nama blok / dukuh / RT RW lokasi tanah.',
        },
        waris_c_nama_wp_pbb: {
          type: Type.STRING,
          description: 'Nama Wajib Pajak di SPPT PBB, HURUF KAPITAL.',
        },
        waris_c_no_surat_keterangan: {
          type: Type.STRING,
          description: 'Nomor Surat Keterangan Desa (misal "593/...").',
        },
        waris_c_no_surat_riwayat: {
          type: Type.STRING,
          description: 'Nomor Surat Keterangan Riwayat Tanah (misal "593/...").',
        },
        waris_c_penerima_bagian: {
          type: Type.STRING,
          description: 'Nama ahli waris penerima bagian / pemohon utama, HURUF KAPITAL.',
        },
        waris_c_luas_bagian_m2: {
          type: Type.NUMBER,
          description: 'Luas bidang bagian pemohon dalam m2 (0 jika tidak disebut).',
        },
        waris_c_tahun_waris: {
          type: Type.STRING,
          description: 'Tahun waris / mulai menguasai fisik secara terus-menerus (misal "2015").',
        },
        waris_c_hubungan_pewaris: {
          type: Type.STRING,
          description: 'Hubungan pemohon dengan pewaris (misal "orang tua kandungnya").',
        },
        waris_c_batas_bagian_utara: { type: Type.STRING },
        waris_c_batas_bagian_timur: { type: Type.STRING },
        waris_c_batas_bagian_selatan: { type: Type.STRING },
        waris_c_batas_bagian_barat: { type: Type.STRING },
        waris_c_riwayat_1_tahun: { type: Type.STRING },
        waris_c_riwayat_1_oleh: { type: Type.STRING },
        waris_c_riwayat_1_cara: { type: Type.STRING },
        waris_c_riwayat_1_bukti: { type: Type.STRING },
        waris_c_riwayat_2_tahun: { type: Type.STRING },
        waris_c_riwayat_2_oleh: { type: Type.STRING },
        waris_c_riwayat_2_cara: { type: Type.STRING },
        waris_c_riwayat_2_bukti: { type: Type.STRING },
        waris_c_riwayat_3_tahun: { type: Type.STRING },
        waris_c_riwayat_3_oleh: { type: Type.STRING },
        waris_c_riwayat_3_cara: { type: Type.STRING },
        waris_c_riwayat_3_bukti: { type: Type.STRING },
        luas_induk_m2: {
          type: Type.NUMBER,
          description: 'Luas induk keseluruhan bidang tanah Letter C dalam m2 (0 jika tidak disebut).',
        },
        desa: { type: Type.STRING },
        kecamatan: { type: Type.STRING },
        kabupaten: { type: Type.STRING },
        nop: { type: Type.STRING, description: 'NOP PBB jika tercantum.' },
      },
      required: [
        'waris_c_hak_adat',
        'waris_c_atas_nama_c',
        'waris_c_tahun_tercatat_c',
        'waris_c_jenis_tanah',
        'waris_c_berdiri_di_atasnya',
        'waris_c_nama_blok_dukuh',
        'waris_c_nama_wp_pbb',
        'waris_c_penerima_bagian',
        'waris_c_luas_bagian_m2',
        'waris_c_tahun_waris',
      ],
    },
  },
  required: ['waris_c'],
};

const SUPPORTED_GEMINI_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'application/pdf',
  DOCX_MIME,
  DOC_MIME,
  'application/rtf',
  'text/rtf',
]);

function inferMimeFromBase64Prefix(base64: string, fileName?: string): string | null {
  const head = base64.slice(0, 24);
  if (head.startsWith('JVBERi0')) return 'application/pdf';
  if (head.startsWith('0M8R4KGx')) return DOC_MIME;
  if (head.startsWith('UEsDB') && (fileName || '').toLowerCase().endsWith('.docx')) {
    return DOCX_MIME;
  }
  if (head.startsWith('e1xydGY')) return 'application/rtf';
  if (head.startsWith('/9j/')) return 'image/jpeg';
  if (head.startsWith('iVBORw0KGgo')) return 'image/png';
  if (head.startsWith('UklGR')) return 'image/webp';
  if (head.startsWith('R0lGOD')) return 'image/gif';
  return null;
}

function inferMimeFromFilename(name: string): string | null {
  const lower = (name || '').toLowerCase();
  if (lower.endsWith('.docx')) return DOCX_MIME;
  if (lower.endsWith('.doc')) return DOC_MIME;
  if (lower.endsWith('.rtf')) return 'application/rtf';
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
  } else if (declaredMime === 'application/vnd.ms-word' || declaredMime === 'application/x-msword') {
    declaredMime = DOC_MIME;
  }

  let mimeType = SUPPORTED_GEMINI_MIME_TYPES.has(declaredMime) ? declaredMime : '';
  if (!mimeType) {
    mimeType =
      inferMimeFromBase64Prefix(dataBase64, name) ||
      inferMimeFromFilename(name) ||
      'image/jpeg';
  }

  return { name, mimeType, dataBase64 };
}

type GeminiContentPart =
  | { inlineData: { mimeType: string; data: string } }
  | { text: string };

/**
 * Mengonversi berkas unggahan ke parts Gemini API.
 * - Gambar/PDF dikirim langsung via `inlineData`.
 * - Dokumen Microsoft Word (`.docx` / `.doc` / `.rtf`) diekstrak menjadi teks terstruktur
 *   beserta gambar tertanam di dalam Word (mis. foto KTP/Sertipikat/SPPT yang ditempel).
 */
export function buildGeminiFileParts(
  files: Array<{ name: string; mimeType: string; dataBase64: string }>
): GeminiContentPart[] {
  const parts: GeminiContentPart[] = [];
  for (const f of files) {
    if (isWordMimeType(f.mimeType) || isWordFilename(f.name)) {
      const bytes = new Uint8Array(Buffer.from(f.dataBase64, 'base64'));
      const extracted = extractWordDocumentForAi(bytes, f.name, f.mimeType);
      if (extracted.text) {
        parts.push({
          text: `=== ISI DOKUMEN WORD (${f.name}) ===\n${extracted.text}\n=== AKHIR DOKUMEN WORD (${f.name}) ===`,
        });
      }
      for (const img of extracted.images) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.dataBase64,
          },
        });
      }
      if (!extracted.text && extracted.images.length === 0) {
        const err = new Error(
          `File Word "${f.name}" tidak memiliki teks atau gambar yang terbaca. Pastikan file .docx/.doc tidak terkunci password atau simpan ulang sebagai .docx/PDF.`
        ) as Error & { status?: number };
        err.status = 400;
        throw err;
      }
    } else {
      parts.push({
        inlineData: {
          mimeType: f.mimeType,
          data: f.dataBase64,
        },
      });
    }
  }
  return parts;
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

export interface GeminiModelAttempt {
  model: string;
  level: ThinkingLevel;
  timeoutMs: number;
}

export type GeminiExtractionKind =
  | 'full'
  | 'object_only'
  | 'person'
  | 'waris_pewaris'
  | 'waris_c';

/**
 * Menentukan urutan model Gemini yang paling andal & cepat:
 * - Menggunakan `gemini-4-hydrogen` sebagai model utama (bebas error transient berulang dari flash-lite,
 *   mendukung ThinkingLevel.LOW untuk kecepatan tinggi & ThinkingLevel.MEDIUM untuk dokumen rumit/buram).
 * - Menyediakan fallback otomatis ke `gemini-3.1-flash-lite` (ThinkingLevel.MINIMAL) serta retry dengan
 *   backoff bila terjadi gangguan sementara (503/429/timeout).
 */
export function resolveGeminiExtractionAttempts(
  kind: GeminiExtractionKind,
  scanMode: 'fast' | 'accurate' = 'fast'
): GeminiModelAttempt[] {
  if (kind === 'full' && scanMode === 'accurate') {
    return [
      { model: 'gemini-4-hydrogen', level: ThinkingLevel.MEDIUM, timeoutMs: 42000 },
      { model: 'gemini-3.1-flash-lite', level: ThinkingLevel.MINIMAL, timeoutMs: 24000 },
      { model: 'gemini-4-hydrogen', level: ThinkingLevel.LOW, timeoutMs: 28000 },
      { model: 'gemini-3.1-flash-lite', level: ThinkingLevel.MINIMAL, timeoutMs: 22000 },
    ];
  }
  if (kind === 'person') {
    return [
      { model: 'gemini-4-hydrogen', level: ThinkingLevel.LOW, timeoutMs: 26000 },
      { model: 'gemini-3.1-flash-lite', level: ThinkingLevel.MINIMAL, timeoutMs: 20000 },
      { model: 'gemini-4-hydrogen', level: ThinkingLevel.LOW, timeoutMs: 24000 },
      { model: 'gemini-3.1-flash-lite', level: ThinkingLevel.MINIMAL, timeoutMs: 20000 },
    ];
  }
  return [
    { model: 'gemini-4-hydrogen', level: ThinkingLevel.LOW, timeoutMs: 32000 },
    { model: 'gemini-3.1-flash-lite', level: ThinkingLevel.MINIMAL, timeoutMs: 24000 },
    { model: 'gemini-4-hydrogen', level: ThinkingLevel.LOW, timeoutMs: 26000 },
    { model: 'gemini-3.1-flash-lite', level: ThinkingLevel.MINIMAL, timeoutMs: 22000 },
  ];
}

function isModelNotFoundError(err: unknown): boolean {
  const status =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 0;
  const msg = err instanceof Error ? err.message : '';
  return status === 404 || /NOT_FOUND|model.*not found/i.test(msg);
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mengurai teks JSON dari Gemini dan memastikan hasilnya selalu objek JSON biasa (bukan null/array/primitif).
 * Mencegah server mengirim HTTP 200 dengan body `null` atau string kosong.
 */
export function parseGeminiJsonObject(rawText: string): Record<string, unknown> {
  const cleaned = (rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  if (!cleaned) {
    const emptyErr = new SyntaxError('Respons model AI kosong.') as SyntaxError & {
      isJsonParseError?: boolean;
    };
    emptyErr.isJsonParseError = true;
    throw emptyErr;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr) {
    const syntaxErr = new SyntaxError(
      parseErr instanceof Error ? parseErr.message : 'Respons JSON dari AI tidak valid.'
    ) as SyntaxError & { isJsonParseError?: boolean };
    syntaxErr.isJsonParseError = true;
    throw syntaxErr;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const shapeErr = new SyntaxError(
      'Struktur JSON dari model AI bukan objek yang valid.'
    ) as SyntaxError & { isJsonParseError?: boolean };
    shapeErr.isJsonParseError = true;
    throw shapeErr;
  }

  return parsed as Record<string, unknown>;
}

export function isDailyQuotaExhaustedError(err: unknown): boolean {
  const status =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 0;
  const msg = err instanceof Error ? err.message : '';
  if (status !== 429 && !/RESOURCE_EXHAUSTED|exceeded your current quota/i.test(msg)) {
    return false;
  }
  return /per day|free_tier_requests|retry in \d+h|limit:\s*0\b/i.test(msg);
}

export function computeGeminiRetryBackoffMs(
  attemptIndex: number,
  isFastSkip: boolean,
  jitterMs = 0
): number {
  if (isFastSkip) return 150;
  const backoffSchedule = [1400, 2800, 4500];
  const base = backoffSchedule[Math.min(Math.max(0, attemptIndex), backoffSchedule.length - 1)];
  return base + Math.max(0, jitterMs);
}

/**
 * Menjalankan permintaan Gemini secara berurutan dengan backoff + fallback otomatis:
 * - Tidak mengirim dua request paralel sekaligus (menghindari lonjakan 429/503 dan warning palsu).
 * - Melewati model yang sudah mengembalikan 404 NOT_FOUND atau 429 kuota harian habis pada percobaan sebelumnya.
 * - Membatasi total durasi eksekusi agar selalu kembali sebagai JSON bersih sebelum timeout gateway (60 dtk).
 * - Jika model utama gagal karena error transient (503/502/504/429/timeout/network), 404, atau JSON rusak/kosong,
 *   otomatis menunggu backoff progresif lalu berpindah ke attempt berikutnya.
 */
async function generateJsonWithFallback(
  ai: GoogleGenAI,
  parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }>,
  responseSchema: object,
  attempts: GeminiModelAttempt[],
  label: string
): Promise<{ parsed: Record<string, unknown>; model: string; elapsedMs: number }> {
  if (attempts.length === 0) {
    throw new Error('Tidak ada konfigurasi model Gemini yang tersedia.');
  }

  const TOTAL_BUDGET_MS = 52_000;
  const startedAt = Date.now();
  let lastErr: unknown = null;
  let lastTransientErr: unknown = null;
  let dailyQuotaErr: unknown = null;
  const skippedModels = new Set<string>();

  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    if (skippedModels.has(attempt.model)) {
      continue;
    }

    const elapsedSoFar = Date.now() - startedAt;
    const remainingMs = TOTAL_BUDGET_MS - elapsedSoFar;
    if (i > 0 && remainingMs < 6_000) {
      break;
    }
    const effectiveTimeoutMs =
      i === 0 ? attempt.timeoutMs : Math.max(6_000, Math.min(attempt.timeoutMs, remainingMs));

    const controller = new AbortController();
    let didTimeout = false;
    const timer = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, effectiveTimeoutMs);

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
      const parsed = parseGeminiJsonObject(response.text ?? '');
      const elapsedMs = Date.now() - startedAt;
      console.log(`Gemini ${label} succeeded with ${attempt.model} in ${elapsedMs}ms`);
      return { parsed, model: attempt.model, elapsedMs };
    } catch (err) {
      const normalizedErr = didTimeout
        ? (() => {
            const timeoutErr = new Error(
              `Permintaan model ${attempt.model} melebihi batas waktu (${Math.round(effectiveTimeoutMs / 1000)} detik).`
            ) as Error & { status?: number; isTimeout?: boolean };
            timeoutErr.status = 504;
            timeoutErr.isTimeout = true;
            return timeoutErr;
          })()
        : err;

      lastErr = normalizedErr;
      const isNotFound = isModelNotFoundError(normalizedErr);
      const isDailyQuota = isDailyQuotaExhaustedError(normalizedErr);
      if (isNotFound || isDailyQuota) {
        skippedModels.add(attempt.model);
      }
      if (isDailyQuota && !dailyQuotaErr) {
        dailyQuotaErr = normalizedErr;
      }
      const isTransient = isTransientGeminiError(normalizedErr);
      if (isTransient && !isDailyQuota) {
        lastTransientErr = normalizedErr;
      }
      const isParseFailure =
        normalizedErr instanceof SyntaxError ||
        (typeof normalizedErr === 'object' &&
          normalizedErr !== null &&
          (normalizedErr as { isJsonParseError?: boolean }).isJsonParseError === true);

      const hasViableNext = attempts
        .slice(i + 1)
        .some((nextAttempt) => !skippedModels.has(nextAttempt.model));
      const canFallback = isTransient || isNotFound || isDailyQuota || isParseFailure;

      const errStatus =
        typeof normalizedErr === 'object' &&
        normalizedErr !== null &&
        'status' in normalizedErr
          ? (normalizedErr as { status?: unknown }).status
          : isParseFailure
            ? 'JSON_PARSE'
            : 'ERR';

      console.log(
        `Gemini ${label} attempt ${i + 1}/${attempts.length} (${attempt.model}) status=${String(errStatus)}${isDailyQuota ? '(daily-quota)' : ''}${hasViableNext && canFallback ? ' — retrying fallback' : ''}`
      );

      if (!hasViableNext || !canFallback) {
        if (dailyQuotaErr && lastTransientErr) {
          const combined = new Error(
            'DAILY_QUOTA_AND_FALLBACK_503: Kuota harian Free Tier model utama (gemini-4-hydrogen) habis dan model cadangan sedang padat (503).'
          ) as Error & { status?: number };
          combined.status = 429;
          throw combined;
        }
        throw dailyQuotaErr ?? lastTransientErr ?? normalizedErr;
      }

      const jitter = Math.floor(Math.random() * 350);
      const delayMs = computeGeminiRetryBackoffMs(i, isNotFound || isDailyQuota, jitter);
      const remainingAfterErr = TOTAL_BUDGET_MS - (Date.now() - startedAt);
      if (remainingAfterErr < delayMs + 5_000) {
        if (dailyQuotaErr && lastTransientErr) {
          const combined = new Error(
            'DAILY_QUOTA_AND_FALLBACK_503: Kuota harian Free Tier model utama (gemini-4-hydrogen) habis dan model cadangan sedang padat (503).'
          ) as Error & { status?: number };
          combined.status = 429;
          throw combined;
        }
        throw dailyQuotaErr ?? lastTransientErr ?? normalizedErr;
      }
      await waitMs(delayMs);
    } finally {
      clearTimeout(timer);
    }
  }

  if (dailyQuotaErr && lastTransientErr) {
    const combined = new Error(
      'DAILY_QUOTA_AND_FALLBACK_503: Kuota harian Free Tier model utama (gemini-4-hydrogen) habis dan model cadangan sedang padat (503).'
    ) as Error & { status?: number };
    combined.status = 429;
    throw combined;
  }
  throw dailyQuotaErr ?? lastTransientErr ?? lastErr ?? new Error('Gagal memproses permintaan ke Gemini API.');
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
  const isDailyAnd503 = /DAILY_QUOTA_AND_FALLBACK_503/i.test(rawMessage);
  const isQuotaError =
    statusFromErr === 429 ||
    isDailyAnd503 ||
    /RESOURCE_EXHAUSTED|exceeded your current quota/i.test(rawMessage);
  const isUnavailable =
    !isQuotaError && (statusFromErr === 503 || /UNAVAILABLE|high demand/i.test(rawMessage));
  const httpStatus = isTimeout
    ? 504
    : isAuthError
      ? statusFromErr === 403
        ? 403
        : 401
      : isQuotaError
        ? 429
        : isUnavailable
          ? 503
          : statusFromErr >= 400 && statusFromErr < 600
            ? statusFromErr
            : 500;

  if (httpStatus >= 500 && httpStatus !== 503 && httpStatus !== 504) {
    console.error('Gemini extraction error:', err);
  } else {
    console.log(`Gemini extraction notice (${httpStatus}):`, rawMessage.slice(0, 200));
  }

  const isJsonParseErr =
    err instanceof SyntaxError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { isJsonParseError?: boolean }).isJsonParseError === true);

  let clientMessage = rawMessage;
  if (isAuthError) {
    clientMessage =
      'Layanan pemindaian otomatis belum dapat digunakan karena konfigurasi akses server belum aktif. Hubungi administrator sistem atau lanjutkan melalui "Lanjut Isi / Verifikasi Manual".';
  } else if (isDailyAnd503) {
    clientMessage =
      'Layanan pemindaian otomatis sedang mencapai batas penggunaan harian dan antrean server sedang padat. Silakan coba kembali beberapa saat lagi lewat "Coba Pindai Ulang", atau lanjutkan pengisian melalui "Lanjut Isi / Verifikasi Manual".';
  } else if (isQuotaError) {
    clientMessage =
      'Batas penggunaan layanan pemindaian otomatis untuk sementara telah tercapai. Silakan coba kembali beberapa saat lagi, atau lanjutkan pengisian melalui "Lanjut Isi / Verifikasi Manual".';
  } else if (httpStatus === 504 || isTimeout) {
    clientMessage =
      'Waktu pemindaian dokumen melebihi batas. Coba unggah 1–2 file berukuran lebih kecil, gunakan Mode Cepat, atau lanjutkan pengisian manual.';
  } else if (httpStatus === 503 || isUnavailable) {
    clientMessage =
      'Layanan pemindaian otomatis sedang sibuk untuk sementara waktu. File Anda tetap tersimpan — tunggu beberapa saat lalu klik "Coba Pindai Ulang", atau lanjutkan melalui "Lanjut Isi / Verifikasi Manual".';
  } else if (isJsonParseErr) {
    clientMessage =
      'Hasil pembacaan dokumen terpotong atau tidak lengkap. Silakan coba pindai ulang dengan foto/dokumen yang lebih jelas.';
  } else if (
    httpStatus === 400 &&
    /Unsupported MIME|Unable to process input image|could not be decoded|image.*invalid|media/i.test(rawMessage)
  ) {
    clientMessage =
      'Format gambar/dokumen tidak dapat dibaca oleh sistem. Gunakan foto JPG/PNG/WebP, PDF, atau Word (.docx/.doc) yang jelas, lalu coba lagi.';
  } else if (httpStatus === 404 || /NOT_FOUND/i.test(rawMessage)) {
    clientMessage =
      'Layanan pemindaian otomatis sedang dalam penyesuaian sistem. Silakan coba beberapa saat lagi atau lanjutkan melalui "Lanjut Isi / Verifikasi Manual".';
  }

  return { status: isJsonParseErr ? 502 : httpStatus, error: clientMessage };
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
  const scope: ExtractionScope =
    body.scope === 'object_only' ||
    body.scope === 'waris_pewaris' ||
    body.scope === 'waris_c'
      ? body.scope
      : 'full';

  const fileNames = files.map((f) => f.name).join(', ');
  let promptText = '';
  let responseSchema: object = extractionResponseSchema;
  let label = `extraction(${scanMode})`;

  if (scope === 'waris_pewaris') {
    responseSchema = warisPewarisExtractionResponseSchema;
    label = 'waris-pewaris-extract';
    promptText = `Ekstrak DATA PEWARIS & SURAT KETERANGAN AHLI WARISAN (SKW) dari dokumen (${fileNames}) ke JSON sesuai skema "waris_pewaris".
Aturan:
- Baca Akta Kematian, Surat Keterangan Kematian, Surat Keterangan Warisan (SKW), Kartu Keluarga (KK), Buku Letter C, atau file Word.
- sebutan_pewaris: "Almarhum" (laki-laki) atau "Almarhumah" (perempuan).
- nama_pewaris & nama_pasangan_pewaris: WAJIB HURUF BESAR SEMUA (CAPSLOCK).
- tanggal_meninggal, tgl_lahir_pasangan_pewaris, tanggal_meninggal_pasangan: format DD-MM-YYYY (kosongkan "" jika tidak ada atau masih hidup).
- tempat_meninggal & tempat_meninggal_pasangan: Title Case (misal "Desa Sindon, Kec. Ngemplak, Boyolali" atau nomor Akta Kematian).
- hubungan_pasangan_pewaris: "Istrinya", "Suaminya", atau "Pasangannya".
- jumlah_anak_waris: angka jumlah anak/ahli waris (0 jika tidak disebut).
- catatan_skw: ringkas nomor akta kematian, nomor buku nikah KUA, atau keterangan tambahan SKW jika tercantum.
- Field yang tidak ada isi "" atau 0.`;
  } else if (scope === 'waris_c') {
    responseSchema = warisCExtractionResponseSchema;
    label = 'waris-c-extract';
    promptText = `Ekstrak DATA KHUSUS WARIS LETTER C / KONVERSI BEKAS HAK MILIK ADAT & DATA PEWARIS dari dokumen (${fileNames}) ke JSON sesuai skema "waris_c".
Aturan:
1. Data Buku Letter C Desa:
   - waris_c_hak_adat: Nomor C, Persil, dan Kelas (misal "C-723 Persil 73-109 Kelas IIa").
   - waris_c_atas_nama_c: Nama pemilik tercatat di Buku C (HURUF KAPITAL).
   - waris_c_tahun_tercatat_c: Tahun tercatat di Buku C (misal "1960" atau "1959").
   - waris_c_jenis_tanah: salah satu dari "Pekarangan", "Pertanian", "Tegalan", atau "Tanah dan Bangunan".
   - waris_c_berdiri_di_atasnya: misal "Bangunan Rumah Tinggal" atau "Kosong".
   - waris_c_nama_blok_dukuh: nama blok/dukuh/RT RW lokasi tanah (Title Case).
   - waris_c_nama_wp_pbb: nama Wajib Pajak di SPPT PBB (HURUF KAPITAL).
   - waris_c_no_surat_keterangan & waris_c_no_surat_riwayat: nomor surat desa jika ada.
2. Pembagian Warisan & Bidang Bagian Pemohon:
   - waris_c_penerima_bagian: nama ahli waris penerima bagian / pemohon utama (HURUF KAPITAL).
   - waris_c_luas_bagian_m2: luas bagian pemohon dalam angka m2 (0 jika tidak disebut).
   - waris_c_tahun_waris: tahun pembagian/penguasaan waris (misal "2015").
   - waris_c_hubungan_pewaris: hubungan pemohon dengan pewaris (misal "orang tua kandungnya").
   - waris_c_batas_bagian_utara/timur/selatan/barat: batas bidang bagian jika disebut (Title Case).
3. Riwayat Penguasaan Tanah (a/b/c):
   - waris_c_riwayat_1_{tahun,oleh,cara,bukti}: tahap 1 (sebelum 1960 / awal Buku C).
   - waris_c_riwayat_2_{tahun,oleh,cara,bukti}: tahap 2 (peralihan pewaris / warisan).
   - waris_c_riwayat_3_{tahun,oleh,cara,bukti}: tahap 3 (pembagian / penguasaan saat ini).
4. Data Pewaris & Pasangan (sebutan_pewaris, nama_pewaris, tanggal_meninggal DD-MM-YYYY, tempat_meninggal, hubungan_pasangan_pewaris, nama_pasangan_pewaris, tgl_lahir_pasangan_pewaris, tanggal_meninggal_pasangan, tempat_meninggal_pasangan, jumlah_anak_waris, catatan_skw) jika tercantum.
5. Juga ekstrak luas_induk_m2, desa, kecamatan, kabupaten, dan nop jika tercantum.
- Semua NAMA ORANG wajib HURUF KAPITAL; tempat/keterangan ditulis Title Case; field tidak ada isi "" atau 0.`;
  } else if (scope === 'object_only') {
    responseSchema = objectExtractionResponseSchema;
    label = 'object-extract';
    promptText = `Ekstrak data sertipikat tanah & SPPT PBB dari dokumen (${fileNames}) ke JSON sesuai skema.
Aturan singkat:
- Sertipikat -> "tanah": jenis_sertipikat ("digital" NIBel / "analog" No SHM+Surat Ukur), jenis_hak, nib, nomor_hak_lama, surat_ukur_tanggal, surat_ukur_nomor, luas_m2, desa, kecamatan, kabupaten, provinsi, batas_utara/timur/selatan/barat, dasar_perolehan, pemegang_hak_sertipikat.
- SPPT PBB -> "pbb": NOP, tahun_pajak, njop_bumi_m2, njop_bumi_total, njop_bangunan, luas_bumi_m2 (gabung angka terpotong 2 baris; cocokkan luas_bumi_m2 * njop_bumi_m2 ≈ njop_bumi_total), luas_bangunan_m2.
- Pisahkan kolom kiri LETAK OBJEK PAJAK vs kolom kanan WAJIB PAJAK:
  * letak_objek_lokasi = dukuh/jalan baris 1 kolom kiri (mis. "Gorongan"), BUKAN desa & BUKAN alamat WP.
  * letak_objek_rt_rw = RT/RW kolom kiri format "002/003", BUKAN RT/RW WP.
  * letak_objek_desa/kecamatan/kabupaten = dari kolom kiri; nama_wp_pbb = nama WP kolom kanan.
- Aturan huruf: semua NAMA ORANG (pemegang_hak_sertipikat, nama_wp_pbb) WAJIB HURUF BESAR SEMUA (CAPSLOCK); teks lainnya (lokasi/dukuh, desa, kecamatan, kabupaten, provinsi, jenis_hak, batas, dasar_perolehan) ditulis Title Case (huruf depan kapital).
- Field yang tidak ada isi "" atau 0.`;
  } else {
    promptText = `Ekstrak data berkas PPATS (${fileNames}) untuk layanan "${layanan}" ke JSON sesuai skema.
Aturan:
1. KTP/KK/SKW -> "para_pihak" (peran_saran: "Pihak I"=pemilik/penjual/pemberi, "Pihak II"=pembeli/penerima, "Persetujuan Pasangan"=pasangan Pihak I, "Lampiran Lain"=saksi/lainnya). Tanggal lahir DD-MM-YYYY. Field kosong isi "".
2. Sertipikat -> "tanah": jenis_sertipikat ("digital" NIBel / "analog" No SHM+SU), jenis_hak, nib, nomor_hak_lama, surat_ukur_tanggal/nomor, luas_m2, desa, kecamatan, kabupaten, provinsi, batas, dasar_perolehan, pemegang_hak_sertipikat.
3. SPPT PBB -> "pbb": NOP, tahun_pajak, njop_bumi_m2, njop_bumi_total, njop_bangunan, luas_bumi_m2 (gabung jika terpotong 2 baris; pastikan luas_bumi_m2 * njop_bumi_m2 ≈ njop_bumi_total), luas_bangunan_m2.
   WAJIB pisahkan kolom kiri LETAK OBJEK PAJAK (letak_objek_lokasi=dukuh baris 1 mis. "Gorongan" bukan desa, letak_objek_rt_rw="002/003", letak_objek_desa/kecamatan/kabupaten) vs kolom kanan WAJIB PAJAK (nama_wp_pbb).
4. Aturan huruf: semua NAMA ORANG (para_pihak[].nama, pemegang_hak_sertipikat, nama_wp_pbb) WAJIB HURUF BESAR SEMUA (CAPSLOCK); seluruh teks lain (tempat_lahir, pekerjaan, alamat_jalan, desa, kecamatan, kabupaten, provinsi, status_perkawinan, jenis_hak, batas, dasar_perolehan, letak_objek_lokasi) ditulis Title Case (huruf depan kapital).
5. "audit_warnings": ${scanMode === 'fast' ? 'isi [] kecuali ada ketidakcocokan nama/NIK/sertipikat yang jelas (maks 2 butir singkat).' : 'laporkan selisih alamat/RT/RW, NIK ganda, beda nama KTP vs sertipikat, atau Pihak I kawin tanpa pasangan.'}`;
  }

  const parts: GeminiContentPart[] = [
    ...buildGeminiFileParts(files),
    { text: promptText },
  ];

  const attempts = resolveGeminiExtractionAttempts(scope, scanMode);

  const { parsed } = await generateJsonWithFallback(
    ai,
    parts,
    responseSchema,
    attempts,
    label
  );

  if (scope === 'object_only' && parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    obj.para_pihak = [];
    obj.audit_warnings = [];
  }

  return normalizeExtractionOutput(parsed);
}

const SERVER_UPPERCASE_ACRONYMS = new Set([
  'PNS',
  'ASN',
  'TNI',
  'POLRI',
  'BUMN',
  'BUMD',
  'BPN',
  'ATR',
  'PPAT',
  'PPATS',
  'BPHTB',
  'PBB',
  'SPPT',
  'NJOP',
  'SHM',
  'HGB',
  'HGU',
  'SHGB',
  'AJB',
  'APHB',
  'SKW',
  'KTP',
  'KK',
  'NIK',
  'NPWP',
  'NIB',
  'NOP',
  'RT',
  'RW',
  'DKI',
  'DIY',
  'RI',
  'WNI',
  'WNA',
  'PT',
  'CV',
  'UD',
  'PD',
  'SD',
  'SMP',
  'SMA',
  'SMK',
  'DPR',
  'DPRD',
  'RS',
  'RSUD',
]);

function toScanUpperNameServer(val: unknown): string {
  if (typeof val !== 'string') return '';
  const clean = val.replace(/\s+/g, ' ').trim();
  return clean ? clean.toUpperCase() : '';
}

function toScanTitleCaseServer(val: unknown): string {
  if (typeof val !== 'string') return '';
  const clean = val.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const converted = clean.replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, (word) => {
    const upper = word.toUpperCase();
    if (SERVER_UPPERCASE_ACRONYMS.has(upper)) return upper;
    return upper.charAt(0) + upper.slice(1).toLowerCase();
  });
  return converted
    .replace(/\bDi Yogyakarta\b/g, 'DI Yogyakarta')
    .replace(/\bLaki-Laki\b/g, 'Laki-laki');
}

function normalizeScanGenderServer(val: unknown): string {
  if (typeof val !== 'string') return '';
  const clean = val.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (/perempuan|wanita|^p$/i.test(clean)) return 'Perempuan';
  if (/laki|pria|^l$/i.test(clean)) return 'Laki-laki';
  return toScanTitleCaseServer(clean);
}

function normalizePersonFieldsServer(person: Record<string, unknown>): void {
  if (typeof person.nama === 'string') {
    person.nama = toScanUpperNameServer(person.nama);
  }
  const titleFields = [
    'tempat_lahir',
    'pekerjaan',
    'alamat_jalan',
    'desa_kelurahan',
    'kecamatan',
    'kabupaten',
    'status_perkawinan',
  ];
  for (const key of titleFields) {
    if (typeof person[key] === 'string') {
      person[key] = toScanTitleCaseServer(person[key]);
    }
  }
  if (typeof person.jenis_kelamin === 'string') {
    person.jenis_kelamin = normalizeScanGenderServer(person.jenis_kelamin);
  }
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
  const paraPihak = Array.isArray(obj.para_pihak) ? obj.para_pihak : null;
  const pbb = obj.pbb && typeof obj.pbb === 'object' ? (obj.pbb as Record<string, unknown>) : null;
  const tanah =
    obj.tanah && typeof obj.tanah === 'object' ? (obj.tanah as Record<string, unknown>) : null;

  if (paraPihak) {
    for (const item of paraPihak) {
      if (item && typeof item === 'object') {
        normalizePersonFieldsServer(item as Record<string, unknown>);
      }
    }
  }

  if (tanah) {
    const tanahTitleFields = [
      'jenis_hak',
      'desa',
      'kecamatan',
      'kabupaten',
      'provinsi',
      'batas_utara',
      'batas_timur',
      'batas_selatan',
      'batas_barat',
      'dasar_perolehan',
    ];
    for (const key of tanahTitleFields) {
      if (typeof tanah[key] === 'string') {
        tanah[key] = toScanTitleCaseServer(tanah[key]);
      }
    }
    if (Array.isArray(tanah.pemegang_hak_sertipikat)) {
      tanah.pemegang_hak_sertipikat = tanah.pemegang_hak_sertipikat
        .map((h) => toScanUpperNameServer(h))
        .filter(Boolean);
    }
  }

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

    pbb.letak_objek_lokasi = toScanTitleCaseServer(cleanedLokasi);
    pbb.letak_objek_rt_rw = directRtRw || embeddedRtRw;

    if (typeof pbb.letak_objek_desa === 'string') {
      pbb.letak_objek_desa = toScanTitleCaseServer(pbb.letak_objek_desa);
    }
    if (typeof pbb.letak_objek_kecamatan === 'string') {
      pbb.letak_objek_kecamatan = toScanTitleCaseServer(pbb.letak_objek_kecamatan);
    }
    if (typeof pbb.letak_objek_kabupaten === 'string') {
      pbb.letak_objek_kabupaten = toScanTitleCaseServer(pbb.letak_objek_kabupaten);
    }
    if (typeof pbb.nama_wp_pbb === 'string') {
      pbb.nama_wp_pbb = toScanUpperNameServer(pbb.nama_wp_pbb);
    }

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

  const normalizeWarisRecord = (rec: Record<string, unknown>) => {
    const upperKeys = [
      'nama_pewaris',
      'nama_pasangan_pewaris',
      'waris_c_atas_nama_c',
      'waris_c_nama_wp_pbb',
      'waris_c_penerima_bagian',
      'waris_c_riwayat_1_oleh',
      'waris_c_riwayat_2_oleh',
      'waris_c_riwayat_3_oleh',
    ];
    for (const k of upperKeys) {
      if (typeof rec[k] === 'string') {
        rec[k] = toScanUpperNameServer(rec[k]);
      }
    }
    const titleKeys = [
      'tempat_meninggal',
      'tempat_meninggal_pasangan',
      'waris_c_berdiri_di_atasnya',
      'waris_c_nama_blok_dukuh',
      'waris_c_batas_bagian_utara',
      'waris_c_batas_bagian_timur',
      'waris_c_batas_bagian_selatan',
      'waris_c_batas_bagian_barat',
      'waris_c_riwayat_1_cara',
      'waris_c_riwayat_1_bukti',
      'waris_c_riwayat_2_cara',
      'waris_c_riwayat_2_bukti',
      'waris_c_riwayat_3_cara',
      'waris_c_riwayat_3_bukti',
      'desa',
      'kecamatan',
      'kabupaten',
    ];
    for (const k of titleKeys) {
      if (typeof rec[k] === 'string') {
        rec[k] = toScanTitleCaseServer(rec[k]);
      }
    }
  };

  if (obj.waris_pewaris && typeof obj.waris_pewaris === 'object') {
    normalizeWarisRecord(obj.waris_pewaris as Record<string, unknown>);
  }
  if (obj.waris_c && typeof obj.waris_c === 'object') {
    normalizeWarisRecord(obj.waris_c as Record<string, unknown>);
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

  const parts: GeminiContentPart[] = [
    ...buildGeminiFileParts(files),
    {
      text: `Ekstrak identitas 1 orang (${role}) dari dokumen KTP/Word (${files.map((f) => f.name).join(', ')}) ke JSON.
Ambil nama (huruf KAPITAL semua), NIK 16 digit, tempat_lahir, tanggal_lahir (DD-MM-YYYY), jenis_kelamin ("Laki-laki"/"Perempuan"), status_perkawinan, pekerjaan, alamat_jalan (tanpa RT/RW), rt, rw, desa_kelurahan, kecamatan, kabupaten (dari header KTP). Field selain nama ditulis Title Case (huruf depan kapital). Field tidak terbaca isi "".`,
    },
  ];

  const attempts = resolveGeminiExtractionAttempts('person', 'fast');

  const { parsed, model, elapsedMs } = await generateJsonWithFallback(
    ai,
    parts,
    personExtractionResponseSchema,
    attempts,
    `person-extract(${role})`
  );

  if (parsed && typeof parsed === 'object') {
    normalizePersonFieldsServer(parsed as Record<string, unknown>);
  }

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
