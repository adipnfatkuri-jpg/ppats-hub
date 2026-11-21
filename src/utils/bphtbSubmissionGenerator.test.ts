import test from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import {
  SIPAD_BOYOLALI_URL,
  buildCombinedBphtbDocxBytes,
  buildInitialBphtbFormData,
  buildSingleBphtbDocxBytes,
  formatRupiahDash,
  formatRupiahWithCents,
  generateBphtbBundleFiles,
  getBphtbDocumentList,
  isAjbService,
  isHibahService,
} from './bphtbSubmissionGenerator';
import { parseDocxBytesToPreview } from './docxPreviewParser';
import { DEFAULT_OFFICE_SETTINGS, INITIAL_SEED_RECORDS } from './seedData';
import { calculateLandTaxes } from './taxAndAudit';
import { TaxDraftPrefill } from '../types/ppats';

function extractDocxPlainText(bytes: Uint8Array): string {
  const zip = new PizZip(bytes);
  const xml = zip.file('word/document.xml')?.asText() ?? '';
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

test('SIPAD Boyolali URL matches official portal', () => {
  assert.equal(SIPAD_BOYOLALI_URL, 'https://sipad.boyolali.go.id/sipad/');
});

test('formatRupiahWithCents and formatRupiahDash format official Boyolali currency strings', () => {
  assert.equal(formatRupiahWithCents(291036000), 'Rp. 291.036.000,00');
  assert.equal(formatRupiahWithCents(0), 'Rp. 0,00');
  assert.equal(formatRupiahDash(196000000), 'Rp. 196.000.000,-');
});

test('getBphtbDocumentList includes Bukti Transaksi for AJB, Surat Pernyataan Hibah for Akta Hibah, and 3 core docs for APHB/Waris', () => {
  const ajbDocs = getBphtbDocumentList('AJB');
  assert.deepEqual(
    ajbDocs.map((d) => d.key),
    ['sppd', 'surat_kuasa', 'spjm', 'bukti_transaksi']
  );
  assert.equal(isAjbService('AJB'), true);
  assert.equal(isHibahService('AJB'), false);

  const warisDocs = getBphtbDocumentList('Turun Waris');
  assert.deepEqual(
    warisDocs.map((d) => d.key),
    ['sppd', 'surat_kuasa', 'spjm']
  );

  const aphbDocs = getBphtbDocumentList('APHB');
  assert.equal(aphbDocs.length, 3);

  const hibahDocs = getBphtbDocumentList('Akta Hibah');
  assert.deepEqual(
    hibahDocs.map((d) => d.key),
    ['sppd', 'surat_kuasa', 'spjm', 'surat_pernyataan_hibah']
  );
  assert.equal(isHibahService('Akta Hibah'), true);
  assert.equal(isAjbService('Akta Hibah'), false);
});

test('generateBphtbBundleFiles produces official Boyolali SSPD, Surat Kuasa, SPJM, and Bukti Transaksi for AJB', async () => {
  const linked = INITIAL_SEED_RECORDS[0];
  const form = buildInitialBphtbFormData(DEFAULT_OFFICE_SETTINGS, linked);
  form.tanggal_pengajuan = '30-01-2026';
  form.wp_nama = 'WILDAN APRIANSAH';
  form.pemberi_nama = 'TATIK ERNAWATI';
  form.desa = 'Donohudan';
  form.kecamatan = 'Ngemplak';
  form.kabupaten = 'Boyolali';
  form.nomor_sertipikat = 'Elektronik NIB : 11.17.000022399.0';
  form.objek_rt_rw = '004/01';
  form.luas_bangunan_m2 = 0;

  const taxForm: TaxDraftPrefill = {
    layanan: 'AJB',
    luas_m2: 196,
    njop_bumi_m2: 400000,
    njop_bangunan: 0,
    harga_per_m2: 1000000,
    nilai_transaksi_override: 196000000,
    npoptkp: 80000000,
  };
  const taxResult = calculateLandTaxes(taxForm);

  const files = await generateBphtbBundleFiles({
    taxForm,
    taxResult,
    form,
    settings: DEFAULT_OFFICE_SETTINGS,
  });

  assert.equal(files.length, 4);

  const sppdText = extractDocxPlainText(files[0].bytes);
  assert.match(sppdText, /LAMPIRAN V/);
  assert.match(sppdText, /PERATURAN BUPATI BOYOLALI/);
  assert.match(sppdText, /FORMULIR PENYAMPAIAN SSPD/);
  assert.match(sppdText, /Cq\. Kepala BKD Kabupaten Boyolali/);
  assert.match(sppdText, /Rp\. 196\.000\.000,00/);
  assert.match(sppdText, /Wajib Pajak \/ Kuasa Wajib Pajak \*\)/);

  const kuasaText = extractDocxPlainText(files[1].bytes);
  assert.match(kuasaText, /SURAT KUASA/);
  assert.match(kuasaText, /Selanjutnya disebut Pihak Pertama/);
  assert.match(kuasaText, /Selanjutnya disebut Pihak Kedua/);
  assert.match(kuasaText, /Mengurus\/membayar Setoran Pajak/);
  assert.match(kuasaText, /Yang diberi kuasa/);
  assert.match(kuasaText, /Yang memberi kuasa/);

  const spjmText = extractDocxPlainText(files[2].bytes);
  assert.match(spjmText, /SURAT PERTANGGUNGJAWABAN MUTLAK WAJIB PAJAK/);
  assert.match(spjmText, /BEA PEROLEHAN HAK ATAS TANAH DAN ATAU BANGUNAN/);
  assert.match(spjmText, /Pada hari ini, Jumat, tanggal 30, bulan 01, tahun 2026/);
  assert.match(spjmText, /NO\. SHM\/Petok\/Letter C/);
  assert.match(spjmText, /Luas Bangunan/);
  assert.match(spjmText, /JUAL BELI/);
  assert.match(spjmText, /Rp\. 196\.000\.000,00/);

  const transaksiText = extractDocxPlainText(files[3].bytes);
  assert.match(transaksiText, /BUKTI TRANSAKSI/);
  assert.match(transaksiText, /Telah diterima dari/);
  assert.match(transaksiText, /WILDAN APRIANSAH/);
  assert.match(transaksiText, /Banyaknya uang/);
  assert.match(transaksiText, /Seratus Sembilan Puluh Enam Juta Rupiah/);
  assert.match(transaksiText, /Guna Membayar/);
  assert.match(transaksiText, /Sebidang tanah luas 196 m2 tsb\.SHM Elektronik NIB : 11\.17\.000022399\.0/);
  assert.match(transaksiText, /yang terletak di Desa Donohudan, Kecamatan Ngemplak, Kabupaten Boyolali\./);
  assert.match(transaksiText, /Terbilang Rp\. 196\.000\.000,-/);
  assert.match(transaksiText, /Boyolali, 30-01-2026/);
  assert.match(transaksiText, /Yang menerima/);
  assert.match(transaksiText, /TATIK ERNAWATI/);

  // Verify live DOCX preview parser handles Bukti Transaksi outer receipt box cleanly
  const preview = parseDocxBytesToPreview(files[3].bytes, {
    docKey: '02_lampiran_bundel',
    fileName: files[3].meta.fileName,
    paperSize: 'F4',
    usedCustomTemplate: false,
    context: {},
  });
  assert.ok(preview.pages.length >= 1);
  assert.ok(preview.pages[0].blocks.length >= 1);
});

