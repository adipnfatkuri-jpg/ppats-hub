import {
  AlignmentType,
  BorderStyle,
  HeightRule,
  ImageRun,
  LineRuleType,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import {
  BerkasRecord,
  OfficeSettings,
  ParaPihak,
  PersonBasicInfo,
} from '../types/ppats';
import {
  formatTanggalDDMMYYYY,
  formatTanggalLengkapHuruf,
  parseFlexibleDate,
} from './indonesianFormatter';
import {
  LAMPIRAN_MARGINS,
  PAPER_SIZE_F4_TWIPS,
  aktaCenteredDashHeading,
} from './docxTemplates';
import { computeAgeFromBirthDate, resolveWarisCConfig } from './warisCHelper';

const F4_FONT = 'Bookman Old Style';
const F4_SIZE = 22; // 11 pt
const F4_LINE = 276; // 1.15 spasi

const F4_CONTENT_WIDTH_DXA =
  PAPER_SIZE_F4_TWIPS.width - LAMPIRAN_MARGINS.left - LAMPIRAN_MARGINS.right;

const SIGNATURE_SPACE_METERAI = 1440; // ~2.54 cm lega untuk meterai Rp 10.000
const SIGNATURE_SPACE_STANDARD = 1320; // ~2.33 cm

const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const NO_TABLE_BORDERS = {
  ...NO_BORDER,
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const THIN_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
};

const THIN_TABLE_BORDERS = {
  ...THIN_BORDER,
  insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  insideVertical: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
};

const BOX_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 10, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 10, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 10, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 10, color: '000000' },
};

function fp(
  text: string,
  opts?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    line?: number;
    indentLeft?: number;
    firstLine?: number;
    hanging?: number;
    pageBreakBefore?: boolean;
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
      line: opts?.line ?? F4_LINE,
      lineRule: LineRuleType.AUTO,
    },
    children: [
      new TextRun({
        text,
        bold: opts?.bold ?? false,
        italics: opts?.italic ?? false,
        underline: opts?.underline ? {} : undefined,
        color: opts?.color,
        size: opts?.size ?? F4_SIZE,
        font: F4_FONT,
      }),
    ],
  });
}

function fpRuns(
  runs: Array<{
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    size?: number;
  }>,
  opts?: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    line?: number;
    indentLeft?: number;
    firstLine?: number;
    hanging?: number;
    pageBreakBefore?: boolean;
  }
): Paragraph {
  return new Paragraph({
    alignment: opts?.align ?? AlignmentType.LEFT,
    pageBreakBefore: opts?.pageBreakBefore ?? false,
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
      line: opts?.line ?? F4_LINE,
      lineRule: LineRuleType.AUTO,
    },
    children: runs.map(
      (r) =>
        new TextRun({
          text: r.text,
          bold: r.bold ?? false,
          italics: r.italic ?? false,
          underline: r.underline ? {} : undefined,
          color: r.color,
          size: r.size ?? opts?.size ?? F4_SIZE,
          font: F4_FONT,
        })
    ),
  });
}

function kvAligned(
  rows: Array<[string, string]>,
  opts?: { labelPct?: number; indentTwips?: number; spaceAfterRow?: number; size?: number }
): Table {
  const labelPct = opts?.labelPct ?? 27;
  const indentTwips = opts?.indentTwips ?? 0;
  const spaceAfterRow = opts?.spaceAfterRow ?? 0;
  const size = opts?.size ?? F4_SIZE;
  const totalWidth = Math.max(4000, F4_CONTENT_WIDTH_DXA - indentTwips);
  const colonW = 200;
  const labelW = Math.round(((totalWidth - colonW) * labelPct) / 100);
  const valueW = totalWidth - colonW - labelW;

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: [labelW, colonW, valueW],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    indent: indentTwips ? { size: indentTwips, type: WidthType.DXA } : undefined,
    rows: rows.map(
      ([k, v]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: labelW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 40 },
              children: [fp(k, { spaceAfter: spaceAfterRow, size })],
            }),
            new TableCell({
              width: { size: colonW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              children: [fp(':', { spaceAfter: spaceAfterRow, size })],
            }),
            new TableCell({
              width: { size: valueW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              children: [fp(v, { spaceAfter: spaceAfterRow, size })],
            }),
          ],
        })
    ),
  });
}

function twoColBatasTable(
  batas: { utara: string; timur: string; selatan: string; barat: string },
  indentTwips = 720
): Table {
  const totalW = Math.max(4800, F4_CONTENT_WIDTH_DXA - indentTwips);
  const halfW = Math.floor(totalW / 2);
  const rightW = totalW - halfW;
  const lblW = 1150;
  const valLW = halfW - lblW;
  const valRW = rightW - lblW;

  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: [lblW, valLW, lblW, valRW],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    indent: { size: indentTwips, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: lblW, type: WidthType.DXA }, borders: NO_BORDER, children: [fp('Utara', { spaceAfter: 0 })] }),
          new TableCell({ width: { size: valLW, type: WidthType.DXA }, borders: NO_BORDER, children: [fp(`: ${batas.utara}`, { spaceAfter: 0 })] }),
          new TableCell({ width: { size: lblW, type: WidthType.DXA }, borders: NO_BORDER, children: [fp('Timur', { spaceAfter: 0 })] }),
          new TableCell({ width: { size: valRW, type: WidthType.DXA }, borders: NO_BORDER, children: [fp(`: ${batas.timur}`, { spaceAfter: 0 })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ width: { size: lblW, type: WidthType.DXA }, borders: NO_BORDER, children: [fp('Selatan', { spaceAfter: 20 })] }),
          new TableCell({ width: { size: valLW, type: WidthType.DXA }, borders: NO_BORDER, children: [fp(`: ${batas.selatan}`, { spaceAfter: 20 })] }),
          new TableCell({ width: { size: lblW, type: WidthType.DXA }, borders: NO_BORDER, children: [fp('Barat', { spaceAfter: 20 })] }),
          new TableCell({ width: { size: valRW, type: WidthType.DXA }, borders: NO_BORDER, children: [fp(`: ${batas.barat}`, { spaceAfter: 20 })] }),
        ],
      }),
    ],
  });
}

function decodeDataUrlImage(
  dataUrl?: string
): { bytes: Uint8Array; type: 'jpg' | 'png' | 'gif' } | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = /^data:image\/(jpeg|jpg|png|gif|webp);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const fmt = m[1].toLowerCase();
  const type: 'jpg' | 'png' | 'gif' =
    fmt === 'png' ? 'png' : fmt === 'gif' ? 'gif' : 'jpg';
  const b64 = m[2].replace(/\s+/g, '');
  if (!b64) return null;
  if (typeof Buffer !== 'undefined') {
    return { bytes: new Uint8Array(Buffer.from(b64, 'base64')), type };
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { bytes, type };
}

function makePhotoOrPlaceholder(
  dataUrl: string | undefined,
  placeholderText: string,
  widthPx: number,
  heightPx: number
): Paragraph {
  const decoded = decodeDataUrlImage(dataUrl);
  if (decoded) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 40 },
      children: [
        new ImageRun({
          data: decoded.bytes,
          type: decoded.type,
          transformation: { width: widthPx, height: heightPx },
        }),
      ],
    });
  }
  return fp(placeholderText, {
    italic: true,
    color: '64748B',
    align: AlignmentType.CENTER,
    size: 20,
    spaceBefore: 600,
    spaceAfter: 600,
  });
}

function resolvePersonCtx(
  name: string,
  list?: PersonBasicInfo[],
  override?: PersonBasicInfo
): {
  nama: string;
  ttl: string;
  pekerjaan: string;
  nik: string;
  alamat: string;
  alamatSingkat: string;
} {
  const fromList = (list ?? []).find(
    (item) => item.nama.trim().toLowerCase() === (name || '').trim().toLowerCase()
  );
  const merged: PersonBasicInfo | undefined =
    fromList || override
      ? {
          ...(fromList ?? { nama: name || '-' }),
          ...(override ?? {}),
          nama: override?.nama?.trim() || name || fromList?.nama || '-',
        }
      : undefined;

  const finalNama = merged?.nama || name || '-';
  const tempat = merged?.tempat_lahir?.trim() || '';
  const tgl = merged?.tanggal_lahir ? formatTanggalDDMMYYYY(merged.tanggal_lahir) : '';
  const ttl = [tempat, tgl && tgl !== '-' ? tgl : ''].filter(Boolean).join(', ') || '-';
  const rtRwFull =
    merged?.rt || merged?.rw ? `RT ${merged?.rt || '000'} / RW ${merged?.rw || '000'}` : '';
  const rtRwShort =
    merged?.rt || merged?.rw ? `Rt.${merged?.rt || '-'}/${merged?.rw || '-'}` : '';
  const alamatFull =
    [
      [merged?.alamat_jalan, rtRwFull].filter(Boolean).join(' '),
      merged?.desa_kelurahan ? `Desa ${merged.desa_kelurahan}` : '',
      merged?.kecamatan ? `Kecamatan ${merged.kecamatan.replace(/^Kecamatan\s+/i, '')}` : '',
      merged?.kabupaten ? `Kabupaten ${merged.kabupaten.replace(/^Kabupaten\s+/i, '')}` : '',
    ]
      .filter(Boolean)
      .join(', ') ||
    merged?.alamat ||
    '-';
  const alamatSingkat =
    [
      [merged?.alamat_jalan, rtRwShort].filter(Boolean).join(' '),
      merged?.desa_kelurahan ? `Ds. ${merged.desa_kelurahan}` : '',
      merged?.kecamatan ? merged.kecamatan.replace(/^Kecamatan\s+/i, '') : '',
      merged?.kabupaten ? merged.kabupaten.replace(/^Kabupaten\s+/i, '') : '',
    ]
      .filter(Boolean)
      .join(', ') ||
    merged?.alamat ||
    '-';

  return {
    nama: finalNama,
    ttl,
    pekerjaan: merged?.pekerjaan?.trim() || '-',
    nik: merged?.nik?.trim() || '-',
    alamat: alamatFull,
    alamatSingkat,
  };
}

function mapPemohonParty(p?: ParaPihak) {
  if (!p) {
    return {
      nama: '........................',
      ttl: '-',
      pekerjaan: '-',
      nik: '-',
      alamat: '-',
      umur: '-',
    };
  }
  const tgl = p.tanggal_lahir ? formatTanggalDDMMYYYY(p.tanggal_lahir) : '';
  const ttl = [p.tempat_lahir, tgl && tgl !== '-' ? tgl : ''].filter(Boolean).join(', ') || '-';
  const rtParts = (p.rt_rw || '').split('/').map((s) => s.trim());
  const rtRwPart =
    rtParts[0] || rtParts[1] ? `RT ${rtParts[0] || '000'} / RW ${rtParts[1] || '000'}` : '';
  const alamat =
    [
      [p.alamat_jalan, rtRwPart].filter(Boolean).join(' '),
      p.desa_kelurahan ? `Desa ${p.desa_kelurahan}` : '',
      p.kecamatan ? `Kecamatan ${p.kecamatan.replace(/^Kecamatan\s+/i, '')}` : '',
      p.kabupaten ? `Kabupaten ${p.kabupaten.replace(/^Kabupaten\s+/i, '')}` : '',
    ]
      .filter(Boolean)
      .join(', ') || '-';
  const age = computeAgeFromBirthDate(p.tanggal_lahir);
  return {
    nama: p.nama?.trim() || '........................',
    ttl,
    pekerjaan: p.pekerjaan?.trim() || '-',
    nik: p.nik?.trim() || '-',
    alamat,
    umur: age !== null ? String(age) : '....',
  };
}

