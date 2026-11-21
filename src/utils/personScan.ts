import { PersonBasicInfo } from '../types/ppats.ts';
import { parseFlexibleDate } from './indonesianFormatter.ts';
import { optimizeDocumentFile } from './imageOptimizer.ts';
import { postScanJson } from './scanApi.ts';

export interface ExtractPersonApiResponse {
  person: PersonBasicInfo;
  model?: string;
  elapsed_ms?: number;
}

/**
 * Menormalkan hasil scan identitas orang (Saksi / Kuasa BPN) agar sesuai format SIM-PPATS
 * (tanggal_lahir DD-MM-YYYY, NIK bersih, RT/RW rapi).
 */
export function normalizeScannedPersonInfo(
  raw: Partial<PersonBasicInfo> | null | undefined,
  fallbackName = ''
): PersonBasicInfo {
  const clean = (val?: string): string =>
    (val || '').replace(/\s+/g, ' ').trim();

  const rawNik = clean(raw?.nik).replace(/[^\d]/g, '');
  const rawTgl = clean(raw?.tanggal_lahir);
  const parsedTgl = parseFlexibleDate(rawTgl);

  const cleanRtRwSegment = (val?: string): string =>
    clean(val).replace(/^(RT|RW)\s*[:.]?\s*/i, '');

  const nama = clean(raw?.nama) || clean(fallbackName);

  return {
    nama,
    nik: rawNik || clean(raw?.nik),
    pekerjaan: clean(raw?.pekerjaan),
    tempat_lahir: clean(raw?.tempat_lahir),
    tanggal_lahir: parsedTgl ? parsedTgl.ddMmYyyy : rawTgl,
    alamat_jalan: clean(raw?.alamat_jalan),
    rt: cleanRtRwSegment(raw?.rt),
    rw: cleanRtRwSegment(raw?.rw),
    desa_kelurahan: clean(raw?.desa_kelurahan),
    kecamatan: clean(raw?.kecamatan),
    kabupaten: clean(raw?.kabupaten),
  };
}

/**
 * Mengoptimalkan file KTP/identitas lalu memanggil endpoint /api/extract-person.
 */
export async function scanPersonFromFiles(
  files: File[],
  roleLabel: string,
  options?: { signal?: AbortSignal }
): Promise<ExtractPersonApiResponse> {
  if (!files || files.length === 0) {
    throw new Error(`Pilih file foto/PDF KTP ${roleLabel} terlebih dahulu.`);
  }

  const optimized = await Promise.all(
    files.map(async (f) => {
      const payload = await optimizeDocumentFile(f);
      return {
        name: f.name,
        mimeType: payload.mimeType,
        dataBase64: payload.dataBase64,
      };
    })
  );

  const data = await postScanJson<Partial<ExtractPersonApiResponse>>(
    '/api/extract-person',
    {
      role: roleLabel,
      files: optimized,
    },
    { signal: options?.signal }
  );

  return {
    person: normalizeScannedPersonInfo(data.person),
    model: data.model,
    elapsed_ms: data.elapsed_ms,
  };
}
