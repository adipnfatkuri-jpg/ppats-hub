import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {
  BerkasRecord,
  OfficeSettings,
  ParaPihak,
  PengesahanMode,
} from '../types/ppats';
import {
  formatNumberId,
  formatTanggalDDMMYYYY,
  formatTanggalLengkapHuruf,
  parseFlexibleDate,
  terbilangLuas,
} from './indonesianFormatter';
import {
  LAMPIRAN_MARGINS,
  PAPER_SIZE_F4_TWIPS,
  aktaCenteredDashHeading,
} from './docxTemplates';
import { resolveAnalisisBidangConfig } from './analisisBidangHelper';
import { formatPpatsTtl } from './ppatsProfileHelper';
import { buildWarisCBundle } from './warisCTemplates';
import { isBoundaryNonPerson } from './sketchRefiner';

const F4_FONT = 'Bookman Old Style';
const F4_SIZE = 22; // 11 pt
const F4_LINE = 276; // 1.15 spasi
const F4_LINE_AIRY = 300; // 1.25 spasi

// Lebar area konten kertas F4 (215 mm - margin kiri 2.6 cm - margin kanan 2.4 cm = 9310 twips)
const F4_CONTENT_WIDTH_DXA =
  PAPER_SIZE_F4_TWIPS.width - LAMPIRAN_MARGINS.left - LAMPIRAN_MARGINS.right;

// Jarak tanda tangan nyaman untuk menempelkan Meterai Rp 10.000 (± 2.3 cm) dan tanda tangan basah / stempel
const SIGNATURE_SPACE_METERAI = 1440; // ~2.54 cm
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
  top: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
  left: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
  right: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
};

const THIN_TABLE_BORDERS = {
  ...THIN_BORDER,
  insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
  insideVertical: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
};

function fp(
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
    border: opts?.borderBottom
      ? { bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' } }
      : undefined,
    children: [
      new TextRun({
        text,
        bold: opts?.bold ?? false,
        italics: opts?.italic ?? false,
        underline: opts?.underline ? {} : undefined,
        size: opts?.size ?? F4_SIZE,
        font: F4_FONT,
      }),
    ],
  });
}

function fpRuns(
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
          size: r.size ?? F4_SIZE,
          font: F4_FONT,
        })
    ),
  });
}

function kvTable(
  rows: Array<[string, string]>,
  opts?: { labelPct?: number; indentTwips?: number; spaceAfterRow?: number; line?: number }
): Table {
  const labelPct = opts?.labelPct ?? 26;
  const line = opts?.line ?? F4_LINE;
  const spaceAfterRow = opts?.spaceAfterRow ?? 0;
  const indentTwips = opts?.indentTwips ?? 0;
  const totalWidth = Math.max(4000, F4_CONTENT_WIDTH_DXA - indentTwips);
  const labelW = Math.round((totalWidth * labelPct) / 100);
  const valueW = totalWidth - labelW;

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: [labelW, valueW],
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
              margins: { top: 0, bottom: 0, left: 0, right: 60 },
              children: [fp(k, { spaceAfter: spaceAfterRow, line })],
            }),
            new TableCell({
              width: { size: valueW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              children: [fp(`: ${v}`, { spaceAfter: spaceAfterRow, line })],
            }),
          ],
        })
    ),
  });
}

function kvAlignedTable(
  rows: Array<{
    label: string;
    valueRuns?: Array<{ text: string; bold?: boolean; italic?: boolean; underline?: boolean }>;
    valueText?: string;
    boldValue?: boolean;
    noColon?: boolean;
  }>,
  opts?: { labelPct?: number; indentTwips?: number; spaceAfterRow?: number; line?: number }
): Table {
  const labelPct = opts?.labelPct ?? 26;
  const line = opts?.line ?? F4_LINE;
  const spaceAfterRow = opts?.spaceAfterRow ?? 20;
  const indentTwips = opts?.indentTwips ?? 0;
  const totalWidth = Math.max(4000, F4_CONTENT_WIDTH_DXA - indentTwips);
  const colonW = 240;
  const labelW = Math.round(((totalWidth - colonW) * labelPct) / 100);
  const valueW = totalWidth - colonW - labelW;

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: [labelW, colonW, valueW],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    indent: indentTwips ? { size: indentTwips, type: WidthType.DXA } : undefined,
    rows: rows.map(
      (row) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: labelW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 40 },
              children: [fp(row.label, { spaceAfter: spaceAfterRow, line })],
            }),
            new TableCell({
              width: { size: colonW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              children: [fp(row.noColon ? '' : ':', { spaceAfter: spaceAfterRow, line })],
            }),
            new TableCell({
              width: { size: valueW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              children: [
                row.valueRuns
                  ? fpRuns(row.valueRuns, { spaceAfter: spaceAfterRow, line })
                  : fp(row.valueText ?? '', {
                      bold: Boolean(row.boldValue),
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

function buildTwoColListTable(
  rows: Array<{
    leftText: string;
    rightText: string;
    leftBold?: boolean;
    rightBold?: boolean;
    leftUnderline?: boolean;
    rightUnderline?: boolean;
  }>,
  opts?: {
    leftPct?: number;
    indentTwips?: number;
    line?: number;
    spaceAfter?: number;
    hangingTwips?: number;
  }
): Table {
  const leftPct = opts?.leftPct ?? 50;
  const indentTwips = opts?.indentTwips ?? 0;
  const line = opts?.line ?? F4_LINE; // 1.15 spasi
  const spaceAfter = opts?.spaceAfter ?? 20;
  const hangingTwips = opts?.hangingTwips ?? 340;
  const totalWidth = Math.max(4000, F4_CONTENT_WIDTH_DXA - indentTwips);
  const leftW = Math.round((totalWidth * leftPct) / 100);
  const rightW = totalWidth - leftW;

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: [leftW, rightW],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    indent: indentTwips ? { size: indentTwips, type: WidthType.DXA } : undefined,
    rows: rows.map(
      (item) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: leftW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 10, bottom: 10, left: 0, right: 160 },
              children: [
                fp(item.leftText, {
                  bold: item.leftBold,
                  underline: item.leftUnderline,
                  spaceAfter,
                  line,
                  indentLeft: item.leftText ? hangingTwips : 0,
                  hanging: item.leftText ? hangingTwips : 0,
                }),
              ],
            }),
            new TableCell({
              width: { size: rightW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 10, bottom: 10, left: 100, right: 0 },
              children: [
                fp(item.rightText, {
                  bold: item.rightBold,
                  underline: item.rightUnderline,
                  spaceAfter,
                  line,
                  indentLeft: item.rightText ? hangingTwips : 0,
                  hanging: item.rightText ? hangingTwips : 0,
                }),
              ],
            }),
          ],
        })
    ),
  });
}

export interface ResolvedPengesahanTunggal {
  mode: PengesahanMode;
  jabatanLines: string[];
  nama: string;
  nip: string;
}

export interface ResolvedPengesahanGanda {
  camatJabatan: string;
  camatNama: string;
  camatNip: string;
  camatNomor: string;
  kadesJabatan: string;
  kadesNama: string;
  kadesNomor: string;
}

export function resolvePengesahanTunggal(
  record: BerkasRecord,
  settings: OfficeSettings
): ResolvedPengesahanTunggal {
  const na = record.non_akta;
  const mode: PengesahanMode = na?.pengesahan_mode ?? 'ppats';
  const kecTanah = (record.tanah.kecamatan || settings.nama_kecamatan || '')
    .replace(/^Kecamatan\s+/i, '')
    .trim();
  const desaTanah = (record.tanah.desa || '-').trim();

  if (mode === 'kades') {
    const jab = na?.pengesahan_jabatan?.trim() || `Kepala Desa ${desaTanah}`;
    return {
      mode,
      jabatanLines: jab.split('\n').map((s) => s.trim()).filter(Boolean),
      nama: na?.pengesahan_nama?.trim() || na?.kades_pengesahan_nama?.trim() || '..............................',
      nip: na?.pengesahan_nip?.trim() || '',
    };
  }

  if (mode === 'camat') {
    const jab = na?.pengesahan_jabatan?.trim() || `Camat ${kecTanah || '-'}`;
    return {
      mode,
      jabatanLines: jab.split('\n').map((s) => s.trim()).filter(Boolean),
      nama: na?.pengesahan_nama?.trim() || record.akta.nama_ppats || settings.nama_ppats || '-',
      nip: na?.pengesahan_nip?.trim() || record.akta.nip_ppats || settings.nip_ppats || '',
    };
  }

  if (mode === 'manual') {
    const jab = na?.pengesahan_jabatan?.trim() || 'Pejabat Yang Berwenang';
    return {
      mode,
      jabatanLines: jab.split('\n').map((s) => s.trim()).filter(Boolean),
      nama: na?.pengesahan_nama?.trim() || '..............................',
      nip: na?.pengesahan_nip?.trim() || '',
    };
  }

  // Default: PPATS
  const defaultJabatan =
    na?.pengesahan_jabatan?.trim() ||
    `PPATS / Camat ${kecTanah || settings.nama_kecamatan.replace(/^Kecamatan\s+/i, '')}`;
  return {
    mode: 'ppats',
    jabatanLines: defaultJabatan.split('\n').map((s) => s.trim()).filter(Boolean),
    nama: na?.pengesahan_nama?.trim() || record.akta.nama_ppats || settings.nama_ppats || '-',
    nip:
      na?.pengesahan_nip !== undefined
        ? na.pengesahan_nip.trim()
        : record.akta.nip_ppats || settings.nip_ppats || '',
  };
}

export function resolvePengesahanGanda(
  record: BerkasRecord,
  settings: OfficeSettings
): ResolvedPengesahanGanda {
  const na = record.non_akta;
  const kecTanah = (record.tanah.kecamatan || settings.nama_kecamatan || '')
    .replace(/^Kecamatan\s+/i, '')
    .trim();
  const desaTanah = (record.tanah.desa || '-').trim();

  return {
    camatJabatan:
      na?.camat_pengesahan_jabatan?.trim() || `Camat ${kecTanah || '-'}`,
    camatNama:
      na?.camat_pengesahan_nama?.trim() ||
      record.akta.nama_ppats ||
      settings.nama_ppats ||
      '-',
    camatNip:
      na?.camat_pengesahan_nip?.trim() ||
      record.akta.nip_ppats ||
      settings.nip_ppats ||
      '-',
    camatNomor: na?.camat_pengesahan_nomor?.trim() || '..............................',
    kadesJabatan:
      na?.kades_pengesahan_jabatan?.trim() || `Kepala Desa ${desaTanah}`,
    kadesNama: na?.kades_pengesahan_nama?.trim() || '..............................',
    kadesNomor: na?.kades_pengesahan_nomor?.trim() || '..............................',
  };
}

interface NonAktaPartyView {
  no: number;
  nama: string;
  ttl: string;
  pekerjaan: string;
  nik: string;
  alamatLengkap: string;
  alamatSingkat: string;
}

function formatPartyAddress(p: ParaPihak, shortMode: boolean): string {
  const rtRw = (p.rt_rw || '').split('/').map((x) => x.trim());
  const rt = rtRw[0] || '-';
  const rw = rtRw[1] || '-';
  if (shortMode) {
    const dukuh = [p.alamat_jalan, p.rt_rw ? `Rt.${rt}/${rw}` : ''].filter(Boolean).join(' ');
    const desa = p.desa_kelurahan ? `Ds. ${p.desa_kelurahan}` : '';
    const kec = p.kecamatan ? p.kecamatan.replace(/^Kecamatan\s+/i, '') : '';
    const kab = p.kabupaten ? p.kabupaten.replace(/^Kabupaten\s+/i, '') : '';
    return [dukuh, desa, kec, kab].filter(Boolean).join(', ') || '-';
  }
  const parts = [
    p.alamat_jalan,
    p.rt_rw ? `Rukun Tetangga (RT) ${rt} Rukun Warga (RW) ${rw}` : '',
    p.desa_kelurahan ? `Desa ${p.desa_kelurahan}` : '',
    p.kecamatan ? `Kecamatan ${p.kecamatan}` : '',
    p.kabupaten,
  ].filter(Boolean);
  return parts.join(', ') || '-';
}

function collectNonAktaParties(record: BerkasRecord): NonAktaPartyView[] {
  const list = record.para_pihak.filter((p) => p.peran !== 'Persetujuan Pasangan');
  const source = list.length > 0 ? list : record.para_pihak;
  if (source.length === 0) {
    return [
      {
        no: 1,
        nama: '-',
        ttl: '-',
        pekerjaan: '-',
        nik: '-',
        alamatLengkap: '-',
        alamatSingkat: '-',
      },
    ];
  }
  return source.map((p, idx) => {
    const tgl = formatTanggalDDMMYYYY(p.tanggal_lahir);
    const ttl = [p.tempat_lahir, tgl !== '-' ? tgl : p.tanggal_lahir]
      .filter(Boolean)
      .join(', ') || '-';
    return {
      no: idx + 1,
      nama: p.nama || '-',
      ttl,
      pekerjaan: p.pekerjaan || '-',
      nik: p.nik || '-',
      alamatLengkap: formatPartyAddress(p, false),
      alamatSingkat: formatPartyAddress(p, true),
    };
  });
}

function resolvePersonCtx(
  name: string,
  list?: OfficeSettings['profil_saksi'],
  override?: BerkasRecord['akta']['saksi_1_detail']
) {
  const fromList = (list ?? []).find(
    (item) => item.nama.trim().toLowerCase() === name.trim().toLowerCase()
  );
  const merged = fromList || override ? { ...(fromList ?? { nama: name }), ...(override ?? {}) } : undefined;
  const nama = merged?.nama?.trim() || name || '-';
  const ttl =
    [merged?.tempat_lahir, formatTanggalDDMMYYYY(merged?.tanggal_lahir)]
      .filter((x) => x && x !== '-')
      .join(', ') || '-';
  const rtRw =
    merged?.rt || merged?.rw ? `Rt.${merged?.rt || '-'}/${merged?.rw || '-'}` : '';
  const alamatSingkat =
    [
      [merged?.alamat_jalan, rtRw].filter(Boolean).join(' '),
      merged?.desa_kelurahan ? `Ds. ${merged.desa_kelurahan}` : '',
      merged?.kecamatan ? merged.kecamatan.replace(/^Kecamatan\s+/i, '') : '',
      merged?.kabupaten ? merged.kabupaten.replace(/^Kabupaten\s+/i, '') : '',
    ]
      .filter(Boolean)
      .join(', ') ||
    merged?.alamat ||
    '-';

  return {
    nama,
    ttl,
    pekerjaan: merged?.pekerjaan || '-',
    nik: merged?.nik || '-',
    jenisKelamin: merged?.jenis_kelamin || 'Laki - Laki',
    alamat: merged?.alamat || alamatSingkat,
    alamatSingkat,
  };
}

function buildSaksiBlocks(
  saksi1Name: string,
  saksi2Name: string,
  spaceBefore = 220
): Array<Paragraph | Table> {
  const leftW = 4400;
  const rightW = 2600;
  return [
    fp('Saksi – saksi :', { spaceBefore, spaceAfter: 160, line: F4_LINE }),
    new Table({
      width: { size: leftW + rightW, type: WidthType.DXA },
      columnWidths: [leftW, rightW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: leftW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp(`1. ${saksi1Name}`, { spaceAfter: 360, line: F4_LINE })],
            }),
            new TableCell({
              width: { size: rightW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('(                    )', { spaceAfter: 360, line: F4_LINE })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: leftW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp(`2. ${saksi2Name}`, { spaceAfter: 80, line: F4_LINE })],
            }),
            new TableCell({
              width: { size: rightW, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('(                    )', { spaceAfter: 80, line: F4_LINE })],
            }),
          ],
        }),
      ],
    }),
  ];
}

function buildSinglePengesahanCentered(pengesahan: ResolvedPengesahanTunggal, spaceBefore = 180): Paragraph[] {
  const out: Paragraph[] = [
    fp('Mengetahui,', { align: AlignmentType.CENTER, spaceBefore, spaceAfter: 0, line: F4_LINE }),
    ...pengesahan.jabatanLines.map((lineText, idx) =>
      fp(lineText, {
        align: AlignmentType.CENTER,
        spaceAfter: idx === pengesahan.jabatanLines.length - 1 ? SIGNATURE_SPACE_STANDARD : 0,
        line: F4_LINE,
      })
    ),
    fp(pengesahan.nama, {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 0,
      line: F4_LINE,
    }),
  ];
  if (pengesahan.nip && pengesahan.nip !== '-') {
    out.push(fp(`NIP. ${pengesahan.nip}`, { align: AlignmentType.CENTER, spaceAfter: 20, line: F4_LINE }));
  }
  return out;
}

