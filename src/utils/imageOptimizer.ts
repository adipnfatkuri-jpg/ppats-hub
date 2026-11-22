export interface ScaledDimensions {
  width: number;
  height: number;
  wasScaled: boolean;
}

/**
 * Menghitung dimensi baru agar sisi terpanjang tidak melebihi maxEdge sambil menjaga rasio aspek.
 */
export function computeScaledDimensions(
  width: number,
  height: number,
  maxEdge = 1500
): ScaledDimensions {
  if (width <= 0 || height <= 0 || maxEdge <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height), wasScaled: false };
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height, wasScaled: false };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    wasScaled: true,
  };
}

export function formatCompactFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const SCAN_DOC_FILE_ACCEPT =
  'application/pdf,image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME = 'application/msword';

/**
 * Mendeteksi MIME type dokumen dari magic bytes, tipe file browser, atau ekstensi nama file.
 * Penting untuk perangkat Android/iOS (WhatsApp, galeri, file manager) yang sering mengirim
 * `file.type === ""` atau `application/octet-stream` atau `image/jpg`.
 */
export function inferDocumentMimeType(
  fileName: string,
  declaredType?: string,
  headerBytes?: Uint8Array
): string {
  const lower = (fileName || '').toLowerCase();
  const rawType = (declaredType || '').trim().toLowerCase();

  // 1. Magic bytes check (paling akurat di semua perangkat)
  if (headerBytes && headerBytes.length >= 4) {
    // PDF: %PDF
    if (
      headerBytes[0] === 0x25 &&
      headerBytes[1] === 0x50 &&
      headerBytes[2] === 0x44 &&
      headerBytes[3] === 0x46
    ) {
      return 'application/pdf';
    }
    // DOCX (ZIP OOXML: PK 03 04)
    if (
      headerBytes[0] === 0x50 &&
      headerBytes[1] === 0x4b &&
      headerBytes[2] === 0x03 &&
      headerBytes[3] === 0x04 &&
      (lower.endsWith('.docx') || rawType === DOCX_MIME)
    ) {
      return DOCX_MIME;
    }
    // DOC lama (OLE2 Compound Document: D0 CF 11 E0)
    if (
      headerBytes[0] === 0xd0 &&
      headerBytes[1] === 0xcf &&
      headerBytes[2] === 0x11 &&
      headerBytes[3] === 0xe0
    ) {
      return DOC_MIME;
    }
    // JPEG: FF D8 FF
    if (headerBytes[0] === 0xff && headerBytes[1] === 0xd8 && headerBytes[2] === 0xff) {
      return 'image/jpeg';
    }
    // PNG: 89 50 4E 47
    if (
      headerBytes[0] === 0x89 &&
      headerBytes[1] === 0x50 &&
      headerBytes[2] === 0x4e &&
      headerBytes[3] === 0x47
    ) {
      return 'image/png';
    }
    // GIF: GIF8
    if (
      headerBytes[0] === 0x47 &&
      headerBytes[1] === 0x49 &&
      headerBytes[2] === 0x46 &&
      headerBytes[3] === 0x38
    ) {
      return 'image/gif';
    }
    // BMP: BM
    if (headerBytes[0] === 0x42 && headerBytes[1] === 0x4d) {
      return 'image/bmp';
    }
    // WebP: RIFF....WEBP
    if (
      headerBytes.length >= 12 &&
      headerBytes[0] === 0x52 &&
      headerBytes[1] === 0x49 &&
      headerBytes[2] === 0x46 &&
      headerBytes[3] === 0x46 &&
      headerBytes[8] === 0x57 &&
      headerBytes[9] === 0x45 &&
      headerBytes[10] === 0x42 &&
      headerBytes[11] === 0x50
    ) {
      return 'image/webp';
    }
    // HEIC / HEIF: ....ftypheic / ....ftypheif / ....ftypmif1
    if (
      headerBytes.length >= 12 &&
      headerBytes[4] === 0x66 &&
      headerBytes[5] === 0x74 &&
      headerBytes[6] === 0x79 &&
      headerBytes[7] === 0x70
    ) {
      const brand = String.fromCharCode(
        headerBytes[8],
        headerBytes[9],
        headerBytes[10],
        headerBytes[11]
      ).toLowerCase();
      if (brand.startsWith('hei') || brand === 'mif1' || brand === 'msf1') {
        return brand === 'heif' || brand === 'mif1' ? 'image/heif' : 'image/heic';
      }
    }
  }

  // 2. Normalized browser-declared MIME type
  if (rawType === 'image/jpg' || rawType === 'image/pjpeg') return 'image/jpeg';
  if (rawType === 'image/x-png') return 'image/png';
  if (rawType === DOCX_MIME) return DOCX_MIME;
  if (rawType === DOC_MIME || rawType === 'application/vnd.ms-word' || rawType === 'application/x-msword') {
    return DOC_MIME;
  }
  if (
    rawType &&
    rawType !== 'application/octet-stream' &&
    rawType !== 'binary/octet-stream'
  ) {
    return rawType;
  }

  // 3. Extension fallback
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
  if (lower.endsWith('.bmp')) return 'image/bmp';

  return 'image/jpeg';
}

/**
 * Mengestimasi ukuran payload JSON (byte) untuk kumpulan dokumen base64 agar tetap aman
 * di bawah batas body serverless (4.5 MB di Vercel) dan cepat di jaringan seluler.
 */
