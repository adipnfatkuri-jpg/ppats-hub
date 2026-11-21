const PRESERVED_UPPERCASE_ACRONYMS = new Set([
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

function collapseWhitespace(val?: string | null): string {
  return (val || '').replace(/\s+/g, ' ').trim();
}

/**
 * Mempertahankan nama orang dalam huruf KAPITAL SEMUA (CAPSLOCK)
 * sesuai standar penulisan nama pada berkas PPATS / BPN.
 */
export function toScanUpperName(val?: string | null): string {
  const clean = collapseWhitespace(val);
  return clean ? clean.toUpperCase() : '';
}

/**
 * Mengubah hasil scan teks (selain nama) dari CAPSLOCK menjadi Title Case
 * (huruf depan setiap kata kapital), sembari mempertahankan akronim resmi Indonesia
 * seperti PNS, TNI, POLRI, BUMN, SHM, HGB, RT, RW, DKI, DIY, dll.
 */
export function toScanTitleCase(val?: string | null): string {
  const clean = collapseWhitespace(val);
  if (!clean) return '';

  const converted = clean.replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, (word) => {
    const upper = word.toUpperCase();
    if (PRESERVED_UPPERCASE_ACRONYMS.has(upper)) {
      return upper;
    }
    return upper.charAt(0) + upper.slice(1).toLowerCase();
  });

  return converted
    .replace(/\bDi Yogyakarta\b/g, 'DI Yogyakarta')
    .replace(/\bLaki-Laki\b/g, 'Laki-laki');
}

/**
 * Menormalkan jenis kelamin hasil scan KTP agar selalu sesuai opsi formulir
 * ("Laki-laki" atau "Perempuan").
 */
export function normalizeScanGender(val?: string | null): string {
  const clean = collapseWhitespace(val);
  if (!clean) return '';
  if (/perempuan|wanita|^p$/i.test(clean)) return 'Perempuan';
  if (/laki|pria|^l$/i.test(clean)) return 'Laki-laki';
  return toScanTitleCase(clean);
}