function buildDualPengesahanTable(
  ganda: ResolvedPengesahanGanda,
  kotaTanggalLine: string,
  opts?: { withNumbers?: boolean; mode?: 'skw' | 'beda_nama' }
): Table {
  const withNumbers = opts?.withNumbers ?? false;
  const camatHeader =
    opts?.mode === 'skw'
      ? 'Dikuatkan oleh kami :'
      : 'Dikuatkan oleh';
  const kadesHeader =
    opts?.mode === 'skw'
      ? 'Disaksikan dan dibenarkan oleh kami:'
      : 'Disaksikan dan Dibenarkan';
  const halfW = Math.floor(F4_CONTENT_WIDTH_DXA / 2);

  return new Table({
    width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [halfW, F4_CONTENT_WIDTH_DXA - halfW],
    layout: TableLayoutType.FIXED,
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: halfW, type: WidthType.DXA },
            borders: NO_BORDER,
            margins: { top: 0, bottom: 0, left: 0, right: 120 },
            children: [
              ...(withNumbers
                ? [fp(`Nomor : ${ganda.camatNomor}`, { spaceAfter: 20, line: F4_LINE })]
                : []),
              fp(' ', { align: AlignmentType.CENTER, spaceAfter: 0, line: F4_LINE }),
              fp(camatHeader, { align: AlignmentType.CENTER, spaceAfter: 0, line: F4_LINE }),
              fp(ganda.camatJabatan, {
                align: AlignmentType.CENTER,
                spaceAfter: SIGNATURE_SPACE_STANDARD,
                line: F4_LINE,
              }),
              fp(ganda.camatNama, {
                bold: true,
                underline: true,
                align: AlignmentType.CENTER,
                spaceAfter: 0,
                line: F4_LINE,
              }),
              ...(ganda.camatNip && ganda.camatNip !== '-'
                ? [
                    fp(`NIP. ${ganda.camatNip}`, {
                      align: AlignmentType.CENTER,
                      spaceAfter: 20,
                      line: F4_LINE,
                    }),
                  ]
                : []),
            ],
          }),
          new TableCell({
            width: { size: F4_CONTENT_WIDTH_DXA - halfW, type: WidthType.DXA },
            borders: NO_BORDER,
            margins: { top: 0, bottom: 0, left: 120, right: 0 },
            children: [
              ...(withNumbers
                ? [fp(`Nomor : ${ganda.kadesNomor}`, { spaceAfter: 20, line: F4_LINE })]
                : []),
              fp(kotaTanggalLine, { align: AlignmentType.CENTER, spaceAfter: 0, line: F4_LINE }),
              fp(kadesHeader, { align: AlignmentType.CENTER, spaceAfter: 0, line: F4_LINE }),
              fp(ganda.kadesJabatan, {
                align: AlignmentType.CENTER,
                spaceAfter: SIGNATURE_SPACE_STANDARD,
                line: F4_LINE,
              }),
              fp(ganda.kadesNama, {
                bold: true,
                underline: true,
                align: AlignmentType.CENTER,
                spaceAfter: 20,
                line: F4_LINE,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function buildNumberedPartiesKvBlocks(
  parties: NonAktaPartyView[],
  opts?: { shortAddress?: boolean; spaceAfterRow?: number }
): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  if (parties.length === 1) {
    const pt = parties[0];
    out.push(
      kvTable(
        [
          ['Nama', pt.nama],
          ['Tempat/Tgl.lahir', pt.ttl],
          ['Pekerjaan', pt.pekerjaan],
          ['Nomor KTP', pt.nik],
          ['Alamat', opts?.shortAddress ? pt.alamatSingkat : pt.alamatLengkap],
        ],
        { indentTwips: 420, labelPct: 26, spaceAfterRow: opts?.spaceAfterRow ?? 0, line: 250 }
      )
    );
    return out;
  }

  for (const pt of parties) {
    out.push(
      kvTable(
        [
          [`${pt.no}. Nama`, pt.nama],
          ['   Tempat/Tgl.lahir', pt.ttl],
          ['   Pekerjaan', pt.pekerjaan],
          ['   Nomor KTP', pt.nik],
          ['   Alamat', opts?.shortAddress ? pt.alamatSingkat : pt.alamatLengkap],
        ],
        { indentTwips: 240, labelPct: 28, spaceAfterRow: opts?.spaceAfterRow ?? 0, line: 245 }
      )
    );
    out.push(fp('', { spaceAfter: 20, line: 160 }));
  }
  return out;
}

function buildNumberedSignerLines(parties: NonAktaPartyView[], indentLeft = 0): Paragraph[] {
  if (parties.length === 1) {
    return [
      fp(parties[0].nama, {
        bold: true,
        underline: true,
        align: AlignmentType.CENTER,
        spaceAfter: 20,
        line: F4_LINE,
      }),
    ];
  }
  return parties.map((pt, idx) =>
    fp(`${pt.no}. ${pt.nama} (....................)`, {
      indentLeft,
      spaceAfter: idx === parties.length - 1 ? 80 : 420,
      line: F4_LINE,
    })
  );
}

function resolveNonAktaDocDate(record: BerkasRecord): {
  tanggalText: string;
  tanggalDash: string;
  hariTanggal: string;
} {
  const parsed = parseFlexibleDate(record.akta.tanggal_akta);
  if (!parsed) {
    return {
      tanggalText: '......................',
      tanggalDash: '',
      hariTanggal: '............ tanggal ......................',
    };
  }
  const fmt = formatTanggalLengkapHuruf(parsed.ddMmYyyy);
  return {
    tanggalText: fmt.tanggal_biasa,
    tanggalDash: fmt.tanggal_dash,
    hariTanggal: `${fmt.hari} tanggal ${fmt.tanggal_biasa}`,
  };
}

function getSertipikatInfo(record: BerkasRecord) {
  const t = record.tanah;
  const isDigital =
    t.jenis_sertipikat === 'digital' ||
    (!t.nomor_hak_lama?.trim() && !t.surat_ukur_nomor?.trim());
  const nibClean = t.nib?.trim() || '-';
  const noHakClean = (t.nomor_hak_lama || '-')
    .replace(/^(?:SHM|SHGB|SHP|HP|Sertipikat)\s*(?:No\.?|Nomor)\s*[:.]?\s*/i, '')
    .trim();
  const labelNo = isDigital ? 'Nibel' : 'Nomor Hak / NIB';
  const nilaiNo = isDigital ? nibClean : `${noHakClean} (NIB : ${nibClean})`;
  const ringkas = isDigital
    ? `Nibel : ${nibClean}`
    : `Nomor : ${noHakClean} (NIB : ${nibClean})`;
  const suTgl = t.surat_ukur_tanggal?.trim()
    ? /^\d{4}-\d{2}-\d{2}$/.test(t.surat_ukur_tanggal.trim())
      ? formatTanggalDDMMYYYY(t.surat_ukur_tanggal)
      : t.surat_ukur_tanggal.trim()
    : '-';
  const suInfo = isDigital
    ? ''
    : t.surat_ukur_nomor?.trim()
    ? ` Surat Ukur tanggal ${suTgl} Nomor ${t.surat_ukur_nomor}`
    : '';
  return {
    isDigital,
    jenisHak: t.jenis_hak || 'Hak Milik',
    nibClean,
    noHakClean,
    labelNo,
    nilaiNo,
    ringkas,
    suInfo,
    luasStr: formatNumberId(t.luas_m2),
    luasTerbilang: terbilangLuas(t.luas_m2),
    desa: t.desa || '-',
    kecamatan: t.kecamatan || '-',
    kabupaten: t.kabupaten || '-',
    provinsi: t.provinsi || 'Jawa Tengah',
    pemegangHak:
      t.pemegang_hak_sertipikat?.filter(Boolean).join(', ') ||
      record.non_akta?.nama_pewaris ||
      '-',
    penggunaan: t.penggunaan_tanah || 'Pekarangan',
    sejakTahun: t.menguasai_sejak_tahun || '2020',
  };
}

function buildPermohonanPage(params: {
  record: BerkasRecord;
  parties: NonAktaPartyView[];
  kuasa: ReturnType<typeof resolvePersonCtx>;
  item14Text: string;
  boldIndices: number[];
  lampiranItems: string[];
  kotaKabupaten: string;
  tanggalText: string;
  tanggalDash?: string;
  pageBreakBefore?: boolean;
}): Array<Paragraph | Table> {
  const sert = getSertipikatInfo(params.record);
  const qqSignatureLine =
    params.parties.length === 1
      ? `${params.kuasa.nama} QQ ${params.parties[0].nama}`
      : `${params.kuasa.nama} qq. ${params.parties.map((p) => `${p.no}. ${p.nama}`).join(', ')}`;

  const leftPermohonan: Array<[number, string]> = [
    [1, 'Pengukuran'],
    [2, 'Konversi / Pendaftaran Hak'],
    [3, 'Pendaftaran Hak Milik Sarusun'],
    [4, 'Pendaftaran Tanah Wakaf'],
    [5, 'Pendaftaran Peralihan Hak'],
    [6, 'Pendaftaran Pemindahan Hak'],
    [7, 'Pendaftaran Perubahan Hak'],
  ];
  const rightPermohonan: Array<[number, string]> = [
    [8, 'Pemecahan/Penggabungan Hak'],
    [9, 'Pendaftaran Hak Tanggungan'],
    [10, 'Roya atas Hak Tanggungan'],
    [11, 'Penerbitan Sertipikat Pengganti'],
    [12, 'Surat Keterangan Pendaftaran Tanah'],
    [13, 'Pengecekan Sertipikat'],
    [14, params.item14Text],
  ];

  const leftCount =
    params.lampiranItems.length <= 6
      ? Math.min(params.lampiranItems.length, 4)
      : Math.ceil(params.lampiranItems.length / 2);
  const lampLeft = params.lampiranItems.slice(0, leftCount);
  const lampRight = params.lampiranItems.slice(leftCount);

  return [
    fp('Kepada Yth.', {
      pageBreakBefore: params.pageBreakBefore ?? false,
      indentLeft: 4400,
      spaceAfter: 0,
      line: 245,
    }),
    fp('Kantor Kementerian Agraria dan Tata Ruang/', {
      indentLeft: 4400,
      spaceAfter: 0,
      line: 245,
    }),
    fp(`Badan Pertanahan Nasional ${sert.kabupaten}`, {
      indentLeft: 4400,
      spaceAfter: 0,
      line: 245,
    }),
    fp(`di ${params.kotaKabupaten}`, {
      indentLeft: 4400,
      spaceAfter: 160,
      line: 245,
    }),

    fp('Dengan Hormat,', { spaceAfter: 20, line: 245 }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 40, line: 245 }),
    kvTable(
      [
        ['Nama', params.kuasa.nama],
        ['Tempat/Tgl.lahir', params.kuasa.ttl],
        ['Pekerjaan', params.kuasa.pekerjaan],
        ['Nomor KTP', params.kuasa.nik],
        ['Alamat', params.kuasa.alamatSingkat],
      ],
      { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: 240 }
    ),

    fp('Dalam hal ini bertindak untuk dan atas nama diri sendiri / selaku kuasa dari :', {
      spaceBefore: 100,
      spaceAfter: 40,
      line: 245,
    }),
    ...buildNumberedPartiesKvBlocks(params.parties, { shortAddress: true, spaceAfterRow: 0 }),

    fp(
      `Berdasarkan surat kuasa   Nomor : ...................   Tanggal  :${params.tanggalDash ? ` ${params.tanggalDash}` : ''}`,
      {
        spaceBefore: 80,
        spaceAfter: 20,
        line: 245,
      }
    ),
    fp('Dengan ini mengajukan permohonan :', { spaceAfter: 40, line: F4_LINE }),

    buildTwoColListTable(
      leftPermohonan.map(([lNum, lText], idx) => {
        const [rNum, rText] = rightPermohonan[idx];
        return {
          leftText: `${lNum}. ${lText}`,
          rightText: `${rNum}. ${rText}`,
          leftBold: params.boldIndices.includes(lNum),
          rightBold: params.boldIndices.includes(rNum),
        };
      }),
      {
        leftPct: 48,
        indentTwips: 240,
        line: F4_LINE,
        spaceAfter: 20,
        hangingTwips: 340,
      }
    ),

    fp('Atas bidang tanah Hak / Tanah Negara :', {
      spaceBefore: 120,
      spaceAfter: 10,
      line: F4_LINE,
    }),
    fp('Terletak di', { indentLeft: 420, spaceAfter: 10, line: F4_LINE }),
    kvTable(
      [
        ['Desa', sert.desa],
        ['Kecamatan', sert.kecamatan],
        ['Kabupaten', params.kotaKabupaten],
        [
          sert.isDigital ? 'Nibel' : `Nomor ${sert.jenisHak} No.`,
          sert.isDigital ? sert.nibClean : sert.noHakClean,
        ],
      ],
      { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: F4_LINE }
    ),

    fp('Untuk melengkapi permohonan dimaksud, bersama ini kami lampirkan :', {
      spaceBefore: 120,
      spaceAfter: 40,
      line: F4_LINE,
    }),
    buildTwoColListTable(
      lampLeft.map((leftText, rowIdx) => {
        const rightText = lampRight[rowIdx];
        const rightNum = leftCount + rowIdx + 1;
        return {
          leftText: `${rowIdx + 1}. ${leftText}`,
          rightText: rightText ? `${rightNum}. ${rightText}` : '',
        };
      }),
      {
        leftPct: 51,
        indentTwips: 0,
        line: F4_LINE,
        spaceAfter: 20,
        hangingTwips: 340,
      }
    ),

    // Paragraf pemisah wajib agar Word tidak menggabungkan tabel Lampiran dan tabel Tanda Tangan
    fp('', { spaceBefore: 0, spaceAfter: 60, line: 120 }),

    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [
        params.parties.length >= 4 ? 3600 : 4190,
        F4_CONTENT_WIDTH_DXA - (params.parties.length >= 4 ? 3600 : 4190),
      ],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: params.parties.length >= 4 ? 3600 : 4190, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('', { spaceAfter: 0 })],
            }),
            new TableCell({
              width: {
                size: F4_CONTENT_WIDTH_DXA - (params.parties.length >= 4 ? 3600 : 4190),
                type: WidthType.DXA,
              },
              borders: NO_BORDER,
              children: [
                fp('Hormat Kami,', {
                  align: AlignmentType.CENTER,
                  spaceBefore: 120,
                  spaceAfter: SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                fp(qqSignatureLine, {
                  bold: true,
                  underline: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 20,
                  line: F4_LINE,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
}

function buildSuratKuasaNonAkta(params: {
  record: BerkasRecord;
  parties: NonAktaPartyView[];
  kuasa: ReturnType<typeof resolvePersonCtx>;
  pengesahan: ResolvedPengesahanTunggal;
  kotaKabupaten: string;
  tanggalText: string;
  khususBullets: string[];
  objekPrefix: string;
}): Array<Paragraph | Table> {
  const sert = getSertipikatInfo(params.record);
  const leftW = 4100;
  const rightW = F4_CONTENT_WIDTH_DXA - leftW;
  return [
    fp('SURAT KUASA', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 160,
      line: F4_LINE,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 40, line: F4_LINE }),
    ...buildNumberedPartiesKvBlocks(params.parties, { spaceAfterRow: 0 }),
    fp(`${params.objekPrefix} ${sert.jenisHak} :`, { spaceBefore: 100, spaceAfter: 40, line: F4_LINE }),
    kvTable(
      [
        [sert.labelNo, sert.nilaiNo],
        ['Desa', sert.desa],
        ['Kecamatan', sert.kecamatan],
        ['Kabupaten', sert.kabupaten],
        ['Pemegang Hak Tercatat', sert.pemegangHak],
      ],
      { indentTwips: 540, labelPct: 28, spaceAfterRow: 0, line: F4_LINE }
    ),
    fp('Maka dengan ini memberi kuasa kepada :', { spaceBefore: 100, spaceAfter: 40, line: F4_LINE }),
    kvTable(
      [
        ['Nama', params.kuasa.nama],
        ['Tempat/Tgl.lahir', params.kuasa.ttl],
        ['Pekerjaan', params.kuasa.pekerjaan],
        ['Nomor KTP', params.kuasa.nik],
        ['Alamat', params.kuasa.alamatSingkat],
      ],
      { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: F4_LINE }
    ),
    aktaCenteredDashHeading('KHUSUS', {
      bold: true,
      underline: true,
      size: F4_SIZE,
      font: F4_FONT,
      spaceBefore: 120,
      spaceAfter: 80,
      line: F4_LINE,
      contentWidthDxa: F4_CONTENT_WIDTH_DXA,
    }),
    ...params.khususBullets.map((b) =>
      fp(`-  ${b}`, {
        align: AlignmentType.JUSTIFIED,
        indentLeft: 320,
        hanging: 220,
        spaceAfter: 40,
        line: F4_LINE,
      })
    ),
    fp('Demikian kuasa ini diberikan untuk dapat dipergunakan sebagaimana mestinya.', {
      spaceBefore: 60,
      spaceAfter: 160,
      line: F4_LINE,
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
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: [
                fp(' ', { align: AlignmentType.CENTER, spaceAfter: 0, line: F4_LINE }),
                fp('Penerima Kuasa', {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                fp(params.kuasa.nama, {
                  bold: true,
                  underline: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 20,
                  line: F4_LINE,
                }),
              ],
            }),
            new TableCell({
              width: { size: rightW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp(`${params.kotaKabupaten}, ${params.tanggalText}`, {
                  align: AlignmentType.CENTER,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp(params.parties.length > 1 ? 'Para Pemberi Kuasa' : 'Pemberi Kuasa', {
                  align: AlignmentType.CENTER,
                  spaceAfter: params.parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                ...buildNumberedSignerLines(params.parties, 260),
              ],
            }),
          ],
        }),
      ],
    }),
    ...buildSinglePengesahanCentered(params.pengesahan, 180),
  ];
}

function buildPenguasaanFisikNonAkta(params: {
  record: BerkasRecord;
  parties: NonAktaPartyView[];
  saksi1: ReturnType<typeof resolvePersonCtx>;
  saksi2: ReturnType<typeof resolvePersonCtx>;
  pengesahan: ResolvedPengesahanTunggal;
  hariTanggal: string;
  butir1Text: string;
  catatanAlias?: string;
}): Array<Paragraph | Table> {
  const sert = getSertipikatInfo(params.record);
  const sayaAtauKami = params.parties.length > 1 ? 'kami' : 'saya';
  const halfW = Math.floor(F4_CONTENT_WIDTH_DXA / 2);
  return [
    fp('SURAT PERNYATAAN PENGUASAAN FISIK TANAH DAN TIDAK SENGKETA', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 160,
      line: F4_LINE,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 40, line: F4_LINE }),
    ...buildNumberedPartiesKvBlocks(params.parties, { spaceAfterRow: 0 }),
    fp('Dengan disaksikan oleh :', { spaceBefore: 80, spaceAfter: 40, line: F4_LINE }),
    kvTable(
      [
        ['1. Nama', params.saksi1.nama],
        ['   Tempat/Tgl.lahir', params.saksi1.ttl],
        ['   Pekerjaan', params.saksi1.pekerjaan],
        ['   Nomor KTP', params.saksi1.nik],
        ['   Alamat', params.saksi1.alamat],
      ],
      { indentTwips: 240, labelPct: 27, spaceAfterRow: 0, line: F4_LINE }
    ),
    fp('', { spaceAfter: 20, line: 150 }),
    kvTable(
      [
        ['2. Nama', params.saksi2.nama],
        ['   Tempat/Tgl.lahir', params.saksi2.ttl],
        ['   Pekerjaan', params.saksi2.pekerjaan],
        ['   Nomor KTP', params.saksi2.nik],
        ['   Alamat', params.saksi2.alamat],
      ],
      { indentTwips: 240, labelPct: 27, spaceAfterRow: 0, line: F4_LINE }
    ),
    fp(`Pada hari ini ${params.hariTanggal} dengan ini menyatakan :`, {
      spaceBefore: 100,
      spaceAfter: 50,
      line: F4_LINE,
    }),
    fp(`1. ${params.butir1Text}`, {
      align: AlignmentType.JUSTIFIED,
      indentLeft: 320,
      hanging: 320,
      spaceAfter: 40,
      line: F4_LINE,
    }),
    fp(
      `2. Bahwa ${sayaAtauKami} benar-benar menguasai tanah secara fisik sejak tahun ${sert.sejakTahun} sampai sekarang dan dipergunakan untuk ${sert.penggunaan}.${params.catatanAlias ? ` (${params.catatanAlias})` : ''}`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: F4_LINE }
    ),
    fp(
      '3. Bahwa tanah tersebut tidak dalam keadaan sengketa, konflik, perkara, sita jaminan atau pemblokiran dari pihak lain.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 60, line: F4_LINE }
    ),
    fp(
      `Demikian surat pernyataan ini ${sayaAtauKami} buat dengan sebenarnya dan ${sayaAtauKami} bertanggung jawab sepenuhnya atas pernyataan ini. Apabila dikemudian hari terjadi perkara perdata maupun pidana atas tanah ini, maka perkara tersebut merupakan tanggung jawab pribadi ${sayaAtauKami} dengan tidak melibatkan Pejabat/Kantor Badan Pertanahan Nasional ${sert.kabupaten}.`,
      { align: AlignmentType.JUSTIFIED, spaceAfter: 140, line: F4_LINE }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, F4_CONTENT_WIDTH_DXA - halfW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: [
                fp('Saksi – saksi :', { spaceAfter: 160, line: F4_LINE }),
                fp(`1. ${params.saksi1.nama} (...............)`, { spaceAfter: 420, line: F4_LINE }),
                fp(`2. ${params.saksi2.nama} (...............)`, { spaceAfter: 40, line: F4_LINE }),
              ],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp('Yang membuat pernyataan', {
                  align: AlignmentType.CENTER,
                  spaceAfter: params.parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                ...buildNumberedSignerLines(params.parties, 220),
              ],
            }),
          ],
        }),
      ],
    }),
    ...buildSinglePengesahanCentered(params.pengesahan, 140),
  ];
}

function buildDataPribadiPage(params: {
  parties: NonAktaPartyView[];
  kotaKabupaten: string;
  tanggalText: string;
}): Array<Paragraph | Table> {
  return [
    fp('SURAT PERNYATAAN PERSETUJUAN PEMROSESAN DATA PRIBADI', {
      pageBreakBefore: true,
      bold: true,
      align: AlignmentType.CENTER,
      spaceAfter: 160,
      line: 270,
    }),
    fp(
      'Saya, yang bertandatangan di bawah ini, selaku pengguna layanan Pertanahan Kementerian Agraria dan Tata Ruang/Badan Pertanahan Nasional (“Kementerian ATR/BPN”), dengan ini menyatakan sebagai berikut:',
      { align: AlignmentType.JUSTIFIED, spaceAfter: 80, line: F4_LINE_AIRY }
    ),
    fpRuns(
      [
        { text: '1. ', bold: true, italic: true },
        { text: 'Bahwa saya bertindak dalam kapasitas sebagai ' },
        {
          text: 'Diri sendiri (perorangan), saya menyatakan memiliki kewenangan hukum yang sah dan bertanggung jawab sepenuhnya atas kewenangan tersebut, serta membebaskan Kementerian ATR/BPN dari segala tuntutan atau klaim apabila di kemudian hari kewenangan tersebut terbukti tidak sah.',
          italic: true,
        },
        {
          text: ' Dengan ini saya memberikan persetujuan kepada Kementerian ATR/BPN selaku Pengendali Data Pribadi untuk melakukan pemrosesan Data Pribadi saya dan/atau pihak yang saya wakili sesuai ketentuan peraturan perundang-undangan.',
        },
      ],
      { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 80, line: F4_LINE_AIRY }
    ),
    fp(
      '2. Saya telah menerima dan memahami informasi yang diberikan oleh Kementerian ATR/BPN sehubungan dengan tujuan pemrosesan Data Pribadi dilakukan untuk proses administrasi layanan pertanahan dan pertukaran data dengan Kementerian/Lembaga lainnya.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 80, line: F4_LINE_AIRY }
    ),
    fp(
      '3. Saya memahami hak saya sebagai subjek data pribadi untuk menyampaikan permintaan penundaan, pembatasan, pengakhiran, penarikan persetujuan, penghapusan, maupun pembaruan data pribadi sesuai peraturan yang berlaku.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 80, line: F4_LINE_AIRY }
    ),
    fp(
      '4. Saya memahami dan menyetujui bahwa Kementerian ATR/BPN akan mempergunakan dan menyimpan Data Pribadi sesuai ketentuan peraturan perundang-undangan atau selama diperlukan.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 80, line: F4_LINE_AIRY }
    ),
    fp(
      '5. Saya memahami dan setuju bahwa Kementerian ATR/BPN dapat mengungkapkan data pribadi kepada aparat penegak hukum maupun instansi pemerintah/mitra resmi terkait layanan pertanahan melalui sistem elektronik yang terintegrasi.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 80, line: F4_LINE_AIRY }
    ),
    fp(
      '6. Saya memahami bahwa kesalahan terhadap penyalahgunaan data pribadi oleh pihak ketiga sepenuhnya menjadi tanggung jawab pihak ketiga dan bukan menjadi kesalahan Kementerian ATR/BPN.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 80, line: F4_LINE_AIRY }
    ),
    fp(
      '7. Saya memahami dan menyetujui bahwa saya berkewajiban untuk memastikan Data Pribadi yang saya ungkapkan kepada Kementerian ATR/BPN adalah lengkap, akurat, benar dan terkini. Demikian persetujuan ini dibuat dengan sebenar-benarnya tanpa paksaan dari pihak manapun.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 360, hanging: 360, spaceAfter: 200, line: F4_LINE_AIRY }
    ),
    fp(`${params.kotaKabupaten}, ${params.tanggalText}`, {
      indentLeft: 4600,
      spaceAfter: 0,
      line: F4_LINE,
    }),
    fp('Yang Membuat Pernyataan,', {
      indentLeft: 4600,
      spaceAfter: params.parties.length === 1 ? SIGNATURE_SPACE_METERAI : 260,
      line: F4_LINE,
    }),
    ...params.parties.map((pt, idx) =>
      fp(`${pt.no}. ${pt.nama} ..........................`, {
        indentLeft: 4200,
        spaceAfter: idx === params.parties.length - 1 ? 120 : 440,
        line: F4_LINE,
      })
    ),
  ];
}

