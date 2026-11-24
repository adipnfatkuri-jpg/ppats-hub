import {
  extractDocumentsWithGemini,
  mapGeminiError,
  parseServerlessJsonBody,
  resolveGeminiApiKey,
  type ExtractDocumentsRequestBody,
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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
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
        'GEMINI_API_KEY belum terkonfigurasi dengan benar di server. Tambahkan API key yang valid pada Environment Variables / Secrets deployment Anda, atau lanjutkan input manual pada Langkah 2.',
    });
  }

  try {
    const body = await parseServerlessJsonBody<ExtractDocumentsRequestBody>(req);
    const parsed = await extractDocumentsWithGemini(apiKey, body);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return res.status(502).json({
        error: 'Hasil ekstraksi AI tidak lengkap. Silakan ulangi pemindaian dokumen.',
      });
    }
    return res.status(200).json(parsed);
  } catch (err: unknown) {
    const mapped = mapGeminiError(err, 'Gagal mengekstrak dokumen menggunakan Gemini API.');
    return res.status(mapped.status).json({ error: mapped.error });
  }
}
