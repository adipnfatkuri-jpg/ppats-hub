import {
  mapGeminiError,
  parseServerlessJsonBody,
  refineSketchWithGemini,
  resolveGeminiApiKey,
  type RefineSketchRequestBody,
  type ServerlessRequest,
  type ServerlessResponse,
} from './_geminiExtractor.ts';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode HTTP tidak diizinkan. Gunakan POST.' });
  }

  const apiKey = resolveGeminiApiKey(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    return res.status(503).json({
      error:
        'GEMINI_API_KEY belum terkonfigurasi dengan benar di server. Gunakan fitur Buat Sket Otomatis (CAD) atau periksa API key di Settings > Secrets.',
    });
  }

  try {
    const body = await parseServerlessJsonBody<RefineSketchRequestBody>(req);
    const result = await refineSketchWithGemini(apiKey, body);
    return res.status(200).json(result);
  } catch (err: unknown) {
    const mapped = mapGeminiError(
      err,
      'Gagal menyempurnakan gambar sket kasar menggunakan Gemini API.'
    );
    return res.status(mapped.status).json({ error: mapped.error });
  }
}