function buildBedaNamaPage(params: {
  record: BerkasRecord;
  parties: NonAktaPartyView[];
  saksi1: ReturnType<typeof resolvePersonCtx>;
  saksi2: ReturnType<typeof resolvePersonCtx>;
  ganda: ResolvedPengesahanGanda;
  kotaKabupaten: string;
  tanggalText: string;
}): Array<Paragraph | Table> {
  const sert = getSertipikatInfo(params.record);
  const na = params.record.non_akta;
  const namaSertipikat =
    na?.nama_di_sertipikat?.trim() ||
    sert.pemegangHak ||
    params.parties[0]?.nama ||
    '-';
  const namaKtpKk =
    na?.nama_di_ktp_kk?.trim() || params.parties[0]?.nama || '-';
  const nomorKk = na?.nomor_kk?.trim() || '-';
  const dokLain = na?.jenis_dokumen_lain?.trim() || 'Kutipan Akta Nikah / Dokumen Pendukung';
  const namaDokLain = na?.nama_di_dokumen_lain?.trim() || namaSertipikat;
  const keperluan = na?.keperluan_ralat?.trim() || 'Ralat Data / Penyesuaian Data Sertipikat';
  const pemohon = params.parties[0];

  return [
    fp('SURAT PERNYATAAN BEDA NAMA', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 200,
      line: 260,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 60, line: 250 }),
    kvTable(
      [
        ['Nama', pemohon.nama],
        ['Tempat/Tgl. Lahir', pemohon.ttl],
        ['Pekerjaan', pemohon.pekerjaan],
        ['Nomor KTP', pemohon.nik],
        ['Nomor KK', nomorKk],
        ['Alamat', pemohon.alamatLengkap],
      ],
      { indentTwips: 420, labelPct: 28, spaceAfterRow: 0, line: 250 }
    ),
    fp('Dengan ini menerangkan bahwa :', { spaceBefore: 140, spaceAfter: 60, line: 250 }),
    fp(
      `1. Nama yang tercantum dalam Sertipikat ${sert.jenisHak} ${sert.ringkas} Desa ${sert.desa}, Kecamatan ${sert.kecamatan}, ${sert.kabupaten} tertulis : ${namaSertipikat}`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: 260 }
    ),
    fp(
      `2. Nama yang tercantum dalam KTP dan Kartu Keluarga (No. ${nomorKk}) tertulis : ${namaKtpKk}`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: 260 }
    ),
    fp(
      `3. Nama yang tercantum dalam ${dokLain} tertulis : ${namaDokLain}`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 80, line: 260 }
    ),
    fp(
      `Bahwa nama-nama tersebut diatas adalah benar-benar SATU ORANG YANG SAMA. Adapun untuk selanjutnya, penulisan nama baku yang benar dan berlaku sah adalah ${namaKtpKk} sesuai KTP dan Kartu Keluarga yang berlaku, guna keperluan ${keperluan}.`,
      { align: AlignmentType.JUSTIFIED, spaceAfter: 80, line: 260 }
    ),
    fp(
      'Demikian Surat Pernyataan Beda Nama ini dibuat dengan sebenarnya dan apabila dikemudian hari terdapat permasalahan hukum menjadi tanggung jawab pribadi yang menyatakan sepenuhnya.',
      { align: AlignmentType.JUSTIFIED, spaceAfter: 160, line: 260 }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4840, F4_CONTENT_WIDTH_DXA - 4840],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4840, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: [
                fp('Saksi – saksi :', { spaceAfter: 160, line: F4_LINE }),
                fp(`1. ${params.saksi1.nama} (...............)`, { spaceAfter: 420, line: F4_LINE }),
                fp(`2. ${params.saksi2.nama} (...............)`, { spaceAfter: 20, line: F4_LINE }),
              ],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4840, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp(`${params.kotaKabupaten}, ${params.tanggalText}`, {
                  align: AlignmentType.CENTER,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp('Yang membuat pernyataan', {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                fp(pemohon.nama, {
                  bold: true,
                  underline: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 20,
                  line: F4_LINE,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    fp('', { spaceAfter: 80, line: 160 }),
    buildDualPengesahanTable(
      params.ganda,
      `${sert.desa}, Tanggal ${params.tanggalText}`,
      { withNumbers: true, mode: 'beda_nama' }
    ),
  ];
}

function buildTurunWarisBundle(
  record: BerkasRecord,
  settings: OfficeSettings
): Array<Paragraph | Table> {
  const parties = collectNonAktaParties(record);
  const sert = getSertipikatInfo(record);
  const na = record.non_akta;
  const pengesahanTunggal = resolvePengesahanTunggal(record, settings);
  const ganda = resolvePengesahanGanda(record, settings);

  const saksi1 = resolvePersonCtx(record.akta.saksi_1, settings.profil_saksi, record.akta.saksi_1_detail);
  const saksi2 = resolvePersonCtx(record.akta.saksi_2, settings.profil_saksi, record.akta.saksi_2_detail);
  const kuasa = resolvePersonCtx(
    record.akta.nama_kuasa_bpn,
    settings.profil_kuasa,
    record.akta.kuasa_bpn_detail
  );

  const docDate = resolveNonAktaDocDate(record);
  const kotaKabupaten =
    (record.tanah.kabupaten || settings.nama_kabupaten || '')
      .replace(/^(Kabupaten|Kota)\s+/i, '')
      .trim() || '-';

  const sebutanPewaris = na?.sebutan_pewaris || 'Almarhum';
  const namaPewaris =
    na?.nama_pewaris?.trim() || sert.pemegangHak || '..............................';
  const parsedMeninggal = parseFlexibleDate(na?.tanggal_meninggal);
  const tglMeninggal = parsedMeninggal
    ? formatTanggalLengkapHuruf(parsedMeninggal.ddMmYyyy).tanggal_biasa
    : na?.tanggal_meninggal?.trim() || '..............................';
  const tempatMeninggal =
    na?.tempat_meninggal?.trim() || `Desa ${sert.desa}, Kecamatan ${sert.kecamatan}`;
  const namaPasangan = na?.nama_pasangan_pewaris?.trim();
  const hubPasangan = na?.hubungan_pasangan_pewaris || 'Istrinya';
  const tglLahirPasangan = na?.tgl_lahir_pasangan_pewaris?.trim()
    ? formatTanggalDDMMYYYY(na.tgl_lahir_pasangan_pewaris)
    : '-';
  const jumlahAnak = na?.jumlah_anak_waris ?? parties.length;
  const nopClean = record.pbb.nop?.trim() || '-';

  const ahliWarisListRows = parties.map((pt, idx) =>
    fp(`${idx + 1}. ${pt.nama} (${pt.ttl}) — NIK: ${pt.nik}`, {
      indentLeft: 420,
      spaceAfter: 20,
      line: 250,
    })
  );

  return [
    // HALAMAN 1: SURAT KETERANGAN WARISAN (SKW) — PENGESAHAN GANDA CAMAT & KADES ASAL SERTIPIKAT
    fp('SURAT KETERANGAN WARISAN', {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 200,
      line: 260,
    }),
    fp(
      `Kami yang bertanda tangan dibawah ini, para ahli waris dari ${sebutanPewaris} ${namaPewaris}, menerangkan dengan sebenarnya dan sanggup diangkat sumpah bahwa ${sebutanPewaris} ${namaPewaris} telah meninggal dunia di ${tempatMeninggal} pada tanggal ${tglMeninggal}.`,
      { align: AlignmentType.JUSTIFIED, firstLine: 560, spaceAfter: 80, line: F4_LINE_AIRY }
    ),
    ...(namaPasangan
      ? [
          fp(
            `Semasa hidupnya almarhum/almarhumah menikah sah dengan ${hubPasangan} bernama ${namaPasangan} (lahir tanggal ${tglLahirPasangan}) dan dikaruniai ${jumlahAnak} orang anak / ahli waris yaitu :`,
            { align: AlignmentType.JUSTIFIED, firstLine: 560, spaceAfter: 60, line: F4_LINE_AIRY }
          ),
        ]
      : [
          fp(
            `Adapun para ahli waris yang sah menurut hukum dari ${sebutanPewaris} ${namaPewaris} berjumlah ${jumlahAnak} orang yaitu :`,
            { align: AlignmentType.JUSTIFIED, firstLine: 560, spaceAfter: 60, line: F4_LINE_AIRY }
          ),
        ]),
    ...ahliWarisListRows,
    ...(na?.catatan_skw?.trim()
      ? [
          fp(na.catatan_skw.trim(), {
            align: AlignmentType.JUSTIFIED,
            spaceBefore: 60,
            spaceAfter: 60,
            line: F4_LINE_AIRY,
          }),
        ]
      : []),
    fp(
      `Dengan demikian maka kami tersebut diatas adalah sebagai satu-satunya ahli waris yang sah dari ${sebutanPewaris} ${namaPewaris}, termasuk atas sebidang tanah ${sert.jenisHak} ${sert.ringkas} luas ${sert.luasStr} M² terletak di Desa ${sert.desa}, Kecamatan ${sert.kecamatan}, ${sert.kabupaten}.`,
      { align: AlignmentType.JUSTIFIED, spaceBefore: 60, spaceAfter: 100, line: F4_LINE_AIRY }
    ),
    fp('Demikian Surat Keterangan Warisan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.', {
      align: AlignmentType.JUSTIFIED,
      spaceAfter: 140,
      line: F4_LINE_AIRY,
    }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4280, F4_CONTENT_WIDTH_DXA - 4280],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4280, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: [
                fp('Saksi – saksi :', { spaceAfter: 160, line: F4_LINE }),
                fp(`1. ${saksi1.nama} (...............)`, { spaceAfter: 420, line: F4_LINE }),
                fp(`2. ${saksi2.nama} (...............)`, { spaceAfter: 20, line: F4_LINE }),
              ],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4280, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp('Para Ahli Waris :', { spaceAfter: 160, line: F4_LINE }),
                ...parties.map((pt, idx) =>
                  fp(`${pt.no}. ${pt.nama} (....................)`, {
                    spaceAfter: idx === parties.length - 1 ? 60 : 380,
                    line: F4_LINE,
                  })
                ),
              ],
            }),
          ],
        }),
      ],
    }),
    fp('', { spaceAfter: 100, line: 160 }),
    buildDualPengesahanTable(ganda, `${sert.desa}, Tanggal ${docDate.tanggalText}`, {
      withNumbers: true,
      mode: 'skw',
    }),

    // HALAMAN 2-3: PERMOHONAN PENDAFTARAN PERALIHAN HAK (TURUN WARIS)
    ...buildPermohonanPage({
      record,
      parties,
      kuasa,
      item14Text: 'Alih Media',
      boldIndices: [5],
      lampiranItems: [
        'Sertipikat asli',
        'Pengecekan Sertipikat',
        'Surat Kuasa',
        'Fotokopi KTP Penerima Kuasa',
        'Surat Keterangan Warisan',
        'Fotokopi Akta Kematian',
        'Fotokopi KTP, KK Ahli Waris',
        'Fotokopi KTP para saksi',
        'SSPD BPHTB',
        'Fotokopi SPPT PBB Terakhir',
        'Surat Pernyataan fisik tanah dan tidak sengketa',
      ],
      kotaKabupaten,
      tanggalText: docDate.tanggalText,
      tanggalDash: docDate.tanggalDash,
      pageBreakBefore: true,
    }),

    // HALAMAN 4-5: SURAT KUASA (PENGESAHAN TUNGGAL DEFAULT PPATS / PILIHAN)
    ...buildSuratKuasaNonAkta({
      record,
      parties,
      kuasa,
      pengesahan: pengesahanTunggal,
      kotaKabupaten,
      tanggalText: docDate.tanggalText,
      objekPrefix: 'Sehubungan dengan Turun Waris atas Sertipikat Tanah',
      khususBullets: [
        `Untuk dan atas nama Pemberi Kuasa mendaftarkan permohonan Peralihan Hak karena Warisan (Turun Waris) atas sertipikat tanah tersebut ke Kantor Pertanahan ${sert.kabupaten}.`,
        'Guna keperluan tersebut Penerima Kuasa berhak menghadap kepada pejabat Kantor Pertanahan yang berwenang, membayar biaya pendaftaran, menandatangani surat-surat yang diperlukan, serta mengambil sertipikat tanah setelah selesai.',
      ],
    }),

    // HALAMAN 6-7: SURAT PERNYATAAN PENGUASAAN FISIK TANAH DAN TIDAK SENGKETA
    ...buildPenguasaanFisikNonAkta({
      record,
      parties,
      saksi1,
      saksi2,
      pengesahan: pengesahanTunggal,
      hariTanggal: docDate.hariTanggal,
      butir1Text: `Bahwa kami adalah ahli waris yang sah dan pemilik sebidang tanah seluas ${sert.luasStr} M2 (${sert.luasTerbilang}) yang terletak di Desa ${sert.desa}, Kecamatan ${sert.kecamatan}, ${sert.kabupaten} yang sudah bersertipikat ${sert.jenisHak} ${sert.ringkas} Desa ${sert.desa}, tercatat atas nama ${sert.pemegangHak} dan merupakan produk Kantor Pertanahan ${sert.kabupaten}.`,
    }),

    // HALAMAN 8: SURAT PERNYATAAN SPPT / PBB WARIS
    fp('SURAT PERNYATAAN', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 180,
      line: 260,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 60, line: F4_LINE_AIRY }),
    ...buildNumberedPartiesKvBlocks(parties, { spaceAfterRow: 0 }),
    fp(
      `Dengan ini menyatakan dengan sebenarnya bahwa Surat Pemberitahuan Pajak Terhutang Pajak Bumi dan Bangunan (SPPT/PBB) Nomor Obyek Pajak (NOP) : ${nopClean}`,
      { align: AlignmentType.JUSTIFIED, spaceBefore: 120, spaceAfter: 40, line: F4_LINE_AIRY }
    ),
    fp(`Atas tanah warisan bersertipikat ${sert.jenisHak} :`, { spaceAfter: 60, line: F4_LINE_AIRY }),
    kvTable(
      [
        [sert.labelNo, sert.nilaiNo],
        ['Desa', sert.desa],
        ['Kecamatan', sert.kecamatan],
        ['Kabupaten', sert.kabupaten],
        ['Atas nama', sert.pemegangHak],
      ],
      { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: 255 }
    ),
    fp(
      'Masih atas nama almarhum/pemilik lama karena belum dibalik nama atas nama para ahli waris.',
      { align: AlignmentType.JUSTIFIED, spaceBefore: 80, spaceAfter: 40, line: F4_LINE_AIRY }
    ),
    fp('Demikian surat pernyataan ini dibuat agar dipergunakan sebagaimana mestinya.', {
      align: AlignmentType.JUSTIFIED,
      spaceAfter: 200,
      line: F4_LINE_AIRY,
    }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4280, F4_CONTENT_WIDTH_DXA - 4280],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4280, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: buildSinglePengesahanCentered(pengesahanTunggal, 20),
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4280, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
                  align: AlignmentType.CENTER,
                  spaceBefore: 20,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp('Yang menyatakan', {
                  align: AlignmentType.CENTER,
                  spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                ...buildNumberedSignerLines(parties, 260),
              ],
            }),
          ],
        }),
      ],
    }),
    ...buildSaksiBlocks(saksi1.nama, saksi2.nama, 220),

    // HALAMAN 9: SURAT PERNYATAAN BPHTB WARISAN
    fp('SURAT PERNYATAAN', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 180,
      line: 260,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 60, line: F4_LINE_AIRY }),
    ...buildNumberedPartiesKvBlocks(parties, { spaceAfterRow: 0 }),
    fp('Dengan ini menyatakan :', { spaceBefore: 100, spaceAfter: 60, line: F4_LINE_AIRY }),
    fp(
      `-  Bahwa kami telah menerima harta Warisan berupa sebidang tanah tersebut ${sert.ringkas} Desa ${sert.desa} dengan Luas ${sert.luasStr} m2 (${sert.luasTerbilang}) yang terletak di Desa ${sert.desa}, Kecamatan ${sert.kecamatan}, ${sert.kabupaten}.`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 240, spaceAfter: 80, line: F4_LINE_AIRY }
    ),
    fp(
      '-  Bahwa apabila dalam Proses Peralihan Hak (Turun Waris) atas tanah yang kami terima tersebut diatas ternyata terjadi kekurangan pembayaran BPHTB, maka kami sanggup untuk membayar kekurangan BPHTB tersebut sesuai ketentuan peraturan perundang-undangan yang berlaku.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 240, spaceAfter: 200, line: F4_LINE_AIRY }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4280, F4_CONTENT_WIDTH_DXA - 4280],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4280, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: buildSinglePengesahanCentered(pengesahanTunggal, 20),
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4280, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
                  align: AlignmentType.CENTER,
                  spaceBefore: 20,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp('Yang menyatakan', {
                  align: AlignmentType.CENTER,
                  spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                ...buildNumberedSignerLines(parties, 260),
              ],
            }),
          ],
        }),
      ],
    }),
    ...buildSaksiBlocks(saksi1.nama, saksi2.nama, 220),

    // HALAMAN 10-11: PEMROSESAN DATA PRIBADI
    ...buildDataPribadiPage({
      parties,
      kotaKabupaten,
      tanggalText: docDate.tanggalText,
    }),

    // HALAMAN 12-13: PERTANGGUNGJAWABAN KEABSAHAN DAN KEBENARAN DOKUMEN (TANPA SAKSI)
    fp('SURAT PERTANGGUNGJAWABAN KEABSAHAN DAN', {
      pageBreakBefore: true,
      bold: true,
      align: AlignmentType.CENTER,
      spaceAfter: 0,
      line: 260,
    }),
    fp('KEBENARAN DOKUMEN', {
      bold: true,
      align: AlignmentType.CENTER,
      spaceAfter: 180,
      line: 260,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 50, line: 250 }),
    ...buildNumberedPartiesKvBlocks(parties, { spaceAfterRow: 0 }),
    fp(
      `Merupakan para ahli waris / pemilik tanah dengan jenis tanah ${sert.jenisHak} ${sert.ringkas} terletak di Desa ${sert.desa}, Kecamatan ${sert.kecamatan}, ${sert.kabupaten}, Provinsi ${sert.provinsi}.`,
      { align: AlignmentType.JUSTIFIED, spaceBefore: 100, spaceAfter: 60, line: 255 }
    ),
    fp('Dengan ini menyatakan :', { spaceAfter: 40, line: 255 }),
    fp(
      '1. Sertipikat tersebut adalah asli dan dokumen Surat Keterangan Warisan beserta seluruh dokumen pendukung adalah benar dan sah menurut hukum.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: 255 }
    ),
    fp(
      `2. Seluruh dokumen yang diunggah pada sistem aplikasi layanan pertanahan pada Kantor Pertanahan ${sert.kabupaten} adalah benar dan sesuai dengan aslinya.`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: 255 }
    ),
    fp(
      '3. Beritikad baik dan bertanggungjawab sepenuhnya atas penggunaan data yang diakses serta bersedia menerima sanksi administratif maupun hukum apabila data dinyatakan tidak benar.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 160, line: 255 }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4280, F4_CONTENT_WIDTH_DXA - 4280],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4280, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: buildSinglePengesahanCentered(pengesahanTunggal, 20),
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4280, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
                  align: AlignmentType.CENTER,
                  spaceBefore: 20,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp('Yang menyatakan', {
                  align: AlignmentType.CENTER,
                  spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                ...buildNumberedSignerLines(parties, 260),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
}

function buildPemecahanUkurUlangBundle(
  record: BerkasRecord,
  settings: OfficeSettings
): Array<Paragraph | Table> {
  const parties = collectNonAktaParties(record);
  const sert = getSertipikatInfo(record);
  const na = record.non_akta;
  const pengesahanTunggal = resolvePengesahanTunggal(record, settings);
  const ganda = resolvePengesahanGanda(record, settings);
  const isPemecahan =
    record.layanan === 'Pemecahan' || record.layanan === 'Pemecahan/Ukur Ulang';

  const saksi1 = resolvePersonCtx(record.akta.saksi_1, settings.profil_saksi, record.akta.saksi_1_detail);
  const saksi2 = resolvePersonCtx(record.akta.saksi_2, settings.profil_saksi, record.akta.saksi_2_detail);
  const kuasa = resolvePersonCtx(
    record.akta.nama_kuasa_bpn,
    settings.profil_kuasa,
    record.akta.kuasa_bpn_detail
  );

  const docDate = resolveNonAktaDocDate(record);
  const kotaKabupaten =
    (record.tanah.kabupaten || settings.nama_kabupaten || '')
      .replace(/^(Kabupaten|Kota)\s+/i, '')
      .trim() || '-';

  const subPermohonan =
    na?.sub_permohonan_ukur || (isPemecahan ? 'Pemecahan' : 'Pengukuran');
  const includeValidasi = subPermohonan.includes('Validasi');
  const boldIndices = isPemecahan
    ? includeValidasi
      ? [8, 14]
      : [8]
    : includeValidasi
    ? [1, 14]
    : [1];

  const bidangPecahan =
    na?.bidang_pecahan && na.bidang_pecahan.length > 0
      ? na.bidang_pecahan
      : [
          {
            id: 'b-1',
            label: 'Bagian 1 (Induk / Sisa)',
            luas_m2: Math.max(0, Math.round(record.tanah.luas_m2 / 2)),
            atas_nama: parties[0]?.nama || '-',
            keterangan: 'Bidang Sisa',
          },
          {
            id: 'b-2',
            label: 'Bagian 2 (Pecahan)',
            luas_m2: Math.max(
              0,
              record.tanah.luas_m2 - Math.round(record.tanah.luas_m2 / 2)
            ),
            atas_nama: parties[0]?.nama || '-',
            keterangan: 'Bidang Pecahan',
          },
        ];

  const blocks: Array<Paragraph | Table> = [
    // 1. PERMOHONAN
    ...buildPermohonanPage({
      record,
      parties,
      kuasa,
      item14Text: 'Verifikasi / Validasi',
      boldIndices,
      lampiranItems: [
        'Permohonan',
        'Fotokopi/Sertipikat asli',
        'Surat Kuasa',
        'Fotokopi KTP dan KK Para Pihak',
        'Surat Penguasaan Fisik',
        'Surat Pemasangan Batas',
        'Gambar Sket Tanah',
        ...(na?.sertakan_pelepasan_jalan ? ['Surat Pelepasan Jalan'] : []),
        ...(na?.sertakan_beda_nama ? ['Surat Pernyataan Beda Nama'] : []),
        'Surat SPPT Terhutang',
        'Fotokopi SPPT PBB Terakhir',
        'Koordinat dan Poligon Bidang',
      ],
      kotaKabupaten,
      tanggalText: docDate.tanggalText,
      tanggalDash: docDate.tanggalDash,
      pageBreakBefore: false,
    }),

    // 2. SURAT KUASA
    ...buildSuratKuasaNonAkta({
      record,
      parties,
      kuasa,
      pengesahan: pengesahanTunggal,
      kotaKabupaten,
      tanggalText: docDate.tanggalText,
      objekPrefix: `Sehubungan dengan permohonan ${isPemecahan ? 'Pemecahan Bidang' : 'Pengukuran Ulang'} atas Sertipikat`,
      khususBullets: [
        `Untuk dan atas nama Pemberi Kuasa mendaftarkan permohonan ${subPermohonan} atas sertipikat tanah tersebut ke Kantor Pertanahan ${sert.kabupaten}.`,
        'Guna keperluan tersebut Penerima Kuasa berhak menghadap pejabat Kantor Pertanahan yang berwenang, mendampingi petugas ukur di lapangan, membayar PNBP, serta mengambil hasil sertipikat/surat ukur setelah selesai.',
      ],
    }),

    // 3. PENGUASAAN FISIK & TIDAK SENGKETA
    ...buildPenguasaanFisikNonAkta({
      record,
      parties,
      saksi1,
      saksi2,
      pengesahan: pengesahanTunggal,
      hariTanggal: docDate.hariTanggal,
      butir1Text: `Bahwa ${parties.length > 1 ? 'kami' : 'saya'} adalah benar-benar pemilik sebidang tanah seluas ${sert.luasStr} M2 (${sert.luasTerbilang}) yang terletak di Desa ${sert.desa}, Kecamatan ${sert.kecamatan}, ${sert.kabupaten} yang sudah bersertipikat ${sert.jenisHak} ${sert.ringkas} Desa ${sert.desa}, tercatat atas nama ${sert.pemegangHak}.`,
    }),

    // 4. SURAT PERNYATAAN PERMOHONAN PEMECAHAN / UKUR ULANG
    fp('SURAT PERNYATAAN', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 180,
      line: 260,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 60, line: F4_LINE_AIRY }),
    ...buildNumberedPartiesKvBlocks(parties, { spaceAfterRow: 0 }),
    fp(
      `Dengan ini menyatakan bahwa ${parties.length > 1 ? 'kami' : 'saya'} adalah pemegang hak atas sebidang tanah ${sert.jenisHak} ${sert.ringkas} seluas ${sert.luasStr} M² terletak di Desa ${sert.desa}, Kecamatan ${sert.kecamatan}, ${sert.kabupaten}.`,
      { align: AlignmentType.JUSTIFIED, spaceBefore: 120, spaceAfter: 60, line: F4_LINE_AIRY }
    ),
    fp(
      isPemecahan
        ? `Bahwa bidang tanah tersebut diatas benar-benar akan dilakukan PEMECAHAN menjadi ${bidangPecahan.length} bagian bidang tanah untuk keperluan penataan batas/pembagian aset dan tidak berada dalam sengketa dengan pihak manapun.`
        : 'Bahwa bidang tanah tersebut diatas diajukan PENGUKURAN ULANG / pengembalian batas untuk mencocokkan luas dan batas fisik di lapangan sesuai kondisi terkini.',
      { align: AlignmentType.JUSTIFIED, spaceAfter: 60, line: F4_LINE_AIRY }
    ),
    fp('Demikian surat pernyataan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.', {
      align: AlignmentType.JUSTIFIED,
      spaceAfter: 180,
      line: F4_LINE_AIRY,
    }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4280, F4_CONTENT_WIDTH_DXA - 4280],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4280, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: buildSinglePengesahanCentered(pengesahanTunggal, 20),
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4280, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
                  align: AlignmentType.CENTER,
                  spaceBefore: 20,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp('Yang menyatakan', {
                  align: AlignmentType.CENTER,
                  spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                ...buildNumberedSignerLines(parties, 260),
              ],
            }),
          ],
        }),
      ],
    }),
    ...buildSaksiBlocks(saksi1.nama, saksi2.nama, 200),

    // 5. SURAT PERNYATAAN PEMASANGAN TANDA BATAS & PERSETUJUAN PEMILIK BERBATASAN (DENGAN SKETSA BIDANG)
    ...(() => {
      const sketItems = isPemecahan
        ? bidangPecahan.map((b, idx) => {
            const descParts = [b.label, b.atas_nama, b.keterangan]
              .map((v) => (v || '').trim())
              .filter(Boolean);
            const deduped: string[] = [];
            for (const part of descParts) {
              if (!deduped.some((d) => d.toLowerCase() === part.toLowerCase())) {
                deduped.push(part);
              }
            }
            const noteText = deduped.length > 0 ? ` (${deduped.join(' · ')})` : '';
            return {
              no: idx + 1,
              luasText: `± ${formatNumberId(b.luas_m2)} m²`,
              noteText,
            };
          })
        : [
            {
              no: 1,
              luasText: `± ${sert.luasStr} m²`,
              noteText: ' (Bidang Ukur Ulang)',
            },
          ];

      const decodedSket = decodeDataUrlToImage(na?.foto_sket_pecah);
      const batasRows: Array<{ label: string; value: string; needSign: boolean }> = [
        {
          label: 'Utara',
          value: record.tanah.batas_utara?.trim() || '-',
          needSign: !isBoundaryNonPerson(record.tanah.batas_utara),
        },
        {
          label: 'Timur',
          value: record.tanah.batas_timur?.trim() || '-',
          needSign: !isBoundaryNonPerson(record.tanah.batas_timur),
        },
        {
          label: 'Selatan',
          value: record.tanah.batas_selatan?.trim() || '-',
          needSign: !isBoundaryNonPerson(record.tanah.batas_selatan),
        },
        {
          label: 'Barat',
          value: record.tanah.batas_barat?.trim() || '-',
          needSign: !isBoundaryNonPerson(record.tanah.batas_barat),
        },
      ];

      const leftBatasW = 4680;
      const rightSignW = F4_CONTENT_WIDTH_DXA - leftBatasW;
      const sketImgColW = Math.round(F4_CONTENT_WIDTH_DXA * 0.58);
      const sketInfoColW = F4_CONTENT_WIDTH_DXA - sketImgColW;

      const sketInlineChildren: Paragraph[] = decodedSket
        ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 40, line: F4_LINE, lineRule: LineRuleType.AUTO },
              children: [
                new ImageRun({
                  data: decodedSket.bytes,
                  type: decodedSket.type,
                  transformation: { width: 310, height: 198 },
                }),
              ],
            }),
          ]
        : [
            fp('U ↑', { bold: true, size: 20, spaceBefore: 40, spaceAfter: 60, line: 230 }),
            fp(`Utara : ${record.tanah.batas_utara || '-'}`, {
              align: AlignmentType.CENTER,
              size: 18,
              spaceAfter: 460,
              line: 220,
            }),
            fp(
              `Barat : ${record.tanah.batas_barat || '-'}          |          Timur : ${record.tanah.batas_timur || '-'}`,
              {
                align: AlignmentType.CENTER,
                size: 18,
                spaceAfter: 460,
                line: 220,
              }
            ),
            fp(`Selatan : ${record.tanah.batas_selatan || '-'}`, {
              align: AlignmentType.CENTER,
              size: 18,
              spaceAfter: 60,
              line: 220,
            }),
          ];

      const sketLargeChildren: Paragraph[] = decodedSket
        ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80, line: F4_LINE, lineRule: LineRuleType.AUTO },
              children: [
                new ImageRun({
                  data: decodedSket.bytes,
                  type: decodedSket.type,
                  transformation: { width: 510, height: 326 },
                }),
              ],
            }),
          ]
        : [
            fp('U ↑', { bold: true, size: 22, spaceBefore: 80, spaceAfter: 120, line: 240 }),
            fp(`Utara : ${record.tanah.batas_utara || '-'}`, {
              align: AlignmentType.CENTER,
              size: 20,
              spaceAfter: 1200,
              line: 240,
            }),
            fp(
              `Barat : ${record.tanah.batas_barat || '-'}                    |                    Timur : ${record.tanah.batas_timur || '-'}`,
              {
                align: AlignmentType.CENTER,
                size: 20,
                spaceAfter: 1200,
                line: 240,
              }
            ),
            fp(`Selatan : ${record.tanah.batas_selatan || '-'}`, {
              align: AlignmentType.CENTER,
              size: 20,
              spaceAfter: 100,
              line: 240,
            }),
          ];

      return [
        fp('SURAT PERNYATAAN PEMASANGAN TANDA BATAS DAN', {
          pageBreakBefore: true,
          bold: true,
          align: AlignmentType.CENTER,
          spaceAfter: 0,
          line: 255,
        }),
        fp('PERSETUJUAN PEMILIK YANG BERBATASAN', {
          bold: true,
          underline: true,
          align: AlignmentType.CENTER,
          spaceAfter: 140,
          line: 255,
        }),
        fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 40, line: 245 }),
        ...buildNumberedPartiesKvBlocks(parties, { spaceAfterRow: 0 }),
        fp(
          `Selaku pemohon ${isPemecahan ? 'pengukuran / pemecahan' : 'pengukuran'} / pemilik tanah ${sert.jenisHak} ${sert.ringkas} Seluas ± ${sert.luasStr} M² (${sert.luasTerbilang}), yang terletak di Desa ${sert.desa}, Kecamatan ${sert.kecamatan}, ${sert.kabupaten}. Dengan ini menyatakan bahwa tanah tersebut :`,
          { align: AlignmentType.JUSTIFIED, spaceBefore: 80, spaceAfter: 50, line: 245 }
        ),
        fp('1. Telah dipasang patok/ tanda batas;', {
          align: AlignmentType.JUSTIFIED,
          indentLeft: 300,
          hanging: 300,
          spaceAfter: 20,
          line: 245,
        }),
        fp('2. Terhadap patok yang dipasang tersebut tidak ada pihak yang keberatan;', {
          align: AlignmentType.JUSTIFIED,
          indentLeft: 300,
          hanging: 300,
          spaceAfter: 20,
          line: 245,
        }),
        fp(
          `3. Apabila ternyata luas hasil ukur lebih kecil dari luas yang tertulis pada alas hak/ akta peralihan hak/ surat-surat lain dalam berkas permohonan sertipikat, ${parties.length > 1 ? 'kami' : 'saya'} menerima luas hasil ukuran petugas Kantor Pertanahan; dan`,
          { align: AlignmentType.JUSTIFIED, indentLeft: 300, hanging: 300, spaceAfter: 20, line: 245 }
        ),
        fp(
          `4. Apabila hasil pengukuran ternyata lebih besar dari yang tertulis pada alas hak/ akta peralihan hak/ surat-surat lain dalam berkas permohonan sertipikat, ${parties.length > 1 ? 'kami' : 'saya'} tidak mengambil hak orang lain dan tidak ada perolehan lain selain bukti pemilikan tersebut diatas, apabila ada gugatan/ keberatan dari pihak lain, ${parties.length > 1 ? 'kami' : 'saya'} akan bertanggung jawab.`,
          { align: AlignmentType.JUSTIFIED, indentLeft: 300, hanging: 300, spaceAfter: 80, line: 245 }
        ),
        fp(
          `Demikian Surat Pernyataan ini ${parties.length > 1 ? 'kami' : 'saya'} buat dengan sebenarnya dengan penuh tanggung jawab dan ${parties.length > 1 ? 'kami' : 'saya'} bersedia mengangkat sumpah bila diperlukan, apabila pernyataan ini tidak benar ${parties.length > 1 ? 'kami' : 'saya'} bersedia dituntut dihadapan pihak yang berwenang.`,
          { align: AlignmentType.JUSTIFIED, spaceAfter: 120, line: 245 }
        ),
        // Menyetujui Pemilik Berbatasan (kiri) vs Yang membuat Pernyataan (kanan)
        new Table({
          width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
          columnWidths: [leftBatasW, rightSignW],
          layout: TableLayoutType.FIXED,
          borders: NO_TABLE_BORDERS,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: leftBatasW, type: WidthType.DXA },
                  borders: NO_BORDER,
                  margins: { top: 0, bottom: 0, left: 0, right: 120 },
                  children: [
                    fp('Menyetujui:', { spaceAfter: 30, line: F4_LINE }),
                    fp('Pemilik yang berbatasan', { spaceAfter: 60, line: F4_LINE }),
                    new Table({
                      width: { size: leftBatasW - 140, type: WidthType.DXA },
                      columnWidths: [1050, 1950, leftBatasW - 3140],
                      layout: TableLayoutType.FIXED,
                      borders: NO_TABLE_BORDERS,
                      rows: batasRows.map(
                        (b) =>
                          new TableRow({
                            children: [
                              new TableCell({
                                width: { size: 1050, type: WidthType.DXA },
                                borders: NO_BORDER,
                                margins: { top: 20, bottom: 80, left: 0, right: 20 },
                                children: [fp(b.label, { size: 20, spaceAfter: 0, line: 240 })],
                              }),
                              new TableCell({
                                width: { size: 1950, type: WidthType.DXA },
                                borders: NO_BORDER,
                                margins: { top: 20, bottom: 80, left: 0, right: 40 },
                                children: [fp(`: ${b.value}`, { size: 20, spaceAfter: 0, line: 240 })],
                              }),
                              new TableCell({
                                width: { size: leftBatasW - 3140, type: WidthType.DXA },
                                borders: NO_BORDER,
                                margins: { top: 20, bottom: 80, left: 0, right: 0 },
                                children: [
                                  fp(b.needSign ? '(                )' : '', {
                                    size: 20,
                                    spaceAfter: 0,
                                    line: 240,
                                  }),
                                ],
                              }),
                            ],
                          })
                      ),
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: rightSignW, type: WidthType.DXA },
                  borders: NO_BORDER,
                  margins: { top: 0, bottom: 0, left: 100, right: 0 },
                  children: [
                    fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
                      align: AlignmentType.CENTER,
                      spaceAfter: 0,
                      line: F4_LINE,
                    }),
                    fp('Yang membuat Pernyataan', {
                      align: AlignmentType.CENTER,
                      spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                      line: F4_LINE,
                    }),
                    ...buildNumberedSignerLines(parties, 260),
                  ],
                }),
              ],
            }),
          ],
        }),
        fp('SKETSA BIDANG TANAH', {
          bold: true,
          spaceBefore: 140,
          spaceAfter: 60,
          line: 240,
        }),
        // Bingkai SKETSA BIDANG TANAH (kiri gambar sket, kanan keterangan sertipikat & rincian luas)
        new Table({
          width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
          columnWidths: [sketImgColW, sketInfoColW],
          layout: TableLayoutType.FIXED,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
            left: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
            right: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          },
          rows: [
            new TableRow({
              height: { value: 3300, rule: HeightRule.ATLEAST },
              children: [
                new TableCell({
                  width: { size: sketImgColW, type: WidthType.DXA },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
                    left: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
                    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                  },
                  margins: { top: 100, bottom: 100, left: 100, right: 80 },
                  children: sketInlineChildren,
                }),
                new TableCell({
                  width: { size: sketInfoColW, type: WidthType.DXA },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
                    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    right: { style: BorderStyle.SINGLE, size: 6, color: '1E293B' },
                  },
                  margins: { top: 140, bottom: 100, left: 100, right: 120 },
                  children: [
                    fp(
                      `Tanah ${sert.jenisHak}. ${sert.isDigital ? `Nibel: ${sert.nibClean}` : sert.ringkas}`,
                      { size: 19, spaceAfter: 30, line: 240 }
                    ),
                    fp(
                      `Seluas ± ${sert.luasStr} M² Desa ${sert.desa}, an ${sert.pemegangHak}`,
                      { size: 19, spaceAfter: 140, line: 240 }
                    ),
                    ...sketItems.map((item) =>
                      fp(`${item.no}. Luas : ${item.luasText}${item.noteText}`, {
                        bold: true,
                        size: 19,
                        spaceAfter: 50,
                        line: 240,
                      })
                    ),
                    ...(na?.sertakan_pelepasan_jalan
                      ? [
                          fp(
                            `Dilepaskan Untuk Jalan Luas ± ${formatNumberId(na.pelepasan_jalan_luas_m2 ?? 0)} m²`,
                            { size: 19, spaceAfter: 40, line: 240 }
                          ),
                        ]
                      : []),
                  ],
                }),
              ],
            }),
          ],
        }),
        fp('', { spaceAfter: 80, line: 160 }),
        // Saksi-saksi (kiri) & Mengetahui (kanan)
        new Table({
          width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
          columnWidths: [4840, F4_CONTENT_WIDTH_DXA - 4840],
          layout: TableLayoutType.FIXED,
          borders: NO_TABLE_BORDERS,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 4840, type: WidthType.DXA },
                  borders: NO_BORDER,
                  margins: { top: 40, bottom: 0, left: 0, right: 120 },
                  children: [
                    fp('Saksi-saksi:', { spaceAfter: 120, line: F4_LINE }),
                    fp(`1. ${saksi1.nama} : _____________________`, {
                      size: 20,
                      spaceAfter: 360,
                      line: F4_LINE,
                    }),
                    fp(`2. ${saksi2.nama} : _____________________`, {
                      size: 20,
                      spaceAfter: 20,
                      line: F4_LINE,
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: F4_CONTENT_WIDTH_DXA - 4840, type: WidthType.DXA },
                  borders: NO_BORDER,
                  margins: { top: 0, bottom: 0, left: 120, right: 0 },
                  children: buildSinglePengesahanCentered(pengesahanTunggal, 20),
                }),
              ],
            }),
          ],
        }),

        // 6. GAMBAR SKET TANAH (HALAMAN KHUSUS SKET BESAR + KETERANGAN KOTAK ANGKA)
        fp('GAMBAR SKET TANAH', {
          pageBreakBefore: true,
          bold: true,
          underline: true,
          align: AlignmentType.CENTER,
          spaceAfter: 180,
          line: 260,
        }),
        new Table({
          width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
          columnWidths: [F4_CONTENT_WIDTH_DXA],
          layout: TableLayoutType.FIXED,
          borders: decodedSket ? NO_TABLE_BORDERS : THIN_TABLE_BORDERS,
          rows: [
            new TableRow({
              height: { value: decodedSket ? 4800 : 5000, rule: HeightRule.ATLEAST },
              children: [
                new TableCell({
                  width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
                  borders: decodedSket ? NO_BORDER : THIN_BORDER,
                  margins: { top: 80, bottom: 80, left: 80, right: 80 },
                  children: sketLargeChildren,
                }),
              ],
            }),
          ],
        }),
        fp('KETERANGAN', {
          bold: true,
          spaceBefore: 180,
          spaceAfter: 100,
          line: 250,
        }),
        new Table({
          width: { size: F4_CONTENT_WIDTH_DXA - 240, type: WidthType.DXA },
          columnWidths: [640, 220, F4_CONTENT_WIDTH_DXA - 1100],
          layout: TableLayoutType.FIXED,
          borders: NO_TABLE_BORDERS,
          indent: { size: 240, type: WidthType.DXA },
          rows: [
            ...sketItems.map(
              (item) =>
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 640, type: WidthType.DXA },
                      borders: THIN_BORDER,
                      margins: { top: 50, bottom: 50, left: 60, right: 60 },
                      children: [
                        fp(String(item.no), {
                          bold: true,
                          align: AlignmentType.CENTER,
                          size: 20,
                          spaceAfter: 0,
                          line: 230,
                        }),
                      ],
                    }),
                    new TableCell({
                      width: { size: 220, type: WidthType.DXA },
                      borders: NO_BORDER,
                      children: [fp('', { spaceAfter: 0 })],
                    }),
                    new TableCell({
                      width: { size: F4_CONTENT_WIDTH_DXA - 1100, type: WidthType.DXA },
                      borders: NO_BORDER,
                      margins: { top: 50, bottom: 80, left: 20, right: 0 },
                      children: [
                        fp(`Luas : ${item.luasText}${item.noteText}`, {
                          bold: true,
                          size: 20,
                          spaceAfter: 0,
                          line: 240,
                        }),
                      ],
                    }),
                  ],
                })
            ),
            ...(na?.sertakan_pelepasan_jalan
              ? [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 640, type: WidthType.DXA },
                        borders: NO_BORDER,
                        children: [fp('', { spaceAfter: 0 })],
                      }),
                      new TableCell({
                        width: { size: 220, type: WidthType.DXA },
                        borders: NO_BORDER,
                        children: [fp('', { spaceAfter: 0 })],
                      }),
                      new TableCell({
                        width: { size: F4_CONTENT_WIDTH_DXA - 1100, type: WidthType.DXA },
                        borders: NO_BORDER,
                        margins: { top: 40, bottom: 60, left: 20, right: 0 },
                        children: [
                          fp(
                            `Dilepaskan Untuk Jalan Luas ± ${formatNumberId(na.pelepasan_jalan_luas_m2 ?? 0)} m²${na.pelepasan_jalan_keterangan?.trim() ? ` (${na.pelepasan_jalan_keterangan.trim()})` : ''}`,
                            { size: 20, spaceAfter: 0, line: 240 }
                          ),
                        ],
                      }),
                    ],
                  }),
                ]
              : []),
          ],
        }),
        fp('', { spaceAfter: 160, line: 160 }),
        new Table({
          width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
          columnWidths: [4280, F4_CONTENT_WIDTH_DXA - 4280],
          layout: TableLayoutType.FIXED,
          borders: NO_TABLE_BORDERS,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 4280, type: WidthType.DXA },
                  borders: NO_BORDER,
                  margins: { top: 0, bottom: 0, left: 0, right: 120 },
                  children: buildSinglePengesahanCentered(pengesahanTunggal, 20),
                }),
                new TableCell({
                  width: { size: F4_CONTENT_WIDTH_DXA - 4280, type: WidthType.DXA },
                  borders: NO_BORDER,
                  margins: { top: 0, bottom: 0, left: 120, right: 0 },
                  children: [
                    fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
                      align: AlignmentType.CENTER,
                      spaceBefore: 20,
                      spaceAfter: 0,
                      line: F4_LINE,
                    }),
                    fp('Pemohon', {
                      align: AlignmentType.CENTER,
                      spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                      line: F4_LINE,
                    }),
                    ...buildNumberedSignerLines(parties, 260),
                  ],
                }),
              ],
            }),
          ],
        }),
      ];
    })(),
  ];

  // 7. OPSIONAL: PELEPASAN JALAN
  if (na?.sertakan_pelepasan_jalan) {
    const luasJalan = na.pelepasan_jalan_luas_m2 ?? 0;
    blocks.push(
      fp('SURAT PERNYATAAN PELEPASAN JALAN', {
        pageBreakBefore: true,
        bold: true,
        underline: true,
        align: AlignmentType.CENTER,
        spaceAfter: 180,
        line: 260,
      }),
      fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 60, line: F4_LINE_AIRY }),
      ...buildNumberedPartiesKvBlocks(parties, { spaceAfterRow: 0 }),
      fp(
        `Dengan ini menyatakan dengan sebenarnya bahwa terhadap sebagian bidang tanah ${sert.jenisHak} ${sert.ringkas} seluas ${sert.luasStr} M² terletak di Desa ${sert.desa}, Kecamatan ${sert.kecamatan}, ${sert.kabupaten}, saya/kami melepas hak sebagian tanah seluas ± ${formatNumberId(luasJalan)} M² untuk dipergunakan sebagai Akses Jalan (${na.pelepasan_jalan_keterangan?.trim() || 'Jalan Umum/Akses Bidang Pecahan'}) tanpa menuntut ganti rugi apapun di kemudian hari.`,
        { align: AlignmentType.JUSTIFIED, spaceBefore: 120, spaceAfter: 100, line: F4_LINE_AIRY }
      ),
      fp('Demikian surat pernyataan pelepasan jalan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.', {
        align: AlignmentType.JUSTIFIED,
        spaceAfter: 200,
        line: F4_LINE_AIRY,
      }),
      new Table({
        width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
        columnWidths: [4280, F4_CONTENT_WIDTH_DXA - 4280],
        layout: TableLayoutType.FIXED,
        borders: NO_TABLE_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 4280, type: WidthType.DXA },
                borders: NO_BORDER,
                margins: { top: 0, bottom: 0, left: 0, right: 120 },
                children: buildSinglePengesahanCentered(pengesahanTunggal, 20),
              }),
              new TableCell({
                width: { size: F4_CONTENT_WIDTH_DXA - 4280, type: WidthType.DXA },
                borders: NO_BORDER,
                margins: { top: 0, bottom: 0, left: 120, right: 0 },
                children: [
                  fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
                    align: AlignmentType.CENTER,
                    spaceBefore: 20,
                    spaceAfter: 0,
                    line: F4_LINE,
                  }),
                  fp('Yang menyatakan', {
                    align: AlignmentType.CENTER,
                    spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                    line: F4_LINE,
                  }),
                  ...buildNumberedSignerLines(parties, 260),
                ],
              }),
            ],
          }),
        ],
      }),
      ...buildSaksiBlocks(saksi1.nama, saksi2.nama, 200)
    );
  }

  // 8. OPSIONAL: BEDA NAMA (DENGAN 2 PENGESAHAN CAMAT & KADES ASAL SERTIPIKAT)
  if (na?.sertakan_beda_nama) {
    blocks.push(
      ...buildBedaNamaPage({
        record,
        parties,
        saksi1,
        saksi2,
        ganda,
        kotaKabupaten,
        tanggalText: docDate.tanggalText,
      })
    );
  }

  // 9. SURAT PERNYATAAN PENUTUPAN PERMOHONAN DAN TIDAK MENUNTUT PENGEMBALIAN PNBP
  blocks.push(
    fp('SURAT PERNYATAAN PENUTUPAN PERMOHONAN DAN', {
      pageBreakBefore: true,
      bold: true,
      align: AlignmentType.CENTER,
      spaceAfter: 0,
      line: 255,
    }),
    fp('TIDAK MENUNTUT PENGEMBALIAN PNBP', {
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 180,
      line: 255,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 60, line: 250 }),
    ...buildNumberedPartiesKvBlocks(parties, { spaceAfterRow: 0 }),
    fp(
      `Selaku pemohon layanan ${subPermohonan} atas sertipikat ${sert.jenisHak} ${sert.ringkas} Desa ${sert.desa}, Kecamatan ${sert.kecamatan}, ${sert.kabupaten}, dengan ini menyatakan :`,
      { align: AlignmentType.JUSTIFIED, spaceBefore: 100, spaceAfter: 60, line: 255 }
    ),
    fp(
      '1. Lokasi bidang tanah yang dimohonkan pengukuran/pemecahan adalah benar dan sesuai titik koordinat share location dengan toleransi radius maksimal 100 meter serta dapat ditunjukkan secara langsung kepada petugas ukur.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: 255 }
    ),
    fp(
      '2. Tanda batas permanen telah terpasang dengan jelas dan pemilik batas telah menyetujui batas bidang tanah.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: 255 }
    ),
    fp(
      '3. Apabila syarat fisik lapangan/dokumen tidak terpenuhi hingga batas waktu sesuai SOP Kantor Pertanahan sehingga permohonan ditutup/dibatalkan, pemohon bersedia menerima penutupan berkas dan tidak menuntut pengembalian biaya PNBP yang telah disetorkan.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 180, line: 255 }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4280, F4_CONTENT_WIDTH_DXA - 4280],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4280, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: buildSinglePengesahanCentered(pengesahanTunggal, 20),
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4280, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
                  align: AlignmentType.CENTER,
                  spaceBefore: 20,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp('Yang membuat pernyataan', {
                  align: AlignmentType.CENTER,
                  spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                ...buildNumberedSignerLines(parties, 260),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // 10. LAMPIRAN FOTO LOKASI TAMPAK DEPAN GEOTAGGING, PATOK 1-4 & POLIGON (2 HALAMAN SESUAI STANDAR BPN)
  blocks.push(...buildFotoLokasiPatokPoligonPages(record));

  return blocks;
}

function buildFotoLokasiPatokPoligonPages(record: BerkasRecord): Array<Paragraph | Table> {
  const na = record.non_akta;
  const sert = getSertipikatInfo(record);
  const hakPrefix = sert.jenisHak.toLowerCase().includes('milik')
    ? 'SHM'
    : sert.jenisHak.toUpperCase();
  const identSert = sert.isDigital ? `Nibel ${sert.nibClean}` : `No. ${sert.noHakClean}`;
  const halfW = Math.floor(F4_CONTENT_WIDTH_DXA / 2);

  const polygonLines = (na?.koordinat_poligon || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const gpsText = na?.koordinat_gps?.trim() || '';
  const mapsUrl = na?.link_maps?.trim() || '';

  const locationLineRuns: TextRun[] = [];
  if (gpsText) {
    locationLineRuns.push(
      new TextRun({
        text: gpsText + (mapsUrl ? '  ' : ''),
        bold: true,
        size: 20,
        font: F4_FONT,
      })
    );
  }
  if (mapsUrl) {
    locationLineRuns.push(
      new TextRun({
        text: mapsUrl,
        bold: true,
        underline: {},
        color: '1D4ED8',
        size: 20,
        font: F4_FONT,
      })
    );
  }
  if (locationLineRuns.length === 0) {
    locationLineRuns.push(
      new TextRun({
        text: '(Koordinat GPS & tautan Google Maps share location bidang tanah)',
        italics: true,
        color: '64748B',
        size: 19,
        font: F4_FONT,
      })
    );
  }

  const decodedDepan = decodeDataUrlToImage(na?.foto_tampak_depan);
  const decodedPoligon = decodeDataUrlToImage(na?.foto_poligon);

  const buildNumberedPatokCell = (numLabel: string, dataUrl?: string): Paragraph[] => {
    const decoded = decodeDataUrlToImage(dataUrl);
    if (decoded) {
      return [
        fp(numLabel, { bold: true, align: AlignmentType.CENTER, spaceBefore: 20, spaceAfter: 60, line: 230 }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 40, line: F4_LINE, lineRule: LineRuleType.AUTO },
          children: [
            new ImageRun({
              data: decoded.bytes,
              type: decoded.type,
              transformation: { width: 225, height: 280 },
            }),
          ],
        }),
      ];
    }
    return [
      fp(numLabel, { bold: true, align: AlignmentType.CENTER, spaceBefore: 20, spaceAfter: 80, line: 230 }),
      fp('(Tempelkan foto patok batas GPS Map Camera di sini)', {
        italic: true,
        align: AlignmentType.CENTER,
        size: 18,
        spaceBefore: 900,
        spaceAfter: 900,
        line: 230,
      }),
    ];
  };

  const out: Array<Paragraph | Table> = [
    // HALAMAN A: FOTO LOKASI + TAMPAK DEPAN + KOORDINAT/MAPS + PATOK 1 & 2
    fp(`FOTO LOKASI ${hakPrefix} ${identSert}`, {
      pageBreakBefore: true,
      bold: true,
      align: AlignmentType.CENTER,
      spaceAfter: 40,
      line: 250,
    }),
    fp(`DESA ${sert.desa.toUpperCase()} An ${sert.pemegangHak.toUpperCase()} Luas ${sert.luasStr} M²`, {
      bold: true,
      align: AlignmentType.CENTER,
      spaceAfter: 120,
      line: 250,
    }),
    fp('TAMPAK DEPAN', {
      bold: true,
      align: AlignmentType.LEFT,
      spaceAfter: 80,
      line: 240,
    }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [F4_CONTENT_WIDTH_DXA],
      layout: TableLayoutType.FIXED,
      borders: decodedDepan ? NO_TABLE_BORDERS : THIN_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
              borders: decodedDepan ? NO_BORDER : THIN_BORDER,
              margins: { top: 40, bottom: 40, left: 40, right: 40 },
              children: decodedDepan
                ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 0, after: 40, line: F4_LINE, lineRule: LineRuleType.AUTO },
                      children: [
                        new ImageRun({
                          data: decodedDepan.bytes,
                          type: decodedDepan.type,
                          transformation: { width: 495, height: 295 },
                        }),
                      ],
                    }),
                  ]
                : [
                    fp('(Sisipkan / unggah foto lokasi tampak depan bidang tanah GPS Map Camera)', {
                      italic: true,
                      align: AlignmentType.CENTER,
                      size: 19,
                      spaceBefore: 1100,
                      spaceAfter: 1100,
                      line: 240,
                    }),
                  ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 80, after: 100, line: F4_LINE, lineRule: LineRuleType.AUTO },
      children: locationLineRuns,
    }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, F4_CONTENT_WIDTH_DXA - halfW],
      layout: TableLayoutType.FIXED,
      borders:
        decodeDataUrlToImage(na?.foto_patok_1) && decodeDataUrlToImage(na?.foto_patok_2)
          ? NO_TABLE_BORDERS
          : THIN_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: decodeDataUrlToImage(na?.foto_patok_1) ? NO_BORDER : THIN_BORDER,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: buildNumberedPatokCell('1', na?.foto_patok_1),
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - halfW, type: WidthType.DXA },
              borders: decodeDataUrlToImage(na?.foto_patok_2) ? NO_BORDER : THIN_BORDER,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: buildNumberedPatokCell('2', na?.foto_patok_2),
            }),
          ],
        }),
      ],
    }),

    // HALAMAN B: PATOK 3 & 4 + POLIGON CITRA SATELIT + KOORDINAT POLIGON
    fp('', { pageBreakBefore: true, spaceAfter: 20, line: 120 }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, F4_CONTENT_WIDTH_DXA - halfW],
      layout: TableLayoutType.FIXED,
      borders:
        decodeDataUrlToImage(na?.foto_patok_3) && decodeDataUrlToImage(na?.foto_patok_4)
          ? NO_TABLE_BORDERS
          : THIN_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: decodeDataUrlToImage(na?.foto_patok_3) ? NO_BORDER : THIN_BORDER,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: buildNumberedPatokCell('3', na?.foto_patok_3),
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - halfW, type: WidthType.DXA },
              borders: decodeDataUrlToImage(na?.foto_patok_4) ? NO_BORDER : THIN_BORDER,
              margins: { top: 40, bottom: 40, left: 60, right: 60 },
              children: buildNumberedPatokCell('4', na?.foto_patok_4),
            }),
          ],
        }),
      ],
    }),
    fp('POLIGON', {
      bold: true,
      align: AlignmentType.LEFT,
      spaceBefore: 140,
      spaceAfter: 80,
      line: 240,
    }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [F4_CONTENT_WIDTH_DXA],
      layout: TableLayoutType.FIXED,
      borders: decodedPoligon ? NO_TABLE_BORDERS : THIN_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
              borders: decodedPoligon ? NO_BORDER : THIN_BORDER,
              margins: { top: 60, bottom: 60, left: 60, right: 60 },
              children: decodedPoligon
                ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 0, after: 40, line: F4_LINE, lineRule: LineRuleType.AUTO },
                      children: [
                        new ImageRun({
                          data: decodedPoligon.bytes,
                          type: decodedPoligon.type,
                          transformation: { width: 455, height: 345 },
                        }),
                      ],
                    }),
                  ]
                : [
                    fp('CITRA SATELIT / POLIGON BIDANG TANAH', {
                      bold: true,
                      align: AlignmentType.CENTER,
                      size: 19,
                      spaceBefore: 60,
                      spaceAfter: 60,
                      line: 240,
                    }),
                    fp('(Sisipkan / unggah tangkapan layar peta poligon bidang tanah di sini)', {
                      italic: true,
                      align: AlignmentType.CENTER,
                      size: 19,
                      spaceBefore: 1100,
                      spaceAfter: 1100,
                      line: 240,
                    }),
                  ],
            }),
          ],
        }),
      ],
    }),
  ];

  if (polygonLines.length > 0) {
    out.push(
      fp('Titik Koordinat Sudut Poligon Bidang Tanah :', {
        bold: true,
        size: 19,
        spaceBefore: 100,
        spaceAfter: 30,
        line: 240,
      })
    );
    polygonLines.forEach((coord, idx) => {
      const letter = String.fromCharCode(97 + idx);
      const hasPrefix = /^[a-z0-9]+[.)]\s/i.test(coord);
      out.push(
        fp(hasPrefix ? coord : `${letter}. ${coord}`, {
          indentLeft: 300,
          size: 19,
          spaceAfter: 15,
          line: 230,
        })
      );
    });
  }

  return out;
}

