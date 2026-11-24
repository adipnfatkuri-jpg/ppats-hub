import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  LeaderType,
  LineRuleType,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Tab,
  TabStopType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
} from 'docx';
import { TemplateDocKey } from '../types/ppats';

export interface TemplateTagDocItem {
  tag: string;
  desc: string;
}

// Konversi ukuran kertas standar ke twips (1 mm = 56.692913 twips)
export const PAPER_SIZE_A4_TWIPS = {
  width: 11906, // 210 mm
  height: 16838, // 297 mm
};

export const PAPER_SIZE_F4_TWIPS = {
  width: 12190, // 215 mm
  height: 18709, // 330 mm (Folio / F4 Indonesia)
};

export const SUPPORTED_TEMPLATE_TAGS: TemplateTagDocItem[] = [
  { tag: '{{nomor_akta}}', desc: 'Nomor Akta PPATS (mis. 001/PPATS/XI/2026)' },
  { tag: '{{nomor_pengantar}}', desc: 'Nomor Surat Pengantar berkas ke ATR/BPN' },
  { tag: '{{kalimat_akta}}', desc: 'Kalimat pembuka tanggal akta lengkap (Hari, tanggal huruf, bulan, tahun huruf)' },
  { tag: '{{hari_akta}} / {{tanggal_angka}} / {{tanggal_akta_huruf}} / {{bulan_akta}} / {{tahun_angka}} / {{tahun_akta_huruf}}', desc: 'Komponen tanggal akta terpisah untuk naskah blangko Akta' },
  { tag: '{{tanggal_akta}}', desc: 'Tanggal akta format normal (mis. 19 November 2026)' },
  { tag: '{{layanan}} / {{layanan_upper}} / {{judul_akta}}', desc: 'Jenis layanan & judul resmi akta (mis. AKTA JUAL BELI)' },
  { tag: '{{kode_berkas}}', desc: 'Nomor register berkas loket (mis. REG-2026-001)' },
  { tag: '{{#pihak_pertama}} ... {{/pihak_pertama}}', desc: 'Loop Pihak I. Tersedia: {{sebutan}}, {{nama}}, {{nik}}, {{tempat_lahir}}, {{tanggal_lahir}}, {{pekerjaan}}, {{alamat_lengkap}}, {{rt}}, {{rw}}, {{desa_kelurahan}}, {{kecamatan}}, {{kabupaten}}, {{status_perkawinan}}' },
  { tag: '{{#pihak_kedua}} ... {{/pihak_kedua}}', desc: 'Loop Pihak II (Pembeli/Penerima). Field sama dengan Pihak I' },
  { tag: '{{#pihak_lanjutan}} ... {{/pihak_lanjutan}}', desc: 'Loop Pihak III, IV, V, dan selanjutnya. Tersedia {{roman_numeral}}, {{peran_label_upper}}, serta seluruh field identitas pihak' },
  { tag: '{{#persetujuan_pasangan}} ... {{/persetujuan_pasangan}}', desc: 'Loop persetujuan suami/istri dari Pihak I' },
  { tag: '{{pihak_pertama_ringkas}} / {{pihak_kedua_ringkas}}', desc: 'Gabungan nama seluruh Pihak I / Pihak II' },
  { tag: '{{p1_nama}} / {{p1_ttl}} / {{p1_pekerjaan}} / {{p1_nik}} / {{p1_alamat}}', desc: 'Data identitas Pihak I utama' },
  { tag: '{{p2_nama}} / {{p2_ttl}} / {{p2_pekerjaan}} / {{p2_nik}} / {{p2_alamat}}', desc: 'Data identitas Pihak II utama' },
  { tag: '{{penerima_nama}} / {{penerima_ttl}} / {{penerima_nik}} / {{penerima_alamat}} / {{penerima_ringkas}}', desc: 'Pihak Pembeli / Penerima Hibah / Penerima Hak APHB untuk Kuasa, Permohonan, BPHTB, Fisik & Keabsahan' },
  { tag: '{{pemilik_awal_nama}} / {{pemilik_awal_ttl}} / {{pemilik_awal_nik}} / {{pemilik_awal_alamat}}', desc: 'Pemilik awal sertipikat untuk Surat Pernyataan SPPT/PBB' },
  { tag: '{{ket_pihak1_label}} / {{ket_pihak1_names}} / {{ket_pihak2_label}} / {{ket_pihak2_names}}', desc: 'Label Penjual/Pembeli (AJB), Pemberi/Penerima Hak (APHB), atau Pemberi/Penerima Hibah (Hibah) di Surat Pengantar' },
  { tag: '{{#pihak_data_pribadi_ttd}} ... {{/pihak_data_pribadi_ttd}}', desc: 'Daftar penandatangan Pemrosesan Data Pribadi (seluruh pihak termasuk pembeli/penerima, tanpa pihak menyetujui)' },
  { tag: '{{pasangan_nama}}', desc: 'Nama pasangan yang menyetujui (jika ada)' },
  { tag: '{{jenis_hak}} / {{nib}} / {{nomor_hak_lama}} / {{surat_ukur_tanggal}} / {{surat_ukur_nomor}}', desc: 'Jenis hak, NIB/NIBel, Nomor Hak Analog, serta Tanggal & Nomor Surat Ukur' },
  { tag: '{{luas_m2}} / {{luas_terbilang}}', desc: 'Luas bidang tanah angka dan terbilang' },
  { tag: '{{batas_utara}} / {{batas_timur}} / {{batas_selatan}} / {{batas_barat}}', desc: 'Batas-batas bidang tanah pada blangko Akta' },
  { tag: '{{penggunaan_tanah}} / {{menguasai_sejak_tahun}}', desc: 'Penggunaan tanah (mis. Pekarangan) & tahun mulai penguasaan fisik' },
  { tag: '{{desa_tanah}} / {{kecamatan_tanah}} / {{kabupaten_tanah}} / {{provinsi_tanah}}', desc: 'Lokasi administratif bidang tanah' },
  { tag: '{{dasar_perolehan}}', desc: 'Dasar perolehan hak sebelumnya' },
  { tag: '{{nop}} / {{tahun_pajak}} / {{njop_bumi_m2_rp}} / {{njop_bangunan_rp}} / {{njop_total_rp}}', desc: 'Data SPPT PBB-P2 dan NJOP' },
  { tag: '{{nilai_transaksi_rp}} / {{nilai_transaksi_terbilang}}', desc: 'Nilai transaksi/kesepakatan angka & terbilang' },
  { tag: '{{npop_rp}} / {{npoptkp_rp}} / {{bphtb_rp}} / {{bphtb_terbilang}} / {{pph_rp}} / {{pph_terbilang}}', desc: 'Rincian perhitungan BPHTB (5%) & PPh Final (2,5%)' },
  { tag: '{{nama_ppats}} / {{jabatan_ppats}} / {{nip_ppats}}', desc: 'Identitas Pejabat PPATS' },
  { tag: '{{nik_ppats}} / {{ttl_ppats}} / {{tempat_lahir_ppats}} / {{tanggal_lahir_ppats}} / {{alamat_ppats}}', desc: 'NIK, Tempat/Tanggal Lahir & Alamat Domisili Pejabat PPATS' },
  { tag: '{{sk_ppats_nomor}} / {{sk_ppats_tanggal}} / {{sk_ppats_penerbit}}', desc: 'SK Pengangkatan PPATS dari Kakanwil BPN' },
  { tag: '{{nama_kecamatan}} / {{nama_kabupaten}} / {{nama_provinsi}} / {{alamat_kantor}} / {{telepon_kantor}}', desc: 'Profil wilayah kerja dan alamat kantor PPATS' },
  { tag: '{{kuasa_bpn_nama}} / {{kuasa_bpn_ttl}} / {{kuasa_bpn_pekerjaan}} / {{kuasa_bpn_nik}} / {{kuasa_bpn_alamat}}', desc: 'Identitas lengkap staf kuasa pengurusan di BPN' },
  { tag: '{{saksi_1_nama}} / {{saksi_1_ttl}} / {{saksi_1_pekerjaan}} / {{saksi_1_nik}} / {{saksi_1_alamat}}', desc: 'Identitas lengkap Saksi 1 Akta & Lampiran' },
  { tag: '{{saksi_2_nama}} / {{saksi_2_ttl}} / {{saksi_2_pekerjaan}} / {{saksi_2_nik}} / {{saksi_2_alamat}}', desc: 'Identitas lengkap Saksi 2 Akta & Lampiran' },
];

const AKTA_FONT = 'Bookman Old Style';
const LAMPIRAN_FONT = 'Bookman Old Style';
const BASIC_FONT_SIZE = 24; // 12 pt
const LINE_SPACING_1_5 = 360; // 1.5 lines (240 * 1.5)
const PARAGRAPH_AFTER_1_5 = 120; // 6 pt

// Pengaturan margin standar sesuai Page Setup:
// Top 2,54 cm (1440), Bottom 2,54 cm (1440), Left 4,5 cm (2551), Right 1 cm (567),
// Gutter 0 cm, Header from Top 0 cm, Footer from Bottom 2 cm (1134)
export const STANDARD_PAGE_MARGINS = {
  top: 1440,
  bottom: 1440,
  left: 2551,
  right: 567,
  gutter: 0,
  header: 0,
  footer: 1134,
};

function createDocxStyles(font = AKTA_FONT) {
  return {
    default: {
      document: {
        run: {
          font,
          size: BASIC_FONT_SIZE,
        },
        paragraph: {
          alignment: AlignmentType.JUSTIFIED,
          spacing: {
            line: LINE_SPACING_1_5,
            after: PARAGRAPH_AFTER_1_5,
          },
        },
      },
    },
  };
}

function p(
  text: string,
  opts?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
    spaceAfter?: number;
    spaceBefore?: number;
    line?: number;
    font?: string;
    indentLeft?: number;
    pageBreakBefore?: boolean;
  }
): Paragraph {
  return new Paragraph({
    alignment: opts?.align ?? AlignmentType.JUSTIFIED,
    pageBreakBefore: opts?.pageBreakBefore ?? false,
    indent: opts?.indentLeft ? { left: opts.indentLeft } : undefined,
    spacing: {
      before: opts?.spaceBefore ?? 0,
      after: opts?.spaceAfter ?? PARAGRAPH_AFTER_1_5,
      line: opts?.line ?? LINE_SPACING_1_5,
    },
    children: [
      new TextRun({
        text,
        bold: opts?.bold ?? false,
        italics: opts?.italic ?? false,
        underline: opts?.underline ? {} : undefined,
        size: opts?.size ?? BASIC_FONT_SIZE,
        font: opts?.font ?? AKTA_FONT,
      }),
    ],
  });
}

function pRuns(
  runs: Array<{ text: string; bold?: boolean; italic?: boolean; underline?: boolean; size?: number }>,
  opts?: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spaceAfter?: number;
    line?: number;
    indentLeft?: number;
    font?: string;
  }
): Paragraph {
  return new Paragraph({
    alignment: opts?.align ?? AlignmentType.JUSTIFIED,
    indent: opts?.indentLeft ? { left: opts.indentLeft } : undefined,
    spacing: {
      after: opts?.spaceAfter ?? PARAGRAPH_AFTER_1_5,
      line: opts?.line ?? LINE_SPACING_1_5,
    },
    children: runs.map(
      (r) =>
        new TextRun({
          text: r.text,
          bold: r.bold ?? false,
          italics: r.italic ?? false,
          underline: r.underline ? {} : undefined,
          size: r.size ?? BASIC_FONT_SIZE,
          font: opts?.font ?? AKTA_FONT,
        })
    ),
  });
}

const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const NO_TABLE_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const THIN_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
  left: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
  right: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
};

// Lebar konten cetak A4 Akta (11906 - 2551 - 567 = 8788 twips)
const AKTA_CONTENT_WIDTH_DXA =
  PAPER_SIZE_A4_TWIPS.width - STANDARD_PAGE_MARGINS.left - STANDARD_PAGE_MARGINS.right;

// Posisi tab-stop kanan dengan 20 twips (~0,35 mm) safety margin agar tidak pernah wrap di Word/LibreOffice/Docs
const AKTA_TAB_RIGHT_DXA = AKTA_CONTENT_WIDTH_DXA - 20;

// Jarak tanda tangan nyaman untuk menempelkan Meterai Rp 10.000 (~2,3 cm) + tanda tangan basah / stempel
const SIGNATURE_SPACE_METERAI = 1440; // 1.0 inch = 2,54 cm
const SIGNATURE_SPACE_STANDARD = 1320; // ~2,33 cm

/**
 * Paragraf Akta dengan garis hubung pengaman (`------`) otomatis rata tepi kanan
 * menggunakan OOXML TabStop RIGHT + LeaderType.HYPHEN agar tidak pernah turun baris.
 */
function aktaDashParagraph(
  text: string,
  opts?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
    spaceAfter?: number;
    spaceBefore?: number;
    line?: number;
    font?: string;
    indentLeft?: number;
    pageBreakBefore?: boolean;
  }
): Paragraph {
  const size = opts?.size ?? BASIC_FONT_SIZE;
  const font = opts?.font ?? AKTA_FONT;
  return new Paragraph({
    alignment: opts?.align ?? AlignmentType.JUSTIFIED,
    pageBreakBefore: opts?.pageBreakBefore ?? false,
    indent: opts?.indentLeft ? { left: opts.indentLeft } : undefined,
    tabStops: [
      {
        type: TabStopType.RIGHT,
        position: AKTA_TAB_RIGHT_DXA,
        leader: LeaderType.HYPHEN,
      },
    ],
    spacing: {
      before: opts?.spaceBefore ?? 0,
      after: opts?.spaceAfter ?? PARAGRAPH_AFTER_1_5,
      line: opts?.line ?? LINE_SPACING_1_5,
    },
    children: [
      new TextRun({
        text,
        bold: opts?.bold ?? false,
        italics: opts?.italic ?? false,
        underline: opts?.underline ? {} : undefined,
        size,
        font,
      }),
      new TextRun({
        children: [new Tab()],
        size,
        font,
      }),
    ],
  });
}

/**
 * Paragraf multi-run Akta dengan garis hubung pengaman otomatis rata tepi kanan.
 */
function aktaDashRuns(
  runs: Array<{ text: string; bold?: boolean; italic?: boolean; underline?: boolean; size?: number }>,
  opts?: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spaceAfter?: number;
    spaceBefore?: number;
    line?: number;
    indentLeft?: number;
    font?: string;
  }
): Paragraph {
  const font = opts?.font ?? AKTA_FONT;
  return new Paragraph({
    alignment: opts?.align ?? AlignmentType.JUSTIFIED,
    indent: opts?.indentLeft ? { left: opts.indentLeft } : undefined,
    tabStops: [
      {
        type: TabStopType.RIGHT,
        position: AKTA_TAB_RIGHT_DXA,
        leader: LeaderType.HYPHEN,
      },
    ],
    spacing: {
      before: opts?.spaceBefore ?? 0,
      after: opts?.spaceAfter ?? PARAGRAPH_AFTER_1_5,
      line: opts?.line ?? LINE_SPACING_1_5,
    },
    children: [
      ...runs.map(
        (r) =>
          new TextRun({
            text: r.text,
            bold: r.bold ?? false,
            italics: r.italic ?? false,
            underline: r.underline ? {} : undefined,
            size: r.size ?? BASIC_FONT_SIZE,
            font,
          })
      ),
      new TextRun({
        children: [new Tab()],
        size: BASIC_FONT_SIZE,
        font,
      }),
    ],
  });
}