export function estimateScanPayloadBytes(
  files: Array<{ name: string; mimeType: string; dataBase64: string }>
): number {
  let total = 256;
  for (const f of files) {
    total += (f.name?.length || 0) + (f.mimeType?.length || 0) + (f.dataBase64?.length || 0) + 64;
  }
  return total;
}

/**
 * Konversi ArrayBuffer ke Base64 dengan chunk kecil (8 KB) agar aman di Safari iOS & Android WebView
 * tanpa risiko `RangeError: Maximum call stack size exceeded`.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const parts: string[] = [];
  const chunk = 0x2000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    parts.push(String.fromCharCode.apply(null, slice as unknown as number[]));
  }
  return btoa(parts.join(''));
}

export interface OptimizedFilePayload {
  mimeType: string;
  size: number;
  originalSize: number;
  dataBase64: string;
}

const NATIVELY_ACCEPTED_RAW_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

async function canvasToJpegPayload(
  canvas: HTMLCanvasElement,
  quality: number,
  originalSize: number
): Promise<OptimizedFilePayload | null> {
  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    } catch {
      resolve(null);
    }
  });

  if (blob) {
    const buf = await blob.arrayBuffer();
    return {
      mimeType: 'image/jpeg',
      size: blob.size,
      originalSize,
      dataBase64: arrayBufferToBase64(buf),
    };
  }

  // Fallback untuk browser/WebView lama yang canvas.toBlob-nya mengembalikan null
  try {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx > 0) {
      const b64 = dataUrl.slice(commaIdx + 1);
      const approxBytes = Math.round((b64.length * 3) / 4);
      return {
        mimeType: 'image/jpeg',
        size: approxBytes,
        originalSize,
        dataBase64: b64,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Mengompresi dan memperkecil gambar beresolusi besar (misal foto kamera HP 3-12 MB atau screenshot PNG lebar)
 * ke max sisi 1080px JPEG q=0.74 agar payload upload & jumlah token visi Gemini jauh lebih cepat
 * sambil menjaga keterbacaan angka NIK, NOP, dan NJOP tetap tajam.
 */
export async function optimizeDocumentFile(
  file: File,
  options?: { maxEdge?: number; quality?: number; skipBelowBytes?: number }
): Promise<OptimizedFilePayload> {
  const originalSize = file.size;
  const maxEdge = options?.maxEdge ?? 1080;
  const quality = options?.quality ?? 0.74;
  const skipBelowBytes = options?.skipBelowBytes ?? 90 * 1024;

  const rawBuf = await file.arrayBuffer();
  const headerBytes = new Uint8Array(rawBuf, 0, Math.min(16, rawBuf.byteLength));
  const resolvedMime = inferDocumentMimeType(file.name, file.type, headerBytes);

  const fallbackRaw = (): OptimizedFilePayload => ({
    mimeType: resolvedMime,
    size: rawBuf.byteLength,
    originalSize,
    dataBase64: arrayBufferToBase64(rawBuf),
  });

  const isImage = resolvedMime.startsWith('image/') && resolvedMime !== 'image/svg+xml';
  const mustTranscode = isImage && !NATIVELY_ACCEPTED_RAW_IMAGE_MIMES.has(resolvedMime);

  // Hanya lewati decode jika sudah JPEG yang sangat kecil (<= skipBelowBytes);
  // PNG/WebP tetap dicek dimensinya agar screenshot lebar tidak memicu banyak vision tile di Gemini.
  if (
    !isImage ||
    (!mustTranscode && resolvedMime === 'image/jpeg' && rawBuf.byteLength <= skipBelowBytes) ||
    typeof document === 'undefined'
  ) {
    return fallbackRaw();
  }

  try {
    const sourceBlob = new Blob([rawBuf], { type: resolvedMime });

    // 1. Coba createImageBitmap dulu (mendukung orientasi EXIF kamera HP modern)
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(sourceBlob);
        try {
          const target = computeScaledDimensions(bitmap.width, bitmap.height, maxEdge);
          if (!mustTranscode && !target.wasScaled && rawBuf.byteLength <= skipBelowBytes) {
            return fallbackRaw();
          }
          const canvas = document.createElement('canvas');
          canvas.width = target.width;
          canvas.height = target.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, target.width, target.height);
            ctx.drawImage(bitmap, 0, 0, target.width, target.height);
            const encoded = await canvasToJpegPayload(canvas, quality, originalSize);
            if (encoded && (mustTranscode || target.wasScaled || encoded.size < rawBuf.byteLength)) {
              return encoded;
            }
          }
        } finally {
          bitmap.close();
        }
      } catch {
        // Fallback ke HTMLImageElement
      }
    }

    // 2. Fallback menggunakan HTMLImageElement + ObjectURL
    const objectUrl = URL.createObjectURL(sourceBlob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Gagal membaca gambar'));
        image.src = objectUrl;
      });

      const target = computeScaledDimensions(img.naturalWidth, img.naturalHeight, maxEdge);
      if (!mustTranscode && !target.wasScaled && rawBuf.byteLength <= skipBelowBytes) {
        return fallbackRaw();
      }
      const canvas = document.createElement('canvas');
      canvas.width = target.width;
      canvas.height = target.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return fallbackRaw();
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, target.width, target.height);
      ctx.drawImage(img, 0, 0, target.width, target.height);

      const encoded = await canvasToJpegPayload(canvas, quality, originalSize);
      if (!encoded || (!mustTranscode && !target.wasScaled && encoded.size >= rawBuf.byteLength)) {
        return fallbackRaw();
      }
      return encoded;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return fallbackRaw();
  }
}