function buildRalatDataBundle(
  record: BerkasRecord,
  settings: OfficeSettings
): Array<Paragraph | Table> {
  const parties = collectNonAktaParties(record);
  const sert = getSertipikatInfo(record);
  const na = record.non_akta;
  const pengesahanTunggal = resolvePengesahanTunggal(record, settings);
  const ganda = resolvePengesahanGanda(record, settings);

  const saksi1 = resolvePersonCtx(record.akta.saksi_1, settings.profil_saksi, record.akta.saksi_1_detail);
  const saksi2 = resolvePersonCtx(record.akta.saksi_2, settings.profil_saksi, record.akta.saksi_2_detail);
  const kuasa = resolvePersonCtx(
    record.akta.nama_kuasa_bpn,
    settings.profil_kuasa,
    record.akta.kuasa_bpn_detail
  );

  const docDate = resolveNonAktaDocDate(record);
  const kotaKabupaten =
    (record.tanah.kabupaten || settings.nama_kabupaten || '')
      .replace(/^(Kabupaten|Kota)\s+/i, '')
      .trim() || '-';

  const namaSertipikat =
    na?.nama_di_sertipikat?.trim() || sert.pemegangHak || parties[0]?.nama || '-';
  const namaKtpKk = na?.nama_di_ktp_kk?.trim() || parties[0]?.nama || '-';
  const nomorKk = na?.nomor_kk?.trim() || '-';
  const dokLain = na?.jenis_dokumen_lain?.trim() || 'Kutipan Akta Nikah / Ijazah';
  const namaDokLain = na?.nama_di_dokumen_lain?.trim() || namaSertipikat;
  const tglLahirBaku = na?.tgl_lahir_baku?.trim() || parties[0]?.ttl || '-';
  const uraianKronologi =
    na?.uraian_kronologi?.trim() ||
    `Terjadi perbedaan penulisan nama pemegang hak pada sertipikat (${namaSertipikat}) dengan identitas kependudukan terbaru pada KTP dan Kartu Keluarga (${namaKtpKk}), dikarenakan kesalahan pencatatan administrasi/ejaan terdahulu.`;

  const pemohon = parties[0];

  return [
    // 1. PERMOHONAN (14. RALAT DATA)
    ...buildPermohonanPage({
      record,
      parties,
      kuasa,
      item14Text: 'RALAT DATA',
      boldIndices: [7, 14],
      lampiranItems: [
        'Fotokopi KTP dan KK',
        'Fotokopi/Sertipikat asli',
        'Surat Kuasa',
        'Surat Kronologi Ralat Data',
        'SK Penguasaan fisik',
        'Surat Pernyataan Beda nama',
      ],
      kotaKabupaten,
      tanggalText: docDate.tanggalText,
      tanggalDash: docDate.tanggalDash,
      pageBreakBefore: false,
    }),

    // 2. SURAT KUASA RALAT DATA
    ...buildSuratKuasaNonAkta({
      record,
      parties,
      kuasa,
      pengesahan: pengesahanTunggal,
      kotaKabupaten,
      tanggalText: docDate.tanggalText,
      objekPrefix: 'Sehubungan dengan Ralat Data pada Sertipikat Tanah',
      khususBullets: [
        `Untuk dan atas nama Pemberi Kuasa mendaftarkan permohonan Ralat Data Sertipikat (${sert.jenisHak} ${sert.ringkas}) ke Kantor Pertanahan ${sert.kabupaten}.`,
        'Guna keperluan tersebut Penerima Kuasa berhak menghadap kepada pejabat Kantor Pertanahan yang berwenang, menandatangani surat permohonan, membayar biaya pendaftaran, serta mengambil sertipikat setelah proses Ralat Data selesai.',
      ],
    }),

    // 3. PENGUASAAN FISIK & TIDAK SENGKETA (DENGAN CATATAN ALIAS)
    ...buildPenguasaanFisikNonAkta({
      record,
      parties,
      saksi1,
      saksi2,
      pengesahan: pengesahanTunggal,
      hariTanggal: docDate.hariTanggal,
      butir1Text: `Bahwa saya adalah benar-benar pemilik sebidang tanah seluas ${sert.luasStr} M2 (${sert.luasTerbilang}) yang terletak di Desa ${sert.desa}, Kecamatan ${sert.kecamatan}, ${sert.kabupaten} yang sudah bersertipikat ${sert.jenisHak} ${sert.ringkas} Desa ${sert.desa}, yang tercatat atas nama ${namaSertipikat} dan merupakan produk Kantor Pertanahan ${sert.kabupaten}.`,
      catatanAlias: `Nama ${namaSertipikat} di sertipikat alias ${namaKtpKk} sesuai KTP/KK`,
    }),

    // 4. SURAT PERNYATAAN BEDA NAMA (2 PENGESAHAN CAMAT & KADES)
    ...buildBedaNamaPage({
      record,
      parties,
      saksi1,
      saksi2,
      ganda,
      kotaKabupaten,
      tanggalText: docDate.tanggalText,
    }),

    // 5. SURAT KRONOLOGI RALAT DATA (2 PENGESAHAN CAMAT & KADES)
    fp('SURAT KRONOLOGI RALAT DATA', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 180,
      line: 260,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 50, line: 250 }),
    kvTable(
      [
        ['Nama', pemohon.nama],
        ['Tempat/Tgl. Lahir', pemohon.ttl],
        ['Pekerjaan', pemohon.pekerjaan],
        ['Nomor KTP', pemohon.nik],
        ['Nomor KK', nomorKk],
        ['Alamat', pemohon.alamatLengkap],
      ],
      { indentTwips: 420, labelPct: 28, spaceAfterRow: 0, line: 250 }
    ),
    fp('Dengan ini menerangkan kronologi perbedaan data identitas sebagai berikut :', {
      spaceBefore: 120,
      spaceAfter: 60,
      line: 250,
    }),
    fp(`1. Pada Sertipikat ${sert.jenisHak} ${sert.ringkas} Desa ${sert.desa} tertulis nama : ${namaSertipikat}`, {
      indentLeft: 320,
      hanging: 320,
      spaceAfter: 30,
      line: 250,
    }),
    fp(`2. Pada KTP dan KK (No. ${nomorKk}) tertulis nama : ${namaKtpKk}`, {
      indentLeft: 320,
      hanging: 320,
      spaceAfter: 30,
      line: 250,
    }),
    fp(`3. Pada ${dokLain} tertulis nama : ${namaDokLain}`, {
      indentLeft: 320,
      hanging: 320,
      spaceAfter: 60,
      line: 250,
    }),
    fp(`Uraian Kronologi : ${uraianKronologi}`, {
      align: AlignmentType.JUSTIFIED,
      spaceAfter: 60,
      line: 255,
    }),
    fp(
      `Bahwa pemilik yang sah adalah satu orang yang sama, sehingga data identitas baku yang dimohonkan untuk diralat pada Sertipikat menjadi Nama : ${namaKtpKk}, Tempat/Tanggal Lahir : ${tglLahirBaku}. Pemohon bertanggungjawab penuh secara formil maupun materiil atas kebenaran data tersebut.`,
      { align: AlignmentType.JUSTIFIED, spaceAfter: 140, line: 255 }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4840, F4_CONTENT_WIDTH_DXA - 4840],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4840, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: [
                fp('Saksi – saksi :', { spaceAfter: 160, line: F4_LINE }),
                fp(`1. ${saksi1.nama} (...............)`, { spaceAfter: 420, line: F4_LINE }),
                fp(`2. ${saksi2.nama} (...............)`, { spaceAfter: 20, line: F4_LINE }),
              ],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4840, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
                  align: AlignmentType.CENTER,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp('Yang membuat kronologi', {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                fp(pemohon.nama, {
                  bold: true,
                  underline: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 20,
                  line: F4_LINE,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    fp('', { spaceAfter: 80, line: 160 }),
    buildDualPengesahanTable(ganda, `${sert.desa}, Tanggal ${docDate.tanggalText}`, {
      withNumbers: true,
      mode: 'beda_nama',
    }),

    // 6. PERSETUJUAN PEMROSESAN DATA PRIBADI
    ...buildDataPribadiPage({
      parties,
      kotaKabupaten,
      tanggalText: docDate.tanggalText,
    }),
  ];
}

function decodeDataUrlToImage(dataUrl?: string): {
  bytes: Uint8Array;
  type: 'png' | 'jpg' | 'gif' | 'bmp';
} | null {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const match = /^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return null;
  const mimeSub = match[1].toLowerCase();
  const base64 = match[2];
  const type: 'png' | 'jpg' | 'gif' | 'bmp' =
    mimeSub === 'jpeg' || mimeSub === 'jpg'
      ? 'jpg'
      : mimeSub === 'gif'
      ? 'gif'
      : mimeSub === 'bmp'
      ? 'bmp'
      : 'png';
  try {
    if (typeof Buffer !== 'undefined') {
      return { bytes: new Uint8Array(Buffer.from(base64, 'base64')), type };
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { bytes, type };
  } catch {
    return null;
  }
}

function buildPhotoCellChildren(
  label: string,
  dataUrl: string | undefined,
  opts: { widthPx: number; heightPx: number; placeholderHeightTwips: number }
): Paragraph[] {
  const decoded = decodeDataUrlToImage(dataUrl);
  if (decoded) {
    return [
      fp(label, { bold: true, align: AlignmentType.CENTER, spaceBefore: 40, spaceAfter: 60, line: F4_LINE }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 20, after: 60, line: F4_LINE, lineRule: LineRuleType.AUTO },
        children: [
          new ImageRun({
            data: decoded.bytes,
            type: decoded.type,
            transformation: { width: opts.widthPx, height: opts.heightPx },
          }),
        ],
      }),
    ];
  }
  return [
    fp(label, { bold: true, align: AlignmentType.CENTER, spaceBefore: 60, spaceAfter: 120, line: F4_LINE }),
    fp('(Tempelkan / sisipkan foto GPS Map Camera di sini)', {
      italic: true,
      align: AlignmentType.CENTER,
      size: 20,
      spaceBefore: Math.round(opts.placeholderHeightTwips * 0.35),
      spaceAfter: Math.round(opts.placeholderHeightTwips * 0.45),
      line: F4_LINE,
    }),
  ];
}

function buildGeotaggingPages(params: {
  record: BerkasRecord;
  titlePrefix: string;
  includePolygonCoords?: boolean;
}): Array<Paragraph | Table> {
  const na = params.record.non_akta;
  const sert = getSertipikatInfo(params.record);
  const shmLabel = sert.isDigital
    ? `NIBEL ${sert.nibClean}`
    : `SHM NO. ${sert.noHakClean}`;
  const halfW = Math.floor(F4_CONTENT_WIDTH_DXA / 2);

  const polygonLines = (na?.koordinat_poligon || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out: Array<Paragraph | Table> = [
    fp(`${params.titlePrefix} ${shmLabel} ${sert.desa.toUpperCase()}`, {
      pageBreakBefore: true,
      bold: true,
      align: AlignmentType.LEFT,
      spaceAfter: 60,
      line: F4_LINE,
    }),
  ];

  if (na?.link_maps?.trim()) {
    out.push(
      new Paragraph({
        spacing: { before: 0, after: 40, line: F4_LINE, lineRule: LineRuleType.AUTO },
        children: [
          new TextRun({
            text: na.link_maps.trim(),
            underline: {},
            color: '1D4ED8',
            size: 20,
            font: F4_FONT,
          }),
        ],
      })
    );
  }
  if (na?.koordinat_gps?.trim()) {
    out.push(
      fp(`Koordinat GPS Lokasi : ${na.koordinat_gps.trim()}`, {
        size: 20,
        spaceAfter: 60,
        line: F4_LINE,
      })
    );
  }
  if (params.includePolygonCoords && polygonLines.length > 0) {
    out.push(
      fp('Titik Koordinat Sudut Poligon Bidang Tanah :', {
        bold: true,
        size: 20,
        spaceBefore: 40,
        spaceAfter: 20,
        line: F4_LINE,
      })
    );
    polygonLines.forEach((coord, idx) => {
      const letter = String.fromCharCode(97 + idx);
      const hasPrefix = /^[a-z]\.\s/i.test(coord);
      out.push(
        fp(hasPrefix ? coord : `${letter}. ${coord}`, {
          indentLeft: 320,
          size: 20,
          spaceAfter: 10,
          line: F4_LINE,
        })
      );
    });
  }

  out.push(
    fp('TAMPAK DEPAN', {
      bold: true,
      align: AlignmentType.CENTER,
      spaceBefore: 80,
      spaceAfter: 60,
      line: F4_LINE,
    }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [F4_CONTENT_WIDTH_DXA],
      layout: TableLayoutType.FIXED,
      borders: THIN_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: buildPhotoCellChildren('FOTO TAMPAK DEPAN BIDANG', na?.foto_tampak_depan, {
                widthPx: 420,
                heightPx: 260,
                placeholderHeightTwips: 2400,
              }),
            }),
          ],
        }),
      ],
    }),
    fp('', { spaceBefore: 0, spaceAfter: 80, line: 160 }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, F4_CONTENT_WIDTH_DXA - halfW],
      layout: TableLayoutType.FIXED,
      borders: THIN_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: buildPhotoCellChildren('1', na?.foto_patok_1, {
                widthPx: 235,
                heightPx: 220,
                placeholderHeightTwips: 2100,
              }),
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - halfW, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: buildPhotoCellChildren('2', na?.foto_patok_2, {
                widthPx: 235,
                heightPx: 220,
                placeholderHeightTwips: 2100,
              }),
            }),
          ],
        }),
      ],
    }),

    // Halaman Geotagging Lanjutan: Patok 3 & 4 + Poligon
    fp('', { pageBreakBefore: true, spaceAfter: 40, line: 120 }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, F4_CONTENT_WIDTH_DXA - halfW],
      layout: TableLayoutType.FIXED,
      borders: THIN_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: buildPhotoCellChildren('3', na?.foto_patok_3, {
                widthPx: 235,
                heightPx: 220,
                placeholderHeightTwips: 2100,
              }),
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - halfW, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: buildPhotoCellChildren('4', na?.foto_patok_4, {
                widthPx: 235,
                heightPx: 220,
                placeholderHeightTwips: 2100,
              }),
            }),
          ],
        }),
      ],
    }),
    fp('poligon', {
      bold: true,
      align: AlignmentType.CENTER,
      spaceBefore: 160,
      spaceAfter: 80,
      line: F4_LINE,
    }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [F4_CONTENT_WIDTH_DXA],
      layout: TableLayoutType.FIXED,
      borders: THIN_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: buildPhotoCellChildren('CITRA SATELIT / POLIGON BIDANG TANAH', na?.foto_poligon, {
                widthPx: 430,
                heightPx: 280,
                placeholderHeightTwips: 2800,
              }),
            }),
          ],
        }),
      ],
    })
  );

  return out;
}

