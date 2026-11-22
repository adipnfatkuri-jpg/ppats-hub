import {
  AlignmentType,
  BorderStyle,
  Document,
  LineRuleType,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import JSZip from 'jszip';
import FileSaver from 'file-saver';
import {
  BerkasRecord,
  OfficeSettings,
  ServiceType,
  TaxCalculationResult,
  TaxDraftPrefill,
} from '../types/ppats';
import {
  formatNumberId,
  formatTanggalDDMMYYYY,
  formatTanggalLengkapHuruf,
  parseFlexibleDate,
  terbilangRupiah,
} from './indonesianFormatter';
import { PAPER_SIZE_F4_TWIPS } from './docxTemplates';
import { formatPersonFullAddress, resolveJenisSertipikat, resolvePersonDetail } from './bundleGenerator';

export const SIPAD_BOYOLALI_URL = 'https://sipad.boyolali.go.id/sipad/';

export type BphtbDocKey =
  | 'sppd'
  | 'surat_kuasa'
  | 'spjm'
  | 'bukti_transaksi'
  | 'surat_pernyataan_hibah';

export interface BphtbDocMeta {
  key: BphtbDocKey;
  fileName: string;
  label: string;
  shortLabel: string;
  description: string;
}

export interface BphtbApproverPerson {
  id: string;
  nama: string;
  nik: string;
  hubungan: string;
}

export interface BphtbSubmissionFormData {
  // Referensi berkas (opsional)
  kode_berkas: string;
  tanggal_pengajuan: string;

  // Wajib Pajak (Penerima Hak / Pembeli / Penerima Hibah / Ahli Waris)
  wp_nama: string;
  wp_nik: string;
  wp_npwp: string;
  wp_ttl: string;
  wp_pekerjaan: string;
  wp_alamat: string;
  wp_desa: string;
  wp_kecamatan: string;
  wp_kabupaten: string;
  wp_telepon: string;

  // Pihak Pengalih Hak (Penjual / Pemberi Hibah / Pewaris)
  pemberi_nama: string;
  pemberi_nik: string;
  pemberi_ttl: string;
  pemberi_pekerjaan: string;
  pemberi_alamat: string;
  pemberi_pasangan_nama: string;

  // Penerima Kuasa Pengurusan BPHTB
  kuasa_nama: string;
  kuasa_nik: string;
  kuasa_ttl: string;
  kuasa_pekerjaan: string;
  kuasa_alamat: string;
  kuasa_telepon: string;

  // Data Objek Pajak & Sertipikat
  nop: string;
  tahun_pajak: string;
  jenis_hak: string;
  jenis_tanah: string;
  nomor_sertipikat: string;
  letaknya_jalan: string;
  objek_rt_rw: string;
  desa: string;
  kecamatan: string;
  kabupaten: string;
  luas_bangunan_m2: number;
  keterangan_bangunan: string;

  // Khusus Hibah
  hubungan_hibah: string;
  pihak_menyetujui: BphtbApproverPerson[];
  saksi_1_nama: string;
  saksi_2_nama: string;
}

export interface BphtbGenerationContext {
  taxForm: TaxDraftPrefill;
  taxResult: TaxCalculationResult;
  form: BphtbSubmissionFormData;
  settings: OfficeSettings;
}

const DOC_FONT = 'Bookman Old Style';
const SIZE_10 = 20; // 10pt
const SIZE_11 = 22; // 11pt
const SIZE_12 = 24; // 12pt
const SIZE_13 = 26; // 13pt
const LINE_1_15 = 276;
const LINE_1_3 = 312;

const BPHTB_PAGE_MARGINS = {
  top: 900, // ~1.6 cm
  bottom: 900, // ~1.6 cm
  left: 1134, // ~2.0 cm
  right: 1134, // ~2.0 cm
  gutter: 0,
};

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

const OUTER_FRAME_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
};

