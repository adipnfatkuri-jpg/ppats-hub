import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeScaledDimensions,
  estimateScanPayloadBytes,
  formatCompactFileSize,
  inferDocumentMimeType,
} from './imageOptimizer.ts';
import { parseScanResponseText, postScanJson } from './scanApi.ts';
import {
  mapGeminiError,
  parseGeminiJsonObject,
  resolveGeminiApiKey,
  sanitizeUploadedDoc,
} from '../../api/_geminiExtractor.ts';

test('computeScaledDimensions preserves dimensions when within maxEdge', () => {
  assert.deepEqual(computeScaledDimensions(1200, 900, 1500), {
    width: 1200,
    height: 900,
    wasScaled: false,
  });
});

test('computeScaledDimensions scales landscape and portrait images proportionally to maxEdge', () => {
  assert.deepEqual(computeScaledDimensions(4000, 3000, 1500), {
    width: 1500,
    height: 1125,
    wasScaled: true,
  });
  assert.deepEqual(computeScaledDimensions(2400, 3200, 1600), {
    width: 1200,
    height: 1600,
    wasScaled: true,
  });
});

test('formatCompactFileSize renders KB and MB cleanly', () => {
  assert.equal(formatCompactFileSize(0), '0 KB');
  assert.equal(formatCompactFileSize(512 * 1024), '512 KB');
  assert.equal(formatCompactFileSize(3.5 * 1024 * 1024), '3.5 MB');
});

test('inferDocumentMimeType recovers MIME type from magic bytes and filename when mobile device sends empty type', () => {
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

  assert.equal(inferDocumentMimeType('IMG-20261120-WA001', '', jpegBytes), 'image/jpeg');
  assert.equal(
    inferDocumentMimeType('scan.bin', 'application/octet-stream', pngBytes),
    'image/png'
  );
  assert.equal(inferDocumentMimeType('berkas', '', pdfBytes), 'application/pdf');
  assert.equal(inferDocumentMimeType('ktp.jpg', ''), 'image/jpeg');
  assert.equal(inferDocumentMimeType('ktp.jpg', 'image/jpg'), 'image/jpeg');
  assert.equal(inferDocumentMimeType('foto.heic', ''), 'image/heic');
});

test('sanitizeUploadedDoc strips data URL prefix and repairs application/octet-stream using base64 header', () => {
  const cleaned = sanitizeUploadedDoc({
    name: 'IMG-20261120-WA001.jpg',
    mimeType: 'application/octet-stream',
    dataBase64: 'data:image/jpg;base64,/9j/4AAQSkZJRg==',
  });
  assert.equal(cleaned.mimeType, 'image/jpeg');
  assert.equal(cleaned.dataBase64, '/9j/4AAQSkZJRg==');

  const pdfCleaned = sanitizeUploadedDoc({
    name: 'berkas',
    mimeType: '',
    dataBase64: 'JVBERi0xLjQK',
  });
  assert.equal(pdfCleaned.mimeType, 'application/pdf');
});

test('resolveGeminiApiKey trims quotes/whitespace and rejects placeholder values', () => {
  assert.equal(resolveGeminiApiKey(undefined), null);
  assert.equal(resolveGeminiApiKey('   '), null);
  assert.equal(resolveGeminiApiKey('"MY_GEMINI_API_KEY"'), null);
  assert.equal(resolveGeminiApiKey('  "AIzaSyTestKey123"  '), 'AIzaSyTestKey123');
});

test('mapGeminiError maps 401 ACCESS_TOKEN_TYPE_UNSUPPORTED to clean auth guidance', () => {
  const err = Object.assign(
    new Error('API key not valid. ACCESS_TOKEN_TYPE_UNSUPPORTED'),
    { status: 401 }
  );
  const mapped = mapGeminiError(err, 'Fallback');
  assert.equal(mapped.status, 401);
  assert.match(mapped.error, /konfigurasi akses server belum aktif/i);
  assert.doesNotMatch(mapped.error, /Gemini|Settings > Secrets|AI Studio|Vercel/i);
});