function buildPengecekanSertipikatBundle(
  record: BerkasRecord,
  settings: OfficeSettings
): Array<Paragraph | Table> {
  const parties = collectNonAktaParties(record);
  const pemohon = parties[0];
  const na = record.non_akta;
  const sert = getSertipikatInfo(record);
  const docDate = resolveNonAktaDocDate(record);
  const kotaKabupaten = (sert.kabupaten || settings.nama_kabupaten || '')
    .replace(/^Kabupaten\s+/i, '')
    .trim() || '-';
  const kecClean = (settings.nama_kecamatan || sert.kecamatan || '')
    .replace(/^Kecamatan\s+/i, '')
    .trim();

  const isPpatsMode = (na?.pengecekan_kuasa_mode ?? 'ppats') === 'ppats';
  const kuasaBpn = resolvePersonCtx(
    record.akta.nama_kuasa_bpn || settings.daftar_kuasa_bpn[0] || '-',
    settings.profil_kuasa,
    record.akta.kuasa_bpn_detail
  );

  const penerima = isPpatsMode
    ? {
        nama: record.akta.nama_ppats || settings.nama_ppats || '-',
        ttl: na?.ppats_ttl?.trim() || formatPpatsTtl(settings) || '-',
        pekerjaan: na?.ppats_pekerjaan?.trim() || `Camat ${kecClean || '-'} / PPATS`,
        nik: na?.ppats_nik?.trim() || settings.nik_ppats?.trim() || '-',
        alamatSingkat:
          na?.ppats_alamat?.trim() ||
          settings.alamat_ppats?.trim() ||
          settings.alamat_kantor ||
          '-',
        nip: record.akta.nip_ppats || settings.nip_ppats || '-',
      }
    : {
        nama: kuasaBpn.nama,
        ttl: kuasaBpn.ttl,
        pekerjaan: kuasaBpn.pekerjaan,
        nik: kuasaBpn.nik,
        alamatSingkat: kuasaBpn.alamatSingkat,
        nip: '',
      };

  const tanggalSlash = docDate.tanggalDash
    ? docDate.tanggalDash.replace(/-/g, '/')
    : '......................';

  const leftPermohonan: Array<[number, string]> = [
    [1, 'Pengukuran'],
    [2, 'Konversi / Pendaftaran Hak'],
    [3, 'Pendaftaran Hak Milik Sarusun'],
    [4, 'Pendaftaran Tanah Wakaf'],
    [5, 'Pendaftaran Peralihan Hak'],
    [6, 'Pendaftaran Pemindahan Hak'],
    [7, 'Pendaftaran Perubahan Hak'],
  ];
  const rightPermohonan: Array<[number, string]> = [
    [8, 'Pemecahan/Penggabungan Hak'],
    [9, 'Pendaftaran Hak Tanggungan'],
    [10, 'Roya atas Hak Tanggungan'],
    [11, 'Penerbitan Sertipikat Pengganti'],
    [12, 'Surat Keterangan Pendaftaran Tanah'],
    [13, 'Pengecekan Sertipikat'],
    [14, 'ALIH MEDIA'],
  ];

  const halfW = Math.floor(F4_CONTENT_WIDTH_DXA / 2);

  return [
    // HAL. 1 — PERMOHONAN PENGECEKAN SERTIPIKAT
    fp('Kepada Yth.', { indentLeft: 4400, spaceAfter: 0, line: 245 }),
    fp('Kantor Kementerian Agraria dan Tata Ruang/', { indentLeft: 4400, spaceAfter: 0, line: 245 }),
    fp(`Badan Pertanahan Nasional ${sert.kabupaten}`, { indentLeft: 4400, spaceAfter: 0, line: 245 }),
    fp(`di ${kotaKabupaten}`, { indentLeft: 4400, spaceAfter: 160, line: 245 }),

    fp('Dengan Hormat,', { spaceAfter: 20, line: 245 }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 40, line: 245 }),
    kvTable(
      [
        ['Nama', penerima.nama],
        ['Tempat/Tgl.lahir', penerima.ttl],
        ['Pekerjaan', penerima.pekerjaan],
        ['Nomor KTP', penerima.nik],
        ['Alamat', penerima.alamatSingkat],
      ],
      { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: 240 }
    ),

    fp('Dalam hal ini bertindak untuk dan atas nama diri sendiri / selaku kuasa dari :', {
      spaceBefore: 100,
      spaceAfter: 40,
      line: 245,
    }),
    ...buildNumberedPartiesKvBlocks(parties, { shortAddress: true, spaceAfterRow: 0 }),

    fp(
      `Berdasarkan surat kuasa   Nomor : .....................   Tanggal : ${tanggalSlash}`,
      { spaceBefore: 80, spaceAfter: 20, line: 245 }
    ),
    fp('Dengan ini mengajukan permohonan :', { spaceAfter: 40, line: F4_LINE }),

    buildTwoColListTable(
      leftPermohonan.map(([lNum, lText], idx) => {
        const [rNum, rText] = rightPermohonan[idx];
        return {
          leftText: `${lNum}. ${lText}`,
          rightText: `${rNum}. ${rText}`,
          leftBold: false,
          rightBold: rNum === 13,
          rightUnderline: rNum === 13,
        };
      }),
      {
        leftPct: 48,
        indentTwips: 240,
        line: F4_LINE,
        spaceAfter: 20,
        hangingTwips: 340,
      }
    ),

    fp('Atas bidang tanah Hak :', { spaceBefore: 120, spaceAfter: 10, line: F4_LINE }),
    fp('Terletak di', { indentLeft: 420, spaceAfter: 10, line: F4_LINE }),
    kvTable(
      [
        ['Desa', sert.desa],
        ['Kecamatan', sert.kecamatan],
        ['Kabupaten', kotaKabupaten],
        [
          sert.isDigital ? 'Nibel' : `Nomor ${sert.jenisHak}`,
          sert.isDigital ? sert.nibClean : `${sert.noHakClean}`,
        ],
      ],
      { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: F4_LINE }
    ),

    fp('Untuk melengkapi permohonan dimaksud, bersama ini kami lampirkan :', {
      spaceBefore: 120,
      spaceAfter: 40,
      line: F4_LINE,
    }),
    fp('1. Fotokopi KTP', { indentLeft: 420, spaceAfter: 20, line: F4_LINE }),
    fp('2. Fotokopi/Sertipikat asli', { indentLeft: 420, spaceAfter: 20, line: F4_LINE }),
    fp('3. Surat Kuasa', { indentLeft: 420, spaceAfter: 80, line: F4_LINE }),

    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4190, F4_CONTENT_WIDTH_DXA - 4190],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4190, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('', { spaceAfter: 0 })],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4190, type: WidthType.DXA },
              borders: NO_BORDER,
              children: isPpatsMode
                ? [
                    fp('Hormat Kami,', { align: AlignmentType.CENTER, spaceAfter: 0, line: F4_LINE }),
                    fp('Pejabat Pembuat Akta Tanah Sementara', {
                      align: AlignmentType.CENTER,
                      spaceAfter: 0,
                      line: F4_LINE,
                    }),
                    fp(`Camat ${kecClean || '-'}`, {
                      align: AlignmentType.CENTER,
                      spaceAfter: SIGNATURE_SPACE_STANDARD,
                      line: F4_LINE,
                    }),
                    fp(penerima.nama, {
                      bold: true,
                      underline: true,
                      align: AlignmentType.CENTER,
                      spaceAfter: 0,
                      line: F4_LINE,
                    }),
                    ...(penerima.nip && penerima.nip !== '-'
                      ? [fp(`NIP. ${penerima.nip}`, { align: AlignmentType.CENTER, spaceAfter: 20, line: F4_LINE })]
                      : []),
                  ]
                : [
                    fp('Hormat Kami,', {
                      align: AlignmentType.CENTER,
                      spaceAfter: SIGNATURE_SPACE_METERAI,
                      line: F4_LINE,
                    }),
                    fp(`${penerima.nama} QQ ${pemohon.nama}`, {
                      bold: true,
                      underline: true,
                      align: AlignmentType.CENTER,
                      spaceAfter: 20,
                      line: F4_LINE,
                    }),
                  ],
            }),
          ],
        }),
      ],
    }),

    // HAL. 2 — SURAT KUASA PENGECEKAN SERTIPIKAT
    fp('SURAT KUASA', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 160,
      line: F4_LINE,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 40, line: F4_LINE }),
    ...buildNumberedPartiesKvBlocks(parties, { spaceAfterRow: 0 }),
    fp('Dengan ini memberi kuasa Substitusi kepada :', { spaceBefore: 100, spaceAfter: 40, line: F4_LINE }),
    kvTable(
      [
        ['Nama', penerima.nama],
        ['Tempat/Tgl.lahir', penerima.ttl],
        ['Pekerjaan', penerima.pekerjaan],
        ['Nomor KTP', penerima.nik],
        ['Alamat', penerima.alamatSingkat],
      ],
      { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: F4_LINE }
    ),
    aktaCenteredDashHeading('KHUSUS', {
      bold: true,
      underline: true,
      size: F4_SIZE,
      font: F4_FONT,
      spaceBefore: 120,
      spaceAfter: 80,
      line: F4_LINE,
      contentWidthDxa: F4_CONTENT_WIDTH_DXA,
    }),
    fp(
      `•  Untuk dan atas nama pemberi Kuasa mendaftarkan Pengecekan Sertipikat ke Kantor BPN ${sert.kabupaten}.`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 220, spaceAfter: 40, line: F4_LINE }
    ),
    fp(
      `1. Sehubungan dengan Sertipikat atas tanah ${sert.jenisHak} ${sert.ringkas}${sert.suInfo} Atas nama : ${sert.pemegangHak} Luas ± ${sert.luasStr} M2 yang terletak di Desa ${sert.desa}, Kecamatan ${sert.kecamatan}, ${sert.kabupaten}.`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 640, hanging: 260, spaceAfter: 40, line: F4_LINE }
    ),
    fp(
      `•  Guna keperluan tersebut penerima kuasa berhak menghadap kepada pegawai Kantor BPN ${sert.kabupaten} yang berwenang, membayar biaya pendaftaran, menandatangani surat-surat yang diperlukan dalam permohonan tersebut serta mengambil sertipikat di Kantor BPN ${sert.kabupaten}.`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 220, spaceAfter: 80, line: F4_LINE }
    ),
    fp('Demikian Kuasa ini diberikan untuk dapat dipergunakan sebagaimana mestinya.', {
      spaceAfter: 180,
      line: F4_LINE,
    }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, F4_CONTENT_WIDTH_DXA - halfW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: isPpatsMode
                ? [
                    fp('Penerima Kuasa', { align: AlignmentType.CENTER, spaceAfter: 0, line: F4_LINE }),
                    fp('Pejabat Pembuat Akta Tanah Sementara', {
                      align: AlignmentType.CENTER,
                      spaceAfter: 0,
                      line: F4_LINE,
                    }),
                    fp(`Camat ${kecClean || '-'}`, {
                      align: AlignmentType.CENTER,
                      spaceAfter: SIGNATURE_SPACE_METERAI,
                      line: F4_LINE,
                    }),
                    fp(penerima.nama, {
                      bold: true,
                      underline: true,
                      align: AlignmentType.CENTER,
                      spaceAfter: 0,
                      line: F4_LINE,
                    }),
                    ...(penerima.nip && penerima.nip !== '-'
                      ? [fp(`NIP. ${penerima.nip}`, { align: AlignmentType.CENTER, spaceAfter: 20, line: F4_LINE })]
                      : []),
                  ]
                : [
                    fp(' ', { align: AlignmentType.CENTER, spaceAfter: 0, line: F4_LINE }),
                    fp('Penerima Kuasa', {
                      align: AlignmentType.CENTER,
                      spaceAfter: SIGNATURE_SPACE_METERAI,
                      line: F4_LINE,
                    }),
                    fp(penerima.nama, {
                      bold: true,
                      underline: true,
                      align: AlignmentType.CENTER,
                      spaceAfter: 20,
                      line: F4_LINE,
                    }),
                  ],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp(`${kotaKabupaten}, ${tanggalSlash}`, {
                  align: AlignmentType.CENTER,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp(parties.length > 1 ? 'Para Pemberi Kuasa' : 'Pemberi Kuasa', {
                  align: AlignmentType.CENTER,
                  spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                ...buildNumberedSignerLines(parties, 220),
              ],
            }),
          ],
        }),
      ],
    }),

    // HAL. 3 — SURAT PERNYATAAN PERTANGGUNGJAWABAN KEABSAHAN DAN KEBENARAN DOKUMEN
    fp('SURAT PERNYATAAN PERTANGGUNGJAWABAN KEABSAHAN DAN KEBENARAN DOKUMEN', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 180,
      line: F4_LINE,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 40, line: F4_LINE }),
    ...buildNumberedPartiesKvBlocks(parties, { spaceAfterRow: 0 }),
    fp(`Sehubungan dengan Sertipikat atas tanah ${sert.jenisHak} :`, {
      spaceBefore: 120,
      spaceAfter: 40,
      line: F4_LINE,
    }),
    kvTable(
      [
        [sert.labelNo, sert.nilaiNo],
        ['Desa', sert.desa],
        ['Kecamatan', sert.kecamatan],
        ['Kabupaten', sert.kabupaten],
      ],
      { indentTwips: 540, labelPct: 28, spaceAfterRow: 0, line: F4_LINE }
    ),
    fp(
      'Selaku pemohon pelayanan Online, dengan ini menyatakan bahwa dokumen yang saya unggah ke sistem elektronik adalah benar dan telah sesuai dokumen asli. Saya bertanggung jawab penuh atas keabsahan dan kebenaran isi dokumen secara formil maupun materiil, dan apabila dikemudian hari terdapat permasalahan, saya bersedia menerima dampak hukum baik perdata maupun pidana sesuai ketentuan peraturan perundang-undangan.',
      { align: AlignmentType.JUSTIFIED, spaceBefore: 140, spaceAfter: 200, line: F4_LINE_AIRY }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4500, F4_CONTENT_WIDTH_DXA - 4500],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4500, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('', { spaceAfter: 0 })],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4500, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp(`${kotaKabupaten}, ${tanggalSlash}`, {
                  align: AlignmentType.CENTER,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp('Yang Menyatakan', {
                  align: AlignmentType.CENTER,
                  spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                ...buildNumberedSignerLines(parties, 220),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
}

function buildValidasiSertipikatBundle(
  record: BerkasRecord,
  settings: OfficeSettings
): Array<Paragraph | Table> {
  const parties = collectNonAktaParties(record);
  const pemohon = parties[0];
  const kuasa = resolvePersonCtx(
    record.akta.nama_kuasa_bpn || settings.daftar_kuasa_bpn[0] || '-',
    settings.profil_kuasa,
    record.akta.kuasa_bpn_detail
  );
  const sert = getSertipikatInfo(record);
  const docDate = resolveNonAktaDocDate(record);
  const kotaKabupaten = (sert.kabupaten || settings.nama_kabupaten || '')
    .replace(/^Kabupaten\s+/i, '')
    .trim() || '-';

  const leftPermohonan: Array<[number, string]> = [
    [1, 'Pengukuran'],
    [2, 'Konversi / Pendaftaran Hak'],
    [3, 'Pendaftaran Hak Milik Sarusun'],
    [4, 'Pendaftaran Tanah Wakaf'],
    [5, 'Pendaftaran Peralihan Hak'],
    [6, 'Pendaftaran Pemindahan Hak'],
    [7, 'Pendaftaran Perubahan Hak'],
  ];
  const rightPermohonan: Array<[number, string]> = [
    [8, 'Pemecahan/Penggabungan Hak'],
    [9, 'Pendaftaran Hak Tanggungan'],
    [10, 'Roya atas Hak Tanggungan'],
    [11, 'Penerbitan Sertipikat Pengganti'],
    [12, 'Surat Keterangan Pendaftaran Tanah'],
    [13, 'Pengecekan Sertipikat'],
    [14, 'Validasi/Verifikasi'],
  ];
  const qqLine =
    parties.length === 1
      ? `${kuasa.nama}, qq. ${pemohon.nama}`
      : `${kuasa.nama}, qq. ${parties.map((p) => `${p.no}. ${p.nama}`).join(', ')}`;
  const halfW = Math.floor(F4_CONTENT_WIDTH_DXA / 2);

  return [
    // HAL. 1 — PERMOHONAN VALIDASI / VERIFIKASI SERTIPIKAT
    fp('Kepada Yth.', { indentLeft: 4400, spaceAfter: 0, line: 245 }),
    fp('Kantor Kementerian Agraria dan Tata Ruang/', { indentLeft: 4400, spaceAfter: 0, line: 245 }),
    fp(`Badan Pertanahan Nasional ${sert.kabupaten}`, { indentLeft: 4400, spaceAfter: 0, line: 245 }),
    fp(`di ${kotaKabupaten}`, { indentLeft: 4400, spaceAfter: 160, line: 245 }),

    fp('Dengan Hormat,', { spaceAfter: 20, line: 245 }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 40, line: 245 }),
    kvTable(
      [
        ['Nama', kuasa.nama],
        ['Tempat/Tgl.lahir', kuasa.ttl],
        ['Pekerjaan', kuasa.pekerjaan],
        ['Nomor KTP', kuasa.nik],
        ['Alamat', kuasa.alamatSingkat],
      ],
      { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: 240 }
    ),

    fp('Dalam hal ini bertindak untuk selaku kuasa dari :', {
      spaceBefore: 100,
      spaceAfter: 40,
      line: 245,
    }),
    ...buildNumberedPartiesKvBlocks(parties, { shortAddress: true, spaceAfterRow: 0 }),

    fp(`Berdasarkan surat kuasa Tanggal : ${docDate.tanggalText}`, {
      spaceBefore: 80,
      spaceAfter: 20,
      line: 245,
    }),
    fp('Dengan ini mengajukan permohonan :', { spaceAfter: 40, line: F4_LINE }),

    buildTwoColListTable(
      leftPermohonan.map(([lNum, lText], idx) => {
        const [rNum, rText] = rightPermohonan[idx];
        return {
          leftText: `${lNum}. ${lText}`,
          rightText: `${rNum}. ${rText}`,
          leftBold: false,
          rightBold: rNum === 14,
          rightUnderline: rNum === 14,
        };
      }),
      {
        leftPct: 48,
        indentTwips: 240,
        line: F4_LINE,
        spaceAfter: 20,
        hangingTwips: 340,
      }
    ),

    fp(`Atas bidang tanah ${sert.jenisHak} :`, { spaceBefore: 120, spaceAfter: 10, line: F4_LINE }),
    fp('Terletak di', { indentLeft: 420, spaceAfter: 10, line: F4_LINE }),
    kvTable(
      [
        ['Desa', sert.desa],
        ['Kecamatan', sert.kecamatan],
        ['Kabupaten', kotaKabupaten],
        [
          sert.isDigital ? 'Nibel' : 'SHM Nomor',
          sert.isDigital ? sert.nibClean : sert.noHakClean,
        ],
      ],
      { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: F4_LINE }
    ),

    fp('Untuk melengkapi permohonan dimaksud, bersama ini kami lampirkan :', {
      spaceBefore: 120,
      spaceAfter: 40,
      line: F4_LINE,
    }),
    fp('1. FC KTP Sesuai Sertipikat', { indentLeft: 420, spaceAfter: 20, line: F4_LINE }),
    fp('2. Surat Kuasa', { indentLeft: 420, spaceAfter: 20, line: F4_LINE }),
    fp('3. FC KTP Penerima Kuasa', { indentLeft: 420, spaceAfter: 20, line: F4_LINE }),
    fp('4. Fotokopi Sertipikat', { indentLeft: 420, spaceAfter: 20, line: F4_LINE }),
    fp('5. Foto GPS Map Camera', { indentLeft: 420, spaceAfter: 80, line: F4_LINE }),

    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [
        parties.length >= 4 ? 3600 : 4190,
        F4_CONTENT_WIDTH_DXA - (parties.length >= 4 ? 3600 : 4190),
      ],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: parties.length >= 4 ? 3600 : 4190, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('', { spaceAfter: 0 })],
            }),
            new TableCell({
              width: {
                size: F4_CONTENT_WIDTH_DXA - (parties.length >= 4 ? 3600 : 4190),
                type: WidthType.DXA,
              },
              borders: NO_BORDER,
              children: [
                fp('Hormat Kami,', {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                fp(qqLine, {
                  bold: true,
                  underline: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 20,
                  line: F4_LINE,
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // HAL. 2 — SURAT KUASA VALIDASI HAK SERTIPIKAT
    fp('SURAT KUASA', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 160,
      line: F4_LINE,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 40, line: F4_LINE }),
    ...buildNumberedPartiesKvBlocks(parties, { spaceAfterRow: 0 }),
    fp(`Sehubungan dengan Sertipikat atas tanah ${sert.jenisHak} :`, {
      spaceBefore: 100,
      spaceAfter: 40,
      line: F4_LINE,
    }),
    kvTable(
      [
        [sert.isDigital ? 'Nibel' : 'SHM Nomor', sert.isDigital ? sert.nibClean : sert.noHakClean],
        ['Desa', sert.desa],
        ['Kecamatan', sert.kecamatan],
        ['Kabupaten', sert.kabupaten],
      ],
      { indentTwips: 540, labelPct: 28, spaceAfterRow: 0, line: F4_LINE }
    ),
    fp('Maka dengan ini memberi kuasa Substitusi kepada :', {
      spaceBefore: 100,
      spaceAfter: 40,
      line: F4_LINE,
    }),
    kvTable(
      [
        ['Nama', kuasa.nama],
        ['Tempat/Tgl.lahir', kuasa.ttl],
        ['Pekerjaan', kuasa.pekerjaan],
        ['Nomor KTP', kuasa.nik],
        ['Alamat', kuasa.alamatSingkat],
      ],
      { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: F4_LINE }
    ),
    aktaCenteredDashHeading('KHUSUS', {
      bold: true,
      underline: true,
      size: F4_SIZE,
      font: F4_FONT,
      spaceBefore: 120,
      spaceAfter: 80,
      line: F4_LINE,
      contentWidthDxa: F4_CONTENT_WIDTH_DXA,
    }),
    fp(
      `-  Untuk dan atas nama pemberi Kuasa untuk mendaftarkan permohonan Validasi Hak Sertipikat ke Kantor Badan Pertanahan ${sert.kabupaten}.`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 220, spaceAfter: 40, line: F4_LINE }
    ),
    fp(
      '-  Guna keperluan tersebut penerima kuasa berhak menghadap kepada pegawai Kantor Pertanahan yang berwenang, membayar biaya pendaftaran, menandatangani surat-surat yang diperlukan dalam permohonan pendaftaran tersebut serta mengambil sertipikat tanah kelak di kemudian hari setelah selesai.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 220, spaceAfter: 80, line: F4_LINE }
    ),
    fp('Demikian kuasa ini diberikan untuk dapat dipergunakan sebagaimana mestinya.', {
      spaceAfter: 180,
      line: F4_LINE,
    }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, F4_CONTENT_WIDTH_DXA - halfW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: [
                fp(' ', { align: AlignmentType.CENTER, spaceAfter: 0, line: F4_LINE }),
                fp('Penerima Kuasa', {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                fp(kuasa.nama, {
                  bold: true,
                  underline: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 20,
                  line: F4_LINE,
                }),
              ],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
                  align: AlignmentType.CENTER,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp(parties.length > 1 ? 'Para Pemberi Kuasa' : 'Pemberi Kuasa', {
                  align: AlignmentType.CENTER,
                  spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                ...buildNumberedSignerLines(parties, 220),
              ],
            }),
          ],
        }),
      ],
    }),

    // HAL. 3 & 4 — GEOTAGGING (TAMPAK DEPAN, PATOK 1-4 & POLIGON)
    ...buildGeotaggingPages({
      record,
      titlePrefix: 'GEOTAGGING',
      includePolygonCoords: false,
    }),
  ];
}

