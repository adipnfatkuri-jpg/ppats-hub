import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  UploadCloud,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  FileArchive,
  Save,
  Printer,
  FileText,
  Download,
  Eye,
  X,
  Loader2,
  Calculator,
  ScanLine,
  Camera,
  LayoutDashboard,
  FilePlus2,
  Handshake,
  Users,
  Gift,
  ScrollText,
  Grid2x2,
  Compass,
  FilePenLine,
  FileSearch,
  ShieldCheck,
  MapPin,
  Building2,
  ImagePlus,
  Check,
  Link2,
} from 'lucide-react';
import { DocumentReviewPanel } from './DocumentReviewPanel';
import { DateInputId } from './DateInputId';
import { GlossyIcon3D, type GlossyTone } from './TactileUI';
import { WarisCDetailPanel } from './WarisCDetailPanel';
import { SketchRefinerStudio } from './SketchRefinerStudio';
import {
  AuditWarning,
  BerkasRecord,
  BerkasStatus,
  CustomTemplateEntry,
  DataPBB,
  DataTanah,
  ExtractionApiResponse,
  NonAktaDetail,
  OfficeSettings,
  ParaPihak,
  ParameterAkta,
  PemecahanBidangItem,
  PengesahanMode,
  PersonBasicInfo,
  PihakRole,
  ServiceType,
  TaxDraftPrefill,
  TemplateDocKey,
  UploadedDocFile,
} from '../types/ppats';
import {
  STATUS_OPTIONS,
  TEMPLATE_DOCS_META,
} from '../utils/seedData';
import {
  extractMonthYearFromDate,
  formatNumberId,
  formatRupiah,
  formatTanggalDDMMYYYY,
  formatTanggalLengkapHuruf,
  todayDdMmYyyy,
} from '../utils/indonesianFormatter';
import {
  resolveAccurateBangunanFromPbb,
  resolveAccurateLuasBumiM2,
} from '../utils/bphtbObjectScan';
import {
  computeAphbTaxFraction,
  getDefaultAphbHolderCount,
  normalizeAphbRecipientRoles,
} from '../utils/aphbHelpers';
import {
  SCAN_DOC_FILE_ACCEPT,
  estimateScanPayloadBytes,
  formatCompactFileSize,
  optimizeDocumentFile,
} from '../utils/imageOptimizer';
import { scanPersonFromFiles } from '../utils/personScan';
import { postScanJson } from '../utils/scanApi';
import {
  isPartyEffectivelyEmpty,
  mergeObjectScanIntoWizardTanahPbb,
  mergeScannedPersonIntoParty,
} from '../utils/wizardStep2Scan';
import {
  normalizeScanGender,
  toScanTitleCase,
  toScanUpperName,
} from '../utils/scanTextCase';
import {
  mergePewarisScanIntoNonAkta,
  mergeWarisCScanIntoState,
} from '../utils/warisScanHelper';
import {
  buildPpatsSettingsPatchFromNonAkta,
  resolveDefaultPpatsIdentity,
} from '../utils/ppatsProfileHelper';
import {
  AKTA_SERVICE_TYPES,
  NON_AKTA_SERVICE_TYPES,
  calculateLandTaxes,
  getDefaultNpoptkp,
  isAktaService,
  runClientAuditWarnings,
  suggestNextAktaNumber,
} from '../utils/taxAndAudit';
import {
  NonAktaPartyCopyScope,
  buildNonAktaPrefillFromRecord,
  clearNonAktaLinkMetadata,
  formatLinkableBerkasOptionLabel,
  getLinkableBerkasRecords,
  hasSecondPartyInRecord,
} from '../utils/nonAktaLinkHelper';
import {
  formatPersonFullAddress,
  formatPersonShortAddress,
  generateAndDownloadBundleZip,
  generateAndDownloadSingleDocx,
  getNonAktaBundleFileName,
  numberToRoman,
  parseAdditionalPihakMeta,
  resolveJenisSertipikat,
  resolvePersonDetail,
} from '../utils/bundleGenerator';