function buildWarisCSignerRowsTable(
  items: Array<{ no: number; nama: string }>,
  opts: { totalWidthDxa: number; dotsWidthDxa?: number; size?: number; rowSpaceAfter?: number }
): Table {
  const dotsW = opts.dotsWidthDxa ?? 1620;
  const nameW = Math.max(1800, opts.totalWidthDxa - dotsW);
  const size = opts.size ?? F4_SIZE;
  const rowGap = opts.rowSpaceAfter ?? 340;
  return new Table({
    width: { size: opts.totalWidthDxa, type: WidthType.DXA },
    columnWidths: [nameW, dotsW],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    rows: items.map((item, idx) => {
      const after = idx === items.length - 1 ? 40 : rowGap;
      return new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: nameW, type: WidthType.DXA },
            borders: NO_BORDER,
            verticalAlign: VerticalAlign.BOTTOM,
            margins: { top: 0, bottom: 0, left: 0, right: 60 },
            children: [
              fp(`${item.no}. ${item.nama}`, {
                indentLeft: 260,
                hanging: 260,
                spaceAfter: after,
                size,
              }),
            ],
          }),
          new TableCell({
            width: { size: dotsW, type: WidthType.DXA },
            borders: NO_BORDER,
            verticalAlign: VerticalAlign.BOTTOM,
            margins: { top: 0, bottom: 0, left: 20, right: 0 },
            children: [
              fp('(.............)', {
                align: AlignmentType.RIGHT,
                spaceAfter: after,
                size,
              }),
            ],
          }),
        ],
      });
    }),
  });
}

function buildCenteredKadesBlock(
  kadesJabatan: string,
  kadesNama: string,
  kadesNip: string,
  spaceBefore = 120
): Paragraph[] {
  const out: Paragraph[] = [
    fp('Mengetahui,', { align: AlignmentType.CENTER, spaceBefore, spaceAfter: 0, keepNext: true, keepLines: true }),
    fp(kadesJabatan, { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_STANDARD, keepNext: true, keepLines: true }),
    fp(kadesNama, { bold: true, underline: true, align: AlignmentType.CENTER, spaceAfter: 0, keepNext: Boolean(kadesNip), keepLines: true }),
  ];
  if (kadesNip) {
    out.push(fp(`NIP. ${kadesNip}`, { align: AlignmentType.CENTER, spaceAfter: 20, keepLines: true }));
  }
  return out;
}

function buildCamatKadesDualTable(params: {
  kecClean: string;
  desaClean: string;
  camatJabatan: string;
  camatNama: string;
  camatNip: string;
  camatNomor: string;
  kadesJabatan: string;
  kadesNama: string;
  kadesNip: string;
  kadesNomor: string;
  tanggalText: string;
}): Table {
  const leftW = Math.floor(F4_CONTENT_WIDTH_DXA / 2);
  const rightW = F4_CONTENT_WIDTH_DXA - leftW;

  const leftChildren: Paragraph[] = [
    fp(`Nomor : ${params.camatNomor || '....................'}`, { align: AlignmentType.CENTER, spaceAfter: 0, size: 20, keepNext: true }),
    fp(`${params.kecClean}, ${params.tanggalText}`, { align: AlignmentType.CENTER, spaceAfter: 0, size: 20, keepNext: true }),
    fp('Dikuatkan oleh kami,', { align: AlignmentType.CENTER, spaceAfter: 0, size: 20, keepNext: true }),
    fp(params.camatJabatan, { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_STANDARD, size: 20, keepNext: true }),
    fp(params.camatNama, { bold: true, underline: true, align: AlignmentType.CENTER, spaceAfter: 0, keepNext: Boolean(params.camatNip) }),
  ];
  if (params.camatNip) {
    leftChildren.push(fp(`NIP. ${params.camatNip}`, { align: AlignmentType.CENTER, spaceAfter: 0, size: 20 }));
  }

  const rightChildren: Paragraph[] = [
    fp(`Nomor : ${params.kadesNomor || '....................'}`, { align: AlignmentType.CENTER, spaceAfter: 0, size: 20, keepNext: true }),
    fp(`${params.desaClean}, ${params.tanggalText}`, { align: AlignmentType.CENTER, spaceAfter: 0, size: 20, keepNext: true }),
    fp('Disaksikan dan dibenarkan oleh kami,', { align: AlignmentType.CENTER, spaceAfter: 0, size: 20, keepNext: true }),
    fp(params.kadesJabatan, { align: AlignmentType.CENTER, spaceAfter: SIGNATURE_SPACE_STANDARD, size: 20, keepNext: true }),
    fp(params.kadesNama, { bold: true, underline: true, align: AlignmentType.CENTER, spaceAfter: 0, keepNext: Boolean(params.kadesNip) }),
  ];
  if (params.kadesNip) {
    rightChildren.push(fp(`NIP. ${params.kadesNip}`, { align: AlignmentType.CENTER, spaceAfter: 0, size: 20 }));
  }

  return new Table({
    width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [leftW, rightW],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: leftW, type: WidthType.DXA },
            borders: NO_BORDER,
            margins: { top: 0, bottom: 0, left: 0, right: 140 },
            children: leftChildren,
          }),
          new TableCell({
            width: { size: rightW, type: WidthType.DXA },
            borders: NO_BORDER,
            margins: { top: 0, bottom: 0, left: 140, right: 0 },
            children: rightChildren,
          }),
        ],
      }),
    ],
  });
}

function buildSuratKuasaWarisCPage(params: {
  pemohon: ReturnType<typeof mapPemohonParty>;
  kuasa: ReturnType<typeof resolvePersonCtx>;
  hakAdat: string;
  desa: string;
  kecamatan: string;
  kabupaten: string;
  penggunaan: string;
  kotaKabupaten: string;
  tanggalText: string;
  khususText: string;
  kadesJabatan: string;
  kadesNama: string;
  kadesNip: string;
}): Array<Paragraph | Table> {
  const leftW = Math.floor(F4_CONTENT_WIDTH_DXA / 2);
  const rightW = F4_CONTENT_WIDTH_DXA - leftW;

  return [
    fp('SURAT KUASA', {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 140,
      pageBreakBefore: true,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 40 }),
    kvAligned(
      [
        ['Nama', params.pemohon.nama],
        ['Tempat/Tgl. Lahir', params.pemohon.ttl],
        ['Pekerjaan', params.pemohon.pekerjaan],
        ['Nomor KTP', params.pemohon.nik],
        ['Alamat', params.pemohon.alamat],
      ],
      { indentTwips: 540, labelPct: 26 }
    ),
    fp('Sehubungan dengan Sertipikat atas tanah Hak Milik :', { spaceBefore: 80, spaceAfter: 40 }),
    kvAligned(
      [
        ['Hak Adat', params.hakAdat],
        ['Desa', params.desa],
        ['Kecamatan', params.kecamatan],
        ['Kabupaten', params.kabupaten],
        ['Penggunaan Tanah', params.penggunaan],
      ],
      { indentTwips: 540, labelPct: 26 }
    ),
    fp('Maka dengan ini memberi kuasa Substitusi kepada :', { spaceBefore: 100, spaceAfter: 40 }),
    kvAligned(
      [
        ['Nama', params.kuasa.nama],
        ['Tempat/Tgl. Lahir', params.kuasa.ttl],
        ['Pekerjaan', params.kuasa.pekerjaan],
        ['Nomor KTP', params.kuasa.nik],
        ['Alamat', params.kuasa.alamatSingkat],
      ],
      { indentTwips: 240, labelPct: 26 }
    ),
    aktaCenteredDashHeading('KHUSUS', {
      bold: true,
      underline: true,
      size: F4_SIZE,
      font: F4_FONT,
      spaceBefore: 120,
      spaceAfter: 100,
      line: F4_LINE,
      contentWidthDxa: F4_CONTENT_WIDTH_DXA,
    }),
    fp(`-   ${params.khususText}`, {
      align: AlignmentType.JUSTIFIED,
      indentLeft: 420,
      hanging: 240,
      spaceAfter: 60,
    }),
    fp(
      '-   Guna keperluan tersebut penerima kuasa berhak menghadap kepada pegawai Kantor Pertanahan yang berwenang, membayar biaya pendaftaran, menandatangani surat-surat yang diperlukan dalam permohonan pendaftaran tersebut serta mengambil sertipikat tanah kelak dikemudian hari setelah selesai.',
      {
        align: AlignmentType.JUSTIFIED,
        indentLeft: 420,
        hanging: 240,
        spaceAfter: 120,
      }
    ),
    fp('Demikian kuasa ini diberikan untuk dapat dipergunakan sebagaimana mestinya.', {
      spaceAfter: 160,
    }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [leftW, rightW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: leftW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp('', { spaceAfter: 0 }),
                fp('Penerima Kuasa', { indentLeft: 360, spaceAfter: SIGNATURE_SPACE_METERAI }),
                fp(params.kuasa.nama, { indentLeft: 360, bold: true, spaceAfter: 20 }),
              ],
            }),
            new TableCell({
              width: { size: rightW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp(`${params.kotaKabupaten}, ${params.tanggalText}`, { indentLeft: 720, spaceAfter: 0 }),
                fp('Pemberi Kuasa', { indentLeft: 720, spaceAfter: SIGNATURE_SPACE_METERAI }),
                fp(params.pemohon.nama, { indentLeft: 720, bold: true, spaceAfter: 20 }),
              ],
            }),
          ],
        }),
      ],
    }),
    ...buildCenteredKadesBlock(params.kadesJabatan, params.kadesNama, params.kadesNip, 140),
  ];
}

function buildSaksiAndPemohonSignTable(
  saksi1Nama: string,
  saksi2Nama: string,
  pemohonNama: string,
  kotaTanggalLine?: string
): Table {
  const leftW = 4900;
  const rightW = F4_CONTENT_WIDTH_DXA - leftW;
  const sNamaW = 2800;
  const sTtdW = leftW - sNamaW;

  const innerSaksiTable = new Table({
    width: { size: leftW, type: WidthType.DXA },
    columnWidths: [sNamaW, sTtdW],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: sNamaW, type: WidthType.DXA },
            borders: NO_BORDER,
            children: [fp(`1.  ${saksi1Nama}`, { spaceAfter: 420 })],
          }),
          new TableCell({
            width: { size: sTtdW, type: WidthType.DXA },
            borders: NO_BORDER,
            children: [fp('(                  )', { spaceAfter: 420 })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: sNamaW, type: WidthType.DXA },
            borders: NO_BORDER,
            children: [fp(`2.  ${saksi2Nama}`, { spaceAfter: 40 })],
          }),
          new TableCell({
            width: { size: sTtdW, type: WidthType.DXA },
            borders: NO_BORDER,
            children: [fp('(                  )', { spaceAfter: 40 })],
          }),
        ],
      }),
    ],
  });

  const rightChildren: Paragraph[] = [];
  if (kotaTanggalLine) {
    rightChildren.push(fp(kotaTanggalLine, { align: AlignmentType.CENTER, spaceAfter: 0 }));
  }
  rightChildren.push(
    fp('Yang membuat pernyataan', {
      align: AlignmentType.CENTER,
      spaceAfter: SIGNATURE_SPACE_METERAI,
    }),
    fp(pemohonNama, { bold: true, align: AlignmentType.CENTER, spaceAfter: 20 })
  );

  return new Table({
    width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [leftW, rightW],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: leftW, type: WidthType.DXA },
            borders: NO_BORDER,
            children: [
              fp('Saksi – saksi :', { spaceAfter: 220 }),
              innerSaksiTable,
            ],
          }),
          new TableCell({
            width: { size: rightW, type: WidthType.DXA },
            borders: NO_BORDER,
            children: rightChildren,
          }),
        ],
      }),
    ],
  });
}