function buildAnalisisBidangBundle(
  record: BerkasRecord,
  settings: OfficeSettings
): Array<Paragraph | Table> {
  const na = record.non_akta;
  const parties = collectNonAktaParties(record);
  const pemohon = parties[0];
  const kuasa = resolvePersonCtx(
    record.akta.nama_kuasa_bpn || settings.daftar_kuasa_bpn[0] || '-',
    settings.profil_kuasa,
    record.akta.kuasa_bpn_detail
  );
  const saksi1 = resolvePersonCtx(
    record.akta.saksi_1 || settings.daftar_saksi[0] || '-',
    settings.profil_saksi,
    record.akta.saksi_1_detail
  );
  const saksi2 = resolvePersonCtx(
    record.akta.saksi_2 || settings.daftar_saksi[1] || '-',
    settings.profil_saksi,
    record.akta.saksi_2_detail
  );
  const pengesahan = resolvePengesahanTunggal(record, settings);
  const sert = getSertipikatInfo(record);
  const docDate = resolveNonAktaDocDate(record);
  const cfg = resolveAnalisisBidangConfig(record);

  const kotaKabupaten =
    (sert.kabupaten || settings.nama_kabupaten || '')
      .replace(/^Kabupaten\s+/i, '')
      .trim() || '-';
  const kabLengkap = /^Kabupaten\s+/i.test(sert.kabupaten || '')
    ? sert.kabupaten
    : `Kabupaten ${kotaKabupaten}`;
  const nomorSertipikatRingkas = sert.isDigital ? sert.nibClean : sert.noHakClean;
  const singkatanHak =
    /hak\s+milik/i.test(sert.jenisHak)
      ? 'HM'
      : /guna\s+bangunan/i.test(sert.jenisHak)
      ? 'HGB'
      : /pakai/i.test(sert.jenisHak)
      ? 'HP'
      : sert.jenisHak;
  const namaSertipikatLengkap = /hak\s+milik/i.test(sert.jenisHak)
    ? 'Sertifikat Hak Milik (SHM)'
    : `Sertifikat ${sert.jenisHak}`;

  const halfW = Math.floor(F4_CONTENT_WIDTH_DXA / 2);
  const formatAlamatAnalisis = (rawAlamat: string) =>
    rawAlamat.replace(/\bRt\./gi, 'RT.').replace(/\/(\d)/g, '/RW.$1');

  const kuasaAlamatDisplay = formatAlamatAnalisis(kuasa.alamatSingkat);
  const pemohonAlamatDisplay = formatAlamatAnalisis(pemohon.alamatSingkat);

  // Build Hal. 1 party identity rows (supports 1 or multiple pemohon cleanly)
  const pemohonPermohonanRows: Array<{
    label: string;
    valueText?: string;
    boldValue?: boolean;
  }> = [];
  parties.forEach((p, idx) => {
    const prefix = parties.length > 1 ? `${idx + 1}. ` : '';
    pemohonPermohonanRows.push(
      { label: `${prefix}Nama`, valueText: p.nama, boldValue: true },
      { label: 'NIK', valueText: p.nik },
      { label: 'Alamat', valueText: formatAlamatAnalisis(p.alamatSingkat) }
    );
  });
  pemohonPermohonanRows.push({ label: 'Nomor HP', valueText: cfg.nomorHp });

  // Build Hal. 2 Pemberi Kuasa rows
  const pemberiKuasaRows: Array<{
    label: string;
    valueText?: string;
    boldValue?: boolean;
  }> = [];
  parties.forEach((p, idx) => {
    const prefix = parties.length > 1 ? `${idx + 1}. ` : '';
    pemberiKuasaRows.push(
      { label: `${prefix}Nama`, valueText: p.nama, boldValue: true },
      { label: 'NIK', valueText: p.nik },
      { label: 'Tempat/tgl lahir', valueText: p.ttl },
      { label: 'Pekerjaan', valueText: p.pekerjaan },
      { label: 'Alamat', valueText: formatAlamatAnalisis(p.alamatSingkat) }
    );
  });

  // Build Hal. 3 Sket drawing frame (left box + right compass U)
  const sketLeftW = Math.round(F4_CONTENT_WIDTH_DXA * 0.86);
  const sketRightW = F4_CONTENT_WIDTH_DXA - sketLeftW;
  const decodedSket = decodeDataUrlToImage(na?.foto_sket_pecah);
  const sketBoxChildren: Paragraph[] = decodedSket
    ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 80, line: F4_LINE, lineRule: LineRuleType.AUTO },
          children: [
            new ImageRun({
              data: decodedSket.bytes,
              type: decodedSket.type,
              transformation: { width: 420, height: 255 },
            }),
          ],
        }),
      ]
    : Array.from({ length: 11 }, () =>
        fp('\u00A0', { spaceBefore: 0, spaceAfter: 100, line: F4_LINE })
      );

  // Build Hal. 3 Keterangan 3-column table
  const colPenggunaanW = Math.round(F4_CONTENT_WIDTH_DXA * 0.42);
  const colLuasW = Math.round(F4_CONTENT_WIDTH_DXA * 0.14);
  const colAlasanW = F4_CONTENT_WIDTH_DXA - colPenggunaanW - colLuasW;

  const blocks: Array<Paragraph | Table> = [
    // =========================================================================
    // HAL. 1 — PERMOHONAN LAYANAN PETA ANALISIS PENATAGUNAAN TANAH (PDF Hal. 3)
    // =========================================================================
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [5400, F4_CONTENT_WIDTH_DXA - 5400],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 5400, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: [
                fp('', { spaceAfter: 60, line: F4_LINE }),
                fpRuns(
                  [
                    { text: 'Perihal\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0: ' },
                    { text: 'Permohonan Layanan Peta Analisis Penatagunaan Tanah' },
                  ],
                  { indentLeft: 1320, hanging: 1320, spaceAfter: 40, line: F4_LINE }
                ),
              ],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 5400, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 160, right: 0 },
              children: [
                fp('Kepada :', { spaceAfter: 0, line: 245 }),
                fp('Yth. Kepala Kantor', { spaceAfter: 0, line: 245 }),
                fp(`Pertanahan ${kabLengkap}`, { spaceAfter: 0, line: 245 }),
                fp('Di', { spaceAfter: 0, line: 245 }),
                fp(kotaKabupaten.toUpperCase(), {
                  bold: true,
                  indentLeft: 720,
                  spaceAfter: 60,
                  line: 245,
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    fp('Yang bertanda tangan di bawah ini :', {
      spaceBefore: 80,
      spaceAfter: 60,
      line: F4_LINE,
    }),
    kvAlignedTable(
      [
        { label: 'Nama', valueText: kuasa.nama, boldValue: true },
        { label: 'NIK', valueText: kuasa.nik },
        { label: 'Alamat', valueText: kuasaAlamatDisplay },
      ],
      { labelPct: 26, indentTwips: 0, spaceAfterRow: 20, line: F4_LINE }
    ),

    fp('Bertindak untuk dan atas nama / selaku kuasa dari:', {
      spaceBefore: 100,
      spaceAfter: 60,
      line: F4_LINE,
    }),
    kvAlignedTable(pemohonPermohonanRows, {
      labelPct: 26,
      indentTwips: 0,
      spaceAfterRow: 20,
      line: F4_LINE,
    }),

    fp(
      `Dengan ini mengajukan Permohonan layanan peta ${cfg.temaAnalisis.replace(
        /^Kesesuaian Penggunaan Tanah/i,
        'kesesuaian penggunaan tanah'
      )}`,
      { align: AlignmentType.JUSTIFIED, spaceBefore: 120, spaceAfter: 120, line: F4_LINE }
    ),

    fp('KETERANGAN TENTANG TANAH YANG DIMOHON', {
      align: AlignmentType.CENTER,
      spaceBefore: 40,
      spaceAfter: 100,
      line: F4_LINE,
    }),

    kvAlignedTable(
      [
        { label: 'Atas Sertifikat', valueText: '', noColon: true },
        {
          label: sert.isDigital ? 'NIB / Nomor Hak' : 'Nomor Hak No',
          valueText: `${nomorSertipikatRingkas}, Luas : ${sert.luasStr} M², atas nama ${sert.pemegangHak}`,
        },
        { label: 'terletak di', valueText: '', noColon: true },
        { label: 'Desa/Kelurahan', valueText: sert.desa },
        { label: 'Kecamatan', valueText: sert.kecamatan },
        { label: 'Kabupaten', valueText: kotaKabupaten },
        { label: ' ', valueText: '', noColon: true },
        { label: 'Titik Koordinat', valueText: na?.koordinat_gps?.trim() || '' },
        { label: 'Tema Analisis Penatagunaan Tanah', valueText: cfg.temaAnalisis },
      ],
      { labelPct: 26, indentTwips: 0, spaceAfterRow: 10, line: F4_LINE }
    ),

    // Spacer paragraph so adjacent tables never occur
    fp('', { spaceBefore: 0, spaceAfter: 20, line: 120 }),

    // Format Peta row (matching PDF Hal. 3 two-column format)
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [
        Math.round((F4_CONTENT_WIDTH_DXA - 240) * 0.26),
        240,
        Math.round((F4_CONTENT_WIDTH_DXA - 240) * 0.40),
        F4_CONTENT_WIDTH_DXA -
          240 -
          Math.round((F4_CONTENT_WIDTH_DXA - 240) * 0.26) -
          Math.round((F4_CONTENT_WIDTH_DXA - 240) * 0.40),
      ],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: Math.round((F4_CONTENT_WIDTH_DXA - 240) * 0.26), type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('Format Peta', { spaceAfter: 10, line: F4_LINE })],
            }),
            new TableCell({
              width: { size: 240, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp(':', { spaceAfter: 10, line: F4_LINE })],
            }),
            new TableCell({
              width: { size: Math.round((F4_CONTENT_WIDTH_DXA - 240) * 0.40), type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp('1. Non-Multimedia', { spaceAfter: 0, line: F4_LINE }),
                fp('(Berwarna)', { indentLeft: 280, spaceAfter: 10, line: F4_LINE }),
                fp('•  Ukuran A4', { indentLeft: 280, spaceAfter: 10, line: F4_LINE }),
              ],
            }),
            new TableCell({
              width: {
                size:
                  F4_CONTENT_WIDTH_DXA -
                  240 -
                  Math.round((F4_CONTENT_WIDTH_DXA - 240) * 0.26) -
                  Math.round((F4_CONTENT_WIDTH_DXA - 240) * 0.40),
                type: WidthType.DXA,
              },
              borders: NO_BORDER,
              children: [
                fp('2. Multimedia', { spaceAfter: 0, line: F4_LINE }),
                fp(`Skala ${cfg.skalaPeta}`, { indentLeft: 280, spaceAfter: 10, line: F4_LINE }),
              ],
            }),
          ],
        }),
      ],
    }),

    fp('Untuk melengkapi permohonan dimaksud, bersama ini kami lampirkan :', {
      spaceBefore: 120,
      spaceAfter: 40,
      line: F4_LINE,
    }),
    fp('1.  Fotocopy KTP & KK Pemegang Hak', { indentLeft: 420, hanging: 300, spaceAfter: 15, line: F4_LINE }),
    fp('2.  Surat Kuasa & Fotocopy KTP Kuasa', { indentLeft: 420, hanging: 300, spaceAfter: 15, line: F4_LINE }),
    fp('3.  Fotocopy SPPT PBB Tahun terakhir', { indentLeft: 420, hanging: 300, spaceAfter: 15, line: F4_LINE }),
    fp('4.  FC Sertifikat (Terploting)', { indentLeft: 420, hanging: 300, spaceAfter: 15, line: F4_LINE }),
    fp('5.  Surat Pernyataan Alasan pemecahan', { indentLeft: 420, hanging: 300, spaceAfter: 15, line: F4_LINE }),
    fp('6.  SKET rencana Pemecahan', { indentLeft: 420, hanging: 300, spaceAfter: 15, line: F4_LINE }),
    fp('7.  Surat pernyataan pelepasan Hak untuk jalan', { indentLeft: 420, hanging: 300, spaceAfter: 15, line: F4_LINE }),
    fp('8.  Foto Lokasi Geotagging', { indentLeft: 420, hanging: 300, spaceAfter: 60, line: F4_LINE }),

    fp('Demikian disampaikan untuk menjadi bahan pertimbangan', {
      spaceBefore: 40,
      spaceAfter: 120,
      line: F4_LINE,
    }),
    fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
      align: AlignmentType.CENTER,
      spaceAfter: 10,
      line: F4_LINE,
    }),
    fp('Pemohon / Kuasa', {
      align: AlignmentType.CENTER,
      spaceAfter: SIGNATURE_SPACE_STANDARD,
      line: F4_LINE,
    }),
    fp(kuasa.nama, {
      bold: true,
      align: AlignmentType.CENTER,
      spaceAfter: 20,
      line: F4_LINE,
    }),

    // =========================================================================
    // HAL. 2 — SURAT KUASA (PDF Hal. 4)
    // =========================================================================
    fp('SURAT KUASA', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 180,
      line: F4_LINE,
    }),
    fp('Yang bertanda tangan di bawah ini :', { spaceAfter: 60, line: F4_LINE }),
    kvAlignedTable(pemberiKuasaRows, {
      labelPct: 26,
      indentTwips: 0,
      spaceAfterRow: 20,
      line: F4_LINE,
    }),
    fpRuns(
      [
        { text: 'Selanjutnya disebut.....................................................' },
        { text: 'PEMBERI KUASA', bold: true },
      ],
      { spaceBefore: 100, spaceAfter: 60, line: F4_LINE }
    ),
    fp('Dengan ini memberikan kuasa kepada :', { spaceAfter: 40, line: F4_LINE }),
    kvAlignedTable(
      [
        { label: 'Nama', valueText: kuasa.nama, boldValue: true },
        { label: 'NIK', valueText: kuasa.nik },
        { label: 'Jenis Kelamin', valueText: kuasa.jenisKelamin },
        { label: 'Alamat', valueText: kuasaAlamatDisplay },
      ],
      { labelPct: 26, indentTwips: 0, spaceAfterRow: 20, line: F4_LINE }
    ),
    fpRuns(
      [
        { text: 'Selanjutnya disebut..................................................... ' },
        { text: 'PENERIMA KUASA', bold: true },
      ],
      { spaceBefore: 100, spaceAfter: 80, line: F4_LINE }
    ),
    aktaCenteredDashHeading('KHUSUS', {
      bold: true,
      size: F4_SIZE,
      font: F4_FONT,
      spaceBefore: 40,
      spaceAfter: 100,
      line: F4_LINE,
      contentWidthDxa: F4_CONTENT_WIDTH_DXA,
    }),
    fpRuns(
      [
        {
          text: `Untuk dan atas nama pemberi kuasa menghadap di Kantor Pertanahan/ ATR ${kotaKabupaten} guna mengurus : `,
        },
        { text: 'Permohonan Layanan Peta Analisis Penatagunaan Tanah', bold: true },
      ],
      { align: AlignmentType.JUSTIFIED, spaceAfter: 120, line: F4_LINE }
    ),
    fp('Atas Bidang Tanah', { spaceAfter: 40, line: F4_LINE }),
    kvAlignedTable(
      [
        {
          label: `${sert.jenisHak} Nomor`,
          valueRuns: [
            { text: nomorSertipikatRingkas, bold: true },
            { text: ' Luas : ' },
            { text: `${sert.luasStr} M²`, bold: true },
            { text: `, Atas Nama: ${sert.pemegangHak}` },
          ],
        },
        { label: 'Terletak di', valueText: '', noColon: true },
        { label: 'Desa/ Kelurahan', valueText: sert.desa, boldValue: true },
        { label: 'Kecamatan', valueText: sert.kecamatan, boldValue: true },
        { label: 'Kabupaten', valueText: kotaKabupaten, boldValue: true },
      ],
      { labelPct: 26, indentTwips: 0, spaceAfterRow: 20, line: F4_LINE }
    ),
    fp(
      'Demikian surat kuasa ini dibuat dengan sebenarnya, untuk dapat digunakan sebagaimana mestinya.',
      { align: AlignmentType.JUSTIFIED, spaceBefore: 140, spaceAfter: 160, line: F4_LINE }
    ),
    fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
      align: AlignmentType.CENTER,
      spaceAfter: 100,
      line: F4_LINE,
    }),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, F4_CONTENT_WIDTH_DXA - halfW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: [
                fp(parties.length > 1 ? 'Para Pemberi Kuasa' : 'Pemberi Kuasa', {
                  align: AlignmentType.CENTER,
                  spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                ...buildNumberedSignerLines(parties, 220),
              ],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp('Penerima Kuasa', {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                fp(kuasa.nama, {
                  bold: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 20,
                  line: F4_LINE,
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // =========================================================================
    // HAL. 3 — SKET RENCANA PEMECAHAN BIDANG TANAH (BARU — PDF Hal. 1)
    // =========================================================================
    fp('SKET RENCANA PEMECAHAN BIDANG TANAH', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 160,
      line: F4_LINE,
    }),
    kvAlignedTable(
      [
        { label: 'Nama Pemohon', valueText: pemohon.nama, boldValue: true },
        {
          label: `Sertifikat ${singkatanHak} No`,
          valueText: `${nomorSertipikatRingkas} / ${sert.desa}`,
        },
        { label: 'Luas', valueText: `${sert.luasStr} M²` },
        { label: 'Desa', valueText: sert.desa },
        { label: 'Kecamatan', valueText: sert.kecamatan },
        { label: 'Kabupaten', valueText: kotaKabupaten },
        {
          label: 'Jumlah Bidang',
          valueText: `${cfg.jumlahBidang} (${cfg.jumlahBidangTerbilangCap}) Bidang`,
        },
      ],
      { labelPct: 26, indentTwips: 0, spaceAfterRow: 10, line: F4_LINE }
    ),

    // Spacer paragraph before sketch box table (prevents adjacent tables)
    fp('', { spaceBefore: 60, spaceAfter: 40, line: 120 }),

    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [sketLeftW, sketRightW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          height: { value: 3800, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              width: { size: sketLeftW, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: sketBoxChildren,
            }),
            new TableCell({
              width: { size: sketRightW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 120, bottom: 80, left: 120, right: 0 },
              children: [
                fp('U', {
                  bold: true,
                  underline: true,
                  align: AlignmentType.CENTER,
                  size: 44,
                  spaceAfter: 80,
                  line: F4_LINE,
                }),
                fp('⇧', {
                  bold: true,
                  align: AlignmentType.CENTER,
                  size: 48,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    fp('Keterangan :', { spaceBefore: 140, spaceAfter: 60, line: F4_LINE }),

    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [colPenggunaanW, colLuasW, colAlasanW],
      layout: TableLayoutType.FIXED,
      borders: THIN_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: colPenggunaanW, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 50, bottom: 50, left: 100, right: 100 },
              children: [fp('Rencana Penggunaan', { spaceAfter: 0, line: F4_LINE })],
            }),
            new TableCell({
              width: { size: colLuasW, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 50, bottom: 50, left: 80, right: 80 },
              children: [fp('Luas (M2)', { spaceAfter: 0, line: F4_LINE })],
            }),
            new TableCell({
              width: { size: colAlasanW, type: WidthType.DXA },
              borders: THIN_BORDER,
              margins: { top: 50, bottom: 50, left: 100, right: 100 },
              children: [fp('Alasan Pemecahan', { spaceAfter: 0, line: F4_LINE })],
            }),
          ],
        }),
        ...cfg.sketRows.map(
          (row) =>
            new TableRow({
              children: [
                new TableCell({
                  width: { size: colPenggunaanW, type: WidthType.DXA },
                  borders: THIN_BORDER,
                  margins: { top: 45, bottom: 45, left: 100, right: 100 },
                  children: [fp(row.rencanaPenggunaan, { spaceAfter: 0, line: F4_LINE })],
                }),
                new TableCell({
                  width: { size: colLuasW, type: WidthType.DXA },
                  borders: THIN_BORDER,
                  margins: { top: 45, bottom: 45, left: 80, right: 80 },
                  children: [
                    fp(row.luasText, {
                      align: AlignmentType.CENTER,
                      spaceAfter: 0,
                      line: F4_LINE,
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: colAlasanW, type: WidthType.DXA },
                  borders: THIN_BORDER,
                  margins: { top: 45, bottom: 45, left: 100, right: 100 },
                  children: [fp(row.alasanPemecahan, { spaceAfter: 0, line: F4_LINE })],
                }),
              ],
            })
        ),
      ],
    }),

    fp(`Rencana Jalan/ Saluran seluas ± ${cfg.luasRencanaJalanText} M²`, {
      spaceBefore: 120,
      spaceAfter: 20,
      line: F4_LINE,
    }),
    fp(`Pelepasan Jalan / Saluran seluas ± ${cfg.luasPelepasanJalanText} M²`, {
      spaceAfter: 160,
      line: F4_LINE,
    }),

    fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
      align: AlignmentType.CENTER,
      spaceAfter: 10,
      line: F4_LINE,
    }),
    fp('Pemohon', {
      align: AlignmentType.CENTER,
      spaceAfter: SIGNATURE_SPACE_STANDARD,
      line: F4_LINE,
    }),
    fp(pemohon.nama, {
      bold: true,
      align: AlignmentType.CENTER,
      spaceAfter: 20,
      line: F4_LINE,
    }),

    // =========================================================================
    // HAL. 4 — SURAT PERNYATAAN ALASAN PEMECAHAN (BARU — PDF Hal. 2)
    // =========================================================================
    fp('SURAT PERNYATAAN ALASAN PEMECAHAN', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 180,
      line: F4_LINE,
    }),
    fp('Yang bertanda tangan di bawah ini :', { spaceAfter: 60, line: F4_LINE }),
    kvAlignedTable(
      [
        { label: 'Nama', valueText: pemohon.nama, boldValue: true },
        { label: 'NIK', valueText: pemohon.nik },
        { label: 'Tempat/tgl lahir', valueText: pemohon.ttl },
        { label: 'Pekerjaan', valueText: pemohon.pekerjaan },
        { label: 'Alamat', valueText: pemohonAlamatDisplay },
      ],
      { labelPct: 26, indentTwips: 0, spaceAfterRow: 20, line: F4_LINE }
    ),
    fpRuns(
      [
        { text: `Adalah pemilik ${namaSertipikatLengkap} No. ` },
        { text: nomorSertipikatRingkas, bold: true },
        { text: ' Luas : ' },
        { text: `${sert.luasStr} M²`, bold: true },
        {
          text: ` yang terletak di ${sert.desa}, ${sert.kecamatan}, ${kotaKabupaten} yang tercatat atas nama `,
        },
        { text: sert.pemegangHak, bold: true },
        { text: ` dan merupakan produk kantor Pertanahan ${kabLengkap}.` },
      ],
      { align: AlignmentType.JUSTIFIED, spaceBefore: 120, spaceAfter: 100, line: F4_LINE }
    ),
    fp('Dengan ini menyatakan sebagai berikut :', { spaceAfter: 60, line: F4_LINE }),
    fp(
      `1. Bahwa saya mengajukan permohonan pemecahan bidang tanah bersertifikat ${sert.jenisHak} tersebut diatas menjadi ${cfg.jumlahBidang} (${cfg.jumlahBidangTerbilangLower}) bidang.`,
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: F4_LINE }
    ),
    fpRuns(
      [
        { text: '2. Pemecahan bidang tersebut digunakan untuk keperluan ' },
        { text: cfg.keperluanUtamaUpper, bold: true },
        { text: '.' },
      ],
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: F4_LINE }
    ),
    fp(
      '3. Bahwa tanah yang dikavling atau dijual secara parsial dalam keadaan siap bangun, sudah tersedia jalan yang diperkeras dan saluran air yang memadai/sudah ada rencana untuk jalan dan saluran air.',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: F4_LINE }
    ),
    fp(
      '4. Pemecahan bidang tanah bukan merupakan kegiatan pembangunan perumahan terselubung',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: F4_LINE }
    ),
    fpRuns(
      [
        { text: '5. Pemecahan bidang tanah untuk kepentingan peralihan hak ' },
        { text: cfg.alasanPeralihanText, bold: true },
        { text: '.' },
      ],
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 40, line: F4_LINE }
    ),
    fp('6. Tidak akan melakukan Pemecahan bertingkat', {
      align: AlignmentType.JUSTIFIED,
      indentLeft: 320,
      hanging: 320,
      spaceAfter: 40,
      line: F4_LINE,
    }),
    fp('7. Tanah yang dimohon tidak dalam sengketa fisik maupun penguasaan', {
      align: AlignmentType.JUSTIFIED,
      indentLeft: 320,
      hanging: 320,
      spaceAfter: 40,
      line: F4_LINE,
    }),
    fp(
      '8. Pemecahan bidang tanah ini tidak mengakibatkan terjadinya kepemilikan tanah yang melebihi dari jumlah maksimal 5 (lima) bidang (kecuali pemecahan karena warisan, maka jumlah maksimal pemecahan sesuai dengan jumlah ahli waris)',
      { align: AlignmentType.JUSTIFIED, indentLeft: 320, hanging: 320, spaceAfter: 100, line: F4_LINE }
    ),
    fp(
      'Demikian Surat Pernyataan ini saya buat dengan sebenar – benarnya untuk dipergunakan sebagaimana mestinya dan apabila pernyataan ini tidak benar, saya sanggup menerima sanksi peraturan yang berlaku',
      { align: AlignmentType.JUSTIFIED, spaceAfter: 140, line: F4_LINE }
    ),
    fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
      align: AlignmentType.CENTER,
      spaceAfter: 10,
      line: F4_LINE,
    }),
    fp('Yang membuat Pernyataan :', {
      align: AlignmentType.CENTER,
      spaceAfter: SIGNATURE_SPACE_METERAI,
      line: F4_LINE,
    }),
    fp(pemohon.nama, {
      bold: true,
      align: AlignmentType.CENTER,
      spaceAfter: 20,
      line: F4_LINE,
    }),
  ];

  // =========================================================================
  // HAL. 5 (OPSIONAL) — SURAT PERNYATAAN PELEPASAN JALAN (PDF Hal. 3 Poin 7)
  // =========================================================================
  if (cfg.sertakanPelepasanJalan) {
    const luasJalan = na?.pelepasan_jalan_luas_m2 ?? 0;
    blocks.push(
      fp('SURAT PERNYATAAN PELEPASAN JALAN', {
        pageBreakBefore: true,
        bold: true,
        underline: true,
        align: AlignmentType.CENTER,
        spaceAfter: 180,
        line: 260,
      }),
      fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 60, line: F4_LINE_AIRY }),
      ...buildNumberedPartiesKvBlocks(parties, { spaceAfterRow: 0 }),
      fp(
        `Dengan ini menyatakan dengan sebenarnya bahwa terhadap sebagian bidang tanah ${sert.jenisHak} ${sert.ringkas} seluas ${sert.luasStr} M² terletak di Desa ${sert.desa}, Kecamatan ${sert.kecamatan}, ${sert.kabupaten}, saya/kami melepas hak sebagian tanah seluas ± ${formatNumberId(luasJalan)} M² untuk dipergunakan sebagai Akses Jalan (${na?.pelepasan_jalan_keterangan?.trim() || 'Jalan Umum/Akses Bidang Pecahan'}) tanpa menuntut ganti rugi apapun di kemudian hari.`,
        { align: AlignmentType.JUSTIFIED, spaceBefore: 120, spaceAfter: 100, line: F4_LINE_AIRY }
      ),
      fp(
        'Demikian surat pernyataan pelepasan jalan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.',
        { align: AlignmentType.JUSTIFIED, spaceAfter: 200, line: F4_LINE_AIRY }
      ),
      new Table({
        width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
        columnWidths: [4280, F4_CONTENT_WIDTH_DXA - 4280],
        layout: TableLayoutType.FIXED,
        borders: NO_TABLE_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 4280, type: WidthType.DXA },
                borders: NO_BORDER,
                margins: { top: 0, bottom: 0, left: 0, right: 120 },
                children: buildSinglePengesahanCentered(pengesahan, 20),
              }),
              new TableCell({
                width: { size: F4_CONTENT_WIDTH_DXA - 4280, type: WidthType.DXA },
                borders: NO_BORDER,
                margins: { top: 0, bottom: 0, left: 120, right: 0 },
                children: [
                  fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
                    align: AlignmentType.CENTER,
                    spaceBefore: 20,
                    spaceAfter: 0,
                    line: F4_LINE,
                  }),
                  fp('Yang menyatakan', {
                    align: AlignmentType.CENTER,
                    spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                    line: F4_LINE,
                  }),
                  ...buildNumberedSignerLines(parties, 260),
                ],
              }),
            ],
          }),
        ],
      }),
      ...buildSaksiBlocks(saksi1.nama, saksi2.nama, 200)
    );
  }

  // =========================================================================
  // HAL. 5/6 (DIPERTAHANKAN) — SURAT PERNYATAAN KEABSAHAN DATA & LOKASI BIDANG
  // =========================================================================
  blocks.push(
    fp('SURAT PERNYATAAN KEABSAHAN DATA & LOKASI BIDANG TANAH', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 160,
      line: F4_LINE,
    }),
    fp('Yang bertanda tangan dibawah ini :', { spaceAfter: 40, line: F4_LINE }),
    ...buildNumberedPartiesKvBlocks(parties, { spaceAfterRow: 0 }),
    fp(`Sehubungan dengan permohonan Analisis Bidang atas tanah ${sert.jenisHak} :`, {
      spaceBefore: 100,
      spaceAfter: 40,
      line: F4_LINE,
    }),
    kvTable(
      [
        [sert.labelNo, sert.nilaiNo],
        ['Desa', sert.desa],
        ['Kecamatan', sert.kecamatan],
        ['Kabupaten', sert.kabupaten],
        ['Luas / Pemegang Hak', `${sert.luasStr} m² / ${sert.pemegangHak}`],
      ],
      { indentTwips: 540, labelPct: 28, spaceAfterRow: 0, line: F4_LINE }
    ),
    fp(
      'Dengan ini menyatakan dengan sebenarnya bahwa lokasi fisik bidang tanah, foto geotagging, batas-batas patok, serta titik koordinat poligon yang dilampirkan dalam berkas permohonan Analisis Bidang ini adalah benar sesuai keadaan di lapangan dan tidak tumpang tindih dengan hak pihak lain. Apabila di kemudian hari ternyata terdapat kekeliruan atau gugatan dari pihak manapun, saya bertanggung jawab penuh secara perdata maupun pidana dan membebaskan Kantor Pertanahan dari segala tuntutan hukum.',
      { align: AlignmentType.JUSTIFIED, spaceBefore: 120, spaceAfter: 180, line: F4_LINE_AIRY }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4500, F4_CONTENT_WIDTH_DXA - 4500],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4500, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('', { spaceAfter: 0 })],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4500, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp(`${kotaKabupaten}, ${docDate.tanggalText}`, {
                  align: AlignmentType.CENTER,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp('Yang Menyatakan', {
                  align: AlignmentType.CENTER,
                  spaceAfter: parties.length > 1 ? 200 : SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                ...buildNumberedSignerLines(parties, 220),
              ],
            }),
          ],
        }),
      ],
    }),
    ...buildSinglePengesahanCentered(pengesahan, 160),

    // =========================================================================
    // HAL. 6–7 / 7–8 (DIPERTAHANKAN) — GEOTAGGING & ANALISIS BIDANG (POLIGON + FOTO)
    // =========================================================================
    ...buildGeotaggingPages({
      record,
      titlePrefix: 'GEOTAGGING & ANALISIS BIDANG',
      includePolygonCoords: true,
    })
  );

  return blocks;
}