test('parseScanResponseText handles plain-text 404, 413, 504, and valid JSON cleanly', () => {
  assert.throws(
    () =>
      parseScanResponseText(
        'The page could not be found\nNOT_FOUND',
        404,
        false,
        '/api/extract-documents'
      ),
    /Layanan API pemindaian.*404/
  );

  assert.throws(
    () =>
      parseScanResponseText(
        'Request Entity Too Large',
        413,
        false,
        '/api/extract-documents'
      ),
    /Ukuran total foto\/dokumen terlalu besar/
  );

  assert.throws(
    () =>
      parseScanResponseText(
        JSON.stringify({ error: 'GEMINI_API_KEY belum terkonfigurasi' }),
        503,
        false,
        '/api/extract-documents'
      ),
    /GEMINI_API_KEY belum terkonfigurasi/
  );

  const okData = parseScanResponseText<{ ok: boolean }>(
    JSON.stringify({ ok: true }),
    200,
    true,
    '/api/extract-documents'
  );
  assert.deepEqual(okData, { ok: true });
});

test('estimateScanPayloadBytes estimates JSON request payload size accurately', () => {
  const size = estimateScanPayloadBytes([
    { name: 'ktp.jpg', mimeType: 'image/jpeg', dataBase64: 'A'.repeat(1000) },
  ]);
  assert.ok(size > 1000 && size < 2000);
});

test('parseScanResponseText distinguishes auth redirects, AI Studio cookie-check HTML, SPA HTML fallback, and empty/null HTTP 200 bodies', () => {
  assert.throws(
    () =>
      parseScanResponseText(
        '<!doctype html><html><head><title>Sign in - Google Accounts</title></head><body></body></html>',
        200,
        true,
        '/api/extract-documents',
        { contentType: 'text/html', redirected: true, responseUrl: 'https://accounts.google.com/ServiceLogin' }
      ),
    /Sesi cookie keamanan browser/
  );

  assert.throws(
    () =>
      parseScanResponseText(
        '<!doctype html><html lang="en"><head><title>Cookie check</title></head><body><h1>Action required to load your app</h1><script>const AUTH_FLOW_TEST_COOKIE_NAME="__SECURE-aistudio_auth_flow_may_set_cookies";</script></body></html>',
        200,
        true,
        '/api/extract-documents',
        { contentType: 'text/html', redirected: false }
      ),
    /Sesi cookie keamanan browser/
  );

  assert.throws(
    () =>
      parseScanResponseText(
        '<!doctype html><html><head><title>SIM-PPATS</title></head><body><div id="root"></div></body></html>',
        200,
        true,
        '/api/extract-documents',
        { contentType: 'text/html; charset=utf-8', redirected: false }
      ),
    /mengembalikan halaman HTML aplikasi alih-alih JSON/
  );

  assert.throws(
    () => parseScanResponseText('', 200, true, '/api/extract-documents'),
    /mengembalikan respons kosong/
  );

  assert.throws(
    () => parseScanResponseText('null', 200, true, '/api/extract-documents'),
    /mengembalikan respons kosong/
  );
});

test('parseGeminiJsonObject accepts fenced JSON objects and rejects null, arrays, empty, and malformed JSON', () => {
  assert.deepEqual(parseGeminiJsonObject('```json\n{"tanah":{"luas_m2":500}}\n```'), {
    tanah: { luas_m2: 500 },
  });

  for (const invalid of ['', '   ', 'null', '[]', '"hello"', '123', '{broken']) {
    assert.throws(
      () => parseGeminiJsonObject(invalid),
      (err: unknown) =>
        err instanceof SyntaxError &&
        (err as { isJsonParseError?: boolean }).isJsonParseError === true
    );
  }
});

test('postScanJson retries once on transient empty HTTP 200 and returns valid JSON on retry', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response('', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, recovered: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const res = await postScanJson<{ ok: boolean; recovered: boolean }>(
      '/api/extract-documents',
      { files: [] },
      { maxTransientRetries: 1 }
    );
    assert.equal(calls, 2);
    assert.deepEqual(res, { ok: true, recovered: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