function saveBlob(blob: Blob, fileName: string) {
  const mod = FileSaver as unknown as {
    saveAs?: (b: Blob, n: string) => void;
    default?: { saveAs?: (b: Blob, n: string) => void } | ((b: Blob, n: string) => void);
  };
  const fn =
    mod.saveAs ??
    (typeof mod === 'function' ? (mod as unknown as (b: Blob, n: string) => void) : null) ??
    (typeof mod.default === 'function' ? mod.default : mod.default?.saveAs);
  if (fn) {
    fn(blob, fileName);
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function isAjbService(layanan: ServiceType): boolean {
  return layanan === 'AJB';
}

export function isHibahService(layanan: ServiceType): boolean {
  return layanan === 'Akta Hibah';
}

export function getBphtbDocumentList(layanan: ServiceType): BphtbDocMeta[] {
  const docs: BphtbDocMeta[] = [
    {
      key: 'sppd',
      fileName: '01_Formulir_Penyampaian_SSPD.docx',
      label: 'Formulir Penyampaian SSPD (Lampiran V Perbup Boyolali)',
      shortLabel: 'Formulir SSPD',
      description: 'Lampiran V Peraturan Bupati Boyolali — Formulir Penyampaian SSPD ke BKD Boyolali.',
    },
    {
      key: 'surat_kuasa',
      fileName: '02_Surat_Kuasa_BPHTB.docx',
      label: 'Surat Kuasa Pengurusan Pajak BPHTB',
      shortLabel: 'Surat Kuasa',
      description: 'Surat Kuasa Pihak Pertama kepada Pihak Kedua untuk mengurus/membayar setoran pajak.',
    },
    {
      key: 'spjm',
      fileName: '03_SPJM_Wajib_Pajak_BPHTB.docx',
      label: 'Surat Pertanggungjawaban Mutlak Wajib Pajak (SPJM)',
      shortLabel: 'SPJM',
      description: 'Surat Pertanggungjawaban Mutlak Wajib Pajak BPHTB atas kebenaran data & harga transaksi.',
    },
  ];

  if (isAjbService(layanan)) {
    docs.push({
      key: 'bukti_transaksi',
      fileName: '04_Bukti_Transaksi_Jual_Beli.docx',
      label: 'Bukti Transaksi (Jual Beli)',
      shortLabel: 'Bukti Transaksi',
      description: 'Kwitansi Bukti Transaksi pembayaran jual beli bermaterai antara Pembeli & Penjual.',
    });
  }

  if (isHibahService(layanan)) {
    docs.push({
      key: 'surat_pernyataan_hibah',
      fileName: '04_Surat_Pernyataan_Hibah.docx',
      label: 'Surat Pernyataan Hibah',
      shortLabel: 'Surat Pernyataan Hibah',
      description: 'Surat Pernyataan Hibah lengkap dengan Pihak Menyetujui & penguatan Camat.',
    });
  }

  return docs;
}

export function formatRupiahWithCents(nilai: number): string {
  const safe = Number.isFinite(nilai) ? Math.round(nilai) : 0;
  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
  return `Rp. ${formatted},00`;
}

export function formatRupiahDash(nilai: number): string {
  const safe = Number.isFinite(nilai) ? Math.round(nilai) : 0;
  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
  return `Rp. ${formatted},-`;
}

function toTitleCaseIndonesian(text: string): string {
  return (text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function buildBuktiTransaksiSertipikat(form: BphtbSubmissionFormData): string {
  const jenis = (form.jenis_hak || 'SHM').trim();
  const nomor = (form.nomor_sertipikat || '').trim();
  const lowerNomor = nomor.toLowerCase();

  let prefix = jenis;
  if (/^hak\s+milik$/i.test(jenis)) {
    if (lowerNomor.includes('elektronik')) {
      prefix = 'SHM';
    } else if (lowerNomor.includes('nibel')) {
      prefix = 'SHM Elektronik';
    } else {
      prefix = 'SHM';
    }
  }

  if (!nomor) return prefix;

  // Normalisasi "Nib:" menjadi "NIB :" agar identik dengan template BUKTI TRANSAKSI
  const normalizedNomor = nomor.replace(/\bNIBel\b/i, 'NIB').replace(/\bNib\s*:/i, 'NIB :');
  const alreadyHasPrefix =
    lowerNomor.startsWith('shm') ||
    lowerNomor.startsWith('hak milik') ||
    lowerNomor.startsWith('shgb') ||
    lowerNomor.startsWith('letter c');

  return (alreadyHasPrefix ? normalizedNomor : `${prefix} ${normalizedNomor}`).trim();
}

function getJenisPerolehanUpper(layanan: ServiceType): string {
  switch (layanan) {
    case 'AJB':
      return 'JUAL BELI';
    case 'Akta Hibah':
      return 'HIBAH';
    case 'APHB':
      return 'PEMBAGIAN HAK BERSAMA';
    case 'Turun Waris':
    case 'Waris C':
      return 'WARIS';
    default:
      return String(layanan || '').toUpperCase();
  }
}

function stripKecPrefix(val?: string): string {
  return (val || '').replace(/^(Kecamatan|Kec\.?)\s+/i, '').trim();
}

function stripKabPrefix(val?: string): string {
  return (val || '').replace(/^(Kabupaten|Kab\.?|Kota)\s+/i, '').trim();
}

function formatPartyAddress(p?: {
  alamat_jalan?: string;
  rt_rw?: string;
  desa_kelurahan?: string;
  kecamatan?: string;
  kabupaten?: string;
}): string {
  if (!p) return '';
  const parts = [
    p.alamat_jalan,
    p.rt_rw ? `RT/RW ${p.rt_rw}` : '',
    p.desa_kelurahan ? `Ds. ${p.desa_kelurahan}` : '',
    p.kecamatan ? `Kecamatan ${stripKecPrefix(p.kecamatan)}` : '',
    p.kabupaten
      ? /^(Kabupaten|Kota)\s+/i.test(p.kabupaten)
        ? p.kabupaten
        : `Kabupaten ${p.kabupaten}`
      : '',
  ]
    .map((s) => (s || '').trim())
    .filter(Boolean);
  return parts.join(', ');
}

function formatPartyTtl(p?: { tempat_lahir?: string; tanggal_lahir?: string }): string {
  if (!p) return '';
  const tgl = p.tanggal_lahir ? formatTanggalDDMMYYYY(p.tanggal_lahir) : '';
  return [p.tempat_lahir?.trim(), tgl && tgl !== '-' ? tgl : ''].filter(Boolean).join(', ');
}

function buildWpFullAddress(form: BphtbSubmissionFormData): string {
  const base = (form.wp_alamat || '').trim();
  const baseLower = base.toLowerCase();
  const extras: string[] = [];
  if (form.wp_desa?.trim() && !baseLower.includes(form.wp_desa.trim().toLowerCase())) {
    extras.push(`Ds. ${form.wp_desa.trim()}`);
  }
  const kecClean = stripKecPrefix(form.wp_kecamatan);
  if (kecClean && !baseLower.includes(kecClean.toLowerCase())) {
    extras.push(`Kecamatan ${kecClean}`);
  }
  const kabClean = stripKabPrefix(form.wp_kabupaten);
  if (kabClean && !baseLower.includes(kabClean.toLowerCase())) {
    extras.push(`Kabupaten ${kabClean}`);
  }
  return [base, ...extras].filter(Boolean).join(', ') || '-';
}

export function buildUraianSertipikat(form: BphtbSubmissionFormData): string {
  const jenis = (form.jenis_hak || 'SHM').trim();
  const nomor = (form.nomor_sertipikat || '').trim();
  const desa = (form.desa || '').trim();

  const lowerNomor = nomor.toLowerCase();
  let prefix = jenis;
  if (/^hak\s+milik$/i.test(jenis)) {
    if (lowerNomor.includes('elektronik')) {
      prefix = 'SHM';
    } else if (lowerNomor.includes('nibel')) {
      prefix = 'SHM Elektronik';
    } else {
      prefix = 'SHM';
    }
  }

  let body = '';
  if (nomor) {
    const alreadyHasPrefix =
      lowerNomor.startsWith('shm') ||
      lowerNomor.startsWith('hak milik') ||
      lowerNomor.startsWith('shgb') ||
      lowerNomor.startsWith('letter c');
    body = alreadyHasPrefix ? nomor : `${prefix} ${nomor}`;
  } else {
    body = prefix;
  }

  if (desa && !body.toLowerCase().includes(desa.toLowerCase())) {
    body = `${body} ${desa}`;
  }
  return body.trim();
}

function buildSpjmSertipikatValue(form: BphtbSubmissionFormData): string {
  const nomor = (form.nomor_sertipikat || '').trim();
  const jenis = (form.jenis_hak || 'HM').trim();
  const desa = (form.desa || '').trim();
  const shortJenis = /^hak\s+milik$/i.test(jenis) ? 'HM' : jenis;
  const parts = [
    nomor,
    nomor && !nomor.toUpperCase().includes(shortJenis.toUpperCase()) ? shortJenis : '',
    desa && !nomor.toUpperCase().includes(desa.toUpperCase()) ? desa.toUpperCase() : '',
  ].filter(Boolean);
  return parts.join(' ').trim() || '-';
}

export function buildInitialBphtbFormData(
  settings: OfficeSettings,
  linkedRecord?: BerkasRecord | null
): BphtbSubmissionFormData {
  const todayStr = formatTanggalDDMMYYYY(new Date().toISOString().slice(0, 10));
  const defaultKuasaName =
    linkedRecord?.akta?.nama_kuasa_bpn ||
    settings.profil_kuasa?.[0]?.nama ||
    settings.daftar_kuasa_bpn?.[0] ||
    '';
  const kuasaDetail = resolvePersonDetail(
    defaultKuasaName,
    settings.profil_kuasa,
    linkedRecord?.akta?.kuasa_bpn_detail
  );

  const cleanKec = stripKecPrefix(settings.nama_kecamatan || 'Ngemplak');
  const cleanKab = stripKabPrefix(settings.nama_kabupaten || 'Boyolali') || 'Boyolali';

  if (!linkedRecord) {
    return {
      kode_berkas: '',
      tanggal_pengajuan: todayStr,
      wp_nama: '',
      wp_nik: '',
      wp_npwp: '',
      wp_ttl: '',
      wp_pekerjaan: '',
      wp_alamat: '',
      wp_desa: '',
      wp_kecamatan: cleanKec,
      wp_kabupaten: cleanKab,
      wp_telepon: '',
      pemberi_nama: '',
      pemberi_nik: '',
      pemberi_ttl: '',
      pemberi_pekerjaan: '',
      pemberi_alamat: '',
      pemberi_pasangan_nama: '',
      kuasa_nama: kuasaDetail.nama !== '-' ? kuasaDetail.nama : '',
      kuasa_nik: kuasaDetail.nik !== '-' ? kuasaDetail.nik : '',
      kuasa_ttl: kuasaDetail.ttl !== '-' ? kuasaDetail.ttl : '',
      kuasa_pekerjaan: kuasaDetail.pekerjaan !== '-' ? kuasaDetail.pekerjaan : '',
      kuasa_alamat: kuasaDetail.alamat !== '-' ? kuasaDetail.alamat : '',
      kuasa_telepon: '',
      nop: '',
      tahun_pajak: String(new Date().getFullYear()),
      jenis_hak: 'Hak Milik',
      jenis_tanah: 'pekarangan',
      nomor_sertipikat: '',
      letaknya_jalan: '',
      objek_rt_rw: '',
      desa: '',
      kecamatan: cleanKec,
      kabupaten: cleanKab,
      luas_bangunan_m2: 0,
      keterangan_bangunan: 'Tanah Pekarangan',
      hubungan_hibah: 'Anak Kandungnya',
      pihak_menyetujui: [],
      saksi_1_nama: '',
      saksi_2_nama: '',
    };
  }

  const p1 = linkedRecord.para_pihak.find((p) => p.peran === 'Pihak I');
  const p2 = linkedRecord.para_pihak.find((p) => p.peran === 'Pihak II');
  const pasanganList = linkedRecord.para_pihak.filter(
    (p) => p.peran === 'Persetujuan Pasangan'
  );
  const pasangan = pasanganList[0];

  const wpParty = p2 ?? p1;
  const pemberiParty = p1;

  const jenisCert = resolveJenisSertipikat(linkedRecord.tanah);
  const nomorSert =
    jenisCert === 'digital'
      ? linkedRecord.tanah.nib
        ? `Elektronik Nib: ${linkedRecord.tanah.nib}`
        : ''
      : [
          linkedRecord.tanah.nomor_hak_lama ? `No. ${linkedRecord.tanah.nomor_hak_lama}` : '',
          linkedRecord.tanah.nib ? `NIB ${linkedRecord.tanah.nib}` : '',
        ]
          .filter(Boolean)
          .join(' / ');

  const kuasaAddr =
    formatPersonFullAddress(linkedRecord.akta.kuasa_bpn_detail) !== '-'
      ? formatPersonFullAddress(linkedRecord.akta.kuasa_bpn_detail)
      : kuasaDetail.alamat !== '-'
      ? kuasaDetail.alamat
      : '';

  const wpAlamatJalan = [
    wpParty?.alamat_jalan?.trim(),
    wpParty?.rt_rw?.trim() ? `RT ${wpParty.rt_rw.replace('/', ' / RW ')}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const penggunaanLower = (linkedRecord.tanah.penggunaan_tanah || '').toLowerCase();
  const defaultJenisTanah = penggunaanLower.includes('sawah')
    ? 'sawah'
    : penggunaanLower.includes('tegal')
    ? 'tegal'
    : 'pekarangan';

  return {
    kode_berkas: linkedRecord.kode_berkas,
    tanggal_pengajuan: todayStr,
    wp_nama: wpParty?.nama || '',
    wp_nik: wpParty?.nik || '',
    wp_npwp: '',
    wp_ttl: formatPartyTtl(wpParty),
    wp_pekerjaan: wpParty?.pekerjaan || '',
    wp_alamat: wpAlamatJalan || formatPartyAddress(wpParty),
    wp_desa: wpParty?.desa_kelurahan || '',
    wp_kecamatan: stripKecPrefix(wpParty?.kecamatan || cleanKec),
    wp_kabupaten: stripKabPrefix(wpParty?.kabupaten || cleanKab) || cleanKab,
    wp_telepon: '',
    pemberi_nama: pemberiParty?.nama || '',
    pemberi_nik: pemberiParty?.nik || '',
    pemberi_ttl: formatPartyTtl(pemberiParty),
    pemberi_pekerjaan: pemberiParty?.pekerjaan || '',
    pemberi_alamat: formatPartyAddress(pemberiParty),
    pemberi_pasangan_nama: pasangan?.nama || '',
    kuasa_nama: kuasaDetail.nama !== '-' ? kuasaDetail.nama : '',
    kuasa_nik: kuasaDetail.nik !== '-' ? kuasaDetail.nik : '',
    kuasa_ttl: kuasaDetail.ttl !== '-' ? kuasaDetail.ttl : '',
    kuasa_pekerjaan: kuasaDetail.pekerjaan !== '-' ? kuasaDetail.pekerjaan : '',
    kuasa_alamat: kuasaAddr,
    kuasa_telepon: '',
    nop: linkedRecord.pbb.nop || '',
    tahun_pajak: linkedRecord.pbb.tahun_pajak || String(new Date().getFullYear()),
    jenis_hak: linkedRecord.tanah.jenis_hak || 'Hak Milik',
    jenis_tanah: defaultJenisTanah,
    nomor_sertipikat: nomorSert,
    letaknya_jalan: linkedRecord.tanah.desa || '',
    objek_rt_rw: '',
    desa: linkedRecord.tanah.desa || '',
    kecamatan: stripKecPrefix(linkedRecord.tanah.kecamatan || cleanKec),
    kabupaten: stripKabPrefix(linkedRecord.tanah.kabupaten || cleanKab) || cleanKab,
    luas_bangunan_m2: 0,
    keterangan_bangunan:
      (linkedRecord.pbb.njop_bangunan || 0) > 0
        ? 'Tanah dan Bangunan'
        : linkedRecord.tanah.penggunaan_tanah || 'Tanah Pekarangan',
    hubungan_hibah: 'Anak Kandungnya',
    pihak_menyetujui: pasanganList.map((item, idx) => ({
      id: `approver-rec-${idx + 1}`,
      nama: item.nama || '',
      nik: item.nik || '',
      hubungan: 'ISTRI',
    })),
    saksi_1_nama: '',
    saksi_2_nama: '',
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
    spaceBefore?: number;
    spaceAfter?: number;
    line?: number;
    indentLeft?: number;
    firstLine?: number;
    hanging?: number;
    pageBreakBefore?: boolean;
  }
): Paragraph {
  const indentObj: { left?: number; firstLine?: number; hanging?: number } = {};
  if (opts?.indentLeft) indentObj.left = opts.indentLeft;
  if (opts?.firstLine) indentObj.firstLine = opts.firstLine;
  if (opts?.hanging) indentObj.hanging = opts.hanging;

  return new Paragraph({
    alignment: opts?.align ?? AlignmentType.LEFT,
    pageBreakBefore: opts?.pageBreakBefore ?? false,
    indent: Object.keys(indentObj).length > 0 ? indentObj : undefined,
    spacing: {
      before: opts?.spaceBefore ?? 0,
      after: opts?.spaceAfter ?? 50,
      line: opts?.line ?? LINE_1_15,
      lineRule: LineRuleType.AUTO,
    },
    children: [
      new TextRun({
        text,
        bold: opts?.bold ?? false,
        italics: opts?.italic ?? false,
        underline: opts?.underline ? {} : undefined,
        size: opts?.size ?? SIZE_11,
        font: DOC_FONT,
      }),
    ],
  });
}

function kvTable(
  rows: Array<[string, string]>,
  opts?: {
    labelWidthPct?: number;
    size?: number;
    indentLeft?: number;
    cellSpaceAfter?: number;
  }
): Table {
  const labelWidthPct = opts?.labelWidthPct ?? 32;
  const size = opts?.size ?? SIZE_11;
  const cellSpaceAfter = opts?.cellSpaceAfter ?? 25;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    indent: opts?.indentLeft ? { size: opts.indentLeft, type: WidthType.DXA } : undefined,
    borders: NO_TABLE_BORDERS,
    rows: rows.map(
      ([label, val]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: labelWidthPct, type: WidthType.PERCENTAGE },
              borders: NO_BORDER,
              margins: { top: 18, bottom: 18, left: 20, right: 20 },
              children: [p(label, { align: AlignmentType.LEFT, spaceAfter: cellSpaceAfter, size })],
            }),
            new TableCell({
              width: { size: 3, type: WidthType.PERCENTAGE },
              borders: NO_BORDER,
              margins: { top: 18, bottom: 18, left: 0, right: 0 },
              children: [p(':', { align: AlignmentType.CENTER, spaceAfter: cellSpaceAfter, size })],
            }),
            new TableCell({
              width: { size: 100 - labelWidthPct - 3, type: WidthType.PERCENTAGE },
              borders: NO_BORDER,
              margins: { top: 18, bottom: 18, left: 20, right: 20 },
              children: [p(val || '-', { align: AlignmentType.LEFT, spaceAfter: cellSpaceAfter, size })],
            }),
          ],
        })
    ),
  });
}

function numberedPartyKvTable(
  numLabel: string,
  rows: Array<[string, string]>,
  size = SIZE_11
): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    indent: { size: 320, type: WidthType.DXA },
    borders: NO_TABLE_BORDERS,
    rows: rows.map(
      ([label, val], idx) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 5, type: WidthType.PERCENTAGE },
              borders: NO_BORDER,
              margins: { top: 16, bottom: 16, left: 0, right: 20 },
              children: [
                p(idx === 0 ? numLabel : '', {
                  align: AlignmentType.LEFT,
                  spaceAfter: 20,
                  size,
                }),
              ],
            }),
            new TableCell({
              width: { size: 26, type: WidthType.PERCENTAGE },
              borders: NO_BORDER,
              margins: { top: 16, bottom: 16, left: 20, right: 20 },
              children: [p(label, { align: AlignmentType.LEFT, spaceAfter: 20, size })],
            }),
            new TableCell({
              width: { size: 3, type: WidthType.PERCENTAGE },
              borders: NO_BORDER,
              margins: { top: 16, bottom: 16, left: 0, right: 0 },
              children: [p(':', { align: AlignmentType.CENTER, spaceAfter: 20, size })],
            }),
            new TableCell({
              width: { size: 66, type: WidthType.PERCENTAGE },
              borders: NO_BORDER,
              margins: { top: 16, bottom: 16, left: 20, right: 20 },
              children: [p(val || '-', { align: AlignmentType.LEFT, spaceAfter: 20, size })],
            }),
          ],
        })
    ),
  });
}

function getCityName(form: BphtbSubmissionFormData, settings: OfficeSettings): string {
  return stripKabPrefix(form.kabupaten || settings.nama_kabupaten || 'Boyolali') || 'Boyolali';
}

function getDateDash(rawDate: string): string {
  const parsed = parseFlexibleDate(rawDate);
  if (parsed) return parsed.ddMmYyyy;
  return rawDate?.trim() || '..................';
}

/**
 * 1. FORMULIR PENYAMPAIAN SSPD (Lampiran V Peraturan Bupati Boyolali)
 * Menyamakan persis format resmi BKD Kabupaten Boyolali dengan bingkai penuh.
 */
function buildSppdElements(ctx: BphtbGenerationContext): Array<Paragraph | Table> {
  const { form, taxResult, settings } = ctx;
  const city = getCityName(form, settings);
  const dateDash = getDateDash(form.tanggal_pengajuan);
  const wpNama = (form.wp_nama || '').trim().toUpperCase() || '-';
  const wpNpwpNik = [form.wp_npwp?.trim(), form.wp_nik?.trim()].filter(Boolean).join(' / ') || '-';
  const wpAlamatShort = (form.wp_alamat || '').trim().toUpperCase() || '-';
  const wpDesa = (form.wp_desa || '').trim().toUpperCase() || '-';
  const wpKec = stripKecPrefix(form.wp_kecamatan).toUpperCase() || '-';
  const wpKab = stripKabPrefix(form.wp_kabupaten || city).toUpperCase() || 'BOYOLALI';

  const objekAlamatLine = [
    (form.letaknya_jalan || form.desa || '').trim().toUpperCase(),
    form.objek_rt_rw?.trim(),
  ]
    .filter(Boolean)
    .join(' ') || '-';
  const objekDesa = (form.desa || '').trim().toUpperCase() || '-';
  const objekKec = stripKecPrefix(form.kecamatan || settings.nama_kecamatan).toUpperCase() || '-';
  const objekKab = stripKabPrefix(form.kabupaten || city).toUpperCase() || 'BOYOLALI';
  const tahunPbb = (form.tahun_pajak || String(new Date().getFullYear())).trim();

  const headerTwoCol = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 52, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 40, bottom: 40, left: 20, right: 40 },
            children: [
              kvTable(
                [
                  ['Lampiran', '1 (satu) set'],
                  ['Hal', 'Penyampaian SSPD'],
                ],
                { labelWidthPct: 30, size: SIZE_10, cellSpaceAfter: 30 }
              ),
            ],
          }),
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 40, bottom: 40, left: 40, right: 20 },
            children: [
              p('Kepada :', { size: SIZE_10, spaceAfter: 20 }),
              p('Yth. Bupati Boyolali', { size: SIZE_10, spaceAfter: 20 }),
              p('Cq. Kepala BKD Kabupaten Boyolali', { size: SIZE_10, spaceAfter: 20 }),
              p(`di ${city.toUpperCase()}`, { size: SIZE_10, spaceAfter: 20 }),
            ],
          }),
        ],
      }),
    ],
  });

  const signTwoCol = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            children: [p(' ', { size: SIZE_10 })],
          }),
          new TableCell({
            width: { size: 52, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            children: [
              p(`${city}, ${dateDash}`, { align: AlignmentType.CENTER, size: SIZE_10, spaceAfter: 20 }),
              p('Wajib Pajak / Kuasa Wajib Pajak *)', {
                align: AlignmentType.CENTER,
                size: SIZE_10,
                spaceAfter: 1200,
              }),
              p(wpNama !== '-' ? wpNama : '( .................................... )', {
                bold: true,
                underline: true,
                align: AlignmentType.CENTER,
                size: SIZE_10,
                spaceAfter: 40,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const innerBoxChildren: Array<Paragraph | Table> = [
    p('FORMULIR PENYAMPAIAN SSPD', {
      bold: true,
      align: AlignmentType.CENTER,
      size: SIZE_12,
      spaceBefore: 80,
      spaceAfter: 160,
    }),
    headerTwoCol,
    p('Yang bertanda tangan di bawah ini:', {
      size: SIZE_10,
      spaceBefore: 120,
      spaceAfter: 70,
    }),
    kvTable(
      [
        ['Nama Wajib Pajak', wpNama],
        ['NPWP / NIK', wpNpwpNik],
        ['Alamat', wpAlamatShort],
        ['Desa/Kelurahan', wpDesa],
        ['Kecamatan', wpKec],
        ['Kabupaten/Kota', wpKab],
        ['No. Telepon', form.wp_telepon?.trim() || '-'],
      ],
      { labelWidthPct: 36, size: SIZE_10, cellSpaceAfter: 25 }
    ),
    p(
      'Bersama ini menyampaikan SSPD untuk diteliti atas perolehan hak atas tanah dan/atau bangunan sebagai berikut:',
      {
        align: AlignmentType.JUSTIFIED,
        size: SIZE_10,
        spaceBefore: 110,
        spaceAfter: 70,
      }
    ),
    kvTable(
      [
        ['NOP', form.nop?.trim() || '-'],
        ['NPOP', formatRupiahWithCents(taxResult.npop)],
        ['Alamat Objek Pajak', objekAlamatLine],
        ['Desa/Kelurahan', objekDesa],
        ['Kecamatan', objekKec],
        ['Kabupaten/Kota', objekKab],
      ],
      { labelWidthPct: 36, size: SIZE_10, cellSpaceAfter: 25 }
    ),
    p('Terlampir dokumen sebagai berikut:', {
      size: SIZE_10,
      spaceBefore: 110,
      spaceAfter: 60,
    }),
    p('1. SSPD yang tertera Bukti Penerimaan Daerah *)', {
      size: SIZE_10,
      indentLeft: 360,
      spaceAfter: 30,
    }),
    p(`2. Fotokopi SPPT atau STTS/Struk ATM bukti pembayaran PBB Tahun ${tahunPbb}*)`, {
      size: SIZE_10,
      indentLeft: 360,
      spaceAfter: 30,
    }),
    p('3. Fotokopi identitas Wajib Pajak berupa KTP', {
      size: SIZE_10,
      indentLeft: 360,
      spaceAfter: 30,
    }),
    p('4. Surat Kuasa dari Wajib Pajak **)', {
      size: SIZE_10,
      indentLeft: 360,
      spaceAfter: 30,
    }),
    p('5. Fotokopi identitas Wajib Pajak **)', {
      size: SIZE_10,
      indentLeft: 360,
      spaceAfter: 30,
    }),
    p('6. .................................................................', {
      size: SIZE_10,
      indentLeft: 360,
      spaceAfter: 110,
    }),
    p('Demikian disampaikan untuk dapat dilakukan penelitian SSPD.', {
      size: SIZE_10,
      spaceAfter: 180,
    }),
    signTwoCol,
  ];

  const outerFrameTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: OUTER_FRAME_BORDER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: OUTER_FRAME_BORDER,
            margins: { top: 180, bottom: 220, left: 260, right: 260 },
            children: innerBoxChildren,
          }),
        ],
      }),
    ],
  });

  return [
    p('LAMPIRAN V', { align: AlignmentType.RIGHT, size: SIZE_10, spaceAfter: 10 }),
    p('PERATURAN BUPATI BOYOLALI', { align: AlignmentType.RIGHT, size: SIZE_10, spaceAfter: 10 }),
    p('NOMOR: TAHUN 2011', { align: AlignmentType.RIGHT, size: SIZE_10, spaceAfter: 10 }),
    p('TANGGAL:', { align: AlignmentType.RIGHT, size: SIZE_10, spaceAfter: 120 }),
    outerFrameTable,
  ];
}

/**
 * 2. SURAT KUASA (Format Resmi BKD / Kecamatan Boyolali)
 */
function buildSuratKuasaElements(ctx: BphtbGenerationContext): Array<Paragraph | Table> {
  const { form, taxForm, settings } = ctx;
  const city = getCityName(form, settings);
  const dateDash = getDateDash(form.tanggal_pengajuan);

  const wpNama = (form.wp_nama || '').trim().toUpperCase() || '-';
  const kuasaNama = (form.kuasa_nama || '').trim().toUpperCase() || '-';
  const pemberiNama = (form.pemberi_nama || '').trim().toUpperCase() || '-';

  const jenisTanah = (form.jenis_tanah || 'pekarangan').trim();
  const uraianSert = buildUraianSertipikat(form);
  const desa = (form.desa || '-').trim();
  const kec = stripKecPrefix(form.kecamatan || settings.nama_kecamatan) || '-';
  const kab = stripKabPrefix(form.kabupaten || city) || 'Boyolali';

  const bodyParagraph = new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 100, after: 280, line: LINE_1_3 },
    children: [
      new TextRun({
        text: `Dengan ini pihak pertama memberikan kuasa kepada Pihak Kedua untuk Mengurus/membayar Setoran Pajak Sebidang tanah ${jenisTanah} ${uraianSert} dengan luas ${formatNumberId(taxForm.luas_m2)} m2 yang terletak di Desa ${desa}, Kecamatan ${kec}, Kabupaten ${kab}. Atas nama : `,
        size: SIZE_11,
        font: DOC_FONT,
      }),
      new TextRun({
        text: pemberiNama,
        bold: true,
        italics: true,
        size: SIZE_11,
        font: DOC_FONT,
      }),
      new TextRun({
        text: ' Beserta segala administrasi yang berkaitan dengan pajak tersebut.',
        size: SIZE_11,
        font: DOC_FONT,
      }),
    ],
  });

  const sigTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            children: [
              p(' ', { size: SIZE_11, spaceAfter: 25 }),
              p('Yang diberi kuasa', { align: AlignmentType.LEFT, size: SIZE_11, spaceAfter: 1260 }),
              p(kuasaNama !== '-' ? kuasaNama : '( .................................... )', {
                bold: true,
                underline: true,
                align: AlignmentType.LEFT,
                size: SIZE_11,
                spaceAfter: 20,
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            children: [
              p(`${city}, ${dateDash}`, { align: AlignmentType.LEFT, size: SIZE_11, spaceAfter: 25 }),
              p('Yang memberi kuasa', { align: AlignmentType.LEFT, size: SIZE_11, spaceAfter: 500 }),
              p('Materai Rp 10.000', {
                italic: true,
                align: AlignmentType.LEFT,
                size: 18,
                spaceAfter: 500,
              }),
              p(wpNama !== '-' ? wpNama : '( .................................... )', {
                bold: true,
                underline: true,
                align: AlignmentType.LEFT,
                size: SIZE_11,
                spaceAfter: 20,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return [
    p('SURAT KUASA', {
      align: AlignmentType.CENTER,
      size: SIZE_12,
      spaceBefore: 120,
      spaceAfter: 220,
    }),
    p('Yang bertanda tangan dibawah ini kami :', {
      size: SIZE_11,
      spaceAfter: 90,
    }),
    numberedPartyKvTable('1.', [
      ['Nama', wpNama],
      ['Tempat/Tgl.lahir', form.wp_ttl?.trim() || '-'],
      ['Pekerjaan', form.wp_pekerjaan?.trim() || '-'],
      ['NIK', form.wp_nik?.trim() || '-'],
      ['Alamat', buildWpFullAddress(form)],
    ]),
    p('"Selanjutnya disebut Pihak Pertama"', {
      bold: true,
      size: SIZE_11,
      spaceBefore: 70,
      spaceAfter: 120,
    }),
    numberedPartyKvTable('2.', [
      ['Nama', kuasaNama],
      ['Tempat/Tgl. Lahir', form.kuasa_ttl?.trim() || '-'],
      ['Pekerjaan', form.kuasa_pekerjaan?.trim() || '-'],
      ['Nomor KTP', form.kuasa_nik?.trim() || '-'],
      ['Alamat', form.kuasa_alamat?.trim() || '-'],
    ]),
    p('"Selanjutnya disebut Pihak Kedua"', {
      bold: true,
      size: SIZE_11,
      spaceBefore: 70,
      spaceAfter: 120,
    }),
    bodyParagraph,
    sigTable,
  ];
}

/**
 * 3. SURAT PERTANGGUNGJAWABAN MUTLAK WAJIB PAJAK (SPJM)
 */
function buildSpjmElements(ctx: BphtbGenerationContext): Array<Paragraph | Table> {
  const { form, taxForm, taxResult, settings } = ctx;
  const city = getCityName(form, settings);
  const parsedDate = parseFlexibleDate(form.tanggal_pengajuan);
  const formattedDate = parsedDate ? formatTanggalLengkapHuruf(form.tanggal_pengajuan) : null;

  const hariText = formattedDate ? formattedDate.hari : '............';
  const tanggalText = parsedDate ? String(parsedDate.day).padStart(2, '0') : '......';
  const bulanText = parsedDate ? String(parsedDate.month).padStart(2, '0') : '......';
  const tahunText = parsedDate ? String(parsedDate.year) : '........';

  const wpNama = (form.wp_nama || '').trim().toUpperCase() || '-';
  const wpAlamat = (form.wp_alamat || '').trim().toUpperCase() || '-';
  const lokasi = (form.letaknya_jalan || form.desa || '').trim().toUpperCase() || '-';
  const rtRw = (form.objek_rt_rw || '').trim() || '-';
  const kelurahan = (form.desa || '').trim().toUpperCase() || '-';
  const kecamatan = stripKecPrefix(form.kecamatan || settings.nama_kecamatan).toUpperCase() || '-';
  const kabupaten = stripKabPrefix(form.kabupaten || city).toUpperCase() || 'BOYOLALI';
  const hargaTransaksi =
    taxResult.nilai_kesepakatan > 0 ? taxResult.nilai_kesepakatan : taxResult.npop;
  const luasBangunan = Number.isFinite(form.luas_bangunan_m2) ? Math.max(0, form.luas_bangunan_m2) : 0;

  const sigTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            children: [p(' ', { size: SIZE_10 })],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            children: [
              p('Wajib Pajak,', { align: AlignmentType.CENTER, size: SIZE_10, spaceAfter: 480 }),
              p('Materai Rp 10.000', {
                italic: true,
                align: AlignmentType.CENTER,
                size: 18,
                spaceAfter: 480,
              }),
              p(wpNama !== '-' ? wpNama : '( .................................... )', {
                bold: true,
                underline: true,
                align: AlignmentType.CENTER,
                size: SIZE_10,
                spaceAfter: 20,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return [
    p('SURAT PERTANGGUNGJAWABAN MUTLAK WAJIB PAJAK', {
      align: AlignmentType.CENTER,
      size: SIZE_11,
      spaceBefore: 80,
      spaceAfter: 60,
    }),
    p('BEA PEROLEHAN HAK ATAS TANAH DAN ATAU BANGUNAN', {
      align: AlignmentType.CENTER,
      size: SIZE_11,
      spaceAfter: 180,
    }),
    p(
      `Pada hari ini, ${hariText}, tanggal ${tanggalText}, bulan ${bulanText}, tahun ${tahunText}, saya yang bertandatangan di bawah ini :`,
      {
        align: AlignmentType.JUSTIFIED,
        firstLine: 450,
        size: SIZE_10,
        spaceAfter: 110,
      }
    ),
    kvTable(
      [
        ['Nama', wpNama],
        ['NIK', form.wp_nik?.trim() || '-'],
        ['Alamat', wpAlamat],
      ],
      { labelWidthPct: 16, size: SIZE_10, cellSpaceAfter: 20 }
    ),
    p(
      'Selaku Wajib Pajak BPHTB menyatakan bahwa saat ini kami dalam kondisi sehat serta di bawah sumpah dengan sejujurnya serta sadar bahwa pernyataan ini dapat dipertanggungjawabkan dengan ini menyatakan kebenaran tentang data :',
      {
        align: AlignmentType.JUSTIFIED,
        firstLine: 450,
        size: SIZE_10,
        spaceBefore: 120,
        spaceAfter: 100,
      }
    ),
    kvTable(
      [
        ['Lokasi', lokasi],
        ['RT/RW', rtRw],
        ['Kelurahan', kelurahan],
        ['Kecamatan', kecamatan],
        ['Kabupaten', kabupaten],
        ['NOP', form.nop?.trim() || '-'],
        ['Luas Tanah', `${formatNumberId(taxForm.luas_m2)}m2`],
        ['NO. SHM/Petok/Letter C', buildSpjmSertipikatValue(form)],
        ['Luas Bangunan', `${formatNumberId(luasBangunan)}m2`],
        ['Jenis Perolehan', getJenisPerolehanUpper(taxForm.layanan)],
        ['Harga Transaksi', formatRupiahWithCents(hargaTransaksi)],
      ],
      { labelWidthPct: 30, size: SIZE_10, cellSpaceAfter: 25 }
    ),
    p(
      'Apabila dalam proses Pemeriksaan/penelitian lebih lanjut, ternyata ditemukan fakta/bukti baru yang menyatakan bahwa Pernyataan saya salah dan/atau ditemukan data/bukti yang menyebabkan kekurangan pajak BPHTB yang harus dibayar, maka saya bersedia membayar kekurangan dan diberikan sanksi administratif/hukum sesuai dengan ketentuan peraturan perundang-undangan.',
      {
        align: AlignmentType.JUSTIFIED,
        firstLine: 450,
        size: SIZE_10,
        spaceBefore: 130,
        spaceAfter: 90,
      }
    ),
    p(
      'Surat ini bersifat mengikat sekaligus menjadi alat bukti sah dalam persidangan dan penyelesaian sengketa hukum, dan surat pernyataan ini dapat disampaikan kepada auditor maupun aparat penegak hukum. Demikian pernyataan ini saya buat dengan sebenar-benarnya tanpa ada paksaan dari pihak manapun untuk dapat dipergunakan sebagaimana mestinya dan apabila dikemudian hari terjadi permasalahan hukum, sepenuhnya menjadi tanggung jawab saya dan tidak melibatkan pihak lain yang menandatangani SSPD BPHTB.',
      {
        align: AlignmentType.JUSTIFIED,
        firstLine: 450,
        size: SIZE_10,
        spaceAfter: 220,
      }
    ),
    sigTable,
  ];
}

export function resolveActiveApprovers(form: BphtbSubmissionFormData): BphtbApproverPerson[] {
  const fromList = (form.pihak_menyetujui ?? []).filter((a) => a.nama?.trim());
  if (fromList.length > 0) {
    return fromList;
  }
  if (form.pemberi_pasangan_nama?.trim()) {
    return [
      {
        id: 'legacy-approver',
        nama: form.pemberi_pasangan_nama.trim(),
        nik: '',
        hubungan: 'ISTRI',
      },
    ];
  }
  return [];
}

function formatApproverDottedLine(name: string): string {
  const upper = name.trim().toUpperCase();
  const dotCount = Math.max(10, 34 - upper.length);
  return `${upper} ${'.'.repeat(dotCount)}`;
}

function buildGroupedApproverParagraphs(approvers: BphtbApproverPerson[]): Paragraph[] {
  const lines: Paragraph[] = [
    p('Menyetujui', { align: AlignmentType.LEFT, size: SIZE_10, spaceAfter: 50 }),
  ];

  if (approvers.length === 0) {
    lines.push(
      p('.............................................', {
        align: AlignmentType.LEFT,
        size: SIZE_10,
        spaceBefore: 120,
        spaceAfter: 60,
      })
    );
    return lines;
  }

  // Group approvers by hubungan (case-insensitive, preserving first-seen order)
  const groups: Array<{ label: string; members: BphtbApproverPerson[] }> = [];
  for (const person of approvers) {
    const rawRel = (person.hubungan || 'KELUARGA').trim().toUpperCase();
    const existing = groups.find((g) => g.label === rawRel);
    if (existing) {
      existing.members.push(person);
    } else {
      groups.push({ label: rawRel, members: [person] });
    }
  }

  for (const group of groups) {
    lines.push(
      p(`${group.label}:`, {
        align: AlignmentType.LEFT,
        size: SIZE_10,
        spaceBefore: 40,
        spaceAfter: 40,
      })
    );
    for (const member of group.members) {
      lines.push(
        p(formatApproverDottedLine(member.nama), {
          align: AlignmentType.LEFT,
          size: SIZE_10,
          spaceAfter: 120,
        })
      );
    }
  }

  return lines;
}

/**
 * 4. SURAT PERNYATAAN HIBAH (Format Resmi Kecamatan Ngemplak / Kabupaten Boyolali)
 */
function buildSuratPernyataanHibahElements(ctx: BphtbGenerationContext): Array<Paragraph | Table> {
  const { form, taxForm, settings } = ctx;
  const city = getCityName(form, settings);
  const dateDash = getDateDash(form.tanggal_pengajuan);
  const approvers = resolveActiveApprovers(form);

  const pemberiNama = (form.pemberi_nama || '').trim().toUpperCase() || '-';
  const wpNama = (form.wp_nama || '').trim().toUpperCase() || '-';
  const jenisTanah = (form.jenis_tanah || 'pekarangan').trim();
  const uraianSert = buildUraianSertipikat(form);
  const desa = (form.desa || '-').trim();
  const kec = stripKecPrefix(form.kecamatan || settings.nama_kecamatan) || 'Ngemplak';
  const kab = stripKabPrefix(form.kabupaten || city) || 'Boyolali';
  const hubunganLabel = (form.hubungan_hibah || 'Anak Kandungnya').trim().replace(/:+$/, '');

  const camatNama = (settings.nama_ppats || '').trim() || '( ............................ )';
  const camatNip = (settings.nip_ppats || '').trim();

  const topSigTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 52, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            children: [
              p(' ', { size: SIZE_10, spaceAfter: 25 }),
              p('Yang menerima Hibah', { align: AlignmentType.LEFT, size: SIZE_10, spaceAfter: 1180 }),
              p(wpNama !== '-' ? wpNama : '( .................................... )', {
                bold: true,
                underline: true,
                align: AlignmentType.LEFT,
                size: SIZE_10,
                spaceAfter: 40,
              }),
            ],
          }),
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            children: [
              p(`${city}, ${dateDash}`, { align: AlignmentType.LEFT, size: SIZE_10, spaceAfter: 25 }),
              p('Yang menyatakan', { align: AlignmentType.LEFT, size: SIZE_10, spaceAfter: 460 }),
              p('Materai Rp 10.000', {
                italic: true,
                align: AlignmentType.LEFT,
                size: 18,
                spaceAfter: 460,
              }),
              p(pemberiNama !== '-' ? pemberiNama : '( .................................... )', {
                bold: true,
                underline: true,
                align: AlignmentType.LEFT,
                size: SIZE_10,
                spaceAfter: 40,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const bottomSigTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 54, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 80, bottom: 20, left: 0, right: 60 },
            children: buildGroupedApproverParagraphs(approvers),
          }),
          new TableCell({
            width: { size: 46, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 80, bottom: 20, left: 40, right: 0 },
            children: [
              p('Di kuatkan oleh kami :', { align: AlignmentType.CENTER, size: SIZE_10, spaceAfter: 20 }),
              p(`Camat ${kec}`, { align: AlignmentType.CENTER, size: SIZE_10, spaceAfter: 1080 }),
              p(camatNama, {
                bold: true,
                underline: true,
                align: AlignmentType.CENTER,
                size: SIZE_10,
                spaceAfter: 20,
              }),
              ...(camatNip
                ? [
                    p(`NIP. ${camatNip}`, {
                      bold: true,
                      align: AlignmentType.CENTER,
                      size: SIZE_10,
                      spaceAfter: 20,
                    }),
                  ]
                : []),
            ],
          }),
        ],
      }),
    ],
  });

  const hasSaksi = Boolean(form.saksi_1_nama?.trim() || form.saksi_2_nama?.trim());

  const elements: Array<Paragraph | Table> = [
    p('SURAT PERNYATAAN HIBAH', {
      align: AlignmentType.CENTER,
      size: SIZE_12,
      spaceBefore: 60,
      spaceAfter: 180,
    }),
    p('Yang bertandatangan dibawah ini:', {
      size: SIZE_10,
      spaceAfter: 60,
    }),
    kvTable(
      [
        ['Nama', pemberiNama],
        ['Tempat/Tgl.lahir', form.pemberi_ttl?.trim() || '-'],
        ['Pekerjaan', form.pemberi_pekerjaan?.trim() || '-'],
        ['NIK', form.pemberi_nik?.trim() || '-'],
        ['Alamat', form.pemberi_alamat?.trim() || '-'],
      ],
      { labelWidthPct: 28, size: SIZE_10, indentLeft: 320, cellSpaceAfter: 20 }
    ),
    p('Dengan ini menyatakan:', {
      size: SIZE_10,
      spaceBefore: 70,
      spaceAfter: 40,
    }),
    p(`Bahwa saya betul-betul menghibahkan/memberikan tanah ${jenisTanah} kepada`, {
      size: SIZE_10,
      spaceAfter: 40,
    }),
    p(`${hubunganLabel}:`, {
      bold: true,
      size: SIZE_10,
      spaceAfter: 60,
    }),
    kvTable(
      [
        ['Nama', wpNama],
        ['Tempat/Tgl.lahir', form.wp_ttl?.trim() || '-'],
        ['Pekerjaan', form.wp_pekerjaan?.trim() || '-'],
        ['NIK', form.wp_nik?.trim() || '-'],
        ['Alamat', buildWpFullAddress(form)],
      ],
      { labelWidthPct: 28, size: SIZE_10, indentLeft: 320, cellSpaceAfter: 20 }
    ),
    p(
      `Sebidang tanah ${jenisTanah} ${uraianSert} dengan luas ${formatNumberId(taxForm.luas_m2)} m2 yang terletak di Desa ${desa}, Kecamatan ${kec}, Kabupaten ${kab}.`,
      {
        align: AlignmentType.JUSTIFIED,
        size: SIZE_10,
        line: LINE_1_3,
        spaceBefore: 110,
        spaceAfter: 80,
      }
    ),
    p(
      'Demikian surat pernyataan ini dibuat dengan sebenar-benarnya untuk dipergunakan sebagaimana mestinya.',
      {
        align: AlignmentType.JUSTIFIED,
        size: SIZE_10,
        line: LINE_1_3,
        spaceAfter: 180,
      }
    ),
    topSigTable,
    p(' ', { size: SIZE_10, spaceAfter: 60 }),
    bottomSigTable,
  ];

  if (hasSaksi) {
    elements.push(
      p('Saksi-Saksi:', {
        size: SIZE_10,
        spaceBefore: 140,
        spaceAfter: 50,
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: NO_TABLE_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: NO_BORDER,
                children: [
                  p(
                    `1. ${(form.saksi_1_nama || '..........................').trim().toUpperCase()} ........................`,
                    { align: AlignmentType.LEFT, size: SIZE_10, spaceAfter: 40 }
                  ),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: NO_BORDER,
                children: [
                  p(
                    `2. ${(form.saksi_2_nama || '..........................').trim().toUpperCase()} ........................`,
                    { align: AlignmentType.LEFT, size: SIZE_10, spaceAfter: 40 }
                  ),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  return elements;
}

/**
 * 4A. BUKTI TRANSAKSI (Kwitansi Jual Beli AJB)
 * Menyamakan persis format bingkai resmi BUKTI TRANSAKSI Boyolali.
 */
function buildBuktiTransaksiElements(ctx: BphtbGenerationContext): Array<Paragraph | Table> {
  const { form, taxForm, taxResult, settings } = ctx;
  const city = getCityName(form, settings);
  const dateDash = getDateDash(form.tanggal_pengajuan);

  const pembeliNama = (form.wp_nama || '').trim().toUpperCase() || '........................';
  const penjualNama = (form.pemberi_nama || '').trim().toUpperCase() || '( .................................... )';
  const nominalTransaksi =
    taxResult.nilai_kesepakatan > 0 ? taxResult.nilai_kesepakatan : taxResult.npop;
  const terbilangTitle = toTitleCaseIndonesian(terbilangRupiah(nominalTransaksi));
  const uraianSert = buildBuktiTransaksiSertipikat(form);
  const desa = (form.desa || '-').trim();
  const kec = stripKecPrefix(form.kecamatan || settings.nama_kecamatan) || '-';
  const kab = stripKabPrefix(form.kabupaten || city) || 'Boyolali';

  const centerWithDashes = (text: string, targetChars = 54): string => {
    const clean = text.trim();
    const totalDashes = Math.max(12, targetChars - clean.length - 2);
    const leftDashes = Math.max(6, Math.floor(totalDashes / 2));
    const rightDashes = Math.max(6, totalDashes - leftDashes);
    return `${'-'.repeat(leftDashes)} ${clean} ${'-'.repeat(rightDashes)}`;
  };

  const detailTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 40, bottom: 80, left: 20, right: 20 },
            children: [
              p('Telah diterima dari', { italic: true, size: SIZE_10, spaceAfter: 40 }),
            ],
          }),
          new TableCell({
            width: { size: 3, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 40, bottom: 80, left: 0, right: 0 },
            children: [p(':', { align: AlignmentType.CENTER, size: SIZE_10, spaceAfter: 40 })],
          }),
          new TableCell({
            width: { size: 69, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 40, bottom: 80, left: 20, right: 20 },
            children: [
              p(centerWithDashes(pembeliNama, 52), {
                size: SIZE_10,
                spaceAfter: 40,
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 40, bottom: 80, left: 20, right: 20 },
            children: [
              p('Banyaknya uang', { italic: true, size: SIZE_10, spaceAfter: 40 }),
            ],
          }),
          new TableCell({
            width: { size: 3, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 40, bottom: 80, left: 0, right: 0 },
            children: [p(':', { align: AlignmentType.CENTER, size: SIZE_10, spaceAfter: 40 })],
          }),
          new TableCell({
            width: { size: 69, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 40, bottom: 80, left: 20, right: 20 },
            children: [
              p(centerWithDashes(terbilangTitle, 52), {
                size: SIZE_10,
                spaceAfter: 40,
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 40, bottom: 80, left: 20, right: 20 },
            children: [
              p('Guna Membayar', { italic: true, size: SIZE_10, spaceAfter: 40 }),
            ],
          }),
          new TableCell({
            width: { size: 3, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 40, bottom: 80, left: 0, right: 0 },
            children: [p(':', { align: AlignmentType.CENTER, size: SIZE_10, spaceAfter: 40 })],
          }),
          new TableCell({
            width: { size: 69, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 40, bottom: 80, left: 20, right: 20 },
            children: [
              p(
                `Sebidang tanah luas ${formatNumberId(taxForm.luas_m2)} m2 tsb.${uraianSert}`,
                { size: SIZE_10, spaceAfter: 70 }
              ),
              p(
                `yang terletak di Desa ${desa}, Kecamatan ${kec}, Kabupaten ${kab}.`,
                { size: SIZE_10, spaceAfter: 60 }
              ),
            ],
          }),
        ],
      }),
    ],
  });

  const bottomRowTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 52, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 240, bottom: 40, left: 100, right: 40 },
            children: [
              p(' ', { size: SIZE_10, spaceAfter: 240 }),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 80, after: 40, line: LINE_1_15, lineRule: LineRuleType.AUTO },
                children: [
                  new TextRun({
                    text: 'Terbilang ',
                    italics: true,
                    size: SIZE_11,
                    font: DOC_FONT,
                  }),
                  new TextRun({
                    text: formatRupiahDash(nominalTransaksi),
                    bold: true,
                    size: SIZE_11,
                    font: DOC_FONT,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            margins: { top: 60, bottom: 40, left: 40, right: 40 },
            children: [
              p(`${city}, ${dateDash}`, {
                align: AlignmentType.CENTER,
                size: SIZE_10,
                spaceAfter: 25,
              }),
              p('Yang menerima', {
                align: AlignmentType.CENTER,
                size: SIZE_10,
                spaceAfter: 480,
              }),
              p('Materai Rp 10.000', {
                italic: true,
                align: AlignmentType.CENTER,
                size: 18,
                spaceAfter: 480,
              }),
              p(penjualNama, {
                bold: true,
                underline: true,
                align: AlignmentType.CENTER,
                size: SIZE_10,
                spaceAfter: 20,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const outerReceiptBox = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: OUTER_FRAME_BORDER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: OUTER_FRAME_BORDER,
            margins: { top: 160, bottom: 180, left: 240, right: 240 },
            children: [
              p('BUKTI TRANSAKSI', {
                bold: true,
                align: AlignmentType.CENTER,
                size: SIZE_12,
                spaceBefore: 40,
                spaceAfter: 220,
              }),
              detailTable,
              p('', { size: SIZE_10, spaceBefore: 0, spaceAfter: 60 }),
              bottomRowTable,
            ],
          }),
        ],
      }),
    ],
  });

  return [outerReceiptBox];
}

function buildDocumentSectionChildren(
  docKey: BphtbDocKey,
  ctx: BphtbGenerationContext
): Array<Paragraph | Table> {
  switch (docKey) {
    case 'sppd':
      return buildSppdElements(ctx);
    case 'surat_kuasa':
      return buildSuratKuasaElements(ctx);
    case 'spjm':
      return buildSpjmElements(ctx);
    case 'bukti_transaksi':
      return buildBuktiTransaksiElements(ctx);
    case 'surat_pernyataan_hibah':
      return buildSuratPernyataanHibahElements(ctx);
  }
}

function wrapDocxDocument(children: Array<Paragraph | Table>): Document {
  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: DOC_FONT,
            size: SIZE_11,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: PAPER_SIZE_F4_TWIPS,
            margin: BPHTB_PAGE_MARGINS,
          },
        },
        children,
      },
    ],
  });
}

export async function buildSingleBphtbDocxBytes(
  docKey: BphtbDocKey,
  ctx: BphtbGenerationContext
): Promise<Uint8Array> {
  const doc = wrapDocxDocument(buildDocumentSectionChildren(docKey, ctx));
  const arrayBuffer = await Packer.toArrayBuffer(doc);
  return new Uint8Array(arrayBuffer);
}

export async function buildCombinedBphtbDocxBytes(
  ctx: BphtbGenerationContext
): Promise<{ bytes: Uint8Array; includedDocs: BphtbDocMeta[] }> {
  const includedDocs = getBphtbDocumentList(ctx.taxForm.layanan);
  const allChildren: Array<Paragraph | Table> = [];

  includedDocs.forEach((meta, idx) => {
    if (idx > 0) {
      allChildren.push(new Paragraph({ children: [new PageBreak()] }));
    }
    allChildren.push(...buildDocumentSectionChildren(meta.key, ctx));
  });

  const doc = wrapDocxDocument(allChildren);
  const arrayBuffer = await Packer.toArrayBuffer(doc);
  return { bytes: new Uint8Array(arrayBuffer), includedDocs };
}

export async function generateBphtbBundleFiles(
  ctx: BphtbGenerationContext
): Promise<Array<{ meta: BphtbDocMeta; bytes: Uint8Array }>> {
  const docs = getBphtbDocumentList(ctx.taxForm.layanan);
  const results: Array<{ meta: BphtbDocMeta; bytes: Uint8Array }> = [];
  for (const meta of docs) {
    const bytes = await buildSingleBphtbDocxBytes(meta.key, ctx);
    results.push({ meta, bytes });
  }
  return results;
}

function slugFilePart(raw: string, fallback: string): string {
  const clean = (raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);
  return clean || fallback;
}

export async function downloadBphtbBundleZip(
  ctx: BphtbGenerationContext
): Promise<{ zipFileName: string; fileNames: string[]; fileCount: number }> {
  const files = await generateBphtbBundleFiles(ctx);
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.meta.fileName, f.bytes);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const wpSlug = slugFilePart(ctx.form.wp_nama, 'Wajib_Pajak');
  const layananSlug = slugFilePart(ctx.taxForm.layanan, 'BPHTB');
  const zipFileName = `Pengajuan_BPHTB_${layananSlug}_${wpSlug}.zip`;
  saveBlob(blob, zipFileName);
  return {
    zipFileName,
    fileNames: files.map((f) => f.meta.fileName),
    fileCount: files.length,
  };
}

export async function downloadCombinedBphtbDocx(
  ctx: BphtbGenerationContext
): Promise<{ fileName: string; includedDocs: BphtbDocMeta[] }> {
  const { bytes, includedDocs } = await buildCombinedBphtbDocxBytes(ctx);
  const wpSlug = slugFilePart(ctx.form.wp_nama, 'Wajib_Pajak');
  const layananSlug = slugFilePart(ctx.taxForm.layanan, 'BPHTB');
  const fileName = `Bundel_Pengajuan_BPHTB_${layananSlug}_${wpSlug}.docx`;
  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  saveBlob(blob, fileName);
  return { fileName, includedDocs };
}

export async function downloadSingleBphtbDocx(
  docKey: BphtbDocKey,
  ctx: BphtbGenerationContext
): Promise<{ fileName: string }> {
  const meta = getBphtbDocumentList(ctx.taxForm.layanan).find((d) => d.key === docKey);
  const bytes = await buildSingleBphtbDocxBytes(docKey, ctx);
  const wpSlug = slugFilePart(ctx.form.wp_nama, 'Wajib_Pajak');
  const baseName = meta?.fileName ?? `${docKey}.docx`;
  const fileName = `${wpSlug}_${baseName}`;
  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  saveBlob(blob, fileName);
  return { fileName };
}