interface WizardModuleProps {
  existingRecords: BerkasRecord[];
  editingRecord: BerkasRecord | null;
  taxPrefill?: TaxDraftPrefill | null;
  initialLayanan?: ServiceType;
  settings: OfficeSettings;
  customTemplates: Partial<Record<TemplateDocKey, CustomTemplateEntry>>;
  onSaveRecord: (record: BerkasRecord) => Promise<void>;
  onSaveSettings?: (next: OfficeSettings) => Promise<void>;
  onCancelEdit: () => void;
  onFinishToDashboard: (savedCode: string) => void;
  onFinishAndCreateNew: (savedCode: string) => void;
  onPrintReceipt: (record: BerkasRecord) => void;
  onOpenTaxCalculator: (record: BerkasRecord) => Promise<void> | void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

function toPartyRoman(num: number): string {
  return numberToRoman(num);
}

function buildRoleOptions(paraPihak: ParaPihak[], layanan: ServiceType): PihakRole[] {
  const isTwoPartyDeed = layanan === 'AJB' || layanan === 'Akta Hibah';
  const options: PihakRole[] = [];

  if (isTwoPartyDeed) {
    options.push('Pihak I', 'Pihak II', 'Persetujuan Pasangan', 'Lampiran Lain');
  } else {
    const highestOrder = paraPihak.reduce((max, p) => {
      if (!p.peran.startsWith('Pihak ')) return max;
      const ord = parseAdditionalPihakMeta(p.peran).order;
      return ord < 900 ? Math.max(max, ord) : max;
    }, 0);
    const maxNumbered = Math.max(20, highestOrder + 1, paraPihak.length + 1);
    for (let i = 1; i <= maxNumbered; i++) {
      options.push(`Pihak ${toPartyRoman(i)}` as PihakRole);
    }
    options.push('Persetujuan Pasangan', 'Lampiran Lain');
  }

  for (const p of paraPihak) {
    if (p.peran && !options.includes(p.peran)) {
      options.push(p.peran);
    }
  }
  return options;
}

function suggestNextPartyRole(paraPihak: ParaPihak[], layanan: ServiceType): PihakRole {
  const existing = new Set(paraPihak.map((p) => p.peran));
  if (layanan === 'AJB' || layanan === 'Akta Hibah') {
    if (!existing.has('Pihak I')) return 'Pihak I';
    if (!existing.has('Pihak II')) return 'Pihak II';
    return 'Pihak I';
  }
  const limit = Math.max(20, paraPihak.length + 2);
  for (let i = 1; i <= limit; i++) {
    const candidate = `Pihak ${toPartyRoman(i)}` as PihakRole;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  return `Pihak ${toPartyRoman(paraPihak.length + 1)}` as PihakRole;
}

function mapSuggestedRole(raw?: string): PihakRole {
  const s = (raw || '').trim().toLowerCase();
  if (s.includes('pasangan') || s.includes('suami') || s.includes('istri')) {
    return 'Persetujuan Pasangan';
  }
  if (s.includes('lampiran') || s.includes('saksi')) {
    return 'Lampiran Lain';
  }
  const romanMatch = /^pihak\s+(x{0,2}(?:ix|iv|v?i{0,3}))$/i.exec(s);
  if (romanMatch?.[1]) {
    return `Pihak ${romanMatch[1].toUpperCase()}` as PihakRole;
  }
  const numMatch = /^pihak\s+(\d+)$/i.exec(s);
  if (numMatch?.[1]) {
    return `Pihak ${toPartyRoman(Number(numMatch[1]))}` as PihakRole;
  }
  if (s.includes('iii') || s.includes('ketiga')) {
    return 'Pihak III';
  }
  if (s.includes('iv') || s.includes('keempat')) {
    return 'Pihak IV';
  }
  if (s.includes('ii') || s.includes('kedua') || s.includes('pembeli') || s.includes('penerima')) {
    return 'Pihak II';
  }
  return 'Pihak I';
}

function createEmptyPihak(peran: PihakRole = 'Pihak I'): ParaPihak {
  return {
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    peran,
    nik: '',
    nama: '',
    tempat_lahir: '',
    tanggal_lahir: '',
    jenis_kelamin: 'Laki-laki',
    alamat_jalan: '',
    rt_rw: '',
    desa_kelurahan: '',
    kecamatan: '',
    kabupaten: '',
    pekerjaan: '',
    status_perkawinan: 'KAWIN',
  };
}

const DEFAULT_TANPA_PERSETUJUAN_TEXT =
  'Menurut keterangan para pihak, dalam melakukan perbuatan hukum ini tanpa memerlukan persetujuan dari siapapun, dikarenakan tanah tersebut berasal dari Warisan.';

function findPresetPerson(
  name: string,
  list?: PersonBasicInfo[]
): PersonBasicInfo {
  const match = (list ?? []).find(
    (item) => item.nama.trim().toLowerCase() === name.trim().toLowerCase()
  );
  return match ? { ...match } : { nama: name };
}

function createDefaultNonAkta(
  svc: ServiceType,
  _kecName: string,
  _desaName: string,
  settings: OfficeSettings
): NonAktaDetail {
  return {
    pengesahan_mode: 'ppats',
    pengesahan_jabatan: '',
    pengesahan_nama: settings.nama_ppats,
    pengesahan_nip: settings.nip_ppats,
    camat_pengesahan_jabatan: '',
    camat_pengesahan_nama: settings.nama_ppats,
    camat_pengesahan_nip: settings.nip_ppats,
    camat_pengesahan_nomor: '',
    kades_pengesahan_jabatan: '',
    kades_pengesahan_nama: '',
    kades_pengesahan_nip: '',
    kades_pengesahan_nomor: '',
    sebutan_pewaris: 'Almarhum',
    nama_pewaris: '',
    tanggal_meninggal: '',
    tempat_meninggal: '',
    hubungan_pasangan_pewaris: 'Istrinya',
    nama_pasangan_pewaris: '',
    tgl_lahir_pasangan_pewaris: '',
    tanggal_meninggal_pasangan: '',
    tempat_meninggal_pasangan: '',
    jumlah_anak_waris: undefined,
    catatan_skw: '',
    waris_c_hak_adat: '',
    waris_c_atas_nama_c: '',
    waris_c_tahun_tercatat_c: '1960',
    waris_c_jenis_tanah: 'Pekarangan',
    waris_c_berdiri_di_atasnya: 'Bangunan Rumah Tinggal',
    waris_c_nama_blok_dukuh: '',
    waris_c_hubungan_pewaris: 'orang tua kandungnya',
    waris_c_tahun_waris: '',
    waris_c_penerima_bagian: '',
    waris_c_luas_bagian_m2: undefined,
    waris_c_sertakan_kuasa_pemecahan: true,
    waris_c_nama_wp_pbb: '',
    waris_c_no_surat_keterangan: '',
    waris_c_no_surat_riwayat: '',
    sub_permohonan_ukur: svc === 'Pemecahan' ? 'Pemecahan' : 'Pengukuran',
    bidang_pecahan: [],
    sertakan_pelepasan_jalan: false,
    pelepasan_jalan_luas_m2: 0,
    pelepasan_jalan_keterangan: '',
    pelepasan_jalan_sisi: 'utara',
    sertakan_beda_nama: false,
    koordinat_gps: '',
    link_maps: '',
    koordinat_poligon: '',
    foto_tampak_depan: '',
    foto_patok_1: '',
    foto_patok_2: '',
    foto_patok_3: '',
    foto_patok_4: '',
    foto_poligon: '',
    foto_sket_pecah: '',
    foto_sket_kasar: '',
    analisis_no_hp: '',
    analisis_tema: 'Kesesuaian Penggunaan Tanah terhadap RTRW atau RDTR, LSD dan LP2B',
    analisis_skala_peta: '1 : 1000',
    analisis_jumlah_bidang: 3,
    analisis_rencana_penggunaan: 'Rumah Tinggal',
    analisis_alasan_peralihan: 'HIBAH kepada anak',
    analisis_alasan_tabel: 'dihibahkan ke anak',
    analisis_rencana_jalan_luas_m2: 0,
    pengecekan_kuasa_mode: 'ppats',
    ...(() => {
      const ppatsDef = resolveDefaultPpatsIdentity({
        ...settings,
        nama_kecamatan: _kecName || settings.nama_kecamatan,
      });
      return {
        ppats_ttl: ppatsDef.ttl,
        ppats_nik: ppatsDef.nik,
        ppats_pekerjaan: ppatsDef.pekerjaan,
        ppats_alamat: ppatsDef.alamat,
      };
    })(),
    pkkpr_nomor_surat: '',
    pkkpr_lampiran: '1 (Satu) Berkas',
    pkkpr_jenis_kegiatan: 'Non Berusaha',
    pkkpr_telepon: '',
    pkkpr_email: '',
    pkkpr_npwp: '',
    pkkpr_diwakili: 'Diri Sendiri',
    pkkpr_kbli: 'Rumah Tinggal',
    pkkpr_jumlah_lantai: '1',
    pkkpr_luas_bangunan: '± 100 m2',
    pkkpr_alamat_lokasi: '',
    pkkpr_kawasan: '',
    pkkpr_kuasa_2_aktif: false,
    pkkpr_kuasa_2_detail: { nama: '' },
    nama_di_sertipikat: '',
    nama_di_ktp_kk: '',
    nomor_kk: '',
    jenis_dokumen_lain: '',
    nama_di_dokumen_lain: '',
    tgl_lahir_baku: '',
    keperluan_ralat: 'Ralat Data Sertipikat',
    uraian_kronologi: '',
  };
}

export const WizardModule: React.FC<WizardModuleProps> = ({
  existingRecords,
  editingRecord,
  taxPrefill,
  initialLayanan,
  settings,
  customTemplates,
  onSaveRecord,
  onSaveSettings,
  onCancelEdit,
  onFinishToDashboard,
  onFinishAndCreateNew,
  onPrintReceipt,
  onOpenTaxCalculator,
  onNotify,
}) => {
  const [savingPpatsProfile, setSavingPpatsProfile] = useState(false);
  const today = useMemo(() => todayDdMmYyyy(), []);
  const nextSuggestion = useMemo(
    () => suggestNextAktaNumber(existingRecords, today),
    [existingRecords, today]
  );

  const [step, setStep] = useState<1 | 2 | 3 | 4>(editingRecord ? 2 : 1);
  const [layanan, setLayanan] = useState<ServiceType>(
    editingRecord?.layanan ?? taxPrefill?.layanan ?? initialLayanan ?? 'AJB'
  );
  const [status, setStatus] = useState<BerkasStatus>(
    editingRecord?.status ?? '1. Pemberkasan'
  );
  const [uploadedFiles, setUploadedFiles] = useState<UploadedDocFile[]>([]);
  const [preparingFiles, setPreparingFiles] = useState(false);
  const [scanMode, setScanModeState] = useState<'fast' | 'accurate'>(() => {
    try {
      const saved = window.localStorage.getItem('sim_ppats_scan_mode');
      if (saved === 'accurate') return 'accurate';
      if (saved === 'local') {
        window.localStorage.setItem('sim_ppats_scan_mode', 'fast');
      }
    } catch {
      // ignore storage errors
    }
    return 'fast';
  });
  const setScanMode = (nextMode: 'fast' | 'accurate') => {
    setScanModeState(nextMode);
    try {
      window.localStorage.setItem('sim_ppats_scan_mode', nextMode);
    } catch {
      // ignore storage errors
    }
  };
  const [extracting, setExtracting] = useState(false);
  const [extractElapsedSec, setExtractElapsedSec] = useState(0);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scanningPersonKey, setScanningPersonKey] = useState<
    'kuasa' | 'saksi1' | 'saksi2' | null
  >(null);
  const [step3WarisScanSlot, setStep3WarisScanSlot] = useState<
    'waris_pewaris' | 'waris_c' | null
  >(null);
  const [step3PewarisScanNotice, setStep3PewarisScanNotice] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
  } | null>(null);
  const [step3WarisCScanNotice, setStep3WarisCScanNotice] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
  } | null>(null);
  const extractAbortRef = useRef<AbortController | null>(null);

  const handleScanAktaPerson = async (
    target: 'kuasa' | 'saksi1' | 'saksi2',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    const roleLabel = target === 'kuasa' ? 'Kuasa BPN' : 'Saksi';
    const targetName =
      target === 'kuasa' ? 'Kuasa BPN' : target === 'saksi1' ? 'Saksi 1' : 'Saksi 2';
    setScanningPersonKey(target);
    try {
      const result = await scanPersonFromFiles(files, roleLabel);
      const scanned = result.person;

      setAkta((prev) => {
        const scannedUpperName = toScanUpperName(scanned.nama);
        if (target === 'kuasa') {
          const nextName = scannedUpperName || prev.nama_kuasa_bpn;
          const nextDetail: PersonBasicInfo = {
            ...(prev.kuasa_bpn_detail ?? { nama: nextName }),
            ...scanned,
            nama: nextName,
          };
          return {
            ...prev,
            nama_kuasa_bpn: nextName,
            kuasa_bpn_detail: nextDetail,
          };
        }
        if (target === 'saksi1') {
          const nextName = scannedUpperName || prev.saksi_1;
          const nextDetail: PersonBasicInfo = {
            ...(prev.saksi_1_detail ?? { nama: nextName }),
            ...scanned,
            nama: nextName,
          };
          return {
            ...prev,
            saksi_1: nextName,
            saksi_1_detail: nextDetail,
          };
        }
        const nextName = scannedUpperName || prev.saksi_2;
        const nextDetail: PersonBasicInfo = {
          ...(prev.saksi_2_detail ?? { nama: nextName }),
          ...scanned,
          nama: nextName,
        };
        return {
          ...prev,
          saksi_2: nextName,
          saksi_2_detail: nextDetail,
        };
      });

      onNotify(
        `Scan KTP ${targetName} berhasil (${scanned.nama || 'Data terisi'}${scanned.nik ? ` · NIK ${scanned.nik}` : ''}).`,
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : `Gagal memindai KTP ${targetName}.`,
        'error'
      );
    } finally {
      setScanningPersonKey(null);
    }
  };

  const [step2ScanSlot, setStep2ScanSlot] = useState<string | null>(null);
  const [step2ScanNotice, setStep2ScanNotice] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
  } | null>(null);

  const handleScanStep2PartyKtp = async (
    partyId: string,
    partyLabel: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    const startedAt = Date.now();
    const slotKey = `party:${partyId}`;
    setStep2ScanSlot(slotKey);
    setStep2ScanNotice({
      type: 'info',
      message: `Sedang memindai KTP ${partyLabel}...`,
    });
    try {
      const result = await scanPersonFromFiles(files, partyLabel);
      const scanned = result.person;
      setParaPihak((prev) =>
        prev.map((item) =>
          item.id === partyId ? mergeScannedPersonIntoParty(item, scanned) : item
        )
      );
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      const msg = `Scan KTP ${partyLabel} selesai (${elapsedSec} dtk)${
        scanned.nama ? ` · ${scanned.nama}` : ''
      }${scanned.nik ? ` · NIK ${scanned.nik}` : ''}.`;
      setStep2ScanNotice({ type: 'success', message: msg });
      onNotify(msg, 'success');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : `Gagal memindai KTP ${partyLabel}.`;
      setStep2ScanNotice({ type: 'error', message: msg });
      onNotify(msg, 'error');
    } finally {
      setStep2ScanSlot(null);
    }
  };

  const handleScanStep2AddParties = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    const startedAt = Date.now();
    const subjectLabel = isAktaService(layanan)
      ? 'Pihak'
      : layanan === 'Turun Waris' || layanan === 'Waris C'
      ? 'Ahli Waris / Pemohon'
      : 'Pemohon';
    setStep2ScanSlot('party:add');
    setStep2ScanNotice({
      type: 'info',
      message: `Sedang memindai ${files.length} KTP ${subjectLabel}...`,
    });
    try {
      const scannedList = await Promise.all(
        files.map((file, idx) =>
          scanPersonFromFiles([file], `${subjectLabel} #${idx + 1}`).then((r) => r.person)
        )
      );

      setParaPihak((prev) => {
        const next = [...prev];
        for (const scanned of scannedList) {
          const emptyIdx = next.findIndex((item) => isPartyEffectivelyEmpty(item));
          if (emptyIdx >= 0) {
            next[emptyIdx] = mergeScannedPersonIntoParty(next[emptyIdx], scanned);
          } else {
            const nextRole = suggestNextPartyRole(next, layanan);
            next.push(mergeScannedPersonIntoParty(createEmptyPihak(nextRole), scanned));
          }
        }
        return next;
      });

      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      const names = scannedList
        .map((p) => p.nama)
        .filter(Boolean)
        .join(', ');
      const msg = `Scan ${scannedList.length} KTP ${subjectLabel} selesai (${elapsedSec} dtk)${
        names ? ` · ${names}` : ''
      }.`;
      setStep2ScanNotice({ type: 'success', message: msg });
      onNotify(msg, 'success');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : `Gagal memindai KTP ${subjectLabel}.`;
      setStep2ScanNotice({ type: 'error', message: msg });
      onNotify(msg, 'error');
    } finally {
      setStep2ScanSlot(null);
    }
  };

  const handleScanStep2ObjectDocs = async (
    slotKey: 'sertipikat' | 'pbb',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    const startedAt = Date.now();
    const label = slotKey === 'sertipikat' ? 'Sertipikat / SPPT' : 'SPPT PBB';
    setStep2ScanSlot(slotKey);
    setStep2ScanNotice({
      type: 'info',
      message: `Sedang memindai ${files.length} dokumen ${label}...`,
    });
    try {
      const optimized = await Promise.all(
        files.map(async (file) => {
          const payload = await optimizeDocumentFile(file, {
            maxEdge: 1120,
            quality: 0.75,
            skipBelowBytes: 90 * 1024,
          });
          return {
            name: file.name || `dokumen-${Date.now()}.jpg`,
            mimeType: payload.mimeType,
            dataBase64: payload.dataBase64,
          };
        })
      );

      const parsed = await postScanJson<ExtractionApiResponse>(
        '/api/extract-documents',
        {
          layanan,
          scanMode,
          scope: 'object_only',
          files: optimized,
        }
      );

      const merged = mergeObjectScanIntoWizardTanahPbb(
        tanah,
        pbb,
        pemegangHakInput,
        parsed,
        {
          kabupaten: settings.nama_kabupaten,
          provinsi: settings.nama_provinsi || 'Jawa Tengah',
        }
      );

      setTanah(merged.nextTanah);
      setPbb(merged.nextPbb);
      setPemegangHakInput(merged.nextPemegangHakInput);

      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      const detail = merged.summaryParts.join(' · ');
      const msg = `Scan ${label} selesai (${elapsedSec} dtk)${
        detail ? ` · ${detail}` : ''
      }. Periksa kembali hasil isian.`;
      setStep2ScanNotice({ type: 'success', message: msg });
      onNotify(msg, 'success');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : `Gagal memindai dokumen ${label}.`;
      setStep2ScanNotice({ type: 'error', message: msg });
      onNotify(msg, 'error');
    } finally {
      setStep2ScanSlot(null);
    }
  };

  const handleScanStep3Waris = async (
    slot: 'waris_pewaris' | 'waris_c',
    files: File[]
  ) => {
    if (files.length === 0) return;
    const startedAt = Date.now();
    const isWarisC = slot === 'waris_c';
    const label = isWarisC ? 'Dokumen Waris Letter C' : 'Dokumen Pewaris / SKW';
    const setNotice = isWarisC ? setStep3WarisCScanNotice : setStep3PewarisScanNotice;

    setStep3WarisScanSlot(slot);
    setNotice({
      type: 'info',
      message: `Sedang memindai ${files.length} ${label} (Foto/PDF/Word)...`,
    });

    try {
      const optimized = await Promise.all(
        files.map(async (file) => {
          const payload = await optimizeDocumentFile(file, {
            maxEdge: 1120,
            quality: 0.75,
            skipBelowBytes: 90 * 1024,
          });
          return {
            name: file.name || `dokumen-${Date.now()}.jpg`,
            mimeType: payload.mimeType,
            dataBase64: payload.dataBase64,
          };
        })
      );

      const estimatedBytes = estimateScanPayloadBytes(optimized);
      if (estimatedBytes > 12 * 1024 * 1024) {
        throw new Error(
          `Ukuran total dokumen (${formatCompactFileSize(estimatedBytes)}) melebihi batas pengiriman 12 MB. Kurangi jumlah file atau kompres PDF terlebih dahulu.`
        );
      }

      const parsed = await postScanJson<ExtractionApiResponse>(
        '/api/extract-documents',
        {
          layanan,
          scanMode,
          scope: slot,
          files: optimized,
        }
      );

      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

      if (isWarisC) {
        const merged = mergeWarisCScanIntoState(nonAkta, tanah, pbb, parsed.waris_c);
        setNonAkta(merged.nextNonAkta);
        setTanah(merged.nextTanah);
        setPbb(merged.nextPbb);
        const detail = merged.summaryParts.join(' · ');
        const msg =
          merged.updatedCount > 0
            ? `Scan ${label} selesai (${elapsedSec} dtk)${detail ? ` · ${detail}` : ''}. Periksa kembali hasil isian.`
            : `Scan selesai (${elapsedSec} dtk), namun data khusus Letter C / Pewaris belum terbaca jelas. Coba foto/PDF/Word yang lebih jelas.`;
        setNotice({
          type: merged.updatedCount > 0 ? 'success' : 'info',
          message: msg,
        });
        onNotify(msg, merged.updatedCount > 0 ? 'success' : 'error');
      } else {
        const merged = mergePewarisScanIntoNonAkta(nonAkta, parsed.waris_pewaris);
        setNonAkta(merged.nextNonAkta);
        const detail = merged.summaryParts.join(' · ');
        const msg =
          merged.updatedCount > 0
            ? `Scan ${label} selesai (${elapsedSec} dtk)${detail ? ` · ${detail}` : ''}. Periksa kembali hasil isian.`
            : `Scan selesai (${elapsedSec} dtk), namun data Pewaris / Akta Kematian belum terbaca jelas. Coba dokumen lain atau isi manual.`;
        setNotice({
          type: merged.updatedCount > 0 ? 'success' : 'info',
          message: msg,
        });
        onNotify(msg, merged.updatedCount > 0 ? 'success' : 'error');
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : `Gagal memindai ${label}.`;
      setNotice({ type: 'error', message: msg });
      onNotify(msg, 'error');
    } finally {
      setStep3WarisScanSlot(null);
    }
  };

  useEffect(() => {
    if (!extracting) {
      setExtractElapsedSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setExtractElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [extracting]);

  const [paraPihak, setParaPihak] = useState<ParaPihak[]>(
    editingRecord?.para_pihak?.length
      ? editingRecord.para_pihak
      : [createEmptyPihak('Pihak I'), createEmptyPihak('Pihak II')]
  );

  const [tanah, setTanah] = useState<DataTanah>(
    editingRecord?.tanah
      ? {
          jenis_sertipikat: resolveJenisSertipikat(editingRecord.tanah),
          surat_ukur_tanggal: '',
          surat_ukur_nomor: '',
          provinsi: settings.nama_provinsi ?? 'Jawa Tengah',
          batas_utara: '',
          batas_timur: '',
          batas_selatan: '',
          batas_barat: '',
          penggunaan_tanah: 'Pekarangan',
          status_tanah: 'Non-Pertanian',
          tanggal_pernyataan_pertanian: '',
          menguasai_sejak_tahun: '',
          ...editingRecord.tanah,
        }
      : {
          jenis_sertipikat: 'digital',
          jenis_hak: 'Hak Milik',
          nib: '',
          nomor_hak_lama: '',
          surat_ukur_tanggal: '',
          surat_ukur_nomor: '',
          luas_m2: taxPrefill?.luas_m2 ?? 0,
          desa: '',
          kecamatan: settings.nama_kecamatan.replace(/^Kecamatan\s+/i, ''),
          kabupaten: settings.nama_kabupaten,
          provinsi: settings.nama_provinsi ?? 'Jawa Tengah',
          batas_utara: '',
          batas_timur: '',
          batas_selatan: '',
          batas_barat: '',
          penggunaan_tanah: 'Pekarangan',
          status_tanah: 'Non-Pertanian',
          tanggal_pernyataan_pertanian: '',
          menguasai_sejak_tahun: '',
          dasar_perolehan: '',
          pemegang_hak_sertipikat: [],
        }
  );
  const [pemegangHakInput, setPemegangHakInput] = useState<string>(
    (editingRecord?.tanah.pemegang_hak_sertipikat ?? []).join(', ')
  );

  const [pbb, setPbb] = useState<DataPBB>(
    editingRecord?.pbb
      ? {
          luas_bangunan_m2: 0,
          njop_bangunan_m2: 0,
          ...editingRecord.pbb,
        }
      : {
          nop: '',
          tahun_pajak: String(new Date().getFullYear()),
          njop_bumi_m2: taxPrefill?.njop_bumi_m2 ?? 0,
          luas_bangunan_m2: taxPrefill?.luas_bangunan_m2 ?? 0,
          njop_bangunan_m2: taxPrefill?.njop_bangunan_m2 ?? 0,
          njop_bangunan: taxPrefill?.njop_bangunan ?? 0,
        }
  );

  const [aiWarnings, setAiWarnings] = useState<AuditWarning[]>(
    (editingRecord?.audit_warnings ?? []).filter((w) => w.id.startsWith('ai-'))
  );

  const [akta, setAkta] = useState<ParameterAkta>(() => {
    if (editingRecord?.akta) {
      const a = editingRecord.akta;
      const initialAphbRoles = normalizeAphbRecipientRoles(
        editingRecord.para_pihak || [],
        a
      );
      return {
        nomor_pengantar: '',
        butuh_persetujuan_pasangan:
          a.butuh_persetujuan_pasangan ??
          editingRecord.para_pihak.some((p) => p.peran === 'Persetujuan Pasangan'),
        keterangan_tanpa_persetujuan:
          a.keterangan_tanpa_persetujuan ?? DEFAULT_TANPA_PERSETUJUAN_TEXT,
        pihak_penerima_aphb: a.pihak_penerima_aphb ?? initialAphbRoles[0] ?? 'Pihak II',
        pihak_penerima_aphb_list: a.pihak_penerima_aphb_list ?? initialAphbRoles,
        kuasa_bpn_detail:
          a.kuasa_bpn_detail ?? findPresetPerson(a.nama_kuasa_bpn, settings.profil_kuasa),
        saksi_1_detail:
          a.saksi_1_detail ?? findPresetPerson(a.saksi_1, settings.profil_saksi),
        saksi_2_detail:
          a.saksi_2_detail ?? findPresetPerson(a.saksi_2, settings.profil_saksi),
        ...a,
      };
    }
    const defaultKuasa = settings.daftar_kuasa_bpn[0] ?? '';
    const defaultSaksi1 = settings.daftar_saksi[0] ?? '';
    const defaultSaksi2 = settings.daftar_saksi[1] ?? '';
    const initialSvc = taxPrefill?.layanan ?? initialLayanan ?? 'AJB';
    const pengantarYear =
      extractMonthYearFromDate(today)?.year ?? new Date().getFullYear();
    return {
      nomor_akta: nextSuggestion.nomorAkta,
      tanggal_akta: today,
      nomor_pengantar: `${String(nextSuggestion.noUrut).padStart(2, '0')}/${pengantarYear}`,
      nama_ppats: settings.nama_ppats,
      jabatan_ppats: settings.jabatan_ppats,
      nip_ppats: settings.nip_ppats,
      harga_per_m2: taxPrefill?.harga_per_m2 ?? 0,
      nilai_transaksi_override: taxPrefill?.nilai_transaksi_override ?? null,
      npoptkp: taxPrefill?.npoptkp ?? getDefaultNpoptkp(initialSvc, settings),
      butuh_persetujuan_pasangan: true,
      keterangan_tanpa_persetujuan: DEFAULT_TANPA_PERSETUJUAN_TEXT,
      pihak_penerima_aphb: 'Pihak II',
      pihak_penerima_aphb_list: ['Pihak II'],
      aphb_jumlah_pemegang_hak: taxPrefill?.aphb_jumlah_pemegang_hak,
      aphb_jumlah_penerima: taxPrefill?.aphb_jumlah_penerima,
      nama_kuasa_bpn: defaultKuasa,
      kuasa_bpn_detail: findPresetPerson(defaultKuasa, settings.profil_kuasa),
      saksi_1: defaultSaksi1,
      saksi_1_detail: findPresetPerson(defaultSaksi1, settings.profil_saksi),
      saksi_2: defaultSaksi2,
      saksi_2_detail: findPresetPerson(defaultSaksi2, settings.profil_saksi),
      catatan_loket: '',
    };
  });

  const [nonAkta, setNonAkta] = useState<NonAktaDetail>(() => {
    const base = createDefaultNonAkta(
      editingRecord?.layanan ?? taxPrefill?.layanan ?? initialLayanan ?? 'AJB',
      editingRecord?.tanah?.kecamatan || settings.nama_kecamatan,
      editingRecord?.tanah?.desa || '',
      settings
    );
    return editingRecord?.non_akta ? { ...base, ...editingRecord.non_akta } : base;
  });

  const [generatingBundle, setGeneratingBundle] = useState(false);
  const [bundleFinished, setBundleFinished] = useState(false);
  const [finishingAction, setFinishingAction] = useState<'dashboard' | 'new' | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(
    editingRecord?.id ?? null
  );
  const [showReview, setShowReview] = useState(true);
  const [reviewDocKey, setReviewDocKey] = useState<'01_akta' | '02_lampiran_bundel'>(() =>
    editingRecord && !isAktaService(editingRecord.layanan)
      ? '02_lampiran_bundel'
      : '01_akta'
  );

  const isAkta = isAktaService(layanan);

  const [nonAktaSourceMode, setNonAktaSourceMode] = useState<'manual' | 'linked'>(() =>
    editingRecord?.non_akta?.linked_berkas_id ? 'linked' : 'manual'
  );
  const [linkedSourceId, setLinkedSourceId] = useState<string>(
    editingRecord?.non_akta?.linked_berkas_id ?? ''
  );
  const [linkPartyScope, setLinkPartyScope] =
    useState<NonAktaPartyCopyScope>('pihak1_only');

  const linkableRecords = useMemo(
    () => getLinkableBerkasRecords(existingRecords, editingRecord?.id ?? savedRecordId),
    [existingRecords, editingRecord?.id, savedRecordId]
  );

  const linkedSourceRecord = useMemo(
    () => linkableRecords.find((r) => r.id === linkedSourceId) ?? null,
    [linkableRecords, linkedSourceId]
  );

  const applyLinkedSourceRecord = (
    source: BerkasRecord,
    scope: NonAktaPartyCopyScope,
    targetSvc: ServiceType = layanan
  ) => {
    const prefill = buildNonAktaPrefillFromRecord({
      source,
      targetLayanan: targetSvc,
      currentNonAkta: nonAkta,
      currentAkta: akta,
      settings,
      partyScope: scope,
    });
    setParaPihak(prefill.paraPihak);
    setTanah(prefill.tanah);
    setPemegangHakInput(prefill.pemegangHakInput);
    setPbb(prefill.pbb);
    setAkta(prefill.akta);
    setNonAkta(prefill.nonAkta);
    setLinkedSourceId(source.id);
    setNonAktaSourceMode('linked');
    onNotify(
      `Data Non-Akta dikaitkan ke ${source.kode_berkas} (${source.layanan}) · ${prefill.copiedPartyCount} pihak, sertipikat & PBB terisi otomatis.`,
      'success'
    );
  };

  const handleSelectNonAktaMode = (nextMode: 'manual' | 'linked') => {
    setNonAktaSourceMode(nextMode);
    if (nextMode === 'manual') {
      setLinkedSourceId('');
      setNonAkta((prev) => clearNonAktaLinkMetadata(prev));
      return;
    }
    if (linkableRecords.length === 0) return;
    const chosen =
      linkableRecords.find((r) => r.id === linkedSourceId) ?? linkableRecords[0];
    if (chosen) {
      const safeScope: NonAktaPartyCopyScope =
        linkPartyScope === 'pihak2_only' && !hasSecondPartyInRecord(chosen)
          ? 'pihak1_only'
          : linkPartyScope;
      setLinkPartyScope(safeScope);
      applyLinkedSourceRecord(chosen, safeScope, layanan);
    }
  };

  const handleLinkedRecordChange = (nextRecordId: string) => {
    setLinkedSourceId(nextRecordId);
    const chosen = linkableRecords.find((r) => r.id === nextRecordId);
    if (!chosen) {
      setNonAkta((prev) => clearNonAktaLinkMetadata(prev));
      return;
    }
    const safeScope: NonAktaPartyCopyScope =
      linkPartyScope === 'pihak2_only' && !hasSecondPartyInRecord(chosen)
        ? 'pihak1_only'
        : linkPartyScope;
    setLinkPartyScope(safeScope);
    applyLinkedSourceRecord(chosen, safeScope, layanan);
  };

  const handleLinkPartyScopeChange = (nextScope: NonAktaPartyCopyScope) => {
    setLinkPartyScope(nextScope);
    if (linkedSourceRecord) {
      applyLinkedSourceRecord(linkedSourceRecord, nextScope, layanan);
    }
  };

  const handleServiceChange = (nextLayanan: ServiceType) => {
    setLayanan(nextLayanan);
    if (!isAktaService(nextLayanan)) {
      setReviewDocKey('02_lampiran_bundel');
      setNonAkta((prev) => {
        const locationParts = [
          tanah.desa ? `Desa ${tanah.desa}` : '',
          tanah.kecamatan ? `Kecamatan ${tanah.kecamatan}` : '',
          tanah.kabupaten || '',
        ].filter(Boolean);
        return {
          ...prev,
          sub_permohonan_ukur:
            nextLayanan === 'Pemecahan'
              ? 'Pemecahan'
              : nextLayanan === 'Ukur Ulang' || nextLayanan === 'Pemecahan/Ukur Ulang'
              ? 'Pengukuran'
              : prev.sub_permohonan_ukur,
          pkkpr_alamat_lokasi:
            nextLayanan === 'Permohonan PKKPR'
              ? prev.pkkpr_alamat_lokasi?.trim() || locationParts.join(', ')
              : prev.pkkpr_alamat_lokasi,
        };
      });
    } else {
      setReviewDocKey('01_akta');
    }
    if (!editingRecord) {
      setAkta((prev) => ({
        ...prev,
        npoptkp: getDefaultNpoptkp(nextLayanan, settings),
      }));
    }
  };

  const handleFilesSelected = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const incoming = Array.from(filesList);
    setPreparingFiles(true);
    try {
      const projectedCount = uploadedFiles.length + incoming.length;
      const optimizeOpts =
        projectedCount >= 3
          ? { maxEdge: 960, quality: 0.72, skipBelowBytes: 75 * 1024 }
          : { maxEdge: 1120, quality: 0.76, skipBelowBytes: 90 * 1024 };

      const added = await Promise.all(
        incoming.map(async (file) => {
          const optimized = await optimizeDocumentFile(file, optimizeOpts);
          return {
            id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name || `dokumen-${Date.now()}.jpg`,
            mimeType: optimized.mimeType,
            size: optimized.size,
            originalSize: optimized.originalSize,
            dataBase64: optimized.dataBase64,
          } satisfies UploadedDocFile;
        })
      );

      setUploadedFiles((prev) => [...prev, ...added]);
      setExtractError(null);
    } catch (err) {
      const msg =
        err instanceof Error
          ? `Gagal membaca file dokumen: ${err.message}`
          : 'Gagal membaca file dokumen dari perangkat.';
      setExtractError(msg);
      onNotify(msg, 'error');
    } finally {
      setPreparingFiles(false);
    }
  };

  const handleCancelExtractAi = () => {
    extractAbortRef.current?.abort();
    extractAbortRef.current = null;
    setExtracting(false);
    setExtractError('Pemindaian AI dibatalkan. Anda dapat mencoba ulang atau lanjut verifikasi manual.');
  };

  const handleExtractAi = async () => {
    if (uploadedFiles.length === 0) {
      setExtractError('Unggah minimal 1 dokumen (KTP, KK, Sertipikat, SPPT PBB, atau SKW) sebelum menjalankan ekstraksi AI.');
      return;
    }

    extractAbortRef.current?.abort();
    const controller = new AbortController();
    extractAbortRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 60000);

    setExtracting(true);
    setExtractError(null);

    try {
      const payloadFiles = uploadedFiles.map((f) => ({
        name: f.name,
        mimeType: f.mimeType,
        dataBase64: f.dataBase64,
      }));

      const estimatedBytes = estimateScanPayloadBytes(payloadFiles);
      if (estimatedBytes > 12 * 1024 * 1024) {
        throw new Error(
          `Ukuran total dokumen (${formatCompactFileSize(estimatedBytes)}) melebihi batas pengiriman 12 MB. Kurangi jumlah file atau pindai secara bertahap.`
        );
      }

      const parsed = await postScanJson<ExtractionApiResponse>(
        '/api/extract-documents',
        {
          layanan,
          scanMode,
          files: payloadFiles,
        },
        { signal: controller.signal }
      );

      if (Array.isArray(parsed.para_pihak) && parsed.para_pihak.length > 0) {
        setParaPihak(
          parsed.para_pihak.map((p, idx) => ({
            id: `p-ai-${Date.now()}-${idx}`,
            peran: mapSuggestedRole(p.peran_saran),
            nik: p.nik || '',
            nama: toScanUpperName(p.nama),
            tempat_lahir: toScanTitleCase(p.tempat_lahir),
            tanggal_lahir: p.tanggal_lahir?.trim()
              ? formatTanggalDDMMYYYY(p.tanggal_lahir)
              : '',
            jenis_kelamin: normalizeScanGender(p.jenis_kelamin) || 'Laki-laki',
            alamat_jalan: toScanTitleCase(p.alamat_jalan),
            rt_rw: p.rt_rw || '',
            desa_kelurahan: toScanTitleCase(p.desa_kelurahan),
            kecamatan: toScanTitleCase(p.kecamatan),
            kabupaten: toScanTitleCase(p.kabupaten),
            pekerjaan: toScanTitleCase(p.pekerjaan),
            status_perkawinan: toScanTitleCase(p.status_perkawinan),
          }))
        );
      }

      if (parsed.tanah) {
        const holders = Array.isArray(parsed.tanah.pemegang_hak_sertipikat)
          ? parsed.tanah.pemegang_hak_sertipikat
              .map((h) => toScanUpperName(h))
              .filter(Boolean)
          : [];
        const detectedCertType = resolveJenisSertipikat({
          jenis_sertipikat:
            parsed.tanah.jenis_sertipikat === 'digital' ||
            parsed.tanah.jenis_sertipikat === 'analog'
              ? parsed.tanah.jenis_sertipikat
              : undefined,
          surat_ukur_nomor: parsed.tanah.surat_ukur_nomor,
          nomor_hak_lama: parsed.tanah.nomor_hak_lama,
        });
        setTanah((prev) => ({
          ...prev,
          jenis_sertipikat: detectedCertType,
          jenis_hak: toScanTitleCase(parsed.tanah.jenis_hak) || 'Hak Milik',
          nib: parsed.tanah.nib || '',
          nomor_hak_lama:
            detectedCertType === 'analog' ? parsed.tanah.nomor_hak_lama || '' : '',
          surat_ukur_tanggal: parsed.tanah.surat_ukur_tanggal || '',
          surat_ukur_nomor: parsed.tanah.surat_ukur_nomor || '',
          luas_m2:
            resolveAccurateLuasBumiM2(parsed.tanah.luas_m2, parsed.pbb) ??
            (Number(parsed.tanah.luas_m2) || 0),
          desa: toScanTitleCase(parsed.tanah.desa || parsed.pbb?.letak_objek_desa || ''),
          kecamatan: toScanTitleCase(
            parsed.tanah.kecamatan || parsed.pbb?.letak_objek_kecamatan || ''
          ),
          kabupaten:
            toScanTitleCase(
              parsed.tanah.kabupaten || parsed.pbb?.letak_objek_kabupaten || ''
            ) || settings.nama_kabupaten,
          provinsi:
            toScanTitleCase(parsed.tanah.provinsi) || settings.nama_provinsi || 'Jawa Tengah',
          batas_utara: toScanTitleCase(parsed.tanah.batas_utara),
          batas_timur: toScanTitleCase(parsed.tanah.batas_timur),
          batas_selatan: toScanTitleCase(parsed.tanah.batas_selatan),
          batas_barat: toScanTitleCase(parsed.tanah.batas_barat),
          dasar_perolehan: toScanTitleCase(parsed.tanah.dasar_perolehan),
          pemegang_hak_sertipikat: holders,
        }));
        setPemegangHakInput(holders.join(', '));
      }

      if (parsed.pbb) {
        const accurateBangunan = resolveAccurateBangunanFromPbb(parsed.pbb);
        setPbb({
          nop: parsed.pbb.nop || '',
          tahun_pajak: parsed.pbb.tahun_pajak || String(new Date().getFullYear()),
          njop_bumi_m2: Number(parsed.pbb.njop_bumi_m2) || 0,
          luas_bangunan_m2: accurateBangunan.luas_bangunan_m2 ?? 0,
          njop_bangunan_m2: accurateBangunan.njop_bangunan_m2 ?? 0,
          njop_bangunan: accurateBangunan.njop_bangunan ?? (Number(parsed.pbb.njop_bangunan) || 0),
        });
      }

      if (Array.isArray(parsed.audit_warnings)) {
        setAiWarnings(
          parsed.audit_warnings.map((w, idx) => ({
            id: `ai-w-${idx}`,
            tingkat:
              w.tingkat === 'tinggi' || w.tingkat === 'sedang' ? w.tingkat : 'info',
            judul: w.judul || 'Temuan Verifikasi AI',
            deskripsi: w.deskripsi || '',
          }))
        );
      }

      const summaryBits: string[] = [];
      if (Array.isArray(parsed.para_pihak) && parsed.para_pihak.length > 0) {
        summaryBits.push(`${parsed.para_pihak.length} Pihak`);
      }
      if (
        parsed.tanah &&
        (parsed.tanah.nomor_hak_lama || parsed.tanah.nib || parsed.tanah.luas_m2 > 0)
      ) {
        summaryBits.push('Sertipikat');
      }
      if (parsed.pbb && (parsed.pbb.nop || parsed.pbb.njop_bumi_m2 > 0)) {
        summaryBits.push('SPPT PBB');
      }

      onNotify(
        summaryBits.length > 0
          ? `Ekstraksi AI selesai (${summaryBits.join(' · ')} terbaca). Silakan verifikasi hasil pada Langkah 2.`
          : 'Ekstraksi dokumen selesai. Silakan verifikasi hasil pada Langkah 2.',
        'success'
      );
      setStep(2);
    } catch (err) {
      const isAbort =
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError');
      if (isAbort && !timedOut) {
        return;
      }
      const msg = isAbort
        ? 'Pemindaian dokumen melebihi batas waktu. Perkecil jumlah file atau gunakan Mode Cepat.'
        : err instanceof Error
        ? err.message
        : 'Terjadi kesalahan saat memindai dokumen dengan AI.';
      setExtractError(msg);
      onNotify(msg, 'error');
    } finally {
      window.clearTimeout(timeoutId);
      if (extractAbortRef.current === controller) {
        extractAbortRef.current = null;
      }
      setExtracting(false);
    }
  };

  const combinedAuditWarnings = useMemo(() => {
    const tanahWithHolders: DataTanah = {
      ...tanah,
      pemegang_hak_sertipikat: pemegangHakInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const clientWarnings = runClientAuditWarnings(paraPihak, tanahWithHolders, {
      butuhPersetujuanPasangan: akta.butuh_persetujuan_pasangan ?? true,
      layanan,
    });
    const seen = new Set<string>();
    const merged: AuditWarning[] = [];
    for (const w of [...aiWarnings, ...clientWarnings]) {
      if (!seen.has(w.id)) {
        seen.add(w.id);
        merged.push(w);
      }
    }
    return merged;
  }, [aiWarnings, paraPihak, tanah, pemegangHakInput, akta.butuh_persetujuan_pasangan, layanan]);

  const aphbSelectedRoles = useMemo(
    () => normalizeAphbRecipientRoles(paraPihak, akta),
    [paraPihak, akta]
  );

  const aphbHolderCount = useMemo(() => {
    const partyCount = paraPihak.filter((p) => p.peran.startsWith('Pihak ')).length;
    if (partyCount >= 2) return partyCount;
    return getDefaultAphbHolderCount(paraPihak, akta);
  }, [paraPihak, akta]);

  const taxCalc = useMemo(
    () =>
      calculateLandTaxes({
        luas_m2: tanah.luas_m2,
        harga_per_m2: akta.harga_per_m2,
        njop_bumi_m2: pbb.njop_bumi_m2,
        luas_bangunan_m2: pbb.luas_bangunan_m2,
        njop_bangunan_m2: pbb.njop_bangunan_m2,
        njop_bangunan: pbb.njop_bangunan,
        npoptkp: akta.npoptkp,
        layanan,
        nilai_transaksi_override: akta.nilai_transaksi_override,
        aphb_jumlah_pemegang_hak: layanan === 'APHB' ? aphbHolderCount : undefined,
        aphb_jumlah_penerima: layanan === 'APHB' ? aphbSelectedRoles.length : undefined,
      }),
    [tanah.luas_m2, akta, pbb, layanan, aphbHolderCount, aphbSelectedRoles]
  );

  const formattedAktaDate = useMemo(
    () => formatTanggalLengkapHuruf(akta.tanggal_akta),
    [akta.tanggal_akta]
  );

  const buildCurrentRecord = (): BerkasRecord => {
    const id =
      savedRecordId ||
      editingRecord?.id ||
      `reg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const noUrut = editingRecord?.no_urut ?? nextSuggestion.noUrut;
    const year = String(
      extractMonthYearFromDate(akta.tanggal_akta || today)?.year ??
        new Date().getFullYear()
    );
    const kodeBerkas =
      editingRecord?.kode_berkas ||
      `REG-${year}-${String(noUrut).padStart(3, '0')}`;

    const finalTanah: DataTanah = {
      ...tanah,
      pemegang_hak_sertipikat: pemegangHakInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const finalAkta: ParameterAkta =
      layanan === 'APHB'
        ? {
            ...akta,
            pihak_penerima_aphb: aphbSelectedRoles[0] ?? akta.pihak_penerima_aphb ?? 'Pihak II',
            pihak_penerima_aphb_list: aphbSelectedRoles,
            aphb_jumlah_pemegang_hak: aphbHolderCount,
            aphb_jumlah_penerima: aphbSelectedRoles.length,
          }
        : akta;

    return {
      id,
      no_urut: noUrut,
      kode_berkas: kodeBerkas,
      tanggal_masuk: editingRecord?.tanggal_masuk || today,
      layanan,
      status,
      para_pihak: paraPihak,
      tanah: finalTanah,
      pbb,
      audit_warnings: combinedAuditWarnings,
      akta: finalAkta,
      pajak: taxCalc,
      non_akta: isAktaService(layanan) ? undefined : nonAkta,
      updated_at: new Date().toISOString(),
    };
  };

  const reviewRecord = useMemo<BerkasRecord>(() => {
    const id = savedRecordId || editingRecord?.id || 'preview-draft';
    const noUrut = editingRecord?.no_urut ?? nextSuggestion.noUrut;
    const year = String(
      extractMonthYearFromDate(akta.tanggal_akta || today)?.year ??
        new Date().getFullYear()
    );
    const kodeBerkas =
      editingRecord?.kode_berkas ||
      `REG-${year}-${String(noUrut).padStart(3, '0')}`;
    const finalTanah: DataTanah = {
      ...tanah,
      pemegang_hak_sertipikat: pemegangHakInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    return {
      id,
      no_urut: noUrut,
      kode_berkas: kodeBerkas,
      tanggal_masuk: editingRecord?.tanggal_masuk || today,
      layanan,
      status,
      para_pihak: paraPihak,
      tanah: finalTanah,
      pbb,
      audit_warnings: combinedAuditWarnings,
      akta,
      pajak: taxCalc,
      non_akta: isAktaService(layanan) ? undefined : nonAkta,
      updated_at: editingRecord?.updated_at || today,
    };
  }, [
    savedRecordId,
    editingRecord,
    nextSuggestion.noUrut,
    akta,
    today,
    tanah,
    pemegangHakInput,
    layanan,
    status,
    paraPihak,
    pbb,
    combinedAuditWarnings,
    taxCalc,
    nonAkta,
  ]);

  const handleSaveOnly = async () => {
    try {
      const rec = buildCurrentRecord();
      await onSaveRecord(rec);
      setSavedRecordId(rec.id);
      setBundleFinished(true);
      onNotify(`Berkas ${rec.kode_berkas} berhasil disimpan ke Buku Register Akta.`, 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? `Gagal menyimpan berkas: ${err.message}` : 'Gagal menyimpan berkas.',
        'error'
      );
    }
  };

  const handleGenerateZipAndSave = async () => {
    setGeneratingBundle(true);
    try {
      const rec = buildCurrentRecord();
      await onSaveRecord(rec);
      setSavedRecordId(rec.id);
      const result = await generateAndDownloadBundleZip(rec, settings, customTemplates);
      setBundleFinished(true);
      onNotify(
        isAktaService(rec.layanan)
          ? `Berhasil membuat ${result.fileCount} dokumen Word (Akta A4 & Lampiran F4) dalam ${result.zipFileName} dan memperbarui Buku Register.`
          : `Berhasil membuat bundel Non-Akta F4 (${result.fileCount} file) dalam ${result.zipFileName} tanpa Akta A4.`,
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error
          ? `Gagal generate bundel Word: ${err.message}`
          : 'Gagal generate bundel .DOCX.',
        'error'
      );
    } finally {
      setGeneratingBundle(false);
    }
  };

  const handleDownloadSingle = async (docKey: TemplateDocKey) => {
    setGeneratingBundle(true);
    try {
      const rec = buildCurrentRecord();
      await onSaveRecord(rec);
      setSavedRecordId(rec.id);
      const result = await generateAndDownloadSingleDocx(rec, settings, customTemplates, docKey);
      setBundleFinished(true);
      onNotify(`Berhasil mengunduh ${result.fileName} dan menyimpan berkas ke Buku Register.`, 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? `Gagal mengunduh dokumen: ${err.message}` : 'Gagal mengunduh .DOCX.',
        'error'
      );
    } finally {
      setGeneratingBundle(false);
    }
  };

  const handleFinishWizard = async (mode: 'dashboard' | 'new') => {
    if (finishingAction !== null || generatingBundle) return;
    setFinishingAction(mode);
    try {
      const rec = buildCurrentRecord();
      await onSaveRecord(rec);
      setSavedRecordId(rec.id);
      if (mode === 'dashboard') {
        onFinishToDashboard(rec.kode_berkas);
      } else {
        onFinishAndCreateNew(rec.kode_berkas);
      }
    } catch (err) {
      onNotify(
        err instanceof Error
          ? `Gagal menyimpan berkas sebelum selesai: ${err.message}`
          : 'Gagal menyimpan berkas.',
        'error'
      );
    } finally {
      setFinishingAction(null);
    }
  };

  const updateParty = (id: string, patch: Partial<ParaPihak>) => {
    setParaPihak((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const removeParty = (id: string) => {
    setParaPihak((prev) => prev.filter((p) => p.id !== id));
  };

  const handleGeotagPhotoUpload = async (
    field:
      | 'foto_tampak_depan'
      | 'foto_patok_1'
      | 'foto_patok_2'
      | 'foto_patok_3'
      | 'foto_patok_4'
      | 'foto_poligon'
      | 'foto_sket_pecah',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const optimized = await optimizeDocumentFile(file, {
        maxEdge: 960,
        quality: 0.72,
      });
      const dataUrl = `data:${optimized.mimeType};base64,${optimized.dataBase64}`;
      setNonAkta((prev) => ({ ...prev, [field]: dataUrl }));
      onNotify(`Foto ${file.name} berhasil disematkan ke lampiran Geotagging.`, 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal membaca file foto Geotagging.',
        'error'
      );
    }
  };

  const SERVICE_VISUALS: Record<
    ServiceType,
    {
      Icon: React.ComponentType<{ className?: string }>;
      tone: GlossyTone;
      subtitle: string;
    }
  > = {
    AJB: { Icon: Handshake, tone: 'teal', subtitle: 'Akta A4 + Lampiran F4' },
    APHB: { Icon: Users, tone: 'sky', subtitle: 'Akta A4 + Lampiran F4' },
    'Akta Hibah': { Icon: Gift, tone: 'emerald', subtitle: 'Akta A4 + Lampiran F4' },
    'Turun Waris': { Icon: ScrollText, tone: 'amber', subtitle: 'Non-Akta · Bundel F4' },
    'Waris C': { Icon: ScrollText, tone: 'amber', subtitle: 'Non-Akta · Letter C F4' },
    Pemecahan: { Icon: Grid2x2, tone: 'indigo', subtitle: 'Non-Akta · Bundel F4' },
    'Ukur Ulang': { Icon: Compass, tone: 'cyan', subtitle: 'Non-Akta · Bundel F4' },
    'Ralat Data': { Icon: FilePenLine, tone: 'violet', subtitle: 'Non-Akta · Bundel F4' },
    'Pengecekan Sertipikat': { Icon: FileSearch, tone: 'teal', subtitle: 'Non-Akta · Cek BPN F4' },
    'Validasi Sertipikat': { Icon: ShieldCheck, tone: 'emerald', subtitle: 'Non-Akta · Geotag F4' },
    'Analisis Bidang': { Icon: MapPin, tone: 'sky', subtitle: 'Non-Akta · Poligon F4' },
    'Permohonan PKKPR': { Icon: Building2, tone: 'rose', subtitle: 'Non-Akta · DPMPTSP F4' },
    'Pemecahan/Ukur Ulang': { Icon: Grid2x2, tone: 'indigo', subtitle: 'Non-Akta · Bundel F4' },
  };

  const wizardSteps = [
    { num: 1 as const, short: 'Layanan & AI', label: '1. Layanan & Upload AI' },
    { num: 2 as const, short: 'Verifikasi', label: '2. Meja Verifikasi & Audit' },
    {
      num: 3 as const,
      short: isAkta ? 'Parameter Akta' : 'Pengesahan',
      label: isAkta
        ? '3. Parameter Akta & Saksi'
        : '3. Pengesahan & Detail Berkas',
    },
    {
      num: 4 as const,
      short: isAkta ? 'Bundel .ZIP' : 'Unduh F4',
      label: isAkta ? '4. Generate Bundel .ZIP' : '4. Review & Unduh F4',
    },
  ];
  const progressPercent = ((step - 1) / (wizardSteps.length - 1)) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative rounded-xl bg-[#FFFBF0]/85 dark:bg-[#0B1F3A]/85 backdrop-blur-sm border border-[#C89B3C]/70 px-4 py-3 pr-16 sm:pr-24 shadow-[0_4px_16px_rgba(11,31,58,0.18)] max-w-3xl">
          <h1 className="font-cinzel text-lg sm:text-[24px] font-extrabold tracking-tight text-[#0B1F3A] dark:text-[#F4C430] leading-snug">
            {editingRecord
              ? `Edit / Revisi Berkas — ${editingRecord.kode_berkas}`
              : 'Buat Berkas Baru (Wizard 4 Langkah)'}
          </h1>
          <p className="text-xs sm:text-sm text-[#4A3520] dark:text-slate-200 mt-0.5 font-medium">
            Alur terpandu dari unggah berkas &amp; ekstraksi AI, verifikasi audit, parameter akta &amp; saksi, hingga dokumen Word (.DOCX · Akta A4 &amp; 1 File Lampiran F4). Perhitungan pajak dilakukan di menu terpisah.
          </p>
          {/* Decorative Chopper Chibi Sticker (non-blocking) */}
          <img
            src="/chopper-chibi.png"
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="pointer-events-none select-none absolute -bottom-2 right-1.5 sm:right-2.5 z-10 w-[56px] sm:w-[76px] h-auto drop-shadow-[0_4px_8px_rgba(11,31,58,0.38)]"
          />
        </div>

        {editingRecord && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="btn-3d btn-3d-light inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>Batal Edit &amp; Buat Baru</span>
          </button>
        )}
      </div>

      {/* Modern 3D Stepper with Bright Teal Progress Line */}
      <nav aria-label="Tahapan Wizard" className="bento-card p-4 sm:p-5">
        <div className="relative">
          {/* Connecting Progress Track (Desktop) */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-5 left-[12%] right-[12%] h-2 rounded-full bg-teal-900/10 dark:bg-teal-950/90 shadow-inner overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.65)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
            {wizardSteps.map((item) => {
              const active = step === item.num;
              const completed = step > item.num;
              return (
                <button
                  key={item.num}
                  type="button"
                  onClick={() => setStep(item.num)}
                  aria-current={active ? 'step' : undefined}
                  className={`group flex items-center lg:flex-col lg:text-center gap-2.5 px-3 py-2.5 rounded-2xl border transition-all duration-150 ${
                    active
                      ? 'bg-gradient-to-br from-teal-50 to-emerald-50/80 dark:from-teal-900/60 dark:to-emerald-950/60 border-teal-400 dark:border-teal-500/70 border-b-4 border-b-teal-600 shadow-[0_10px_22px_-8px_rgba(20,184,166,0.35)] -translate-y-0.5'
                      : completed
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/35 border-emerald-200/80 dark:border-emerald-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/60'
                      : 'bg-white/80 dark:bg-[#091F22]/80 border-teal-900/8 dark:border-teal-400/15 hover:bg-teal-50/40 dark:hover:bg-teal-900/30'
                  }`}
                >
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 transition-all duration-150 ${
                      active
                        ? 'bg-gradient-to-b from-teal-400 to-teal-600 text-white border-b-2 border-teal-800 shadow-[inset_0_2px_3px_rgba(255,255,255,0.55),0_6px_14px_-2px_rgba(20,184,166,0.65)] scale-105'
                        : completed
                        ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[inset_0_2px_3px_rgba(255,255,255,0.5),0_4px_10px_-2px_rgba(16,185,129,0.5)]'
                        : 'bg-teal-900/8 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-900/12 dark:border-teal-700/60'
                    }`}
                  >
                    {completed ? <Check className="w-4 h-4 stroke-[3]" /> : item.num}
                  </span>
                  <div className="min-w-0 text-left lg:text-center">
                    <span
                      className={`block text-xs font-bold leading-tight truncate ${
                        active
                          ? 'text-teal-950 dark:text-white'
                          : completed
                          ? 'text-emerald-900 dark:text-emerald-200'
                          : 'text-slate-600 dark:text-teal-200/75'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="bento-card p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Pilih Jenis Layanan Pertanahan
              </h2>
              <p className="text-xs text-slate-500 dark:text-teal-200/70 mt-0.5">
                Klik jenis layanan untuk menyesuaikan otomatis format dokumen A4/F4 dan kolom verifikasi.
              </p>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                1. Layanan Akta PPATS (Blangko Akta A4 + Lampiran F4 · Masuk Laporan Bulanan PPATS)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {AKTA_SERVICE_TYPES.map((type) => {
                  const selected = layanan === type;
                  const visual = SERVICE_VISUALS[type];
                  const IconComp = visual.Icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleServiceChange(type)}
                      aria-pressed={selected}
                      className={`relative p-4 rounded-2xl text-left transition-all duration-150 flex items-center gap-3.5 ${
                        selected
                          ? 'border-2 border-teal-500 border-b-4 border-b-teal-700 bg-gradient-to-br from-teal-50 via-white to-emerald-50/80 dark:from-teal-900/65 dark:via-[#0E2E33] dark:to-emerald-950/65 text-teal-950 dark:text-white shadow-[0_14px_28px_-8px_rgba(20,184,166,0.35)] -translate-y-1'
                          : 'border border-teal-900/10 dark:border-teal-400/15 border-b-2 border-b-teal-900/12 dark:border-b-black/40 bg-white dark:bg-[#091F22] hover:bg-teal-50/40 dark:hover:bg-teal-900/35 hover:-translate-y-0.5 text-slate-800 dark:text-teal-100 shadow-xs'
                      }`}
                    >
                      {selected && (
                        <span
                          aria-hidden="true"
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-b from-teal-400 to-emerald-600 text-white flex items-center justify-center border-2 border-white dark:border-[#0D262A] shadow-[0_4px_10px_rgba(16,185,129,0.55)]"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                      <GlossyIcon3D tone={visual.tone} size="sm">
                        <IconComp className="w-5 h-5" />
                      </GlossyIcon3D>
                      <div className="min-w-0">
                        <span className="block text-sm font-bold truncate">{type}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-teal-200/75 mt-0.5 truncate">
                          {visual.subtitle}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                2. Berkas Non-Akta (Hanya Bundel F4 · Tidak Masuk Laporan Bulanan PPATS)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {NON_AKTA_SERVICE_TYPES.map((type) => {
                  const selected = layanan === type;
                  const visual = SERVICE_VISUALS[type];
                  const IconComp = visual.Icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleServiceChange(type)}
                      aria-pressed={selected}
                      className={`relative p-3.5 rounded-2xl text-left transition-all duration-150 flex items-center gap-3 ${
                        selected
                          ? 'border-2 border-teal-500 border-b-4 border-b-teal-700 bg-gradient-to-br from-teal-50 via-white to-emerald-50/80 dark:from-teal-900/65 dark:via-[#0E2E33] dark:to-emerald-950/65 text-teal-950 dark:text-white shadow-[0_14px_28px_-8px_rgba(20,184,166,0.35)] -translate-y-1'
                          : 'border border-teal-900/10 dark:border-teal-400/15 border-b-2 border-b-teal-900/12 dark:border-b-black/40 bg-white dark:bg-[#091F22] hover:bg-teal-50/40 dark:hover:bg-teal-900/35 hover:-translate-y-0.5 text-slate-800 dark:text-teal-100 shadow-xs'
                      }`}
                    >
                      {selected && (
                        <span
                          aria-hidden="true"
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-b from-teal-400 to-emerald-600 text-white flex items-center justify-center border-2 border-white dark:border-[#0D262A] shadow-[0_4px_10px_rgba(16,185,129,0.55)]"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                      <GlossyIcon3D tone={visual.tone} size="sm">
                        <IconComp className="w-4.5 h-4.5" />
                      </GlossyIcon3D>
                      <div className="min-w-0">
                        <span className="block text-sm font-bold truncate">{type}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-teal-200/75 mt-0.5 truncate">
                          {visual.subtitle}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {!isAkta && (
              <div className="space-y-3">
                {/* Sumber Data Berkas Non-Akta: Input Mandiri vs Kaitkan ke Berkas Terdaftar */}
                <div className="rounded-xl border border-[#E2D5C1] dark:border-[#1E3A54] bg-[#FFFDF9] dark:bg-[#0E2236] p-4 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div
                      role="tablist"
                      aria-label="Mode Sumber Data Berkas Non-Akta"
                      className="inline-flex items-center gap-1 p-1 bg-[#F3ECE0] dark:bg-[#132C44] rounded-lg border border-[#E2D5C1] dark:border-[#244564] w-fit"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={nonAktaSourceMode === 'manual'}
                        onClick={() => handleSelectNonAktaMode('manual')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          nonAktaSourceMode === 'manual'
                            ? 'bg-[#0F2942] dark:bg-[#1D4A73] text-[#F8FAFC]'
                            : 'text-[#6B5E4C] dark:text-slate-300 hover:text-[#0F2942] dark:hover:text-white'
                        }`}
                      >
                        Input Mandiri (Baru)
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={nonAktaSourceMode === 'linked'}
                        disabled={linkableRecords.length === 0}
                        onClick={() => handleSelectNonAktaMode('linked')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-50 ${
                          nonAktaSourceMode === 'linked'
                            ? 'bg-[#0F2942] dark:bg-[#1D4A73] text-[#F8FAFC]'
                            : 'text-[#6B5E4C] dark:text-slate-300 hover:text-[#0F2942] dark:hover:text-white'
                        }`}
                      >
                        Kaitkan ke Berkas Terdaftar ({linkableRecords.length})
                      </button>
                    </div>

                    {nonAktaSourceMode === 'linked' && (
                      <div className="flex items-center gap-2.5 flex-1 lg:max-w-xl">
                        <label
                          htmlFor="non-akta-linked-berkas-select"
                          className="text-xs font-semibold text-slate-600 dark:text-teal-200/80 whitespace-nowrap"
                        >
                          Pilih Berkas:
                        </label>
                        <select
                          id="non-akta-linked-berkas-select"
                          value={linkedSourceId}
                          onChange={(e) => handleLinkedRecordChange(e.target.value)}
                          className="input-airy w-full px-3.5 py-2 text-xs font-medium"
                        >
                          <option value="">-- Pilih berkas terdaftar --</option>
                          {linkableRecords.map((r) => (
                            <option key={r.id} value={r.id}>
                              {formatLinkableBerkasOptionLabel(r)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {nonAktaSourceMode === 'linked' && linkedSourceRecord && (
                    <div className="rounded-xl border border-teal-200/90 dark:border-teal-500/30 bg-teal-50/75 dark:bg-teal-950/50 px-3.5 py-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#0F2942] dark:bg-[#1D4A73] text-white flex items-center justify-center shrink-0 mt-0.5">
                          <Link2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 text-xs">
                          <p className="font-bold text-teal-950 dark:text-teal-50">
                            Terkait ke {linkedSourceRecord.kode_berkas} ({linkedSourceRecord.layanan})
                          </p>
                          <p className="text-teal-800/85 dark:text-teal-200/80 mt-0.5">
                            Data Pemohon ({paraPihak.length} pihak), Sertipikat ({tanah.jenis_hak}{' '}
                            {tanah.nib || tanah.nomor_hak_lama || '-'} · Desa {tanah.desa || '-'}), PBB &amp; Kuasa BPN telah terisi otomatis.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <div
                          role="group"
                          aria-label="Cakupan Pihak yang Disalin"
                          className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/90 dark:bg-[#081F22] border border-teal-900/10 dark:border-teal-400/20 text-[11px]"
                        >
                          <button
                            type="button"
                            onClick={() => handleLinkPartyScopeChange('pihak1_only')}
                            aria-pressed={linkPartyScope === 'pihak1_only'}
                            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                              linkPartyScope === 'pihak1_only'
                                ? 'bg-teal-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-teal-200/80 hover:text-teal-900 dark:hover:text-white'
                            }`}
                          >
                            Pemilik (Pihak I)
                          </button>
                          {hasSecondPartyInRecord(linkedSourceRecord) && (
                            <button
                              type="button"
                              onClick={() => handleLinkPartyScopeChange('pihak2_only')}
                              aria-pressed={linkPartyScope === 'pihak2_only'}
                              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                                linkPartyScope === 'pihak2_only'
                                  ? 'bg-teal-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-teal-200/80 hover:text-teal-900 dark:hover:text-white'
                              }`}
                            >
                              Penerima (Pihak II)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleLinkPartyScopeChange('all_pihak')}
                            aria-pressed={linkPartyScope === 'all_pihak'}
                            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                              linkPartyScope === 'all_pihak'
                                ? 'bg-teal-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-teal-200/80 hover:text-teal-900 dark:hover:text-white'
                            }`}
                          >
                            Semua Pihak
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="btn-3d btn-3d-teal inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold"
                        >
                          <span>Lanjut Verifikasi</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-2xl border border-sky-200/90 dark:border-sky-700/50 bg-sky-50/75 dark:bg-sky-950/45 text-xs text-sky-950 dark:text-sky-100">
                  <strong>Catatan Berkas Non-Akta ({layanan}):</strong> Berkas ini{' '}
                  <strong>tidak menerbitkan Akta A4</strong>,{' '}
                  <strong>tidak masuk dalam Laporan Bulanan PPATS</strong>, dan hanya menghasilkan 1 file bundel Word ukuran F4. Pengesahan dokumen dapat diatur di Langkah 3 (SKW &amp; Beda Nama otomatis 2 pengesahan Camat + Kepala Desa asal sertipikat; dokumen lainnya default PPATS atau pilih Kepala Desa / isi manual).
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Unggah Dokumen Pendukung (KTP, KK, Sertipikat Tanah/Elektronik, SPPT PBB, SKW)
              </h2>
              <div
                role="group"
                aria-label="Mode Pemindaian AI"
                className="inline-flex rounded-lg border border-[#E2D5C1] dark:border-[#244564] bg-[#F3ECE0] dark:bg-[#132C44] p-1 text-xs shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setScanMode('fast')}
                  aria-pressed={scanMode === 'fast'}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    scanMode === 'fast'
                      ? 'bg-[#0F2942] dark:bg-[#1D4A73] text-[#F8FAFC]'
                      : 'text-[#6B5E4C] dark:text-slate-300 hover:text-[#0F2942] dark:hover:text-white'
                  }`}
                >
                  Mode Cepat
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('accurate')}
                  aria-pressed={scanMode === 'accurate'}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    scanMode === 'accurate'
                      ? 'bg-[#B91C1C] dark:bg-[#B91C1C] text-white'
                      : 'text-[#6B5E4C] dark:text-slate-300 hover:text-[#0F2942] dark:hover:text-white'
                  }`}
                >
                  Mode Detail
                </button>
              </div>
            </div>

            {/* Clean Flat AI Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFilesSelected(e.dataTransfer.files);
              }}
              className={`dropzone-3d-inset border border-dashed rounded-xl p-8 sm:p-10 text-center transition-colors ${
                isDragging
                  ? 'border-[#D97706] bg-[#FAF3E3] dark:bg-[#163450]'
                  : 'border-[#D5C6AE] dark:border-[#254563] bg-[#FAF6EE] dark:bg-[#0B1D2E]/70 hover:border-[#0F2942] dark:hover:border-[#D97706]/60'
              }`}
            >
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <GlossyIcon3D tone="teal" size="lg">
                    <UploadCloud className="w-7 h-7" />
                  </GlossyIcon3D>
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#D97706] text-white flex items-center justify-center border-2 border-[#FFFDF9] dark:border-[#0E2236]"
                  >
                    <Sparkles className="w-3 h-3" />
                  </span>
                </div>
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Tarik dan lepaskan multi-file PDF, Word (.docx/.doc), atau Foto/Scan (JPG, PNG, WebP) di sini
              </p>
              <p className="text-xs text-slate-600 dark:text-teal-200/75 mt-1 max-w-xl mx-auto">
                {scanMode === 'fast'
                  ? 'Mode Cepat: ekstraksi AI berkecepatan tinggi dengan kompresi foto & pembacaan Word (.docx/.doc) otomatis untuk KTP, KK, Sertipikat, Letter C, dan SPPT.'
                  : 'Mode Detail: pembacaan AI mendalam untuk dokumen buram, tulisan tangan, atau multi-halaman dengan penyesuaian otomatis jika antrean sibuk.'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <label className="btn-3d btn-3d-light inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer">
                  <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-300" />
                  <span>{preparingFiles ? 'Mengoptimalkan file...' : 'Pilih File Dokumen'}</span>
                  <input
                    type="file"
                    multiple
                    accept={SCAN_DOC_FILE_ACCEPT}
                    onChange={(e) => {
                      void handleFilesSelected(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
                <label className="btn-3d btn-3d-sky inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Foto Kamera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      void handleFilesSelected(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="border border-teal-900/12 dark:border-teal-400/20 rounded-2xl divide-y divide-teal-900/8 dark:divide-teal-400/15 bg-white/80 dark:bg-[#091F22]">
                {uploadedFiles.map((file) => {
                  const wasCompressed =
                    typeof file.originalSize === 'number' && file.originalSize > file.size * 1.1;
                  return (
                    <div
                      key={file.id}
                      className="flex items-center justify-between px-4 py-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-teal-600 dark:text-teal-300 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-teal-50 truncate">
                          {file.name}
                        </span>
                        <span className="font-mono text-xs text-slate-500 dark:text-teal-200/70 shrink-0">
                          {wasCompressed && file.originalSize
                            ? `${formatCompactFileSize(file.originalSize)} → ${formatCompactFileSize(file.size)}`
                            : formatCompactFileSize(file.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setUploadedFiles((prev) =>
                            prev.filter((f) => f.id !== file.id)
                          )
                        }
                        aria-label={`Hapus file ${file.name}`}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {extractError && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl border border-rose-200 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/60 text-xs text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <div>
                    <p className="font-semibold">Pemindaian Otomatis Belum Berhasil</p>
                    <p className="mt-0.5 leading-relaxed">{extractError}</p>
                  </div>
                </div>
                {uploadedFiles.length > 0 && !extracting && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/cookie|muat ulang|kedaluwarsa|HTML/i.test(extractError) && (
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold whitespace-nowrap transition-colors"
                      >
                        <span>Muat Ulang Halaman</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleExtractAi()}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-rose-900/60 border border-rose-300 dark:border-rose-600/70 text-rose-800 dark:text-rose-100 hover:bg-rose-100 dark:hover:bg-rose-900 font-semibold whitespace-nowrap transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Coba Pindai Ulang</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-teal-900/10 dark:border-teal-400/15">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="btn-3d btn-3d-light inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            >
              <span>Lanjut Isi / Verifikasi Manual</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              {extracting && (
                <button
                  type="button"
                  onClick={handleCancelExtractAi}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Batalkan</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleExtractAi()}
                disabled={extracting || preparingFiles}
                className="btn-3d btn-3d-teal inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      Memindai Dokumen dengan AI ({extractElapsedSec} dtk)...
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-200" />
                    <span>Ekstrak Dokumen dengan AI &amp; Lanjut</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Audit Warnings Panel */}
          <div className="bento-card p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Hasil Audit &amp; Peringatan Verifikasi Berkas ({combinedAuditWarnings.length})
              </h2>
              {!isAkta && nonAkta.linked_berkas_kode && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-teal-50 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200 border border-teal-200/90 dark:border-teal-500/35">
                  <Link2 className="w-3.5 h-3.5" />
                  <span>
                    Terkait: {nonAkta.linked_berkas_kode}
                    {nonAkta.linked_berkas_layanan ? ` (${nonAkta.linked_berkas_layanan})` : ''}
                  </span>
                </span>
              )}
            </div>

            {combinedAuditWarnings.length === 0 ? (
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-950/50 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Tidak ditemukan kejanggalan data (NIK ganda, selisih nama sertipikat, atau persetujuan pasangan). Tetap lakukan pengecekan fisik dokumen asli.
                </span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {combinedAuditWarnings.map((w) => {
                  const tone =
                    w.tingkat === 'tinggi'
                      ? 'border-rose-200 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-100'
                      : w.tingkat === 'sedang'
                      ? 'border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-100'
                      : 'border-sky-200 dark:border-sky-700/60 bg-sky-50 dark:bg-sky-950/50 text-sky-900 dark:text-sky-100';
                  const label =
                    w.tingkat === 'tinggi'
                      ? 'Perhatian Tinggi'
                      : w.tingkat === 'sedang'
                      ? 'Perlu Cek'
                      : 'Informasi';

                  return (
                    <div
                      key={w.id}
                      className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${tone}`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">
                          [{label}] {w.judul}
                        </p>
                        <p className="mt-0.5 opacity-90">{w.deskripsi}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2 Inline Scan Status Banner */}
          {step2ScanNotice && (
            <div
              className={`rounded-2xl border px-4 py-3 text-xs flex items-center justify-between gap-3 ${
                step2ScanNotice.type === 'error'
                  ? 'border-rose-200 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-100'
                  : step2ScanNotice.type === 'success'
                  ? 'border-emerald-200 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100'
                  : 'border-sky-200 dark:border-sky-700/60 bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-100'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {step2ScanNotice.type === 'info' ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-sky-600 dark:text-sky-400" />
                ) : step2ScanNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span className="font-medium break-words">{step2ScanNotice.message}</span>
              </div>
              {step2ScanNotice.type !== 'info' && (
                <button
                  type="button"
                  onClick={() => setStep2ScanNotice(null)}
                  aria-label="Tutup notifikasi scan"
                  className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Para Pihak Editable List */}
          <div className="bento-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {isAkta
                    ? `Data Para Pihak (${paraPihak.length})`
                    : layanan === 'Turun Waris' || layanan === 'Waris C'
                    ? `Daftar Ahli Waris / Pemohon (${paraPihak.length})`
                    : `Data Pemohon / Pemilik Sertipikat (${paraPihak.length})`}
                </h2>
                <p className="text-xs text-slate-600 dark:text-teal-200/75 mt-0.5">
                  {layanan === 'AJB' || layanan === 'Akta Hibah'
                    ? `Akta ${layanan} hanya terdiri dari Pihak I (${layanan === 'AJB' ? 'Penjual' : 'Pemberi Hibah'}) dan Pihak II (${layanan === 'AJB' ? 'Pembeli' : 'Penerima Hibah'}). Jika pemilik lebih dari satu orang, tambahkan sebagai Pihak I agar tergabung dalam PIHAK PERTAMA.`
                    : layanan === 'APHB'
                    ? 'Untuk APHB, setiap pemilik hak menjadi pihak terpisah secara berurutan (Pihak I, Pihak II, Pihak III, ... s/d Pihak XX atau lebih). Keterangan persetujuan / tidak memerlukan persetujuan otomatis ditulis setelah pihak terakhir.'
                    : layanan === 'Turun Waris' || layanan === 'Waris C'
                    ? 'Tambahkan seluruh ahli waris yang berhak sebagai Pihak I, Pihak II, dst. Data pewaris (almarhum/almarhumah) & Letter C diisi pada Langkah 3.'
                    : 'Tambahkan seluruh pemohon / pemegang hak pada sertipikat (Pihak I, Pihak II, dst.) untuk injeksi ke surat permohonan, kuasa, dan pernyataan BPN.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Scan KTP Tambah Pihak / Pemohon (multi-file & kamera) */}
                <div className="inline-flex items-center gap-1">
                  <label
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
                      step2ScanSlot !== null
                        ? 'opacity-60 pointer-events-none border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                        : 'cursor-pointer border-sky-200 dark:border-sky-400/35 bg-sky-50 dark:bg-sky-950/70 hover:bg-sky-100 dark:hover:bg-sky-900/70 text-sky-800 dark:text-sky-200'
                    }`}
                    title="Pilih 1 atau beberapa foto/PDF/Word KTP untuk otomatis mengisi atau menambah Pihak / Pemohon"
                  >
                    <input
                      type="file"
                      accept={SCAN_DOC_FILE_ACCEPT}
                      multiple
                      disabled={step2ScanSlot !== null}
                      onChange={handleScanStep2AddParties}
                      className="sr-only"
                    />
                    {step2ScanSlot === 'party:add' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ScanLine className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {step2ScanSlot === 'party:add'
                        ? 'Memindai KTP...'
                        : isAkta
                        ? 'Scan KTP Pihak'
                        : 'Scan KTP Pemohon'}
                    </span>
                  </label>
                  <label
                    className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                      step2ScanSlot !== null
                        ? 'opacity-60 pointer-events-none border-teal-900/10 dark:border-teal-500/20 bg-slate-50 dark:bg-[#081E22] text-slate-400 dark:text-teal-500/50'
                        : 'cursor-pointer border-teal-900/15 dark:border-teal-400/25 bg-white dark:bg-[#0D2B30] hover:bg-teal-50 dark:hover:bg-[#12383F] text-slate-700 dark:text-teal-100'
                    }`}
                    title="Foto KTP langsung dari kamera"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={step2ScanSlot !== null}
                      onChange={handleScanStep2AddParties}
                      className="sr-only"
                    />
                    <Camera className="w-3.5 h-3.5" />
                  </label>
                </div>

                {layanan === 'AJB' || layanan === 'Akta Hibah' ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setParaPihak((prev) => [...prev, createEmptyPihak('Pihak I')])
                      }
                      className="btn-3d btn-3d-teal inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Pemilik (Pihak I)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setParaPihak((prev) => [...prev, createEmptyPihak('Pihak II')])
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-900/15 dark:border-teal-400/30 bg-white dark:bg-[#0D2B30] hover:bg-teal-50 dark:hover:bg-[#12383F] text-slate-800 dark:text-teal-100 text-xs font-semibold whitespace-nowrap transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Pihak II</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setParaPihak((prev) => [
                        ...prev,
                        createEmptyPihak(suggestNextPartyRole(prev, layanan)),
                      ])
                    }
                    className="btn-3d btn-3d-teal inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {isAkta
                        ? `Tambah Pihak (${suggestNextPartyRole(paraPihak, layanan)})`
                        : layanan === 'Turun Waris' || layanan === 'Waris C'
                        ? `Tambah Ahli Waris (${suggestNextPartyRole(paraPihak, layanan)})`
                        : `Tambah Pemohon (${suggestNextPartyRole(paraPihak, layanan)})`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {(layanan === 'AJB' || layanan === 'Akta Hibah') &&
              paraPihak.some(
                (p) => p.peran.startsWith('Pihak ') && p.peran !== 'Pihak I' && p.peran !== 'Pihak II'
              ) && (
                <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-950/50 text-xs text-amber-900 dark:text-amber-100 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Ditemukan peran <strong>Pihak III+</strong> pada layanan {layanan}. Dalam {layanan}, seluruh pemilik seharusnya berada di <strong>Pihak I</strong> atau <strong>Pihak II</strong>.
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setParaPihak((prev) =>
                        prev.map((p) =>
                          p.peran.startsWith('Pihak ') &&
                          p.peran !== 'Pihak I' &&
                          p.peran !== 'Pihak II'
                            ? { ...p, peran: 'Pihak I' }
                            : p
                        )
                      )
                    }
                    className="px-2.5 py-1 rounded-md bg-amber-600 text-white font-semibold hover:bg-amber-700"
                  >
                    Gabungkan Pihak III+ ke Pihak I
                  </button>
                </div>
              )}

            {layanan === 'APHB' &&
              (() => {
                const partyRoles = paraPihak
                  .filter((p) => p.peran.startsWith('Pihak '))
                  .map((p) => p.peran);
                return new Set(partyRoles).size < partyRoles.length;
              })() && (
                <div className="p-3 rounded-xl border border-sky-200 dark:border-sky-500/35 bg-sky-50 dark:bg-sky-950/50 text-xs text-sky-900 dark:text-sky-100 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Pada APHB, setiap pemilik sebaiknya menjadi pihak yang terpisah (Pihak I, Pihak II, Pihak III, dst.).
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setParaPihak((prev) => {
                        let seq = 0;
                        return prev.map((p) => {
                          if (!p.peran.startsWith('Pihak ')) return p;
                          seq += 1;
                          return { ...p, peran: `Pihak ${toPartyRoman(seq)}` as PihakRole };
                        });
                      })
                    }
                    className="px-2.5 py-1 rounded-md bg-sky-600 text-white font-semibold hover:bg-sky-700"
                  >
                    Pisahkan Jadi Pihak I, II, III...
                  </button>
                </div>
              )}

            <div className="space-y-4">
              {paraPihak.map((p, idx) => {
                const sameRoleCount = paraPihak.filter((x) => x.peran === p.peran).length;
                const sameRoleIdx =
                  paraPihak
                    .filter((x) => x.peran === p.peran)
                    .findIndex((x) => x.id === p.id) + 1;
                return (
                <div
                  key={p.id}
                  className="border border-teal-900/12 dark:border-teal-500/20 rounded-2xl p-4 bg-[#F6FBFA] dark:bg-[#0A2226] space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-teal-900/10 dark:border-teal-500/20">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-teal-800 dark:text-teal-300">
                        Subjek #{idx + 1}
                      </span>
                      <select
                        aria-label={`Peran subjek ${idx + 1}`}
                        value={p.peran}
                        onChange={(e) =>
                          updateParty(p.id, { peran: e.target.value as PihakRole })
                        }
                        className="input-airy text-xs font-semibold px-2.5 py-1"
                      >
                        {buildRoleOptions(paraPihak, layanan).map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      {sameRoleCount > 1 && p.peran.startsWith('Pihak ') && (
                        <span className="text-[11px] font-semibold text-sky-800 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-400/35 px-2 py-0.5 rounded-md">
                          Kepemilikan Bersama #{sameRoleIdx} ({p.peran})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition-colors ${
                          step2ScanSlot !== null
                            ? 'opacity-60 pointer-events-none border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                            : 'cursor-pointer border-sky-200 dark:border-sky-400/35 bg-sky-50 dark:bg-sky-950/70 hover:bg-sky-100 dark:hover:bg-sky-900/70 text-sky-800 dark:text-sky-200'
                        }`}
                        title={`Scan foto/PDF/Word KTP untuk mengisi data ${p.peran} #${idx + 1}`}
                      >
                        <input
                          type="file"
                          accept={SCAN_DOC_FILE_ACCEPT}
                          disabled={step2ScanSlot !== null}
                          onChange={(e) =>
                            handleScanStep2PartyKtp(
                              p.id,
                              `${p.peran} (#${idx + 1})`,
                              e
                            )
                          }
                          className="sr-only"
                        />
                        {step2ScanSlot === `party:${p.id}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ScanLine className="w-3 h-3" />
                        )}
                        <span>
                          {step2ScanSlot === `party:${p.id}` ? 'Memindai...' : 'Scan KTP'}
                        </span>
                      </label>
                      <label
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium whitespace-nowrap transition-colors ${
                          step2ScanSlot !== null
                            ? 'opacity-60 pointer-events-none border-teal-900/10 dark:border-teal-500/20 bg-slate-50 dark:bg-[#081E22] text-slate-400 dark:text-teal-500/50'
                            : 'cursor-pointer border-teal-900/15 dark:border-teal-400/25 bg-white dark:bg-[#0D2B30] hover:bg-teal-50 dark:hover:bg-[#12383F] text-slate-700 dark:text-teal-100'
                        }`}
                        title={`Foto KTP ${p.peran} #${idx + 1} dari kamera`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          disabled={step2ScanSlot !== null}
                          onChange={(e) =>
                            handleScanStep2PartyKtp(
                              p.id,
                              `${p.peran} (#${idx + 1})`,
                              e
                            )
                          }
                          className="sr-only"
                        />
                        <Camera className="w-3 h-3" />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeParty(p.id)}
                        aria-label={`Hapus pihak ${p.nama || idx + 1}`}
                        className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-semibold pl-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">NIK (16 Digit)</label>
                      <input
                        type="text"
                        value={p.nik}
                        onChange={(e) => updateParty(p.id, { nik: e.target.value })}
                        placeholder="3322..."
                        className="input-airy w-full px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Nama Lengkap</label>
                      <input
                        type="text"
                        value={p.nama}
                        onChange={(e) => updateParty(p.id, { nama: e.target.value.toUpperCase() })}
                        placeholder="NAMA SESUAI KTP"
                        className="input-airy w-full px-2.5 py-1.5 font-medium uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Status Perkawinan</label>
                      <input
                        type="text"
                        value={p.status_perkawinan}
                        onChange={(e) =>
                          updateParty(p.id, { status_perkawinan: e.target.value })
                        }
                        placeholder="KAWIN / BELUM KAWIN"
                        className="input-airy w-full px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Tempat Lahir</label>
                      <input
                        type="text"
                        value={p.tempat_lahir}
                        onChange={(e) =>
                          updateParty(p.id, { tempat_lahir: e.target.value })
                        }
                        className="input-airy w-full px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Tanggal Lahir</label>
                      <DateInputId
                        value={p.tanggal_lahir}
                        onChange={(val) => updateParty(p.id, { tanggal_lahir: val })}
                        placeholder="DD-MM-YYYY"
                        ariaLabel={`Tanggal lahir ${p.nama || p.peran}`}
                        className="py-1.5 px-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Jenis Kelamin</label>
                      <select
                        value={p.jenis_kelamin}
                        onChange={(e) =>
                          updateParty(p.id, { jenis_kelamin: e.target.value })
                        }
                        className="input-airy w-full px-2.5 py-1.5"
                      >
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Pekerjaan</label>
                      <input
                        type="text"
                        value={p.pekerjaan}
                        onChange={(e) =>
                          updateParty(p.id, { pekerjaan: e.target.value })
                        }
                        className="input-airy w-full px-2.5 py-1.5"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Alamat Jalan / Dukuh</label>
                      <input
                        type="text"
                        value={p.alamat_jalan}
                        onChange={(e) =>
                          updateParty(p.id, { alamat_jalan: e.target.value })
                        }
                        className="input-airy w-full px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">RT / RW</label>
                      <input
                        type="text"
                        value={p.rt_rw}
                        onChange={(e) => updateParty(p.id, { rt_rw: e.target.value })}
                        placeholder="001/002"
                        className="input-airy w-full px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Desa / Kelurahan</label>
                      <input
                        type="text"
                        value={p.desa_kelurahan}
                        onChange={(e) =>
                          updateParty(p.id, { desa_kelurahan: e.target.value })
                        }
                        className="input-airy w-full px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Kecamatan</label>
                      <input
                        type="text"
                        value={p.kecamatan}
                        onChange={(e) =>
                          updateParty(p.id, { kecamatan: e.target.value })
                        }
                        className="input-airy w-full px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Kabupaten / Kota</label>
                      <input
                        type="text"
                        value={p.kabupaten}
                        onChange={(e) =>
                          updateParty(p.id, { kabupaten: e.target.value })
                        }
                        className="input-airy w-full px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {/* Pengaturan Persetujuan Pasangan: hanya untuk Akta PPATS */}
            {isAkta && (
              <div className="border-t border-teal-900/10 dark:border-teal-500/20 pt-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Persetujuan Pasangan / Pihak Terkait
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-teal-200/75">
                      Pilih apakah perbuatan hukum ini memerlukan persetujuan pasangan (suami/istri) atau tidak.
                    </p>
                  </div>
                  <div className="inline-flex rounded-xl border border-teal-900/12 dark:border-teal-500/25 p-1 bg-teal-900/5 dark:bg-[#071A1D]">
                    <button
                      type="button"
                      onClick={() =>
                        setAkta((prev) => ({ ...prev, butuh_persetujuan_pasangan: true }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        akta.butuh_persetujuan_pasangan !== false
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-teal-200/80 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Ada Persetujuan
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAkta((prev) => ({
                          ...prev,
                          butuh_persetujuan_pasangan: false,
                          keterangan_tanpa_persetujuan:
                            prev.keterangan_tanpa_persetujuan || DEFAULT_TANPA_PERSETUJUAN_TEXT,
                        }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        akta.butuh_persetujuan_pasangan === false
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-teal-200/80 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Tidak Memerlukan Persetujuan
                    </button>
                  </div>
                </div>

                {akta.butuh_persetujuan_pasangan === false && (
                  <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-500/35 bg-amber-50/70 dark:bg-amber-950/40 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="keterangan-tanpa-persetujuan"
                        className="font-semibold text-amber-950 dark:text-amber-100"
                      >
                        Kolom Keterangan Tanpa Persetujuan (akan dicetak dalam Akta):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setAkta((prev) => ({
                              ...prev,
                              keterangan_tanpa_persetujuan:
                                'Menurut keterangan para pihak, dalam melakukan perbuatan hukum ini tanpa memerlukan persetujuan dari siapapun, dikarenakan tanah tersebut berasal dari Warisan.',
                            }))
                          }
                          className="px-2.5 py-1 rounded-lg border border-amber-300/70 dark:border-amber-500/35 bg-white dark:bg-[#0D2B30] hover:bg-amber-50 dark:hover:bg-[#12383F] text-slate-700 dark:text-amber-100 font-medium"
                        >
                          Template Warisan
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAkta((prev) => ({
                              ...prev,
                              keterangan_tanpa_persetujuan:
                                'Menurut keterangan para pihak, dalam melakukan perbuatan hukum ini tanpa memerlukan persetujuan dari siapapun, dikarenakan yang bersangkutan berstatus Belum Kawin / Cerai.',
                            }))
                          }
                          className="px-2.5 py-1 rounded-lg border border-amber-300/70 dark:border-amber-500/35 bg-white dark:bg-[#0D2B30] hover:bg-amber-50 dark:hover:bg-[#12383F] text-slate-700 dark:text-amber-100 font-medium"
                        >
                          Template Belum Kawin / Cerai
                        </button>
                      </div>
                    </div>
                    <textarea
                      id="keterangan-tanpa-persetujuan"
                      rows={2}
                      value={akta.keterangan_tanpa_persetujuan ?? ''}
                      onChange={(e) =>
                        setAkta((prev) => ({
                          ...prev,
                          keterangan_tanpa_persetujuan: e.target.value,
                        }))
                      }
                      className="input-airy w-full px-3 py-2"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Data Tanah & PBB */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bento-card p-5 space-y-4">
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Data Objek Tanah (Sertipikat)
                  </h2>
                  <div className="inline-flex items-center gap-1">
                    <label
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
                        step2ScanSlot !== null
                          ? 'opacity-60 pointer-events-none border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                          : 'cursor-pointer border-sky-200 dark:border-sky-400/35 bg-sky-50 dark:bg-sky-950/70 hover:bg-sky-100 dark:hover:bg-sky-900/70 text-sky-800 dark:text-sky-200'
                      }`}
                      title="Scan foto/PDF/Word Sertipikat Tanah (Digital/Analog) atau SPPT PBB"
                    >
                      <input
                        type="file"
                        accept={SCAN_DOC_FILE_ACCEPT}
                        multiple
                        disabled={step2ScanSlot !== null}
                        onChange={(e) => handleScanStep2ObjectDocs('sertipikat', e)}
                        className="sr-only"
                      />
                      {step2ScanSlot === 'sertipikat' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ScanLine className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {step2ScanSlot === 'sertipikat'
                          ? 'Memindai...'
                          : 'Scan Sertipikat / SPPT'}
                      </span>
                    </label>
                    <label
                      className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                        step2ScanSlot !== null
                          ? 'opacity-60 pointer-events-none border-teal-900/10 dark:border-teal-500/20 bg-slate-50 dark:bg-[#081E22] text-slate-400 dark:text-teal-500/50'
                          : 'cursor-pointer border-teal-900/15 dark:border-teal-400/25 bg-white dark:bg-[#0D2B30] hover:bg-teal-50 dark:hover:bg-[#12383F] text-slate-700 dark:text-teal-100'
                      }`}
                      title="Foto Sertipikat langsung dari kamera"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        disabled={step2ScanSlot !== null}
                        onChange={(e) => handleScanStep2ObjectDocs('sertipikat', e)}
                        className="sr-only"
                      />
                      <Camera className="w-3.5 h-3.5" />
                    </label>
                  </div>
                </div>
                <div
                  role="radiogroup"
                  aria-label="Pilih Jenis Sertipikat"
                  className="inline-flex rounded-xl border border-teal-900/12 dark:border-teal-500/25 p-1 bg-teal-900/5 dark:bg-[#071A1D] self-start"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={resolveJenisSertipikat(tanah) === 'digital'}
                    onClick={() =>
                      setTanah((prev) => ({ ...prev, jenis_sertipikat: 'digital' }))
                    }
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      resolveJenisSertipikat(tanah) === 'digital'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-teal-200/80 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Digital (Sertipikat Elektronik)
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={resolveJenisSertipikat(tanah) === 'analog'}
                    onClick={() =>
                      setTanah((prev) => ({ ...prev, jenis_sertipikat: 'analog' }))
                    }
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      resolveJenisSertipikat(tanah) === 'analog'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-teal-200/80 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Analog (SHM / Fisik)
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="tanah-jenis-hak" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Jenis Hak
                  </label>
                  <input
                    id="tanah-jenis-hak"
                    type="text"
                    value={tanah.jenis_hak}
                    onChange={(e) => setTanah({ ...tanah, jenis_hak: e.target.value })}
                    className="input-airy w-full px-2.5 py-1.5"
                  />
                </div>
                {resolveJenisSertipikat(tanah) === 'digital' ? (
                  <div>
                    <label htmlFor="tanah-nib" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                      NIBel (Nomor Identifikasi Bidang Elektronik)
                    </label>
                    <input
                      id="tanah-nib"
                      type="text"
                      value={tanah.nib}
                      onChange={(e) => setTanah({ ...tanah, nib: e.target.value })}
                      placeholder="Contoh: 11.17.000023383.0"
                      className="input-airy w-full px-2.5 py-1.5 font-mono"
                    />
                    <p className="text-[11px] text-slate-600 dark:text-teal-200/75 mt-1">
                      Pada akta hanya ditulis NIBel (tanpa Nomor Hak atau Surat Ukur).
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label htmlFor="tanah-no-hak" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                        Nomor SHM / Sertipikat
                      </label>
                      <input
                        id="tanah-no-hak"
                        type="text"
                        value={tanah.nomor_hak_lama}
                        onChange={(e) =>
                          setTanah({ ...tanah, nomor_hak_lama: e.target.value })
                        }
                        placeholder="Contoh: 3354"
                        className="input-airy w-full px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor="tanah-nib" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                        NIB (Nomor Identifikasi Bidang)
                      </label>
                      <input
                        id="tanah-nib"
                        type="text"
                        value={tanah.nib}
                        onChange={(e) => setTanah({ ...tanah, nib: e.target.value })}
                        placeholder="Contoh: 11.17.11.10.01450"
                        className="input-airy w-full px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor="tanah-su-tanggal" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                        Tanggal Surat Ukur
                      </label>
                      <input
                        id="tanah-su-tanggal"
                        type="text"
                        value={tanah.surat_ukur_tanggal ?? ''}
                        onChange={(e) =>
                          setTanah({ ...tanah, surat_ukur_tanggal: e.target.value })
                        }
                        placeholder="DD-MM-YYYY (atau 19/10/2011)"
                        className="input-airy w-full px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor="tanah-su-nomor" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                        Nomor Surat Ukur
                      </label>
                      <input
                        id="tanah-su-nomor"
                        type="text"
                        value={tanah.surat_ukur_nomor ?? ''}
                        onChange={(e) =>
                          setTanah({ ...tanah, surat_ukur_nomor: e.target.value })
                        }
                        placeholder="Contoh: 00143/Sindon/2011"
                        className="input-airy w-full px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label htmlFor="tanah-luas" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Luas Tanah (m²)
                  </label>
                  <input
                    id="tanah-luas"
                    type="number"
                    min="0"
                    step="0.01"
                    value={tanah.luas_m2}
                    onChange={(e) =>
                      setTanah({ ...tanah, luas_m2: Number(e.target.value) || 0 })
                    }
                    className="input-airy w-full px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="tanah-desa" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Desa / Kelurahan
                  </label>
                  <input
                    id="tanah-desa"
                    type="text"
                    value={tanah.desa}
                    onChange={(e) => setTanah({ ...tanah, desa: e.target.value })}
                    className="input-airy w-full px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label htmlFor="tanah-kec" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Kecamatan
                  </label>
                  <input
                    id="tanah-kec"
                    type="text"
                    value={tanah.kecamatan}
                    onChange={(e) => setTanah({ ...tanah, kecamatan: e.target.value })}
                    className="input-airy w-full px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label htmlFor="tanah-kab" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Kabupaten / Kota
                  </label>
                  <input
                    id="tanah-kab"
                    type="text"
                    value={tanah.kabupaten}
                    onChange={(e) => setTanah({ ...tanah, kabupaten: e.target.value })}
                    className="input-airy w-full px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label htmlFor="tanah-provinsi" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Provinsi
                  </label>
                  <input
                    id="tanah-provinsi"
                    type="text"
                    value={tanah.provinsi ?? ''}
                    onChange={(e) => setTanah({ ...tanah, provinsi: e.target.value })}
                    className="input-airy w-full px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label htmlFor="tanah-dasar" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Dasar Perolehan
                  </label>
                  <input
                    id="tanah-dasar"
                    type="text"
                    value={tanah.dasar_perolehan}
                    onChange={(e) =>
                      setTanah({ ...tanah, dasar_perolehan: e.target.value })
                    }
                    className="input-airy w-full px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label htmlFor="tanah-penggunaan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Penggunaan Tanah (untuk Akta & Lampiran F4)
                  </label>
                  <input
                    id="tanah-penggunaan"
                    type="text"
                    value={tanah.penggunaan_tanah ?? ''}
                    onChange={(e) =>
                      setTanah({ ...tanah, penggunaan_tanah: e.target.value })
                    }
                    placeholder="Misal: Pekarangan / Tanah Pertanian"
                    className="input-airy w-full px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label htmlFor="tanah-status" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Status Jenis Tanah (Pasal Akta)
                  </label>
                  <select
                    id="tanah-status"
                    value={tanah.status_tanah ?? 'Non-Pertanian'}
                    onChange={(e) =>
                      setTanah({
                        ...tanah,
                        status_tanah: e.target.value as 'Non-Pertanian' | 'Pertanian',
                      })
                    }
                    className="input-airy w-full px-2.5 py-1.5"
                  >
                    <option value="Non-Pertanian">Non-Pertanian (Pekarangan / Bangunan)</option>
                    <option value="Pertanian">Tanah Pertanian (Sisipkan Pasal 3 Maksimum Tanah)</option>
                  </select>
                </div>
                {tanah.status_tanah === 'Pertanian' && (
                  <div className="sm:col-span-2 p-3 rounded-xl border border-emerald-200 dark:border-emerald-500/35 bg-emerald-50/70 dark:bg-emerald-950/45 space-y-1.5">
                    <label
                      htmlFor="tanah-tgl-pertanian"
                      className="block font-semibold text-emerald-900 dark:text-emerald-100"
                    >
                      Tanggal Surat Pernyataan Tidak Melanggar Batas Maksimum Tanah Pertanian
                    </label>
                    <DateInputId
                      id="tanah-tgl-pertanian"
                      allowEmpty
                      value={tanah.tanggal_pernyataan_pertanian ?? ''}
                      onChange={(val) =>
                        setTanah({ ...tanah, tanggal_pernyataan_pertanian: val })
                      }
                      placeholder="DD-MM-YYYY (kosongkan jika ikuti tanggal akta)"
                      className="py-1.5"
                    />
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-200/85">
                      Pasal 3 khusus ketentuan maksimum penguasaan tanah pertanian akan otomatis disisipkan dan nomor pasal berikutnya bergeser (+1).
                    </p>
                  </div>
                )}
                <div>
                  <label htmlFor="tanah-tahun-kuasa" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Dikuasai Sejak Tahun
                  </label>
                  <input
                    id="tanah-tahun-kuasa"
                    type="text"
                    value={tanah.menguasai_sejak_tahun ?? ''}
                    onChange={(e) =>
                      setTanah({ ...tanah, menguasai_sejak_tahun: e.target.value })
                    }
                    placeholder="Misal: 2012"
                    className="input-airy w-full px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="tanah-batas-utara" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Batas Sebelah Utara
                  </label>
                  <input
                    id="tanah-batas-utara"
                    type="text"
                    value={tanah.batas_utara ?? ''}
                    onChange={(e) => setTanah({ ...tanah, batas_utara: e.target.value })}
                    placeholder="Misal: Jalan Kampung / Tanah Sdr. ..."
                    className="input-airy w-full px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label htmlFor="tanah-batas-timur" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Batas Sebelah Timur
                  </label>
                  <input
                    id="tanah-batas-timur"
                    type="text"
                    value={tanah.batas_timur ?? ''}
                    onChange={(e) => setTanah({ ...tanah, batas_timur: e.target.value })}
                    placeholder="Misal: Tanah Sdr. ..."
                    className="input-airy w-full px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label htmlFor="tanah-batas-selatan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Batas Sebelah Selatan
                  </label>
                  <input
                    id="tanah-batas-selatan"
                    type="text"
                    value={tanah.batas_selatan ?? ''}
                    onChange={(e) => setTanah({ ...tanah, batas_selatan: e.target.value })}
                    placeholder="Misal: Tanah Sdr. ..."
                    className="input-airy w-full px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label htmlFor="tanah-batas-barat" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Batas Sebelah Barat
                  </label>
                  <input
                    id="tanah-batas-barat"
                    type="text"
                    value={tanah.batas_barat ?? ''}
                    onChange={(e) => setTanah({ ...tanah, batas_barat: e.target.value })}
                    placeholder="Misal: Selokan / Jalan ..."
                    className="input-airy w-full px-2.5 py-1.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="tanah-holders" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Pemegang Hak pada Sertipikat (pisahkan koma jika lebih dari 1)
                  </label>
                  <input
                    id="tanah-holders"
                    type="text"
                    value={pemegangHakInput}
                    onChange={(e) => setPemegangHakInput(e.target.value.toUpperCase())}
                    placeholder="Contoh: SLAMET RAHARJO"
                    className="input-airy w-full px-2.5 py-1.5 uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="bento-card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Data SPPT PBB-P2
                </h2>
                <div className="inline-flex items-center gap-1">
                  <label
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
                      step2ScanSlot !== null
                        ? 'opacity-60 pointer-events-none border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                        : 'cursor-pointer border-sky-200 dark:border-sky-400/35 bg-sky-50 dark:bg-sky-950/70 hover:bg-sky-100 dark:hover:bg-sky-900/70 text-sky-800 dark:text-sky-200'
                    }`}
                    title="Scan foto/PDF/Word SPPT PBB untuk mengisi NOP, Tahun Pajak, NJOP, dan luas"
                  >
                    <input
                      type="file"
                      accept={SCAN_DOC_FILE_ACCEPT}
                      disabled={step2ScanSlot !== null}
                      onChange={(e) => handleScanStep2ObjectDocs('pbb', e)}
                      className="sr-only"
                    />
                    {step2ScanSlot === 'pbb' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ScanLine className="w-3.5 h-3.5" />
                    )}
                    <span>{step2ScanSlot === 'pbb' ? 'Memindai...' : 'Scan SPPT PBB'}</span>
                  </label>
                  <label
                    className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                      step2ScanSlot !== null
                        ? 'opacity-60 pointer-events-none border-teal-900/10 dark:border-teal-500/20 bg-slate-50 dark:bg-[#081E22] text-slate-400 dark:text-teal-500/50'
                        : 'cursor-pointer border-teal-900/15 dark:border-teal-400/25 bg-white dark:bg-[#0D2B30] hover:bg-teal-50 dark:hover:bg-[#12383F] text-slate-700 dark:text-teal-100'
                    }`}
                    title="Foto SPPT PBB langsung dari kamera"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={step2ScanSlot !== null}
                      onChange={(e) => handleScanStep2ObjectDocs('pbb', e)}
                      className="sr-only"
                    />
                    <Camera className="w-3.5 h-3.5" />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label htmlFor="pbb-nop" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Nomor Objek Pajak (NOP)
                  </label>
                  <input
                    id="pbb-nop"
                    type="text"
                    value={pbb.nop}
                    onChange={(e) => setPbb({ ...pbb, nop: e.target.value })}
                    placeholder="33.22.140.xxx.xxx-xxxx.0"
                    className="input-airy w-full px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="pbb-tahun" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Tahun Pajak
                  </label>
                  <input
                    id="pbb-tahun"
                    type="text"
                    value={pbb.tahun_pajak}
                    onChange={(e) => setPbb({ ...pbb, tahun_pajak: e.target.value })}
                    className="input-airy w-full px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="pbb-njop-bumi" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    NJOP Bumi / m² (Rp)
                  </label>
                  <input
                    id="pbb-njop-bumi"
                    type="number"
                    min="0"
                    value={pbb.njop_bumi_m2}
                    onChange={(e) =>
                      setPbb({ ...pbb, njop_bumi_m2: Number(e.target.value) || 0 })
                    }
                    className="input-airy w-full px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="pbb-luas-bangunan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Luas Bangunan (m²)
                  </label>
                  <input
                    id="pbb-luas-bangunan"
                    type="number"
                    min="0"
                    value={pbb.luas_bangunan_m2 ?? 0}
                    onChange={(e) => {
                      const nextLuasB = Math.max(0, Number(e.target.value) || 0);
                      const curPerM2 = Math.max(0, pbb.njop_bangunan_m2 ?? 0);
                      setPbb({
                        ...pbb,
                        luas_bangunan_m2: nextLuasB,
                        njop_bangunan:
                          nextLuasB > 0 && curPerM2 > 0
                            ? Math.round(nextLuasB * curPerM2)
                            : nextLuasB === 0 && curPerM2 > 0
                            ? 0
                            : pbb.njop_bangunan,
                      });
                    }}
                    className="input-airy w-full px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="pbb-njop-bangunan-m2" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    NJOP Bangunan / m² (Rp)
                  </label>
                  <input
                    id="pbb-njop-bangunan-m2"
                    type="number"
                    min="0"
                    value={pbb.njop_bangunan_m2 ?? 0}
                    onChange={(e) => {
                      const nextPerM2 = Math.max(0, Number(e.target.value) || 0);
                      const curLuasB = Math.max(0, pbb.luas_bangunan_m2 ?? 0);
                      setPbb({
                        ...pbb,
                        njop_bangunan_m2: nextPerM2,
                        njop_bangunan:
                          curLuasB > 0 && nextPerM2 > 0
                            ? Math.round(curLuasB * nextPerM2)
                            : curLuasB > 0 && nextPerM2 === 0
                            ? 0
                            : pbb.njop_bangunan,
                      });
                    }}
                    className="input-airy w-full px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="pbb-njop-bangunan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Total NJOP Bangunan (Rp)
                  </label>
                  <input
                    id="pbb-njop-bangunan"
                    type="number"
                    min="0"
                    value={
                      (pbb.luas_bangunan_m2 ?? 0) > 0 && (pbb.njop_bangunan_m2 ?? 0) > 0
                        ? Math.round((pbb.luas_bangunan_m2 ?? 0) * (pbb.njop_bangunan_m2 ?? 0))
                        : pbb.njop_bangunan
                    }
                    onChange={(e) =>
                      setPbb({
                        ...pbb,
                        luas_bangunan_m2: 0,
                        njop_bangunan_m2: 0,
                        njop_bangunan: Number(e.target.value) || 0,
                      })
                    }
                    className="input-airy w-full px-2.5 py-1.5 font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-3d btn-3d-light inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Langkah 1</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="btn-3d btn-3d-teal inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
            >
              <span>
                {isAkta
                  ? 'Lanjut ke Parameter Akta & Saksi'
                  : 'Lanjut ke Pengesahan & Detail Berkas'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bento-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-teal-900/10 dark:border-teal-400/15 pb-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {isAkta
                    ? 'Parameter Akta & Penandatanganan'
                    : `Pengesahan, Detail Berkas Non-Akta (${layanan}) & Saksi`}
                </h2>
                <p className="text-xs text-slate-600 dark:text-teal-200/75 mt-0.5">
                  {isAkta
                    ? 'Lengkapi nomor akta, pejabat PPATS, kuasa BPN, saksi-saksi, dan nilai transaksi pada akta.'
                    : 'Atur pejabat pengesahan dokumen, detail khusus layanan Non-Akta, kuasa BPN, dan saksi-saksi.'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const rec = buildCurrentRecord();
                  setSavedRecordId(rec.id);
                  await onOpenTaxCalculator(rec);
                }}
                className="btn-3d btn-3d-light inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0"
              >
                <Calculator className="w-3.5 h-3.5 text-teal-600 dark:text-teal-300" />
                <span>Buka Jalur Perhitungan Pajak (BPHTB/PPh)</span>
              </button>
            </div>

            {!isAkta && (
              <div className="p-3.5 rounded-xl border border-teal-900/12 dark:border-teal-500/25 bg-[#F6FBFA] dark:bg-[#0A2226] text-xs text-slate-700 dark:text-teal-100">
                <strong className="text-slate-900 dark:text-white">Berkas Non-Akta ({layanan}):</strong> Tidak menggunakan Nomor Akta PPATS, tidak menerbitkan Blangko Akta A4, dan otomatis dikecualikan dari Laporan Bulanan PPATS.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {isAkta && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="akta-nomor" className="text-slate-700 dark:text-teal-100/90 font-medium">
                      Nomor Akta PPATS
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setAkta({
                          ...akta,
                          nomor_akta: suggestNextAktaNumber(existingRecords, akta.tanggal_akta)
                            .nomorAkta,
                        })
                      }
                      className="text-teal-700 dark:text-teal-300 hover:underline font-semibold"
                    >
                      Pakai Saran ({nextSuggestion.nomorAkta})
                    </button>
                  </div>
                  <input
                    id="akta-nomor"
                    type="text"
                    value={akta.nomor_akta}
                    onChange={(e) => setAkta({ ...akta, nomor_akta: e.target.value })}
                    className="input-airy w-full px-3 py-2 font-mono"
                  />
                </div>
              )}

              <div className={!isAkta ? 'sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4' : ''}>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label htmlFor="akta-tanggal" className="text-slate-700 dark:text-teal-100/90 font-medium">
                      {isAkta ? 'Tanggal Akta (Opsional)' : 'Tanggal Surat / Berkas (Opsional)'}
                    </label>
                    {akta.tanggal_akta.trim() !== '' && (
                      <button
                        type="button"
                        onClick={() => setAkta({ ...akta, tanggal_akta: '' })}
                        className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                      >
                        Kosongkan Tanggal
                      </button>
                    )}
                  </div>
                  <DateInputId
                    id="akta-tanggal"
                    allowEmpty
                    value={akta.tanggal_akta}
                    onChange={(val) => setAkta({ ...akta, tanggal_akta: val })}
                    placeholder="DD-MM-YYYY (boleh dikosongi)"
                    ariaLabel={isAkta ? 'Tanggal Akta (format DD-MM-YYYY)' : 'Tanggal Surat Berkas (format DD-MM-YYYY)'}
                  />
                  <p className="text-[11px] text-slate-600 dark:text-teal-200/75 mt-1">
                    Format hari-bulan-tahun (DD-MM-YYYY). Boleh dikosongkan untuk pengisian blangko manual.
                  </p>
                </div>
                {!isAkta && (
                  <div>
                    <label htmlFor="akta-status-nonakta" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                      Status Progres Berkas
                    </label>
                    <select
                      id="akta-status-nonakta"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as BerkasStatus)}
                      className="input-airy w-full px-3 py-2"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {!isAkta && !akta.tanggal_akta.trim() && (
                <div className="sm:col-span-2 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/45 border border-amber-200 dark:border-amber-500/35 text-amber-900 dark:text-amber-100">
                  <span className="font-semibold">Tanggal Berkas Dikosongkan:</span>{' '}
                  Seluruh titik tanggal pada bundel Non-Akta (Permohonan, Surat Kuasa, Pernyataan, dan Pengesahan) akan dicetak kosong (<span className="font-mono">......................</span>) untuk diisi manual.
                </div>
              )}

              {isAkta && (
                <>
                  <div className="sm:col-span-2 p-3 rounded-xl bg-[#F6FBFA] dark:bg-[#081E22] border border-teal-900/12 dark:border-teal-500/25 text-slate-700 dark:text-teal-100/90">
                    <span className="font-semibold text-slate-900 dark:text-white">Pratinjau Kalimat Tanggal Akta:</span>{' '}
                    {akta.tanggal_akta.trim() && formattedAktaDate.kalimat_akta !== '-'
                      ? formattedAktaDate.kalimat_akta
                      : 'Tanggal dikosongkan — blangko akta & lampiran akan dicetak dengan titik-titik (..........) untuk pengisian manual.'}
                  </div>

                  <div>
                    <label htmlFor="akta-ppats" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                      Nama Pejabat PPATS
                    </label>
                    <input
                      id="akta-ppats"
                      type="text"
                      value={akta.nama_ppats}
                      onChange={(e) => setAkta({ ...akta, nama_ppats: e.target.value })}
                      className="input-airy w-full px-3 py-2"
                    />
                  </div>

                  <div>
                    <label htmlFor="akta-jabatan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                      Jabatan PPATS
                    </label>
                    <input
                      id="akta-jabatan"
                      type="text"
                      value={akta.jabatan_ppats}
                      onChange={(e) => setAkta({ ...akta, jabatan_ppats: e.target.value })}
                      className="input-airy w-full px-3 py-2"
                    />
                  </div>

                  <div className="sm:col-span-2 p-4 rounded-2xl border border-teal-900/12 dark:border-teal-500/20 bg-[#F6FBFA] dark:bg-[#0A2226] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 dark:text-white">
                        Ringkasan Nilai Transaksi &amp; Pajak Tersimpan
                      </p>
                      <p className="text-[11px] text-teal-800 dark:text-teal-200 font-mono tabular-nums">
                        Nilai Kesepakatan: {formatRupiah(taxCalc.nilai_kesepakatan)} · BPHTB: {formatRupiah(taxCalc.bphtb)} · PPh Final: {formatRupiah(taxCalc.pph)}
                      </p>
                    </div>
                    <div className="sm:w-64">
                      <label htmlFor="akta-override" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                        Nilai Transaksi Akta (Rp, opsional)
                      </label>
                      <input
                        id="akta-override"
                        type="number"
                        min="0"
                        value={akta.nilai_transaksi_override ?? ''}
                        onChange={(e) =>
                          setAkta({
                            ...akta,
                            nilai_transaksi_override:
                              e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        placeholder="Atur via Perhitungan Pajak"
                        className="input-airy w-full px-3 py-1.5 font-mono tabular-nums"
                      />
                    </div>
                  </div>
                </>
              )}

              {layanan === 'APHB' && (() => {
                const orderedAphbParties = paraPihak
                  .filter((p) => p.peran.startsWith('Pihak '))
                  .sort(
                    (a, b) =>
                      parseAdditionalPihakMeta(a.peran).order -
                      parseAdditionalPihakMeta(b.peran).order
                  );
                const selectedSet = new Set(aphbSelectedRoles);
                const frac = computeAphbTaxFraction(
                  aphbHolderCount,
                  aphbSelectedRoles.length
                );

                const toggleAphbRecipient = (role: string) => {
                  const current = new Set(aphbSelectedRoles);
                  if (current.has(role)) {
                    if (current.size <= 1) return; // Minimal 1 calon penerima hak
                    current.delete(role);
                  } else {
                    current.add(role);
                  }
                  const orderedSelected = orderedAphbParties
                    .map((p) => p.peran)
                    .filter((r, idx, arr) => arr.indexOf(r) === idx && current.has(r));
                  const finalRoles =
                    orderedSelected.length > 0 ? orderedSelected : [role];
                  setAkta({
                    ...akta,
                    pihak_penerima_aphb: finalRoles[0],
                    pihak_penerima_aphb_list: finalRoles,
                    aphb_jumlah_pemegang_hak: aphbHolderCount,
                    aphb_jumlah_penerima: finalRoles.length,
                  });
                };

                return (
                  <div className="sm:col-span-2 p-4 rounded-xl border border-sky-200 dark:border-sky-500/35 bg-sky-50/70 dark:bg-sky-950/45 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="text-sky-950 dark:text-sky-100 font-semibold">
                          Calon Pemegang / Penerima Hak Bersama (APHB)
                        </p>
                        <p className="text-[11px] text-sky-900/75 dark:text-sky-200/75 mt-0.5">
                          Centang 1 orang (pemegang tunggal) atau lebih dari 1 orang (pemegang hak bersama selanjutnya).
                        </p>
                      </div>
                      <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/85 dark:bg-sky-900/60 text-sky-950 dark:text-sky-100 border border-sky-200 dark:border-sky-600/50 self-start sm:self-auto">
                        {aphbSelectedRoles.length} dari {aphbHolderCount} Pihak Dipilih
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {orderedAphbParties.map((p) => {
                        const checked = selectedSet.has(p.peran);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                              checked
                                ? 'border-teal-500 bg-teal-50/90 dark:bg-teal-900/55 text-teal-950 dark:text-teal-50 shadow-xs'
                                : 'border-sky-200/80 dark:border-sky-700/50 bg-white/85 dark:bg-[#092024] text-slate-700 dark:text-teal-100/85 hover:bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAphbRecipient(p.peran)}
                              className="w-4 h-4 rounded accent-teal-600 shrink-0"
                            />
                            <span className="text-xs font-semibold truncate">
                              {p.peran} — {p.nama || '(Nama belum diisi)'}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {frac.aktif && (
                      <div className="text-[11px] font-mono text-sky-950 dark:text-sky-100 bg-white/80 dark:bg-[#081C20] px-3 py-2 rounded-xl border border-sky-200/80 dark:border-sky-700/40 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          Rumus BPHTB APHB: ({frac.n} − {frac.m}) / {frac.n} ={' '}
                          <strong>
                            {frac.numerator}/{frac.n}
                          </strong>
                        </span>
                        <span>
                          Luas Kena Pajak:{' '}
                          <strong>
                            {formatNumberId(taxCalc.luas_bumi_kena_pajak ?? 0)} m²
                          </strong>{' '}
                          dari {formatNumberId(tanah.luas_m2)} m²
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {isAkta && (
                <>
                  <div>
                    <label htmlFor="akta-status" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                      Status Progres Berkas
                    </label>
                    <select
                      id="akta-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as BerkasStatus)}
                      className="input-airy w-full px-3 py-2"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="hidden sm:block" />
                </>
              )}

              {/* PANEL PENGESAHAN & DETAIL NON-AKTA */}
              {!isAkta && (
                <>
                  {/* 1. Pengesahan Tunggal ("Mengetahui") - Default PPATS (hanya untuk layanan yang memuat blok Mengetahui) */}
                  {(layanan === 'Turun Waris' ||
                    layanan === 'Pemecahan' ||
                    layanan === 'Pemecahan/Ukur Ulang' ||
                    layanan === 'Ukur Ulang' ||
                    layanan === 'Ralat Data') && (
                  <div className="sm:col-span-2 border border-teal-900/12 dark:border-teal-500/20 rounded-2xl p-4 bg-[#F6FBFA] dark:bg-[#0A2226] space-y-3">
                    <div className="border-b border-teal-900/10 dark:border-teal-500/20 pb-2">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        Pengesahan Dokumen Non-Akta Lainnya (&ldquo;Mengetahui&rdquo;) — Default PPATS
                      </h3>
                      <p className="text-[11px] text-slate-600 dark:text-teal-200/75 mt-0.5">
                        Berlaku untuk Surat Kuasa, Penguasaan Fisik, SPPT/PBB, BPHTB Waris, Permohonan Pemecahan/Ukur, Tanda Batas, Sket, Pelepasan Jalan, dan Penutupan PNBP. Secara default menggunakan PPATS, atau pilih Kepala Desa / Camat / Isi Manual sesuai kebutuhan.
                      </p>
                    </div>

                    <div
                      role="radiogroup"
                      aria-label="Pilih Pejabat Pengesahan Dokumen Lainnya"
                      className="grid grid-cols-2 lg:grid-cols-4 gap-2"
                    >
                      {(
                        [
                          { id: 'ppats' as const, label: 'Default PPATS' },
                          { id: 'kades' as const, label: 'Kepala Desa Asal' },
                          { id: 'camat' as const, label: 'Camat' },
                          { id: 'manual' as const, label: 'Isi Manual / Lainnya' },
                        ] satisfies Array<{ id: PengesahanMode; label: string }>
                      ).map((opt) => {
                        const active = (nonAkta.pengesahan_mode ?? 'ppats') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => {
                              setNonAkta((prev) => {
                                if (opt.id === 'ppats') {
                                  return {
                                    ...prev,
                                    pengesahan_mode: 'ppats',
                                    pengesahan_jabatan: '',
                                    pengesahan_nama: akta.nama_ppats || settings.nama_ppats,
                                    pengesahan_nip: akta.nip_ppats || settings.nip_ppats,
                                  };
                                }
                                if (opt.id === 'kades') {
                                  return {
                                    ...prev,
                                    pengesahan_mode: 'kades',
                                    pengesahan_jabatan: '',
                                    pengesahan_nama: prev.kades_pengesahan_nama || '',
                                    pengesahan_nip: '',
                                  };
                                }
                                if (opt.id === 'camat') {
                                  return {
                                    ...prev,
                                    pengesahan_mode: 'camat',
                                    pengesahan_jabatan: '',
                                    pengesahan_nama: prev.camat_pengesahan_nama || akta.nama_ppats || settings.nama_ppats,
                                    pengesahan_nip: prev.camat_pengesahan_nip || akta.nip_ppats || settings.nip_ppats,
                                  };
                                }
                                return {
                                  ...prev,
                                  pengesahan_mode: 'manual',
                                  pengesahan_jabatan:
                                    prev.pengesahan_mode === 'manual' && prev.pengesahan_jabatan
                                      ? prev.pengesahan_jabatan
                                      : '',
                                  pengesahan_nama:
                                    prev.pengesahan_mode === 'manual' ? prev.pengesahan_nama : '',
                                  pengesahan_nip:
                                    prev.pengesahan_mode === 'manual' ? prev.pengesahan_nip : '',
                                };
                              });
                            }}
                            className={`px-3 py-2 rounded-xl border text-xs font-semibold text-left transition-colors ${
                              active
                                ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                                : 'border-teal-900/12 dark:border-teal-500/25 bg-white dark:bg-[#081E22] hover:bg-teal-50 dark:hover:bg-[#103036] text-slate-700 dark:text-teal-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="na-pengesahan-jabatan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                          Jabatan Pengesahan
                        </label>
                        <input
                          id="na-pengesahan-jabatan"
                          type="text"
                          value={nonAkta.pengesahan_jabatan ?? ''}
                          onChange={(e) =>
                            setNonAkta({ ...nonAkta, pengesahan_jabatan: e.target.value })
                          }
                          placeholder={
                            nonAkta.pengesahan_mode === 'kades'
                              ? `Kepala Desa ${tanah.desa || '-'}`
                              : nonAkta.pengesahan_mode === 'camat'
                                ? `Camat ${(tanah.kecamatan || settings.nama_kecamatan || '-').replace(/^Kecamatan\s+/i, '')}`
                                : nonAkta.pengesahan_mode === 'ppats'
                                  ? `PPATS / Camat ${(tanah.kecamatan || settings.nama_kecamatan || '-').replace(/^Kecamatan\s+/i, '')}`
                                  : 'Jabatan pejabat pengesahan'
                          }
                          className="input-airy w-full px-2.5 py-1.5"
                        />
                      </div>
                      <div>
                        <label htmlFor="na-pengesahan-nama" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                          Nama Pejabat Pengesahan
                        </label>
                        <input
                          id="na-pengesahan-nama"
                          type="text"
                          value={nonAkta.pengesahan_nama ?? ''}
                          onChange={(e) =>
                            setNonAkta({ ...nonAkta, pengesahan_nama: e.target.value })
                          }
                          placeholder="Nama & gelar pejabat"
                          className="input-airy w-full px-2.5 py-1.5 font-medium"
                        />
                      </div>
                      <div>
                        <label htmlFor="na-pengesahan-nip" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                          NIP (Opsional)
                        </label>
                        <input
                          id="na-pengesahan-nip"
                          type="text"
                          value={nonAkta.pengesahan_nip ?? ''}
                          onChange={(e) =>
                            setNonAkta({ ...nonAkta, pengesahan_nip: e.target.value })
                          }
                          placeholder="Kosongkan jika bukan ASN"
                          className="input-airy w-full px-2.5 py-1.5 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                  )}

                  {/* 2. Detail Khusus Turun Waris & Waris C */}
                  {(layanan === 'Turun Waris' || layanan === 'Waris C') && (
                    <div className="sm:col-span-2 border border-teal-900/12 dark:border-teal-500/20 rounded-2xl p-4 bg-[#F6FBFA] dark:bg-[#0A2226] space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-teal-900/10 dark:border-teal-500/20 pb-2.5">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                            Data Pewaris &amp; Surat Keterangan / Pernyataan Ahli Warisan
                          </h3>
                          <p className="text-[11px] text-slate-600 dark:text-teal-200/75 mt-0.5">
                            Scan Akta Kematian, SKW, KK, Letter C, atau file Word (.docx/.doc) untuk mengisi otomatis data pewaris &amp; pasangan.
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-1 shrink-0">
                          <label
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
                              step3WarisScanSlot !== null
                                ? 'opacity-60 pointer-events-none border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                                : 'cursor-pointer border-sky-200 dark:border-sky-400/35 bg-sky-50 dark:bg-sky-950/70 hover:bg-sky-100 dark:hover:bg-sky-900/70 text-sky-800 dark:text-sky-200'
                            }`}
                            title="Scan Foto, PDF, atau Word (.docx/.doc) Akta Kematian, SKW, atau KK"
                          >
                            <input
                              type="file"
                              accept={SCAN_DOC_FILE_ACCEPT}
                              multiple
                              aria-label="Scan Dokumen Pewaris (Foto, PDF, Word)"
                              disabled={step3WarisScanSlot !== null}
                              onChange={(e) => {
                                const files = e.target.files ? Array.from(e.target.files) : [];
                                e.target.value = '';
                                if (files.length > 0) {
                                  void handleScanStep3Waris('waris_pewaris', files);
                                }
                              }}
                              className="sr-only"
                            />
                            {step3WarisScanSlot === 'waris_pewaris' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ScanLine className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {step3WarisScanSlot === 'waris_pewaris'
                                ? 'Memindai...'
                                : 'Scan Dokumen Pewaris'}
                            </span>
                          </label>
                          <label
                            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                              step3WarisScanSlot !== null
                                ? 'opacity-60 pointer-events-none border-teal-900/10 dark:border-teal-500/20 bg-slate-50 dark:bg-[#081E22] text-slate-400 dark:text-teal-500/50'
                                : 'cursor-pointer border-teal-900/15 dark:border-teal-400/25 bg-white dark:bg-[#0D2B30] hover:bg-teal-50 dark:hover:bg-[#12383F] text-slate-700 dark:text-teal-100'
                            }`}
                            title="Foto Akta Kematian atau SKW langsung dari kamera"
                          >
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              aria-label="Foto Kamera Dokumen Pewaris"
                              disabled={step3WarisScanSlot !== null}
                              onChange={(e) => {
                                const files = e.target.files ? Array.from(e.target.files) : [];
                                e.target.value = '';
                                if (files.length > 0) {
                                  void handleScanStep3Waris('waris_pewaris', files);
                                }
                              }}
                              className="sr-only"
                            />
                            <Camera className="w-3.5 h-3.5" />
                          </label>
                        </div>
                      </div>
                      {step3PewarisScanNotice && (
                        <div
                          role={step3PewarisScanNotice.type === 'error' ? 'alert' : 'status'}
                          className={`flex items-start justify-between gap-2 px-3 py-2 rounded-xl border text-xs ${
                            step3PewarisScanNotice.type === 'error'
                              ? 'border-rose-200 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200'
                              : step3PewarisScanNotice.type === 'success'
                                ? 'border-emerald-200 dark:border-emerald-600/45 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                                : 'border-sky-200 dark:border-sky-600/45 bg-sky-50 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200'
                          }`}
                        >
                          <span className="leading-snug">{step3PewarisScanNotice.message}</span>
                          <button
                            type="button"
                            onClick={() => setStep3PewarisScanNotice(null)}
                            aria-label="Tutup pemberitahuan scan Pewaris"
                            className="shrink-0 opacity-70 hover:opacity-100 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="tw-sebutan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Sebutan Pewaris
                          </label>
                          <select
                            id="tw-sebutan"
                            value={nonAkta.sebutan_pewaris ?? 'Almarhum'}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                sebutan_pewaris: e.target.value as 'Almarhum' | 'Almarhumah',
                              })
                            }
                            className="input-airy w-full px-2.5 py-1.5"
                          >
                            <option value="Almarhum">Almarhum</option>
                            <option value="Almarhumah">Almarhumah</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="tw-pewaris" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Nama Pewaris (Pemegang Hak Meninggal)
                          </label>
                          <input
                            id="tw-pewaris"
                            type="text"
                            value={nonAkta.nama_pewaris ?? ''}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                nama_pewaris: e.target.value.toUpperCase(),
                              })
                            }
                            placeholder="Contoh: HADI SUWARNO"
                            className="input-airy w-full px-2.5 py-1.5 font-medium uppercase"
                          />
                        </div>
                        <div>
                          <label htmlFor="tw-tgl-meninggal" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Tanggal Meninggal (Opsional)
                          </label>
                          <DateInputId
                            id="tw-tgl-meninggal"
                            allowEmpty
                            value={nonAkta.tanggal_meninggal ?? ''}
                            onChange={(val) =>
                              setNonAkta({ ...nonAkta, tanggal_meninggal: val })
                            }
                            placeholder="DD-MM-YYYY"
                            className="py-1.5 px-2.5"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="tw-tempat-meninggal" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Tempat Meninggal / Akta Kematian
                          </label>
                          <input
                            id="tw-tempat-meninggal"
                            type="text"
                            value={nonAkta.tempat_meninggal ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, tempat_meninggal: e.target.value })
                            }
                            placeholder="Contoh: Desa Sindon, Kec. Ngemplak, Boyolali"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label htmlFor="tw-hubungan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Hubungan Pasangan Pewaris
                          </label>
                          <select
                            id="tw-hubungan"
                            value={nonAkta.hubungan_pasangan_pewaris ?? 'Istrinya'}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                hubungan_pasangan_pewaris: e.target.value as
                                  | 'Istrinya'
                                  | 'Suaminya'
                                  | 'Pasangannya',
                              })
                            }
                            className="input-airy w-full px-2.5 py-1.5"
                          >
                            <option value="Istrinya">Istrinya</option>
                            <option value="Suaminya">Suaminya</option>
                            <option value="Pasangannya">Pasangannya / Lainnya</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="tw-pasangan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Nama Pasangan Pewaris
                          </label>
                          <input
                            id="tw-pasangan"
                            type="text"
                            value={nonAkta.nama_pasangan_pewaris ?? ''}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                nama_pasangan_pewaris: e.target.value.toUpperCase(),
                              })
                            }
                            placeholder="NAMA JANDA/DUDA PEWARIS"
                            className="input-airy w-full px-2.5 py-1.5 uppercase"
                          />
                        </div>
                        <div>
                          <label htmlFor="tw-tgl-pasangan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Tgl Lahir Pasangan
                          </label>
                          <DateInputId
                            id="tw-tgl-pasangan"
                            allowEmpty
                            value={nonAkta.tgl_lahir_pasangan_pewaris ?? ''}
                            onChange={(val) =>
                              setNonAkta({
                                ...nonAkta,
                                tgl_lahir_pasangan_pewaris: val,
                              })
                            }
                            placeholder="DD-MM-YYYY"
                            className="py-1.5 px-2.5"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label htmlFor="tw-catatan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Catatan Tambahan SKW (Opsional)
                          </label>
                          <input
                            id="tw-catatan"
                            type="text"
                            value={nonAkta.catatan_skw ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, catatan_skw: e.target.value })
                            }
                            placeholder="Misal: Pernikahan tercatat pada KUA Ngemplak Nomor ..."
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2b. Detail Khusus Waris Letter C */}
                  {layanan === 'Waris C' && (
                    <WarisCDetailPanel
                      nonAkta={nonAkta}
                      setNonAkta={setNonAkta}
                      paraPihak={paraPihak}
                      desaName={tanah.desa}
                      luasIndukM2={tanah.luas_m2}
                      onUploadSketPhoto={(e) =>
                        void handleGeotagPhotoUpload('foto_sket_pecah', e)
                      }
                      onScanWarisC={(files) =>
                        void handleScanStep3Waris('waris_c', files)
                      }
                      scanningWarisC={step3WarisScanSlot === 'waris_c'}
                      scanDisabled={step3WarisScanSlot !== null}
                      scanNotice={step3WarisCScanNotice}
                      onDismissScanNotice={() => setStep3WarisCScanNotice(null)}
                    />
                  )}

                  {/* 3. Detail Khusus Pemecahan & Ukur Ulang */}
                  {(layanan === 'Pemecahan' ||
                    layanan === 'Ukur Ulang' ||
                    layanan === 'Pemecahan/Ukur Ulang') && (
                    <div className="sm:col-span-2 border border-teal-900/12 dark:border-teal-500/20 rounded-2xl p-4 bg-[#F6FBFA] dark:bg-[#0A2226] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-900/10 dark:border-teal-500/20 pb-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                          Detail Permohonan {layanan}, Bidang Pecahan &amp; Sket Tanah
                        </h3>
                        <select
                          aria-label="Jenis permohonan pengukuran atau pemecahan"
                          value={nonAkta.sub_permohonan_ukur ?? 'Pemecahan'}
                          onChange={(e) =>
                            setNonAkta({
                              ...nonAkta,
                              sub_permohonan_ukur: e.target.value as
                                | 'Pemecahan'
                                | 'Pemecahan & Validasi'
                                | 'Pengukuran'
                                | 'Pengukuran & Validasi',
                            })
                          }
                          className="input-airy px-2.5 py-1 text-xs font-semibold"
                        >
                          <option value="Pemecahan">Permohonan Pemecahan Bidang</option>
                          <option value="Pemecahan & Validasi">Pemecahan &amp; Validasi</option>
                          <option value="Pengukuran">Permohonan Pengukuran Ulang</option>
                          <option value="Pengukuran & Validasi">Pengukuran &amp; Validasi</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            Rincian Bidang Pecahan / Pengukuran ({(nonAkta.bidang_pecahan ?? []).length})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextNum = (nonAkta.bidang_pecahan ?? []).length + 1;
                              const item: PemecahanBidangItem = {
                                id: `bd-${Date.now()}-${nextNum}`,
                                label: `Bagian ${nextNum}`,
                                luas_m2: 0,
                              };
                              setNonAkta((prev) => ({
                                ...prev,
                                bidang_pecahan: [...(prev.bidang_pecahan ?? []), item],
                              }));
                            }}
                            className="btn-3d btn-3d-teal inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Tambah Bidang Pecahan</span>
                          </button>
                        </div>

                        {(nonAkta.bidang_pecahan ?? []).map((b, bIdx) => (
                          <div
                            key={b.id}
                            className="p-3 rounded-xl border border-teal-900/10 dark:border-teal-500/20 bg-white dark:bg-[#081E22] grid grid-cols-1 sm:grid-cols-6 gap-2 items-end"
                          >
                            <div className="sm:col-span-2">
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                Nama / Label Bidang #{bIdx + 1}
                              </label>
                              <input
                                type="text"
                                value={b.label}
                                onChange={(e) =>
                                  setNonAkta((prev) => ({
                                    ...prev,
                                    bidang_pecahan: (prev.bidang_pecahan ?? []).map((x) =>
                                      x.id === b.id ? { ...x, label: e.target.value } : x
                                    ),
                                  }))
                                }
                                placeholder="Misal: sisa / Bagian 1"
                                className="input-airy w-full px-2.5 py-1.5"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                Penerima / Keterangan (Opsional)
                              </label>
                              <input
                                type="text"
                                value={b.atas_nama ?? ''}
                                onChange={(e) =>
                                  setNonAkta((prev) => ({
                                    ...prev,
                                    bidang_pecahan: (prev.bidang_pecahan ?? []).map((x) =>
                                      x.id === b.id ? { ...x, atas_nama: e.target.value } : x
                                    ),
                                  }))
                                }
                                placeholder="Misal: Tri Handoko / Bidang Sisa"
                                className="input-airy w-full px-2.5 py-1.5"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Luas (m²)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={b.luas_m2}
                                onChange={(e) =>
                                  setNonAkta((prev) => ({
                                    ...prev,
                                    bidang_pecahan: (prev.bidang_pecahan ?? []).map((x) =>
                                      x.id === b.id
                                        ? { ...x, luas_m2: Number(e.target.value) || 0 }
                                        : x
                                    ),
                                  }))
                                }
                                className="input-airy w-full px-2.5 py-1.5 font-mono tabular-nums"
                              />
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setNonAkta((prev) => ({
                                    ...prev,
                                    bidang_pecahan: (prev.bidang_pecahan ?? []).filter(
                                      (x) => x.id !== b.id
                                    ),
                                  }))
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-medium"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <label className="flex items-center gap-2 p-2.5 rounded-xl border border-teal-900/12 dark:border-teal-500/20 bg-white dark:bg-[#081E22] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(nonAkta.sertakan_pelepasan_jalan)}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                sertakan_pelepasan_jalan: e.target.checked,
                              })
                            }
                            className="rounded border-teal-500/40 accent-teal-600"
                          />
                          <span className="font-medium text-slate-800 dark:text-teal-100">
                            Sertakan Surat Pelepasan Hak Tanah untuk Jalan
                          </span>
                        </label>
                        <label className="flex items-center gap-2 p-2.5 rounded-xl border border-teal-900/12 dark:border-teal-500/20 bg-white dark:bg-[#081E22] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(nonAkta.sertakan_beda_nama)}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                sertakan_beda_nama: e.target.checked,
                              })
                            }
                            className="rounded border-teal-500/40 accent-teal-600"
                          />
                          <span className="font-medium text-slate-800 dark:text-teal-100">
                            Sertakan Surat Pernyataan Beda Nama (Pengesahan Camat &amp; Kades)
                          </span>
                        </label>
                      </div>

                      {nonAkta.sertakan_pelepasan_jalan && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl border border-teal-900/10 dark:border-teal-500/20 bg-white dark:bg-[#081E22]">
                          <div>
                            <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                              Luas Tanah Dilepas untuk Jalan (m²)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={nonAkta.pelepasan_jalan_luas_m2 ?? 0}
                              onChange={(e) =>
                                setNonAkta({
                                  ...nonAkta,
                                  pelepasan_jalan_luas_m2: Number(e.target.value) || 0,
                                })
                              }
                              className="input-airy w-full px-2.5 py-1.5 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                              Posisi Jalur Jalan pada Sket
                            </label>
                            <select
                              aria-label="Posisi jalur pelepasan jalan pada sket"
                              value={nonAkta.pelepasan_jalan_sisi ?? 'utara'}
                              onChange={(e) =>
                                setNonAkta({
                                  ...nonAkta,
                                  pelepasan_jalan_sisi: e.target.value as
                                    | 'utara'
                                    | 'timur'
                                    | 'selatan'
                                    | 'barat',
                                })
                              }
                              className="input-airy w-full px-2.5 py-1.5"
                            >
                              <option value="utara">Sisi Utara (Atas)</option>
                              <option value="timur">Sisi Timur (Kanan)</option>
                              <option value="selatan">Sisi Selatan (Bawah)</option>
                              <option value="barat">Sisi Barat (Kiri)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                              Keterangan Jalan (Opsional)
                            </label>
                            <input
                              type="text"
                              value={nonAkta.pelepasan_jalan_keterangan ?? ''}
                              onChange={(e) =>
                                setNonAkta({
                                  ...nonAkta,
                                  pelepasan_jalan_keterangan: e.target.value,
                                })
                              }
                              placeholder="Misal: Akses jalan umum RT 001/002"
                              className="input-airy w-full px-2.5 py-1.5"
                            />
                          </div>
                        </div>
                      )}

                      {/* Studio Sket Bidang Tanah: Generator Sket CAD & Unggah Sket Jadi */}
                      <SketchRefinerStudio
                        nonAkta={nonAkta}
                        setNonAkta={setNonAkta}
                        tanah={tanah}
                        isPemecahan={
                          layanan === 'Pemecahan' || layanan === 'Pemecahan/Ukur Ulang'
                        }
                        onNotify={onNotify}
                      />
                    </div>
                  )}

                  {/* 4. Detail Khusus Ralat Data */}
                  {layanan === 'Ralat Data' && (
                    <div className="sm:col-span-2 border border-teal-900/12 dark:border-teal-500/20 rounded-2xl p-4 bg-[#F6FBFA] dark:bg-[#0A2226] space-y-3">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white border-b border-teal-900/10 dark:border-teal-500/20 pb-2">
                        Data Ralat Sertipikat, Beda Nama &amp; Kronologi
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="rd-keperluan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Keperluan Permohonan
                          </label>
                          <input
                            id="rd-keperluan"
                            type="text"
                            value={nonAkta.keperluan_ralat ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, keperluan_ralat: e.target.value })
                            }
                            placeholder="Ralat Data Sertipikat"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label htmlFor="rd-kk" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Nomor Kartu Keluarga (KK)
                          </label>
                          <input
                            id="rd-kk"
                            type="text"
                            value={nonAkta.nomor_kk ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, nomor_kk: e.target.value })
                            }
                            placeholder="3309..."
                            className="input-airy w-full px-2.5 py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label htmlFor="rd-nama-cert" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Nama Tertulis di Sertipikat
                          </label>
                          <input
                            id="rd-nama-cert"
                            type="text"
                            value={nonAkta.nama_di_sertipikat ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, nama_di_sertipikat: e.target.value })
                            }
                            placeholder="Contoh: SARNO / WAGINEM"
                            className="input-airy w-full px-2.5 py-1.5 font-medium"
                          />
                        </div>
                        <div>
                          <label htmlFor="rd-nama-ktp" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Nama Benar Sesuai KTP &amp; KK
                          </label>
                          <input
                            id="rd-nama-ktp"
                            type="text"
                            value={nonAkta.nama_di_ktp_kk ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, nama_di_ktp_kk: e.target.value })
                            }
                            placeholder="Contoh: SUWARNO"
                            className="input-airy w-full px-2.5 py-1.5 font-medium"
                          />
                        </div>
                        <div>
                          <label htmlFor="rd-dok-lain" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Jenis Dokumen Lain (Opsional)
                          </label>
                          <input
                            id="rd-dok-lain"
                            type="text"
                            value={nonAkta.jenis_dokumen_lain ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, jenis_dokumen_lain: e.target.value })
                            }
                            placeholder="Akta Kelahiran / Buku Nikah / Ijazah"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label htmlFor="rd-nama-dok-lain" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Nama pada Dokumen Lain (Opsional)
                          </label>
                          <input
                            id="rd-nama-dok-lain"
                            type="text"
                            value={nonAkta.nama_di_dokumen_lain ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, nama_di_dokumen_lain: e.target.value })
                            }
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="rd-kronologi" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Uraian Kronologi Tambahan (Opsional)
                          </label>
                          <textarea
                            id="rd-kronologi"
                            rows={2}
                            value={nonAkta.uraian_kronologi ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, uraian_kronologi: e.target.value })
                            }
                            placeholder="Kosongkan untuk menggunakan uraian kronologi standar..."
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4b. Detail Khusus Pengecekan Sertipikat */}
                  {layanan === 'Pengecekan Sertipikat' && (
                    <div className="sm:col-span-2 border border-teal-900/12 dark:border-teal-500/20 rounded-2xl p-4 bg-[#F6FBFA] dark:bg-[#0A2226] space-y-3">
                      <div className="border-b border-teal-900/10 dark:border-teal-500/20 pb-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                          Pengaturan Penerima Kuasa Pengecekan Sertipikat (Hal. 1–3)
                        </h3>
                        <p className="text-[11px] text-slate-600 dark:text-teal-200/75 mt-0.5">
                          Sesuai format standar ATR/BPN: Permohonan (Poin 13), Surat Kuasa Substitusi, dan Pernyataan Pertanggungjawaban Keabsahan Dokumen Online.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Mode Penerima Kuasa Pengecekan">
                        {[
                          {
                            id: 'ppats' as const,
                            label: 'PPATS / Camat (Sesuai Contoh Standar)',
                            desc: 'Menampilkan Camat/PPATS beserta NIP sebagai Penerima Kuasa.',
                          },
                          {
                            id: 'kuasa_bpn' as const,
                            label: 'Staf Kuasa BPN',
                            desc: 'Menggunakan data Penerima Kuasa BPN di panel bawah.',
                          },
                        ].map((opt) => {
                          const active = (nonAkta.pengecekan_kuasa_mode ?? 'ppats') === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() =>
                                setNonAkta({ ...nonAkta, pengecekan_kuasa_mode: opt.id })
                              }
                              className={`p-3 rounded-xl border text-left transition-colors ${
                                active
                                  ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                                  : 'border-teal-900/12 dark:border-teal-500/25 bg-white dark:bg-[#081E22] text-slate-700 dark:text-teal-100 hover:bg-teal-50 dark:hover:bg-[#103036]'
                              }`}
                            >
                              <span className="block text-xs font-bold">{opt.label}</span>
                              <span
                                className={`block text-[11px] mt-0.5 ${
                                  active ? 'text-teal-50' : 'text-slate-500 dark:text-teal-200/70'
                                }`}
                              >
                                {opt.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {(nonAkta.pengecekan_kuasa_mode ?? 'ppats') === 'ppats' && (
                        <div className="space-y-3 pt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label htmlFor="cek-ppats-ttl" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                Tempat / Tanggal Lahir PPATS (Opsional)
                              </label>
                              <input
                                id="cek-ppats-ttl"
                                type="text"
                                value={nonAkta.ppats_ttl ?? ''}
                                onChange={(e) =>
                                  setNonAkta({ ...nonAkta, ppats_ttl: e.target.value })
                                }
                                placeholder="Contoh: Boyolali, 12-04-1978"
                                className="input-airy w-full px-2.5 py-1.5"
                              />
                            </div>
                            <div>
                              <label htmlFor="cek-ppats-nik" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                Nomor KTP (NIK) PPATS (Opsional)
                              </label>
                              <input
                                id="cek-ppats-nik"
                                type="text"
                                value={nonAkta.ppats_nik ?? ''}
                                onChange={(e) =>
                                  setNonAkta({ ...nonAkta, ppats_nik: e.target.value })
                                }
                                placeholder="3309..."
                                className="input-airy w-full px-2.5 py-1.5 font-mono"
                              />
                            </div>
                            <div>
                              <label htmlFor="cek-ppats-pekerjaan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                Pekerjaan / Jabatan PPATS
                              </label>
                              <input
                                id="cek-ppats-pekerjaan"
                                type="text"
                                value={nonAkta.ppats_pekerjaan ?? ''}
                                onChange={(e) =>
                                  setNonAkta({ ...nonAkta, ppats_pekerjaan: e.target.value })
                                }
                                placeholder={`Camat ${(settings.nama_kecamatan || '').replace(/^Kecamatan\s+/i, '')} / PPATS`}
                                className="input-airy w-full px-2.5 py-1.5"
                              />
                            </div>
                            <div>
                              <label htmlFor="cek-ppats-alamat" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                Alamat Kantor / Domisili PPATS
                              </label>
                              <input
                                id="cek-ppats-alamat"
                                type="text"
                                value={nonAkta.ppats_alamat ?? ''}
                                onChange={(e) =>
                                  setNonAkta({ ...nonAkta, ppats_alamat: e.target.value })
                                }
                                placeholder={settings.alamat_ppats || settings.alamat_kantor}
                                className="input-airy w-full px-2.5 py-1.5"
                              />
                            </div>
                          </div>
                          {onSaveSettings && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-teal-900/10 dark:border-teal-500/15">
                              <span className="text-[11px] text-slate-500 dark:text-teal-200/70">
                                Simpan NIK, TTL &amp; Alamat ini sebagai default kantor agar otomatis terisi di berkas berikutnya.
                              </span>
                              <button
                                type="button"
                                disabled={savingPpatsProfile}
                                onClick={async () => {
                                  setSavingPpatsProfile(true);
                                  try {
                                    const nextSettings = buildPpatsSettingsPatchFromNonAkta(
                                      settings,
                                      {
                                        nama_ppats: akta.nama_ppats,
                                        nip_ppats: akta.nip_ppats,
                                        ppats_nik: nonAkta.ppats_nik,
                                        ppats_ttl: nonAkta.ppats_ttl,
                                        ppats_alamat: nonAkta.ppats_alamat,
                                      }
                                    );
                                    await onSaveSettings(nextSettings);
                                    onNotify(
                                      'Data PPATS (NIK, Tanggal Lahir & Alamat) berhasil disimpan ke Profil Kantor.',
                                      'success'
                                    );
                                  } catch (err) {
                                    onNotify(
                                      err instanceof Error
                                        ? err.message
                                        : 'Gagal menyimpan data PPATS ke Profil Kantor.',
                                      'error'
                                    );
                                  } finally {
                                    setSavingPpatsProfile(false);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-600/35 bg-white dark:bg-[#081E22] text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-[#103036] text-xs font-semibold transition-colors disabled:opacity-60"
                              >
                                {savingPpatsProfile ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Save className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {savingPpatsProfile ? 'Menyimpan...' : 'Simpan ke Profil PPATS'}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4b-bis. Detail Khusus Analisis Bidang (Permohonan Peta Analisis, Sket Rencana Pemecahan & Alasan Pemecahan) */}
                  {layanan === 'Analisis Bidang' && (
                    <div className="sm:col-span-2 border border-teal-900/12 dark:border-teal-500/20 rounded-2xl p-4 bg-[#F6FBFA] dark:bg-[#0A2226] space-y-3.5">
                      <div className="border-b border-teal-900/10 dark:border-teal-500/20 pb-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                          Permohonan Peta Analisis Penatagunaan Tanah, Sket Rencana Pemecahan &amp; Alasan Pemecahan
                        </h3>
                        <p className="text-[11px] text-slate-600 dark:text-teal-200/75 mt-0.5">
                          Menghasilkan Permohonan Peta Analisis (RTRW/RDTR, LSD &amp; LP2B), Surat Kuasa, Sket Rencana Pemecahan Bidang Tanah, Surat Pernyataan Alasan Pemecahan (8 Poin), opsional Pelepasan Jalan, serta Keabsahan Lokasi &amp; Geotagging.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="analisis-no-hp" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Nomor HP Pemohon / Kuasa
                          </label>
                          <input
                            id="analisis-no-hp"
                            type="text"
                            value={nonAkta.analisis_no_hp ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, analisis_no_hp: e.target.value })
                            }
                            placeholder="08xxxxxxxxxx"
                            className="input-airy w-full px-2.5 py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label htmlFor="analisis-skala" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Skala Peta Multimedia
                          </label>
                          <input
                            id="analisis-skala"
                            type="text"
                            value={nonAkta.analisis_skala_peta ?? '1 : 1000'}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, analisis_skala_peta: e.target.value })
                            }
                            placeholder="1 : 1000"
                            className="input-airy w-full px-2.5 py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label htmlFor="analisis-jumlah-bidang" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Jumlah Bidang Rencana Pecah
                          </label>
                          <input
                            id="analisis-jumlah-bidang"
                            type="number"
                            min="1"
                            max="20"
                            value={
                              (nonAkta.bidang_pecahan ?? []).length > 0
                                ? (nonAkta.bidang_pecahan ?? []).length
                                : nonAkta.analisis_jumlah_bidang ?? 3
                            }
                            disabled={(nonAkta.bidang_pecahan ?? []).length > 0}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                analisis_jumlah_bidang: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="input-airy w-full px-2.5 py-1.5 font-mono disabled:opacity-70"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label htmlFor="analisis-tema" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Tema Analisis Penatagunaan Tanah
                          </label>
                          <input
                            id="analisis-tema"
                            type="text"
                            value={
                              nonAkta.analisis_tema ??
                              'Kesesuaian Penggunaan Tanah terhadap RTRW atau RDTR, LSD dan LP2B'
                            }
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, analisis_tema: e.target.value })
                            }
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label htmlFor="analisis-penggunaan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Keperluan / Rencana Penggunaan (Poin 2)
                          </label>
                          <input
                            id="analisis-penggunaan"
                            type="text"
                            value={nonAkta.analisis_rencana_penggunaan ?? 'Rumah Tinggal'}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                analisis_rencana_penggunaan: e.target.value,
                              })
                            }
                            placeholder="Rumah Tinggal"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label htmlFor="analisis-alasan-peralihan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Kepentingan Peralihan Hak (Poin 5)
                          </label>
                          <input
                            id="analisis-alasan-peralihan"
                            type="text"
                            value={nonAkta.analisis_alasan_peralihan ?? 'HIBAH kepada anak'}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                analisis_alasan_peralihan: e.target.value,
                              })
                            }
                            placeholder="HIBAH kepada anak / JUAL BELI / WARIS"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label htmlFor="analisis-alasan-tabel" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Alasan Pemecahan Default Tabel Sket
                          </label>
                          <input
                            id="analisis-alasan-tabel"
                            type="text"
                            value={nonAkta.analisis_alasan_tabel ?? 'dihibahkan ke anak'}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                analisis_alasan_tabel: e.target.value,
                              })
                            }
                            placeholder="dihibahkan ke anak"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                      </div>

                      {/* Tabel Rincian Bidang Pecahan untuk Sket Rencana Pemecahan */}
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            Tabel Rincian Bidang Sket Rencana Pemecahan ({(nonAkta.bidang_pecahan ?? []).length} baris)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextNum = (nonAkta.bidang_pecahan ?? []).length + 1;
                              const item: PemecahanBidangItem = {
                                id: `ab-${Date.now()}-${nextNum}`,
                                label: `Bidang ${nextNum}`,
                                luas_m2: 0,
                                rencana_penggunaan:
                                  nonAkta.analisis_rencana_penggunaan || 'Rumah Tinggal',
                                alasan_pemecahan:
                                  nonAkta.analisis_alasan_tabel || 'dihibahkan ke anak',
                              };
                              setNonAkta((prev) => ({
                                ...prev,
                                bidang_pecahan: [...(prev.bidang_pecahan ?? []), item],
                              }));
                            }}
                            className="btn-3d btn-3d-teal inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Tambah Baris Bidang</span>
                          </button>
                        </div>

                        {(nonAkta.bidang_pecahan ?? []).length === 0 ? (
                          <p className="text-[11px] text-slate-500 dark:text-teal-200/70">
                            Belum ada rincian per bidang — dokumen Sket otomatis menyiapkan {nonAkta.analisis_jumlah_bidang ?? 3} baris kosong dengan Rencana Penggunaan &amp; Alasan Pemecahan default di atas. Klik &ldquo;Tambah Baris Bidang&rdquo; untuk mengisi luas masing-masing bidang.
                          </p>
                        ) : (
                          (nonAkta.bidang_pecahan ?? []).map((b, bIdx) => (
                            <div
                              key={b.id}
                              className="p-3 rounded-xl border border-teal-900/10 dark:border-teal-500/20 bg-white dark:bg-[#081E22] grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
                            >
                              <div className="sm:col-span-4">
                                <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                  Rencana Penggunaan #{bIdx + 1}
                                </label>
                                <input
                                  type="text"
                                  value={b.rencana_penggunaan ?? b.keterangan ?? 'Rumah Tinggal'}
                                  onChange={(e) =>
                                    setNonAkta((prev) => ({
                                      ...prev,
                                      bidang_pecahan: (prev.bidang_pecahan ?? []).map((x) =>
                                        x.id === b.id
                                          ? { ...x, rencana_penggunaan: e.target.value }
                                          : x
                                      ),
                                    }))
                                  }
                                  placeholder="Rumah Tinggal"
                                  className="input-airy w-full px-2.5 py-1.5"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                  Luas (m²)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={b.luas_m2}
                                  onChange={(e) =>
                                    setNonAkta((prev) => ({
                                      ...prev,
                                      bidang_pecahan: (prev.bidang_pecahan ?? []).map((x) =>
                                        x.id === b.id
                                          ? { ...x, luas_m2: Number(e.target.value) || 0 }
                                          : x
                                      ),
                                    }))
                                  }
                                  className="input-airy w-full px-2.5 py-1.5 font-mono tabular-nums"
                                />
                              </div>
                              <div className="sm:col-span-4">
                                <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                  Alasan Pemecahan
                                </label>
                                <input
                                  type="text"
                                  value={b.alasan_pemecahan ?? 'dihibahkan ke anak'}
                                  onChange={(e) =>
                                    setNonAkta((prev) => ({
                                      ...prev,
                                      bidang_pecahan: (prev.bidang_pecahan ?? []).map((x) =>
                                        x.id === b.id
                                          ? { ...x, alasan_pemecahan: e.target.value }
                                          : x
                                      ),
                                    }))
                                  }
                                  placeholder="dihibahkan ke anak"
                                  className="input-airy w-full px-2.5 py-1.5"
                                />
                              </div>
                              <div className="sm:col-span-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setNonAkta((prev) => ({
                                      ...prev,
                                      bidang_pecahan: (prev.bidang_pecahan ?? []).filter(
                                        (x) => x.id !== b.id
                                      ),
                                    }))
                                  }
                                  aria-label={`Hapus bidang pecahan #${bIdx + 1}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-medium"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Hapus</span>
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Rencana & Pelepasan Jalan / Saluran + Opsional Upload Gambar Sket */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div>
                          <label htmlFor="analisis-jalan-rencana" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Rencana Jalan / Saluran (m²)
                          </label>
                          <input
                            id="analisis-jalan-rencana"
                            type="number"
                            min="0"
                            step="0.01"
                            value={nonAkta.analisis_rencana_jalan_luas_m2 ?? 0}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                analisis_rencana_jalan_luas_m2: Number(e.target.value) || 0,
                              })
                            }
                            placeholder="40"
                            className="input-airy w-full px-2.5 py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label htmlFor="analisis-jalan-lepas" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Pelepasan Jalan / Saluran (m²)
                          </label>
                          <input
                            id="analisis-jalan-lepas"
                            type="number"
                            min="0"
                            step="0.01"
                            value={nonAkta.pelepasan_jalan_luas_m2 ?? 0}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                pelepasan_jalan_luas_m2: Number(e.target.value) || 0,
                              })
                            }
                            placeholder="40"
                            className="input-airy w-full px-2.5 py-1.5 font-mono"
                          />
                        </div>
                        <div className="flex items-end">
                          <label className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-teal-900/12 dark:border-teal-500/20 bg-white dark:bg-[#081E22] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(nonAkta.sertakan_pelepasan_jalan)}
                              onChange={(e) =>
                                setNonAkta({
                                  ...nonAkta,
                                  sertakan_pelepasan_jalan: e.target.checked,
                                })
                              }
                              className="rounded border-teal-500/40 accent-teal-600"
                            />
                            <span className="font-medium text-slate-800 dark:text-teal-100 text-[11px]">
                              Sertakan Halaman Surat Pelepasan Hak untuk Jalan
                            </span>
                          </label>
                        </div>
                      </div>

                      {nonAkta.sertakan_pelepasan_jalan && (
                        <div>
                          <label htmlFor="analisis-jalan-ket" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Keterangan Jalan Pelepasan (Opsional)
                          </label>
                          <input
                            id="analisis-jalan-ket"
                            type="text"
                            value={nonAkta.pelepasan_jalan_keterangan ?? ''}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                pelepasan_jalan_keterangan: e.target.value,
                              })
                            }
                            placeholder="Misal: Jalan Umum / Akses Bidang Pecahan"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                      )}

                      {/* Opsional Upload Gambar Sket Rencana Pemecahan */}
                      <div className="p-2.5 rounded-xl border border-teal-900/10 dark:border-teal-500/20 bg-white dark:bg-[#081E22] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                        <div className="text-[11px]">
                          <p className="font-bold text-slate-800 dark:text-teal-50">
                            Gambar Sket Rencana Pemecahan (Opsional)
                          </p>
                          <p className="text-slate-500 dark:text-teal-200/70">
                            Unggah gambar sket untuk disisipkan otomatis ke bingkai Hal. 3, atau biarkan kosong untuk kotak sket siap gambar tangan berpanah Utara (U).
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {nonAkta.foto_sket_pecah && (
                            <button
                              type="button"
                              onClick={() =>
                                setNonAkta((prev) => ({ ...prev, foto_sket_pecah: '' }))
                              }
                              className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline px-2 py-1"
                            >
                              Hapus Sket
                            </button>
                          )}
                          <label className="btn-3d btn-3d-light inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer">
                            <ImagePlus className="w-3.5 h-3.5 text-teal-600 dark:text-teal-300" />
                            <span>{nonAkta.foto_sket_pecah ? 'Ganti Gambar Sket' : 'Unggah Gambar Sket'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              aria-label="Unggah gambar sket rencana pemecahan"
                              onChange={(e) => void handleGeotagPhotoUpload('foto_sket_pecah', e)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4c. Detail Khusus Geotagging, Foto Tampak Depan, Patok 1–4 & Poligon */}
                  {(layanan === 'Validasi Sertipikat' ||
                    layanan === 'Analisis Bidang' ||
                    layanan === 'Waris C' ||
                    layanan === 'Pemecahan' ||
                    layanan === 'Ukur Ulang' ||
                    layanan === 'Pemecahan/Ukur Ulang') && (
                    <div className="sm:col-span-2 border border-teal-900/12 dark:border-teal-500/20 rounded-2xl p-4 bg-[#F6FBFA] dark:bg-[#0A2226] space-y-3">
                      <div className="border-b border-teal-900/10 dark:border-teal-500/20 pb-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                          {layanan === 'Validasi Sertipikat'
                            ? 'Lampiran Geotagging & Foto GPS Map Camera (Validasi Sertipikat)'
                            : layanan === 'Waris C'
                            ? 'Lampiran Geotagging, Foto Patok 1–4 & Peta Poligon (Hal. 15–16 Waris C)'
                            : layanan === 'Analisis Bidang'
                            ? 'Data Koordinat Poligon, Geotagging & Foto Lokasi (Analisis Bidang)'
                            : `Lampiran Foto Lokasi Tampak Depan Geotagging, Patok 1–4 & Poligon (${layanan})`}
                        </h3>
                        <p className="text-[11px] text-slate-600 dark:text-teal-200/75 mt-0.5">
                          Isi koordinat GPS, tautan Google Maps, serta unggah foto Tampak Depan, Patok 1–4, dan citra Poligon agar langsung tercetak rapi dalam 2 halaman lampiran Word (.DOCX), atau biarkan kosong untuk bingkai siap tempel.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="geo-maps" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Tautan Google Maps Lokasi
                          </label>
                          <input
                            id="geo-maps"
                            type="url"
                            value={nonAkta.link_maps ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, link_maps: e.target.value })
                            }
                            placeholder="https://maps.app.goo.gl/..."
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label htmlFor="geo-gps" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Koordinat GPS Bidang (Opsional)
                          </label>
                          <input
                            id="geo-gps"
                            type="text"
                            value={nonAkta.koordinat_gps ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, koordinat_gps: e.target.value })
                            }
                            placeholder="-7.514428, 110.809820"
                            className="input-airy w-full px-2.5 py-1.5 font-mono"
                          />
                        </div>

                        {(layanan === 'Analisis Bidang' ||
                          layanan === 'Pemecahan' ||
                          layanan === 'Ukur Ulang' ||
                          layanan === 'Pemecahan/Ukur Ulang') && (
                          <div className="sm:col-span-2">
                            <label htmlFor="geo-poligon" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                              Titik Koordinat Sudut Poligon (1 titik per baris, opsional)
                            </label>
                            <textarea
                              id="geo-poligon"
                              rows={3}
                              value={nonAkta.koordinat_poligon ?? ''}
                              onChange={(e) =>
                                setNonAkta({ ...nonAkta, koordinat_poligon: e.target.value })
                              }
                              placeholder={'-7.514428, 110.809986\n-7.514346, 110.809631\n-7.514554, 110.809937\n-7.514486, 110.809596'}
                              className="input-airy w-full px-2.5 py-1.5 font-mono text-xs"
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 pt-1">
                        <p className="text-[11px] font-semibold text-slate-700 dark:text-teal-100/90">
                          Unggah Foto Geotagging (Opsional — Otomatis Disematkan ke DOCX)
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {(
                            [
                              { key: 'foto_tampak_depan', label: 'Tampak Depan' },
                              { key: 'foto_patok_1', label: 'Patok 1' },
                              { key: 'foto_patok_2', label: 'Patok 2' },
                              { key: 'foto_patok_3', label: 'Patok 3' },
                              { key: 'foto_patok_4', label: 'Patok 4' },
                              { key: 'foto_poligon', label: 'Poligon / Citra' },
                            ] as const
                          ).map((slot) => {
                            const val = nonAkta[slot.key];
                            return (
                              <div
                                key={slot.key}
                                className="p-2.5 rounded-xl border border-teal-900/12 dark:border-teal-500/20 bg-white dark:bg-[#081E22] space-y-2"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[11px] font-bold text-slate-800 dark:text-teal-50">
                                    {slot.label}
                                  </span>
                                  {val && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setNonAkta((prev) => ({ ...prev, [slot.key]: '' }))
                                      }
                                      aria-label={`Hapus foto ${slot.label}`}
                                      className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                                    >
                                      Hapus
                                    </button>
                                  )}
                                </div>
                                {val ? (
                                  <img
                                    src={val}
                                    alt={slot.label}
                                    className="w-full h-20 object-cover rounded-lg border border-teal-900/10"
                                  />
                                ) : (
                                  <label className="flex flex-col items-center justify-center h-20 rounded-lg border border-dashed border-teal-500/40 bg-teal-50/40 dark:bg-teal-950/30 cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors text-[11px] text-teal-700 dark:text-teal-200">
                                    <ImagePlus className="w-4 h-4 mb-1" />
                                    <span>Pilih Foto</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      aria-label={`Unggah foto ${slot.label}`}
                                      onChange={(e) => void handleGeotagPhotoUpload(slot.key, e)}
                                      className="hidden"
                                    />
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4d. Detail Khusus Permohonan PKKPR (DPMPTSP) */}
                  {layanan === 'Permohonan PKKPR' && (
                    <div className="sm:col-span-2 border border-teal-900/12 dark:border-teal-500/20 rounded-2xl p-4 bg-[#F6FBFA] dark:bg-[#0A2226] space-y-3.5">
                      <div className="border-b border-teal-900/10 dark:border-teal-500/20 pb-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                          Formulir Permohonan PKKPR (DPMPTSP) &amp; Surat Kuasa Pengurusan
                        </h3>
                        <p className="text-[11px] text-slate-600 dark:text-teal-200/75 mt-0.5">
                          Menghasilkan Hal. 1 Surat Permohonan PKKPR kepada Bupati Cq. Kepala DPMPTSP, Hal. 2 Surat Kuasa Pengurusan, dan opsional Hal. 3 Surat Kuasa Kedua.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="pkkpr-jenis" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Jenis Kegiatan PKKPR
                          </label>
                          <select
                            id="pkkpr-jenis"
                            value={nonAkta.pkkpr_jenis_kegiatan ?? 'Non Berusaha'}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                pkkpr_jenis_kegiatan: e.target.value as 'Non Berusaha' | 'Berusaha',
                              })
                            }
                            className="input-airy w-full px-2.5 py-1.5 font-semibold"
                          >
                            <option value="Non Berusaha">Non Berusaha</option>
                            <option value="Berusaha">Berusaha</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="pkkpr-nomor" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Nomor Surat (Opsional)
                          </label>
                          <input
                            id="pkkpr-nomor"
                            type="text"
                            value={nonAkta.pkkpr_nomor_surat ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, pkkpr_nomor_surat: e.target.value })
                            }
                            placeholder="Kosongkan untuk titik-titik"
                            className="input-airy w-full px-2.5 py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label htmlFor="pkkpr-lampiran" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Lampiran
                          </label>
                          <input
                            id="pkkpr-lampiran"
                            type="text"
                            value={nonAkta.pkkpr_lampiran ?? '1 (Satu) Berkas'}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, pkkpr_lampiran: e.target.value })
                            }
                            placeholder="1 (Satu) Berkas"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>

                        <div>
                          <label htmlFor="pkkpr-telp" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            No. Telp / WA Pemohon
                          </label>
                          <input
                            id="pkkpr-telp"
                            type="text"
                            value={nonAkta.pkkpr_telepon ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, pkkpr_telepon: e.target.value })
                            }
                            placeholder="08..."
                            className="input-airy w-full px-2.5 py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label htmlFor="pkkpr-email" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Email Pemohon
                          </label>
                          <input
                            id="pkkpr-email"
                            type="email"
                            value={nonAkta.pkkpr_email ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, pkkpr_email: e.target.value })
                            }
                            placeholder="nama@gmail.com"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label htmlFor="pkkpr-npwp" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            No. NPWP (Opsional)
                          </label>
                          <input
                            id="pkkpr-npwp"
                            type="text"
                            value={nonAkta.pkkpr_npwp ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, pkkpr_npwp: e.target.value })
                            }
                            placeholder="-"
                            className="input-airy w-full px-2.5 py-1.5 font-mono"
                          />
                        </div>

                        <div>
                          <label htmlFor="pkkpr-diwakili" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Perorangan / Badan yg Diwakili
                          </label>
                          <input
                            id="pkkpr-diwakili"
                            type="text"
                            value={nonAkta.pkkpr_diwakili ?? 'Diri Sendiri'}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, pkkpr_diwakili: e.target.value })
                            }
                            placeholder="Diri Sendiri"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label htmlFor="pkkpr-kbli" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Pemanfaatan Ruang (KBLI)
                          </label>
                          <input
                            id="pkkpr-kbli"
                            type="text"
                            value={nonAkta.pkkpr_kbli ?? 'Rumah Tinggal'}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, pkkpr_kbli: e.target.value })
                            }
                            placeholder="Rumah Tinggal / Perdagangan"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label htmlFor="pkkpr-lantai" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                              Jml Lantai
                            </label>
                            <input
                              id="pkkpr-lantai"
                              type="text"
                              value={nonAkta.pkkpr_jumlah_lantai ?? '1'}
                              onChange={(e) =>
                                setNonAkta({ ...nonAkta, pkkpr_jumlah_lantai: e.target.value })
                              }
                              placeholder="1"
                              className="input-airy w-full px-2.5 py-1.5"
                            />
                          </div>
                          <div>
                            <label htmlFor="pkkpr-luas-bgn" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                              Luas Bgn
                            </label>
                            <input
                              id="pkkpr-luas-bgn"
                              type="text"
                              value={nonAkta.pkkpr_luas_bangunan ?? '± 100 m2'}
                              onChange={(e) =>
                                setNonAkta({ ...nonAkta, pkkpr_luas_bangunan: e.target.value })
                              }
                              placeholder="± 100 m2"
                              className="input-airy w-full px-2.5 py-1.5"
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <label htmlFor="pkkpr-alamat-lokasi" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Alamat Lokasi Bidang (Dukuh / RT / RW)
                          </label>
                          <input
                            id="pkkpr-alamat-lokasi"
                            type="text"
                            value={nonAkta.pkkpr_alamat_lokasi ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, pkkpr_alamat_lokasi: e.target.value })
                            }
                            placeholder="Contoh: Dk. Ngesrep Rt. 006 / Rw. 005"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label htmlFor="pkkpr-kawasan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Kawasan (Opsional)
                          </label>
                          <input
                            id="pkkpr-kawasan"
                            type="text"
                            value={nonAkta.pkkpr_kawasan ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, pkkpr_kawasan: e.target.value })
                            }
                            placeholder="-"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label htmlFor="pkkpr-poligon" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Titik Koordinat Polygon pada Masing-masing Sudut (1 titik per baris — otomatis berhuruf a, b, c, d, ...)
                          </label>
                          <textarea
                            id="pkkpr-poligon"
                            rows={4}
                            value={nonAkta.koordinat_poligon ?? ''}
                            onChange={(e) =>
                              setNonAkta({ ...nonAkta, koordinat_poligon: e.target.value })
                            }
                            placeholder={'-7.530057, 110.779658\n-7.530119, 110.779647\n-7.530143, 110.779764\n-7.530080, 110.779779'}
                            className="input-airy w-full px-2.5 py-1.5 font-mono text-xs"
                          />
                        </div>
                      </div>

                      {/* Opsional Penerima Kuasa Kedua (Hal. 3 Surat Kuasa PKKPR) */}
                      <div className="p-3 rounded-xl border border-teal-900/12 dark:border-teal-500/20 bg-white dark:bg-[#081E22] space-y-2.5">
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(nonAkta.pkkpr_kuasa_2_aktif)}
                            onChange={(e) =>
                              setNonAkta({
                                ...nonAkta,
                                pkkpr_kuasa_2_aktif: e.target.checked,
                              })
                            }
                            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span>Sertakan Surat Kuasa Pengurusan Kedua (Hal. 3 — Opsional)</span>
                        </label>

                        {nonAkta.pkkpr_kuasa_2_aktif && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                            <div>
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                Nama Kuasa Kedua
                              </label>
                              <input
                                type="text"
                                value={nonAkta.pkkpr_kuasa_2_detail?.nama ?? ''}
                                onChange={(e) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    pkkpr_kuasa_2_detail: {
                                      ...(nonAkta.pkkpr_kuasa_2_detail ?? { nama: '' }),
                                      nama: e.target.value.toUpperCase(),
                                    },
                                  })
                                }
                                placeholder="NAMA PENERIMA KUASA 2"
                                className="input-airy w-full px-2.5 py-1.5 font-medium uppercase"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                Nomor KTP (NIK)
                              </label>
                              <input
                                type="text"
                                value={nonAkta.pkkpr_kuasa_2_detail?.nik ?? ''}
                                onChange={(e) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    pkkpr_kuasa_2_detail: {
                                      ...(nonAkta.pkkpr_kuasa_2_detail ?? { nama: '' }),
                                      nik: e.target.value,
                                    },
                                  })
                                }
                                placeholder="3309..."
                                className="input-airy w-full px-2.5 py-1.5 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                Pekerjaan
                              </label>
                              <input
                                type="text"
                                value={nonAkta.pkkpr_kuasa_2_detail?.pekerjaan ?? ''}
                                onChange={(e) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    pkkpr_kuasa_2_detail: {
                                      ...(nonAkta.pkkpr_kuasa_2_detail ?? { nama: '' }),
                                      pekerjaan: e.target.value,
                                    },
                                  })
                                }
                                placeholder="Karyawan Swasta"
                                className="input-airy w-full px-2.5 py-1.5"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                Tempat Lahir
                              </label>
                              <input
                                type="text"
                                value={nonAkta.pkkpr_kuasa_2_detail?.tempat_lahir ?? ''}
                                onChange={(e) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    pkkpr_kuasa_2_detail: {
                                      ...(nonAkta.pkkpr_kuasa_2_detail ?? { nama: '' }),
                                      tempat_lahir: e.target.value,
                                    },
                                  })
                                }
                                placeholder="Boyolali"
                                className="input-airy w-full px-2.5 py-1.5"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                Tanggal Lahir
                              </label>
                              <DateInputId
                                allowEmpty
                                value={nonAkta.pkkpr_kuasa_2_detail?.tanggal_lahir ?? ''}
                                onChange={(val) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    pkkpr_kuasa_2_detail: {
                                      ...(nonAkta.pkkpr_kuasa_2_detail ?? { nama: '' }),
                                      tanggal_lahir: val,
                                    },
                                  })
                                }
                                placeholder="DD-MM-YYYY"
                                ariaLabel="Tanggal lahir kuasa kedua PKKPR"
                                className="py-1.5 px-2.5"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                Alamat Lengkap
                              </label>
                              <input
                                type="text"
                                value={nonAkta.pkkpr_kuasa_2_detail?.alamat ?? ''}
                                onChange={(e) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    pkkpr_kuasa_2_detail: {
                                      ...(nonAkta.pkkpr_kuasa_2_detail ?? { nama: '' }),
                                      alamat: e.target.value,
                                    },
                                  })
                                }
                                placeholder="Dukuh, RT/RW, Desa, Kec, Kab"
                                className="input-airy w-full px-2.5 py-1.5"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 5. Pengesahan Ganda Camat & Kepala Desa Asal Sertipikat */}
                  {(layanan === 'Turun Waris' ||
                    layanan === 'Waris C' ||
                    layanan === 'Ralat Data' ||
                    nonAkta.sertakan_beda_nama) && (
                    <div className="sm:col-span-2 border border-amber-200 dark:border-amber-500/35 rounded-2xl p-4 bg-amber-50/50 dark:bg-amber-950/35 space-y-3">
                      <div className="border-b border-amber-200 dark:border-amber-500/30 pb-2">
                        <h3 className="text-xs font-bold text-amber-950 dark:text-amber-100">
                          Pengesahan Wajib Camat &amp; Kepala Desa Asal ({layanan === 'Waris C' ? 'Waris Letter C / SKW / Riwayat Tanah' : 'SKW / Beda Nama / Kronologi'})
                        </h3>
                        <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 mt-0.5">
                          Khusus Surat Keterangan Warisan, Bundel Waris Letter C, Surat Pernyataan Beda Nama, dan Kronologi Ralat Data wajib disahkan oleh kedua pejabat berikut: Camat dan Kepala Desa letak/asal tanah.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl border border-teal-900/12 dark:border-teal-500/20 bg-white dark:bg-[#0A2226] space-y-2.5">
                          <p className="font-bold text-slate-900 dark:text-white">1. Pengesahan Camat</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Jabatan Camat</label>
                              <input
                                type="text"
                                value={nonAkta.camat_pengesahan_jabatan ?? ''}
                                onChange={(e) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    camat_pengesahan_jabatan: e.target.value,
                                  })
                                }
                                placeholder={`Camat ${tanah.kecamatan || '-'}`}
                                className="input-airy w-full px-2.5 py-1.5"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Nama Camat</label>
                              <input
                                type="text"
                                value={nonAkta.camat_pengesahan_nama ?? ''}
                                onChange={(e) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    camat_pengesahan_nama: e.target.value,
                                  })
                                }
                                className="input-airy w-full px-2.5 py-1.5 font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">NIP Camat</label>
                              <input
                                type="text"
                                value={nonAkta.camat_pengesahan_nip ?? ''}
                                onChange={(e) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    camat_pengesahan_nip: e.target.value,
                                  })
                                }
                                className="input-airy w-full px-2.5 py-1.5 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                No. Register Kec (Opsional)
                              </label>
                              <input
                                type="text"
                                value={nonAkta.camat_pengesahan_nomor ?? ''}
                                onChange={(e) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    camat_pengesahan_nomor: e.target.value,
                                  })
                                }
                                placeholder="593/..."
                                className="input-airy w-full px-2.5 py-1.5 font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl border border-teal-900/12 dark:border-teal-500/20 bg-white dark:bg-[#0A2226] space-y-2.5">
                          <p className="font-bold text-slate-900 dark:text-white">
                            2. Pengesahan Kepala Desa Asal Sertipikat ({tanah.desa || '-'})
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="sm:col-span-2">
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Jabatan Kepala Desa</label>
                              <input
                                type="text"
                                value={nonAkta.kades_pengesahan_jabatan ?? ''}
                                onChange={(e) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    kades_pengesahan_jabatan: e.target.value,
                                  })
                                }
                                placeholder={`Kepala Desa ${tanah.desa || '-'}`}
                                className="input-airy w-full px-2.5 py-1.5"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Nama Kepala Desa</label>
                              <input
                                type="text"
                                value={nonAkta.kades_pengesahan_nama ?? ''}
                                onChange={(e) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    kades_pengesahan_nama: e.target.value,
                                  })
                                }
                                placeholder="Nama lengkap Kepala Desa"
                                className="input-airy w-full px-2.5 py-1.5 font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                NIP / NIAP Kades (Opsional)
                              </label>
                              <input
                                type="text"
                                value={nonAkta.kades_pengesahan_nip ?? ''}
                                onChange={(e) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    kades_pengesahan_nip: e.target.value,
                                  })
                                }
                                placeholder="Kosongkan jika tidak ada"
                                className="input-airy w-full px-2.5 py-1.5 font-mono"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                                No. Register Desa (Opsional)
                              </label>
                              <input
                                type="text"
                                value={nonAkta.kades_pengesahan_nomor ?? ''}
                                onChange={(e) =>
                                  setNonAkta({
                                    ...nonAkta,
                                    kades_pengesahan_nomor: e.target.value,
                                  })
                                }
                                placeholder="474/..."
                                className="input-airy w-full px-2.5 py-1.5 font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Form Lengkap Data Kuasa BPN */}
              <div className="sm:col-span-2 border border-teal-900/12 dark:border-teal-500/20 rounded-2xl p-4 bg-[#F6FBFA] dark:bg-[#0A2226] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-teal-900/10 dark:border-teal-500/20 pb-2.5">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Data Penerima Kuasa Substitusi BPN
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-teal-200/75">
                      Pilih staf kuasa dari daftar kantor atau isi/ubah detail lengkap untuk Surat Kuasa & Permohonan BPN.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                        scanningPersonKey === 'kuasa'
                          ? 'bg-amber-600 text-white'
                          : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
                      }`}
                    >
                      {scanningPersonKey === 'kuasa' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ScanLine className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {scanningPersonKey === 'kuasa'
                          ? 'Memindai...'
                          : 'Scan KTP Kuasa'}
                      </span>
                      <input
                        type="file"
                        accept={SCAN_DOC_FILE_ACCEPT}
                        aria-label="Scan KTP Kuasa BPN"
                        disabled={scanningPersonKey !== null}
                        onChange={(e) => void handleScanAktaPerson('kuasa', e)}
                        className="hidden"
                      />
                    </label>
                    <select
                      aria-label="Pilih preset Kuasa BPN"
                      value={
                        settings.daftar_kuasa_bpn.includes(akta.nama_kuasa_bpn)
                          ? akta.nama_kuasa_bpn
                          : '__manual__'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__manual__') return;
                        const preset = findPresetPerson(val, settings.profil_kuasa);
                        setAkta((prev) => ({
                          ...prev,
                          nama_kuasa_bpn: val,
                          kuasa_bpn_detail: preset,
                        }));
                      }}
                      className="input-airy px-2.5 py-1.5 text-xs font-semibold"
                    >
                      <option value="__manual__">-- Isi Manual / Custom --</option>
                      {settings.daftar_kuasa_bpn.map((k) => (
                        <option key={k} value={k}>
                          Preset: {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(() => {
                  const kd = akta.kuasa_bpn_detail ?? { nama: akta.nama_kuasa_bpn };
                  const updateKuasaDetail = (patch: Partial<PersonBasicInfo>) => {
                    const nextDetail: PersonBasicInfo = {
                      ...kd,
                      ...patch,
                      nama: patch.nama !== undefined ? patch.nama : kd.nama || akta.nama_kuasa_bpn,
                    };
                    setAkta((prev) => ({
                      ...prev,
                      nama_kuasa_bpn: nextDetail.nama,
                      kuasa_bpn_detail: nextDetail,
                    }));
                  };
                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label htmlFor="akta-kuasa" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                            Nama Kuasa BPN
                          </label>
                          <input
                            id="akta-kuasa"
                            type="text"
                            value={akta.nama_kuasa_bpn}
                            onChange={(e) =>
                              updateKuasaDetail({ nama: e.target.value.toUpperCase() })
                            }
                            placeholder="SUWARDJO"
                            className="input-airy w-full px-2.5 py-1.5 font-medium uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Nomor KTP (NIK)</label>
                          <input
                            type="text"
                            value={kd.nik ?? ''}
                            onChange={(e) => updateKuasaDetail({ nik: e.target.value })}
                            placeholder="3309111011570003"
                            className="input-airy w-full px-2.5 py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Pekerjaan</label>
                          <input
                            type="text"
                            value={kd.pekerjaan ?? ''}
                            onChange={(e) => updateKuasaDetail({ pekerjaan: e.target.value })}
                            placeholder="PENSIUNAN"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Tempat Lahir</label>
                          <input
                            type="text"
                            value={kd.tempat_lahir ?? ''}
                            onChange={(e) => updateKuasaDetail({ tempat_lahir: e.target.value })}
                            placeholder="Boyolali"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Tanggal Lahir</label>
                          <DateInputId
                            allowEmpty
                            value={kd.tanggal_lahir ?? ''}
                            onChange={(val) => updateKuasaDetail({ tanggal_lahir: val })}
                            placeholder="DD-MM-YYYY"
                            ariaLabel="Tanggal lahir kuasa BPN"
                            className="py-1.5 px-2.5"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Dukuh / Jalan</label>
                          <input
                            type="text"
                            value={kd.alamat_jalan ?? ''}
                            onChange={(e) => updateKuasaDetail({ alamat_jalan: e.target.value })}
                            placeholder="Dukuhrejo"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">RT</label>
                            <input
                              type="text"
                              value={kd.rt ?? ''}
                              onChange={(e) => updateKuasaDetail({ rt: e.target.value })}
                              placeholder="01"
                              className="input-airy w-full px-2 py-1.5 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">RW</label>
                            <input
                              type="text"
                              value={kd.rw ?? ''}
                              onChange={(e) => updateKuasaDetail({ rw: e.target.value })}
                              placeholder="02"
                              className="input-airy w-full px-2 py-1.5 font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Desa / Kelurahan</label>
                          <input
                            type="text"
                            value={kd.desa_kelurahan ?? ''}
                            onChange={(e) => updateKuasaDetail({ desa_kelurahan: e.target.value })}
                            placeholder="Donohudan"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Kecamatan</label>
                          <input
                            type="text"
                            value={kd.kecamatan ?? ''}
                            onChange={(e) => updateKuasaDetail({ kecamatan: e.target.value })}
                            placeholder="Ngemplak"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-3">
                          <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Kabupaten / Kota</label>
                          <input
                            type="text"
                            value={kd.kabupaten ?? ''}
                            onChange={(e) => updateKuasaDetail({ kabupaten: e.target.value })}
                            placeholder="Boyolali"
                            className="input-airy w-full px-2.5 py-1.5"
                          />
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white dark:bg-[#071A1D] border border-teal-900/12 dark:border-teal-500/25 text-[11px] text-slate-700 dark:text-teal-100/90 leading-relaxed">
                        <span className="font-bold text-slate-900 dark:text-white">Pratinjau Surat Kuasa:</span>{' '}
                        Nama: <strong className="text-slate-900 dark:text-white">{akta.nama_kuasa_bpn || '-'}</strong> · Tempat/Tgl.lahir:{' '}
                        {[kd.tempat_lahir, formatTanggalDDMMYYYY(kd.tanggal_lahir)].filter((x) => x && x !== '-').join(', ') || '-'} · Pekerjaan:{' '}
                        {kd.pekerjaan || '-'} · KTP: {kd.nik || '-'} · Alamat:{' '}
                        {formatPersonShortAddress(kd)}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Form Lengkap Data Saksi 1 & Saksi 2 */}
              {[
                {
                  num: 1 as const,
                  inputId: 'akta-saksi1',
                  label: 'Saksi 1 Akta',
                  nameVal: akta.saksi_1,
                  detailVal: akta.saksi_1_detail,
                  setSaksi: (nextName: string, nextDetail: PersonBasicInfo) =>
                    setAkta((prev) => ({
                      ...prev,
                      saksi_1: nextName,
                      saksi_1_detail: nextDetail,
                    })),
                },
                {
                  num: 2 as const,
                  inputId: 'akta-saksi2',
                  label: 'Saksi 2 Akta',
                  nameVal: akta.saksi_2,
                  detailVal: akta.saksi_2_detail,
                  setSaksi: (nextName: string, nextDetail: PersonBasicInfo) =>
                    setAkta((prev) => ({
                      ...prev,
                      saksi_2: nextName,
                      saksi_2_detail: nextDetail,
                    })),
                },
              ].map((sCfg) => {
                const sd = sCfg.detailVal ?? { nama: sCfg.nameVal };
                const resolved = resolvePersonDetail(
                  sCfg.nameVal,
                  settings.profil_saksi,
                  sd
                );
                const updateSaksiField = (patch: Partial<PersonBasicInfo>) => {
                  const nextDetail: PersonBasicInfo = {
                    ...sd,
                    ...patch,
                    nama: patch.nama !== undefined ? patch.nama : sd.nama || sCfg.nameVal,
                  };
                  sCfg.setSaksi(nextDetail.nama, nextDetail);
                };
                return (
                  <div
                    key={sCfg.num}
                    className="sm:col-span-2 border border-teal-900/12 dark:border-teal-500/20 rounded-2xl p-4 bg-[#F6FBFA] dark:bg-[#0A2226] space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-teal-900/10 dark:border-teal-500/20 pb-2.5">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        Data {sCfg.label}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                            scanningPersonKey === (sCfg.num === 1 ? 'saksi1' : 'saksi2')
                              ? 'bg-amber-600 text-white'
                              : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
                          }`}
                        >
                          {scanningPersonKey === (sCfg.num === 1 ? 'saksi1' : 'saksi2') ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ScanLine className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {scanningPersonKey === (sCfg.num === 1 ? 'saksi1' : 'saksi2')
                              ? 'Memindai...'
                              : `Scan KTP Saksi ${sCfg.num}`}
                          </span>
                          <input
                            type="file"
                            accept={SCAN_DOC_FILE_ACCEPT}
                            aria-label={`Scan KTP Saksi ${sCfg.num}`}
                            disabled={scanningPersonKey !== null}
                            onChange={(e) =>
                              void handleScanAktaPerson(
                                sCfg.num === 1 ? 'saksi1' : 'saksi2',
                                e
                              )
                            }
                            className="hidden"
                          />
                        </label>
                        <select
                          aria-label={`Pilih preset ${sCfg.label}`}
                          value={
                            settings.daftar_saksi.includes(sCfg.nameVal)
                              ? sCfg.nameVal
                              : '__manual__'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '__manual__') return;
                            sCfg.setSaksi(val, findPresetPerson(val, settings.profil_saksi));
                          }}
                          className="input-airy px-2.5 py-1.5 text-xs font-semibold"
                        >
                          <option value="__manual__">-- Isi Manual / Custom --</option>
                          {settings.daftar_saksi.map((s) => (
                            <option key={s} value={s}>
                              Preset: {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label htmlFor={sCfg.inputId} className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                          Nama Lengkap {sCfg.label}
                        </label>
                        <input
                          id={sCfg.inputId}
                          type="text"
                          value={sCfg.nameVal}
                          onChange={(e) =>
                            updateSaksiField({ nama: e.target.value.toUpperCase() })
                          }
                          placeholder="SALIMIN"
                          className="input-airy w-full px-2.5 py-1.5 font-medium uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Nomor KTP (NIK)</label>
                        <input
                          type="text"
                          value={sd.nik ?? ''}
                          onChange={(e) => updateSaksiField({ nik: e.target.value })}
                          placeholder="3309110307730005"
                          className="input-airy w-full px-2.5 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Pekerjaan</label>
                        <input
                          type="text"
                          value={sd.pekerjaan ?? ''}
                          onChange={(e) => updateSaksiField({ pekerjaan: e.target.value })}
                          placeholder="Perangkat Desa"
                          className="input-airy w-full px-2.5 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Tempat Lahir</label>
                        <input
                          type="text"
                          value={sd.tempat_lahir ?? ''}
                          onChange={(e) => updateSaksiField({ tempat_lahir: e.target.value })}
                          placeholder="Boyolali"
                          className="input-airy w-full px-2.5 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Tanggal Lahir</label>
                        <DateInputId
                          allowEmpty
                          value={sd.tanggal_lahir ?? ''}
                          onChange={(val) => updateSaksiField({ tanggal_lahir: val })}
                          placeholder="DD-MM-YYYY"
                          ariaLabel={`Tanggal lahir ${sCfg.label}`}
                          className="py-1.5 px-2.5"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Dukuh / Jalan</label>
                        <input
                          type="text"
                          value={sd.alamat_jalan ?? ''}
                          onChange={(e) => updateSaksiField({ alamat_jalan: e.target.value })}
                          placeholder="Gunungan"
                          className="input-airy w-full px-2.5 py-1.5"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">RT</label>
                          <input
                            type="text"
                            value={sd.rt ?? ''}
                            onChange={(e) => updateSaksiField({ rt: e.target.value })}
                            placeholder="005"
                            className="input-airy w-full px-2 py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">RW</label>
                          <input
                            type="text"
                            value={sd.rw ?? ''}
                            onChange={(e) => updateSaksiField({ rw: e.target.value })}
                            placeholder="008"
                            className="input-airy w-full px-2 py-1.5 font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Desa / Kelurahan</label>
                        <input
                          type="text"
                          value={sd.desa_kelurahan ?? ''}
                          onChange={(e) => updateSaksiField({ desa_kelurahan: e.target.value })}
                          placeholder="Giriroto"
                          className="input-airy w-full px-2.5 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Kecamatan</label>
                        <input
                          type="text"
                          value={sd.kecamatan ?? ''}
                          onChange={(e) => updateSaksiField({ kecamatan: e.target.value })}
                          placeholder="Ngemplak"
                          className="input-airy w-full px-2.5 py-1.5"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-3">
                        <label className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">Kabupaten / Kota</label>
                        <input
                          type="text"
                          value={sd.kabupaten ?? ''}
                          onChange={(e) => updateSaksiField({ kabupaten: e.target.value })}
                          placeholder="Kabupaten Boyolali"
                          className="input-airy w-full px-2.5 py-1.5"
                        />
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-white dark:bg-[#071A1D] border border-teal-900/12 dark:border-teal-500/25 text-[11px] text-slate-700 dark:text-teal-100/90 leading-relaxed">
                      <span className="font-bold text-slate-900 dark:text-white">Pratinjau Kalimat Akta:</span>{' '}
                      {sCfg.num}. <strong className="text-slate-900 dark:text-white">{resolved.nama}</strong>, Warga Negara Indonesia, lahir di{' '}
                      {resolved.tempat_lahir}, tanggal {formatTanggalDDMMYYYY(resolved.tanggal_lahir)}, Pekerjaan{' '}
                      {resolved.pekerjaan}, bertempat tinggal di{' '}
                      {formatPersonFullAddress(sd) !== '-' ? formatPersonFullAddress(sd) : resolved.alamat}. Pemegang Kartu Tanda Penduduk Nomor : {resolved.nik}.
                    </div>
                  </div>
                );
              })}

              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="akta-pengantar" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Nomor Surat Pengantar BPN (Lampiran F4)
                  </label>
                  <input
                    id="akta-pengantar"
                    type="text"
                    value={akta.nomor_pengantar ?? ''}
                    onChange={(e) =>
                      setAkta({ ...akta, nomor_pengantar: e.target.value })
                    }
                    placeholder="Misal: 01/XI/2026"
                    className="input-airy w-full px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="akta-catatan" className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1">
                    Catatan Loket / Kelengkapan
                  </label>
                  <input
                    id="akta-catatan"
                    type="text"
                    value={akta.catatan_loket}
                    onChange={(e) => setAkta({ ...akta, catatan_loket: e.target.value })}
                    placeholder="Misal: Sertipikat asli sudah diverifikasi."
                    className="input-airy w-full px-3 py-2"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="btn-3d btn-3d-light inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Langkah 2</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="btn-3d btn-3d-teal inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
            >
              <span>Lanjut ke Generate Bundel .DOCX</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 */}
      {step === 4 && (
        <div className="bento-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-teal-900/10 dark:border-teal-400/15 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {isAkta
                  ? 'Siap Generate Dokumen Akta (A4) & Bundel Lampiran Lengkap (F4)'
                  : `Siap Review & Unduh Bundel Non-Akta (${layanan} · Kertas F4)`}
              </h2>
              <p className="text-xs text-slate-600 dark:text-teal-200/75 mt-0.5">
                {isAkta
                  ? 'Blangko Akta utama dicetak dalam format A4 (210 × 297 mm) dan seluruh lampiran bundel BPN (Hal. 1–9) digabung utuh dalam satu file F4 (215 × 330 mm). Data otomatis disimpan ke Buku Register Akta.'
                  : 'Berkas Non-Akta hanya menerbitkan 1 file bundel Word ukuran F4 (215 × 330 mm) tanpa Akta A4 dan tidak dicatat ke dalam Laporan Bulanan PPATS.'}
              </p>
            </div>
            <div className="font-mono text-xs font-semibold text-teal-900 dark:text-teal-100 bg-teal-50 dark:bg-[#0A2226] border border-teal-900/10 dark:border-teal-500/25 px-3 py-1.5 rounded-xl shrink-0">
              {isAkta
                ? `${akta.nomor_akta || 'No. Akta Belum Diisi'} · ${layanan}`
                : `Non-Akta (F4 Only) · ${layanan}`}
            </div>
          </div>

          {/* Document Cards: 2 files for Akta PPATS, 1 file (F4) for Non-Akta */}
          <div className={`grid grid-cols-1 ${isAkta ? 'md:grid-cols-2' : ''} gap-3`}>
            {TEMPLATE_DOCS_META.filter((m) => isAkta || m.key === '02_lampiran_bundel').map((meta) => {
              const hasCustom = Boolean(customTemplates[meta.key]);
              const displayFileName = isAkta
                ? meta.fileName
                : getNonAktaBundleFileName(layanan);
              const displayDesc = isAkta
                ? meta.description
                : layanan === 'Waris C'
                  ? 'Bundel F4 Waris Letter C (15–16 Halaman): Pernyataan Ahli Warisan, Permohonan Konversi BPN, Surat Kuasa Pengakuan Hak & Pemecahan, Pernyataan Menerima Waris & BPHTB, Penguasaan Fisik & Tidak Sengketa, Pemasangan Tanda Batas, Sket Tanah, 2 Berita Acara Kesaksian, Surat Keterangan Kepala Desa (PP 24/1997), Riwayat Tanah Buku C, Pernyataan Pembagian Warisan, serta Lampiran Geotagging & Poligon.'
                  : layanan === 'Pengecekan Sertipikat'
                    ? 'Bundel F4 Pengecekan Sertipikat (3 Halaman): Permohonan ATR/BPN Poin 13, Surat Kuasa Substitusi, dan Pernyataan Keabsahan & Kebenaran Dokumen Online.'
                    : layanan === 'Validasi Sertipikat'
                      ? 'Bundel F4 Validasi Sertipikat (4 Halaman): Permohonan ATR/BPN Poin 14 (Validasi/Verifikasi), Surat Kuasa, serta Lampiran Geotagging (Tampak Depan, Patok 1–4, dan Poligon).'
                      : layanan === 'Analisis Bidang'
                        ? 'Bundel F4 Analisis Bidang (7–8 Halaman): Permohonan Peta Analisis Penatagunaan Tanah (RTRW/RDTR, LSD & LP2B), Surat Kuasa, Sket Rencana Pemecahan, Surat Pernyataan Alasan Pemecahan (8 Poin), opsional Pelepasan Jalan, Pernyataan Keabsahan Lokasi, serta Lampiran Geotagging & Koordinat Poligon.'
                        : layanan === 'Permohonan PKKPR'
                          ? 'Bundel F4 Permohonan PKKPR DPMPTSP (2–3 Halaman): Surat Permohonan PKKPR kepada Bupati Cq. Kepala DPMPTSP beserta Surat Kuasa Pengurusan.'
                          : `Bundel lengkap berkas Non-Akta ${layanan} dalam 1 file F4 dengan format pengesahan sesuai jenis dokumen.`;
              const paperInfo =
                meta.paperSize === 'A4'
                  ? 'Kertas A4 (210 × 297 mm)'
                  : 'Kertas F4 (215 × 330 mm)';
              return (
                <div
                  key={meta.key}
                  className="p-4 rounded-2xl border border-teal-900/12 dark:border-teal-500/20 bg-[#F6FBFA]/70 dark:bg-[#0A2226] flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {displayFileName}{' '}
                        <span className="font-sans font-semibold text-sky-700 dark:text-sky-300">
                          · {paperInfo}
                        </span>
                      </p>
                      <p className="text-xs text-slate-600 dark:text-teal-200/75 mt-1">{displayDesc}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold shrink-0 ${
                        hasCustom ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-teal-300/70'
                      }`}
                    >
                      {hasCustom ? 'Template Kustom' : 'Template Bawaan'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReviewDocKey(
                          isAkta && meta.key === '01_akta' ? '01_akta' : '02_lampiran_bundel'
                        );
                        setShowReview(true);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                        showReview && (reviewDocKey === meta.key || !isAkta)
                          ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
                          : 'border-teal-900/15 dark:border-teal-500/25 bg-white dark:bg-[#081E22] hover:bg-teal-50 dark:hover:bg-[#103036] text-slate-700 dark:text-teal-100'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review {meta.paperSize}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadSingle(meta.key)}
                      disabled={generatingBundle}
                      className="btn-3d btn-3d-light inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh {meta.paperSize} (.DOCX)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Toggle & Live Review Dokumen Sebelum Generate */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-600 dark:text-teal-200/80">
                {isAkta
                  ? 'Periksa kembali isi naskah Akta (A4) dan seluruh halaman Lampiran Bundel (F4) sebelum mengunduh file Word.'
                  : `Periksa kembali seluruh halaman bundel Non-Akta (${layanan}) ukuran F4 beserta pengesahannya sebelum mengunduh file Word.`}
              </p>
              <button
                type="button"
                onClick={() => setShowReview((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-900/15 dark:border-teal-500/25 bg-white dark:bg-[#0D2B30] hover:bg-teal-50 dark:hover:bg-[#12383F] text-xs font-semibold text-slate-700 dark:text-teal-100 whitespace-nowrap shrink-0 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showReview ? 'Sembunyikan Review' : 'Tampilkan Review Dokumen'}</span>
              </button>
            </div>

            {showReview && (
              <DocumentReviewPanel
                record={reviewRecord}
                settings={settings}
                customTemplates={customTemplates}
                activeDocKey={isAkta ? reviewDocKey : '02_lampiran_bundel'}
                onSelectDocKey={setReviewDocKey}
                onEditStep={(targetStep) => setStep(targetStep)}
              />
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-teal-900/10 dark:border-teal-400/15">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn-3d btn-3d-light inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
              <button
                type="button"
                onClick={() => onPrintReceipt(buildCurrentRecord())}
                className="btn-3d btn-3d-light inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Tanda Terima</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleSaveOnly}
                className="btn-3d btn-3d-light inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
              >
                <Save className="w-4 h-4" />
                <span>Simpan ke Register Saja</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateZipAndSave}
                disabled={generatingBundle || finishingAction !== null}
                className="btn-3d btn-3d-teal inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                {generatingBundle ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyusun File .DOCX...</span>
                  </>
                ) : (
                  <>
                    <FileArchive className="w-4 h-4 text-amber-200" />
                    <span>Generate Bundel .ZIP &amp; Simpan Register</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Panel Penyelesaian Berkas */}
          <div
            className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors ${
              bundleFinished
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700/60'
                : 'bg-[#F4FAF8] dark:bg-[#092024] border-teal-900/12 dark:border-teal-400/20'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <CheckCircle2
                className={`w-5 h-5 mt-0.5 shrink-0 ${
                  bundleFinished
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-teal-600 dark:text-teal-400'
                }`}
              />
              <div>
                <p
                  className={`text-sm font-bold ${
                    bundleFinished
                      ? 'text-emerald-900 dark:text-emerald-100'
                      : 'text-slate-800 dark:text-white'
                  }`}
                >
                  {bundleFinished
                    ? 'Semua berkas selesai dibuat dan tersimpan ke register.'
                    : 'Selesaikan Pembuatan Berkas'}
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    bundleFinished
                      ? 'text-emerald-800 dark:text-emerald-200/85'
                      : 'text-slate-600 dark:text-teal-200/75'
                  }`}
                >
                  Pilih <strong>Selesai</strong> untuk kembali ke Dashboard, atau{' '}
                  <strong>Selesai &amp; Buat Baru</strong> untuk membuka formulir berkas baru dengan data kosong.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => void handleFinishWizard('dashboard')}
                disabled={generatingBundle || finishingAction !== null}
                className="btn-3d btn-3d-emerald inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60 whitespace-nowrap"
              >
                {finishingAction === 'dashboard' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LayoutDashboard className="w-4 h-4" />
                )}
                <span>Selesai</span>
              </button>

              <button
                type="button"
                onClick={() => void handleFinishWizard('new')}
                disabled={generatingBundle || finishingAction !== null}
                className="btn-3d btn-3d-sky inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60 whitespace-nowrap"
              >
                {finishingAction === 'new' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FilePlus2 className="w-4 h-4" />
                )}
                <span>Selesai &amp; Buat Baru</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
