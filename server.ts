import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractDocumentsWithGemini,
  extractPersonWithGemini,
  mapGeminiError,
  resolveGeminiApiKey,
  type ExtractDocumentsRequestBody,
  type ExtractPersonRequestBody,
} from './api/_geminiExtractor.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean(resolveGeminiApiKey(process.env.GEMINI_API_KEY)),
    });
  });

  app.post('/api/extract-documents', async (req, res) => {
    try {
      const apiKey = resolveGeminiApiKey(process.env.GEMINI_API_KEY);
      if (!apiKey) {
        return res.status(503).json({
          error:
            'GEMINI_API_KEY belum terkonfigurasi dengan benar di server. Silakan periksa atau pilih API key di panel Settings > Secrets (AI Studio) atau Environment Variables (Vercel), atau lanjutkan input manual pada Langkah 2.',
        });
      }

      const body = (req.body ?? {}) as ExtractDocumentsRequestBody;
      const parsed = await extractDocumentsWithGemini(apiKey, body);
      return res.json(parsed);
    } catch (err: unknown) {
      const mapped = mapGeminiError(err, 'Gagal mengekstrak dokumen menggunakan Gemini API.');
      return res.status(mapped.status).json({ error: mapped.error });
    }
  });

  app.post('/api/extract-person', async (req, res) => {
    try {
      const apiKey = resolveGeminiApiKey(process.env.GEMINI_API_KEY);
      if (!apiKey) {
        return res.status(503).json({
          error:
            'GEMINI_API_KEY belum terkonfigurasi dengan benar di server. Silakan periksa atau pilih API key di panel Settings > Secrets (AI Studio) atau Environment Variables (Vercel), atau isi data secara manual.',
        });
      }

      const body = (req.body ?? {}) as ExtractPersonRequestBody;
      const result = await extractPersonWithGemini(apiKey, body);
      return res.json(result);
    } catch (err: unknown) {
      const mapped = mapGeminiError(err, 'Gagal memindai KTP saksi/kuasa menggunakan Gemini API.');
      return res.status(mapped.status).json({ error: mapped.error });
    }
  });

  app.all('/api/*', (_req, res) => {
    res.status(404).json({
      error: 'Endpoint API tidak ditemukan di server.',
    });
  });

  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (!req.path.startsWith('/api/')) {
        return next(err);
      }
      const errObj = err as { type?: string; status?: number; message?: string };
      if (errObj?.type === 'entity.too.large' || errObj?.status === 413) {
        return res.status(413).json({
          error:
            'Ukuran total file yang diunggah terlalu besar. Kurangi jumlah dokumen per scan atau kompres ukuran PDF/foto.',
        });
      }
      return res.status(errObj?.status && errObj.status >= 400 ? errObj.status : 400).json({
        error: errObj?.message || 'Permintaan ke API pemindaian tidak valid.',
      });
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIM-PPATS server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SIM-PPATS server:', err);
  process.exit(1);
});
