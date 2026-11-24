import test from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import {
  buildTemplateContext,
  generateBundleFiles,
  renderDocxWithTemplate,
} from './bundleGenerator';
import {
  generateDefaultDocxBuffer,
  LAMPIRAN_MARGINS,
  PAPER_SIZE_A4_TWIPS,
  PAPER_SIZE_F4_TWIPS,
} from './docxTemplates';
import { DEFAULT_OFFICE_SETTINGS, INITIAL_SEED_RECORDS } from './seedData';
import { renderDocxPreviewPages } from './docxPreviewParser';
import {
  buildCombinedBphtbDocxBytes,
  buildInitialBphtbFormData,
} from './bphtbSubmissionGenerator';
import { calculateLandTaxes, isAktaService } from './taxAndAudit';
import {
  filterNonAktaRecords,
  filterRecordsByMonthYear,
  summarizeNonAktaStats,
} from './reportGenerator';

test('generateBundleFiles renders 2 unified .docx documents: A4 Akta PPATS and F4 Lampiran Bundel Akta', async () => {
  const sample = {
    ...INITIAL_SEED_RECORDS[0],
    tanah: {
      ...INITIAL_SEED_RECORDS[0].tanah,
      provinsi: 'Jawa Tengah',
      batas_utara: 'Jalan Desa',
      batas_timur: 'Tanah Sdr. Suparjo',
      batas_selatan: 'Tanah Sdr. Wito',
      batas_barat: 'Selokan Irigasi',
      penggunaan_tanah: 'Pekarangan',
      menguasai_sejak_tahun: '2009',
    },
    akta: {
      ...INITIAL_SEED_RECORDS[0].akta,
      nomor_pengantar: '01/XI/2026',
    },
  };
  const files = await generateBundleFiles(sample, DEFAULT_OFFICE_SETTINGS, {});

  assert.equal(files.length, 2);
  assert.deepEqual(
    files.map((f) => f.fileName),
    ['01_Akta_PPATS.docx', '02_Lampiran_Bundel_Akta.docx']
  );

  // 1. Verify Akta PPATS uses A4 paper size, exact margins, 12pt font, 1.5 spacing, and footer
  const aktaZip = new PizZip(files[0].bytes);
  const aktaXml = aktaZip.file('word/document.xml')?.asText() ?? '';
  const aktaStylesXml = aktaZip.file('word/styles.xml')?.asText() ?? '';
  assert.ok(
    aktaXml.includes(`w:w="${PAPER_SIZE_A4_TWIPS.width}"`) &&
      aktaXml.includes(`w:h="${PAPER_SIZE_A4_TWIPS.height}"`),
    '01_Akta_PPATS.docx must use A4 paper size (11906 x 16838 twips)'
  );
  assert.ok(
    aktaXml.includes('w:top="1440"') &&
      aktaXml.includes('w:bottom="1440"') &&
      aktaXml.includes('w:left="2551"') &&
      aktaXml.includes('w:right="567"') &&
      aktaXml.includes('w:header="0"') &&
      aktaXml.includes('w:footer="1134"'),
    '01_Akta_PPATS.docx must match Page Setup margins (2.54cm top/bottom, 4.5cm left, 1cm right, 0cm header, 2cm footer)'
  );
  assert.ok(
    aktaStylesXml.includes('w:val="24"') &&
      aktaStylesXml.includes('w:line="360"') &&
      aktaStylesXml.includes('w:jc w:val="both"'),
    'Document default style must specify 12pt font (sz 24), 1.5 line spacing (360), and justified alignment'
  );
  assert.ok(aktaXml.includes('AKTA JUAL BELI'));
  assert.ok(aktaXml.includes('001/PPATS/XI/2026'));
  assert.ok(aktaXml.includes('Slamet Raharjo'));
  assert.ok(aktaXml.includes('Dimas Prasetyo'));
  assert.ok(aktaXml.includes('Sri Wahyuni'));
  assert.ok(aktaXml.includes('Jalan Desa'));
  assert.ok(aktaXml.includes('Pasal 1'));
  assert.ok(aktaXml.includes('Pasal 6'));
  assert.ok(!aktaXml.includes('{{') && !aktaXml.includes('}}'), 'Akta must not have leftover template tags');

  const footerEntries = Object.keys(aktaZip.files).filter((k) => k.startsWith('word/footer'));
  assert.ok(footerEntries.length > 0, '01_Akta_PPATS.docx should include a page footer');
  const footerXml = aktaZip.file(footerEntries[0])?.asText() ?? '';
  assert.ok(footerXml.includes('AKTA JUAL BELI'), 'Footer should display judul akta');
  assert.ok(footerXml.includes('Daerah Kerja : Kecamatan Bergas.'), 'Footer should display Daerah Kerja');
  assert.ok(footerXml.includes('Halaman'), 'Footer should display Halaman X dari Y halaman');
  assert.ok(footerXml.includes('<w:top w:val="single"'), 'Footer must include a top border line above footer');

  // Verify AJB-specific phrasing and Pasal 1-6
  assert.ok(aktaXml.includes('Obyek Jual Beli'));
  assert.ok(aktaXml.includes('kwitansi'));
  assert.ok(!aktaXml.includes('Obyek Hibah'), 'AJB must not include Hibah clauses');
  assert.ok(!aktaXml.includes('Hak Bersama'), 'AJB must not include APHB clauses');

  // 2. Verify unified Lampiran Bundel Akta (02_Lampiran_Bundel_Akta.docx) uses F4, LAMPIRAN_MARGINS, vMerge, all 8 sections, and zero leftover tags
  const lampiranXml = new PizZip(files[1].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(
    lampiranXml.includes(`w:w="${PAPER_SIZE_F4_TWIPS.width}"`) &&
      lampiranXml.includes(`w:h="${PAPER_SIZE_F4_TWIPS.height}"`),
    '02_Lampiran_Bundel_Akta.docx must use F4 paper size (12190 x 18709 twips)'
  );
  assert.ok(
    lampiranXml.includes(`w:top="${LAMPIRAN_MARGINS.top}"`) &&
      lampiranXml.includes(`w:bottom="${LAMPIRAN_MARGINS.bottom}"`) &&
      lampiranXml.includes(`w:left="${LAMPIRAN_MARGINS.left}"`) &&
      lampiranXml.includes(`w:right="${LAMPIRAN_MARGINS.right}"`),
    '02_Lampiran_Bundel_Akta.docx must use symmetric LAMPIRAN_MARGINS (2.2cm top, 2.0cm bottom, 2.54cm L/R)'
  );
  assert.ok(lampiranXml.includes('w:vMerge'), 'Page 1 Surat Pengantar checklist table must use vertical merge for Keterangan');
  assert.ok(lampiranXml.includes('Dokumen yang diserahkan'));
  assert.ok(lampiranXml.includes('Penjual:'));
  assert.ok(lampiranXml.includes('Pembeli:'));
  assert.ok(lampiranXml.includes('Pendaftaran Peralihan Hak'));
  assert.ok(lampiranXml.includes('SURAT KUASA'));
  assert.ok(lampiranXml.includes('kekurangan pembayaran BPHTB'));
  assert.ok(lampiranXml.includes('SURAT PERNYATAAN PENGUASAAN FISIK TANAH DAN TIDAK SENGKETA'));
  assert.ok(lampiranXml.includes('Masih atas nama pemilik lama'));
  assert.ok(lampiranXml.includes('SURAT PERTANGGUNGJAWABAN KEABSAHAN DAN'));
  assert.ok(lampiranXml.includes('SURAT PERNYATAAN PERSETUJUAN PEMROSESAN DATA PRIBADI'));
  assert.ok(!lampiranXml.includes('{{') && !lampiranXml.includes('}}'), 'Lampiran must not have leftover template tags');
});

test('renderDocxWithTemplate preserves template structure for custom office templates', async () => {
  const rawTemplate = await generateDefaultDocxBuffer('02_lampiran_bundel');
  const context = buildTemplateContext(INITIAL_SEED_RECORDS[1], DEFAULT_OFFICE_SETTINGS);
  const rendered = renderDocxWithTemplate(rawTemplate, context);
  const zip = new PizZip(rendered);
  const xml = zip.file('word/document.xml')?.asText() ?? '';
  assert.ok(xml.includes('002/PPATS/XI/2026'));
  assert.ok(xml.includes('Kartini Mulyani'));
  assert.ok(xml.includes('Rizky Ramadhan'));
});

test('generateBundleFiles supports Pihak III and Pihak IV in Akta PPATS', async () => {
  const multiPartyRecord = {
    ...INITIAL_SEED_RECORDS[0],
    para_pihak: [
      ...INITIAL_SEED_RECORDS[0].para_pihak,
      {
        id: 'p-3',
        peran: 'Pihak III' as const,
        nik: '3322110101800008',
        nama: 'Bambang Sutrisno',
        tempat_lahir: 'Boyolali',
        tanggal_lahir: '1980-01-01',
        jenis_kelamin: 'Laki-laki',
        alamat_jalan: 'Dusun Kismoyoso',
        rt_rw: '003/002',
        desa_kelurahan: 'Kismoyoso',
        kecamatan: 'Ngemplak',
        kabupaten: 'Kabupaten Boyolali',
        pekerjaan: 'Wiraswasta',
        status_perkawinan: 'KAWIN',
      },
      {
        id: 'p-4',
        peran: 'Pihak IV' as const,
        nik: '3322114505830009',
        nama: 'Siti Rahmawati',
        tempat_lahir: 'Boyolali',
        tanggal_lahir: '1983-05-05',
        jenis_kelamin: 'Perempuan',
        alamat_jalan: 'Dusun Kismoyoso',
        rt_rw: '003/002',
        desa_kelurahan: 'Kismoyoso',
        kecamatan: 'Ngemplak',
        kabupaten: 'Kabupaten Boyolali',
        pekerjaan: 'Guru',
        status_perkawinan: 'KAWIN',
      },
    ],
  };

  const files = await generateBundleFiles(multiPartyRecord, DEFAULT_OFFICE_SETTINGS, {});
  const aktaXml = new PizZip(files[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(aktaXml.includes('Bambang Sutrisno'));
  assert.ok(aktaXml.includes('PIHAK KETIGA'));
  assert.ok(aktaXml.includes('Siti Rahmawati'));
  assert.ok(aktaXml.includes('PIHAK KEEMPAT'));
  assert.ok(!aktaXml.includes('{{') && !aktaXml.includes('}}'));
});

test('APHB renders 3-party layout, uses Pemberi/Penerima Hak on Lampiran Page 1, PURWANTI as penerima signer, AGUS TRIYONO on SPPT/PBB, and all 3 on Data Pribadi', async () => {
  const aphbRecord = {
    ...INITIAL_SEED_RECORDS[1],
    layanan: 'APHB' as const,
    para_pihak: [
      {
        ...INITIAL_SEED_RECORDS[1].para_pihak[0],
        peran: 'Pihak I' as const,
        nama: 'AGUS TRIYONO',
      },
      {
        ...INITIAL_SEED_RECORDS[1].para_pihak[1],
        peran: 'Pihak II' as const,
        nama: 'LESTTORINI',
      },
      {
        ...INITIAL_SEED_RECORDS[1].para_pihak[1],
        id: 'p-purwanti',
        peran: 'Pihak III' as const,
        nama: 'PURWANTI',
      },
    ],
    tanah: {
      ...INITIAL_SEED_RECORDS[1].tanah,
      nib: '11.17.000028430.0',
      desa: 'Sindon',
      status_tanah: 'Non-Pertanian' as const,
    },
    akta: {
      ...INITIAL_SEED_RECORDS[1].akta,
      butuh_persetujuan_pasangan: false,
      keterangan_tanpa_persetujuan:
        'Menurut keterangan para pihak, dalam melakukan perbuatan hukum ini tanpa memerlukan persetujuan dari siapapun, dikarenakan tanah tersebut berasal dari Warisan.',
      pihak_penerima_aphb: 'Pihak III',
      saksi_1: 'SALIMIN',
      saksi_1_detail: {
        nama: 'SALIMIN',
        tempat_lahir: 'Boyolali',
        tanggal_lahir: '1973-07-03',
        pekerjaan: 'Perangkat Desa',
        nik: '3309110307730005',
        alamat_jalan: 'Gunungan',
        rt: '005',
        rw: '008',
        desa_kelurahan: 'Giriroto',
        kecamatan: 'Ngemplak',
        kabupaten: 'Kabupaten Boyolali',
      },
      saksi_2: 'ADIP NORMAN FATKURI',
      saksi_2_detail: {
        nama: 'ADIP NORMAN FATKURI',
        tempat_lahir: 'Boyolali',
        tanggal_lahir: '1991-11-24',
        pekerjaan: 'Wiraswasta',
        nik: '3309112411910004',
        alamat_jalan: 'Dukuhrejo',
        rt: '001',
        rw: '002',
        desa_kelurahan: 'Donohudan',
        kecamatan: 'Ngemplak',
        kabupaten: 'Kabupaten Boyolali',
      },
      nama_kuasa_bpn: 'SUWARDJO',
      kuasa_bpn_detail: {
        nama: 'SUWARDJO',
        tempat_lahir: 'Boyolali',
        tanggal_lahir: '1957-11-10',
        pekerjaan: 'PENSIUNAN',
        nik: '3309111011570003',
        alamat_jalan: 'Dukuhrejo',
        rt: '01',
        rw: '02',
        desa_kelurahan: 'Donohudan',
        kecamatan: 'Ngemplak',
        kabupaten: 'Kabupaten Boyolali',
      },
    },
  };

  const files = await generateBundleFiles(aphbRecord, DEFAULT_OFFICE_SETTINGS, {});
  const aktaXml = new PizZip(files[0].bytes).file('word/document.xml')?.asText() ?? '';
  const lampiranXml = new PizZip(files[1].bytes).file('word/document.xml')?.asText() ?? '';

  // Akta APHB clauses
  assert.ok(aktaXml.includes('Hak Bersama'));
  assert.ok(aktaXml.includes('Pihak ketiga atas nama PURWANTI'));
  assert.ok(aktaXml.includes('tidak terdapat kelebihan nilai'));
  assert.ok(!aktaXml.includes('Obyek Jual Beli'));
  assert.ok(aktaXml.includes('tanpa memerlukan persetujuan dari siapapun, dikarenakan tanah tersebut berasal dari Warisan.'));
  assert.ok(!aktaXml.includes('Disetujui Pasangan'));
  assert.ok(aktaXml.includes('Pihak Pertama'));
  assert.ok(aktaXml.includes('Pihak Kedua'));
  assert.ok(aktaXml.includes('Pihak Ketiga'));
  assert.ok(aktaXml.includes('AGUS TRIYONO'));
  assert.ok(aktaXml.includes('LESTTORINI'));
  assert.ok(aktaXml.includes('PURWANTI'));
  assert.ok(aktaXml.includes('SALIMIN'));
  assert.ok(aktaXml.includes('lahir di Boyolali, tanggal 03-07-1973'));
  assert.ok(aktaXml.includes('Rukun Tetangga (RT) 005 Rukun Warga (RW) 008, Desa Giriroto, Kecamatan Ngemplak, Kabupaten Boyolali'));
  assert.ok(aktaXml.includes('3309110307730005'));

  // Unified Lampiran Bundel APHB rules:
  // Page 1 Keterangan uses Pemberi Hak & Penerima Hak (NOT Penjual/Pembeli)
  assert.ok(lampiranXml.includes('Pemberi Hak:'));
  assert.ok(lampiranXml.includes('Penerima Hak:'));
  assert.ok(!lampiranXml.includes('Penjual:'), 'APHB Lampiran must not say Penjual');
  assert.ok(!lampiranXml.includes('Pembeli:'), 'APHB Lampiran must not say Pembeli');

  // Kuasa BPN & Penerima (PURWANTI) across Permohonan, Kuasa, BPHTB, Fisik, Keabsahan
  assert.ok(lampiranXml.includes('SUWARDJO'));
  assert.ok(lampiranXml.includes('Boyolali, 10-11-1957'));
  assert.ok(lampiranXml.includes('PENSIUNAN'));
  assert.ok(lampiranXml.includes('3309111011570003'));
  assert.ok(lampiranXml.includes('Dukuhrejo Rt.01/02, Ds. Donohudan, Ngemplak, Boyolali'));
  assert.ok(lampiranXml.includes('SUWARDJO, qq. PURWANTI'));
  assert.ok(lampiranXml.includes('Menerima Pembagian Hak Bersama atas'));

  // Slice check: Kuasa, BPHTB, Fisik, Keabsahan use PURWANTI; SPPT/PBB uses AGUS TRIYONO; Data Pribadi has all 3
  const kuasaIdx = lampiranXml.indexOf('SURAT KUASA');
  const bphtbIdx = lampiranXml.indexOf('kekurangan pembayaran BPHTB');
  const fisikIdx = lampiranXml.indexOf('SURAT PERNYATAAN PENGUASAAN FISIK TANAH DAN TIDAK SENGKETA');
  const spptIdx = lampiranXml.indexOf('Masih atas nama pemilik lama');
  const keabsahanIdx = lampiranXml.indexOf('SURAT PERTANGGUNGJAWABAN KEABSAHAN DAN');
  const dataPribadiIdx = lampiranXml.indexOf('SURAT PERNYATAAN PERSETUJUAN PEMROSESAN DATA PRIBADI');

  const kuasaSlice = lampiranXml.slice(kuasaIdx, bphtbIdx);
  const spptSlice = lampiranXml.slice(spptIdx - 1200, keabsahanIdx);
  const keabsahanSlice = lampiranXml.slice(keabsahanIdx, dataPribadiIdx);
  const dataPribadiSlice = lampiranXml.slice(dataPribadiIdx);

  assert.ok(kuasaSlice.includes('PURWANTI') && !kuasaSlice.includes('AGUS TRIYONO'), 'Surat Kuasa Pemberi Kuasa must be PURWANTI (penerima)');
  assert.ok(spptSlice.includes('AGUS TRIYONO') && !spptSlice.includes('PURWANTI'), 'SPPT/PBB signer must be pemilik awal (AGUS TRIYONO)');
  assert.ok(keabsahanSlice.includes('PURWANTI'), 'Keabsahan Dokumen signer must be PURWANTI (penerima)');
  assert.ok(!keabsahanSlice.includes('Saksi – saksi'), 'Keabsahan Dokumen must NOT include Saksi – saksi');

  assert.ok(dataPribadiSlice.includes('1. AGUS TRIYONO'));
  assert.ok(dataPribadiSlice.includes('2. LESTTORINI'));
  assert.ok(dataPribadiSlice.includes('3. PURWANTI'));
  assert.ok(dataPribadiSlice.includes('Saksi – saksi :'), 'Pemrosesan Data Pribadi must include Saksi – saksi');
  assert.ok(lampiranXml.slice(fisikIdx, spptIdx).includes('Saksi – saksi :'), 'Penguasaan Fisik must include Saksi – saksi');

  assert.ok(!aktaXml.includes('{{') && !aktaXml.includes('}}'));
  assert.ok(!lampiranXml.includes('{{') && !lampiranXml.includes('}}'));
});

test('Akta Hibah renders 7-8 Pasals on Akta and Pemberi Hibah / Penerima Hibah on Lampiran Bundel', async () => {
  const hibahPertanianRecord = {
    ...INITIAL_SEED_RECORDS[2],
    layanan: 'Akta Hibah' as const,
    tanah: {
      ...INITIAL_SEED_RECORDS[2].tanah,
      penggunaan_tanah: 'Tanah Pertanian',
      status_tanah: 'Pertanian' as const,
      tanggal_pernyataan_pertanian: '2026-11-19',
    },
  };

  const files = await generateBundleFiles(hibahPertanianRecord, DEFAULT_OFFICE_SETTINGS, {});
  const aktaXml = new PizZip(files[0].bytes).file('word/document.xml')?.asText() ?? '';
  const lampiranXml = new PizZip(files[1].bytes).file('word/document.xml')?.asText() ?? '';

  assert.ok(aktaXml.includes('Obyek Hibah'));
  assert.ok(aktaXml.includes('Selaku Pemberi Hibah'));
  assert.ok(aktaXml.includes('Selaku Penerima Hibah'));
  assert.ok(aktaXml.includes('menghibahkan kepada Pihak Kedua'));
  assert.ok(aktaXml.includes('tidak melanggar ketentuan maksimum penguasaan tanah'));
  assert.ok(aktaXml.includes('19 November 2026'));
  assert.ok(aktaXml.includes('Pasal 3'));
  assert.ok(aktaXml.includes('Pasal 7'));
  assert.ok(aktaXml.includes('Pasal 8'));

  assert.ok(lampiranXml.includes('Pemberi Hibah:'));
  assert.ok(lampiranXml.includes('Penerima Hibah:'));
  assert.ok(lampiranXml.includes('Menerima Hibah'));
  assert.ok(!lampiranXml.includes('Penjual:'));
  assert.ok(!aktaXml.includes('{{') && !aktaXml.includes('}}'));
  assert.ok(!lampiranXml.includes('{{') && !lampiranXml.includes('}}'));
});

test('AJB with 4 co-owners + Persetujuan Pasangan lists all 4 as Penjual on Lampiran Page 1, buyer PARMIN on Permohonan..Keabsahan, excludes spouse from Data Pribadi, and enforces Saksi rules', async () => {
  const baseParty = INITIAL_SEED_RECORDS[0].para_pihak[0];
  const multiOwnerAjb = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'AJB' as const,
    para_pihak: [
      { ...baseParty, id: 'a1', peran: 'Pihak I' as const, nama: 'WAHYUDI' },
      { ...baseParty, id: 'a2', peran: 'Pihak I' as const, nama: 'SUWARSI', jenis_kelamin: 'Perempuan' },
      { ...baseParty, id: 'a3', peran: 'Pihak I' as const, nama: 'MULYANI', jenis_kelamin: 'Perempuan' },
      { ...baseParty, id: 'a4', peran: 'Pihak I' as const, nama: 'MUJATI', jenis_kelamin: 'Perempuan' },
      { ...baseParty, id: 's1', peran: 'Persetujuan Pasangan' as const, nama: 'SITI PASANGAN SAKSI' },
      { ...baseParty, id: 'b1', peran: 'Pihak II' as const, nama: 'PARMIN' },
    ],
    akta: {
      ...INITIAL_SEED_RECORDS[0].akta,
      butuh_persetujuan_pasangan: true,
    },
  };

  const files = await generateBundleFiles(multiOwnerAjb, DEFAULT_OFFICE_SETTINGS, {});
  const aktaXml = new PizZip(files[0].bytes).file('word/document.xml')?.asText() ?? '';
  const lampiranXml = new PizZip(files[1].bytes).file('word/document.xml')?.asText() ?? '';

  assert.ok(aktaXml.includes('Selaku Penjual'));
  assert.ok(aktaXml.includes('Selaku Pembeli'));
  assert.ok(aktaXml.includes('menjual kepada Pihak Kedua'));
  assert.ok(aktaXml.includes('1. WAHYUDI'));
  assert.ok(aktaXml.includes('2. SUWARSI'));
  assert.ok(aktaXml.includes('3. MULYANI'));
  assert.ok(aktaXml.includes('4. MUJATI'));

  const p1Idx = aktaXml.indexOf('PIHAK PERTAMA');
  const consentIdx = aktaXml.indexOf('SITI PASANGAN SAKSI');
  const p2Idx = aktaXml.indexOf('PIHAK KEDUA');
  assert.ok(p1Idx > 0 && consentIdx > p1Idx && p2Idx > consentIdx, 'Consent text must sit between PIHAK PERTAMA and PIHAK KEDUA in AJB');
  assert.ok(!aktaXml.includes('PIHAK KETIGA'), 'AJB must not create PIHAK KETIGA');

  // Lampiran Page 1 Keterangan lists all 4 Penjual + 1 Pembeli
  const permohonanIdx = lampiranXml.indexOf('Kantor Kementrian Agraria');
  const page1Slice = lampiranXml.slice(0, permohonanIdx);
  assert.ok(page1Slice.includes('Penjual:'));
  assert.ok(page1Slice.includes('WAHYUDI'));
  assert.ok(page1Slice.includes('SUWARSI'));
  assert.ok(page1Slice.includes('MULYANI'));
  assert.ok(page1Slice.includes('MUJATI'));
  assert.ok(page1Slice.includes('Pembeli:'));
  assert.ok(page1Slice.includes('PARMIN'));

  // Pemrosesan Data Pribadi signed by all 5 parties (4 sellers + 1 buyer), EXCLUDING Persetujuan Pasangan
  const keabsahanIdx = lampiranXml.indexOf('SURAT PERTANGGUNGJAWABAN KEABSAHAN DAN');
  const dataPribadiIdx = lampiranXml.indexOf('SURAT PERNYATAAN PERSETUJUAN PEMROSESAN DATA PRIBADI');
  const keabsahanSlice = lampiranXml.slice(keabsahanIdx, dataPribadiIdx);
  const dataPribadiSlice = lampiranXml.slice(dataPribadiIdx);

  assert.ok(keabsahanSlice.includes('PARMIN'));
  assert.ok(!keabsahanSlice.includes('Saksi – saksi'), 'Keabsahan dan Kebenaran Dokumen must NOT have Saksi – saksi');

  assert.ok(dataPribadiSlice.includes('1. WAHYUDI'));
  assert.ok(dataPribadiSlice.includes('2. SUWARSI'));
  assert.ok(dataPribadiSlice.includes('3. MULYANI'));
  assert.ok(dataPribadiSlice.includes('4. MUJATI'));
  assert.ok(dataPribadiSlice.includes('5. PARMIN'));
  assert.ok(!dataPribadiSlice.includes('SITI PASANGAN SAKSI'), 'Persetujuan Pasangan must NOT appear in Pemrosesan Data Pribadi');
  assert.ok(dataPribadiSlice.includes('Saksi – saksi :'), 'Pemrosesan Data Pribadi must include Saksi – saksi');

  // Count total occurrences of Saksi – saksi in Lampiran: exactly 4 (Hal 4 BPHTB, Hal 5 Fisik, Hal 6 SPPT/PBB, Hal 9 Data Pribadi)
  const saksiMatches = lampiranXml.match(/Saksi – saksi :/g) ?? [];
  assert.equal(saksiMatches.length, 4, 'Lampiran Bundel must have Saksi – saksi on all 4 Surat Pernyataan pages and NOT on Keabsahan Dokumen');

  assert.ok(!aktaXml.includes('{{') && !aktaXml.includes('}}'));
  assert.ok(!lampiranXml.includes('{{') && !lampiranXml.includes('}}'));
});

test('APHB supports up to 20 separated parties (Pihak I..XX), puts tanpa persetujuan AFTER last party, and renders 3-column signature grid', async () => {
  const baseParty = INITIAL_SEED_RECORDS[1].para_pihak[0];
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
  const twentyParties = romans.map((rom, idx) => ({
    ...baseParty,
    id: `aphb-${idx + 1}`,
    peran: `Pihak ${rom}` as const,
    nik: `330911010180${String(idx + 1).padStart(4, '0')}`,
    nama: `PEMILIK ${rom}`,
  }));

  const aphb20 = {
    ...INITIAL_SEED_RECORDS[1],
    layanan: 'APHB' as const,
    para_pihak: twentyParties,
    akta: {
      ...INITIAL_SEED_RECORDS[1].akta,
      butuh_persetujuan_pasangan: false,
      keterangan_tanpa_persetujuan:
        'Menurut keterangan para pihak, dalam melakukan perbuatan hukum ini tanpa memerlukan persetujuan dari siapapun, dikarenakan tanah tersebut berasal dari Warisan.',
      pihak_penerima_aphb: 'Pihak XX',
    },
  };

  const files = await generateBundleFiles(aphb20, DEFAULT_OFFICE_SETTINGS, {});
  const aktaXml = new PizZip(files[0].bytes).file('word/document.xml')?.asText() ?? '';
  const lampiranXml = new PizZip(files[1].bytes).file('word/document.xml')?.asText() ?? '';

  assert.ok(aktaXml.includes('PIHAK PERTAMA'));
  assert.ok(aktaXml.includes('PIHAK KEEMPAT'));
  assert.ok(aktaXml.includes('PIHAK KEDUA PULUH'));
  assert.ok(aktaXml.includes('PEMILIK XX'));
  assert.ok(aktaXml.includes('Pihak kedua puluh atas nama PEMILIK XX'));
  assert.ok(aktaXml.includes('Pihak Kedua Puluh'));

  const lastPartyIdx = aktaXml.indexOf('PIHAK KEDUA PULUH');
  const consentIdx = aktaXml.indexOf('tanpa memerlukan persetujuan dari siapapun');
  assert.ok(lastPartyIdx > 0 && consentIdx > lastPartyIdx, 'APHB consent/no-consent text must appear AFTER the last party (PIHAK KEDUA PULUH)');
  assert.ok(lampiranXml.includes('20. PEMILIK XX'), 'Pemrosesan Data Pribadi must list all 20 parties');
  assert.ok(!aktaXml.includes('{{') && !aktaXml.includes('}}'));
  assert.ok(!lampiranXml.includes('{{') && !lampiranXml.includes('}}'));
});

test('renderDocxPreviewPages parses A4 Akta and F4 Lampiran Bundel accurately with page sections and vertical table merge', async () => {
  const aktaPreview = await renderDocxPreviewPages(
    INITIAL_SEED_RECORDS[0],
    DEFAULT_OFFICE_SETTINGS,
    {},
    '01_akta'
  );
  assert.equal(aktaPreview.paperSize, 'A4');
  assert.equal(aktaPreview.pages.length, 2);
  assert.equal(aktaPreview.pages[0].title, 'Hal. 1 · Naskah Akta PPATS');
  assert.ok(aktaPreview.pages[1].title.includes('Halaman Tanda Tangan'));
  assert.ok(aktaPreview.footerLines.length >= 2);
  assert.equal(aktaPreview.summary.leftoverTags.length, 0);
  assert.equal(aktaPreview.summary.ketPihak1Label, 'Penjual');
  assert.equal(aktaPreview.summary.ketPihak2Label, 'Pembeli');

  const lampiranPreview = await renderDocxPreviewPages(
    INITIAL_SEED_RECORDS[0],
    DEFAULT_OFFICE_SETTINGS,
    {},
    '02_lampiran_bundel'
  );
  assert.equal(lampiranPreview.paperSize, 'F4');
  assert.equal(lampiranPreview.pages.length, 8);
  assert.equal(lampiranPreview.pages[0].title, 'Hal. 1 · Surat Pengantar ATR/BPN');
  assert.equal(lampiranPreview.pages[1].title, 'Hal. 2 · Permohonan ATR/BPN');
  assert.equal(lampiranPreview.pages[6].title, 'Hal. 7 · Keabsahan & Kebenaran Dokumen');
  assert.equal(lampiranPreview.pages[7].title, 'Hal. 8 · Persetujuan Pemrosesan Data Pribadi');
  assert.equal(lampiranPreview.summary.leftoverTags.length, 0);

  // Page 1 checklist table must merge Keterangan column vertically (rowSpan === 13)
  const checklistTable = lampiranPreview.pages[0].blocks.find((b) => b.kind === 'table' && b.rows.length === 14);
  assert.ok(checklistTable && checklistTable.kind === 'table', 'Checklist table with 14 rows must be parsed on Page 1');
  const firstItemKeterangan = checklistTable.rows[1].cells[3];
  assert.equal(firstItemKeterangan.rowSpan, 13, 'Keterangan cell must span all 13 checklist document rows');
  assert.equal(checklistTable.rows[2].cells[3].hidden, true, 'Merged continuation cells must be marked hidden');
});

test('Kop Akta uses 16pt for PEJABAT/PPATS/Jabatan and 14pt underlined for nama_ppats', async () => {
  const settings = {
    ...DEFAULT_OFFICE_SETTINGS,
    nama_ppats: 'MUCHSONI, S.Sos',
    jabatan_ppats: 'Camat Ngemplak',
  };
  const record = {
    ...INITIAL_SEED_RECORDS[0],
    akta: {
      ...INITIAL_SEED_RECORDS[0].akta,
      nama_ppats: 'MUCHSONI, S.Sos',
      jabatan_ppats: 'Camat Ngemplak',
    },
  };
  const files = await generateBundleFiles(record, settings, {});
  const aktaXml = new PizZip(files[0].bytes).file('word/document.xml')?.asText() ?? '';

  // Check XML font sizes: 16pt = w:val="32", 14pt = w:val="28"
  for (const heading of ['PEJABAT PEMBUAT AKTA TANAH SEMENTARA', '(PPATS)', 'CAMAT NGEMPLAK']) {
    const idx = aktaXml.indexOf(heading);
    assert.ok(idx > 0, `${heading} must appear in Kop Akta`);
    const pSlice = aktaXml.slice(Math.max(0, idx - 320), idx + heading.length + 30);
    assert.ok(pSlice.includes('w:val="32"'), `${heading} must use 16pt (w:sz w:val="32")`);
  }

  const namaIdx = aktaXml.indexOf('MUCHSONI, S.Sos');
  assert.ok(namaIdx > 0, 'Nama PPATS must appear in Kop Akta');
  const namaSlice = aktaXml.slice(Math.max(0, namaIdx - 320), namaIdx + 40);
  assert.ok(namaSlice.includes('w:val="28"'), 'Nama PPATS in Kop Akta must use 14pt (w:sz w:val="28")');
  assert.ok(namaSlice.includes('<w:u '), 'Nama PPATS in Kop Akta must be underlined');

  // Verify docxPreviewParser captures 16pt and 14pt sizePt on Kop paragraphs
  const preview = await renderDocxPreviewPages(record, settings, {}, '01_akta');
  const firstPara = preview.pages[0].blocks[0];
  assert.equal(firstPara.kind, 'paragraph');
  if (firstPara.kind === 'paragraph') {
    assert.equal(firstPara.runs[0].sizePt, 16);
  }
  const fourthPara = preview.pages[0].blocks[3];
  assert.equal(fourthPara.kind, 'paragraph');
  if (fourthPara.kind === 'paragraph') {
    assert.equal(fourthPara.runs[0].sizePt, 14);
    assert.equal(fourthPara.runs[0].underline, true);
  }
});

test('Digital vs Analog certificate modes format Akta object clause, Alat Bukti, and Lampiran accurately', async () => {
  const digitalRecord = {
    ...INITIAL_SEED_RECORDS[0],
    tanah: {
      ...INITIAL_SEED_RECORDS[0].tanah,
      jenis_sertipikat: 'digital' as const,
      jenis_hak: 'Hak Milik',
      nib: '11.17.000023383.0',
      nomor_hak_lama: '9999-SHOULD-NOT-APPEAR',
      surat_ukur_tanggal: '01/01/2020',
      surat_ukur_nomor: '0001/SHOULD-NOT-APPEAR',
      luas_m2: 300,
      desa: 'Sindon',
      kecamatan: 'Ngemplak',
      kabupaten: 'Kabupaten Boyolali',
    },
  };
  const digitalFiles = await generateBundleFiles(digitalRecord, DEFAULT_OFFICE_SETTINGS, {});
  const digitalAktaXml = new PizZip(digitalFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  const digitalLampXml = new PizZip(digitalFiles[1].bytes).file('word/document.xml')?.asText() ?? '';

  assert.ok(
    digitalAktaXml.includes('Hak Milik Nibel : 11.17.000023383.0/Desa Sindon, Kecamatan Ngemplak, Kabupaten Boyolali atas sebidang tanah seluas : 300 M2'),
    'Digital Akta must write only Nibel without Nomor or NIB'
  );
  assert.ok(
    digitalAktaXml.includes('1. Sertipikat Hak Milik Nibel : 11.17.000023383.0 Desa Sindon'),
    'Digital Alat Bukti #1 must write only Nibel'
  );
  assert.ok(!digitalAktaXml.includes('9999-SHOULD-NOT-APPEAR'), 'Digital Akta must omit nomor_hak_lama');
  assert.ok(!digitalAktaXml.includes('Surat Ukur'), 'Digital Akta must omit Surat Ukur');
  assert.ok(!digitalAktaXml.includes('Nomor Identifikasi Bidang tanah (NIB)'), 'Digital Akta must not write NIB label');
  assert.ok(digitalLampXml.includes('Nibel : 11.17.000023383.0'));

  const analogRecord = {
    ...INITIAL_SEED_RECORDS[0],
    tanah: {
      ...INITIAL_SEED_RECORDS[0].tanah,
      jenis_sertipikat: 'analog' as const,
      jenis_hak: 'Hak Milik',
      nomor_hak_lama: '3354',
      nib: '11.17.11.10.01450',
      surat_ukur_tanggal: '19/10/2011',
      surat_ukur_nomor: '00143/Sindon/2011',
      luas_m2: 942,
      desa: 'Sindon',
      kecamatan: 'Ngemplak',
      kabupaten: 'Kabupaten Boyolali',
    },
  };
  const analogFiles = await generateBundleFiles(analogRecord, DEFAULT_OFFICE_SETTINGS, {});
  const analogAktaXml = new PizZip(analogFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  const analogLampXml = new PizZip(analogFiles[1].bytes).file('word/document.xml')?.asText() ?? '';

  assert.ok(
    analogAktaXml.includes(
      'Hak Milik Nomor : 3354 /Desa Sindon, Kecamatan Ngemplak, Kabupaten Boyolali atas sebidang tanah sebagaimana diuraikan dalam Surat Ukur tanggal : 19/10/2011 , Nomor: 00143/Sindon/2011, seluas : 942 M2 (sembilan ratus empat puluh dua meter persegi) Dengan Nomor Identifikasi Bidang tanah (NIB) : 11.17.11.10.01450'
    ),
    'Analog Akta must include Nomor SHM, Surat Ukur tanggal & nomor, and NIB'
  );
  assert.ok(
    analogAktaXml.includes('1. Sertipikat Hak Milik Nomor : 3354 NIB : 11.17.11.10.01450 Surat Ukur Tgl. 19/10/2011 Nomor : 00143/Sindon/2011 Desa Sindon'),
    'Analog Alat Bukti #1 must include Nomor, NIB, and Surat Ukur'
  );
  assert.ok(analogLampXml.includes('Nomor : 3354 (NIB : 11.17.11.10.01450)'));
});

test('Non-Akta Turun Waris emits only 1 F4 bundle (no A4 Akta), dual pengesahan Camat+Kades on SKW, and PPATS default on other docs', async () => {
  const warisRecord = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'Turun Waris' as const,
    tanah: {
      ...INITIAL_SEED_RECORDS[0].tanah,
      desa: 'Sindon',
      kecamatan: 'Ngemplak',
      kabupaten: 'Kabupaten Boyolali',
    },
    non_akta: {
      pengesahan_mode: 'ppats' as const,
      sebutan_pewaris: 'Almarhum' as const,
      nama_pewaris: 'HADI SUWARNO',
      tanggal_meninggal: '2024-03-10',
      tempat_meninggal: 'Boyolali',
      hubungan_pasangan_pewaris: 'Istrinya' as const,
      nama_pasangan_pewaris: 'TUGINEM',
      camat_pengesahan_nama: 'MUCHSONI, S.Sos',
      camat_pengesahan_nip: '197001011998031001',
      kades_pengesahan_nama: 'SUPARNO',
    },
  };

  const files = await generateBundleFiles(warisRecord, DEFAULT_OFFICE_SETTINGS, {});
  assert.equal(files.length, 1, 'Non-Akta Turun Waris must produce ONLY 1 F4 bundle file');
  assert.equal(files[0].fileName, '02_Lampiran_Bundel_Turun_Waris.docx');

  const xml = new PizZip(files[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(xml.includes(`w:w="${PAPER_SIZE_F4_TWIPS.width}"`) && xml.includes(`w:h="${PAPER_SIZE_F4_TWIPS.height}"`));
  assert.ok(xml.includes('SURAT KETERANGAN WARISAN'));
  assert.ok(xml.includes('HADI SUWARNO'));
  assert.ok(xml.includes('TUGINEM'));
  assert.ok(xml.includes('Kepala Desa Sindon'));
  assert.ok(xml.includes('SUPARNO'));
  assert.ok(xml.includes('Camat Ngemplak'));
  assert.ok(xml.includes('SURAT KUASA'));
  assert.ok(xml.includes('PPATS / Camat Ngemplak'));
  assert.ok(!xml.includes('{{') && !xml.includes('}}'));

  const preview = await renderDocxPreviewPages(warisRecord, DEFAULT_OFFICE_SETTINGS, {}, '01_akta');
  assert.equal(preview.paperSize, 'F4', 'Non-Akta preview must always force F4');
  assert.equal(preview.summary.leftoverTags.length, 0);
  assert.ok(preview.pages.some((p) => p.title.includes('Surat Keterangan Warisan')));
});

test('Non-Akta Pemecahan and Ralat Data render custom pengesahan, bidang pecahan, and dual Camat+Kades on Beda Nama & Kronologi', async () => {
  const pemecahanRecord = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'Pemecahan' as const,
    tanah: {
      ...INITIAL_SEED_RECORDS[0].tanah,
      desa: 'Ngesrep',
      kecamatan: 'Ngemplak',
    },
    non_akta: {
      pengesahan_mode: 'manual' as const,
      pengesahan_jabatan: 'Kepala Desa Ngesrep',
      pengesahan_nama: 'BAMBANG WIJANARKO',
      pengesahan_nip: '',
      sub_permohonan_ukur: 'Pemecahan' as const,
      bidang_pecahan: [
        { id: 'b1', label: 'Bagian 1 (Induk)', luas_m2: 120 },
        { id: 'b2', label: 'Bagian 2 (Pecahan)', luas_m2: 80 },
      ],
      sertakan_pelepasan_jalan: true,
      pelepasan_jalan_luas_m2: 15,
      koordinat_gps: '-7.5194, 110.7798',
    },
  };

  const pecahFiles = await generateBundleFiles(pemecahanRecord, DEFAULT_OFFICE_SETTINGS, {});
  assert.equal(pecahFiles.length, 1);
  assert.equal(pecahFiles[0].fileName, '02_Lampiran_Bundel_Pemecahan.docx');
  const pecahXml = new PizZip(pecahFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(pecahXml.includes('BAMBANG WIJANARKO'));
  assert.ok(pecahXml.includes('Kepala Desa Ngesrep'));
  assert.ok(pecahXml.includes('Bagian 1 (Induk)'));
  assert.ok(pecahXml.includes('SURAT PERNYATAAN PELEPASAN JALAN'));
  assert.ok(pecahXml.includes('PEMASANGAN TANDA BATAS'));

  const ralatRecord = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'Ralat Data' as const,
    tanah: {
      ...INITIAL_SEED_RECORDS[0].tanah,
      desa: 'Gagaksipat',
      kecamatan: 'Ngemplak',
    },
    non_akta: {
      pengesahan_mode: 'ppats' as const,
      nama_di_sertipikat: 'SARNO',
      nama_di_ktp_kk: 'SUWARNO',
      nomor_kk: '3309110101800002',
      keperluan_ralat: 'Ralat Data Sertipikat',
      camat_pengesahan_nama: 'MUCHSONI, S.Sos',
      kades_pengesahan_nama: 'SRI HARTONO',
    },
  };

  const ralatFiles = await generateBundleFiles(ralatRecord, DEFAULT_OFFICE_SETTINGS, {});
  assert.equal(ralatFiles.length, 1);
  assert.equal(ralatFiles[0].fileName, '02_Lampiran_Bundel_Ralat_Data.docx');
  const ralatXml = new PizZip(ralatFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(ralatXml.includes('Berdasarkan surat kuasa'));
  assert.ok(ralatXml.includes('7. Pendaftaran Perubahan Hak'));
  assert.ok(ralatXml.includes('8. Pemecahan/Penggabungan Hak'));
  assert.ok(ralatXml.includes('14. RALAT DATA'));
  assert.ok(ralatXml.includes('Atas bidang tanah Hak / Tanah Negara :'));
  assert.ok(ralatXml.includes('Untuk melengkapi permohonan dimaksud'));
  assert.ok(ralatXml.includes('SK Penguasaan fisik'));
  assert.ok(ralatXml.includes('SURAT PERNYATAAN BEDA NAMA'));
  assert.ok(ralatXml.includes('SURAT KRONOLOGI RALAT DATA'));
  assert.ok(ralatXml.includes('SARNO'));
  assert.ok(ralatXml.includes('SUWARNO'));
  assert.ok(ralatXml.includes('Kepala Desa Gagaksipat'));
  assert.ok(ralatXml.includes('SRI HARTONO'));
  assert.ok(!ralatXml.includes('{{') && !ralatXml.includes('}}'));

  const ralatPreview = await renderDocxPreviewPages(ralatRecord, DEFAULT_OFFICE_SETTINGS, {}, '02_lampiran_bundel');
  assert.equal(ralatPreview.paperSize, 'F4');
  assert.ok(ralatPreview.pages[0]?.title.includes('Permohonan ATR/BPN'));
});

test('Blank file dates (tanggal_akta: "") never fall back to tanggal_masuk and DD-MM-YYYY dates format cleanly across Akta and Non-Akta', async () => {
  const blankAktaRecord = {
    ...INITIAL_SEED_RECORDS[0],
    tanggal_masuk: '04-11-2026',
    akta: {
      ...INITIAL_SEED_RECORDS[0].akta,
      tanggal_akta: '',
    },
  };

  const blankAktaFiles = await generateBundleFiles(blankAktaRecord, DEFAULT_OFFICE_SETTINGS, {});
  const aktaXml = new PizZip(blankAktaFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  const lampXml = new PizZip(blankAktaFiles[1].bytes).file('word/document.xml')?.asText() ?? '';

  assert.ok(
    !aktaXml.includes('04-11-2026') && !aktaXml.includes('4 November 2026'),
    'Blank Akta date must NOT leak tanggal_masuk into Akta DOCX'
  );
  assert.ok(
    !lampXml.includes('04-11-2026') && !lampXml.includes('4 November 2026'),
    'Blank Akta date must NOT leak tanggal_masuk into Lampiran DOCX'
  );
  assert.ok(aktaXml.includes('..........'), 'Blank Akta must render dotted placeholders');
  assert.ok(lampXml.includes('......................'), 'Blank Lampiran must render dotted date placeholders');

  const dmyAktaRecord = {
    ...INITIAL_SEED_RECORDS[0],
    tanggal_masuk: '04-11-2026',
    akta: {
      ...INITIAL_SEED_RECORDS[0].akta,
      tanggal_akta: '20-11-2026',
    },
  };
  const dmyFiles = await generateBundleFiles(dmyAktaRecord, DEFAULT_OFFICE_SETTINGS, {});
  const dmyAktaText = (new PizZip(dmyFiles[0].bytes).file('word/document.xml')?.asText() ?? '').replace(/<[^>]+>/g, '');
  const dmyLampText = (new PizZip(dmyFiles[1].bytes).file('word/document.xml')?.asText() ?? '').replace(/<[^>]+>/g, '');
  assert.ok(dmyAktaText.includes('Tanggal 20 (dua puluh) November Tahun 2026'));
  assert.ok(dmyLampText.includes('20 November 2026'));

  const blankWarisRecord = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'Turun Waris' as const,
    tanggal_masuk: '04-11-2026',
    akta: {
      ...INITIAL_SEED_RECORDS[0].akta,
      tanggal_akta: '',
    },
    non_akta: {
      pengesahan_mode: 'ppats' as const,
      sebutan_pewaris: 'Almarhum' as const,
      nama_pewaris: 'HADI SUWARNO',
      tanggal_meninggal: '',
    },
  };
  const blankWarisFiles = await generateBundleFiles(blankWarisRecord, DEFAULT_OFFICE_SETTINGS, {});
  const warisXml = new PizZip(blankWarisFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(
    !warisXml.includes('4 November 2026') && !warisXml.includes('04-11-2026'),
    'Blank Non-Akta date must NOT fall back to tanggal_masuk'
  );
  assert.ok(warisXml.includes('Tanggal ......................'));
});

test('All generated DOCX bundles prevent adjacent table auto-merge, enforce compact spacing on Permohonan/Lampiran, and provide Meterai Rp 10.000 signature clearance', async () => {
  const ajbRecord = INITIAL_SEED_RECORDS[0];
  const ajbFiles = await generateBundleFiles(ajbRecord, DEFAULT_OFFICE_SETTINGS, {});
  const aktaXml = new PizZip(ajbFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  const lampXml = new PizZip(ajbFiles[1].bytes).file('word/document.xml')?.asText() ?? '';

  // 1. Zero adjacent </w:tbl><w:tbl> merges in Akta & Lampiran Bundel Akta
  assert.ok(
    !/<\/w:tbl>\s*<w:tbl[\s>]/.test(aktaXml),
    'Akta DOCX must not contain adjacent </w:tbl><w:tbl> elements'
  );
  assert.ok(
    !/<\/w:tbl>\s*<w:tbl[\s>]/.test(lampXml),
    'Lampiran Bundel Akta must not contain adjacent </w:tbl><w:tbl> elements (prevents Word merging Lampiran & Hormat Kami tables)'
  );

  // 2. Permohonan & Lampiran tables use compact checklist spacing (w:line="220", w:after="0"), fixed layout, and no internal borders
  const permohonanIdx = lampXml.indexOf('Dengan ini mengajukan permohonan');
  const lampiranIdx = lampXml.indexOf('Untuk melengkapi permohonan dimaksud');
  const hormatKamiIdx = lampXml.indexOf('Hormat Kami,');
  assert.ok(permohonanIdx > 0 && lampiranIdx > permohonanIdx && hormatKamiIdx > lampiranIdx);

  const permohonanSlice = lampXml.slice(permohonanIdx, lampiranIdx);
  const lampiranSlice = lampXml.slice(lampiranIdx, hormatKamiIdx);
  assert.ok(permohonanSlice.includes('w:line="220"'), 'Daftar Permohonan must use compact checklist spacing (220 twips)');
  assert.ok(!permohonanSlice.includes('w:line="360"'), 'Daftar Permohonan must not fall back to 1.5 spacing');
  assert.ok(!permohonanSlice.includes('w:line="250"'), 'Row 5 Permohonan must not use mismatched 250 spacing');
  assert.ok(permohonanSlice.includes('w:tblLayout w:type="fixed"'), 'Daftar Permohonan table must use fixed DXA layout');

  assert.ok(lampiranSlice.includes('w:line="220"'), 'Lampiran 2-col table must use compact checklist spacing (220 twips)');
  assert.ok(lampiranSlice.includes('w:tblLayout w:type="fixed"'), 'Lampiran 2-col table must use fixed DXA layout');
  assert.ok(lampiranSlice.includes('w:insideH w:val="none"'), 'Lampiran 2-col table must explicitly disable inside borders');
  assert.ok(lampiranSlice.includes('w:hanging="340"'), 'Lampiran items must use hanging indent for wrapped lines');

  // 3. Signature blocks provide ample room for Meterai Rp 10.000 (>= 1320-1440 twips)
  assert.ok(aktaXml.includes('w:after="1440"') || aktaXml.includes('w:after="1320"'), 'Akta signatures must provide Meterai clearance');
  assert.ok(lampXml.includes('w:after="1440"'), 'Lampiran Bundel signatures must provide 1440 twips Meterai clearance');
  assert.ok(lampXml.includes('w:after="1320"'), 'Lampiran Bundel PPATS signatures must provide 1320 twips clearance');
  assert.ok(!lampXml.includes('Kementrian'), 'Typo Kementrian must be corrected to Kementerian');
  assert.ok(!lampXml.includes('agar diperunakan'), 'Typo diperunakan must be corrected to dipergunakan');

  // 4. All Non-Akta bundles also have zero adjacent table merges, 1.15 Permohonan/Lampiran spacing, and 1440 Meterai space
  const nonAktaServices = ['Turun Waris', 'Pemecahan', 'Ukur Ulang', 'Ralat Data'] as const;
  for (const layanan of nonAktaServices) {
    const rec = { ...ajbRecord, layanan };
    const files = await generateBundleFiles(rec, DEFAULT_OFFICE_SETTINGS, {});
    const xml = new PizZip(files[0].bytes).file('word/document.xml')?.asText() ?? '';
    assert.ok(
      !/<\/w:tbl>\s*<w:tbl[\s>]/.test(xml),
      `Non-Akta ${layanan} must not contain adjacent </w:tbl><w:tbl> elements`
    );
    assert.ok(xml.includes('w:line="276"'), `Non-Akta ${layanan} must use 1.15 spacing`);
    assert.ok(xml.includes('w:after="1440"'), `Non-Akta ${layanan} must include 1440 twips Meterai clearance`);
  }

  // 5. BPHTB Combined DOCX (AJB + Hibah) must have zero adjacent table merges & enlarged Meterai zones
  for (const layanan of ['AJB', 'Akta Hibah'] as const) {
    const rec = { ...ajbRecord, layanan };
    const taxForm = {
      layanan,
      luas_m2: rec.tanah.luas_m2,
      njop_bumi_m2: rec.pbb.njop_bumi_m2,
      njop_bangunan: rec.pbb.njop_bangunan,
      harga_per_m2: 0,
      nilai_transaksi_override: 250_000_000,
      npoptkp: 80_000_000,
    };
    const taxResult = calculateLandTaxes(taxForm);
    const bphtbForm = buildInitialBphtbFormData(DEFAULT_OFFICE_SETTINGS, rec);
    const bphtbResult = await buildCombinedBphtbDocxBytes({
      taxForm,
      taxResult,
      form: bphtbForm,
      settings: DEFAULT_OFFICE_SETTINGS,
    });
    const bphtbXml = new PizZip(bphtbResult.bytes).file('word/document.xml')?.asText() ?? '';
    assert.ok(
      !/<\/w:tbl>\s*<w:tbl[\s>]/.test(bphtbXml),
      `BPHTB combined DOCX (${layanan}) must not contain adjacent </w:tbl><w:tbl> elements`
    );
    assert.ok(bphtbXml.includes('w:after="500"') && bphtbXml.includes('w:after="1260"'), `BPHTB (${layanan}) Surat Kuasa must have aligned Meterai space`);
    assert.ok(bphtbXml.includes('w:after="480"'), `BPHTB (${layanan}) SPJM/Bukti Transaksi must have enlarged Meterai space`);
  }

  // 6. docxPreviewParser computes accurate DXA column percentages & preserves generous signature spacing
  const preview = await renderDocxPreviewPages(ajbRecord, DEFAULT_OFFICE_SETTINGS, {}, '02_lampiran_bundel');
  const permohonanPage = preview.pages.find((p) => p.title.includes('Permohonan ATR/BPN'));
  assert.ok(permohonanPage, 'Preview must find Hal. 2 Permohonan ATR/BPN');
  const tablesOnPage2 = permohonanPage.blocks.filter((b) => b.kind === 'table');
  assert.ok(tablesOnPage2.length >= 4, 'Hal. 2 Permohonan must parse all separate tables (not merged)');
  const lampiranTable = tablesOnPage2[tablesOnPage2.length - 2];
  assert.equal(lampiranTable.kind, 'table');
  if (lampiranTable.kind === 'table') {
    const firstRow = lampiranTable.rows[0];
    assert.equal(firstRow.cells.length, 2, 'Lampiran table must have exactly 2 columns');
    assert.ok(
      (firstRow.cells[0].widthPct ?? 0) >= 48 && (firstRow.cells[0].widthPct ?? 0) <= 54,
      `Lampiran left column widthPct should be ~51%, got ${firstRow.cells[0].widthPct}`
    );
    assert.ok(
      (firstRow.cells[1].widthPct ?? 0) >= 46 && (firstRow.cells[1].widthPct ?? 0) <= 52,
      `Lampiran right column widthPct should be ~49%, got ${firstRow.cells[1].widthPct}`
    );
  }
  const hormatTable = tablesOnPage2[tablesOnPage2.length - 1];
  if (hormatTable.kind === 'table') {
    const rightCellBlocks = hormatTable.rows[0]?.cells[1]?.blocks ?? [];
    const hormatPara = rightCellBlocks.find(
      (b) => b.kind === 'paragraph' && b.runs.some((r) => r.text.includes('Hormat Kami'))
    );
    assert.ok(hormatPara && hormatPara.kind === 'paragraph', 'Must find Hormat Kami paragraph');
    if (hormatPara && hormatPara.kind === 'paragraph') {
      assert.ok(
        hormatPara.spaceAfterPx >= 50,
        `Hormat Kami signature clearance in preview should be >= 50px, got ${hormatPara.spaceAfterPx}`
      );
    }
  }
});

test('New Non-Akta sub-bundles (Pengecekan Sertipikat, Validasi Sertipikat, Analisis Bidang, Permohonan PKKPR) match PDF layouts, remain strictly Non-Akta, and pass all XML/preview invariants', async () => {
  const base = INITIAL_SEED_RECORDS[0];
  // Minimal valid 1x1 transparent PNG data URL for verifying embedded ImageRun in Geotagging DOCX
  const tinyPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

  const newServices = [
    'Pengecekan Sertipikat',
    'Validasi Sertipikat',
    'Analisis Bidang',
    'Permohonan PKKPR',
  ] as const;

  for (const svc of newServices) {
    assert.equal(isAktaService(svc), false, `${svc} must be classified as Non-Akta`);
  }

  // 1. Pengecekan Sertipikat (PPATS mode + Kuasa BPN mode)
  const cekRecord = {
    ...base,
    id: 'cek-1',
    layanan: 'Pengecekan Sertipikat' as const,
    akta: { ...base.akta, tanggal_akta: '09-04-2026' },
    non_akta: {
      pengecekan_kuasa_mode: 'ppats' as const,
      ppats_ttl: 'Boyolali, 12-04-1978',
      ppats_nik: '3309111204780001',
      ppats_pekerjaan: 'Camat Bergas / PPATS',
      ppats_alamat: DEFAULT_OFFICE_SETTINGS.alamat_kantor,
    },
  };
  const cekFiles = await generateBundleFiles(cekRecord, DEFAULT_OFFICE_SETTINGS, {});
  assert.equal(cekFiles.length, 1);
  assert.equal(cekFiles[0].fileName, '02_Lampiran_Bundel_Pengecekan_Sertipikat.docx');
  const cekXml = new PizZip(cekFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(!/<\/w:tbl>\s*<w:tbl[\s>]/.test(cekXml), 'Pengecekan must have zero adjacent tables');
  assert.ok(cekXml.includes('13. Pengecekan Sertipikat'));
  assert.ok(cekXml.includes('14. ALIH MEDIA'));
  assert.ok(cekXml.includes('mendaftarkan Pengecekan Sertipikat ke Kantor BPN'));
  assert.ok(cekXml.includes('SURAT PERNYATAAN PERTANGGUNGJAWABAN KEABSAHAN DAN KEBENARAN DOKUMEN'));
  assert.ok(cekXml.includes('Pejabat Pembuat Akta Tanah Sementara'));
  assert.ok(cekXml.includes('w:line="276"'));
  assert.ok(cekXml.includes('w:after="1440"'));
  assert.ok(!cekXml.includes('{{') && !cekXml.includes('}}'));

  const cekPreview = await renderDocxPreviewPages(cekRecord, DEFAULT_OFFICE_SETTINGS, {}, '02_lampiran_bundel');
  assert.equal(cekPreview.pages.length, 3);
  assert.ok(cekPreview.pages[0].title.includes('Permohonan ATR/BPN'));
  assert.ok(cekPreview.pages[1].title.includes('Surat Kuasa'));
  assert.ok(cekPreview.pages[2].title.includes('Keabsahan'));

  // 2. Validasi Sertipikat (including embedded PNG photo check)
  const validasiRecord = {
    ...base,
    id: 'val-1',
    layanan: 'Validasi Sertipikat' as const,
    akta: { ...base.akta, tanggal_akta: '09-04-2026' },
    non_akta: {
      link_maps: 'https://maps.app.goo.gl/contohValidasi123',
      koordinat_gps: '-7.52341, 110.76123',
      foto_tampak_depan: tinyPngDataUrl,
    },
  };
  const validasiFiles = await generateBundleFiles(validasiRecord, DEFAULT_OFFICE_SETTINGS, {});
  assert.equal(validasiFiles.length, 1);
  assert.equal(validasiFiles[0].fileName, '02_Lampiran_Bundel_Validasi_Sertipikat.docx');
  const validasiZip = new PizZip(validasiFiles[0].bytes);
  const validasiXml = validasiZip.file('word/document.xml')?.asText() ?? '';
  const validasiMediaFiles = Object.keys(validasiZip.files).filter((k) => k.startsWith('word/media/'));
  assert.ok(validasiMediaFiles.length >= 1, 'Uploaded geotagging photo must be embedded inside word/media/');
  assert.ok(!/<\/w:tbl>\s*<w:tbl[\s>]/.test(validasiXml), 'Validasi must have zero adjacent tables');
  assert.ok(validasiXml.includes('14. Validasi/Verifikasi'));
  assert.ok(validasiXml.includes('Validasi Hak Sertipikat'));
  assert.ok(validasiXml.includes('GEOTAGGING'));
  assert.ok(validasiXml.includes('TAMPAK DEPAN'));
  assert.ok(validasiXml.includes('poligon'));
  assert.ok(validasiXml.includes('https://maps.app.goo.gl/contohValidasi123'));
  assert.ok(validasiXml.includes('w:line="276"'));
  assert.ok(validasiXml.includes('w:after="1440"'));

  const validasiPreview = await renderDocxPreviewPages(validasiRecord, DEFAULT_OFFICE_SETTINGS, {}, '02_lampiran_bundel');
  assert.equal(validasiPreview.pages.length, 4);
  assert.ok(validasiPreview.pages[0].title.includes('Permohonan ATR/BPN'));
  assert.ok(validasiPreview.pages[1].title.includes('Surat Kuasa'));
  assert.ok(validasiPreview.pages[2].title.includes('Geotagging'));
  assert.ok(validasiPreview.pages[3].title.includes('Geotagging Lanjutan'));

  // 3. Analisis Bidang (7 pages default: Permohonan Peta Analisis, Surat Kuasa, Sket Rencana Pemecahan,
  //    Surat Pernyataan Alasan Pemecahan, Pernyataan Keabsahan Lokasi, Geotagging 2 hal; +1 hal Pelepasan Jalan = 8 pages)
  const analisisRecord = {
    ...base,
    id: 'ana-1',
    layanan: 'Analisis Bidang' as const,
    akta: { ...base.akta, tanggal_akta: '09-11-2026' },
    non_akta: {
      pengesahan_mode: 'ppats' as const,
      link_maps: 'https://maps.app.goo.gl/analisisBidang',
      koordinat_gps: '-7.53010, 110.77970',
      koordinat_poligon: '-7.530057, 110.779658\n-7.530119, 110.779647\n-7.530143, 110.779764\n-7.530080, 110.779779',
      analisis_no_hp: '081234567890',
      analisis_skala_peta: '1 : 1000',
      analisis_rencana_penggunaan: 'Rumah Tinggal',
      analisis_alasan_peralihan: 'HIBAH kepada anak',
      analisis_alasan_tabel: 'dihibahkan ke anak',
      analisis_rencana_jalan_luas_m2: 40,
      pelepasan_jalan_luas_m2: 40,
      bidang_pecahan: [
        { id: 'ab1', label: 'Bidang 1', luas_m2: 130, rencana_penggunaan: 'Rumah Tinggal', alasan_pemecahan: 'dihibahkan ke anak' },
        { id: 'ab2', label: 'Bidang 2', luas_m2: 130, rencana_penggunaan: 'Rumah Tinggal', alasan_pemecahan: 'dihibahkan ke anak' },
        { id: 'ab3', label: 'Bidang 3', luas_m2: 155, rencana_penggunaan: 'Rumah Tinggal', alasan_pemecahan: 'dihibahkan ke anak' },
      ],
    },
  };
  const analisisFiles = await generateBundleFiles(analisisRecord, DEFAULT_OFFICE_SETTINGS, {});
  assert.equal(analisisFiles.length, 1);
  assert.equal(analisisFiles[0].fileName, '02_Lampiran_Bundel_Analisis_Bidang.docx');
  const analisisXml = new PizZip(analisisFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(!/<\/w:tbl>\s*<w:tbl[\s>]/.test(analisisXml), 'Analisis Bidang must have zero adjacent tables');
  // PDF Hal. 3 — Permohonan Layanan Peta Analisis Penatagunaan Tanah
  assert.ok(analisisXml.includes('Permohonan Layanan Peta Analisis Penatagunaan Tanah'));
  assert.ok(analisisXml.includes('KETERANGAN TENTANG TANAH YANG DIMOHON'));
  assert.ok(analisisXml.includes('Kesesuaian Penggunaan Tanah terhadap RTRW atau RDTR, LSD dan LP2B'));
  assert.ok(analisisXml.includes('1. Non-Multimedia'));
  assert.ok(analisisXml.includes('2. Multimedia'));
  assert.ok(analisisXml.includes('Skala 1 : 1000'));
  assert.ok(analisisXml.includes('FC Sertifikat (Terploting)'));
  // PDF Hal. 4 — Surat Kuasa
  assert.ok(analisisXml.includes('PEMBERI KUASA'));
  assert.ok(analisisXml.includes('PENERIMA KUASA'));
  assert.ok(analisisXml.includes('KHUSUS'));
  // PDF Hal. 1 — Sket Rencana Pemecahan Bidang Tanah
  assert.ok(analisisXml.includes('SKET RENCANA PEMECAHAN BIDANG TANAH'));
  assert.ok(analisisXml.includes('3 (Tiga) Bidang'));
  assert.ok(analisisXml.includes('Rencana Penggunaan'));
  assert.ok(analisisXml.includes('Alasan Pemecahan'));
  assert.ok(analisisXml.includes('dihibahkan ke anak'));
  // PDF Hal. 2 — Surat Pernyataan Alasan Pemecahan (8 poin)
  assert.ok(analisisXml.includes('SURAT PERNYATAAN ALASAN PEMECAHAN'));
  assert.ok(analisisXml.includes('bukan merupakan kegiatan pembangunan perumahan terselubung'));
  assert.ok(analisisXml.includes('maksimal 5 (lima) bidang'));
  assert.ok(analisisXml.includes('HIBAH kepada anak'));
  // Retained pages (Keabsahan Data & Lokasi + Geotagging & Poligon)
  assert.ok(analisisXml.includes('SURAT PERNYATAAN KEABSAHAN DATA &amp; LOKASI BIDANG TANAH'));
  assert.ok(analisisXml.includes('GEOTAGGING &amp; ANALISIS BIDANG'));
  assert.ok(analisisXml.includes('a. -7.530057, 110.779658'));
  assert.ok(analisisXml.includes('w:line="276"'));
  assert.ok(analisisXml.includes('w:after="1440"'));

  const analisisPreview = await renderDocxPreviewPages(analisisRecord, DEFAULT_OFFICE_SETTINGS, {}, '02_lampiran_bundel');
  assert.equal(analisisPreview.pages.length, 7);
  assert.ok(analisisPreview.pages[0].title.includes('Permohonan Peta Analisis'));
  assert.ok(analisisPreview.pages[1].title.includes('Surat Kuasa'));
  assert.ok(analisisPreview.pages[2].title.includes('Sket Rencana Pemecahan'));
  assert.ok(analisisPreview.pages[3].title.includes('Alasan Pemecahan'));
  assert.ok(analisisPreview.pages[4].title.includes('Keabsahan'));
  assert.ok(analisisPreview.pages[5].title.includes('Analisis Bidang'));

  // With optional Pelepasan Jalan enabled -> 8 pages
  const analisisWithJalan = {
    ...analisisRecord,
    non_akta: { ...analisisRecord.non_akta, sertakan_pelepasan_jalan: true, pelepasan_jalan_keterangan: 'Jalan Akses Kavling' },
  };
  const analisisJalanPreview = await renderDocxPreviewPages(analisisWithJalan, DEFAULT_OFFICE_SETTINGS, {}, '02_lampiran_bundel');
  assert.equal(analisisJalanPreview.pages.length, 8);
  assert.ok(analisisJalanPreview.pages[4].title.includes('Pelepasan Jalan'));

  // 4. Permohonan PKKPR (2 pages default, 3 pages with Kuasa 2)
  const pkkprBase = {
    ...base,
    id: 'pkkpr-1',
    layanan: 'Permohonan PKKPR' as const,
    akta: { ...base.akta, tanggal_akta: '09-04-2026' },
    non_akta: {
      pkkpr_jenis_kegiatan: 'Non Berusaha' as const,
      pkkpr_telepon: '081234567890',
      pkkpr_email: 'pemohon@example.com',
      pkkpr_npwp: '12.345.678.9-526.000',
      pkkpr_diwakili: 'Diri Sendiri',
      pkkpr_kbli: 'Rumah Tinggal',
      pkkpr_jumlah_lantai: '1',
      pkkpr_luas_bangunan: '± 100 m2',
      pkkpr_alamat_lokasi: 'Dk. Ngesrep Rt. 006 / Rw. 005',
      koordinat_poligon: '-7.530057, 110.779658\n-7.530119, 110.779647\n-7.530143, 110.779764\n-7.530080, 110.779779',
      pkkpr_kuasa_2_aktif: false,
    },
  };
  const pkkpr2Files = await generateBundleFiles(pkkprBase, DEFAULT_OFFICE_SETTINGS, {});
  assert.equal(pkkpr2Files.length, 1);
  assert.equal(pkkpr2Files[0].fileName, '02_Lampiran_Bundel_Permohonan_PKKPR.docx');
  const pkkpr2Xml = new PizZip(pkkpr2Files[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(!/<\/w:tbl>\s*<w:tbl[\s>]/.test(pkkpr2Xml), 'PKKPR must have zero adjacent tables');
  assert.ok(pkkpr2Xml.includes('Permohonan Persetujuan Kesesuaian Kegiatan Pemanfaatan Ruang (PKKPR)'));
  assert.ok(pkkpr2Xml.includes('Cq. Kepala Dinas Penanaman Modal Dan Pelayanan Terpadu Satu Pintu'));
  assert.ok(pkkpr2Xml.includes('Kantor DPMPTSP'));
  assert.ok(pkkpr2Xml.includes('Rumah Tinggal'));
  assert.ok(pkkpr2Xml.includes('Dk. Ngesrep Rt. 006 / Rw. 005'));
  assert.ok(pkkpr2Xml.includes('w:line="276"'));
  assert.ok(pkkpr2Xml.includes('w:after="1440"'));
  const pkkpr2Preview = await renderDocxPreviewPages(pkkprBase, DEFAULT_OFFICE_SETTINGS, {}, '02_lampiran_bundel');
  assert.equal(pkkpr2Preview.pages.length, 2);
  assert.ok(pkkpr2Preview.pages[0].title.includes('PKKPR'));
  assert.ok(pkkpr2Preview.pages[1].title.includes('Surat Kuasa'));

  // With optional Kuasa 2 active -> 3 pages
  const pkkpr3Record = {
    ...pkkprBase,
    non_akta: {
      ...pkkprBase.non_akta,
      pkkpr_kuasa_2_aktif: true,
      pkkpr_kuasa_2_detail: {
        nama: 'SRI WAHYUNI',
        nik: '3309114505850002',
        pekerjaan: 'Karyawan Swasta',
        tempat_lahir: 'Boyolali',
        tanggal_lahir: '05-05-1985',
        alamat: 'Dk. Rejosari, Desa Sindon, Ngemplak, Boyolali',
      },
    },
  };
  const pkkpr3Preview = await renderDocxPreviewPages(pkkpr3Record, DEFAULT_OFFICE_SETTINGS, {}, '02_lampiran_bundel');
  assert.equal(pkkpr3Preview.pages.length, 3);
  assert.ok(pkkpr3Preview.pages[2].title.includes('Surat Kuasa'));
  const pkkpr3Files = await generateBundleFiles(pkkpr3Record, DEFAULT_OFFICE_SETTINGS, {});
  const pkkpr3Xml = new PizZip(pkkpr3Files[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(pkkpr3Xml.includes('SRI WAHYUNI'));

  // 5. Exclusion from Laporan Bulanan PPATS & inclusion in Rekap Non-Akta
  const allSample = [cekRecord, validasiRecord, analisisRecord, pkkprBase];
  assert.equal(filterRecordsByMonthYear(allSample, 4, 2026).length, 0, 'New Non-Akta records must never enter Laporan Bulanan PPATS');
  assert.equal(filterNonAktaRecords(allSample).length, 4, 'All 4 new Non-Akta records must appear in Rekap Non-Akta');
  const stats = summarizeNonAktaStats(allSample);
  assert.equal(stats.pengecekan, 1);
  assert.equal(stats.validasi, 1);
  assert.equal(stats.analisisBidang, 1);
  assert.equal(stats.pkkpr, 1);
});

test('APHB with multiple recipients renders pemegang hak bersama wording on Akta and lists all recipients on Lampiran Page 1', async () => {
  const baseParty = INITIAL_SEED_RECORDS[1].para_pihak[0];
  const multiAphbRecord = {
    ...INITIAL_SEED_RECORDS[1],
    layanan: 'APHB' as const,
    para_pihak: [
      { ...baseParty, id: 'm1', peran: 'Pihak I' as const, nama: 'AGUS TRIYONO' },
      { ...baseParty, id: 'm2', peran: 'Pihak II' as const, nama: 'LESTTORINI' },
      { ...baseParty, id: 'm3', peran: 'Pihak III' as const, nama: 'PURWANTI' },
      { ...baseParty, id: 'm4', peran: 'Pihak IV' as const, nama: 'BUDI SANTOSO' },
    ],
    akta: {
      ...INITIAL_SEED_RECORDS[1].akta,
      pihak_penerima_aphb: 'Pihak III',
      pihak_penerima_aphb_list: ['Pihak III', 'Pihak IV'],
      aphb_jumlah_pemegang_hak: 4,
      aphb_jumlah_penerima: 2,
    },
  };

  const files = await generateBundleFiles(multiAphbRecord, DEFAULT_OFFICE_SETTINGS, {});
  const aktaXml = new PizZip(files[0].bytes).file('word/document.xml')?.asText() ?? '';
  const lampiranXml = new PizZip(files[1].bytes).file('word/document.xml')?.asText() ?? '';

  assert.ok(
    aktaXml.includes('Pihak ketiga atas nama PURWANTI dan Pihak keempat atas nama BUDI SANTOSO'),
    'Akta APHB must name both recipients in penerima_aphb_klausul'
  );
  assert.ok(
    aktaXml.includes('memperoleh dan menjadi pemegang hak bersama dari'),
    'Multi-recipient APHB must state pemegang hak bersama instead of pemegang tunggal'
  );
  assert.ok(lampiranXml.includes('PURWANTI') && lampiranXml.includes('BUDI SANTOSO'));
  assert.ok(!aktaXml.includes('{{') && !aktaXml.includes('}}'));
  assert.ok(!lampiranXml.includes('{{') && !lampiranXml.includes('}}'));
});

test('Pemecahan and Ukur Ulang embed Sketsa Bidang Tanah in Pemasangan Tanda Batas, Gambar Sket Tanah, and 2-page Foto Lokasi Tampak Depan/Patok 1-4/Poligon with preview images', async () => {
  const tinyPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const pemecahanFull = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'Pemecahan' as const,
    tanah: {
      ...INITIAL_SEED_RECORDS[0].tanah,
      jenis_sertipikat: 'digital' as const,
      nib: '11.17.000025993.0',
      luas_m2: 778,
      desa: 'Sawahan',
      kecamatan: 'Ngemplak',
      kabupaten: 'Kabupaten Boyolali',
      batas_utara: 'Sumedi',
      batas_timur: 'Jalan',
      batas_selatan: 'Rohim',
      batas_barat: 'Sadli',
      pemegang_hak_sertipikat: ['SITI MARSIYAH'],
    },
    non_akta: {
      pengesahan_mode: 'kades' as const,
      pengesahan_jabatan: 'Kepala Desa Sawahan',
      pengesahan_nama: 'AGUS SUNARNO',
      sub_permohonan_ukur: 'Pemecahan' as const,
      bidang_pecahan: [
        { id: 'b1', label: 'sisa', luas_m2: 196 },
        { id: 'b2', label: 'Tri Handoko', luas_m2: 432 },
      ],
      sertakan_pelepasan_jalan: true,
      pelepasan_jalan_luas_m2: 150,
      pelepasan_jalan_sisi: 'utara' as const,
      koordinat_gps: '-7.514428, 110.809820',
      link_maps: 'https://maps.app.goo.gl/V94o5vCsbTEmRzAk8',
      koordinat_poligon: '-7.514428, 110.809986\n-7.514346, 110.809631\n-7.514554, 110.809937\n-7.514486, 110.809596',
      foto_sket_pecah: tinyPngDataUrl,
      foto_tampak_depan: tinyPngDataUrl,
      foto_patok_1: tinyPngDataUrl,
      foto_patok_2: tinyPngDataUrl,
      foto_patok_3: tinyPngDataUrl,
      foto_patok_4: tinyPngDataUrl,
      foto_poligon: tinyPngDataUrl,
    },
  };

  const pecahFiles = await generateBundleFiles(pemecahanFull, DEFAULT_OFFICE_SETTINGS, {});
  const pecahZip = new PizZip(pecahFiles[0].bytes);
  const pecahXml = pecahZip.file('word/document.xml')?.asText() ?? '';
  const mediaFiles = Object.keys(pecahZip.files).filter((f) => f.startsWith('word/media/'));
  const blipCount = (pecahXml.match(/<a:blip\b/g) ?? []).length;

  assert.ok(mediaFiles.length >= 1, `Expected embedded media files in word/media/, got ${mediaFiles.length}`);
  assert.ok(blipCount >= 8, `Expected at least 8 embedded image drawings (2x sketch + 6x geotag/poligon), got ${blipCount}`);
  assert.ok(pecahXml.includes('SKETSA BIDANG TANAH'));
  assert.ok(pecahXml.includes('GAMBAR SKET TANAH'));
  assert.ok(pecahXml.includes('Dilepaskan Untuk Jalan Luas ± 150 m²'));
  assert.ok(pecahXml.includes('FOTO LOKASI SHM Nibel 11.17.000025993.0'));
  assert.ok(pecahXml.includes('TAMPAK DEPAN'));
  assert.ok(pecahXml.includes('-7.514428, 110.809820'));
  assert.ok(pecahXml.includes('https://maps.app.goo.gl/V94o5vCsbTEmRzAk8'));
  assert.ok(pecahXml.includes('POLIGON'));
  assert.ok(pecahXml.includes('Titik Koordinat Sudut Poligon Bidang Tanah'));

  // Preview parser extracts embedded images into preview blocks
  const pecahPreview = await renderDocxPreviewPages(pemecahanFull, DEFAULT_OFFICE_SETTINGS, {}, '02_lampiran_bundel');
  const countPreviewImages = (blocks: typeof pecahPreview.pages[number]['blocks']): number =>
    blocks.reduce((sum, blk) => {
      if (blk.kind === 'paragraph') return sum + (blk.images?.length ?? 0);
      return (
        sum +
        blk.rows.reduce(
          (rSum, row) => rSum + row.cells.reduce((cSum, cell) => cSum + countPreviewImages(cell.blocks), 0),
          0
        )
      );
    }, 0);
  const totalPreviewImgs = pecahPreview.pages.reduce((sum, p) => sum + countPreviewImages(p.blocks), 0);
  assert.ok(totalPreviewImgs >= 8, `Expected at least 8 embedded images rendered in preview (2x sketch + 6x geotag/poligon), got ${totalPreviewImgs}`);
  assert.ok(pecahPreview.pages.some((p) => p.title.includes('Pemasangan Tanda Batas')));
  assert.ok(pecahPreview.pages.some((p) => p.title.includes('Gambar Sket Tanah')));
  assert.ok(pecahPreview.pages.some((p) => p.title.includes('Foto Lokasi Tampak Depan')));
  assert.ok(pecahPreview.pages.some((p) => p.title.includes('Patok 3-4 & Poligon')));

  // Ukur Ulang also includes Gambar Sket Tanah, Sketsa Bidang Tanah, and Foto Lokasi/Poligon
  const ukurUlangRecord = {
    ...pemecahanFull,
    layanan: 'Ukur Ulang' as const,
    non_akta: {
      ...pemecahanFull.non_akta,
      sub_permohonan_ukur: 'Pengukuran' as const,
      bidang_pecahan: [],
      sertakan_pelepasan_jalan: false,
    },
  };
  const ukurFiles = await generateBundleFiles(ukurUlangRecord, DEFAULT_OFFICE_SETTINGS, {});
  assert.equal(ukurFiles[0].fileName, '02_Lampiran_Bundel_Ukur_Ulang.docx');
  const ukurXml = new PizZip(ukurFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(ukurXml.includes('SKETSA BIDANG TANAH'));
  assert.ok(ukurXml.includes('GAMBAR SKET TANAH'));
  assert.ok(ukurXml.includes('Bidang Ukur Ulang'));
  assert.ok(ukurXml.includes('FOTO LOKASI SHM Nibel 11.17.000025993.0'));
  assert.ok(ukurXml.includes('POLIGON'));
});

test('Akta PPATS (APHB 4-party, AJB, Hibah) uses OOXML hyphen-leader tab stops with zero hardcoded dashes and parses cleanly in preview', async () => {
  const aphb4Parties = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'APHB' as const,
    para_pihak: [
      { ...INITIAL_SEED_RECORDS[0].para_pihak[0], id: 'p1', peran: 'Pihak I' as const, nama: 'SUWARNO', nik: '3309112203640001' },
      { ...INITIAL_SEED_RECORDS[0].para_pihak[0], id: 'p2', peran: 'Pihak II' as const, nama: 'SUTARMI', nik: '3309111203680002' },
      { ...INITIAL_SEED_RECORDS[0].para_pihak[0], id: 'p3', peran: 'Pihak III' as const, nama: 'SUPRIYADI', nik: '3309111203720004' },
      { ...INITIAL_SEED_RECORDS[0].para_pihak[0], id: 'p4', peran: 'Pihak IV' as const, nama: 'SULISTYOWATI', nik: '3309111508760005' },
    ],
  };

  for (const rec of [
    aphb4Parties,
    { ...INITIAL_SEED_RECORDS[0], layanan: 'AJB' as const },
    { ...INITIAL_SEED_RECORDS[0], layanan: 'Akta Hibah' as const },
  ]) {
    const files = await generateBundleFiles(rec, DEFAULT_OFFICE_SETTINGS, {});
    const aktaZip = new PizZip(files[0].bytes);
    const aktaXml = aktaZip.file('word/document.xml')?.asText() ?? '';

    assert.equal(
      aktaXml.includes('----'),
      false,
      `${rec.layanan} Akta XML must not contain hardcoded literal dashes ('----') that wrap onto orphan lines`
    );
    assert.ok(
      aktaXml.includes('w:leader="hyphen"'),
      `${rec.layanan} Akta XML must use OOXML w:leader="hyphen" tab stops`
    );
    assert.ok(
      aktaXml.includes('<w:tab/>'),
      `${rec.layanan} Akta XML must emit <w:tab/> runs for hyphen leaders`
    );
  }

  // Verify preview parser extracts center-flanked and trailing leaders on 4-party APHB
  const preview = await renderDocxPreviewPages(aphb4Parties, DEFAULT_OFFICE_SETTINGS, {}, '01_akta');
  const allParagraphs = preview.pages.flatMap((pg) =>
    pg.blocks.filter((b): b is Extract<typeof b, { kind: 'paragraph' }> => b.kind === 'paragraph')
  );
  const centerFlanked = allParagraphs.filter((b) => b.dashLeader === 'center-flanked');
  const trailing = allParagraphs.filter((b) => b.dashLeader === 'trailing');
  const keyValueLines = allParagraphs.filter((b) => Boolean(b.keyValueLabelRuns?.length));

  const centerTexts = centerFlanked.map((b) => b.runs.map((r) => r.text).join('').trim());
  assert.ok(centerTexts.includes('PIHAK PERTAMA'), 'PIHAK PERTAMA must use center-flanked hyphen leader');
  assert.ok(centerTexts.includes('PIHAK KETIGA'), 'PIHAK KETIGA must use center-flanked hyphen leader');
  assert.ok(centerTexts.includes('PIHAK KEEMPAT'), 'PIHAK KEEMPAT must use center-flanked hyphen leader');
  assert.ok(centerTexts.includes('Pasal 1'), 'Pasal 1 must use center-flanked hyphen leader');

  const trailingTexts = trailing.map((b) => b.runs.map((r) => r.text).join(''));
  assert.ok(
    trailingTexts.some((t) => t.includes('Untuk selanjutnya dalam akta ini disebut')),
    'Untuk selanjutnya dalam akta ini disebut must use trailing hyphen leader'
  );
  assert.ok(
    trailingTexts.some((t) => t.includes('3. Foto copy SPPT PBB NOP:')),
    'SPPT PBB line must use trailing hyphen leader'
  );
  assert.ok(
    trailingTexts.some((t) => t.includes('4. SSPD BPHTB, SSP PPh.')),
    'SSPD BPHTB/PPh line must use trailing hyphen leader'
  );
  assert.ok(keyValueLines.length >= 8, `Expected at least 8 aligned batas/letak key-value lines, got ${keyValueLines.length}`);

  // No preview paragraph run should contain hardcoded '----'
  for (const para of allParagraphs) {
    const joined = para.runs.map((r) => r.text).join('');
    assert.equal(joined.includes('----'), false, `Unexpected hardcoded dashes in preview paragraph: ${joined}`);
  }
});

test('Non-Akta Permohonan signature lists all pemohon names in full without dkk abbreviation even for 6+ parties', async () => {
  const sixParties = ['WIDASIH', 'SUWARNO', 'SUTARMI', 'SUPRIYADI', 'SULISTYOWATI', 'HARTONO'].map(
    (nama, idx) => ({
      ...INITIAL_SEED_RECORDS[0].para_pihak[0],
      id: `p-${idx + 1}`,
      peran: (['Pihak I', 'Pihak II', 'Pihak III', 'Pihak IV', 'Pihak V', 'Pihak VI'] as const)[idx],
      nama,
    })
  );

  for (const layanan of ['Turun Waris', 'Validasi Sertipikat'] as const) {
    const rec = {
      ...INITIAL_SEED_RECORDS[0],
      layanan,
      para_pihak: sixParties,
    };
    const files = await generateBundleFiles(rec, DEFAULT_OFFICE_SETTINGS, {});
    const xml = new PizZip(files[0].bytes).file('word/document.xml')?.asText() ?? '';
    assert.equal(xml.includes('dkk'), false, `${layanan} must not abbreviate pemohon with dkk`);
    for (let i = 0; i < sixParties.length; i += 1) {
      assert.ok(
        xml.includes(`${i + 1}. ${sixParties[i].nama}`),
        `${layanan} Permohonan qq. signature must include "${i + 1}. ${sixParties[i].nama}"`
      );
    }
  }
});

test('Multi-party & long-name signatures use non-wrapping 2-column dot cells, consistent dates, and Pengesahan on non-Pengantar/non-Permohonan docs', async () => {
  const { shouldAttachMultiPagePengesahan } = await import('./nonAktaTemplates');

  // 1. Pure multi-page Pengesahan rule strictly excludes Pengantar & Permohonan
  assert.equal(
    shouldAttachMultiPagePengesahan({
      isPengantarOrPermohonan: true,
      hasExistingPengesahan: false,
      partyCount: 6,
      estimatedLineUnits: 90,
    }),
    false
  );
  assert.equal(
    shouldAttachMultiPagePengesahan({
      isPengantarOrPermohonan: false,
      hasExistingPengesahan: true,
      partyCount: 4,
      estimatedLineUnits: 60,
    }),
    false
  );
  assert.equal(
    shouldAttachMultiPagePengesahan({
      isPengantarOrPermohonan: false,
      hasExistingPengesahan: false,
      partyCount: 2,
      estimatedLineUnits: 40,
    }),
    true
  );
  assert.equal(
    shouldAttachMultiPagePengesahan({
      isPengantarOrPermohonan: false,
      hasExistingPengesahan: false,
      partyCount: 1,
      estimatedLineUnits: 52,
    }),
    true
  );

  // 2. Long signer names across Turun Waris, Pengecekan, Akta Lampiran, and Waris C
  const longParties = [
    'TUMIYEM BINTI HARJOWIYONO ALMARHUM',
    'YUDI WIYONO PRASETYO NUGROHO, S.H., M.Kn.',
    'GIYEM KARTINI WIDYANINGRUM',
    'SUWARDJO MARTODIHARJO',
  ].map((nama, idx) => ({
    ...INITIAL_SEED_RECORDS[0].para_pihak[0],
    id: `long-${idx + 1}`,
    peran: (['Pihak I', 'Pihak II', 'Pihak III', 'Pihak IV'] as const)[idx],
    nama,
  }));

  const twRec = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'Turun Waris' as const,
    para_pihak: longParties,
    akta: { ...INITIAL_SEED_RECORDS[0].akta, tanggal_akta: '15-01-2026' },
  };
  const twFiles = await generateBundleFiles(twRec, DEFAULT_OFFICE_SETTINGS, {});
  const twXml = new PizZip(twFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.equal(
    twXml.includes('(....................)'),
    false,
    'Turun Waris must not concatenate inline (....................) after signer names'
  );
  assert.equal(
    /ALMARHUM\s*\.{4,}|M\.Kn\.\s*\.{4,}/.test(twXml),
    false,
    'Data Pribadi must not concatenate inline dots after signer names'
  );
  assert.ok(twXml.includes('(.............)'), 'Signer dot cells must render compact (.............)');
  assert.ok(twXml.includes('<w:vAlign w:val="bottom"/>'), 'Signer rows must align dots to bottom of name');

  const twPreview = await renderDocxPreviewPages(twRec, DEFAULT_OFFICE_SETTINGS, {}, '02_lampiran_bundel');
  const twPermohonan = twPreview.pages.find((p) => p.title.includes('Permohonan ATR/BPN'));
  const twDataPribadi = twPreview.pages.find((p) => p.title.includes('Data Pribadi'));
  assert.ok(twPermohonan && twDataPribadi, 'Turun Waris preview must have Permohonan and Data Pribadi pages');
  const pageText = (pg: typeof twPreview.pages[number]) => JSON.stringify(pg.blocks);
  assert.equal(
    pageText(twPermohonan).includes('Mengetahui,'),
    false,
    'Permohonan ATR/BPN must NOT include Mengetahui Pengesahan'
  );
  assert.ok(
    pageText(twDataPribadi).includes('Mengetahui,'),
    'Non-Akta Pemrosesan Data Pribadi must include Mengetahui Pengesahan'
  );

  // Pengecekan Sertipikat: uniform date (no slash date in signatures), Permohonan has no Mengetahui, Keabsahan has Mengetahui
  const cekRec = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'Pengecekan Sertipikat' as const,
    para_pihak: longParties.slice(0, 2),
    akta: { ...INITIAL_SEED_RECORDS[0].akta, tanggal_akta: '09-04-2026' },
  };
  const cekPreview = await renderDocxPreviewPages(cekRec, DEFAULT_OFFICE_SETTINGS, {}, '02_lampiran_bundel');
  assert.equal(pageText(cekPreview.pages[0]).includes('Mengetahui,'), false, 'Permohonan Pengecekan must NOT have Mengetahui');
  assert.ok(pageText(cekPreview.pages[1]).includes('9 April 2026'), 'Surat Kuasa Pengecekan must use uniform Indonesian date');
  assert.equal(pageText(cekPreview.pages[1]).includes('09/04/2026'), false, 'Surat Kuasa Pengecekan must not use slash date');
  assert.ok(pageText(cekPreview.pages[2]).includes('Mengetahui,'), 'Keabsahan Dokumen Pengecekan must include Mengetahui');
  assert.ok(pageText(cekPreview.pages[2]).includes('9 April 2026'), 'Keabsahan Dokumen Pengecekan must use uniform Indonesian date');

  // Akta Bundel Lampiran: Hal. 1 Pengantar & Hal. 2 Permohonan have NO Mengetahui, Hal. 8 Data Pribadi HAS Mengetahui & 2-col table
  const aktaRec = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'AJB' as const,
    para_pihak: [
      { ...longParties[0], peran: 'Pihak I' as const },
      { ...longParties[1], peran: 'Pihak I' as const },
      { ...longParties[2], peran: 'Pihak II' as const },
    ],
  };
  const aktaLampPreview = await renderDocxPreviewPages(aktaRec, DEFAULT_OFFICE_SETTINGS, {}, '02_lampiran_bundel');
  assert.equal(pageText(aktaLampPreview.pages[0]).includes('Mengetahui,'), false, 'Surat Pengantar must NOT have Mengetahui');
  assert.equal(pageText(aktaLampPreview.pages[1]).includes('Mengetahui,'), false, 'Permohonan ATR/BPN Akta must NOT have Mengetahui');
  const aktaDataPribadi = aktaLampPreview.pages.find((p) => p.title.includes('Data Pribadi'));
  assert.ok(aktaDataPribadi && pageText(aktaDataPribadi).includes('Mengetahui,'), 'Akta Data Pribadi (2 hal) must include Mengetahui');
  assert.ok(pageText(aktaDataPribadi).includes('(.............)'), 'Akta Data Pribadi must render 2-col signer dots');

  // Waris C: no inline dots, no 'tgl.' inconsistency, Berita Acara Kesaksian has Mengetahui
  const warisCRec = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'Waris C' as const,
    para_pihak: longParties,
    akta: { ...INITIAL_SEED_RECORDS[0].akta, tanggal_akta: '15-01-2026' },
  };
  const warisCFiles = await generateBundleFiles(warisCRec, DEFAULT_OFFICE_SETTINGS, {});
  const warisCXml = new PizZip(warisCFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.equal(warisCXml.includes('tgl. '), false, 'Waris C must not contain inconsistent "tgl." date prefix');
  assert.equal(warisCXml.includes('(....................)'), false, 'Waris C must not concatenate inline (....................) dots');
  assert.ok(warisCXml.includes('Mengetahui,'), 'Waris C multi-page Berita Acara / Pengesahan must include Mengetahui,');
});

test('Lampiran layout helper computes empty Pekerjaan, adaptive signer spacing, and multi-page statement pagination accurately', async () => {
  const {
    hasFilledPekerjaan,
    computeSignerRowSpacing,
    estimateSignerBlockTwips,
    planStatementPagination,
  } = await import('./lampiranLayoutHelper');

  // 1. Empty / placeholder Pekerjaan detection
  assert.equal(hasFilledPekerjaan(''), false);
  assert.equal(hasFilledPekerjaan('   '), false);
  assert.equal(hasFilledPekerjaan('-'), false);
  assert.equal(hasFilledPekerjaan('–'), false);
  assert.equal(hasFilledPekerjaan('—'), false);
  assert.equal(hasFilledPekerjaan('...'), false);
  assert.equal(hasFilledPekerjaan('tidak ada'), false);
  assert.equal(hasFilledPekerjaan('Kosong'), false);
  assert.equal(hasFilledPekerjaan('Petani'), true);
  assert.equal(hasFilledPekerjaan('Wiraswasta'), true);

  // 2. Adaptive signer row spacing tightens as signer count grows
  const s1 = computeSignerRowSpacing(1);
  const s3 = computeSignerRowSpacing(3);
  const s6 = computeSignerRowSpacing(6);
  const s12 = computeSignerRowSpacing(12);
  assert.equal(s1.rowGapTwips, 210);
  assert.equal(s3.rowGapTwips, 120);
  assert.equal(s6.rowGapTwips, 65);
  assert.equal(s12.rowGapTwips, 35);
  assert.equal(s12.lineTwips, 222);

  // 3. Single-page vs multi-page statement pagination
  const shortPlan = planStatementPagination({
    parties: [
      { pekerjaan: 'Petani', alamat: 'Dusun Sindon RT 01/02, Ngemplak, Boyolali' },
      { pekerjaan: 'Wiraswasta', alamat: 'Dusun Sindon RT 01/02, Ngemplak, Boyolali' },
    ],
    headerTwips: 2000,
    bodyTwips: 2600,
    signatureBlockTwips: estimateSignerBlockTwips(2) + 2150,
  });
  assert.equal(shortPlan.isMultiPage, false, '2-party statement must fit on 1 compact F4 page');

  const longPlan = planStatementPagination({
    parties: Array.from({ length: 12 }, () => ({
      pekerjaan: '',
      alamat: 'Dusun Sindon RT 01/02, Desa Sindon, Kec. Ngemplak, Kab. Boyolali',
    })),
    headerTwips: 2000,
    bodyTwips: 2800,
    signatureBlockTwips: estimateSignerBlockTwips(12) + 2150,
  });
  assert.equal(longPlan.isMultiPage, true, '12-party statement must split across 2 pages');
  assert.ok(longPlan.page1PartyCount >= 1 && longPlan.page1PartyCount < 12, 'Page 1 must take a subset of parties leaving remainder for Page 2');
});

test('Revisi khusus lampiran: empty Pekerjaan rows omitted across Non-Akta/Akta/Waris C, stray No removed, 12-party Turun Waris & 6-party APHB use compact spacing and Page-1 Mengetahui', async () => {
  const baseParty = INITIAL_SEED_RECORDS[0].para_pihak[0];

  // 1. Non-Akta Turun Waris with blank / dash Pekerjaan and 12 heirs + analog SHM
  const twelveHeirs = Array.from({ length: 12 }, (_, idx) => ({
    ...baseParty,
    id: `tw12-${idx + 1}`,
    peran: (`Pihak ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][idx]}`) as typeof baseParty.peran,
    nik: `330911010180${String(idx + 1).padStart(4, '0')}`,
    nama: `AHLI WARIS ${idx + 1}`,
    pekerjaan: idx % 2 === 0 ? '' : '-',
  }));

  const tw12Rec = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'Turun Waris' as const,
    para_pihak: twelveHeirs,
    tanah: {
      ...INITIAL_SEED_RECORDS[0].tanah,
      jenis_sertipikat: 'analog' as const,
      jenis_hak: 'Hak Milik',
      nomor_hak_lama: '2750',
    },
    akta: {
      ...INITIAL_SEED_RECORDS[0].akta,
      tanggal_akta: '20-11-2026',
      saksi_1_detail: { ...INITIAL_SEED_RECORDS[0].akta.saksi_1_detail!, pekerjaan: '' },
      saksi_2_detail: { ...INITIAL_SEED_RECORDS[0].akta.saksi_2_detail!, pekerjaan: '-' },
      kuasa_bpn_detail: { ...INITIAL_SEED_RECORDS[0].akta.kuasa_bpn_detail!, pekerjaan: '' },
    },
  };

  const tw12Files = await generateBundleFiles(tw12Rec, DEFAULT_OFFICE_SETTINGS, {});
  const tw12Xml = new PizZip(tw12Files[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(!/<\/w:tbl>\s*<w:tbl[\s>]/.test(tw12Xml), '12-party Turun Waris must have zero adjacent tables');
  assert.equal(tw12Xml.includes('>Pekerjaan<'), false, 'Turun Waris must omit Pekerjaan rows when all pekerjaan fields are empty or "-"');
  assert.equal(tw12Xml.includes('Nomor Hak Milik No.'), false, 'Permohonan must not render stray "No." after "Nomor Hak Milik"');
  assert.ok(tw12Xml.includes('Nomor Hak Milik'), 'Permohonan must render clean "Nomor Hak Milik"');
  assert.ok(tw12Xml.includes('w:line="220"'), 'Permohonan checklist must use compact 220 twips spacing');
  assert.ok(tw12Xml.includes('w:after="35"') && tw12Xml.includes('w:line="222"'), '12-party Turun Waris must use compact 35-twip / 222-line signer rows');

  // Compare Mengetahui count: 12-party Turun Waris must add intermediate Page-1 Mengetahui on multi-page statements
  const tw1Rec = { ...tw12Rec, para_pihak: [{ ...twelveHeirs[0], pekerjaan: 'Petani' }] };
  const tw1Files = await generateBundleFiles(tw1Rec, DEFAULT_OFFICE_SETTINGS, {});
  const tw1Xml = new PizZip(tw1Files[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(tw1Xml.includes('>Pekerjaan<'), 'Turun Waris must show Pekerjaan row when pekerjaan is populated ("Petani")');
  const mengetahui1 = (tw1Xml.match(/Mengetahui,/g) ?? []).length;
  const mengetahui12 = (tw12Xml.match(/Mengetahui,/g) ?? []).length;
  assert.ok(
    mengetahui12 > mengetahui1,
    `12-party Turun Waris (${mengetahui12}) must emit more Mengetahui blocks than 1-party (${mengetahui1}) due to multi-page Page-1 pengesahan`
  );

  // Permohonan page itself must NEVER include Mengetahui
  const tw12Preview = await renderDocxPreviewPages(tw12Rec, DEFAULT_OFFICE_SETTINGS, {}, '02_lampiran_bundel');
  assert.equal(JSON.stringify(tw12Preview.pages[0].blocks).includes('Mengetahui,'), false, 'Permohonan page must never include Mengetahui');
  assert.ok(tw12Preview.pages.length > 8, `12-party Turun Waris should split long Surat Pernyataan onto continuation pages, got ${tw12Preview.pages.length} pages`);

  // 2. Analisis Bidang analog SHM must not emit stray "Nomor Hak No"
  const analisisAnalog = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'Analisis Bidang' as const,
    tanah: {
      ...INITIAL_SEED_RECORDS[0].tanah,
      jenis_sertipikat: 'analog' as const,
      jenis_hak: 'Hak Milik',
      nomor_hak_lama: '1234',
    },
  };
  const anaFiles = await generateBundleFiles(analisisAnalog, DEFAULT_OFFICE_SETTINGS, {});
  const anaXml = new PizZip(anaFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.equal(anaXml.includes('Nomor Hak No'), false, 'Analisis Bidang must not render stray "Nomor Hak No"');
  assert.ok(anaXml.includes('Nomor Hak Milik'), 'Analisis Bidang must render clean "Nomor Hak Milik"');

  // 3. Akta Lampiran Bundel (02_lampiran_bundel): omits Pekerjaan rows when empty/dash & renders compact 6-party Data Pribadi
  const sixAphbParties = Array.from({ length: 6 }, (_, idx) => ({
    ...baseParty,
    id: `aphb6-${idx + 1}`,
    peran: (`Pihak ${['I', 'II', 'III', 'IV', 'V', 'VI'][idx]}`) as typeof baseParty.peran,
    nama: `PIHAK APHB ${idx + 1}`,
    pekerjaan: idx % 2 === 0 ? '' : '-',
  }));
  const aphb6BlankJob = {
    ...INITIAL_SEED_RECORDS[1],
    layanan: 'APHB' as const,
    para_pihak: sixAphbParties,
    akta: {
      ...INITIAL_SEED_RECORDS[1].akta,
      pihak_penerima_aphb: 'Pihak VI',
      saksi_1_detail: { ...INITIAL_SEED_RECORDS[1].akta.saksi_1_detail!, pekerjaan: '' },
      saksi_2_detail: { ...INITIAL_SEED_RECORDS[1].akta.saksi_2_detail!, pekerjaan: '-' },
      kuasa_bpn_detail: { ...INITIAL_SEED_RECORDS[1].akta.kuasa_bpn_detail!, pekerjaan: '' },
    },
  };
  const aphb6Files = await generateBundleFiles(aphb6BlankJob, DEFAULT_OFFICE_SETTINGS, {});
  const aphb6LampXml = new PizZip(aphb6Files[1].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(!aphb6LampXml.includes('{{') && !aphb6LampXml.includes('}}'), 'Akta Lampiran Bundel must have zero leftover template tags');
  assert.equal(aphb6LampXml.includes('>Pekerjaan<'), false, 'Akta Lampiran Bundel must omit all Pekerjaan rows when empty or "-"');
  assert.ok(aphb6LampXml.includes('w:after="35"') && aphb6LampXml.includes('w:line="222"'), '6-party Akta APHB Data Pribadi must use compact signer rows');
  for (let i = 1; i <= 6; i += 1) {
    assert.ok(aphb6LampXml.includes(`${i}. PIHAK APHB ${i}`), `6-party Data Pribadi must list ${i}. PIHAK APHB ${i}`);
  }

  // Verify populated Pekerjaan still renders cleanly in Akta Lampiran Bundel
  const ajbWithJobsFiles = await generateBundleFiles(INITIAL_SEED_RECORDS[0], DEFAULT_OFFICE_SETTINGS, {});
  const ajbWithJobsLampXml = new PizZip(ajbWithJobsFiles[1].bytes).file('word/document.xml')?.asText() ?? '';
  assert.ok(ajbWithJobsLampXml.includes('>Pekerjaan<'), 'Akta Lampiran Bundel must render Pekerjaan rows when populated');

  // 4. Waris C omits blank Pekerjaan rows
  const warisCBlankJob = {
    ...INITIAL_SEED_RECORDS[0],
    layanan: 'Waris C' as const,
    para_pihak: twelveHeirs.slice(0, 4),
    akta: {
      ...INITIAL_SEED_RECORDS[0].akta,
      kuasa_bpn_detail: { ...INITIAL_SEED_RECORDS[0].akta.kuasa_bpn_detail!, pekerjaan: '' },
    },
  };
  const warisCBlankFiles = await generateBundleFiles(warisCBlankJob, DEFAULT_OFFICE_SETTINGS, {});
  const warisCBlankXml = new PizZip(warisCBlankFiles[0].bytes).file('word/document.xml')?.asText() ?? '';
  assert.equal(warisCBlankXml.includes('>Pekerjaan<'), false, 'Waris C must omit Pekerjaan rows when pekerjaan is blank or "-"');
});