test('buildCombinedBphtbDocxBytes produces official Surat Pernyataan Hibah with grouped Pihak Menyetujui and Camat Penguatan', async () => {
  const form = buildInitialBphtbFormData(DEFAULT_OFFICE_SETTINGS, null);
  form.tanggal_pengajuan = '30-01-2026';
  form.wp_nama = 'OKTY SRI LESTARININGSIH';
  form.wp_nik = '3309115811840001';
  form.wp_ttl = 'Boyolali, 18-11-1984';
  form.wp_pekerjaan = 'Guru';
  form.wp_alamat = 'NGESREP RT 004 / RW 001';
  form.wp_desa = 'NGESREP';
  form.wp_kecamatan = 'NGEMPLAK';
  form.wp_kabupaten = 'BOYOLALI';
  form.pemberi_nama = 'SUGIYARTO';
  form.pemberi_nik = '3309111006560002';
  form.pemberi_ttl = 'Boyolali, 10-06-1956';
  form.pemberi_pekerjaan = 'Buruh Tani/ Perkebunan';
  form.pemberi_alamat = 'Gagaksipat Rt. 01 Rw. 04, Ds. Gagaksipat, Kecamatan Ngemplak, Kabupaten Boyolali';
  form.desa = 'Gagaksipat';
  form.kecamatan = 'Ngemplak';
  form.kabupaten = 'Boyolali';
  form.objek_rt_rw = '004/01';
  form.nop = '33.09.110.004.005.0244.0';
  form.nomor_sertipikat = 'Elektronik Nib: 11.17.000023174.0';
  form.jenis_tanah = 'pekarangan';
  form.hubungan_hibah = 'Anak Kandungnya';
  form.pihak_menyetujui = [
    { id: 'a1', nama: 'SRI SULASTRI', nik: '', hubungan: 'ISTRI' },
    { id: 'a2', nama: 'EKO BUDIARTO', nik: '', hubungan: 'ANAK KANDUNG' },
    { id: 'a3', nama: 'DWI BUDI SANTOSO', nik: '', hubungan: 'ANAK KANDUNG' },
  ];

  const taxForm: TaxDraftPrefill = {
    layanan: 'Akta Hibah',
    luas_m2: 474,
    njop_bumi_m2: 614000,
    njop_bangunan: 0,
    harga_per_m2: 614000,
    nilai_transaksi_override: null,
    npoptkp: 80000000,
  };
  const taxResult = calculateLandTaxes(taxForm);

  const ctx = {
    taxForm,
    taxResult,
    form,
    settings: DEFAULT_OFFICE_SETTINGS,
  };

  const { bytes, includedDocs } = await buildCombinedBphtbDocxBytes(ctx);

  assert.equal(includedDocs.length, 4);
  const combinedText = extractDocxPlainText(bytes);
  assert.match(combinedText, /FORMULIR PENYAMPAIAN SSPD/);
  assert.match(combinedText, /Rp\. 291\.036\.000,00/);
  assert.match(combinedText, /SURAT KUASA/);
  assert.match(combinedText, /SURAT PERTANGGUNGJAWABAN MUTLAK WAJIB PAJAK/);
  assert.match(combinedText, /SURAT PERNYATAAN HIBAH/);
  assert.match(combinedText, /Bahwa saya betul-betul menghibahkan\/memberikan tanah pekarangan kepada/);
  assert.match(combinedText, /Anak Kandungnya:/);
  assert.match(combinedText, /SHM Elektronik Nib: 11\.17\.000023174\.0 Gagaksipat/);
  assert.match(combinedText, /Menyetujui/);
  assert.match(combinedText, /ISTRI:/);
  assert.match(combinedText, /SRI SULASTRI/);
  assert.match(combinedText, /ANAK KANDUNG:/);
  assert.match(combinedText, /EKO BUDIARTO/);
  assert.match(combinedText, /DWI BUDI SANTOSO/);
  assert.match(combinedText, /Di kuatkan oleh kami :/);
  assert.match(combinedText, /Camat Ngemplak/);
  assert.doesNotMatch(combinedText, /Saksi-Saksi:/);
  assert.doesNotMatch(combinedText, /BUKTI TRANSAKSI/);

  // Verify live DOCX preview parser handles all 4 templates (including SSPD outer frame box)
  for (const meta of includedDocs) {
    const docBytes = await buildSingleBphtbDocxBytes(meta.key, ctx);
    const preview = parseDocxBytesToPreview(docBytes, {
      docKey: '02_lampiran_bundel',
      fileName: meta.fileName,
      paperSize: 'F4',
      usedCustomTemplate: false,
      context: {},
    });
    assert.ok(preview.pages.length >= 1, `Expected preview pages for ${meta.key}`);
    assert.ok(preview.pages[0].blocks.length >= 1, `Expected preview blocks for ${meta.key}`);
  }
});