function buildPkkprSuratKuasaPage(params: {
  pemohon: NonAktaPartyView;
  kuasa: ReturnType<typeof resolvePersonCtx>;
  sert: ReturnType<typeof getSertipikatInfo>;
  jenisKegiatan: string;
  kotaKabupaten: string;
  tanggalText: string;
}): Array<Paragraph | Table> {
  const halfW = Math.floor(F4_CONTENT_WIDTH_DXA / 2);
  const sertRef = params.sert.isDigital
    ? `Nibel ${params.sert.nibClean}`
    : `SHM No. ${params.sert.noHakClean}`;
  const kabSingkat = params.sert.kabupaten.replace(/^Kabupaten\s+/i, '').trim() || params.kotaKabupaten;

  return [
    fp('SURAT KUASA', {
      pageBreakBefore: true,
      bold: true,
      underline: true,
      align: AlignmentType.CENTER,
      spaceAfter: 160,
      line: F4_LINE,
    }),
    fp('Yang bertanda tangan dibawah ini kami :', { spaceAfter: 40, line: F4_LINE }),
    kvTable(
      [
        ['Nama', params.pemohon.nama],
        ['Tempat/Tgl Lahir', params.pemohon.ttl],
        ['Pekerjaan', params.pemohon.pekerjaan],
        ['Nomor KTP', params.pemohon.nik],
        ['Alamat', params.pemohon.alamatLengkap],
      ],
      { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: F4_LINE }
    ),
    fp('Selanjutnya disebut Pihak Pertama', {
      bold: true,
      spaceBefore: 60,
      spaceAfter: 80,
      line: F4_LINE,
    }),
    kvTable(
      [
        ['Nama', params.kuasa.nama],
        ['Tempat/Tgl Lahir', params.kuasa.ttl],
        ['Pekerjaan', params.kuasa.pekerjaan],
        ['Nomor KTP', params.kuasa.nik],
        ['Alamat', params.kuasa.alamat],
      ],
      { indentTwips: 420, labelPct: 26, spaceAfterRow: 0, line: F4_LINE }
    ),
    fp('Selanjutnya disebut Pihak Kedua', {
      bold: true,
      spaceBefore: 60,
      spaceAfter: 100,
      line: F4_LINE,
    }),
    fp('Dengan ini pihak pertama memberikan kuasa kepada Pihak Kedua untuk', {
      spaceAfter: 60,
      line: F4_LINE,
    }),
    fpRuns(
      [
        { text: 'PIHAK PERTAMA', bold: true },
        { text: ' memberikan kuasa sepenuhnya kepada ' },
        { text: 'PIHAK KEDUA', bold: true },
        { text: ' untuk ' },
        { text: 'mengurus berkas Perizinan dan Pengambilan', bold: true },
        {
          text: ' Sertipikat Izin Permohonan Persetujuan Kesesuaian Kegiatan Pemanfaatan Ruang (PKKPR) Untuk Kegiatan ',
        },
        { text: params.jenisKegiatan, underline: true },
        {
          text: `. ${sertRef} luas ${params.sert.luasStr}M2 yang terletak di Desa ${params.sert.desa}, ${params.sert.kecamatan}, ${params.sert.kabupaten}. Atas nama : `,
        },
        { text: params.sert.pemegangHak, bold: true },
        {
          text: ` Kantor DPMPTSP (Dinas Penanaman Modal dan Pelayanan Terpadu Satu Pintu) Kab. ${kabSingkat}. Beserta segala administrasi sebagaimana mestinya tersebut.`,
        },
      ],
      { align: AlignmentType.JUSTIFIED, spaceAfter: 80, line: F4_LINE_AIRY }
    ),
    fpRuns(
      [
        {
          text: 'Segala bentuk biaya yang timbul sebagai akibat dari pengurusan Perizinan menjadi tanggung jawab ',
        },
        { text: 'PIHAK PERTAMA', bold: true },
        { text: ' dan ' },
        { text: 'PIHAK KEDUA', bold: true },
        {
          text: ' berkewajiban menyerahkan Sertipikat izin setelah proses penerbitan izin selesai.',
        },
      ],
      { align: AlignmentType.JUSTIFIED, spaceAfter: 80, line: F4_LINE_AIRY }
    ),
    fp(
      'Demikian Surat Kuasa ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.',
      { spaceAfter: 180, line: F4_LINE }
    ),
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [halfW, F4_CONTENT_WIDTH_DXA - halfW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 120 },
              children: [
                fp(' ', { align: AlignmentType.CENTER, spaceAfter: 0, line: F4_LINE }),
                fp('PIHAK KEDUA', { bold: true, align: AlignmentType.CENTER, spaceAfter: 0, line: F4_LINE }),
                fp('Yang diberi kuasa', {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                fp(params.kuasa.nama, {
                  bold: true,
                  underline: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 20,
                  line: F4_LINE,
                }),
              ],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - halfW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 120, right: 0 },
              children: [
                fp(`${params.kotaKabupaten}, ${params.tanggalText}`, {
                  align: AlignmentType.CENTER,
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp('PIHAK PERTAMA', { bold: true, align: AlignmentType.CENTER, spaceAfter: 0, line: F4_LINE }),
                fp('Pemberi Kuasa', {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                fp(params.pemohon.nama, {
                  bold: true,
                  underline: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 20,
                  line: F4_LINE,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
}

function buildPermohonanPkkprBundle(
  record: BerkasRecord,
  settings: OfficeSettings
): Array<Paragraph | Table> {
  const parties = collectNonAktaParties(record);
  const pemohon = parties[0];
  const na = record.non_akta;
  const sert = getSertipikatInfo(record);
  const docDate = resolveNonAktaDocDate(record);
  const kotaKabupaten = (sert.kabupaten || settings.nama_kabupaten || '')
    .replace(/^Kabupaten\s+/i, '')
    .trim() || '-';

  const kuasa1 = resolvePersonCtx(
    record.akta.nama_kuasa_bpn || settings.daftar_kuasa_bpn[0] || '-',
    settings.profil_kuasa,
    record.akta.kuasa_bpn_detail
  );

  const nomorSurat = na?.pkkpr_nomor_surat?.trim() || '........................';
  const lampiranSurat = na?.pkkpr_lampiran?.trim() || '1 (Satu) Berkas';
  const jenisKegiatan = na?.pkkpr_jenis_kegiatan || 'Non Berusaha';
  const telepon = na?.pkkpr_telepon?.trim() || '-';
  const email = na?.pkkpr_email?.trim() || '-';
  const npwp = na?.pkkpr_npwp?.trim() || '-';
  const diwakili = na?.pkkpr_diwakili?.trim() || 'Diri Sendiri';
  const kbli = na?.pkkpr_kbli?.trim() || 'Rumah Tinggal';
  const jumlahLantai = na?.pkkpr_jumlah_lantai?.trim() || '1';
  const luasBangunan = na?.pkkpr_luas_bangunan?.trim() || '± 100 m2';
  const alamatLokasi = na?.pkkpr_alamat_lokasi?.trim() || `Desa ${sert.desa}`;
  const kawasan = na?.pkkpr_kawasan?.trim() || '-';
  const sertRef = sert.isDigital
    ? `Nibel : ${sert.nibClean}`
    : `SHM No. ${sert.noHakClean}`;

  const rawCoords = (na?.koordinat_poligon || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const coordList =
    rawCoords.length > 0
      ? rawCoords
      : [
          'a. ..............................',
          'b. ..............................',
          'c. ..............................',
          'd. ..............................',
        ];

  const headerLeftW = 4900;
  const headerRightW = F4_CONTENT_WIDTH_DXA - headerLeftW;

  const pkkprLabelW = 3650;
  const pkkprValW = F4_CONTENT_WIDTH_DXA - 360 - pkkprLabelW;

  const makeReqRow = (label: string, valParagraphs: Paragraph[]) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: pkkprLabelW, type: WidthType.DXA },
          borders: NO_BORDER,
          margins: { top: 0, bottom: 0, left: 0, right: 60 },
          children: [fp(label, { spaceAfter: 10, line: F4_LINE })],
        }),
        new TableCell({
          width: { size: pkkprValW, type: WidthType.DXA },
          borders: NO_BORDER,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          children: valParagraphs,
        }),
      ],
    });

  const coordParagraphs = coordList.map((line, idx) => {
    const letter = String.fromCharCode(97 + idx);
    const hasPrefix = /^[a-z]\.\s/i.test(line);
    const text = hasPrefix ? line : `${letter}. ${line}`;
    return fp(idx === 0 ? `: ${text}` : `  ${text}`, { spaceAfter: 0, line: F4_LINE });
  });

  const lokasiParagraphs = [
    fp(`: a. Alamat        : ${alamatLokasi}`, { spaceAfter: 0, line: F4_LINE }),
    fp(`  b. Kawasan       : ${kawasan}`, { spaceAfter: 0, line: F4_LINE }),
    fp(`  c. Desa/Kelurahan: ${sert.desa}`, { spaceAfter: 0, line: F4_LINE }),
    fp(`  d. Kecamatan     : ${sert.kecamatan}`, { spaceAfter: 0, line: F4_LINE }),
    fp(`  e. Kabupaten     : ${sert.kabupaten}`, { spaceAfter: 0, line: F4_LINE }),
    fp(`  f. Provinsi      : ${sert.provinsi}`, { spaceAfter: 10, line: F4_LINE }),
  ];

  const children: Array<Paragraph | Table> = [
    // HAL. 1 — SURAT PERMOHONAN PKKPR (DPMPTSP)
    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [headerLeftW, headerRightW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: headerLeftW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 0, right: 160 },
              children: [
                fp(`Nomor    : ${nomorSurat}`, { spaceAfter: 10, line: F4_LINE }),
                fp(`Lampiran : ${lampiranSurat}`, { spaceAfter: 10, line: F4_LINE }),
                fp(
                  'Perihal  : Permohonan Persetujuan Kesesuaian Kegiatan Pemanfaatan Ruang (PKKPR) Untuk Kegiatan Berusaha atau Non Berusaha.',
                  { align: AlignmentType.JUSTIFIED, spaceAfter: 20, line: F4_LINE }
                ),
              ],
            }),
            new TableCell({
              width: { size: headerRightW, type: WidthType.DXA },
              borders: NO_BORDER,
              margins: { top: 0, bottom: 0, left: 160, right: 0 },
              children: [
                fp(`${kotaKabupaten}, ${docDate.tanggalText}`, { spaceAfter: 60, line: F4_LINE }),
                fp('Kepada', { spaceAfter: 0, line: F4_LINE }),
                fp(`Yth. Bupati ${kotaKabupaten}`, { spaceAfter: 0, line: F4_LINE }),
                fp('Cq. Kepala Dinas Penanaman Modal Dan Pelayanan Terpadu Satu Pintu', {
                  spaceAfter: 0,
                  line: F4_LINE,
                }),
                fp('di –', { spaceAfter: 0, line: F4_LINE }),
                fp(`${kotaKabupaten.toUpperCase()}.`, {
                  bold: true,
                  underline: true,
                  indentLeft: 320,
                  spaceAfter: 20,
                  line: F4_LINE,
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    fp('Yang bertanda tangan dibawah ini saya :', { spaceBefore: 120, spaceAfter: 40, line: F4_LINE }),
    kvTable(
      [
        ['1. Nama', pemohon.nama],
        ['2. Alamat lengkap', pemohon.alamatLengkap],
        ['3. No. Telp', telepon],
        ['4. Email', email],
        ['5. No. NPWP', npwp],
        ['6. Perorangan / Badan, Lembaga Yg diwakili', diwakili],
        ['7. Luas lahan yang dimohon', `± ${sert.luasStr} m2`],
      ],
      { indentTwips: 240, labelPct: 40, spaceAfterRow: 0, line: F4_LINE }
    ),

    fp(
      'Dengan ini mengajukan permohonan pendaftaran Persetujuan Kesesuaian Kegiatan Pemanfaatan Ruang (PKKPR) untuk kegiatan Berusaha dan Non Berusaha, bersama ini kami sampaikan persyaratan yang diperlukan :',
      { align: AlignmentType.JUSTIFIED, spaceBefore: 100, spaceAfter: 60, line: F4_LINE }
    ),

    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA - 360, type: WidthType.DXA },
      columnWidths: [pkkprLabelW, pkkprValW],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      indent: { size: 360, type: WidthType.DXA },
      rows: [
        makeReqRow('1. Pemanfaatan ruang (KBLI)', [fp(`: ${kbli}`, { spaceAfter: 10, line: F4_LINE })]),
        makeReqRow('2. Rencana jumlah lantai bangunan', [fp(`: ${jumlahLantai}`, { spaceAfter: 10, line: F4_LINE })]),
        makeReqRow('3. Rencana luas lantai bangunan', [fp(`: ${luasBangunan}`, { spaceAfter: 10, line: F4_LINE })]),
        makeReqRow('4. Titik koordinat polygon pada masing-masing sudut', coordParagraphs),
        makeReqRow('5. Nomor Sertipikat', [fp(`: ${sertRef}`, { spaceAfter: 10, line: F4_LINE })]),
        makeReqRow('6. Alamat Lokasi', lokasiParagraphs),
      ],
    }),

    fp('7. Foto samping kanan dan kiri lokasi berwarna', { indentLeft: 360, spaceBefore: 20, spaceAfter: 10, line: F4_LINE }),
    fp('8. Fotokopi KTP', { indentLeft: 360, spaceAfter: 10, line: F4_LINE }),
    fp('9. Fotokopi alas hak (Sertipikat)', { indentLeft: 360, spaceAfter: 10, line: F4_LINE }),
    fp('10. Surat Kuasa Pengurusan', { indentLeft: 360, spaceAfter: 10, line: F4_LINE }),
    fp('11. Print out 4 titik polygon', { indentLeft: 360, spaceAfter: 10, line: F4_LINE }),
    fp('12. Berkas permohonan dan persyaratan dibuat 3 (Tiga) rangkap', {
      indentLeft: 360,
      spaceAfter: 100,
      line: F4_LINE,
    }),

    new Table({
      width: { size: F4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: [4500, F4_CONTENT_WIDTH_DXA - 4500],
      layout: TableLayoutType.FIXED,
      borders: NO_TABLE_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4500, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [fp('', { spaceAfter: 0 })],
            }),
            new TableCell({
              width: { size: F4_CONTENT_WIDTH_DXA - 4500, type: WidthType.DXA },
              borders: NO_BORDER,
              children: [
                fp('Hormat Kami', {
                  align: AlignmentType.CENTER,
                  spaceAfter: SIGNATURE_SPACE_METERAI,
                  line: F4_LINE,
                }),
                fp(pemohon.nama, {
                  bold: true,
                  underline: true,
                  align: AlignmentType.CENTER,
                  spaceAfter: 20,
                  line: F4_LINE,
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    // HAL. 2 — SURAT KUASA PENGURUSAN PKKPR (PENERIMA KUASA 1)
    ...buildPkkprSuratKuasaPage({
      pemohon,
      kuasa: kuasa1,
      sert,
      jenisKegiatan,
      kotaKabupaten,
      tanggalText: docDate.tanggalText,
    }),
  ];

  // HAL. 3 — SURAT KUASA PENGURUSAN PKKPR (PENERIMA KUASA 2 — OPSIONAL)
  if (na?.pkkpr_kuasa_2_aktif && na?.pkkpr_kuasa_2_detail?.nama?.trim()) {
    const kuasa2 = resolvePersonCtx(
      na.pkkpr_kuasa_2_detail.nama,
      settings.profil_kuasa,
      na.pkkpr_kuasa_2_detail
    );
    children.push(
      ...buildPkkprSuratKuasaPage({
        pemohon,
        kuasa: kuasa2,
        sert,
        jenisKegiatan,
        kotaKabupaten,
        tanggalText: docDate.tanggalText,
      })
    );
  }

  return children;
}

export async function buildNonAktaLampiranBuffer(
  record: BerkasRecord,
  settings: OfficeSettings
): Promise<Uint8Array> {
  let children: Array<Paragraph | Table>;
  if (record.layanan === 'Turun Waris') {
    children = buildTurunWarisBundle(record, settings);
  } else if (record.layanan === 'Waris C') {
    children = buildWarisCBundle(record, settings);
  } else if (record.layanan === 'Ralat Data') {
    children = buildRalatDataBundle(record, settings);
  } else if (record.layanan === 'Pengecekan Sertipikat') {
    children = buildPengecekanSertipikatBundle(record, settings);
  } else if (record.layanan === 'Validasi Sertipikat') {
    children = buildValidasiSertipikatBundle(record, settings);
  } else if (record.layanan === 'Analisis Bidang') {
    children = buildAnalisisBidangBundle(record, settings);
  } else if (record.layanan === 'Permohonan PKKPR') {
    children = buildPermohonanPkkprBundle(record, settings);
  } else {
    children = buildPemecahanUkurUlangBundle(record, settings);
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: F4_FONT,
            size: F4_SIZE,
          },
          paragraph: {
            alignment: AlignmentType.LEFT,
            spacing: {
              line: F4_LINE,
              after: 20,
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: PAPER_SIZE_F4_TWIPS,
            margin: LAMPIRAN_MARGINS,
          },
        },
        children,
      },
    ],
  });

  const arrayBuffer = await Packer.toArrayBuffer(doc);
  return new Uint8Array(arrayBuffer);
}
