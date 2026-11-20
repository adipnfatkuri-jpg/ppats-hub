import {
  resolveGeminiApiKey,
  type ServerlessRequest,
  type ServerlessResponse,
} from './_geminiExtractor.ts';

export default function handler(req: ServerlessRequest, res: ServerlessResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return res.status(200).json({
    ok: true,
    geminiConfigured: Boolean(resolveGeminiApiKey(process.env.GEMINI_API_KEY)),
  });
}
