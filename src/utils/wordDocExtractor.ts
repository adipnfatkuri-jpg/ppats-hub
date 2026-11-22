import PizZip from 'pizzip';

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const DOC_MIME = 'application/msword';

export interface ExtractedWordImage {
  name: string;
  mimeType: string;
  dataBase64: string;
}

export interface ExtractedWordDocument {
  text: string;
  images: ExtractedWordImage[];
}

export function isWordMimeType(mimeType?: string): boolean {
  const m = (mimeType || '').trim().toLowerCase();
  return (
    m === DOCX_MIME ||
    m === DOC_MIME ||
    m === 'application/vnd.ms-word' ||
    m === 'application/x-msword' ||
    m === 'application/rtf' ||
    m === 'text/rtf'
  );
}

export function isWordFilename(fileName?: string): boolean {
  const lower = (fileName || '').trim().toLowerCase();
  return lower.endsWith('.docx') || lower.endsWith('.doc') || lower.endsWith('.rtf');
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      const cp = parseInt(dec, 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTextFromWordXml(xml: string): string {
  if (!xml) return '';
  const withStructure = xml
    // Hapus blok metadata/field non-konten yang bisa mengganggu ekstraksi
    .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/gi, '')
    .replace(/<w:delText\b[^>]*>[\s\S]*?<\/w:delText>/gi, '')
    // Pertahankan pemisah struktur: tab, line break, kolom tabel, baris tabel, paragraf
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:(?:br|cr)\b[^>]*\/>/gi, '\n')
    .replace(/<\/w:tc>/gi, ' | ')
    .replace(/<\/w:tr>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    // Hapus seluruh tag XML tersisa
    .replace(/<[^>]+>/g, '');

  return decodeXmlEntities(withStructure)
    .replace(/[ \t]+\|/g, ' |')
    .replace(/\|[ \t]+/g, '| ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  const parts: string[] = [];
  const chunk = 0x2000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    parts.push(String.fromCharCode.apply(null, slice as unknown as number[]));
  }
  return btoa(parts.join(''));
}

function mediaMimeFromPath(entryPath: string): string | null {
  const lower = entryPath.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return null;
}

/**
 * Mengekstrak seluruh teks terstruktur (paragraf, tabel, header, footer) serta
 * gambar raster tertanam (mis. foto KTP/Sertipikat/SPPT yang ditempel di Word)
 * dari file Microsoft Word `.docx` (OOXML).
 */
export function extractDocxContent(
  bytes: Uint8Array,
  options?: { maxImages?: number; maxImageBytes?: number; minImageBytes?: number }
): ExtractedWordDocument {
  const maxImages = options?.maxImages ?? 6;
  const maxImageBytes = options?.maxImageBytes ?? 4 * 1024 * 1024;
  const minImageBytes = options?.minImageBytes ?? 128;

  const zip = new PizZip(bytes);
  const allFileNames = Object.keys(zip.files);

  const xmlEntries = [
    ...allFileNames.filter((n) => /^word\/header\d*\.xml$/i.test(n)).sort(),
    ...(zip.files['word/document.xml'] ? ['word/document.xml'] : []),
    ...allFileNames.filter((n) => /^word\/footer\d*\.xml$/i.test(n)).sort(),
  ];

  const textSections: string[] = [];
  for (const entryName of xmlEntries) {
    const file = zip.files[entryName];
    if (!file || file.dir) continue;
    const xmlStr = file.asText();
    const extracted = extractTextFromWordXml(xmlStr);
    if (extracted) {
      textSections.push(extracted);
    }
  }

  const images: ExtractedWordImage[] = [];
  const mediaEntries = allFileNames
    .filter((n) => /^word\/media\//i.test(n))
    .sort();

  for (const mediaName of mediaEntries) {
    if (images.length >= maxImages) break;
    const mimeType = mediaMimeFromPath(mediaName);
    if (!mimeType) continue;
    const file = zip.files[mediaName];
    if (!file || file.dir) continue;
    const imgBytes = file.asUint8Array();
    if (imgBytes.byteLength < minImageBytes || imgBytes.byteLength > maxImageBytes) {
      continue;
    }
    images.push({
      name: mediaName.replace(/^word\/media\//i, ''),
      mimeType,
      dataBase64: uint8ToBase64(imgBytes),
    });
  }

  return {
    text: textSections.join('\n\n').trim(),
    images,
  };
}

function stripRtfToText(raw: string): string {
  return raw
    .replace(/\\par[d]?\b/gi, '\n')
    .replace(/\\tab\b/gi, '\t')
    .replace(/\\line\b/gi, '\n')
    .replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/g, (_m, code) => {
      const n = parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCharCode(n < 0 ? n + 65536 : n) : '';
    })
    .replace(/\{\\\*\\[^{}]*\}/g, '')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripHtmlOrXmlToText(raw: string): string {
  return decodeXmlEntities(
    raw
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<\/(?:p|div|tr|li|h[1-6]|br)\s*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/t[dh]\s*>/gi, ' | ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Mengekstrak teks terbaca dari file Word lama `.doc` (RTF, Word HTML/XML, maupun
 * binary OLE2 Compound Document Word 97–2003) tanpa ketergantungan biner eksternal.
 */
export function extractLegacyDocText(bytes: Uint8Array): string {
  if (bytes.byteLength === 0) return '';

  // Deteksi cepat RTF / HTML / XML yang disimpan dengan ekstensi .doc
  const headAscii = Array.from(bytes.subarray(0, Math.min(256, bytes.byteLength)))
    .map((b) => String.fromCharCode(b))
    .join('');

  if (/^\s*\{\\rtf/i.test(headAscii)) {
    const fullLatin = new TextDecoder('latin1').decode(bytes);
    return stripRtfToText(fullLatin);
  }

  if (/^\s*(?:<!doctype\s+html|<html|<\?xml)/i.test(headAscii)) {
    const fullUtf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return stripHtmlOrXmlToText(fullUtf8);
  }

  // Binary OLE2 (.doc Word 97-2003): ekstrak run teks UTF-16LE & ASCII/Latin-1 yang valid
  const candidates: string[] = [];

  // 1. Scan UTF-16LE (umum untuk teks Word 97-2003 modern)
  let current = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    const isPrintable =
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0xa0 && code <= 0x017f) ||
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d;
    if (isPrintable) {
      current += code === 0x0d ? '\n' : String.fromCharCode(code);
    } else {
      if (current.trim().length >= 8 && /[A-Za-z0-9]{3,}/.test(current)) {
        candidates.push(current.trim());
      }
      current = '';
    }
  }
  if (current.trim().length >= 8 && /[A-Za-z0-9]{3,}/.test(current)) {
    candidates.push(current.trim());
  }

  // 2. Fallback ASCII/Latin-1 runs jika UTF-16LE sedikit (dokumen 8-bit Word lama)
  if (candidates.join('\n').length < 40) {
    let asciiRun = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      const ok = (b >= 0x20 && b <= 0x7e) || b === 0x09 || b === 0x0a || b === 0x0d;
      if (ok) {
        asciiRun += b === 0x0d ? '\n' : String.fromCharCode(b);
      } else {
        if (
          asciiRun.trim().length >= 10 &&
          /[A-Za-z]{3,}/.test(asciiRun) &&
          !/^(?:Root Entry|WordDocument|1Table|0Table|Data|SummaryInformation|DocumentSummaryInformation|CompObj|Microsoft Word)$/i.test(
            asciiRun.trim()
          )
        ) {
          candidates.push(asciiRun.trim());
        }
        asciiRun = '';
      }
    }
    if (asciiRun.trim().length >= 10 && /[A-Za-z]{3,}/.test(asciiRun)) {
      candidates.push(asciiRun.trim());
    }
  }

  const noisePattern =
    /^(?:Root Entry|WordDocument|1Table|0Table|SummaryInformation|DocumentSummaryInformation|CompObj|Normal|Default Paragraph Font|Times New Roman|Bookman Old Style|Calibri|Arial|Cambria|Table Normal|No List|Hyperlink)$/i;

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const chunk of candidates) {
    const cleaned = chunk
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!cleaned || noisePattern.test(cleaned) || seen.has(cleaned)) continue;
    seen.add(cleaned);
    deduped.push(cleaned);
  }

  return deduped.join('\n').slice(0, 60_000).trim();
}

/**
 * Ekstraksi universal dokumen Word (`.docx`, `.doc`, `.rtf`) menjadi teks bersih +
 * gambar tertanam siap dikirim ke Gemini AI.
 */
export function extractWordDocumentForAi(
  bytes: Uint8Array,
  fileName: string,
  mimeType?: string
): ExtractedWordDocument {
  const isZipHeader =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;

  const lowerName = (fileName || '').toLowerCase();
  const isDocx =
    isZipHeader ||
    (mimeType || '').toLowerCase() === DOCX_MIME ||
    lowerName.endsWith('.docx');

  if (isDocx && isZipHeader) {
    try {
      return extractDocxContent(bytes);
    } catch {
      // Jatuh ke ekstraktor teks generik jika ZIP rusak
    }
  }

  return {
    text: extractLegacyDocText(bytes),
    images: [],
  };
}