/**
 * Menghasilkan Bundel Lengkap F4 Waris Letter C (Konversi / Pendaftaran Hak Bekas Hak Milik Adat)
 * 15–16 halaman rapi siap cetak sesuai standar BPN & Desa/Kecamatan.
 */
export function buildWarisCBundle(
  record: BerkasRecord,
  settings: OfficeSettings
): Array<Paragraph | Table> {
  const cfg = resolveWarisCConfig(record, settings);
  const na = record.non_akta;

  const desaClean = (record.tanah.desa || '').trim() || '..............';
  const kecClean =
    (record.tanah.kecamatan || settings.nama_kecamatan || '')
      .replace(/^Kecamatan\s+/i, '')
      .trim() || '..............';
  const kabClean =
    (record.tanah.kabupaten || settings.nama_kabupaten || '')
      .replace(/^(Kabupaten|Kota)\s+/i, '')
      .trim() || '..............';

  const parsedDocDate = parseFlexibleDate(record.akta.tanggal_akta || record.tanggal_masuk);
  const formattedDocDate = parsedDocDate
    ? formatTanggalLengkapHuruf(record.akta.tanggal_akta || record.tanggal_masuk)
    : null;
  const tanggalText = formattedDocDate?.tanggal_biasa || '......................';
  const tahunDoc = parsedDocDate ? String(parsedDocDate.year) : String(new Date().getFullYear());

  // Pemohon utama: cocokkan dengan penerimaBagian bila ada, atau Pihak I pertama
  const pemohonParty =
    record.para_pihak.find(
      (p) =>
        p.nama.trim().toLowerCase() === cfg.penerimaBagian.trim().toLowerCase() &&
        p.peran !== 'Persetujuan Pasangan'
    ) ??
    record.para_pihak.find((p) => p.peran === 'Pihak I') ??
    record.para_pihak[0];
  const pemohon = mapPemohonParty(pemohonParty);

  const kuasa = resolvePersonCtx(
    record.akta.nama_kuasa_bpn,
    settings.profil_kuasa,
    record.akta.kuasa_bpn_detail
  );
  const saksi1 = resolvePersonCtx(
    record.akta.saksi_1,
    settings.profil_saksi,
    record.akta.saksi_1_detail
  );
  const saksi2 = resolvePersonCtx(
    record.akta.saksi_2,
    settings.profil_saksi,
    record.akta.saksi_2_detail
  );

  const halfW = Math.floor(F4_CONTENT_WIDTH_DXA / 2);
  const rightHalfW = F4_CONTENT_WIDTH_DXA - halfW;

  // Helper list tanda tangan ahli waris (kanan) — 2 kolom presisi agar titik tanda tangan tidak pindah baris
  const buildHeirSignaturesRight = (kotaLine: string, headerLabel: string): Table => {
    const spacerW = 4150;
    const signW = F4_CONTENT_WIDTH_DXA - spacerW;
    const heirItems =
      cfg.ahliWaris.length > 0
        ? cfg.ahliWaris.map((aw) => ({ no: aw.no, nama: aw.nama }))
        : [{ no: 1, nama: '........................' }];

    return new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [spacerW, signW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: spacerW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('', { spaceAfter: 0 })],
            }),
            new TableCell({
              width: { size: signW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 80, right: 0 },
              children: [
                fp(kotaLine, { align: AlignmentType.CENTER, spaceAfter: 0, size: 20, keepNext: true }),
                fp(headerLabel, { align: AlignmentType.CENTER, spaceAfter: 200, size: 20, keepNext: true }),
                buildWarisCSignerRowsTable(heirItems, {
                  totalWidthDxa: signW - 80,
                  dotsWidthDxa: 1580,
                  size: 20,
                  rowSpaceAfter: 320,
                }),
              ],
            }),
          ],
        }),
      ],
    });
  };

  // =========================================================================
  // HAL. 1 — SURAT PERNYATAAN AHLI WARISAN
  // =========================================================================
  const heirListTable = new Table({
    width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [4450, F4_CONTENT_WIDTH_DXA - 4450],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    rows: cfg.ahliWaris.map(
      (aw) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4450, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 40, bottom: 40, left: 0, right: 120 },
              children: [fp(`${aw.no}.  Nama : ${aw.nama}`, { spaceAfter: 20 })],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4450, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 40, bottom: 40, left: 40, right: 0 },
              children: [fp(`Tempat/Tgl. lahir : ${aw.ttlSlash}`, { spaceAfter: 20 })],
            }),
          ],
        })
    ),
  });

  const hal1: Array<Paragraph | Table> = [
    fp('SURAT PERNYATAAN AHLI WARISAN', {
      bold: true,
      align: AlignmentType.CENTER,
      size: 24,
      spaceAfter: 180,
    }),
    fpRuns(
      [
        {
          text: `Kami yang bertanda tangan dibawah ini, para ahli waris dari ${cfg.sebutanPewaris} : `,
        },
        { text: cfg.namaPewaris, bold: true },
        {
          text: ` menerangkan dengan sesungguhnya dengan sanggup diangkat sumpah, bahwa ${cfg.sebutanPewaris} : `,
        },
        { text: cfg.namaPewaris, bold: true },
        {
          text: `, pada tanggal : ${cfg.tanggalMeninggalPewaris} telah meninggal dunia di ${cfg.tempatMeninggalPewaris}, dari perkawinan dengan ${cfg.hubunganPasangan} yang bernama : ${cfg.namaPasangan}`,
        },
        ...(cfg.tanggalMeninggalPasangan !== '......................'
          ? [
              {
                text: ` yang telah meninggal dunia pada tanggal ${cfg.tanggalMeninggalPasangan} di ${cfg.tempatMeninggalPasangan}`,
              },
            ]
          : []),
        { text: '. Dari perkawinan tersebut telah dilahirkan ' },
        { text: `${cfg.jumlahAnak} (${cfg.jumlahAnakTerbilang}) orang anak`, bold: true },
        { text: ', yaitu:' },
      ],
      { align: AlignmentType.JUSTIFIED, firstLine: 560, spaceAfter: 120 }
    ),
    heirListTable,
    fpRuns(
      [
        {
          text: `Demikian kami, selaku ahli waris dari ${cfg.sebutanPewaris} `,
        },
        { text: cfg.namaPewaris, bold: true },
        {
          text: `. Apabila kemudian hari ternyata ada pihak yang mempermasalahkan dan menuntut di pengadilan atas keterangan ini, maka kami yang bertanda tangan dalam Surat Pernyataan Ahli Waris ini sanggup untuk bertanggung jawab, tanpa melibatkan pihak lain termasuk para saksi, Kepala Desa, dan Camat serta Badan Pertanahan Kabupaten ${kabClean}.`,
        },
      ],
      { align: AlignmentType.JUSTIFIED, firstLine: 560, spaceBefore: 160, spaceAfter: 180 }
    ),
    buildHeirSignaturesRight(
      `${kabClean}, tanggal ${tanggalText}`,
      'Yang membuat pernyataan / Para Ahli Waris'
    ),
    fp('', { spaceBefore: 140, spaceAfter: 40 }),
    buildCamatKadesDualTable({
      kecClean,
      desaClean,
      camatJabatan: cfg.camatJabatan,
      camatNama: cfg.camatNama,
      camatNip: cfg.camatNip,
      camatNomor: cfg.camatNomor,
      kadesJabatan: cfg.kadesJabatan,
      kadesNama: cfg.kadesNama,
      kadesNip: cfg.kadesNip,
      kadesNomor: cfg.kadesNomor,
      tanggalText,
    }),
  ];

  // =========================================================================
  // HAL. 2 — SURAT PERMOHONAN KONVERSI / PENDAFTARAN HAK (ATR/BPN)
  // =========================================================================
  const permohonanPairs: Array<[string, string, boolean, boolean]> = [
    ['1.  Pengukuran', '8.  Pemecahan/Penggabungan Hak', false, false],
    ['2.  Konversi / Pendaftaran Hak', '9.  Pendaftaran Hak Tanggungan', true, false],
    ['3.  Pendaftaran Hak Milik Sarusun', '10. Roya atas Hak Tanggungan', false, false],
    ['4.  Pendaftaran Tanah Wakaf', '11. Penerbitan Sertipikat Pengganti', false, false],
    ['5.  Pendaftaran Peralihan Hak', '12. Surat Keterangan Pendaftaran Tanah', false, false],
    ['6.  Pendaftaran Pemindahan Hak', '13. Pengecekan Sertipikat', false, false],
    ['7.  Pendaftaran Perubahan Hak', '14. Pencatatan ...................................', false, false],
  ];

  const permohonanTable = new Table({
    width: { size: F4_CONTENT_WIDTH_DXA - 240, type: WidthType.DXA },
    columnWidths: [4350, F4_CONTENT_WIDTH_DXA - 240 - 4350],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    indent: { size: 240, type: WidthType.DXA },
    rows: permohonanPairs.map(
      ([leftText, rightText, boldL, boldR]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4350, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp(leftText, { bold: boldL, spaceAfter: 20, line: F4_LINE, size: 20 })],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 240 - 4350, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp(rightText, { bold: boldR, spaceAfter: 20, line: F4_LINE, size: 20 })],
            }),
          ],
        })
    ),
  });

  const lampiranLeft = [
    `1.  Fotokopi Letter ${cfg.hakAdat} ${desaClean}`,
    '2.  Surat Kuasa',
    '3.  Fotokopi KTP Penerima Kuasa',
    '4.  Fotokopi KTP, KK Para Pihak',
    '5.  Fotokopi KTP Para Saksi',
  ];
  const lampiranRight = [
    '6.  Surat Penguasaan Fisik Tanah dan Tidak Sengketa',
    '7.  Surat Pemasangan Tanda Batas',
    '8.  Sketsa Bidang',
  ];

  const lampiranTable = new Table({
    width: { size: F4_CONTENT_WIDTH_DXA - 240, type: WidthType.DXA },
    columnWidths: [4550, F4_CONTENT_WIDTH_DXA - 240 - 4550],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    indent: { size: 240, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 4550, type: WidthType.DXA },
            borders: NO_BORDER,
            margins: { top: 0, bottom: 0, left: 0, right: 120 },
            children: lampiranLeft.map((item) =>
              fp(item, { indentLeft: 320, hanging: 320, spaceAfter: 20, size: 20 })
            ),
          }),
          new TableCell({
            width: { size: F4_CONTENT_WIDTH_DXA - 240 - 4550, type: WidthType.DXA },
            borders: NO_BORDER,
            margins: { top: 0, bottom: 0, left: 100, right: 0 },
            children: lampiranRight.map((item) =>
              fp(item, { indentLeft: 320, hanging: 320, spaceAfter: 20, size: 20 })
            ),
          }),
        ],
      }),
    ],
  });

  const hal2: Array<Paragraph | Table> = [
    fp('', { pageBreakBefore: true, spaceAfter: 0, line: 240 }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4200, F4_CONTENT_WIDTH_DXA - 4200],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4200, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('', { spaceAfter: 0 })],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4200, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp('Kepada Yth.', { spaceAfter: 0 }),
                fp('Kantor Kementerian Agraria dan Tata Ruang/', { spaceAfter: 0 }),
                fp(`Badan Pertanahan Nasional Kabupaten ${kabClean}`, { spaceAfter: 0 }),
                fp(`di ${kabClean}`, { spaceAfter: 60 }),
              ],
            }),
          ],
        }),
      ],
    }),
    fp('Dengan Hormat,', { spaceBefore: 40, spaceAfter: 0 }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 40 }),
    kvAligned(
      [
        ['Nama', kuasa.nama],
        ['Tempat/Tgl. Lahir', kuasa.ttl],
        ['Pekerjaan', kuasa.pekerjaan],
        ['Nomor KTP', kuasa.nik],
        ['Alamat', kuasa.alamatSingkat],
      ],
      { indentTwips: 240, labelPct: 26, size: 20 }
    ),
    fp('Dalam hal ini bertindak untuk dan selaku kuasa dari :', { spaceBefore: 80, spaceAfter: 40 }),
    kvAligned(
      [
        ['Nama', pemohon.nama],
        ['Tempat/Tgl. Lahir', pemohon.ttl],
        ['Pekerjaan', pemohon.pekerjaan],
        ['Nomor KTP', pemohon.nik],
        ['Alamat', pemohon.alamat],
      ],
      { indentTwips: 540, labelPct: 26, size: 20 }
    ),
    fp(`Berdasarkan surat kuasa Tanggal : ${tanggalText !== '......................' ? tanggalText : `.................... ${tahunDoc}`}`, {
      spaceBefore: 80,
      spaceAfter: 20,
      size: 20,
    }),
    fp('Dengan ini mengajukan permohonan :', { spaceAfter: 40, size: 20 }),
    permohonanTable,
    fp('Atas bidang tanah Hak / Tanah Negara :', { spaceBefore: 80, spaceAfter: 0, size: 20 }),
    fp('Terletak di', { indentLeft: 320, spaceAfter: 20, size: 20 }),
    kvAligned(
      [
        ['Desa', desaClean],
        ['Kecamatan', kecClean],
        ['Kabupaten', kabClean],
        ['Hak Adat', cfg.hakAdat],
        ['Penggunaan Tanah', cfg.penggunaanTanahPermohonan],
      ],
      { indentTwips: 540, labelPct: 26, size: 20 }
    ),
    fp('Untuk melengkapi permohonan dimaksud, bersama ini kami lampirkan :', {
      spaceBefore: 80,
      spaceAfter: 40,
      size: 20,
    }),
    lampiranTable,
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4800, F4_CONTENT_WIDTH_DXA - 4800],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4800, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('', { spaceAfter: 0 })],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4800, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp('Hormat Kami,', {
                  align: AlignmentType.CENTER,
                  spaceBefore: 100,
                  spaceAfter: SIGNATURE_SPACE_METERAI,
                }),
                fp(`${kuasa.nama}, qq. ${pemohon.nama}`, {
                  bold: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 20,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  // =========================================================================
  // HAL. 3 — SURAT KUASA (PENGAKUAN HAK SERTIPIKAT TANAH)
  // =========================================================================
  const hal3 = buildSuratKuasaWarisCPage({
    pemohon,
    kuasa,
    hakAdat: cfg.hakAdat,
    desa: desaClean,
    kecamatan: kecClean,
    kabupaten: kabClean,
    penggunaan: cfg.penggunaanTanahPermohonan,
    kotaKabupaten: kabClean,
    tanggalText,
    khususText: `Untuk dan atas nama pemberi Kuasa untuk mendaftarkan permohonan pengakuan Hak Sertipikat tanah ke Kantor Badan Pertanahan Kabupaten ${kabClean}.`,
    kadesJabatan: cfg.kadesJabatan,
    kadesNama: cfg.kadesNama,
    kadesNip: cfg.kadesNip,
  });

  // =========================================================================
  // HAL. 4 — SURAT KUASA (PEMECAHAN BIDANG SERTIPIKAT — OPSIONAL)
  // =========================================================================
  const hal4 = cfg.sertakanKuasaPemecahan
    ? buildSuratKuasaWarisCPage({
        pemohon,
        kuasa,
        hakAdat: cfg.hakAdat,
        desa: desaClean,
        kecamatan: kecClean,
        kabupaten: kabClean,
        penggunaan: cfg.penggunaanTanahPermohonan,
        kotaKabupaten: kabClean,
        tanggalText,
        khususText: `Untuk dan atas nama pemberi Kuasa untuk Pemecahan bidang Sertipikat ke Kantor Badan Pertanahan Kabupaten ${kabClean}.`,
        kadesJabatan: cfg.kadesJabatan,
        kadesNama: cfg.kadesNama,
        kadesNip: cfg.kadesNip,
      })
    : [];

  // =========================================================================
  // HAL. 5 — SURAT PERNYATAAN (MENERIMA WARIS & KEKURANGAN BPHTB)
  // =========================================================================
  const hal5: Array<Paragraph | Table> = [
    fp('SURAT PERNYATAAN', {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 160,
      pageBreakBefore: true,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 60 }),
    kvAligned(
      [
        ['Nama', pemohon.nama],
        ['Tempat/Tgl. Lahir', pemohon.ttl],
        ['Pekerjaan', pemohon.pekerjaan],
        ['Nomor KTP', pemohon.nik],
        ['Alamat', pemohon.alamat],
      ],
      { indentTwips: 540, labelPct: 26 }
    ),
    fp('Dengan ini menyatakan :', { spaceBefore: 100, spaceAfter: 60 }),
    fp(
      `-   Bahwa saya telah menerima waris sebidang tanah tersebut Hak Adat ${cfg.hakAdat} yang terletak di Desa ${desaClean}, Kecamatan ${kecClean}, Kabupaten ${kabClean}, seluas ± ${cfg.luasBagianStr} m².`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 240, spaceAfter: 80 }
    ),
    fp(
      '-   Bahwa apabila dalam Proses Peralihan Hak atas tanah yang saya terima tersebut diatas, ternyata terjadi kekurangan pembayaran BPHTB, maka saya sanggup untuk membayar kekurangan BPHTB tersebut sesuai dengan ketentuan peraturan perundang-undangan yang berlaku.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 240, spaceAfter: 240 }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, rightHalfW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp('Mengetahui', { align: AlignmentType.CENTER, spaceAfter: 0 }),
                fp(cfg.kadesJabatan, {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_METERAI,
                }),
                fp(cfg.kadesNama, {
                  bold: true,
                  underline: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 0,
                }),
                ...(cfg.kadesNip
                  ? [fp(`NIP : ${cfg.kadesNip}`, { align: AlignmentType.CENTER, spaceAfter: 20 })]
                  : []),
              ],
            }),
            new TableCell({
              width: { size: rightHalfW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp(`${kabClean}, ${tanggalText}`, { align: AlignmentType.CENTER, spaceAfter: 0 }),
                fp('Yang menyatakan', {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_METERAI,
                }),
                fp(pemohon.nama, { bold: true, align: AlignmentType.CENTER, spaceAfter: 20 }),
              ],
            }),
          ],
        }),
      ],
    }),
    fp('Saksi – saksi :', { spaceBefore: 240, spaceAfter: 160 }),
    new Table({
      width: { size: 5800, type: WidthType.DXA },
      columnWidths: [3400, 2400],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      indent: { size: 320, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({ width: { size: 3400, type: WidthType.DXA }, borders: NO_BORDER, children: [fp(`1.  ${saksi1.nama}`, { spaceAfter: 360 })] }),
            new TableCell({ width: { size: 2400, type: WidthType.DXA }, borders: NO_BORDER, children: [fp('(                    )', { spaceAfter: 360 })] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ width: { size: 3400, type: WidthType.DXA }, borders: NO_BORDER, children: [fp(`2.  ${saksi2.nama}`, { spaceAfter: 40 })] }),
            new TableCell({ width: { size: 2400, type: WidthType.DXA }, borders: NO_BORDER, children: [fp('(                    )', { spaceAfter: 40 })] }),
          ],
        }),
      ],
    }),
  ];

  // =========================================================================
  // HAL. 6 — SURAT PERNYATAAN PENGUASAAN FISIK TANAH DAN TIDAK SENGKETA
  // =========================================================================
  const hal6: Array<Paragraph | Table> = [
    fp('SURAT PERNYATAAN PENGUASAAN FISIK TANAH DAN TIDAK SENGKETA', {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 120,
      pageBreakBefore: true,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 30 }),
    kvAligned(
      [
        ['Nama', pemohon.nama],
        ['Tempat/Tgl. Lahir', pemohon.ttl],
        ['Pekerjaan', pemohon.pekerjaan],
        ['Nomor KTP', pemohon.nik],
        ['Alamat', pemohon.alamat],
      ],
      { indentTwips: 540, labelPct: 26, size: 20 }
    ),
    fp('Dengan disaksikan oleh :', { spaceBefore: 60, spaceAfter: 30 }),
    kvAligned(
      [
        ['1.  Nama', saksi1.nama],
        ['     Tempat/Tgl. Lahir', saksi1.ttl],
        ['     Pekerjaan', saksi1.pekerjaan],
        ['     Nomor KTP', saksi1.nik],
        ['     Alamat', saksi1.alamat],
      ],
      { indentTwips: 240, labelPct: 27, size: 20 }
    ),
    kvAligned(
      [
        ['2.  Nama', saksi2.nama],
        ['     Tempat/Tgl. Lahir', saksi2.ttl],
        ['     Pekerjaan', saksi2.pekerjaan],
        ['     Nomor KTP', saksi2.nik],
        ['     Alamat', saksi2.alamat],
      ],
      { indentTwips: 240, labelPct: 27, size: 20 }
    ),
    fp(`Pada hari ini ${formattedDocDate ? `${formattedDocDate.hari}, ${formattedDocDate.tanggal_biasa}` : '........................'}`, {
      spaceBefore: 60,
      spaceAfter: 0,
      size: 20,
    }),
    fp('dengan ini menyatakan :', { spaceAfter: 40, size: 20 }),
    fpRuns(
      [
        {
          text: `1.  Bahwa saya adalah benar-benar sebagai pemilik sebidang tanah seluas ± ${cfg.luasIndukStr} m² yang terletak di Desa ${desaClean}, Kecamatan ${kecClean}, Kabupaten ${kabClean} yang tercatat dalam nominatif Desa ${cfg.hakAdat} Desa ${desaClean}, yang tercatat atas nama `,
        },
        { text: cfg.atasNamaC, bold: true },
        { text: '.' },
      ],
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, size: 20 }
    ),
    fpRuns(
      [
        {
          text: `2.  Bahwa saya sebagai pemilik tanah tersebut diatas, benar-benar menguasai tanah secara fisik sejak tahun ${cfg.menguasaiSejakTahun} sampai sekarang dan saya pergunakan untuk `,
        },
        { text: cfg.penggunaanTanah, bold: true },
        { text: '.' },
      ],
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, size: 20 }
    ),
    fp(
      '3.  Bahwa tanah tersebut tidak dalam keadaan sengketa, konflik, perkara, sita jaminan atau pemblokiran dari pihak lain.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 80, size: 20 }
    ),
    fp(
      `Demikian surat pernyataan ini saya buat dengan sebenarnya dan saya bertanggung jawab sepenuhnya atas pernyataan ini. Jika diperlukan saya sanggup mengangkat sumpah menurut Agama/Kepercayaan saya. Apabila dikemudian hari terjadi perkara perdata maupun pidana atas tanah ini, maka perkara tersebut merupakan tanggung jawab pribadi saya dengan tidak melibatkan Pejabat/Kantor Badan Pertanahan Nasional Kabupaten ${kabClean}.`,
      { align: AlignmentType.JUSTIFIED, spaceAfter: 120, size: 20 }
    ),
    buildSaksiAndPemohonSignTable(saksi1.nama, saksi2.nama, pemohon.nama),
    ...buildCenteredKadesBlock(cfg.kadesJabatan, cfg.kadesNama, cfg.kadesNip, 100),
  ];

  // =========================================================================
  // HAL. 7 — SURAT PERNYATAAN PENGUASAAN FISIK BIDANG TANAH
  // =========================================================================
  const hal7: Array<Paragraph | Table> = [
    fp('SURAT PERNYATAAN PENGUASAAN FISIK BIDANG TANAH', {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 100,
      pageBreakBefore: true,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 20, size: 20 }),
    kvAligned(
      [
        ['Nama', pemohon.nama],
        ['Tempat/Tgl. Lahir', pemohon.ttl],
        ['Pekerjaan', pemohon.pekerjaan],
        ['Nomor KTP', pemohon.nik],
        ['Alamat', pemohon.alamat],
      ],
      { indentTwips: 540, labelPct: 26, size: 20 }
    ),
    fp('Dengan ini menyatakan bahwa saya menguasai bidang tanah yang terletak:', {
      spaceBefore: 60,
      spaceAfter: 20,
      size: 20,
    }),
    kvAligned(
      [
        ['Desa', desaClean],
        ['Kecamatan', kecClean],
        ['Kabupaten', kabClean],
        ['Hak Adat', cfg.hakAdat],
        ['Luas', `± ${cfg.luasIndukStr} m²`],
        ['Penggunaan Tanah', cfg.penggunaanTanah],
      ],
      { indentTwips: 540, labelPct: 26, size: 20 }
    ),
    fp('Batas-batas Tanah:', { spaceBefore: 40, spaceAfter: 20, size: 20 }),
    kvAligned(
      [
        ['Utara', cfg.batasInduk.utara],
        ['Timur', cfg.batasInduk.timur],
        ['Selatan', cfg.batasInduk.selatan],
        ['Barat', cfg.batasInduk.barat],
      ],
      { indentTwips: 540, labelPct: 26, size: 20 }
    ),
    fp(
      `Bahwa sebidang tanah tersebut saya kuasai sejak tahun ${cfg.menguasaiSejakTahun} yang sampai saat ini saya kuasai secara terus-menerus, tidak dijaminkan hutang, tidak dalam keadaan sengketa, bukan aset pemerintah/pemerintah daerah, dan tidak dalam kawasan hutan.`,
      { align: AlignmentType.JUSTIFIED, spaceBefore: 60, spaceAfter: 40, size: 20 }
    ),
    fp(
      `Demikian surat pernyataan ini saya buat dengan sebenarnya dan saya bertanggung jawab sepenuhnya atas pernyataan ini. Jika diperlukan saya sanggup mengangkat sumpah menurut Agama/Kepercayaan saya. Apabila dikemudian hari terjadi perkara perdata maupun pidana atas tanah ini, maka perkara tersebut merupakan tanggung jawab pribadi saya dan saya bersedia dituntut sesuai ketentuan hukum yang berlaku dengan tidak melibatkan Pejabat/Kantor Badan Pertanahan Kabupaten ${kabClean}, serta saya bersedia sertipikat yang telah saya terima dibatalkan oleh pihak berwenang.`,
      { align: AlignmentType.JUSTIFIED, spaceAfter: 60, size: 20 }
    ),
    fp('Demikian surat pernyataan ini saya buat di hadapan saksi-saksi:', { spaceAfter: 20, size: 20 }),
    kvAligned(
      [
        ['1.  Nama', saksi1.nama],
        ['     Tempat/Tgl. Lahir', saksi1.ttl],
        ['     Pekerjaan', saksi1.pekerjaan],
        ['     Nomor KTP', saksi1.nik],
        ['     Alamat', saksi1.alamat],
      ],
      { indentTwips: 360, labelPct: 27, size: 20 }
    ),
    kvAligned(
      [
        ['2.  Nama', saksi2.nama],
        ['     Tempat/Tgl. Lahir', saksi2.ttl],
        ['     Pekerjaan', saksi2.pekerjaan],
        ['     Nomor KTP', saksi2.nik],
        ['     Alamat', saksi2.alamat],
      ],
      { indentTwips: 360, labelPct: 27, size: 20 }
    ),
    fp('', { spaceAfter: 60 }),
    buildSaksiAndPemohonSignTable(saksi1.nama, saksi2.nama, pemohon.nama),
    ...buildCenteredKadesBlock(cfg.kadesJabatan, cfg.kadesNama, cfg.kadesNip, 80),
  ];

  // =========================================================================
  // HAL. 8 — SURAT PERNYATAAN PEMASANGAN TANDA BATAS & SKETSA BIDANG TANAH
  // =========================================================================
  const batasApproveLeftW = 5400;
  const batasApproveRightW = F4_CONTENT_WIDTH_DXA - batasApproveLeftW;
  const batasApproveTable = new Table({
    width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [batasApproveLeftW, batasApproveRightW],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: batasApproveLeftW, type: WidthType.DXA },
            borders: NO_BORDER,
            children: [
              fp('Menyetujui Pemilik yang berbatasan', { spaceAfter: 60, size: 20 }),
              new Table({
                width: { size: batasApproveLeftW, type: WidthType.DXA },
                columnWidths: [1100, 2900, 1400],
                layout: TableLayoutType.FIXED,
                borders: NO_TABLE_BORDERS,
                rows: [
                  ['Utara', cfg.batasInduk.utara],
                  ['Timur', cfg.batasInduk.timur],
                  ['Selatan', cfg.batasInduk.selatan],
                  ['Barat', cfg.batasInduk.barat],
                ].map(
                  ([arah, pemilik]) =>
                    new TableRow({
                      children: [
                        new TableCell({ width: { size: 1100, type: WidthType.DXA }, borders: NO_BORDER, children: [fp(arah, { spaceAfter: 40, size: 20 })] }),
                        new TableCell({ width: { size: 2900, type: WidthType.DXA }, borders: NO_BORDER, children: [fp(`: ${pemilik}`, { spaceAfter: 40, size: 20 })] }),
                        new TableCell({ width: { size: 1400, type: WidthType.DXA }, borders: NO_BORDER, children: [fp('(            )', { spaceAfter: 40, size: 20 })] }),
                      ],
                    })
                ),
              }),
            ],
          }),
          new TableCell({
            width: { size: batasApproveRightW, type: WidthType.DXA },
            borders: NO_BORDER,
            children: [
              fp(`${kabClean}, ${tanggalText}`, { align: AlignmentType.CENTER, spaceAfter: 0, size: 20 }),
              fp('Yang membuat pernyataan', {
                align: AlignmentType.CENTER,
                spaceAfter: SIGNATURE_SPACE_METERAI,
                size: 20,
              }),
              fp(pemohon.nama, { bold: true, align: AlignmentType.CENTER, spaceAfter: 20, size: 20 }),
            ],
          }),
        ],
      }),
    ],
  });

  const sketBoxLeftW = 4500;
  const sketBoxRightW = F4_CONTENT_WIDTH_DXA - sketBoxLeftW;
  const sketBoxTable = new Table({
    width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [sketBoxLeftW, sketBoxRightW],
    layout: TableLayoutType.FIXED,
    borders: {
      ...BOX_BORDER,
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        height: { value: 2600, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            width: { size: sketBoxLeftW, type: WidthType.DXA },
            borders: NO_BORDER,
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              fp('U ↑', { bold: true, spaceAfter: 40, size: 20 }),
              makePhotoOrPlaceholder(
                na?.foto_sket_pecah,
                '[ Area Gambar Sketsa Bidang Tanah ]',
                220,
                160
              ),
            ],
          }),
          new TableCell({
            width: { size: sketBoxRightW, type: WidthType.DXA },
            borders: NO_BORDER,
            margins: { top: 120, bottom: 100, left: 100, right: 120 },
            children: [
              fp(`Hak Adat ${cfg.hakAdat}`, { spaceAfter: 20, size: 20 }),
              fpRuns(
                [
                  { text: `Seluas ± ${cfg.luasIndukStr} m² An. ` },
                  { text: cfg.atasNamaC, bold: true },
                  { text: `. DESA ${desaClean}` },
                ],
                { spaceAfter: 80, size: 20 }
              ),
              ...cfg.bidangPecahan.map((b) =>
                fp(`${b.no}.  Luas ± ${b.luasStr} m² (${b.atasNama})`, {
                  spaceAfter: 30,
                  size: 20,
                })
              ),
            ],
          }),
        ],
      }),
    ],
  });

  const hal8: Array<Paragraph | Table> = [
    fp('SURAT PERNYATAAN PEMASANGAN TANDA BATAS DAN', {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 0,
      pageBreakBefore: true,
    }),
    fp('PERSETUJUAN PEMILIK YANG BERBATASAN', {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 100,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 20, size: 20 }),
    kvAligned(
      [
        ['Nama', pemohon.nama],
        ['Tempat/Tgl. Lahir', pemohon.ttl],
        ['Pekerjaan', pemohon.pekerjaan],
        ['Nomor KTP', pemohon.nik],
        ['Alamat', pemohon.alamat],
      ],
      { indentTwips: 540, labelPct: 26, size: 20 }
    ),
    fp(
      `Selaku pemohon pecah / pemilik Hak Adat ${cfg.hakAdat} seluas ± ${cfg.luasIndukStr} m², yang terletak di Desa ${desaClean}, Kecamatan ${kecClean}, Kabupaten ${kabClean}. Dengan ini menyatakan bahwa tanah tersebut :`,
      { align: AlignmentType.JUSTIFIED, spaceBefore: 60, spaceAfter: 40, size: 20 }
    ),
    fp('1.  Telah dipasang patok/ tanda batas;', { indentLeft: 320, hanging: 320, spaceAfter: 20, size: 20 }),
    fp('2.  Terhadap patok yang dipasang tersebut tidak ada pihak yang keberatan;', {
      indentLeft: 320,
      hanging: 320,
      spaceAfter: 20,
      size: 20,
    }),
    fp(
      '3.  Apabila ternyata luas hasil ukur lebih kecil dari luas yang tertulis pada alas hak/ akta peralihan hak/ surat-surat lain dalam berkas permohonan sertipikat, kami menerima luas hasil ukuran petugas Kantor Pertanahan; dan',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 20, size: 20 }
    ),
    fp(
      '4.  Apabila hasil pengukuran ternyata lebih besar dari yang tertulis pada alas hak/ akta peralihan hak/ surat-surat lain dalam berkas permohonan sertipikat, saya tidak mengambil hak orang lain dan tidak ada perolehan lain selain bukti pemilikan tersebut diatas, apabila ada gugatan/ keberatan dari pihak lain, saya akan bertanggung jawab.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 60, size: 20 }
    ),
    fp(
      'Demikian Surat Pernyataan ini saya buat dengan sebenarnya dengan penuh tanggung jawab dan saya bersedia mengangkat sumpah bila diperlukan, apabila pernyataan ini tidak benar saya bersedia dituntut dihadapan pihak yang berwenang.',
      { align: AlignmentType.JUSTIFIED, spaceAfter: 80, size: 20 }
    ),
    batasApproveTable,
    fp('SKETSA BIDANG TANAH', { bold: true, spaceBefore: 100, spaceAfter: 40, size: 20 }),
    sketBoxTable,
    fp('', { spaceAfter: 80 }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [5100, F4_CONTENT_WIDTH_DXA - 5100],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 5100, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp('Saksi – saksi :', { spaceAfter: 160, size: 20 }),
                fp(`1.  ${saksi1.nama}                    (                )`, { spaceAfter: 320, size: 20 }),
                fp(`2.  ${saksi2.nama}                    (                )`, { spaceAfter: 40, size: 20 }),
              ],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 5100, type: WidthType.DXA },
              borders: NO_BORDER,
              children: buildCenteredKadesBlock(cfg.kadesJabatan, cfg.kadesNama, cfg.kadesNip, 0),
            }),
          ],
        }),
      ],
    }),
  ];

  // =========================================================================
  // HAL. 9 — GAMBAR SKET TANAH
  // =========================================================================
  const sketCanvasBox = new Table({
    width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [F4_CONTENT_WIDTH_DXA],
    layout: TableLayoutType.FIXED,
    borders: THIN_TABLE_BORDERS,
    rows: [
      new TableRow({
        height: { value: 5200, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            borders: THIN_BORDER,
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: [
              fp('U ↑', { bold: true, spaceAfter: 60 }),
              ...(decodeDataUrlImage(na?.foto_sket_pecah)
                ? [makePhotoOrPlaceholder(na?.foto_sket_pecah, '', 420, 300)]
                : [
                    fp(
                      `Utara: ${cfg.batasInduk.utara}   |   Timur: ${cfg.batasInduk.timur}   |   Selatan: ${cfg.batasInduk.selatan}   |   Barat: ${cfg.batasInduk.barat}`,
                      { align: AlignmentType.CENTER, italic: true, color: '64748B', size: 19, spaceAfter: 120 }
                    ),
                    ...Array.from({ length: 10 }, () => fp('\u00A0', { spaceAfter: 40 })),
                  ]),
            ],
          }),
        ],
      }),
    ],
  });

  const ketBidangTable = new Table({
    width: { size: F4_CONTENT_WIDTH_DXA - 240, type: WidthType.DXA },
    columnWidths: [700, 360, F4_CONTENT_WIDTH_DXA - 240 - 1060],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    indent: { size: 240, type: WidthType.DXA },
    rows: cfg.bidangPecahan.map(
      (b) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 700, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: [fp(String(b.no), { align: AlignmentType.CENTER, spaceAfter: 0, size: 20 })],
            }),
            new TableCell({
              width: { size: 360, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('', { spaceAfter: 0 })],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 240 - 1060, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 40, bottom: 40, left: 0, right: 0 },
              children: [fp(`Luas ± ${b.luasStr} m² (${b.atasNama})`, { spaceAfter: 0 })],
            }),
          ],
        })
    ),
  });

  const hal9: Array<Paragraph | Table> = [
    fp('GAMBAR SKET TANAH', {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 160,
      pageBreakBefore: true,
    }),
    sketCanvasBox,
    fp('KETERANGAN', { bold: true, spaceBefore: 160, spaceAfter: 80 }),
    ketBidangTable,
    fp('', { spaceAfter: 200 }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, rightHalfW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: buildCenteredKadesBlock(cfg.kadesJabatan, cfg.kadesNama, cfg.kadesNip, 0),
            }),
            new TableCell({
              width: { size: rightHalfW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp(`${kabClean}, ${tanggalText}`, { align: AlignmentType.CENTER, spaceAfter: 0 }),
                fp('Yang Menyatakan', {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_STANDARD,
                }),
                fp(pemohon.nama, { bold: true, align: AlignmentType.CENTER, spaceAfter: 20 }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  // =========================================================================
  // HAL. 10 — BERITA ACARA KESAKSIAN (PENGUASAAN FISIK & WARISAN)
  // =========================================================================
  const hal10: Array<Paragraph | Table> = [
    fp('BERITA ACARA KESAKSIAN', {
      bold: true,
      align: AlignmentType.CENTER,
      spaceAfter: 140,
      pageBreakBefore: true,
    }),
    fp(
      `Pada hari ini ${formattedDocDate ? formattedDocDate.hari : '....................'} Tanggal, ${tanggalText}. Kami yang bertanda tangan di bawah ini:`,
      { spaceAfter: 80 }
    ),
    kvAligned(
      [
        ['1.  Nama', saksi1.nama],
        ['     Tempat/Tgl. Lahir', saksi1.ttl],
        ['     Pekerjaan', saksi1.pekerjaan],
        ['     Nomor KTP', saksi1.nik],
        ['     Alamat', saksi1.alamat],
      ],
      { indentTwips: 360, labelPct: 27, size: 20 }
    ),
    kvAligned(
      [
        ['2.  Nama', saksi2.nama],
        ['     Tempat/Tgl. Lahir', saksi2.ttl],
        ['     Pekerjaan', saksi2.pekerjaan],
        ['     Nomor KTP', saksi2.nik],
        ['     Alamat', saksi2.alamat],
      ],
      { indentTwips: 360, labelPct: 27, size: 20 }
    ),
    fp('Dengan ini memberikan kesaksian (jika diperlukan sanggup diangkat sumpah) bahwa :', {
      spaceBefore: 100,
      spaceAfter: 60,
    }),
    fp(
      `1.  Sebidang tanah bekas Hak Milik Adat ${cfg.hakAdat}, seluas ± ${cfg.luasIndukStr} m², yang terletak di ${cfg.namaBlokDukuh} Desa ${desaClean}, Kecamatan ${kecClean}, Kabupaten ${kabClean}.`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 30, size: 20 }
    ),
    fp('Dengan batas-batas:', { indentLeft: 320, spaceAfter: 20, size: 20 }),
    kvAligned(
      [
        ['Utara', cfg.batasBagian.utara],
        ['Selatan', cfg.batasBagian.selatan],
        ['Timur', cfg.batasBagian.timur],
        ['Barat', cfg.batasBagian.barat],
      ],
      { indentTwips: 540, labelPct: 20, size: 20 }
    ),
    fp('Benar-benar secara fisik sampai saat ini dimiliki / dikuasai oleh:', {
      indentLeft: 320,
      spaceBefore: 40,
      spaceAfter: 20,
      size: 20,
    }),
    kvAligned(
      [
        ['Nama', pemohon.nama],
        ['Tempat/Tgl. Lahir', pemohon.ttl],
        ['Pekerjaan', pemohon.pekerjaan],
        ['Nomor KTP', pemohon.nik],
        ['Alamat', pemohon.alamat],
      ],
      { indentTwips: 540, labelPct: 26, size: 20 }
    ),
    fp(
      `2.  Kepemilikan / penguasaan tanah tersebut berdasarkan: Warisan yang dilaksanakan secara lisan / tertulis yang tanda buktinya hilang *) berasal dari ${cfg.hubunganPewaris} (${cfg.namaPewaris}) Tahun ${cfg.tahunWaris}.`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceBefore: 60, spaceAfter: 40, size: 20 }
    ),
    fp(
      '3.  Bahwa pada saat ini tanah tersebut tidak dalam sengketa baik batas maupun pemilikan dengan pihak lain. Demikian berita acara ini kami buat dengan sebenarnya, jika dikemudian hari ternyata berita acara ini tidak sesuai dengan data-data tersebut diatas, kami bersedia dituntut sesuai ketentuan yang berlaku.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 220, size: 20 }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4350, F4_CONTENT_WIDTH_DXA - 4350],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 4350, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: buildCenteredKadesBlock(cfg.kadesJabatan, cfg.kadesNama, cfg.kadesNip, 20),
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4350, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 100, right: 0 },
              children: [
                fp(`${kabClean}, ${tanggalText}`, { align: AlignmentType.CENTER, spaceAfter: 0, keepNext: true }),
                fp('Yang Membuat Kesaksian,', { align: AlignmentType.CENTER, spaceAfter: 240, keepNext: true }),
                buildWarisCSignerRowsTable(
                  [
                    { no: 1, nama: saksi1.nama },
                    { no: 2, nama: saksi2.nama },
                  ],
                  { totalWidthDxa: F4_CONTENT_WIDTH_DXA - 4450, dotsWidthDxa: 1620, rowSpaceAfter: 360 }
                ),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  // =========================================================================
  // HAL. 11 — BERITA ACARA KESAKSIAN (RIWAYAT PERALIHAN & LANDREFORM)
  // =========================================================================
  const hal11: Array<Paragraph | Table> = [
    fp('BERITA ACARA KESAKSIAN', {
      bold: true,
      align: AlignmentType.CENTER,
      spaceAfter: 120,
      pageBreakBefore: true,
    }),
    fp(
      `Pada hari ini ${formattedDocDate ? formattedDocDate.hari : '....................'} Tanggal, ${tanggalText}. Kami yang bertanda tangan di bawah ini:`,
      { spaceAfter: 60, size: 20 }
    ),
    kvAligned(
      [
        ['1.  Nama', saksi1.nama],
        ['     Tempat/Tgl. Lahir', saksi1.ttl],
        ['     Pekerjaan', saksi1.pekerjaan],
        ['     Nomor KTP', saksi1.nik],
        ['     Alamat', saksi1.alamat],
      ],
      { indentTwips: 360, labelPct: 27, size: 20 }
    ),
    kvAligned(
      [
        ['2.  Nama', saksi2.nama],
        ['     Tempat/Tgl. Lahir', saksi2.ttl],
        ['     Pekerjaan', saksi2.pekerjaan],
        ['     Nomor KTP', saksi2.nik],
        ['     Alamat', saksi2.alamat],
      ],
      { indentTwips: 360, labelPct: 27, size: 20 }
    ),
    fp(
      `Dengan ini memberikan kesaksian (jika diperlukan sanggup diangkat sumpah) bahwa: Sebidang tanah bekas Hak Milik Adat ${cfg.hakAdat}, seluas ± ${cfg.luasIndukStr} m², semula tercatat atas nama ${cfg.atasNamaC} yang terletak di Desa ${desaClean}, Kecamatan ${kecClean}, Kabupaten ${kabClean} dengan batas-batas :`,
      { align: AlignmentType.JUSTIFIED, spaceBefore: 80, spaceAfter: 30, size: 20 }
    ),
    kvAligned(
      [
        ['Utara', cfg.batasBagian.utara],
        ['Selatan', cfg.batasBagian.selatan],
        ['Timur', cfg.batasBagian.timur],
        ['Barat', cfg.batasBagian.barat],
      ],
      { indentTwips: 720, labelPct: 18, size: 20 }
    ),
    fp(
      `Bahwa tanah tersebut sejak tahun ${cfg.tahunTercatatC} dikuasai oleh ${cfg.atasNamaC} karena Akta/Surat dibawah tangan/dengan lisan Jual Beli/Hibah/Tukar Menukar/Waris/Pembagian Waris*), kemudian pada Tanggal/Tahun ${cfg.tahunWaris} dialihkan kepada:`,
      { align: AlignmentType.JUSTIFIED, spaceBefore: 40, spaceAfter: 30, size: 20 }
    ),
    kvAligned(
      [
        ['Nama', pemohon.nama],
        ['Tempat/Tgl. Lahir', pemohon.ttl],
        ['Pekerjaan', pemohon.pekerjaan],
        ['Nomor KTP', pemohon.nik],
        ['Alamat', pemohon.alamat],
      ],
      { indentTwips: 540, labelPct: 26, size: 20 }
    ),
    fp(
      `Dengan cara Akta/Surat dibawah tangan/dengan lisan Jual Beli/Hibah/Tukar Menukar/Waris/Pembagian Waris*) dan sampai saat ini masih dikuasai oleh : ${pemohon.nama}, adalah orang yang sebenarnya berhak atas tanah dimaksud dan belum mempunyai sertipikat atau sertipikat sementara, tidak dijaminkan kepada pihak lain, tidak dalam keadaan sengketa kepemilikan / batas-batasnya, dan dipergunakan untuk ${cfg.penggunaanTanah} serta bukan merupakan objek Landreform.`,
      { align: AlignmentType.JUSTIFIED, spaceBefore: 60, spaceAfter: 40, size: 20 }
    ),
    fp(
      'Demikian Surat Pernyataan Kesaksian ini dibuat dengan sesungguhnya dengan penuh tanggung jawab dan apabila ternyata di kemudian hari Surat Pernyataan Kesaksian ini tidak benar, maka kami sanggup dituntut dimuka Hakim secara pidana maupun perdata, karena memberikan keterangan palsu sesuai dengan ketentuan Peraturan Perundang-undangan yang berlaku.',
      { align: AlignmentType.JUSTIFIED, spaceAfter: 120, size: 20 }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, rightHalfW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp('', { spaceAfter: 0 }),
                fp('Yang Diberi Kesaksian', {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_STANDARD,
                  size: 20,
                }),
                fp(pemohon.nama, { bold: true, align: AlignmentType.CENTER, spaceAfter: 100, size: 20 }),
                ...buildCenteredKadesBlock(cfg.kadesJabatan, cfg.kadesNama, cfg.kadesNip, 40),
              ],
            }),
            new TableCell({
              width: { size: rightHalfW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp(`${kabClean}, ${tanggalText}`, { align: AlignmentType.CENTER, spaceAfter: 0, size: 20, keepNext: true }),
                fp('Yang Memberi Kesaksian,', { align: AlignmentType.CENTER, spaceAfter: 240, size: 20, keepNext: true }),
                buildWarisCSignerRowsTable(
                  [
                    { no: 1, nama: saksi1.nama },
                    { no: 2, nama: saksi2.nama },
                  ],
                  { totalWidthDxa: rightHalfW - 120, dotsWidthDxa: 1580, size: 20, rowSpaceAfter: 360 }
                ),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  // =========================================================================
  // HAL. 12 — SURAT KETERANGAN (KEPALA DESA — PP 24/1997 + GAMBAR SITUASI)
  // =========================================================================
  const situasiBox = new Table({
    width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [F4_CONTENT_WIDTH_DXA],
    layout: TableLayoutType.FIXED,
    borders: BOX_BORDER,
    rows: [
      new TableRow({
        height: { value: 3000, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
            borders: BOX_BORDER,
            margins: { top: 100, bottom: 100, left: 160, right: 160 },
            children: [
              fp('Gambar Situasi tanah', { underline: true, spaceAfter: 80 }),
              ...(decodeDataUrlImage(na?.foto_sket_pecah)
                ? [makePhotoOrPlaceholder(na?.foto_sket_pecah, '', 360, 200)]
                : Array.from({ length: 7 }, () => fp('\u00A0', { spaceAfter: 20 }))),
            ],
          }),
        ],
      }),
    ],
  });

  const hal12: Array<Paragraph | Table> = [
    fp('SURAT KETERANGAN', {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 20,
      pageBreakBefore: true,
    }),
    fp(`Nomor: ${cfg.noSuratKeterangan || '................................'}`, {
      align: AlignmentType.CENTER,
      spaceAfter: 120,
    }),
    fp('Yang bertanda tangan dibawah ini:', { firstLine: 560, spaceAfter: 20 }),
    fp(
      `${cfg.kadesNama}, ${cfg.kadesJabatan} Kecamatan ${kecClean} Kabupaten ${kabClean}, menerangkan dengan ini bahwa :`,
      { align: AlignmentType.JUSTIFIED, spaceAfter: 60 }
    ),
    fp(
      `1.  Sebidang tanah bekas hak milik adat berupa ${cfg.jenisTanah} terdaftar dalam Petuk D Huruf ${cfg.hakAdat}, seluas ± ${cfg.luasIndukStr} m², dengan segala sesuatu yang berdiri di atasnya berupa ${cfg.berdiriDiAtasnya} dan terletak di Desa ${desaClean} tersebut di tempat terkenal dengan nama ${cfg.namaBlokDukuh} dan berbatasan dengan tanah-tanah kepunyaan:`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, size: 20 }
    ),
    twoColBatasTable(cfg.batasInduk, 720),
    fp(
      `sungguh-sungguh sejak tanggal ${cfg.menguasaiSejakTahun} kepunyaan ${pemohon.nama}.`,
      { indentLeft: 320, spaceAfter: 40, size: 20 }
    ),
    fp(
      `2.  Pemilik tanah tersebut adalah seorang Warga Negara Indonesia umur ± ${pemohon.umur} tahun dan bertempat tinggal di ${pemohon.alamat}.`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, size: 20 }
    ),
    fp(
      '3.  Tanah tersebut sampai pada waktu keterangan ini dibuat masih tetap tertulis atas namanya tidak menjadi perselisihan dengan pihak lain, baik mengenai haknya maupun batas-batasnya.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, size: 20 }
    ),
    fp(`4.  Tanah tersebut dipergunakan untuk : ${cfg.penggunaanTanah}.`, {
      indentLeft: 320,
      hanging: 320,
      spaceAfter: 40,
      size: 20,
    }),
    fp(
      '5.  Keterangan ini diberikan untuk memenuhi keterangan-keterangan dalam PP No. 24/1997 jo. PMNA/KBPN No. 3/1997 (Ps. 76 ayat 3 huruf B).',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 120, size: 20 }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, rightHalfW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp('Mengetahui dan menerangkan', { spaceAfter: 0, size: 20 }),
                fp(cfg.camatJabatan, { spaceAfter: SIGNATURE_SPACE_STANDARD, size: 20 }),
                fp(cfg.camatNama, { bold: true, underline: true, spaceAfter: 0, size: 20 }),
                ...(cfg.camatNip ? [fp(`NIP. ${cfg.camatNip}`, { spaceAfter: 0, size: 20 })] : []),
                fp(`Tanggal : ${tanggalText}`, { spaceAfter: 0, size: 20 }),
                fp(`Nomor  : ${cfg.camatNomor || '....................'}`, { spaceAfter: 20, size: 20 }),
              ],
            }),
            new TableCell({
              width: { size: rightHalfW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp(`${kabClean}, ${tanggalText}`, { align: AlignmentType.CENTER, spaceAfter: 20, size: 20, keepNext: true }),
                fp(cfg.kadesJabatan, {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_STANDARD,
                  size: 20,
                }),
                fp(cfg.kadesNama, {
                  bold: true,
                  underline: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 0,
                  size: 20,
                }),
                ...(cfg.kadesNip
                  ? [fp(`NIP : ${cfg.kadesNip}`, { align: AlignmentType.CENTER, spaceAfter: 20, size: 20 })]
                  : []),
              ],
            }),
          ],
        }),
      ],
    }),
    fp('', { spaceAfter: 80 }),
    situasiBox,
  ];

  // =========================================================================
  // HAL. 13 — SURAT KETERANGAN RIWAYAT TANAH
  // =========================================================================
  const hal13: Array<Paragraph | Table> = [
    fp('SURAT KETERANGAN RIWAYAT TANAH', {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 20,
      pageBreakBefore: true,
    }),
    fp(`Nomor: ${cfg.noSuratRiwayat || '................................'}`, {
      align: AlignmentType.CENTER,
      spaceAfter: 140,
    }),
    fp(
      `Yang bertanda tangan dibawah ini, ${cfg.kadesJabatan} Kecamatan ${kecClean} Kabupaten ${kabClean}, menerangkan dengan ini bahwa :`,
      { align: AlignmentType.JUSTIFIED, firstLine: 560, spaceAfter: 80 }
    ),
    fp(
      `1.  Sebidang tanah bekas hak milik adat yang tercatat dalam buku C desa No: ${cfg.hakAdat}, seluas ± ${cfg.luasIndukStr} m², terletak di Desa ${desaClean}. Dengan Batas-batas :`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40 }
    ),
    twoColBatasTable(cfg.batasInduk, 720),
    fp(
      `Yang terletak di Desa ${desaClean} Kecamatan ${kecClean} Kabupaten ${kabClean} sejak Tahun ${cfg.tahunTercatatC} tercatat atas nama ${cfg.atasNamaC}.`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, spaceBefore: 30, spaceAfter: 30 }
    ),
    fp('Sesuai dengan catatan pada administrasi Desa/Kelurahan kami, selanjutnya tanah tersebut:', {
      indentLeft: 320,
      spaceAfter: 40,
    }),
    ...cfg.riwayat.map((r) =>
      fp(
        `${r.huruf}.  Pada tahun ${r.tahun} dikuasai oleh ${r.oleh} dengan cara: ${r.cara}. Dengan bukti: ${r.bukti}`,
        { align: AlignmentType.JUSTIFIED, indentLeft: 640, hanging: 320, spaceAfter: 40, size: 20 }
      )
    ),
    fp(
      `2.  Bahwa SPPT PBB tanah diatas sampai saat ini masih tercatat atas nama ${cfg.namaWpPbb} dengan NOP : ${cfg.nopPbb}.`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceBefore: 40, spaceAfter: 40 }
    ),
    fp(
      '3.  Bahwa terhadap tanah tersebut tidak terdapat sengketa baik batas maupun kepemilikan dengan pihak lain, tidak dijadikan / menjadi agunan / gadai dengan pihak lain dan belum pernah diajukan permohonan sertipikat hak atas tanahnya.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 140 }
    ),
    fp(
      'Demikian surat keterangan ini kami buat dengan sebenarnya, dan jika dikemudian hari ternyata keterangan ini tidak sesuai dengan data/keadaan yang sebenarnya, maka saya bersedia dituntut sesuai dengan ketentuan perundang-undangan yang berlaku.',
      { align: AlignmentType.JUSTIFIED, firstLine: 560, spaceAfter: 180 }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4800, F4_CONTENT_WIDTH_DXA - 4800],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({ width: { size: 4800, type: WidthType.DXA }, borders: NO_BORDER, children: [fp('', { spaceAfter: 0 })] }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4800, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp(`${kabClean}, ${tanggalText}`, { align: AlignmentType.CENTER, spaceAfter: 20, keepNext: true }),
                fp(cfg.kadesJabatan, {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_STANDARD,
                }),
                fp(cfg.kadesNama, {
                  bold: true,
                  underline: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 0,
                }),
                ...(cfg.kadesNip
                  ? [fp(`NIP : ${cfg.kadesNip}`, { align: AlignmentType.CENTER, spaceAfter: 20 })]
                  : []),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  // =========================================================================
  // HAL. 14 — SURAT PERNYATAAN PEMBAGIAN WARISAN
  // =========================================================================
  const colNoW = 600;
  const colNamaW = 2800;
  const colUmurW = 900;
  const colPekW = 2200;
  const colAlmW = F4_CONTENT_WIDTH_DXA - colNoW - colNamaW - colUmurW - colPekW;

  const heirRowsForTable =
    cfg.ahliWaris.length > 0
      ? cfg.ahliWaris
      : [
          {
            no: 1,
            nama: pemohon.nama,
            umur: pemohon.umur,
            pekerjaan: pemohon.pekerjaan,
            alamatRingkas: pemohon.alamat,
          },
        ];

  const pembagianHeirTable = new Table({
    width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [colNoW, colNamaW, colUmurW, colPekW, colAlmW],
    layout: TableLayoutType.FIXED,
    borders: THIN_TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ width: { size: colNoW, type: WidthType.DXA }, borders: THIN_BORDER, margins: { top: 60, bottom: 60, left: 60, right: 60 }, children: [fp('NO', { bold: true, align: AlignmentType.CENTER, spaceAfter: 0, size: 20 })] }),
          new TableCell({ width: { size: colNamaW, type: WidthType.DXA }, borders: THIN_BORDER, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [fp('NAMA', { bold: true, align: AlignmentType.CENTER, spaceAfter: 0, size: 20 })] }),
          new TableCell({ width: { size: colUmurW, type: WidthType.DXA }, borders: THIN_BORDER, margins: { top: 60, bottom: 60, left: 60, right: 60 }, children: [fp('UMUR', { bold: true, align: AlignmentType.CENTER, spaceAfter: 0, size: 20 })] }),
          new TableCell({ width: { size: colPekW, type: WidthType.DXA }, borders: THIN_BORDER, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [fp('PEKERJAAN', { bold: true, align: AlignmentType.CENTER, spaceAfter: 0, size: 20 })] }),
          new TableCell({ width: { size: colAlmW, type: WidthType.DXA }, borders: THIN_BORDER, margins: { top: 60, bottom: 60, left: 80, right: 80 }, children: [fp('ALAMAT', { bold: true, align: AlignmentType.CENTER, spaceAfter: 0, size: 20 })] }),
        ],
      }),
      ...heirRowsForTable.map(
        (aw) =>
          new TableRow({
            children: [
              new TableCell({ width: { size: colNoW, type: WidthType.DXA }, borders: THIN_BORDER, margins: { top: 50, bottom: 50, left: 60, right: 60 }, children: [fp(String(aw.no), { align: AlignmentType.CENTER, spaceAfter: 0, size: 20 })] }),
              new TableCell({ width: { size: colNamaW, type: WidthType.DXA }, borders: THIN_BORDER, margins: { top: 50, bottom: 50, left: 80, right: 80 }, children: [fp(aw.nama, { spaceAfter: 0, size: 20 })] }),
              new TableCell({ width: { size: colUmurW, type: WidthType.DXA }, borders: THIN_BORDER, margins: { top: 50, bottom: 50, left: 60, right: 60 }, children: [fp(aw.umur, { align: AlignmentType.CENTER, spaceAfter: 0, size: 20 })] }),
              new TableCell({ width: { size: colPekW, type: WidthType.DXA }, borders: THIN_BORDER, margins: { top: 50, bottom: 50, left: 80, right: 80 }, children: [fp(aw.pekerjaan, { spaceAfter: 0, size: 20 })] }),
              new TableCell({ width: { size: colAlmW, type: WidthType.DXA }, borders: THIN_BORDER, margins: { top: 50, bottom: 50, left: 80, right: 80 }, children: [fp(aw.alamatRingkas, { spaceAfter: 0, size: 20 })] }),
            ],
          })
      ),
    ],
  });

  const hal14: Array<Paragraph | Table> = [
    fp('SURAT PERNYATAAN PEMBAGIAN WARISAN', {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 140,
      pageBreakBefore: true,
    }),
    fpRuns(
      [
        {
          text: `Yang bertanda tangan / cap jempol dibawah ini kami para ahli waris ${cfg.sebutanPewaris} : `,
        },
        { text: cfg.namaPewaris, bold: true },
        { text: ', dengan ini menyatakan :' },
      ],
      { align: AlignmentType.JUSTIFIED, spaceAfter: 60 }
    ),
    fpRuns(
      [
        { text: `1.  Bahwa ${cfg.sebutanPewaris.toLowerCase()} ` },
        { text: cfg.namaPewaris, bold: true },
        {
          text: ` telah meninggal pada tahun ${cfg.tahunMeninggalPewaris} di ${cfg.tempatMeninggalPewaris} dengan meninggalkan ahli waris sebagai berikut :`,
        },
      ],
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 60, size: 20 }
    ),
    pembagianHeirTable,
    fp(
      `2.  Bahwa almarhum tersebut diatas meninggalkan tanah warisan terletak di ${cfg.namaBlokDukuh} Desa ${desaClean} Kecamatan ${kecClean} Kabupaten ${kabClean}. Tersebut pada ${cfg.hakAdat} seluas ± ${cfg.luasIndukStr} m² dan belum bersertipikat.`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceBefore: 80, spaceAfter: 40, size: 20 }
    ),
    fpRuns(
      [
        {
          text: '3.  Bahwa berdasarkan musyawarah ahli waris semua ahli waris sepakat bahwa tanah waris tersebut menjadi bagian / Hak: ',
        },
        { text: cfg.penerimaBagian, bold: true },
        { text: ` seluas ± ${cfg.luasBagianStr} m², dengan batas-batas:` },
      ],
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 30, size: 20 }
    ),
    twoColBatasTable(cfg.batasBagian, 720),
    fp(
      '4.  Bahwa sejak saat ini hak dan segala kewajiban yang berkaitan dengan tanah tersebut menjadi hak dan kewajiban si penerima pembagian waris, termasuk memohon sertipikat atas namanya sendiri.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceBefore: 30, spaceAfter: 80, size: 20 }
    ),
    fp(
      'Demikian berita acara ini dibuat dengan sebenarnya (jika diperlukan sanggup diangkat sumpah). Untuk melengkapi surat pernyataan yang bersangkutan guna mengajukan permohonan sertipikat.',
      { align: AlignmentType.JUSTIFIED, spaceAfter: 120, size: 20 }
    ),
    buildHeirSignaturesRight(
      `${kabClean}, ${tanggalText}`,
      'Yang membuat pernyataan / Para Ahli Waris'
    ),
    fp('', { spaceAfter: 80 }),
    buildCamatKadesDualTable({
      kecClean,
      desaClean,
      camatJabatan: cfg.camatJabatan,
      camatNama: cfg.camatNama,
      camatNip: cfg.camatNip,
      camatNomor: cfg.camatNomor,
      kadesJabatan: cfg.kadesJabatan,
      kadesNama: cfg.kadesNama,
      kadesNip: cfg.kadesNip,
      kadesNomor: cfg.kadesNomor,
      tanggalText,
    }),
  ];

  // =========================================================================
  // HAL. 15 — GEOTAGGING TAMPAK DEPAN, LINK MAPS & PATOK 1–2
  // =========================================================================
  const hal15: Array<Paragraph | Table> = [
    fp('Sebidang tanah', { align: AlignmentType.CENTER, spaceAfter: 0, pageBreakBefore: true }),
    fp(`bekas Hak Milik Adat ${cfg.hakAdat},`, { align: AlignmentType.CENTER, spaceAfter: 0 }),
    fp(`Seluas ± ${cfg.luasIndukStr} m²`, { align: AlignmentType.CENTER, spaceAfter: 140 }),
    fp('Tampak Depan', { spaceAfter: 60 }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [F4_CONTENT_WIDTH_DXA],
      layout: TableLayoutType.FIXED,
      borders: THIN_TABLE_BORDERS,
      rows: [
        new TableRow({
          height: { value: 4400, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                makePhotoOrPlaceholder(
                  na?.foto_tampak_depan,
                  '[ Unggah Foto Tampak Depan Lokasi dengan Timestamp GPS ]',
                  340,
                  260
                ),
              ],
            }),
          ],
        }),
      ],
    }),
    fp(na?.link_maps?.trim() || na?.koordinat_gps?.trim() || 'https://maps.app.goo.gl/...', {
      align: AlignmentType.CENTER,
      underline: true,
      color: '1D4ED8',
      spaceBefore: 80,
      spaceAfter: 160,
      size: 20,
    }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, rightHalfW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('1', { align: AlignmentType.CENTER, bold: true, spaceAfter: 40 })],
            }),
            new TableCell({
              width: { size: rightHalfW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('2', { align: AlignmentType.CENTER, bold: true, spaceAfter: 40 })],
            }),
          ],
        }),
        new TableRow({
          height: { value: 3600, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                makePhotoOrPlaceholder(
                  na?.foto_patok_1,
                  '[ Foto Patok 1 ]',
                  240,
                  220
                ),
              ],
            }),
            new TableCell({
              width: { size: rightHalfW, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                makePhotoOrPlaceholder(
                  na?.foto_patok_2,
                  '[ Foto Patok 2 ]',
                  240,
                  220
                ),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  // =========================================================================
  // HAL. 16 — GEOTAGGING PATOK 3–4 & PETA POLIGON
  // =========================================================================
  const hal16: Array<Paragraph | Table> = [
    fp('', { pageBreakBefore: true, spaceAfter: 0, line: 240 }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, rightHalfW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('3', { align: AlignmentType.CENTER, bold: true, spaceAfter: 40 })],
            }),
            new TableCell({
              width: { size: rightHalfW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('4', { align: AlignmentType.CENTER, bold: true, spaceAfter: 40 })],
            }),
          ],
        }),
        new TableRow({
          height: { value: 3600, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                makePhotoOrPlaceholder(
                  na?.foto_patok_3,
                  '[ Foto Patok 3 ]',
                  240,
                  220
                ),
              ],
            }),
            new TableCell({
              width: { size: rightHalfW, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                makePhotoOrPlaceholder(
                  na?.foto_patok_4,
                  '[ Foto Patok 4 ]',
                  240,
                  220
                ),
              ],
            }),
          ],
        }),
      ],
    }),
    fp('Poligon', { align: AlignmentType.CENTER, bold: true, spaceBefore: 160, spaceAfter: 80 }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [F4_CONTENT_WIDTH_DXA],
      layout: TableLayoutType.FIXED,
      borders: THIN_TABLE_BORDERS,
      rows: [
        new TableRow({
          height: { value: 5200, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                makePhotoOrPlaceholder(
                  na?.foto_poligon,
                  '[ Unggah Citra Satelit / Peta Poligon Bidang Tanah ]',
                  480,
                  320
                ),
              ],
            }),
          ],
        }),
      ],
    }),
    ...(na?.koordinat_poligon?.trim()
      ? [
          fp(`Koordinat Poligon: ${na.koordinat_poligon.trim()}`, {
            align: AlignmentType.CENTER,
            size: 18,
            spaceBefore: 80,
            spaceAfter: 20,
          }),
        ]
      : []),
  ];

  return [
    ...hal1,
    ...hal2,
    ...hal3,
    ...hal4,
    ...hal5,
    ...hal6,
    ...hal7,
    ...hal8,
    ...hal9,
    ...hal10,
    ...hal11,
    ...hal12,
    ...hal13,
    ...hal14,
    ...hal15,
    ...hal16,
  ];
}