/**
 * Judul tengah diapit garis hubung simetris kiri-kanan (mis. `--- PIHAK PERTAMA ---`, `--- Pasal 1 ---`, `--- KHUSUS ---`)
 * menggunakan TabStop CENTER + RIGHT dengan LeaderType.HYPHEN sehingga selalu tepat 1 baris penuh.
 */
export function aktaCenteredDashHeading(
  label: string,
  opts?: {
    bold?: boolean;
    underline?: boolean;
    size?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    line?: number;
    font?: string;
    contentWidthDxa?: number;
  }
): Paragraph {
  const size = opts?.size ?? BASIC_FONT_SIZE;
  const font = opts?.font ?? AKTA_FONT;
  const bold = opts?.bold ?? false;
  const rightPos = (opts?.contentWidthDxa ?? AKTA_CONTENT_WIDTH_DXA) - 20;
  const centerPos = Math.round(rightPos / 2);
  const trimmed = label.trim();

  const labelRuns: TextRun[] = opts?.underline
    ? [
        new TextRun({ text: ' ', bold, size, font }),
        new TextRun({ text: trimmed, bold, underline: {}, size, font }),
        new TextRun({ text: ' ', bold, size, font }),
      ]
    : [new TextRun({ text: ` ${trimmed} `, bold, size, font })];

  return new Paragraph({
    alignment: AlignmentType.LEFT,
    tabStops: [
      {
        type: TabStopType.CENTER,
        position: centerPos,
        leader: LeaderType.HYPHEN,
      },
      {
        type: TabStopType.RIGHT,
        position: rightPos,
        leader: LeaderType.HYPHEN,
      },
    ],
    spacing: {
      before: opts?.spaceBefore ?? 0,
      after: opts?.spaceAfter ?? 60,
      line: opts?.line ?? LINE_SPACING_1_5,
    },
    children: [
      new TextRun({
        children: [new Tab()],
        bold,
        size,
        font,
      }),
      ...labelRuns,
      new TextRun({
        children: [new Tab()],
        bold,
        size,
        font,
      }),
    ],
  });
}

/**
 * Baris daftar batas / letak tanah (`- Utara : ... ------`) dengan titik dua sejajar vertikal
 * dan garis hubung pengaman rata tepi kanan.
 */
function aktaKeyValueDashLine(label: string, value: string, spaceAfter = 40): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    indent: { left: 240 },
    tabStops: [
      {
        type: TabStopType.LEFT,
        position: 1900,
      },
      {
        type: TabStopType.RIGHT,
        position: AKTA_TAB_RIGHT_DXA,
        leader: LeaderType.HYPHEN,
      },
    ],
    spacing: {
      after: spaceAfter,
      line: LINE_SPACING_1_5,
    },
    children: [
      new TextRun({ text: `-   ${label}`, size: BASIC_FONT_SIZE, font: AKTA_FONT }),
      new TextRun({ children: [new Tab()], size: BASIC_FONT_SIZE, font: AKTA_FONT }),
      new TextRun({ text: `: ${value} `, size: BASIC_FONT_SIZE, font: AKTA_FONT }),
      new TextRun({ children: [new Tab()], size: BASIC_FONT_SIZE, font: AKTA_FONT }),
    ],
  });
}

function makeBorderlessRow(
  leftText: string,
  rightText: string,
  leftPct = 42,
  font = LAMPIRAN_FONT,
  size = BASIC_FONT_SIZE,
  opts?: { line?: number; spaceAfter?: number }
): TableRow {
  const line = opts?.line ?? LINE_SPACING_1_5;
  const spaceAfter = opts?.spaceAfter ?? 40;
  return new TableRow({
    children: [
      new TableCell({
        width: { size: leftPct, type: WidthType.PERCENTAGE },
        borders: NO_BORDER,
        children: [p(leftText, { align: AlignmentType.LEFT, spaceAfter, line, font, size })],
      }),
      new TableCell({
        width: { size: 100 - leftPct, type: WidthType.PERCENTAGE },
        borders: NO_BORDER,
        children: [p(rightText, { align: AlignmentType.LEFT, spaceAfter, line, font, size })],
      }),
    ],
  });
}

function makeSimpleKvTable(rows: Array<[string, string]>, font = LAMPIRAN_FONT, size = BASIC_FONT_SIZE): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_TABLE_BORDERS,
    rows: rows.map(([k, v]) => makeBorderlessRow(k, `: ${v}`, 32, font, size)),
  });
}

function aktaKopSurat(): Paragraph[] {
  return [
    p('PEJABAT PEMBUAT AKTA TANAH SEMENTARA', {
      bold: true,
      align: AlignmentType.CENTER,
      size: 32, // 16 pt
      spaceAfter: 20,
      line: 240,
    }),
    p('(PPATS)', {
      bold: true,
      align: AlignmentType.CENTER,
      size: 32, // 16 pt
      spaceAfter: 20,
      line: 240,
    }),
    p('{{jabatan_ppats_upper}}', {
      bold: true,
      align: AlignmentType.CENTER,
      size: 32, // 16 pt
      spaceAfter: 20,
      line: 240,
    }),
    p('{{nama_ppats}}', {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      size: 28, // 14 pt
      spaceAfter: 20,
      line: 240,
    }),
    p('DAERAH KERJA : {{nama_kecamatan_upper}}, {{nama_kabupaten_upper}}', {
      bold: true,
      align: AlignmentType.CENTER,
      size: 20,
      spaceAfter: 20,
      line: 240,
    }),
    p('Surat Keputusan {{sk_ppats_penerbit}}', {
      bold: true,
      align: AlignmentType.CENTER,
      size: 19,
      spaceAfter: 20,
      line: 240,
    }),
    p('Nomor : {{sk_ppats_nomor}} Tanggal {{sk_ppats_tanggal}}', {
      bold: true,
      align: AlignmentType.CENTER,
      size: 19,
      spaceAfter: 20,
      line: 240,
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200, line: 240 },
      border: {
        bottom: { style: BorderStyle.DOUBLE, size: 12, color: '000000' },
      },
      children: [
        new TextRun({
          text: '{{alamat_kantor}}, Telp. {{telepon_kantor}}',
          bold: true,
          size: 19,
          font: AKTA_FONT,
        }),
      ],
    }),
  ];
}

