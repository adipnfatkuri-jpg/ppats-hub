import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx';
import {
  DOCX_MIME,
  DOC_MIME,
  extractDocxContent,
  extractLegacyDocText,
  extractWordDocumentForAi,
} from './wordDocExtractor';
import { inferDocumentMimeType } from './imageOptimizer';
import { buildGeminiFileParts, sanitizeUploadedDoc } from '../../api/_geminiExtractor';

const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';

test('extractDocxContent extracts paragraphs, tables, and embedded images from real .docx buffer', async () => {
  const pngBytes = new Uint8Array(Buffer.from(SAMPLE_PNG_BASE64, 'base64'));
  // Pad PNG with an extra tEXt-like comment or duplicate bytes? Instead pass minImageBytes: 10 in test OR make valid >128B PNG
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun('SURAT PERNYATAAN AHLI WARISAN — Almarhum SANURI')],
          }),
          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Hak Adat')] }),
                  new TableCell({ children: [new Paragraph('C-723 Persil 73-109 Kelas IIa')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Luas')] }),
                  new TableCell({ children: [new Paragraph('5650 m2')] }),
                ],
              }),
            ],
          }),
          new Paragraph({
            children: [
              new ImageRun({
                data: pngBytes,
                type: 'png',
                transformation: { width: 80, height: 80 },
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buf = new Uint8Array(await Packer.toBuffer(doc));
  const extracted = extractDocxContent(buf, { minImageBytes: 10 });

  assert.match(extracted.text, /SURAT PERNYATAAN AHLI WARISAN/);
  assert.match(extracted.text, /Almarhum SANURI/);
  assert.match(extracted.text, /C-723 Persil 73-109 Kelas IIa/);
  assert.match(extracted.text, /5650 m2/);
  assert.equal(extracted.images.length, 1);
  assert.equal(extracted.images[0].mimeType, 'image/png');
  assert.ok(extracted.images[0].dataBase64.length > 20);

  // Verify MIME detection & Gemini part conversion
  const inferred = inferDocumentMimeType('berkas-waris.docx', '', buf.subarray(0, 16));
  assert.equal(inferred, DOCX_MIME);

  const sanitized = sanitizeUploadedDoc({
    name: 'berkas-waris.docx',
    mimeType: 'application/octet-stream',
    dataBase64: Buffer.from(buf).toString('base64'),
  });
  assert.equal(sanitized.mimeType, DOCX_MIME);

  const geminiParts = buildGeminiFileParts([sanitized]);
  assert.ok(geminiParts.length >= 1);
  assert.ok('text' in geminiParts[0] && geminiParts[0].text.includes('C-723 Persil 73-109'));
});

test('extractLegacyDocText parses RTF, HTML-in-.doc, and binary UTF-16LE OLE2 .doc payloads', () => {
  // 1. RTF saved as .doc
  const rtfStr = '{\\rtf1\\ansi{\\fonttbl\\f0 Times;}\\pard Nama : WIJIATI\\par NIK : 3309117112659149\\par}';
  const rtfBytes = new Uint8Array(Buffer.from(rtfStr, 'latin1'));
  const rtfOut = extractWordDocumentForAi(rtfBytes, 'data-pihak.doc', DOC_MIME);
  assert.match(rtfOut.text, /Nama : WIJIATI/);
  assert.match(rtfOut.text, /3309117112659149/);

  // 2. HTML saved as .doc
  const htmlStr = '<html><body><p>NOP: 33.09.110.008.004-0123.0</p><p>Luas Bumi: 5650 m2</p></body></html>';
  const htmlBytes = new Uint8Array(Buffer.from(htmlStr, 'utf8'));
  const htmlOut = extractLegacyDocText(htmlBytes);
  assert.match(htmlOut, /33\.09\.110\.008\.004-0123\.0/);
  assert.match(htmlOut, /Luas Bumi: 5650 m2/);

  // 3. Binary OLE2 header + UTF-16LE text
  const oleHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const utf16Text = Buffer.from('Hak Adat C-723 Persil 73-109 Desa Giriroto', 'utf16le');
  const oleBuf = new Uint8Array(Buffer.concat([oleHeader, Buffer.alloc(16, 0), utf16Text]));
  assert.equal(inferDocumentMimeType('lama.doc', '', oleBuf.subarray(0, 16)), DOC_MIME);
  const oleText = extractLegacyDocText(oleBuf);
  assert.match(oleText, /Hak Adat C-723 Persil 73-109 Desa Giriroto/);
});