const FOOTER_TOP_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 6, color: '64748B' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function aktaFooter(): Footer {
  const leftW = Math.round(AKTA_CONTENT_WIDTH_DXA * 0.6);
  const rightW = AKTA_CONTENT_WIDTH_DXA - leftW;
  return new Footer({
    children: [
      new Table({
        width: { size: AKTA_CONTENT_WIDTH_DXA, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        columnWidths: [leftW, rightW],
        borders: NO_TABLE_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: leftW, type: WidthType.DXA },
                borders: FOOTER_TOP_BORDER,
                children: [
                  p('{{judul_akta}}', { align: AlignmentType.LEFT, size: BASIC_FONT_SIZE, spaceBefore: 60, spaceAfter: 0, line: 260 }),
                  p('{{nama_ppats}}', { align: AlignmentType.LEFT, bold: true, italic: true, size: BASIC_FONT_SIZE, spaceAfter: 0, line: 260 }),
                  p('Daerah Kerja : {{nama_kecamatan}}.', { align: AlignmentType.LEFT, size: BASIC_FONT_SIZE, spaceAfter: 0, line: 260 }),
                ],
              }),
              new TableCell({
                width: { size: rightW, type: WidthType.DXA },
                borders: FOOTER_TOP_BORDER,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 60, after: 0, line: 260 },
                    children: [
                      new TextRun({ text: 'Halaman ', size: BASIC_FONT_SIZE, font: AKTA_FONT }),
                      new TextRun({ children: [PageNumber.CURRENT], size: BASIC_FONT_SIZE, font: AKTA_FONT }),
                      new TextRun({ text: ' dari ', size: BASIC_FONT_SIZE, font: AKTA_FONT }),
                      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: BASIC_FONT_SIZE, font: AKTA_FONT }),
                      new TextRun({ text: ' halaman', size: BASIC_FONT_SIZE, font: AKTA_FONT }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function pertanianPasal3Block(): Paragraph[] {
  return [
    p('{{#is_pertanian}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
    aktaCenteredDashHeading('Pasal 3', { spaceAfter: 60 }),
    aktaDashParagraph(
      'Pihak Kedua dengan ini menyatakan bahwa perjanjian {{perbuatan_pertanian}} ini kepemilikan tanahnya tidak melanggar ketentuan maksimum penguasaan tanah menurut peraturan perundang-undangan yang berlaku sebagaimana tercantum dalam pernyataan tanggal : {{tanggal_pernyataan_pertanian}}.',
      { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
    ),
    p('{{/is_pertanian}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
  ];
}

function buildAktaDocument(): Document {
  return new Document({
    styles: createDocxStyles(AKTA_FONT),
    sections: [
      {
        properties: {
          page: {
            size: PAPER_SIZE_A4_TWIPS,
            margin: STANDARD_PAGE_MARGINS,
          },
        },
        footers: {
          default: aktaFooter(),
        },
        children: [
          ...aktaKopSurat(),
          p('{{judul_akta}}', { bold: true, align: AlignmentType.CENTER, size: BASIC_FONT_SIZE, spaceAfter: 60 }),
          p('Nomor : {{nomor_akta}}', { bold: true, align: AlignmentType.CENTER, size: BASIC_FONT_SIZE, spaceAfter: 60 }),
          p('Lembar Pertama', { bold: true, align: AlignmentType.CENTER, size: BASIC_FONT_SIZE, spaceAfter: 180 }),

          aktaDashRuns(
            [
              {
                text: 'Pada hari ini, {{hari_akta}}, Tanggal {{tanggal_angka}} ({{tanggal_akta_huruf}}) {{bulan_akta}} Tahun {{tahun_angka}} ({{tahun_akta_huruf}}), hadir dihadapan Saya, ',
              },
              { text: '{{nama_ppats}}', bold: true },
              { text: ' yang berdasarkan ' },
              { text: 'SK. Kepala Badan Pertanahan Nasional {{sk_ppats_penerbit}}, Nomor: {{sk_ppats_nomor}} Tanggal {{sk_ppats_tanggal}}', bold: true },
              {
                text: ' diangkat sebagai Pejabat Pembuat Akta Tanah Sementara yang dimaksud dalam Pasal 7 Peraturan Pemerintah Nomor 24 Tahun 1997 tentang Pendaftaran Tanah, dengan daerah ',
              },
              { text: '{{nama_kecamatan}}, {{nama_kabupaten}}', bold: true },
              { text: ' dan berkantor di ' },
              { text: '{{nama_kecamatan}}, {{nama_kabupaten}}', bold: true },
              {
                text: ' dengan dihadiri oleh saksi-saksi yang saya kenal dan akan disebut pada bagian akhir akta ini : ',
              },
            ],
            { align: AlignmentType.JUSTIFIED, spaceAfter: 140, line: LINE_SPACING_1_5 }
          ),

          // ==================== PARA PIHAK (AJB / HIBAH: Pihak I & II; APHB: Terpisah I..XX+) ====================
          p('{{#is_not_aphb}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          p('{{#pihak_pertama}}', { align: AlignmentType.LEFT, spaceAfter: 20, line: 240 }),
          aktaDashRuns(
            [
              { text: '{{no_urut_pihak}}. ', bold: true },
              { text: '{{sebutan}} {{nama}}, ', bold: true },
              {
                text: 'Warga Negara Indonesia, lahir di {{tempat_lahir}} pada tanggal {{tanggal_lahir}}, Pekerjaan {{pekerjaan}}, bertempat tinggal di {{alamat_lengkap}}. Pemegang Kartu Penduduk Nomor : {{nik}}.',
              },
            ],
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          p('{{/pihak_pertama}}', { align: AlignmentType.LEFT, spaceAfter: 20, line: 240 }),

          aktaDashParagraph('Selaku {{pihak1_selaku}}, untuk selanjutnya dalam akta ini disebut : ', {
            align: AlignmentType.JUSTIFIED,
            indentLeft: 360,
            spaceAfter: 60,
          }),
          aktaCenteredDashHeading('PIHAK PERTAMA', {
            bold: true,
            spaceAfter: 140,
          }),

          // PERSETUJUAN PASANGAN / TANPA PERSETUJUAN (untuk AJB/Hibah ditulis setelah Pihak I seperti contoh)
          p('{{#ada_persetujuan_pasangan}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          p('{{#persetujuan_pasangan}}', { align: AlignmentType.LEFT, spaceAfter: 20, line: 240 }),
          aktaDashParagraph(
            'Menurut keterangannya dalam melakukan perbuatan hukum ini telah mendapatkan persetujuan dari Pasangannya yang bernama {{sebutan}} {{nama}}, Warga Negara Indonesia, lahir di {{tempat_lahir}} pada tanggal {{tanggal_lahir}}, Pekerjaan {{pekerjaan}}, bertempat tinggal di {{alamat_lengkap}}. Pemegang Kartu Penduduk Nomor : {{nik}}.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          p('{{/persetujuan_pasangan}}', { align: AlignmentType.LEFT, spaceAfter: 20, line: 240 }),
          p('{{/ada_persetujuan_pasangan}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),

          p('{{#tanpa_persetujuan}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashParagraph('{{keterangan_tanpa_persetujuan}}', {
            align: AlignmentType.JUSTIFIED,
            indentLeft: 360,
            spaceAfter: 100,
            line: LINE_SPACING_1_5,
          }),
          p('{{/tanpa_persetujuan}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),

          // PIHAK KEDUA
          p('{{#pihak_kedua}}', { align: AlignmentType.LEFT, spaceAfter: 20, line: 240 }),
          aktaDashRuns(
            [
              { text: '{{no_urut_pihak}}. ', bold: true },
              { text: '{{sebutan}} {{nama}}, ', bold: true },
              {
                text: 'Warga Negara Indonesia, lahir di {{tempat_lahir}} pada tanggal {{tanggal_lahir}}, Pekerjaan {{pekerjaan}}, bertempat tinggal di {{alamat_lengkap}}. Pemegang Kartu Penduduk Nomor : {{nik}}.',
              },
            ],
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          p('{{/pihak_kedua}}', { align: AlignmentType.LEFT, spaceAfter: 20, line: 240 }),

          aktaDashParagraph('Selaku {{pihak2_selaku}}, untuk selanjutnya dalam akta ini disebut : ', {
            align: AlignmentType.JUSTIFIED,
            indentLeft: 360,
            spaceAfter: 60,
          }),
          aktaCenteredDashHeading('PIHAK KEDUA', {
            bold: true,
            spaceAfter: 140,
          }),

          // Fallback jika ada Pihak III+ pada layanan non-APHB
          p('{{#pihak_lanjutan}}', { align: AlignmentType.LEFT, spaceAfter: 20, line: 240 }),
          aktaDashRuns(
            [
              { text: '{{no_urut_pihak}}. ', bold: true },
              { text: '{{sebutan}} {{nama}}, ', bold: true },
              {
                text: 'Warga Negara Indonesia, lahir di {{tempat_lahir}} pada tanggal {{tanggal_lahir}}, Pekerjaan {{pekerjaan}}, bertempat tinggal di {{alamat_lengkap}}. Pemegang Kartu Penduduk Nomor : {{nik}}.',
              },
            ],
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('{{peran_label_upper}}', {
            bold: true,
            spaceAfter: 140,
          }),
          p('{{/pihak_lanjutan}}', { align: AlignmentType.LEFT, spaceAfter: 20, line: 240 }),
          p('{{/is_not_aphb}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),

          // KHUSUS APHB: Semua pemilik menjadi pihak terpisah (Pihak I, II, III, ..., XX+)
          // dan persetujuan / tanpa persetujuan ditulis SETELAH pihak terakhir
          p('{{#is_aphb}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          p('{{#pihak_terpisah}}', { align: AlignmentType.LEFT, spaceAfter: 20, line: 240 }),
          aktaDashRuns(
            [
              { text: '{{no_urut_pihak}}. ', bold: true },
              { text: '{{sebutan}} {{nama}}, ', bold: true },
              {
                text: 'Warga Negara Indonesia, lahir di {{tempat_lahir}} pada tanggal {{tanggal_lahir}}, Pekerjaan {{pekerjaan}}, bertempat tinggal di {{alamat_lengkap}}. Pemegang Kartu Penduduk Nomor : {{nik}}.',
              },
            ],
            { align: AlignmentType.JUSTIFIED, spaceAfter: 80, line: LINE_SPACING_1_5 }
          ),
          aktaDashParagraph('Untuk selanjutnya dalam akta ini disebut : ', {
            align: AlignmentType.JUSTIFIED,
            indentLeft: 360,
            spaceAfter: 60,
          }),
          aktaCenteredDashHeading('{{peran_label_upper}}', {
            bold: true,
            spaceAfter: 120,
          }),
          p('{{/pihak_terpisah}}', { align: AlignmentType.LEFT, spaceAfter: 20, line: 240 }),

          p('{{#ada_persetujuan_pasangan}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          p('{{#persetujuan_pasangan}}', { align: AlignmentType.LEFT, spaceAfter: 20, line: 240 }),
          aktaDashParagraph(
            'Menurut keterangannya dalam melakukan perbuatan hukum ini telah mendapatkan persetujuan dari Pasangannya yang bernama {{sebutan}} {{nama}}, Warga Negara Indonesia, lahir di {{tempat_lahir}} pada tanggal {{tanggal_lahir}}, Pekerjaan {{pekerjaan}}, bertempat tinggal di {{alamat_lengkap}}. Pemegang Kartu Penduduk Nomor : {{nik}}.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          p('{{/persetujuan_pasangan}}', { align: AlignmentType.LEFT, spaceAfter: 20, line: 240 }),
          p('{{/ada_persetujuan_pasangan}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),

          p('{{#tanpa_persetujuan}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashParagraph('{{keterangan_tanpa_persetujuan}}', {
            align: AlignmentType.JUSTIFIED,
            indentLeft: 360,
            spaceAfter: 100,
            line: LINE_SPACING_1_5,
          }),
          p('{{/tanpa_persetujuan}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          p('{{/is_aphb}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),

          aktaDashParagraph(
            'Para penghadap dikenal oleh saya, Pejabat Pembuat Akta Tanah Sementara {{jabatan_ppats}}. {{kalimat_perbuatan_pihak}}',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 120, line: LINE_SPACING_1_5 }
          ),
          p('{{#is_sertipikat_digital}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashParagraph(
            '{{jenis_hak}} Nibel : {{nib}}/Desa {{desa_tanah}}, Kecamatan {{kecamatan_tanah}}, {{kabupaten_tanah}} atas sebidang tanah seluas : {{luas_m2}} M2 ({{luas_terbilang}}) ',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          p('{{/is_sertipikat_digital}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          p('{{#is_sertipikat_analog}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashParagraph(
            '{{jenis_hak}} Nomor : {{nomor_hak_analog}} /Desa {{desa_tanah}}, Kecamatan {{kecamatan_tanah}}, {{kabupaten_tanah}} atas sebidang tanah sebagaimana diuraikan dalam Surat Ukur tanggal : {{surat_ukur_tanggal}} , Nomor: {{surat_ukur_nomor}}, seluas : {{luas_m2}} M2 ({{luas_terbilang}}) Dengan Nomor Identifikasi Bidang tanah (NIB) : {{nib}} ',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          p('{{/is_sertipikat_analog}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashParagraph('Dengan batas-batas : ', {
            align: AlignmentType.LEFT,
            spaceAfter: 60,
          }),
          aktaKeyValueDashLine('Utara', '{{batas_utara}}', 40),
          aktaKeyValueDashLine('Timur', '{{batas_timur}}', 40),
          aktaKeyValueDashLine('Selatan', '{{batas_selatan}}', 40),
          aktaKeyValueDashLine('Barat', '{{batas_barat}}', 100),

          aktaDashParagraph('Berdasarkan alat-alat bukti berupa : ', {
            align: AlignmentType.LEFT,
            spaceAfter: 60,
          }),
          p('{{#is_sertipikat_digital}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashParagraph('1. Sertipikat {{jenis_hak}} Nibel : {{nib}} Desa {{desa_tanah}}.', {
            align: AlignmentType.JUSTIFIED,
            indentLeft: 200,
            spaceAfter: 40,
          }),
          p('{{/is_sertipikat_digital}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          p('{{#is_sertipikat_analog}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashParagraph(
            '1. Sertipikat {{jenis_hak}} Nomor : {{nomor_hak_analog}} NIB : {{nib}} Surat Ukur Tgl. {{surat_ukur_tanggal}} Nomor : {{surat_ukur_nomor}} Desa {{desa_tanah}}.',
            {
              align: AlignmentType.JUSTIFIED,
              indentLeft: 200,
              spaceAfter: 40,
            }
          ),
          p('{{/is_sertipikat_analog}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashParagraph('2. Foto copy Kartu Tanda Penduduk dan Kartu Keluarga Para Penghadap.', {
            align: AlignmentType.JUSTIFIED,
            indentLeft: 200,
            spaceAfter: 40,
          }),
          aktaDashParagraph('3. Foto copy SPPT PBB NOP: {{nop}} Tahun {{tahun_pajak}}.', {
            align: AlignmentType.JUSTIFIED,
            indentLeft: 200,
            spaceAfter: 40,
          }),
          aktaDashParagraph('4. SSPD BPHTB, SSP PPh.', {
            align: AlignmentType.JUSTIFIED,
            indentLeft: 200,
            spaceAfter: 100,
          }),

          aktaDashParagraph('Terletak di : ', { align: AlignmentType.LEFT, spaceAfter: 40 }),
          aktaKeyValueDashLine('Propinsi', '{{provinsi_tanah}}', 40),
          aktaKeyValueDashLine('Kabupaten', '{{kabupaten_tanah}}', 40),
          aktaKeyValueDashLine('Kecamatan', '{{kecamatan_tanah}}', 40),
          aktaKeyValueDashLine('Desa', '{{desa_tanah}}', 100),

          // ==================== 1. KLAUSUL & PASAL KHUSUS APHB ====================
          p('{{#is_aphb}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashParagraph(
            'Selanjutnya dalam akta ini disebut “Hak Bersama”. Para pihak selanjutnya menerangkan bahwa mereka telah sepakat untuk mengakhiri pemilikan Hak Bersama tersebut, dan untuk dengan ini menyepakati pembagian Hak Bersama tersebut sebagai berikut : ',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          p('{{#is_sertipikat_digital}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashRuns(
            [
              { text: '{{penerima_aphb_klausul}}', bold: true },
              {
                text: ', memperoleh dan menjadi {{penerima_aphb_status_hak}} dari {{jenis_hak}} atas sebidang tanah Nibel : {{nib}} / Desa {{desa_tanah}} ',
              },
            ],
            { align: AlignmentType.JUSTIFIED, spaceAfter: 60, line: LINE_SPACING_1_5 }
          ),
          p('{{/is_sertipikat_digital}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          p('{{#is_sertipikat_analog}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashRuns(
            [
              { text: '{{penerima_aphb_klausul}}', bold: true },
              {
                text: ', memperoleh dan menjadi {{penerima_aphb_status_hak}} dari {{jenis_hak}} Nomor : {{nomor_hak_analog}} / NIB : {{nib}} / Desa {{desa_tanah}} ',
              },
            ],
            { align: AlignmentType.JUSTIFIED, spaceAfter: 60, line: LINE_SPACING_1_5 }
          ),
          p('{{/is_sertipikat_analog}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashParagraph('sebagaimana telah diuraikan di atas.', {
            align: AlignmentType.JUSTIFIED,
            spaceAfter: 100,
            line: LINE_SPACING_1_5,
          }),
          aktaDashParagraph('Pembagian Hak Bersama diatas juga meliputi : ', {
            align: AlignmentType.LEFT,
            spaceAfter: 60,
          }),
          aktaDashParagraph(
            'Tanah beserta segala sesuatu yang tumbuh, berdiri dan tertanam diatas tanah tersebut tanpa terkecuali.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaDashParagraph('Selanjutnya para pihak menerangkan bahwa : ', {
            align: AlignmentType.LEFT,
            spaceAfter: 60,
          }),
          aktaDashParagraph(
            'Dalam pembagian hak bersama ini tidak terdapat kelebihan nilai yang diperoleh oleh salah satu pihak.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaDashParagraph('Pembagian hak bersama ini dilakukan dengan syarat-syarat lebih lanjut sebagai berikut : ', {
            align: AlignmentType.JUSTIFIED,
            spaceAfter: 100,
            line: LINE_SPACING_1_5,
          }),

          aktaCenteredDashHeading('Pasal 1', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Mulai hari ini yang diuraikan dalam akta ini telah menjadi milik masing-masing pihak yang memperolehnya dan karenanya segala keuntungan yang didapat dari, dan segala kerugian / beban atas hak tersebut diatas menjadi hak / beban pihak yang memperoleh hak.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal 2', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Hak tersebut diterima oleh masing-masing pihak yang memperolehnya menurut keadaan sebagaimana didapatinya pada hari ini dan masing-masing pihak dengan ini menyatakan tidak akan mengadakan segala tuntutan mengenai kerusakan dan / atau cacat yang tampak dan / atau tidak tampak.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          ...pertanianPasal3Block(),
          aktaCenteredDashHeading('Pasal {{no_pasal_pengukuran}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Dalam hal terdapat perbedaan luas tanah yang diuraikan dalam pembagian hak bersama ini dengan hasil pengukuran oleh instansi Badan Pertanahan {{kabupaten_tanah}}, maka para pihak akan menerima hasil pengukuran instansi Badan Pertanahan {{kabupaten_tanah}} tersebut.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal {{no_pasal_keabsahan}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Semua pihak menjamin bahwa surat tanda bukti hak atas tanahnya adalah satu-satunya yang sah, tidak pernah dipalsukan dan tidak pernah dibuat duplikatnya oleh instansi yang berwenang atas permintaannya. Para pihak menjamin bahwa pembagian tersebut di atas adalah kesepakatan bersama. Sehubungan dengan hal tersebut maka semua pihak menyatakan tegas membebaskan Pejabat Pembuat Akta Tanah Sementara dari segala tuntutan berupa apapun juga mengenai hal-hal tersebut.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal {{no_pasal_domisili}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Para pihak dalam hal ini dengan segala akibatnya memilih tempat kediaman hukum yang umum dan tidak berubah pada Kantor Panitera Pengadilan Negeri {{kabupaten_tanah}}.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal {{no_pasal_biaya}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Biaya pembuatan akta ini, uang saksi dan segala biaya mengenai peralihan hak ini, dibayar oleh pihak penerima.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          p('{{/is_aphb}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),

          // ==================== 2. KLAUSUL & PASAL KHUSUS JUAL BELI (AJB) ====================
          p('{{#is_ajb}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashParagraph('Jual beli ini meliputi pula : ', { align: AlignmentType.LEFT, spaceAfter: 60 }),
          aktaDashParagraph(
            'Tanah dan bangunan, berikut segala sesuatu yang terdapat diatas bidang tanah hak tersebut yang menurut sifat, peruntukannya atau menurut penetapan Undang-Undang dapat dianggap sebagai barang tidak bergerak. Selanjutnya semua yang diuraikan di atas dalam akta ini disebut “Obyek Jual Beli”.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 120, line: LINE_SPACING_1_5 }
          ),
          aktaDashParagraph('Pihak Pertama dan Pihak Kedua menerangkan bahwa : ', { align: AlignmentType.LEFT, spaceAfter: 80 }),
          aktaDashParagraph(
            'a. Jual beli ini dilakukan dengan harga {{nilai_transaksi_rp}} ({{nilai_transaksi_terbilang}}).',
            { indentLeft: 200, align: AlignmentType.JUSTIFIED, spaceAfter: 60, line: LINE_SPACING_1_5 }
          ),
          aktaDashParagraph(
            'b. Pihak Pertama mengaku telah menerima sepenuhnya uang tersebut diatas dari Pihak Kedua dan untuk penerimaan uang tersebut, akta ini berlaku pula sebagai tanda penerimaan yang sah (kwitansi).',
            { indentLeft: 200, align: AlignmentType.JUSTIFIED, spaceAfter: 60, line: LINE_SPACING_1_5 }
          ),
          aktaDashParagraph('c. Jual beli ini dilakukan dengan syarat-syarat sebagai berikut : ', {
            align: AlignmentType.JUSTIFIED,
            indentLeft: 200,
            spaceAfter: 100,
          }),

          aktaCenteredDashHeading('Pasal 1', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Mulai hari ini obyek Jual Beli yang diuraikan dalam akta ini telah menjadi hak milik Pihak Kedua dan karenanya segala keuntungan yang didapat dari, dan segala kerugian/beban atas obyek Jual Beli tersebut di atas menjadi hak/beban Pihak Kedua.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal 2', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Pihak Pertama Menjamin, bahwa obyek Jual Beli tersebut diatas tidak tersangkut dalam satu sengketa, bebas dari sitaan, tidak terikat sebagai jaminan untuk sesuatu utang yang tidak tercatat dalam sertipikat, dan bebas dari beban-beban lain.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          ...pertanianPasal3Block(),
          aktaCenteredDashHeading('Pasal {{no_pasal_pengukuran}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Dalam hal terdapat perbedaan luas tanah yang menjadi obyek Jual Beli dalam akta ini dengan hasil pengukuran oleh instansi Badan Pertanahan {{kabupaten_tanah}}, maka para pihak akan menerima hasil pengukuran instansi Badan Pertanahan {{kabupaten_tanah}} tersebut dengan tidak mempermasalahkan dan tidak akan saling mengadakan gugatan.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal {{no_pasal_keabsahan}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            '- Pihak pertama menjamin bahwa surat tanda bukti hak atas tanahnya adalah satu-satunya yang sah, tidak pernah dipalsukan dan tidak pernah dibuat duplikatnya oleh instansi yang berwenang atas permintaannya.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 60, line: LINE_SPACING_1_5 }
          ),
          aktaDashParagraph(
            '- Pihak Kedua telah melihat dan mengetahui keadaan tanah serta bukti surat kepemilikan atas tanah tersebut dan menerangkan dapat menerima sebagaimana mestinya.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 60, line: LINE_SPACING_1_5 }
          ),
          aktaDashParagraph(
            '- Menurut keterangan para Pihak dokumen-dokumen penyertanya adalah asli dan tidak dipalsukan.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 60, line: LINE_SPACING_1_5 }
          ),
          aktaDashParagraph(
            '- Sehubungan dengan hal tersebut maka para pihak menyatakan dengan tegas membebaskan Pejabat Pembuat Akta Tanah dari segala Tuntutan berupa apapun mengenai hal-hal tersebut.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal {{no_pasal_domisili}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Kedua belah pihak dalam hal ini dengan segala akibatnya memilih tempat kediaman hukum yang umum dan tidak berubah pada Kantor Panitera Pengadilan Negeri {{kabupaten_tanah}}.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal {{no_pasal_biaya}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Biaya pembuatan akta ini, uang saksi dan segala biaya peralihan hak ini dibayar oleh Pihak Penerima.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          p('{{/is_ajb}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),

          // ==================== 3. KLAUSUL & PASAL KHUSUS AKTA HIBAH ====================
          p('{{#is_hibah}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashParagraph('Hibah ini meliputi pula : ', { align: AlignmentType.LEFT, spaceAfter: 60 }),
          aktaDashParagraph(
            'Berikut segala sesuatu yang terdapat diatas bidang tanah hak tersebut yang menurut sifat, peruntukannya atau menurut penetapan Undang-Undang dapat dianggap sebagai barang tidak bergerak.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 80, line: LINE_SPACING_1_5 }
          ),
          aktaDashParagraph('Selanjutnya semua yang diuraikan di atas dalam akta ini disebut “Obyek Hibah”.', {
            align: AlignmentType.JUSTIFIED,
            spaceAfter: 80,
            line: LINE_SPACING_1_5,
          }),
          aktaDashParagraph('Pihak Pertama dan Pihak Kedua menerangkan bahwa hibah ini dilakukan dengan syarat-syarat sebagai berikut : ', {
            align: AlignmentType.JUSTIFIED,
            spaceAfter: 100,
            line: LINE_SPACING_1_5,
          }),

          aktaCenteredDashHeading('Pasal 1', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Mulai hari ini obyek Hibah yang diuraikan dalam akta ini telah menjadi hak milik Pihak Kedua dan karenanya segala keuntungan yang didapat dari, dan segala kerugian/ beban atas obyek Hibah tersebut di atas menjadi hak/ beban Pihak Kedua.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal 2', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Pihak Pertama Menjamin, bahwa obyek Hibah tersebut diatas tidak tersangkut dalam satu sengketa, bebas dari sitaan, tidak terikat sebagai jaminan untuk sesuatu utang yang tidak tercatat dalam sertipikat, dan bebas dari beban-beban lainnya yang berupa apapun.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          ...pertanianPasal3Block(),
          aktaCenteredDashHeading('Pasal {{no_pasal_pengukuran}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Dalam hal terdapat perbedaan luas tanah yang menjadi obyek Hibah dalam akta ini dengan hasil pengukuran oleh instansi Badan Pertanahan {{kabupaten_tanah}}, maka para pihak akan menerima hasil pengukuran instansi Badan Pertanahan {{kabupaten_tanah}} tersebut dengan tidak mempermasalahkan dan tidak akan saling mengadakan gugatan.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal {{no_pasal_penerimaan_hibah}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Pihak Kedua mengaku telah menerima {{penggunaan_tanah}} yang menjadi obyek Hibah tersebut dari Pihak Pertama.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal {{no_pasal_penjaminan_hibah}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Para pihak dengan ini menjamin kebenaran semua data-data atau dokumen-dokumen yang disampaikan kepada saya selaku Pejabat Pembuat Akta Tanah Sementara, bilamana dikemudian hari ternyata timbul masalah atau ada tuntutan hukum dari pihak yang berkepentingan maka para pihak akan bertanggung jawab atas segala resiko yang timbul dari saya selaku Pejabat Pembuat Akta Tanah Sementara dibebaskan dari segala tuntutan hukum.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal {{no_pasal_domisili}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Kedua belah pihak dalam hal ini dengan segala akibatnya memilih tempat kediaman hukum yang umum dan tidak berubah pada Kantor Panitera Pengadilan Negeri {{kabupaten_tanah}}.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal {{no_pasal_biaya}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Biaya pembuatan akta ini, uang saksi dan segala biaya peralihan hak ini dibayar oleh Pihak Penerima.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          p('{{/is_hibah}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),

          // ==================== 4. KLAUSUL & PASAL LAYANAN LAINNYA (WARIS / PEMECAHAN) ====================
          p('{{#is_lainnya}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          aktaDashParagraph('Peralihan hak ini meliputi pula : ', { align: AlignmentType.LEFT, spaceAfter: 60 }),
          aktaDashParagraph(
            'Tanah dan bangunan, berikut segala sesuatu yang terdapat diatas bidang tanah hak tersebut yang menurut sifat, peruntukannya atau menurut penetapan Undang-Undang dapat dianggap sebagai barang tidak bergerak. Selanjutnya semua yang diuraikan di atas dalam akta ini disebut "Obyek Peralihan Hak".',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 120, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal 1', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Mulai hari ini obyek yang diuraikan dalam akta ini telah menjadi hak milik Pihak Kedua dan karenanya segala keuntungan yang didapat dari, dan segala kerugian/beban atas obyek tersebut di atas menjadi hak/beban Pihak Kedua.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal 2', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Pihak Pertama menjamin, bahwa obyek tersebut diatas tidak tersangkut dalam satu sengketa, bebas dari sitaan, tidak terikat sebagai jaminan untuk sesuatu utang yang tidak tercatat dalam sertipikat, dan bebas dari beban-beban lain.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          ...pertanianPasal3Block(),
          aktaCenteredDashHeading('Pasal {{no_pasal_pengukuran}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Dalam hal terdapat perbedaan luas tanah yang menjadi obyek dalam akta ini dengan hasil pengukuran oleh instansi Badan Pertanahan {{kabupaten_tanah}}, maka para pihak akan menerima hasil pengukuran instansi Badan Pertanahan {{kabupaten_tanah}} tersebut dengan tidak mempermasalahkan dan tidak akan saling mengadakan gugatan.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal {{no_pasal_keabsahan}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Para pihak menjamin bahwa surat tanda bukti hak atas tanah serta dokumen-dokumen penyertanya adalah asli, sah, dan membebaskan Pejabat Pembuat Akta Tanah Sementara dari segala tuntutan berupa apapun mengenai hal-hal tersebut.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal {{no_pasal_domisili}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Kedua belah pihak dalam hal ini dengan segala akibatnya memilih tempat kediaman hukum yang umum dan tidak berubah pada Kantor Panitera Pengadilan Negeri {{kabupaten_tanah}}.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaCenteredDashHeading('Pasal {{no_pasal_biaya}}', { spaceAfter: 60 }),
          aktaDashParagraph(
            'Biaya pembuatan akta ini, uang saksi dan segala biaya peralihan hak ini dibayar oleh Pihak Penerima.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          p('{{/is_lainnya}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),

          // ==================== SAKSI-SAKSI ====================
          aktaDashParagraph(
            'Akhirnya hadir juga dihadapan saya, dengan dihadiri oleh saksi-saksi yang sama dan disebutkan pada akhir akta ini.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaDashRuns(
            [
              { text: '1. ', bold: true },
              { text: '{{saksi_1_nama}}, ', bold: true },
              {
                text: 'Warga Negara Indonesia, lahir di {{saksi_1_tempat_lahir}}, tanggal {{saksi_1_tanggal_lahir}}, Pekerjaan {{saksi_1_pekerjaan}}, bertempat tinggal di {{saksi_1_alamat}}. Pemegang Kartu Tanda Penduduk Nomor : {{saksi_1_nik}}.',
              },
            ],
            { align: AlignmentType.JUSTIFIED, indentLeft: 200, spaceAfter: 100, line: LINE_SPACING_1_5 }
          ),
          aktaDashRuns(
            [
              { text: '2. ', bold: true },
              { text: '{{saksi_2_nama}}, ', bold: true },
              {
                text: 'Warga Negara Indonesia, lahir di {{saksi_2_tempat_lahir}}, tanggal {{saksi_2_tanggal_lahir}}, Pekerjaan {{saksi_2_pekerjaan}}, bertempat tinggal di {{saksi_2_alamat}}. Pemegang Kartu Tanda Penduduk Nomor : {{saksi_2_nik}}.',
              },
            ],
            { align: AlignmentType.JUSTIFIED, indentLeft: 200, spaceAfter: 120, line: LINE_SPACING_1_5 }
          ),

          aktaDashParagraph(
            'Sebagai saksi-saksi dan setelah dibacakan serta dijelaskan, maka sebagai bukti kebenaran pernyataan yang dikemukakan oleh {{daftar_sebutan_para_pihak}} tersebut diatas, akta ini ditanda tangani/cap ibu jari oleh {{daftar_sebutan_para_pihak}}, para saksi dan saya PPATS, sebanyak 2 (dua) rangkap asli, yaitu 1 (satu) rangkap lembar pertama disimpan di kantor saya, dan 1 (satu) rangkap lembar kedua disampaikan kepada Kantor Pertanahan {{kabupaten_tanah}}, untuk keperluan pendaftaran peralihan hak dalam akta ini.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 200, line: LINE_SPACING_1_5 }
          ),

          // ==================== HALAMAN TANDA TANGAN ====================
          new Paragraph({ children: [new PageBreak()] }),

          // Mode AJB / Hibah: 2 Kelompok Pihak (Pihak Pertama bisa multi-pemilik, Pihak Kedua)
          p('{{#sig_mode_grouped_2}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          new Table({
            width: { size: AKTA_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [4394, 4394],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 4394, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      p('Pihak Pertama', { bold: true, align: AlignmentType.CENTER, spaceAfter: 80 }),
                      p('{{#pihak_pertama_ttd}}', { align: AlignmentType.CENTER, spaceAfter: 0, line: 240 }),
                      p('{{#show_no}}{{no}}. {{/show_no}}{{nama}}', { align: AlignmentType.CENTER, spaceBefore: SIGNATURE_SPACE_STANDARD, spaceAfter: 160 }),
                      p('{{/pihak_pertama_ttd}}', { align: AlignmentType.CENTER, spaceAfter: 120, line: 240 }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 4394, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      p('Pihak Kedua', { bold: true, align: AlignmentType.CENTER, spaceAfter: 80 }),
                      p('{{#pihak_kedua_ttd}}', { align: AlignmentType.CENTER, spaceAfter: 0, line: 240 }),
                      p('{{#show_no}}{{no}}. {{/show_no}}{{nama}}', { align: AlignmentType.CENTER, spaceBefore: SIGNATURE_SPACE_STANDARD, spaceAfter: 160 }),
                      p('{{/pihak_kedua_ttd}}', { align: AlignmentType.CENTER, spaceAfter: 120, line: 240 }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          p('{{/sig_mode_grouped_2}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),

          // Mode 2 Pihak Terpisah (mis. APHB 2 pihak)
          p('{{#sig_mode_2}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          new Table({
            width: { size: AKTA_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [4394, 4394],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 4394, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      p('{{sig_c1_label}}', { bold: true, align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_STANDARD }),
                      p('{{sig_c1_nama}}', { align: AlignmentType.CENTER, spaceAfter: 280 }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 4394, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      p('{{sig_c2_label}}', { bold: true, align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_STANDARD }),
                      p('{{sig_c2_nama}}', { align: AlignmentType.CENTER, spaceAfter: 280 }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          p('{{/sig_mode_2}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),

          // Mode Grid 3 Kolom Berulang (APHB 3..20+ pihak terpisah)
          p('{{#sig_mode_grid}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          p('{{#sig_rows}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          new Table({
            width: { size: AKTA_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [2929, 2930, 2929],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2929, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      p('{{c1_label}}', { bold: true, align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_STANDARD }),
                      p('{{c1_nama}}', { align: AlignmentType.CENTER, spaceAfter: 240 }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 2930, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      p('{{c2_label}}', { bold: true, align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_STANDARD }),
                      p('{{c2_nama}}', { align: AlignmentType.CENTER, spaceAfter: 240 }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 2929, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      p('{{c3_label}}', { bold: true, align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_STANDARD }),
                      p('{{c3_nama}}', { align: AlignmentType.CENTER, spaceAfter: 240 }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          p('{{/sig_rows}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          p('{{/sig_mode_grid}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),

          // Persetujuan Pasangan TTD (hanya tampil jika Ada Persetujuan Pasangan)
          p('{{#ada_persetujuan_pasangan}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),
          p('Disetujui Pasangan', { bold: true, align: AlignmentType.CENTER, spaceBefore: 120, spaceAfter: SIGNATURE_SPACE_STANDARD }),
          p('{{pasangan_nama}}', { align: AlignmentType.CENTER, spaceAfter: 280 }),
          p('{{/ada_persetujuan_pasangan}}', { align: AlignmentType.LEFT, spaceAfter: 0, line: 240 }),

          // Saksi 1 & Saksi 2
          new Table({
            width: { size: AKTA_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [4394, 4394],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 4394, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      p('Saksi', { bold: true, align: AlignmentType.CENTER, spaceBefore: 120, spaceAfter: SIGNATURE_SPACE_STANDARD }),
                      p('{{saksi_1_nama}}', { align: AlignmentType.CENTER, spaceAfter: 280 }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 4394, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      p('Saksi', { bold: true, align: AlignmentType.CENTER, spaceBefore: 120, spaceAfter: SIGNATURE_SPACE_STANDARD }),
                      p('{{saksi_2_nama}}', { align: AlignmentType.CENTER, spaceAfter: 280 }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          p('Pejabat Pembuat Akta Tanah Sementara', { bold: true, align: AlignmentType.CENTER, spaceBefore: 240, spaceAfter: 40 }),
          p('{{jabatan_ppats}}', { bold: true, align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_METERAI }),
          p('{{nama_ppats}}', { bold: true, italic: true, underline: true, align: AlignmentType.CENTER, spaceAfter: 40 }),
        ],
      },
    ],
  });
}

// Pengaturan margin & tipografi Lampiran Bundel Akta F4 sesuai contoh LAMPIRAN JUAL (Hal. 1-9)
export const LAMPIRAN_MARGINS = {
  top: 1247, // 2,2 cm
  bottom: 1134, // 2,0 cm
  left: 1440, // 2,54 cm
  right: 1440, // 2,54 cm
  gutter: 0,
  header: 0,
  footer: 0,
};

const LAMPIRAN_SIZE = 22; // 11 pt Bookman Old Style sesuai contoh PDF lampiran
const LAMPIRAN_LINE = 276; // 1.15 spasi (240 * 1.15)
const LAMPIRAN_LINE_AIRY = 300; // 1.25 spasi untuk surat pernyataan ringkas
// Lebar konten cetak F4 Lampiran (12190 - 1440 - 1440 = 9310 twips)
const LAMPIRAN_CONTENT_WIDTH_DXA =
  PAPER_SIZE_F4_TWIPS.width - LAMPIRAN_MARGINS.left - LAMPIRAN_MARGINS.right;

function lp(
  text: string,
  opts?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    line?: number;
    indentLeft?: number;
    firstLine?: number;
    hanging?: number;
    pageBreakBefore?: boolean;
    borderBottom?: boolean;
    keepNext?: boolean;
    keepLines?: boolean;
  }
): Paragraph {
  return new Paragraph({
    alignment: opts?.align ?? AlignmentType.LEFT,
    pageBreakBefore: opts?.pageBreakBefore ?? false,
    keepNext: opts?.keepNext,
    keepLines: opts?.keepLines,
    indent:
      opts?.indentLeft || opts?.firstLine || opts?.hanging
        ? {
            left: opts.indentLeft,
            firstLine: opts.firstLine,
            hanging: opts.hanging,
          }
        : undefined,
    spacing: {
      before: opts?.spaceBefore ?? 0,
      after: opts?.spaceAfter ?? 20,
      line: opts?.line ?? LAMPIRAN_LINE,
      lineRule: LineRuleType.AUTO,
    },
    border: opts?.borderBottom
      ? {
          bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
        }
      : undefined,
    children: [
      new TextRun({
        text,
        bold: opts?.bold ?? false,
        italics: opts?.italic ?? false,
        underline: opts?.underline ? {} : undefined,
        size: opts?.size ?? LAMPIRAN_SIZE,
        font: LAMPIRAN_FONT,
      }),
    ],
  });
}

function lpRuns(
  runs: Array<{ text: string; bold?: boolean; italic?: boolean; underline?: boolean; size?: number }>,
  opts?: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spaceBefore?: number;
    spaceAfter?: number;
    line?: number;
    indentLeft?: number;
    firstLine?: number;
    hanging?: number;
  }
): Paragraph {
  return new Paragraph({
    alignment: opts?.align ?? AlignmentType.LEFT,
    indent:
      opts?.indentLeft || opts?.firstLine || opts?.hanging
        ? {
            left: opts.indentLeft,
            firstLine: opts.firstLine,
            hanging: opts.hanging,
          }
        : undefined,
    spacing: {
      before: opts?.spaceBefore ?? 0,
      after: opts?.spaceAfter ?? 20,
      line: opts?.line ?? LAMPIRAN_LINE,
      lineRule: LineRuleType.AUTO,
    },
    children: runs.map(
      (r) =>
        new TextRun({
          text: r.text,
          bold: r.bold ?? false,
          italics: r.italic ?? false,
          underline: r.underline ? {} : undefined,
          size: r.size ?? LAMPIRAN_SIZE,
          font: LAMPIRAN_FONT,
        })
    ),
  });
}

function makeLampiranKvTable(
  rows: Array<[string, string, string?]>,
  opts?: { labelPct?: number; indentTwips?: number; spaceAfterRow?: number; line?: number }
): Table {
  const indentTwips = opts?.indentTwips ?? 0;
  const totalWidth = LAMPIRAN_CONTENT_WIDTH_DXA - indentTwips;
  const labelPct = opts?.labelPct ?? 26;
  const leftW = Math.round((totalWidth * labelPct) / 100);
  const rightW = totalWidth - leftW;
  const line = opts?.line ?? LAMPIRAN_LINE;
  const spaceAfterRow = opts?.spaceAfterRow ?? 0;
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [leftW, rightW],
    indent: indentTwips > 0 ? { size: indentTwips, type: WidthType.DXA } : undefined,
    borders: NO_TABLE_BORDERS,
    rows: rows.map(
      ([k, v, condFlag]) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: leftW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 60 },
              children: [lp(condFlag ? `{{#${condFlag}}}${k}` : k, { spaceAfter: spaceAfterRow, line })],
            }),
            new TableCell({
              width: { size: rightW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              children: [
                lp(condFlag ? `: ${v}{{/${condFlag}}}` : `: ${v}`, {
                  spaceAfter: spaceAfterRow,
                  line,
                }),
              ],
            }),
          ],
        })
    ),
  });
}

function makeLampiranTwoColList(
  rows: Array<{
    left: string;
    right: string;
    leftBold?: boolean;
    rightBold?: boolean;
  }>,
  opts?: {
    indentTwips?: number;
    leftPct?: number;
    line?: number;
    spaceAfterRow?: number;
    hangingTwips?: number;
  }
): Table {
  const indentTwips = opts?.indentTwips ?? 180;
  const totalWidth = LAMPIRAN_CONTENT_WIDTH_DXA - indentTwips;
  const leftPct = opts?.leftPct ?? 50;
  const leftW = Math.round((totalWidth * leftPct) / 100);
  const rightW = totalWidth - leftW;
  const line = opts?.line ?? 220;
  const spaceAfterRow = opts?.spaceAfterRow ?? 0;
  const hanging = opts?.hangingTwips ?? 340;

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [leftW, rightW],
    indent: indentTwips > 0 ? { size: indentTwips, type: WidthType.DXA } : undefined,
    borders: NO_TABLE_BORDERS,
    rows: rows.map(
      (row) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: leftW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 140 },
              children: [
                lp(row.left, {
                  bold: row.leftBold ?? false,
                  align: AlignmentType.LEFT,
                  indentLeft: row.left ? hanging : 0,
                  hanging: row.left ? hanging : 0,
                  spaceBefore: 0,
                  spaceAfter: spaceAfterRow,
                  line,
                }),
              ],
            }),
            new TableCell({
              width: { size: rightW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 80, right: 0 },
              children: [
                lp(row.right, {
                  bold: row.rightBold ?? false,
                  align: AlignmentType.LEFT,
                  indentLeft: row.right ? hanging : 0,
                  hanging: row.right ? hanging : 0,
                  spaceBefore: 0,
                  spaceAfter: spaceAfterRow,
                  line,
                }),
              ],
            }),
          ],
        })
    ),
  });
}

function makeSaksiSignLines(spaceBefore = 140): Array<Paragraph | Table> {
  const tableW = 6600;
  const signW = 2100;
  const nameW = tableW - signW;
  return [
    lp('Saksi – saksi :', { spaceBefore, spaceAfter: 90, line: LAMPIRAN_LINE, keepNext: true }),
    new Table({
      width: { size: tableW, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [nameW, signW],
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: nameW, type: WidthType.DXA },
              borders: NO_BORDER,
              verticalAlign: VerticalAlign.BOTTOM,
              margins: { top: 0, bottom: 0, left: 0, right: 80 },
              children: [
                lp('1. {{saksi_1_nama}}', {
                  indentLeft: 260,
                  hanging: 260,
                  spaceAfter: 190,
                  line: 240,
                }),
              ],
            }),
            new TableCell({
              width: { size: signW, type: WidthType.DXA },
              borders: NO_BORDER,
              verticalAlign: VerticalAlign.BOTTOM,
              margins: { top: 0, bottom: 0, left: 40, right: 0 },
              children: [
                lp('( ................. )', {
                  align: AlignmentType.RIGHT,
                  spaceAfter: 190,
                  line: 240,
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: nameW, type: WidthType.DXA },
              borders: NO_BORDER,
              verticalAlign: VerticalAlign.BOTTOM,
              margins: { top: 0, bottom: 0, left: 0, right: 80 },
              children: [
                lp('2. {{saksi_2_nama}}', {
                  indentLeft: 260,
                  hanging: 260,
                  spaceAfter: 40,
                  line: 240,
                }),
              ],
            }),
            new TableCell({
              width: { size: signW, type: WidthType.DXA },
              borders: NO_BORDER,
              verticalAlign: VerticalAlign.BOTTOM,
              margins: { top: 0, bottom: 0, left: 40, right: 0 },
              children: [
                lp('( ................. )', {
                  align: AlignmentType.RIGHT,
                  spaceAfter: 40,
                  line: 240,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
}

const LEFT_RIGHT_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
  right: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
};

const LEFT_RIGHT_BOTTOM_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
  left: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
  right: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
};

function buildLampiranBundelDocument(): Document {
  // Tabel Checklist 13 Dokumen Hal. 1 (tanpa garis horizontal antarbaris, Keterangan merge vertikal)
  const checklistItems: Array<[string, string[], string]> = [
    [
      '1.',
      [
        'Sertipikat {{jenis_hak}} (Asli)',
        '{{sertipikat_ringkas_baris}}',
        'Desa {{desa_tanah}}',
        'An. {{sertipikat_an}}',
      ],
      '1 (satu)',
    ],
    [
      '2.',
      [
        '{{lampiran_akta_label}}:',
        'Nomor : {{nomor_akta}}',
        'Tanggal : {{tanggal_akta}}',
      ],
      '1 (satu)',
    ],
    ['3.', ['Pengecekan Sertipikat'], '1 (satu)'],
    ['4.', ['Surat Kuasa'], '1 (satu)'],
    ['5.', ['Fotokopi KTP Penerima Kuasa'], '1 (satu)'],
    ['6.', ['Surat Pernyataan Penguasaan Fisik Tanah dan Tidak Sengketa'], '1 (satu)'],
    ['7.', ['Fotokopi KTP Para Pihak dan Saksi'], '1 (satu)'],
    ['8.', ['Fotokopi Kartu Keluarga'], '1 (satu)'],
    ['9.', ['Surat Pernyataan BPHTB'], '1 (satu)'],
    ['10.', ['Surat Pernyataan PBB'], '1 (satu)'],
    ['11.', ['Fotokopi SSPD BPHTB, SPPT PBB, PPh'], '1 (satu)'],
    ['12.', ['Surat Pernyataan Keabsahan dan Kebenaran Dokumen'], '1 (satu)'],
    ['13.', ['Surat Pernyataan Pemrosesan Data Pribadi'], '1 (satu)'],
  ];

  const colNoW = 840;
  const colDocW = 4470;
  const colJmlW = 1300;
  const colKetW = LAMPIRAN_CONTENT_WIDTH_DXA - colNoW - colDocW - colJmlW; // 2700

  const checklistTable = new Table({
    width: { size: LAMPIRAN_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [colNoW, colDocW, colJmlW, colKetW],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: colNoW, type: WidthType.DXA },
            borders: THIN_BORDER,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [lp('Nomor', { bold: true, align: AlignmentType.CENTER, spaceBefore: 40, spaceAfter: 40, line: 240 })],
          }),
          new TableCell({
            width: { size: colDocW, type: WidthType.DXA },
            borders: THIN_BORDER,
            margins: { top: 40, bottom: 40, left: 90, right: 90 },
            children: [lp('Dokumen yang diserahkan', { bold: true, align: AlignmentType.CENTER, spaceBefore: 40, spaceAfter: 40, line: 240 })],
          }),
          new TableCell({
            width: { size: colJmlW, type: WidthType.DXA },
            borders: THIN_BORDER,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [lp('Jumlah', { bold: true, align: AlignmentType.CENTER, spaceBefore: 40, spaceAfter: 40, line: 240 })],
          }),
          new TableCell({
            width: { size: colKetW, type: WidthType.DXA },
            borders: THIN_BORDER,
            margins: { top: 40, bottom: 40, left: 90, right: 90 },
            children: [lp('Keterangan', { bold: true, align: AlignmentType.CENTER, spaceBefore: 40, spaceAfter: 40, line: 240 })],
          }),
        ],
      }),
      ...checklistItems.map(([no, docLines, jml], idx) => {
        const isFirst = idx === 0;
        const isLast = idx === checklistItems.length - 1;
        const colBorder = isLast ? LEFT_RIGHT_BOTTOM_BORDERS : LEFT_RIGHT_BORDERS;
        return new TableRow({
          children: [
            new TableCell({
              width: { size: colNoW, type: WidthType.DXA },
              borders: colBorder,
              margins: { top: 0, bottom: 0, left: 60, right: 60 },
              children: [
                lp(no, {
                  align: AlignmentType.CENTER,
                  spaceBefore: isFirst ? 60 : 10,
                  spaceAfter: isLast ? 60 : 10,
                  line: 252,
                }),
              ],
            }),
            new TableCell({
              width: { size: colDocW, type: WidthType.DXA },
              borders: colBorder,
              margins: { top: 0, bottom: 0, left: 90, right: 90 },
              children: docLines.map((lineText, lIdx) =>
                lp(lineText, {
                  spaceBefore: isFirst && lIdx === 0 ? 60 : 0,
                  spaceAfter: isLast && lIdx === docLines.length - 1 ? 60 : lIdx === docLines.length - 1 ? 30 : 0,
                  line: 252,
                })
              ),
            }),
            new TableCell({
              width: { size: colJmlW, type: WidthType.DXA },
              borders: colBorder,
              margins: { top: 0, bottom: 0, left: 60, right: 60 },
              children: [
                lp(jml, {
                  align: AlignmentType.CENTER,
                  spaceBefore: isFirst ? 60 : 10,
                  spaceAfter: isLast ? 60 : 10,
                  line: 252,
                }),
              ],
            }),
            new TableCell({
              width: { size: colKetW, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 0, bottom: 0, left: 90, right: 90 },
              verticalMerge: isFirst ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE,
              children: isFirst
                ? [
                    lp('{{ket_pihak1_label}}:', { bold: true, spaceBefore: 200, spaceAfter: 10, line: LAMPIRAN_LINE }),
                    lp('{{ket_pihak1_names}}', { spaceAfter: 200, line: LAMPIRAN_LINE }),
                    lp('{{ket_pihak2_label}}:', { bold: true, spaceAfter: 10, line: LAMPIRAN_LINE }),
                    lp('{{ket_pihak2_names}}', { spaceAfter: 40, line: LAMPIRAN_LINE }),
                  ]
                : [lp('', { spaceAfter: 0, line: 220 })],
            }),
          ],
        });
      }),
    ],
  });

  const halfF4 = Math.floor(LAMPIRAN_CONTENT_WIDTH_DXA / 2); // 4655
  const otherHalfF4 = LAMPIRAN_CONTENT_WIDTH_DXA - halfF4; // 4655

  return new Document({
    styles: createDocxStyles(LAMPIRAN_FONT),
    sections: [
      {
        properties: {
          page: {
            size: PAPER_SIZE_F4_TWIPS,
            margin: LAMPIRAN_MARGINS,
          },
        },
        children: [
          // ==================== HALAMAN 1: SURAT PENGANTAR KE KEPALA KANTOR ATR/BPN ====================
          new Table({
            width: { size: LAMPIRAN_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [halfF4, otherHalfF4],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: halfF4, type: WidthType.DXA },
                    borders: {
                      ...NO_BORDER,
                      bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
                    },
                    children: [
                      lp('{{nama_ppats}}', { bold: true, spaceAfter: 0, line: 252 }),
                      lp('PPATS {{nama_kecamatan_upper}}', { bold: true, spaceAfter: 0, line: 252 }),
                      lp('Alamat : {{alamat_kantor}}', { spaceAfter: 0, line: 252 }),
                      lp('Telp. {{telepon_kantor}}', { spaceAfter: 40, line: 252 }),
                    ],
                  }),
                  new TableCell({
                    width: { size: otherHalfF4, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('', { spaceAfter: 0, line: 252 }),
                      lp('', { spaceAfter: 0, line: 252 }),
                      lp('', { spaceAfter: 0, line: 252 }),
                      lp('{{kota_kabupaten}}, {{tanggal_akta}}', { indentLeft: 720, spaceAfter: 0, line: 252 }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          // Paragraf pemisah agar Word tidak menggabungkan tabel Kop dengan tabel Nomor/Kepada
          lp('', { spaceBefore: 0, spaceAfter: 40, line: 120 }),
          new Table({
            width: { size: LAMPIRAN_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [halfF4, otherHalfF4],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: halfF4, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('Nomor     : {{nomor_pengantar}}', { spaceBefore: 40, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('Lampiran : 1 (satu) set', { spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lpRuns(
                        [
                          { text: 'Perihal    : ' },
                          { text: '{{perihal_pengantar}}', italic: true, underline: true },
                        ],
                        { spaceAfter: 40, line: LAMPIRAN_LINE }
                      ),
                    ],
                  }),
                  new TableCell({
                    width: { size: otherHalfF4, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('Kepada', { indentLeft: 720, spaceBefore: 40, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('Yth. Kepala Kantor ATR/BPN', { indentLeft: 720, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('{{kabupaten_tanah}}', { indentLeft: 720, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('Di {{kota_kabupaten}}', { indentLeft: 720, spaceAfter: 40, line: LAMPIRAN_LINE }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          lp('Dengan hormat,', { spaceBefore: 60, spaceAfter: 30, line: LAMPIRAN_LINE }),
          lp(
            'Bersama ini kami sampaikan berkas pendaftaran peralihan hak karena {{perihal_kalimat}} dengan rincian Dokumen sebagai berikut :',
            { align: AlignmentType.JUSTIFIED, firstLine: 720, spaceAfter: 100, line: LAMPIRAN_LINE }
          ),
          checklistTable,
          lp(
            'Mohon dilakukan pendaftaran peralihan hak karena {{perihal_kalimat}} atas sertipikat tersebut di atas, atas kerja sama yang baik saya ucapkan terima kasih.',
            { align: AlignmentType.JUSTIFIED, firstLine: 720, spaceBefore: 100, spaceAfter: 160, line: LAMPIRAN_LINE }
          ),
          new Table({
            width: { size: LAMPIRAN_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [4096, 5214],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 4096, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('', { align: AlignmentType.CENTER, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('Yang Menerima', { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_STANDARD, line: LAMPIRAN_LINE }),
                      lp('( .............................. )', { align: AlignmentType.CENTER, spaceAfter: 20, line: LAMPIRAN_LINE }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 5214, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('Pejabat Pembuat Akta Tanah Sementara', { align: AlignmentType.CENTER, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('{{jabatan_camat}}', { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_STANDARD, line: LAMPIRAN_LINE }),
                      lp('({{nama_ppats}})', { bold: true, align: AlignmentType.CENTER, spaceAfter: 20, line: LAMPIRAN_LINE }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // ==================== HALAMAN 2: PERMOHONAN PENDAFTARAN PERALIHAN HAK ====================
          lp('Kepada Yth.', { pageBreakBefore: true, indentLeft: 4400, spaceAfter: 0, line: LAMPIRAN_LINE }),
          lp('Kantor Kementerian Agraria dan Tata Ruang/', { indentLeft: 4400, spaceAfter: 0, line: LAMPIRAN_LINE }),
          lp('Badan Pertanahan Nasional {{kabupaten_tanah}}', { indentLeft: 4400, spaceAfter: 0, line: LAMPIRAN_LINE }),
          lp('di {{kota_kabupaten}}', { indentLeft: 4400, spaceAfter: 160, line: LAMPIRAN_LINE }),

          lp('Dengan Hormat,', { spaceAfter: 20, line: LAMPIRAN_LINE }),
          lp('Yang bertanda tangan di bawah ini :', { spaceAfter: 40, line: LAMPIRAN_LINE }),
          makeLampiranKvTable(
            [
              ['Nama', '{{kuasa_bpn_nama}}'],
              ['Tempat/Tgl.lahir', '{{kuasa_bpn_ttl}}'],
              ['Nomor KTP', '{{kuasa_bpn_nik}}'],
              ['Alamat', '{{kuasa_bpn_alamat}}'],
            ],
            { indentTwips: 420, labelPct: 25, spaceAfterRow: 0, line: LAMPIRAN_LINE }
          ),
          lp('Dalam hal ini bertindak untuk selaku kuasa dari :', { spaceBefore: 70, spaceAfter: 30, line: 245 }),
          makeLampiranKvTable(
            [
              ['Nama', '{{penerima_nama}}'],
              ['Tempat/Tgl.lahir', '{{penerima_ttl}}'],
              ['Pekerjaan', '{{penerima_pekerjaan}}', 'has_penerima_pekerjaan'],
              ['Nomor KTP', '{{penerima_nik}}'],
              ['Alamat', '{{penerima_alamat}}'],
            ],
            { indentTwips: 420, labelPct: 25, spaceAfterRow: 0, line: 225 }
          ),
          lp('Berdasarkan surat kuasa Tanggal : {{tanggal_akta_dash}}', { spaceBefore: 70, spaceAfter: 15, line: 240 }),
          lp('Dengan ini mengajukan permohonan :', { spaceAfter: 25, line: 240 }),
          makeLampiranTwoColList(
            [
              { left: '1. Pengukuran', right: '8. Pemecahan/Penggabungan Hak' },
              { left: '2. Konversi / Pendaftaran Hak', right: '9. Pendaftaran Hak Tanggungan' },
              { left: '3. Pendaftaran Hak Milik Sarusun', right: '10. Roya atas Hak Tanggungan' },
              { left: '4. Pendaftaran Tanah Wakaf', right: '11. Penerbitan Sertipikat Pengganti' },
              { left: '5. Pendaftaran Peralihan Hak', right: '12. Surat Keterangan Pendaftaran Tanah', leftBold: true },
              { left: '6. Pendaftaran Pemindahan Hak', right: '13. Pengecekan Sertipikat' },
              { left: '7. Pendaftaran Perubahan Hak', right: '14. Pencatatan ……………………………' },
            ],
            { indentTwips: 360, leftPct: 48, line: 220, spaceAfterRow: 0, hangingTwips: 320 }
          ),
          lp('Atas bidang tanah Hak / Tanah Negara :', { spaceBefore: 70, spaceAfter: 10, line: 240 }),
          lp('Terletak di', { indentLeft: 420, spaceAfter: 10, line: 240 }),
          makeLampiranKvTable(
            [
              ['Desa', '{{desa_tanah}}'],
              ['Kecamatan', '{{kecamatan_tanah}}'],
              ['Kabupaten', '{{kabupaten_tanah}}'],
              ['{{label_nomor_sertipikat}}', '{{nib_atau_nomor_hak}}'],
            ],
            { indentTwips: 720, labelPct: 24, spaceAfterRow: 0, line: 230 }
          ),
          lp('Untuk melengkapi permohonan dimaksud, bersama ini kami lampirkan :', {
            spaceBefore: 70,
            spaceAfter: 25,
            line: 240,
          }),
          makeLampiranTwoColList(
            [
              { left: '1. {{jenis_hak}} {{sertipikat_ringkas_baris}}', right: '9. Surat Pembayaran BPHTB' },
              { left: '2. {{lampiran_akta_label}} : No. {{nomor_akta}} Tgl. {{tanggal_akta}}', right: '10. Surat Pernyataan PBB' },
              { left: '3. Pengecekan Sertipikat', right: '11. Fotokopi PBB terbaru, SSPD BPHTB, PPh' },
              { left: '4. Surat Kuasa', right: '12. Surat Keabsahan Dokumen' },
              { left: '5. Fotokopi KTP Penerima Kuasa', right: '13. Surat Pernyataan Pemrosesan Data Pribadi' },
              { left: '6. Surat Pernyataan Penguasaan Fisik', right: '' },
              { left: '7. Fotokopi KTP, KK Para Pihak', right: '' },
              { left: '8. Fotokopi KTP Para Saksi', right: '' },
            ],
            { indentTwips: 180, leftPct: 51, line: 220, spaceAfterRow: 0, hangingTwips: 340 }
          ),
          // Paragraf pemisah wajib agar Microsoft Word tidak menggabungkan tabel Lampiran dengan tabel Tanda Tangan
          lp('', { spaceBefore: 0, spaceAfter: 60, line: 120 }),
          new Table({
            width: { size: LAMPIRAN_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [4190, 5120],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 4190, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [lp('', { spaceAfter: 0 })],
                  }),
                  new TableCell({
                    width: { size: 5120, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('Hormat Kami,', {
                        align: AlignmentType.CENTER,
                        spaceBefore: 60,
                        spaceAfter: SIGNATURE_SPACE_METERAI,
                        line: LAMPIRAN_LINE,
                      }),
                      lp('{{kuasa_bpn_nama}}, qq. {{penerima_ringkas}}', {
                        bold: true,
                        align: AlignmentType.CENTER,
                        spaceAfter: 20,
                        line: LAMPIRAN_LINE,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // ==================== HALAMAN 3: SURAT KUASA SUBSTITUSI ====================
          lp('SURAT KUASA', { pageBreakBefore: true, bold: true, underline: true, align: AlignmentType.CENTER, spaceAfter: 200, line: LAMPIRAN_LINE }),
          lp('Yang bertanda tangan di bawah ini :', { spaceAfter: 60, line: LAMPIRAN_LINE }),
          makeLampiranKvTable(
            [
              ['Nama', '{{penerima_nama}}'],
              ['Tempat/Tgl.lahir', '{{penerima_ttl}}'],
              ['Pekerjaan', '{{penerima_pekerjaan}}', 'has_penerima_pekerjaan'],
              ['Nomor KTP', '{{penerima_nik}}'],
              ['Alamat', '{{penerima_alamat}}'],
            ],
            { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: 235 }
          ),
          lp('Sehubungan dengan Sertipikat atas tanah {{jenis_hak}} :', { spaceBefore: 110, spaceAfter: 35, line: LAMPIRAN_LINE }),
          makeLampiranKvTable(
            [
              ['{{label_nomor_sertipikat}}', '{{nib_atau_nomor_hak}}'],
              ['Desa', '{{desa_tanah}}'],
              ['Kecamatan', '{{kecamatan_tanah}}'],
              ['Kabupaten', '{{kabupaten_tanah}}'],
            ],
            { indentTwips: 720, labelPct: 22, spaceAfterRow: 0, line: 235 }
          ),
          lp('Maka dengan ini memberi kuasa Substitusi kepada :', { spaceBefore: 110, spaceAfter: 35, line: LAMPIRAN_LINE }),
          makeLampiranKvTable(
            [
              ['Nama', '{{kuasa_bpn_nama}}'],
              ['Tempat/Tgl.lahir', '{{kuasa_bpn_ttl}}'],
              ['Pekerjaan', '{{kuasa_bpn_pekerjaan}}', 'has_kuasa_bpn_pekerjaan'],
              ['Nomor KTP', '{{kuasa_bpn_nik}}'],
              ['Alamat', '{{kuasa_bpn_alamat}}'],
            ],
            { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: 235 }
          ),
          aktaCenteredDashHeading('KHUSUS', {
            bold: true,
            underline: true,
            size: LAMPIRAN_SIZE,
            font: LAMPIRAN_FONT,
            spaceBefore: 140,
            spaceAfter: 100,
            line: LAMPIRAN_LINE,
            contentWidthDxa: LAMPIRAN_CONTENT_WIDTH_DXA,
          }),
          lp(
            '-  Untuk dan atas nama Pemberi Kuasa untuk mendaftarkan permohonan Peralihan Hak Sertipikat ke Kantor Badan Pertanahan Nasional {{kabupaten_tanah}}.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 240, spaceAfter: 60, line: LAMPIRAN_LINE }
          ),
          lp(
            '-  Guna keperluan tersebut Penerima Kuasa berhak menghadap kepada pegawai Kantor Pertanahan yang berwenang, membayar biaya pendaftaran, menandatangani surat-surat yang diperlukan dalam permohonan pendaftaran tersebut serta mengambil sertipikat tanah kelak di kemudian hari setelah selesai.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 240, spaceAfter: 140, line: LAMPIRAN_LINE }
          ),
          lp('Demikian kuasa ini diberikan untuk dapat dipergunakan sebagaimana mestinya.', { spaceAfter: 180, line: LAMPIRAN_LINE }),
          new Table({
            width: { size: LAMPIRAN_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [4469, 4841],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 4469, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('', { spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('Penerima Kuasa', { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_METERAI, line: LAMPIRAN_LINE }),
                      lp('{{kuasa_bpn_nama}}', { bold: true, align: AlignmentType.CENTER, spaceAfter: 20, line: LAMPIRAN_LINE }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 4841, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('{{kota_kabupaten}}, {{tanggal_akta}}', { align: AlignmentType.CENTER, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('Pemberi Kuasa', { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_METERAI, line: LAMPIRAN_LINE }),
                      lp('{{penerima_nama}}', { bold: true, align: AlignmentType.CENTER, spaceAfter: 20, line: LAMPIRAN_LINE }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          lp('Mengetahui,', { align: AlignmentType.CENTER, spaceBefore: 160, spaceAfter: 0, line: LAMPIRAN_LINE, keepNext: true, keepLines: true }),
          lp('PPATS / {{jabatan_camat_upper}}', { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_STANDARD, line: LAMPIRAN_LINE, keepNext: true, keepLines: true }),
          lp('{{nama_ppats}}', { bold: true, underline: true, align: AlignmentType.CENTER, spaceAfter: 0, line: LAMPIRAN_LINE, keepNext: true, keepLines: true }),
          lp('NIP. {{nip_ppats}}', { align: AlignmentType.CENTER, spaceAfter: 20, line: LAMPIRAN_LINE, keepLines: true }),

          // ==================== HALAMAN 4: SURAT PERNYATAAN BPHTB ====================
          lp('SURAT PERNYATAAN', { pageBreakBefore: true, bold: true, underline: true, align: AlignmentType.CENTER, spaceAfter: 200, line: LAMPIRAN_LINE }),
          lp('Yang bertanda tangan di bawah ini :', { spaceAfter: 80, line: LAMPIRAN_LINE_AIRY }),
          makeLampiranKvTable(
            [
              ['Nama', '{{penerima_nama}}'],
              ['Tempat/Tgl.lahir', '{{penerima_ttl}}'],
              ['Pekerjaan', '{{penerima_pekerjaan}}', 'has_penerima_pekerjaan'],
              ['Nomor KTP', '{{penerima_nik}}'],
              ['Alamat', '{{penerima_alamat}}'],
            ],
            { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: 235 }
          ),
          lp('Dengan ini menyatakan :', { spaceBefore: 160, spaceAfter: 80, line: LAMPIRAN_LINE_AIRY }),
          lp(
            '-  Bahwa saya telah {{pernyataan_bphtb_perbuatan}} sebidang tanah tersebut {{sertipikat_ringkas_baris}} Desa {{desa_tanah}} dengan Luas {{luas_m2}} m2 ({{luas_terbilang}}) yang terletak di Desa {{desa_tanah}}, Kecamatan {{kecamatan_tanah}}, {{kabupaten_tanah}}.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 240, spaceAfter: 100, line: LAMPIRAN_LINE_AIRY }
          ),
          lp(
            '-  Bahwa apabila dalam Proses Peralihan Hak atas tanah yang saya terima tersebut di atas ternyata terjadi kekurangan pembayaran BPHTB, maka saya sanggup untuk membayar kekurangan BPHTB tersebut sesuai dengan ketentuan peraturan perundang-undangan yang berlaku.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 240, spaceAfter: 260, line: LAMPIRAN_LINE_AIRY }
          ),
          new Table({
            width: { size: LAMPIRAN_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [halfF4, otherHalfF4],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: halfF4, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('Mengetahui,', { align: AlignmentType.CENTER, spaceBefore: 0, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('PPATS / {{jabatan_camat_upper}}', { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_METERAI, line: LAMPIRAN_LINE }),
                      lp('{{nama_ppats}}', { bold: true, underline: true, align: AlignmentType.CENTER, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('NIP. {{nip_ppats}}', { align: AlignmentType.CENTER, spaceAfter: 20, line: LAMPIRAN_LINE }),
                    ],
                  }),
                  new TableCell({
                    width: { size: otherHalfF4, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('{{kota_kabupaten}}, {{tanggal_akta}}', { align: AlignmentType.CENTER, spaceBefore: 0, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('Yang menyatakan,', { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_METERAI, line: LAMPIRAN_LINE }),
                      lp('{{penerima_nama}}', { bold: true, align: AlignmentType.CENTER, spaceAfter: 20, line: LAMPIRAN_LINE }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          ...makeSaksiSignLines(300),

          // ==================== HALAMAN 5: SURAT PERNYATAAN PENGUASAAN FISIK TANAH DAN TIDAK SENGKETA ====================
          lp('SURAT PERNYATAAN PENGUASAAN FISIK TANAH DAN TIDAK SENGKETA', {
            pageBreakBefore: true,
            bold: true,
            underline: true,
            align: AlignmentType.CENTER,
            spaceAfter: 160,
            line: LAMPIRAN_LINE,
          }),
          lp('Yang bertanda tangan di bawah ini :', { spaceAfter: 40, line: LAMPIRAN_LINE }),
          makeLampiranKvTable(
            [
              ['Nama', '{{penerima_nama}}'],
              ['Tempat/Tgl.lahir', '{{penerima_ttl}}'],
              ['Pekerjaan', '{{penerima_pekerjaan}}', 'has_penerima_pekerjaan'],
              ['Nomor KTP', '{{penerima_nik}}'],
              ['Alamat', '{{penerima_alamat}}'],
            ],
            { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: 230 }
          ),
          lp('Dengan disaksikan oleh :', { spaceBefore: 70, spaceAfter: 30, line: LAMPIRAN_LINE }),
          makeLampiranKvTable(
            [
              ['1. Nama', '{{saksi_1_nama}}'],
              ['   Tempat/Tgl.lahir', '{{saksi_1_ttl}}'],
              ['   Pekerjaan', '{{saksi_1_pekerjaan}}', 'has_saksi_1_pekerjaan'],
              ['   Nomor KTP', '{{saksi_1_nik}}'],
              ['   Alamat', '{{saksi_1_alamat}}'],
            ],
            { indentTwips: 240, labelPct: 27, spaceAfterRow: 0, line: 230 }
          ),
          lp('', { spaceAfter: 20, line: 100 }),
          makeLampiranKvTable(
            [
              ['2. Nama', '{{saksi_2_nama}}'],
              ['   Tempat/Tgl.lahir', '{{saksi_2_ttl}}'],
              ['   Pekerjaan', '{{saksi_2_pekerjaan}}', 'has_saksi_2_pekerjaan'],
              ['   Nomor KTP', '{{saksi_2_nik}}'],
              ['   Alamat', '{{saksi_2_alamat}}'],
            ],
            { indentTwips: 240, labelPct: 27, spaceAfterRow: 0, line: 230 }
          ),
          lp('Pada hari ini {{hari_akta}} tanggal {{tanggal_akta}} dengan ini menyatakan :', {
            spaceBefore: 100,
            spaceAfter: 50,
            line: LAMPIRAN_LINE,
          }),
          lp(
            '1. Bahwa saya adalah benar-benar sebagai pemilik sebidang tanah seluas {{luas_m2}} m2 ({{luas_terbilang}}) yang terletak di Desa {{desa_tanah}}, Kecamatan {{kecamatan_tanah}}, {{kabupaten_tanah}} yang sudah bersertipikat {{jenis_hak}} {{sertipikat_ringkas_baris}} Desa {{desa_tanah}}, yang tercatat atas nama {{sertipikat_an}} dan merupakan produk Kantor Pertanahan {{kabupaten_tanah}}.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: LAMPIRAN_LINE }
          ),
          lp(
            '2. Bahwa saya sebagai pemilik tanah tersebut di atas, benar-benar menguasai tanah secara fisik sejak tahun {{menguasai_sejak_tahun}} sampai sekarang dan saya pergunakan untuk {{penggunaan_tanah}}.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: LAMPIRAN_LINE }
          ),
          lp(
            '3. Bahwa tanah tersebut tidak dalam keadaan sengketa, konflik, perkara, sita jaminan atau pemblokiran dari pihak lain.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 50, line: LAMPIRAN_LINE }
          ),
          lp(
            'Demikian surat pernyataan ini saya buat dengan sebenarnya dan saya bertanggung jawab sepenuhnya atas pernyataan ini. Jika diperlukan saya sanggup mengangkat sumpah menurut Agama/Kepercayaan saya.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 50, line: LAMPIRAN_LINE }
          ),
          lp(
            'Apabila di kemudian hari terjadi perkara perdata maupun pidana atas tanah ini, maka perkara tersebut merupakan tanggung jawab pribadi saya dengan tidak melibatkan Pejabat/Kantor Badan Pertanahan Nasional {{kabupaten_tanah}}.',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 120, line: LAMPIRAN_LINE }
          ),
          new Table({
            width: { size: LAMPIRAN_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [5100, LAMPIRAN_CONTENT_WIDTH_DXA - 5100],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: 5100, type: WidthType.DXA },
                    borders: NO_BORDER,
                    margins: { top: 0, bottom: 0, left: 0, right: 120 },
                    children: [
                      lp('Saksi – saksi :', { spaceAfter: 100, line: LAMPIRAN_LINE, keepNext: true }),
                      new Table({
                        width: { size: 4980, type: WidthType.DXA },
                        layout: TableLayoutType.FIXED,
                        columnWidths: [3280, 1700],
                        borders: NO_TABLE_BORDERS,
                        rows: [
                          new TableRow({
                            cantSplit: true,
                            children: [
                              new TableCell({
                                width: { size: 3280, type: WidthType.DXA },
                                borders: NO_BORDER,
                                verticalAlign: VerticalAlign.BOTTOM,
                                margins: { top: 0, bottom: 0, left: 0, right: 60 },
                                children: [
                                  lp('1. {{saksi_1_nama}}', {
                                    indentLeft: 260,
                                    hanging: 260,
                                    spaceAfter: 190,
                                    line: 240,
                                  }),
                                ],
                              }),
                              new TableCell({
                                width: { size: 1700, type: WidthType.DXA },
                                borders: NO_BORDER,
                                verticalAlign: VerticalAlign.BOTTOM,
                                margins: { top: 0, bottom: 0, left: 20, right: 0 },
                                children: [
                                  lp('(.............)', {
                                    align: AlignmentType.RIGHT,
                                    spaceAfter: 190,
                                    line: 240,
                                  }),
                                ],
                              }),
                            ],
                          }),
                          new TableRow({
                            cantSplit: true,
                            children: [
                              new TableCell({
                                width: { size: 3280, type: WidthType.DXA },
                                borders: NO_BORDER,
                                verticalAlign: VerticalAlign.BOTTOM,
                                margins: { top: 0, bottom: 0, left: 0, right: 60 },
                                children: [
                                  lp('2. {{saksi_2_nama}}', {
                                    indentLeft: 260,
                                    hanging: 260,
                                    spaceAfter: 40,
                                    line: 240,
                                  }),
                                ],
                              }),
                              new TableCell({
                                width: { size: 1700, type: WidthType.DXA },
                                borders: NO_BORDER,
                                verticalAlign: VerticalAlign.BOTTOM,
                                margins: { top: 0, bottom: 0, left: 20, right: 0 },
                                children: [
                                  lp('(.............)', {
                                    align: AlignmentType.RIGHT,
                                    spaceAfter: 40,
                                    line: 240,
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: LAMPIRAN_CONTENT_WIDTH_DXA - 5100, type: WidthType.DXA },
                    borders: NO_BORDER,
                    margins: { top: 0, bottom: 0, left: 100, right: 0 },
                    children: [
                      lp('{{kota_kabupaten}}, {{tanggal_akta}}', {
                        align: AlignmentType.CENTER,
                        spaceAfter: 0,
                        line: LAMPIRAN_LINE,
                      }),
                      lp('Yang membuat pernyataan,', {
                        align: AlignmentType.CENTER,
                        spaceAfter: SIGNATURE_SPACE_METERAI,
                        line: LAMPIRAN_LINE,
                      }),
                      lp('{{penerima_nama}}', { bold: true, underline: true, align: AlignmentType.CENTER, spaceAfter: 20, line: LAMPIRAN_LINE }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          lp('Mengetahui,', { align: AlignmentType.CENTER, spaceBefore: 100, spaceAfter: 0, line: LAMPIRAN_LINE, keepNext: true, keepLines: true }),
          lp('PPATS / {{jabatan_camat_upper}}', { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_STANDARD, line: LAMPIRAN_LINE, keepNext: true, keepLines: true }),
          lp('{{nama_ppats}}', { bold: true, underline: true, align: AlignmentType.CENTER, spaceAfter: 0, line: LAMPIRAN_LINE, keepNext: true, keepLines: true }),
          lp('NIP. {{nip_ppats}}', { align: AlignmentType.CENTER, spaceAfter: 20, line: LAMPIRAN_LINE, keepLines: true }),

          // ==================== HALAMAN 6: SURAT PERNYATAAN SPPT / PBB (PEMILIK AWAL) ====================
          lp('SURAT PERNYATAAN', { pageBreakBefore: true, bold: true, underline: true, align: AlignmentType.CENTER, spaceAfter: 200, line: LAMPIRAN_LINE }),
          lp('Yang bertanda tangan di bawah ini :', { spaceAfter: 80, line: LAMPIRAN_LINE_AIRY }),
          makeLampiranKvTable(
            [
              ['Nama', '{{pemilik_awal_nama}}'],
              ['Tempat/Tgl.lahir', '{{pemilik_awal_ttl}}'],
              ['Pekerjaan', '{{pemilik_awal_pekerjaan}}', 'has_pemilik_awal_pekerjaan'],
              ['Nomor KTP', '{{pemilik_awal_nik}}'],
              ['Alamat', '{{pemilik_awal_alamat}}'],
            ],
            { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: 235 }
          ),
          lp(
            'Dengan ini menyatakan dengan sebenarnya bahwa Surat Pemberitahuan Pajak Terhutang Pajak Bumi dan Bangunan (SPPT/PBB) Nomor Objek Pajak (NOP) : {{nop}}',
            { align: AlignmentType.JUSTIFIED, spaceBefore: 180, spaceAfter: 40, line: LAMPIRAN_LINE_AIRY }
          ),
          lp('Atas tanah saya bersertipikat {{jenis_hak}} :', { spaceAfter: 80, line: LAMPIRAN_LINE_AIRY }),
          makeLampiranKvTable(
            [
              ['{{label_nomor_sertipikat}}', '{{nib_atau_nomor_hak}}'],
              ['Desa', '{{desa_tanah}}'],
              ['Kecamatan', '{{kecamatan_tanah}}'],
              ['Kabupaten', '{{kabupaten_tanah}}'],
              ['Atas nama', '{{sertipikat_an}}'],
            ],
            { indentTwips: 420, labelPct: 26, spaceAfterRow: 10, line: LAMPIRAN_LINE }
          ),
          lp('Masih atas nama pemilik lama karena belum dibalik nama atas nama saya.', {
            align: AlignmentType.JUSTIFIED,
            spaceBefore: 100,
            spaceAfter: 40,
            line: LAMPIRAN_LINE_AIRY,
          }),
          lp('Demikian surat pernyataan ini saya buat agar dipergunakan sebagaimana mestinya.', {
            align: AlignmentType.JUSTIFIED,
            spaceAfter: 280,
            line: LAMPIRAN_LINE_AIRY,
          }),
          new Table({
            width: { size: LAMPIRAN_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [halfF4, otherHalfF4],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: halfF4, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('Mengetahui,', { align: AlignmentType.CENTER, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('PPATS / {{jabatan_camat_upper}}', { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_METERAI, line: LAMPIRAN_LINE }),
                      lp('{{nama_ppats}}', { bold: true, underline: true, align: AlignmentType.CENTER, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('NIP. {{nip_ppats}}', { align: AlignmentType.CENTER, spaceAfter: 20, line: LAMPIRAN_LINE }),
                    ],
                  }),
                  new TableCell({
                    width: { size: otherHalfF4, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('{{kota_kabupaten}}, {{tanggal_akta}}', { align: AlignmentType.CENTER, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('Yang menyatakan,', { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_METERAI, line: LAMPIRAN_LINE }),
                      lp('{{pemilik_awal_nama}}', { bold: true, align: AlignmentType.CENTER, spaceAfter: 20, line: LAMPIRAN_LINE }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          ...makeSaksiSignLines(300),

          // ==================== HALAMAN 7: SURAT PERTANGGUNGJAWABAN KEABSAHAN DAN KEBENARAN DOKUMEN (TANPA SAKSI) ====================
          lp('SURAT PERTANGGUNGJAWABAN KEABSAHAN DAN', {
            pageBreakBefore: true,
            bold: true,
            align: AlignmentType.CENTER,
            spaceAfter: 0,
            line: LAMPIRAN_LINE,
          }),
          lp('KEBENARAN DOKUMEN', {
            bold: true,
            align: AlignmentType.CENTER,
            spaceAfter: 220,
            line: LAMPIRAN_LINE,
          }),
          lp('Yang bertanda tangan di bawah ini :', { spaceAfter: 60, line: LAMPIRAN_LINE }),
          makeLampiranKvTable(
            [
              ['Nama', '{{penerima_nama}}'],
              ['Tempat/Tgl.lahir', '{{penerima_ttl}}'],
              ['Pekerjaan', '{{penerima_pekerjaan}}', 'has_penerima_pekerjaan'],
              ['Nomor KTP', '{{penerima_nik}}'],
              ['Alamat', '{{penerima_alamat}}'],
            ],
            { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: 235 }
          ),
          lp('Merupakan pemilik tanah dengan jenis tanah :', { spaceBefore: 140, spaceAfter: 40, line: LAMPIRAN_LINE }),
          lp('{{jenis_hak}} {{sertipikat_ringkas_baris}}', { indentLeft: 420, bold: true, spaceAfter: 80, line: LAMPIRAN_LINE }),
          lp('Letak Tanah :', { spaceAfter: 40, line: LAMPIRAN_LINE }),
          makeLampiranKvTable(
            [
              ['a. Desa', '{{desa_tanah}}'],
              ['b. Kecamatan', '{{kecamatan_tanah}}'],
              ['c. Kabupaten', '{{kabupaten_tanah}}'],
              ['d. Provinsi', '{{provinsi_tanah}}'],
            ],
            { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: LAMPIRAN_LINE }
          ),
          lp('Dengan ini menyatakan :', { spaceBefore: 140, spaceAfter: 60, line: LAMPIRAN_LINE }),
          lp(
            '1. Sertipikat tersebut adalah asli dan nama yang tercantum dalam sertipikat tersebut adalah nama serta pemegang hak sebenarnya dan menguasai secara fisik bidang tanah tersebut.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 60, line: LAMPIRAN_LINE }
          ),
          lp(
            '2. Seluruh dokumen yang diunggah pada sistem aplikasi layanan pengecekan sertipikat / SKPT pada Kantor Pertanahan {{kabupaten_tanah}} adalah benar dan sesuai dengan aslinya.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 60, line: LAMPIRAN_LINE }
          ),
          lp(
            '3. Beritikad baik dan bertanggung jawab sepenuhnya atas penggunaan data yang diakses. Apabila di kemudian hari data tersebut dinyatakan tidak benar, maka saya bersedia menerima sanksi administratif maupun hukum sesuai ketentuan peraturan perundang-undangan yang berlaku.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 120, line: LAMPIRAN_LINE }
          ),
          lp('Demikian surat pernyataan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.', {
            align: AlignmentType.JUSTIFIED,
            spaceAfter: 280,
            line: LAMPIRAN_LINE,
          }),
          new Table({
            width: { size: LAMPIRAN_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [halfF4, otherHalfF4],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: halfF4, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('Mengetahui,', { align: AlignmentType.CENTER, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('PPATS / {{jabatan_camat_upper}}', { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_METERAI, line: LAMPIRAN_LINE }),
                      lp('{{nama_ppats}}', { bold: true, underline: true, align: AlignmentType.CENTER, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('NIP. {{nip_ppats}}', { align: AlignmentType.CENTER, spaceAfter: 20, line: LAMPIRAN_LINE }),
                    ],
                  }),
                  new TableCell({
                    width: { size: otherHalfF4, type: WidthType.DXA },
                    borders: NO_BORDER,
                    children: [
                      lp('{{kota_kabupaten}}, {{tanggal_akta}}', { align: AlignmentType.CENTER, spaceAfter: 0, line: LAMPIRAN_LINE }),
                      lp('Yang menyatakan,', { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_METERAI, line: LAMPIRAN_LINE }),
                      lp('{{penerima_nama}}', { bold: true, align: AlignmentType.CENTER, spaceAfter: 20, line: LAMPIRAN_LINE }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // ==================== HALAMAN 8-9: SURAT PERNYATAAN PERSETUJUAN PEMROSESAN DATA PRIBADI ====================
          lp('SURAT PERNYATAAN PERSETUJUAN PEMROSESAN DATA PRIBADI', {
            pageBreakBefore: true,
            bold: true,
            align: AlignmentType.CENTER,
            spaceAfter: 120,
            line: 252,
          }),
          lp(
            'Saya, yang bertandatangan di bawah ini, selaku pengguna layanan Pertanahan Kementerian Agraria dan Tata Ruang/Badan Pertanahan Nasional (“Kementerian ATR/BPN”), dengan ini menyatakan sebagai berikut:',
            { align: AlignmentType.JUSTIFIED, spaceAfter: 60, line: 252 }
          ),
          lpRuns(
            [
              { text: '1. ', bold: true, italic: true },
              {
                text: 'Bahwa saya bertindak dalam kapasitas sebagai ',
              },
              {
                text: 'Diri sendiri (perorangan), saya menyatakan memiliki kewenangan hukum yang sah dan bertanggung jawab sepenuhnya atas kewenangan tersebut, serta membebaskan Kementerian ATR/BPN dari segala tuntutan atau klaim apabila di kemudian hari kewenangan tersebut terbukti tidak sah.',
                italic: true,
              },
              {
                text: ' Dengan ini saya memberikan persetujuan kepada Kementerian ATR/BPN selaku Pengendali Data Pribadi untuk melakukan pemrosesan Data Pribadi saya dan/atau pihak yang saya wakili, termasuk namun tidak terbatas pada pengumpulan, pencatatan, penyimpanan, pengolahan, penggunaan, pengungkapan, pengiriman, pembaruan, perbaikan, pembatasan, penghapusan, dan/atau pemusnahan sesuai ketentuan peraturan perundang-undangan.',
              },
            ],
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 55, line: 252 }
          ),
          lp(
            '2. Saya telah menerima dan memahami informasi yang diberikan oleh Kementerian ATR/BPN sehubungan dengan tujuan pemrosesan Data Pribadi dilakukan sebagai berikut:',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 35, line: 252 }
          ),
          lp('a. Proses administrasi layanan pertanahan;', { indentLeft: 720, hanging: 360, spaceAfter: 15, line: 252 }),
          lp('b. Pertukaran data dengan Kementerian/Lembaga lainnya.', { indentLeft: 720, hanging: 360, spaceAfter: 55, line: 252 }),
          lp(
            '3. Saya telah menerima dan memahami informasi yang diberikan oleh Kementerian ATR/BPN sehubungan dengan pemrosesan data pribadi yang saya ungkapkan terkait hal-hal sebagai berikut:',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 35, line: 252 }
          ),
          lp(
            'a. Hak untuk menyampaikan permintaan penundaan, pembatasan, pengakhiran, dan/atau penarikan persetujuan pemrosesan data pribadi;',
            { align: AlignmentType.JUSTIFIED, indentLeft: 720, hanging: 360, spaceAfter: 15, line: 252 }
          ),
          lp(
            'b. Hak untuk menyampaikan permintaan penghapusan dan/atau pemusnahan data pribadi;',
            { align: AlignmentType.JUSTIFIED, indentLeft: 720, hanging: 360, spaceAfter: 15, line: 252 }
          ),
          lp(
            'c. Hak untuk melengkapi, memperbarui, dan/atau memperbaiki data pribadi.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 720, hanging: 360, spaceAfter: 55, line: 252 }
          ),
          lp(
            '4. Saya memahami dan menyetujui bahwa Kementerian ATR/BPN akan mempergunakan dan menyimpan Data Pribadi sesuai dengan ketentuan peraturan perundang-undangan yang berlaku atau selama diperlukan.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 55, line: 252 }
          ),
          lp(
            '5. Saya memahami dan setuju bahwa Kementerian ATR/BPN dapat mengungkapkan data pribadi saya kepada pihak ketiga lainnya, antara lain:',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 35, line: 252 }
          ),
          lp(
            'a. Aparat penegak hukum termasuk Kepolisian, Kejaksaan, Pusat Pelaporan dan Analisis Transaksi Keuangan (PPATK) dan Komisi Pemberantasan Korupsi (KPK);',
            { align: AlignmentType.JUSTIFIED, indentLeft: 720, hanging: 360, spaceAfter: 15, line: 252 }
          ),
          lp(
            'b. Instansi pemerintah/Kementerian/Lembaga, Penyedia jasa Keuangan dan/atau Mitra resmi Kementerian ATR/BPN terkait layanan pertanahan melalui sistem elektronik atau pun sistem elektronik pemerintah yang terintegrasi.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 720, hanging: 360, spaceAfter: 35, line: 252 }
          ),
          lp(
            'selama pengungkapan tersebut dilaksanakan sesuai dengan tujuan pemrosesan di atas dan/atau sesuai dengan ketentuan peraturan perundang-undangan yang berlaku.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, spaceAfter: 55, line: 252 }
          ),
          lp(
            '6. Saya memahami bahwa kesalahan terhadap penyalahgunaan data pribadi oleh pihak ketiga sebagaimana dimaksud pada angka 5, sepenuhnya menjadi tanggung jawab pihak ketiga dan bukan menjadi kesalahan Kementerian ATR/BPN.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 55, line: 252 }
          ),
          lp(
            '7. Saya memahami dan menyetujui bahwa saya berkewajiban untuk memastikan Data Pribadi yang saya ungkapkan kepada Kementerian ATR/BPN adalah lengkap, akurat, benar dan terkini. Demikian persetujuan ini saya buat dan tandatangani dengan sebenar-benarnya, secara sadar, dan tanpa tekanan maupun paksaan dari Pihak manapun.',
            { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 75, line: 252 }
          ),
          lp('Demikian Surat Pernyataan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.', {
            align: AlignmentType.JUSTIFIED,
            firstLine: 720,
            spaceAfter: 140,
            line: 252,
          }),
          new Table({
            width: { size: LAMPIRAN_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [4250, LAMPIRAN_CONTENT_WIDTH_DXA - 4250],
            borders: NO_TABLE_BORDERS,
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: 4250, type: WidthType.DXA },
                    borders: NO_BORDER,
                    margins: { top: 0, bottom: 0, left: 0, right: 120 },
                    children: [
                      lp('Mengetahui,', {
                        align: AlignmentType.CENTER,
                        spaceAfter: 0,
                        line: LAMPIRAN_LINE,
                        keepNext: true,
                        keepLines: true,
                      }),
                      lp('PPATS / {{jabatan_camat_upper}}', {
                        align: AlignmentType.CENTER,
                        spaceAfter: SIGNATURE_SPACE_STANDARD,
                        line: LAMPIRAN_LINE,
                        keepNext: true,
                        keepLines: true,
                      }),
                      lp('{{nama_ppats}}', {
                        bold: true,
                        underline: true,
                        align: AlignmentType.CENTER,
                        spaceAfter: 0,
                        line: LAMPIRAN_LINE,
                        keepNext: true,
                        keepLines: true,
                      }),
                      lp('NIP. {{nip_ppats}}', {
                        align: AlignmentType.CENTER,
                        spaceAfter: 20,
                        line: LAMPIRAN_LINE,
                        keepLines: true,
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: LAMPIRAN_CONTENT_WIDTH_DXA - 4250, type: WidthType.DXA },
                    borders: NO_BORDER,
                    margins: { top: 0, bottom: 0, left: 100, right: 0 },
                    children: [
                      lp('{{kota_kabupaten}}, {{tanggal_akta}}', {
                        align: AlignmentType.CENTER,
                        spaceAfter: 0,
                        line: LAMPIRAN_LINE,
                        keepNext: true,
                      }),
                      lp('Yang Membuat Pernyataan,', {
                        align: AlignmentType.CENTER,
                        spaceAfter: 110,
                        line: LAMPIRAN_LINE,
                        keepNext: true,
                      }),
                      new Table({
                        width: { size: LAMPIRAN_CONTENT_WIDTH_DXA - 4350, type: WidthType.DXA },
                        layout: TableLayoutType.FIXED,
                        columnWidths: [LAMPIRAN_CONTENT_WIDTH_DXA - 4350 - 1650, 1650],
                        borders: NO_TABLE_BORDERS,
                        rows: [
                          new TableRow({
                            cantSplit: true,
                            children: [
                              new TableCell({
                                width: {
                                  size: LAMPIRAN_CONTENT_WIDTH_DXA - 4350 - 1650,
                                  type: WidthType.DXA,
                                },
                                borders: NO_BORDER,
                                verticalAlign: VerticalAlign.BOTTOM,
                                margins: { top: 0, bottom: 0, left: 0, right: 60 },
                                children: [
                                  lp('{{#pihak_dp_normal}}{{no}}. {{nama}}', {
                                    indentLeft: 260,
                                    hanging: 260,
                                    spaceAfter: 160,
                                    line: 245,
                                  }),
                                ],
                              }),
                              new TableCell({
                                width: { size: 1650, type: WidthType.DXA },
                                borders: NO_BORDER,
                                verticalAlign: VerticalAlign.BOTTOM,
                                margins: { top: 0, bottom: 0, left: 20, right: 0 },
                                children: [
                                  lp('(.............){{/pihak_dp_normal}}', {
                                    align: AlignmentType.RIGHT,
                                    spaceAfter: 160,
                                    line: 245,
                                  }),
                                ],
                              }),
                            ],
                          }),
                          new TableRow({
                            cantSplit: true,
                            children: [
                              new TableCell({
                                width: {
                                  size: LAMPIRAN_CONTENT_WIDTH_DXA - 4350 - 1650,
                                  type: WidthType.DXA,
                                },
                                borders: NO_BORDER,
                                verticalAlign: VerticalAlign.BOTTOM,
                                margins: { top: 0, bottom: 0, left: 0, right: 60 },
                                children: [
                                  lp('{{#pihak_dp_compact}}{{no}}. {{nama}}', {
                                    indentLeft: 260,
                                    hanging: 260,
                                    spaceAfter: 35,
                                    line: 222,
                                  }),
                                ],
                              }),
                              new TableCell({
                                width: { size: 1650, type: WidthType.DXA },
                                borders: NO_BORDER,
                                verticalAlign: VerticalAlign.BOTTOM,
                                margins: { top: 0, bottom: 0, left: 20, right: 0 },
                                children: [
                                  lp('(.............){{/pihak_dp_compact}}', {
                                    align: AlignmentType.RIGHT,
                                    spaceAfter: 35,
                                    line: 222,
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          ...makeSaksiSignLines(140),
        ],
      },
    ],
  });
}

export async function generateDefaultDocxBuffer(key: TemplateDocKey): Promise<Uint8Array> {
  let doc: Document;
  switch (key) {
    case '01_akta':
      doc = buildAktaDocument();
      break;
    case '02_lampiran_bundel':
    case '02_permohonan_bpn':
    case '03_kuasa_bpn':
    case '04_tidak_sengketa':
    case '05_sppt_pbb':
    case '06_rincian_pajak':
    case '07_tanda_terima':
    case '08_keabsahan_data_pribadi':
      doc = buildLampiranBundelDocument();
      break;
  }
  const arrayBuffer = await Packer.toArrayBuffer(doc);
  return new Uint8Array(arrayBuffer);
}
