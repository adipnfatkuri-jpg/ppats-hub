import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileCheck2,
  FileText,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  ScanLine,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  BerkasRecord,
  ExtractionApiResponse,
  OfficeSettings,
  PersonBasicInfo,
  TaxCalculationResult,
  TaxDraftPrefill,
} from '../types/ppats';
import {
  formatNumberId,
  formatRupiah,
  terbilangRupiah,
} from '../utils/indonesianFormatter';
import {
  BphtbApproverPerson,
  BphtbDocKey,
  BphtbSubmissionFormData,
  SIPAD_BOYOLALI_URL,
  downloadBphtbBundleZip,
  downloadCombinedBphtbDocx,
  downloadSingleBphtbDocx,
  getBphtbDocumentList,
  isAjbService,
  isHibahService,
} from '../utils/bphtbSubmissionGenerator';
import { formatPersonFullAddress, resolvePersonDetail } from '../utils/bundleGenerator';
import { optimizeDocumentFile } from '../utils/imageOptimizer';
import { scanPersonFromFiles } from '../utils/personScan';
import { postScanJson } from '../utils/scanApi';
import {
  ObjectTaxScanSyncPayload,
  mergeObjectScanIntoBphtbForm,
} from '../utils/bphtbObjectScan';
import { BphtbPreviewPanel } from './BphtbPreviewPanel';
import { DateInputId } from './DateInputId';

export interface BphtbGeneratedState {
  generatedAt: string;
  fileName: string;
  docCount: number;
  includedLabels: string[];
  layanan: string;
}

export type { ObjectTaxScanSyncPayload };

interface BphtbSubmissionSectionProps {
  taxForm: TaxDraftPrefill;
  taxResult: TaxCalculationResult;
  settings: OfficeSettings;
  linkedRecord: BerkasRecord | null;
  form: BphtbSubmissionFormData;
  onChangeForm: React.Dispatch<React.SetStateAction<BphtbSubmissionFormData>>;
  onSyncTaxFromObjectScan?: (patch: ObjectTaxScanSyncPayload) => void;
  onResetFromSource: () => void;
  generatedState: BphtbGeneratedState | null;
  onGenerated: (state: BphtbGeneratedState) => void;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const HIBAH_RELATION_OPTIONS = [
  'Anak Kandungnya',
  'Istrinya',
  'Suaminya',
  'Orang Tua Kandungnya',
  'Cucunya',
  'Saudara Kandungnya',
];

const APPROVER_RELATION_PRESETS = [
  'ISTRI',
  'SUAMI',
  'ANAK KANDUNG',
  'SAUDARA KANDUNG',
  'ORANG TUA',
  'AHLI WARIS',
];

const JENIS_TANAH_PRESETS = ['pekarangan', 'sawah', 'tegal', 'tanah dan bangunan'];

const DOC_FILE_ACCEPT =
  'image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,application/pdf';

function buildTtlFromPerson(p: PersonBasicInfo): string {
  return [p.tempat_lahir?.trim(), p.tanggal_lahir?.trim()].filter(Boolean).join(', ');
}

function buildAddressFromPerson(p: PersonBasicInfo): string {
  const formatted = formatPersonFullAddress(p);
  return formatted !== '-' ? formatted : '';
}

function buildShortStreetRtRwFromPerson(p: PersonBasicInfo): string {
  const street = (p.alamat_jalan || '').trim();
  const rt = (p.rt || '').trim();
  const rw = (p.rw || '').trim();
  const rtRw = rt && rw ? `RT ${rt} / RW ${rw}` : rt ? `RT ${rt}` : rw ? `RW ${rw}` : '';
  const combined = [street, rtRw].filter(Boolean).join(' ').trim();
  return combined || buildAddressFromPerson(p);
}

function cleanRegionPrefix(val?: string, kind?: 'kec' | 'kab'): string {
  const raw = (val || '').trim();
  if (!raw) return '';
  if (kind === 'kec') return raw.replace(/^(Kecamatan|Kec\.?)\s+/i, '').trim();
  if (kind === 'kab') return raw.replace(/^(Kabupaten|Kab\.?|Kota)\s+/i, '').trim();
  return raw;
}

interface InlineScanControlsProps {
  slotKey: string;
  label: string;
  buttonText?: string;
  multiple?: boolean;
  scanningSlot: string | null;
  compact?: boolean;
  onPickFiles: (files: File[]) => void;
}

/**
 * Menggunakan native <label> yang membungkus <input type="file" className="sr-only" />
 * dan menyalin Array.from(e.target.files) SEBELUM reset e.target.value = '',
 * sehingga stabil di desktop, mobile, maupun iframe (termasuk pada daftar dinamis Pihak Menyetujui & Saksi).
 */
const InlineScanControls: React.FC<InlineScanControlsProps> = ({
  slotKey,
  label,
  buttonText = 'Scan KTP',
  multiple = false,
  scanningSlot,
  compact = false,
  onPickFiles,
}) => {
  const isScanning = scanningSlot === slotKey;
  const anyScanning = scanningSlot !== null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (picked.length > 0) {
      onPickFiles(picked);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      <label
        title={`Scan ${label} dari galeri atau file PDF`}
        className={`relative inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 font-semibold transition-colors whitespace-nowrap select-none ${
          anyScanning ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
        } ${compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[11px]'}`}
      >
        <input
          type="file"
          accept={DOC_FILE_ACCEPT}
          multiple={multiple}
          disabled={anyScanning}
          onChange={handleInputChange}
          className="sr-only"
        />
        {isScanning ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ScanLine className="w-3.5 h-3.5" />
        )}
        <span>{isScanning ? 'Memindai...' : buttonText}</span>
      </label>

      <label
        title={`Foto ${label} langsung dengan kamera`}
        aria-label={`Foto ${label} dengan kamera`}
        className={`relative inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors whitespace-nowrap select-none ${
          anyScanning ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
        } ${compact ? 'px-2 py-1 text-[11px]' : 'px-2 py-1.5 text-[11px]'}`}
      >
        <input
          type="file"
          accept="image/*"
          capture="environment"
          disabled={anyScanning}
          onChange={handleInputChange}
          className="sr-only"
        />
        <Camera className="w-3.5 h-3.5" />
        {!compact && <span className="hidden sm:inline">Kamera</span>}
      </label>
    </div>
  );
};

export const BphtbSubmissionSection: React.FC<BphtbSubmissionSectionProps> = ({
  taxForm,
  taxResult,
  settings,
  linkedRecord,
  form,
  onChangeForm,
  onSyncTaxFromObjectScan,
  onResetFromSource,
  generatedState,
  onGenerated,
  onClose,
  onNotify,
}) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [scanningSlot, setScanningSlot] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'form' | 'preview'>('form');
  const [previewDocKey, setPreviewDocKey] = useState<BphtbDocKey>('sppd');

  const isAjb = isAjbService(taxForm.layanan);
  const isHibah = isHibahService(taxForm.layanan);
  const docList = useMemo(
    () => getBphtbDocumentList(taxForm.layanan),
    [taxForm.layanan]
  );

  const kuasaOptions = useMemo(() => {
    const names = new Set<string>();
    (settings.profil_kuasa ?? []).forEach((p) => {
      if (p.nama?.trim()) names.add(p.nama.trim());
    });
    (settings.daftar_kuasa_bpn ?? []).forEach((n) => {
      if (n?.trim()) names.add(n.trim());
    });
    return Array.from(names);
  }, [settings]);

  const saksiOptions = useMemo(() => {
    const names = new Set<string>();
    (settings.profil_saksi ?? []).forEach((p) => {
      if (p.nama?.trim()) names.add(p.nama.trim());
    });
    (settings.daftar_saksi ?? []).forEach((n) => {
      if (n?.trim()) names.add(n.trim());
    });
    return Array.from(names);
  }, [settings]);

  const handleSelectKuasaPreset = (selectedName: string) => {
    if (!selectedName) return;
    const detail = resolvePersonDetail(selectedName, settings.profil_kuasa);
    onChangeForm((prev) => ({
      ...prev,
      kuasa_nama: detail.nama !== '-' ? detail.nama : selectedName,
      kuasa_nik: detail.nik !== '-' ? detail.nik : prev.kuasa_nik,
      kuasa_ttl: detail.ttl !== '-' ? detail.ttl : prev.kuasa_ttl,
      kuasa_pekerjaan: detail.pekerjaan !== '-' ? detail.pekerjaan : prev.kuasa_pekerjaan,
      kuasa_alamat: detail.alamat !== '-' ? detail.alamat : prev.kuasa_alamat,
    }));
  };

  const runKtpScan = async (
    slotKey: string,
    roleLabel: string,
    files: File[],
    onResult: (person: PersonBasicInfo) => void
  ) => {
    if (!files || files.length === 0) return;
    const startedAt = Date.now();
    setScanningSlot(slotKey);
    setScanNotice({
      type: 'info',
      message: `Sedang memindai KTP ${roleLabel}...`,
    });
    try {
      const res = await scanPersonFromFiles(files, roleLabel);
      onResult(res.person);
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      const msg = `Scan KTP ${roleLabel} selesai (${elapsedSec} dtk)${res.person.nama ? ` · ${res.person.nama}` : ''}. Periksa kembali hasil isian.`;
      setScanNotice({ type: 'success', message: msg });
      onNotify(msg, 'success');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : `Gagal memindai KTP ${roleLabel}.`;
      setScanNotice({ type: 'error', message: msg });
      onNotify(msg, 'error');
    } finally {
      setScanningSlot(null);
    }
  };

  const runObjectDocScan = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const startedAt = Date.now();
    setScanningSlot('objek_pajak');
    setScanNotice({
      type: 'info',
      message: `Sedang memindai ${files.length} dokumen Objek Pajak (SPPT PBB / Sertipikat)...`,
    });
    try {
      const optimized = await Promise.all(
        files.map(async (f) => {
          const payload = await optimizeDocumentFile(f, {
            maxEdge: 1120,
            quality: 0.75,
            skipBelowBytes: 90 * 1024,
          });
          return {
            name: f.name,
            mimeType: payload.mimeType,
            dataBase64: payload.dataBase64,
          };
        })
      );

      const data = await postScanJson<ExtractionApiResponse>(
        '/api/extract-documents',
        {
          layanan: taxForm.layanan,
          scanMode: 'fast',
          scope: 'object_only',
          files: optimized,
        }
      );

      let mergedTaxPatch: ObjectTaxScanSyncPayload = {};
      let mergedSummaryParts: string[] = [];

      onChangeForm((prev) => {
        const merged = mergeObjectScanIntoBphtbForm(prev, data);
        mergedTaxPatch = merged.taxPatch;
        mergedSummaryParts = merged.summaryParts;
        return merged.nextForm;
      });

      // Fallback compute summary & taxPatch synchronously in case React batches updater
      const computed = mergeObjectScanIntoBphtbForm(form, data);
      const effectiveTaxPatch =
        Object.keys(mergedTaxPatch).length > 0 ? mergedTaxPatch : computed.taxPatch;
      const effectiveSummary =
        mergedSummaryParts.length > 0 ? mergedSummaryParts : computed.summaryParts;

      if (Object.keys(effectiveTaxPatch).length > 0) {
        onSyncTaxFromObjectScan?.(effectiveTaxPatch);
      }

      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      const infoDetail = effectiveSummary.join(' · ');
      const msg = `Scan Objek Pajak selesai (${elapsedSec} dtk)${infoDetail ? ` · ${infoDetail}` : ''}. Periksa kembali hasil isian.`;
      setScanNotice({ type: 'success', message: msg });
      onNotify(msg, 'success');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal memindai dokumen Objek Pajak (SPPT PBB / Sertipikat).';
      setScanNotice({ type: 'error', message: msg });
      onNotify(msg, 'error');
    } finally {
      setScanningSlot(null);
    }
  };

  const handleAddApprover = () => {
    const newItem: BphtbApproverPerson = {
      id: `approver-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nama: '',
      nik: '',
      hubungan: form.pihak_menyetujui.length === 0 ? 'ISTRI' : 'ANAK KANDUNG',
    };
    onChangeForm((prev) => ({
      ...prev,
      pihak_menyetujui: [...(prev.pihak_menyetujui ?? []), newItem],
    }));
  };

  const handleUpdateApprover = (
    id: string,
    patch: Partial<BphtbApproverPerson>
  ) => {
    onChangeForm((prev) => ({
      ...prev,
      pihak_menyetujui: (prev.pihak_menyetujui ?? []).map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));
  };

  const handleRemoveApprover = (id: string) => {
    onChangeForm((prev) => ({
      ...prev,
      pihak_menyetujui: (prev.pihak_menyetujui ?? []).filter((item) => item.id !== id),
    }));
  };

  const handleOpenPreview = (docKey?: BphtbDocKey) => {
    if (docKey) {
      setPreviewDocKey(docKey);
    } else if (!docList.some((d) => d.key === previewDocKey)) {
      setPreviewDocKey(docList[0].key);
    }
    setViewMode('preview');
  };

  const validateRequiredFields = (): boolean => {
    if (!form.wp_nama.trim()) {
      onNotify(
        'Isi Nama Lengkap Wajib Pajak (Penerima Hak / Pembeli) terlebih dahulu sebelum membuat berkas BPHTB.',
        'error'
      );
      return false;
    }
    if (isHibah && !form.pemberi_nama.trim()) {
      onNotify(
        'Untuk proses Akta Hibah, isi Nama Pemberi Hibah terlebih dahulu agar Surat Pernyataan Hibah terisi lengkap.',
        'error'
      );
      return false;
    }
    return true;
  };

  const handleDownloadZip = async () => {
    if (!validateRequiredFields()) return;
    setBusyKey('zip');
    try {
      const res = await downloadBphtbBundleZip({
        taxForm,
        taxResult,
        form,
        settings,
      });
      onGenerated({
        generatedAt: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        fileName: res.zipFileName,
        docCount: res.fileCount,
        includedLabels: docList.map((d) => d.shortLabel),
        layanan: taxForm.layanan,
      });
      onNotify(
        `Berkas Pengajuan BPHTB (${res.fileCount} dokumen) berhasil dibuat: ${res.zipFileName}. Silakan klik "Ajukan Sekarang" untuk membuka SIPAD Boyolali.`,
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal membuat bundel ZIP pengajuan BPHTB.',
        'error'
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleDownloadCombinedDocx = async () => {
    if (!validateRequiredFields()) return;
    setBusyKey('combined');
    try {
      const res = await downloadCombinedBphtbDocx({
        taxForm,
        taxResult,
        form,
        settings,
      });
      onGenerated({
        generatedAt: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        fileName: res.fileName,
        docCount: res.includedDocs.length,
        includedLabels: res.includedDocs.map((d) => d.shortLabel),
        layanan: taxForm.layanan,
      });
      onNotify(
        `Bundel Word Pengajuan BPHTB berhasil dibuat: ${res.fileName}. Anda dapat langsung mengajukan di SIPAD Boyolali.`,
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal membuat file Word gabungan BPHTB.',
        'error'
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleDownloadSingle = async (docKey: BphtbDocKey, label: string) => {
    if (!validateRequiredFields()) return;
    setBusyKey(docKey);
    try {
      const res = await downloadSingleBphtbDocx(docKey, {
        taxForm,
        taxResult,
        form,
        settings,
      });
      onGenerated({
        generatedAt: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        fileName: res.fileName,
        docCount: docList.length,
        includedLabels: docList.map((d) => d.shortLabel),
        layanan: taxForm.layanan,
      });
      onNotify(`${label} berhasil diunduh (${res.fileName}).`, 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : `Gagal membuat dokumen ${label}.`,
        'error'
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section
      id="bphtb-submission-panel"
      className="no-print bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
    >
      {/* Header */}
      <div className="px-5 py-4 bg-slate-900 text-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shrink-0 mt-0.5">
            <Landmark className="w-4.5 h-4.5 text-sky-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-semibold text-white">
                Pengajuan Pajak BPHTB (SIPAD Boyolali)
              </h2>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/10 text-sky-200 border border-white/15">
                {taxForm.layanan} · {docList.length} Formulir Resmi
              </span>
              {linkedRecord && (
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  Terisi dari {linkedRecord.kode_berkas}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Format resmi Lampiran V SSPD, Surat Kuasa, SPJM
              {isAjb ? ', dan Bukti Transaksi (Jual Beli)' : ''}
              {isHibah ? ', dan Surat Pernyataan Hibah' : ''} — lengkap dengan Scan KTP, Scan SPPT/Sertipikat, dan Review F4.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Switcher Formulir vs Review */}
          <div
            role="tablist"
            aria-label="Mode tampilan pengajuan BPHTB"
            className="inline-flex items-center p-0.5 rounded-lg bg-white/10 border border-white/15"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'form'}
              onClick={() => setViewMode('form')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                viewMode === 'form'
                  ? 'bg-white text-slate-900'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              Isi Formulir
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'preview'}
              onClick={() => handleOpenPreview()}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                viewMode === 'preview'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Review Berkas</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onResetFromSource}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-200 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Muat Ulang</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel pengajuan BPHTB"
            className="p-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Live Tax Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50">
            <p className="text-[11px] text-slate-500">Luas &amp; NJOP Total</p>
            <p className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
              {formatNumberId(taxForm.luas_m2)} m² · {formatRupiah(taxResult.njop_total)}
            </p>
          </div>
          <div className="px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50">
            <p className="text-[11px] text-slate-500">Nilai Transaksi / NPOP</p>
            <p className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
              {formatRupiah(taxResult.npop)}
            </p>
          </div>
          <div className="px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50">
            <p className="text-[11px] text-slate-500">NPOPTKP / NPOPKP</p>
            <p className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
              {formatRupiah(taxResult.npoptkp)} / {formatRupiah(taxResult.npopkp)}
            </p>
          </div>
          <div className="px-3.5 py-2.5 rounded-lg border border-sky-200 bg-sky-50">
            <p className="text-[11px] font-medium text-sky-800">BPHTB Diajukan (5%)</p>
            <p className="font-mono font-bold text-sky-950 mt-0.5 tabular-nums">
              {formatRupiah(taxResult.bphtb)}
            </p>
            <p className="text-[10px] text-sky-700 italic truncate" title={terbilangRupiah(taxResult.bphtb)}>
              {terbilangRupiah(taxResult.bphtb)}
            </p>
          </div>
        </div>

        {/* Inline Scan Feedback Banner (terlihat langsung saat pengguna mengisi formulir) */}
        {scanNotice && (
          <div
            role={scanNotice.type === 'error' ? 'alert' : 'status'}
            className={`px-3.5 py-2.5 rounded-lg border text-xs flex items-center justify-between gap-2.5 ${
              scanNotice.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : scanNotice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-sky-200 bg-sky-50 text-sky-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {scanNotice.type === 'info' ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : scanNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{scanNotice.message}</span>
            </div>
            {scanNotice.type !== 'info' && (
              <button
                type="button"
                onClick={() => setScanNotice(null)}
                aria-label="Tutup pemberitahuan scan"
                className="p-1 rounded hover:bg-black/5 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {viewMode === 'preview' ? (
          <BphtbPreviewPanel
            taxForm={taxForm}
            taxResult={taxResult}
            form={form}
            settings={settings}
            activeDocKey={previewDocKey}
            onSelectDocKey={setPreviewDocKey}
            onDownloadSingle={handleDownloadSingle}
            onBackToForm={() => setViewMode('form')}
            busyKey={busyKey}
          />
        ) : (
          <>
            {/* Document Manifest Strip with Quick Review & Download */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800">
                  Kelengkapan Berkas BPHTB (Sesuai Template Resmi Boyolali · Kertas F4):
                </p>
                {isHibah ? (
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                    Proses Hibah Aktif · Surat Pernyataan Hibah Disertakan
                  </span>
                ) : isAjb ? (
                  <span className="text-[11px] font-semibold text-amber-900 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-md">
                    Proses AJB (Jual Beli) Aktif · Bukti Transaksi Disertakan
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    Pilih layanan &ldquo;AJB&rdquo; untuk menyertakan Bukti Transaksi atau &ldquo;Akta Hibah&rdquo; untuk Surat Pernyataan Hibah
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {docList.map((doc, idx) => (
                  <div
                    key={doc.key}
                    className={`p-3 rounded-lg border bg-white flex flex-col justify-between gap-2.5 ${
                      doc.key === 'surat_pernyataan_hibah'
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : doc.key === 'bukti_transaksi'
                        ? 'border-amber-200 bg-amber-50/40'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          0{idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-900">
                          {doc.shortLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {doc.description}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(doc.key)}
                        className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-sky-200 bg-sky-50 hover:bg-sky-100 text-[11px] font-semibold text-sky-900"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Review</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() => handleDownloadSingle(doc.key, doc.label)}
                        className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 disabled:opacity-50"
                      >
                        {busyKey === doc.key ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        <span>.DOCX</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Form Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
              {/* 1. Wajib Pajak (Penerima Hak) */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    1. Wajib Pajak ({isHibah ? 'Penerima Hibah' : 'Pembeli / Penerima Hak'})
                  </h3>
                  <InlineScanControls
                    slotKey="wp"
                    label="KTP Wajib Pajak"
                    scanningSlot={scanningSlot}
                    onPickFiles={(files) =>
                      runKtpScan('wp', 'Wajib Pajak (Penerima Hak)', files, (person) => {
                        onChangeForm((prev) => ({
                          ...prev,
                          wp_nama: person.nama || prev.wp_nama,
                          wp_nik: person.nik || prev.wp_nik,
                          wp_ttl: buildTtlFromPerson(person) || prev.wp_ttl,
                          wp_pekerjaan: person.pekerjaan || prev.wp_pekerjaan,
                          wp_alamat: buildShortStreetRtRwFromPerson(person) || prev.wp_alamat,
                          wp_desa: person.desa_kelurahan || prev.wp_desa,
                          wp_kecamatan:
                            cleanRegionPrefix(person.kecamatan, 'kec') || prev.wp_kecamatan,
                          wp_kabupaten:
                            cleanRegionPrefix(person.kabupaten, 'kab') || prev.wp_kabupaten,
                        }));
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">
                      Nama Lengkap Wajib Pajak <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.wp_nama}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, wp_nama: e.target.value }))
                      }
                      placeholder="Nama lengkap sesuai KTP"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">NIK (16 Digit)</label>
                    <input
                      type="text"
                      value={form.wp_nik}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, wp_nik: e.target.value }))
                      }
                      placeholder="3309..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">NPWP (Opsional)</label>
                    <input
                      type="text"
                      value={form.wp_npwp}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, wp_npwp: e.target.value }))
                      }
                      placeholder="Opsional"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Tempat, Tanggal Lahir</label>
                    <input
                      type="text"
                      value={form.wp_ttl}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, wp_ttl: e.target.value }))
                      }
                      placeholder="Boyolali, 18-11-1984"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Pekerjaan</label>
                    <input
                      type="text"
                      value={form.wp_pekerjaan}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, wp_pekerjaan: e.target.value }))
                      }
                      placeholder="Guru / Wiraswasta / Karyawan"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">No. Telepon / HP</label>
                    <input
                      type="text"
                      value={form.wp_telepon}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, wp_telepon: e.target.value }))
                      }
                      placeholder="08..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Tanggal Pengajuan</label>
                    <DateInputId
                      value={form.tanggal_pengajuan}
                      onChange={(next) =>
                        onChangeForm((prev) => ({ ...prev, tanggal_pengajuan: next }))
                      }
                      allowEmpty={false}
                      ariaLabel="Tanggal pengajuan BPHTB"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">
                      Alamat (Dukuh/Jalan &amp; RT/RW)
                    </label>
                    <input
                      type="text"
                      value={form.wp_alamat}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, wp_alamat: e.target.value }))
                      }
                      placeholder="Contoh: NGESREP RT 004 / RW 001"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Desa / Kelurahan</label>
                    <input
                      type="text"
                      value={form.wp_desa}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, wp_desa: e.target.value }))
                      }
                      placeholder="Ngesrep"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Kecamatan</label>
                    <input
                      type="text"
                      value={form.wp_kecamatan}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, wp_kecamatan: e.target.value }))
                      }
                      placeholder="Ngemplak"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">Kabupaten / Kota</label>
                    <input
                      type="text"
                      value={form.wp_kabupaten}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, wp_kabupaten: e.target.value }))
                      }
                      placeholder="Boyolali"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Pihak Pengalih Hak (Penjual / Pemberi Hibah / Pewaris) */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    2. Pengalih Hak ({isHibah ? 'Pemberi Hibah' : 'Penjual / Atas Nama Sertipikat'})
                  </h3>
                  <InlineScanControls
                    slotKey="pemberi"
                    label={isHibah ? 'KTP Pemberi Hibah' : 'KTP Penjual / Pengalih'}
                    scanningSlot={scanningSlot}
                    onPickFiles={(files) =>
                      runKtpScan(
                        'pemberi',
                        isHibah ? 'Pemberi Hibah' : 'Pihak Pengalih Hak',
                        files,
                        (person) => {
                          onChangeForm((prev) => ({
                            ...prev,
                            pemberi_nama: person.nama || prev.pemberi_nama,
                            pemberi_nik: person.nik || prev.pemberi_nik,
                            pemberi_ttl: buildTtlFromPerson(person) || prev.pemberi_ttl,
                            pemberi_pekerjaan: person.pekerjaan || prev.pemberi_pekerjaan,
                            pemberi_alamat: buildAddressFromPerson(person) || prev.pemberi_alamat,
                          }));
                        }
                      )
                    }
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">
                      Nama Lengkap {isHibah ? 'Pemberi Hibah' : 'Pemilik Semula (Atas Nama)'}{' '}
                      {isHibah && <span className="text-rose-600">*</span>}
                    </label>
                    <input
                      type="text"
                      value={form.pemberi_nama}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, pemberi_nama: e.target.value }))
                      }
                      placeholder="Nama lengkap pemilik sertipikat semula"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">NIK</label>
                    <input
                      type="text"
                      value={form.pemberi_nik}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, pemberi_nik: e.target.value }))
                      }
                      placeholder="3309..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Tempat, Tanggal Lahir</label>
                    <input
                      type="text"
                      value={form.pemberi_ttl}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, pemberi_ttl: e.target.value }))
                      }
                      placeholder="Boyolali, 10-06-1956"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">Pekerjaan</label>
                    <input
                      type="text"
                      value={form.pemberi_pekerjaan}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, pemberi_pekerjaan: e.target.value }))
                      }
                      placeholder="Buruh Tani / Perkebunan / Wiraswasta"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">Alamat Lengkap</label>
                    <textarea
                      rows={3}
                      value={form.pemberi_alamat}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, pemberi_alamat: e.target.value }))
                      }
                      placeholder="Gagaksipat Rt. 01 Rw. 04, Ds. Gagaksipat, Kecamatan Ngemplak, Kabupaten Boyolali"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Data Objek Pajak & Sertipikat (DENGAN SCAN SPPT/SERTIPIKAT) */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      3. Data Objek Pajak (SPPT PBB &amp; Sertipikat)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Bisa pilih 1–2 file sekaligus (foto/PDF SPPT PBB &amp; Sertipikat) — otomatis menyinkronkan luas &amp; NJOP kalkulator.
                    </p>
                  </div>
                  <InlineScanControls
                    slotKey="objek_pajak"
                    label="SPPT PBB / Sertipikat"
                    buttonText="Scan SPPT / Sertipikat"
                    multiple
                    scanningSlot={scanningSlot}
                    onPickFiles={runObjectDocScan}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">NOP PBB (18 Digit)</label>
                    <input
                      type="text"
                      value={form.nop}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, nop: e.target.value }))
                      }
                      placeholder="33.09.110.004.005.0244.0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Tahun Pajak SPPT</label>
                    <input
                      type="text"
                      value={form.tahun_pajak}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, tahun_pajak: e.target.value }))
                      }
                      placeholder="2025"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Jenis Hak</label>
                    <input
                      type="text"
                      value={form.jenis_hak}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, jenis_hak: e.target.value }))
                      }
                      placeholder="Hak Milik / SHM"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Nomor Sertipikat / NIBel</label>
                    <input
                      type="text"
                      value={form.nomor_sertipikat}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, nomor_sertipikat: e.target.value }))
                      }
                      placeholder="Elektronik Nib: 11.17.000023174.0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Lokasi / Dukuh Objek</label>
                    <input
                      type="text"
                      value={form.letaknya_jalan}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, letaknya_jalan: e.target.value }))
                      }
                      placeholder="Gagaksipat"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">RT / RW Objek Pajak</label>
                    <input
                      type="text"
                      value={form.objek_rt_rw}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, objek_rt_rw: e.target.value }))
                      }
                      placeholder="004/01"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Desa / Kelurahan</label>
                    <input
                      type="text"
                      value={form.desa}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, desa: e.target.value }))
                      }
                      placeholder="Gagaksipat"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Kecamatan</label>
                    <input
                      type="text"
                      value={form.kecamatan}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, kecamatan: e.target.value }))
                      }
                      placeholder="Ngemplak"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Kabupaten / Kota</label>
                    <input
                      type="text"
                      value={form.kabupaten}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, kabupaten: e.target.value }))
                      }
                      placeholder="Boyolali"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Jenis Tanah</label>
                    <input
                      list="bphtb-jenis-tanah-list"
                      type="text"
                      value={form.jenis_tanah}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, jenis_tanah: e.target.value }))
                      }
                      placeholder="pekarangan / sawah / tegal"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <datalist id="bphtb-jenis-tanah-list">
                      {JENIS_TANAH_PRESETS.map((j) => (
                        <option key={j} value={j} />
                      ))}
                    </datalist>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">
                      Luas Bangunan (m² · untuk SPJM, isi 0 jika tanah kosong)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.luas_bangunan_m2}
                      onChange={(e) =>
                        onChangeForm((prev) => ({
                          ...prev,
                          luas_bangunan_m2: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Penerima Kuasa Pengurusan BPHTB */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <h3 className="font-display text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-slate-700" />
                    <span>4. Penerima Kuasa BPHTB (Pihak Kedua)</span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {kuasaOptions.length > 0 && (
                      <select
                        aria-label="Pilih profil kuasa dari pengaturan"
                        value=""
                        onChange={(e) => handleSelectKuasaPreset(e.target.value)}
                        className="px-2 py-1 border border-slate-200 rounded-md bg-slate-50 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="">Profil Pengaturan...</option>
                        {kuasaOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    )}
                    <InlineScanControls
                      slotKey="kuasa"
                      label="KTP Penerima Kuasa"
                      scanningSlot={scanningSlot}
                      onPickFiles={(files) =>
                        runKtpScan('kuasa', 'Penerima Kuasa BPHTB', files, (person) => {
                          onChangeForm((prev) => ({
                            ...prev,
                            kuasa_nama: person.nama || prev.kuasa_nama,
                            kuasa_nik: person.nik || prev.kuasa_nik,
                            kuasa_ttl: buildTtlFromPerson(person) || prev.kuasa_ttl,
                            kuasa_pekerjaan: person.pekerjaan || prev.kuasa_pekerjaan,
                            kuasa_alamat: buildAddressFromPerson(person) || prev.kuasa_alamat,
                          }));
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">Nama Penerima Kuasa</label>
                    <input
                      type="text"
                      value={form.kuasa_nama}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, kuasa_nama: e.target.value }))
                      }
                      placeholder="Nama staf / kuasa pengurusan SIPAD"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Nomor KTP / NIK</label>
                    <input
                      type="text"
                      value={form.kuasa_nik}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, kuasa_nik: e.target.value }))
                      }
                      placeholder="3309..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Tempat, Tanggal Lahir</label>
                    <input
                      type="text"
                      value={form.kuasa_ttl}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, kuasa_ttl: e.target.value }))
                      }
                      placeholder="Boyolali, 24-11-1991"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Pekerjaan</label>
                    <input
                      type="text"
                      value={form.kuasa_pekerjaan}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, kuasa_pekerjaan: e.target.value }))
                      }
                      placeholder="Wiraswasta / Staf PPATS"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">No. HP Penerima Kuasa</label>
                    <input
                      type="text"
                      value={form.kuasa_telepon}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, kuasa_telepon: e.target.value }))
                      }
                      placeholder="08..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-medium mb-1">Alamat Lengkap Penerima Kuasa</label>
                    <textarea
                      rows={2}
                      value={form.kuasa_alamat}
                      onChange={(e) =>
                        onChangeForm((prev) => ({ ...prev, kuasa_alamat: e.target.value }))
                      }
                      placeholder="Dukuhrejo RT 001 / RW 002, Desa Donohudan, Kec Ngemplak, Kabupaten Boyolali"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Khusus Surat Pernyataan Hibah (conditional) */}
              {isHibah && (
                <div className="lg:col-span-2 border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-2">
                    <h3 className="font-display text-sm font-semibold text-emerald-950">
                      5. Keterangan Khusus Surat Pernyataan Hibah
                    </h3>
                    <span className="text-[11px] font-medium text-emerald-800">
                      Penguatan otomatis oleh Camat {form.kecamatan || settings.nama_kecamatan} ({settings.nama_ppats || 'Pengaturan Kantor'})
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-emerald-900 font-medium mb-1">
                        Penerima Hibah Adalah (Dicetak Tebal di Surat Pernyataan Hibah)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          aria-label="Pilih hubungan penerima hibah"
                          value={
                            HIBAH_RELATION_OPTIONS.includes(form.hubungan_hibah)
                              ? form.hubungan_hibah
                              : 'custom'
                          }
                          onChange={(e) => {
                            if (e.target.value !== 'custom') {
                              onChangeForm((prev) => ({
                                ...prev,
                                hubungan_hibah: e.target.value,
                              }));
                            }
                          }}
                          className="w-full px-3 py-2 border border-emerald-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {HIBAH_RELATION_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                          <option value="custom">Ketik hubungan khusus...</option>
                        </select>
                        <input
                          type="text"
                          value={form.hubungan_hibah}
                          onChange={(e) =>
                            onChangeForm((prev) => ({
                              ...prev,
                              hubungan_hibah: e.target.value,
                            }))
                          }
                          placeholder="Contoh: Anak Kandungnya"
                          className="w-full px-3 py-2 border border-emerald-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Daftar Pihak Menyetujui (bisa lebih dari 1, dikelompokkan otomatis seperti ISTRI / ANAK KANDUNG) */}
                    <div className="rounded-lg border border-emerald-200 bg-white p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-700" />
                          <div>
                            <p className="text-xs font-semibold text-emerald-950">
                              Pihak Menyetujui ({form.pihak_menyetujui.length})
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Otomatis dikelompokkan per hubungan (contoh: ISTRI:, ANAK KANDUNG:) dengan garis titik tanda tangan.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddApprover}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah Pihak Menyetujui</span>
                        </button>
                      </div>

                      {form.pihak_menyetujui.length === 0 ? (
                        <div className="px-3 py-3 rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 text-[11px] text-emerald-900">
                          Belum ada pihak menyetujui ditambahkan. Klik <strong>&ldquo;Tambah Pihak Menyetujui&rdquo;</strong> untuk menambahkan Istri/Suami dan Anak-Anak Kandung.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {form.pihak_menyetujui.map((approver, idx) => {
                            const approverId = approver.id;
                            return (
                              <div
                                key={approverId}
                                className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2.5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-mono text-[11px] font-semibold text-emerald-900 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded">
                                    Pihak Menyetujui #{idx + 1}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <InlineScanControls
                                      slotKey={`approver-${approverId}`}
                                      label={`KTP Pihak Menyetujui #${idx + 1}`}
                                      scanningSlot={scanningSlot}
                                      compact
                                      onPickFiles={(files) =>
                                        runKtpScan(
                                          `approver-${approverId}`,
                                          `Pihak Menyetujui #${idx + 1}`,
                                          files,
                                          (person) => {
                                            onChangeForm((prev) => ({
                                              ...prev,
                                              pihak_menyetujui: (prev.pihak_menyetujui ?? []).map(
                                                (item) =>
                                                  item.id === approverId
                                                    ? {
                                                        ...item,
                                                        nama: person.nama || item.nama,
                                                        nik: person.nik || item.nik,
                                                      }
                                                    : item
                                              ),
                                            }));
                                          }
                                        )
                                      }
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveApprover(approverId)}
                                      title="Hapus pihak menyetujui ini"
                                      aria-label={`Hapus pihak menyetujui ${idx + 1}`}
                                      className="p-1.5 rounded-md border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                  <div>
                                    <label className="block text-slate-600 font-medium mb-1">
                                      Nama Lengkap
                                    </label>
                                    <input
                                      type="text"
                                      value={approver.nama}
                                      onChange={(e) =>
                                        handleUpdateApprover(approverId, { nama: e.target.value })
                                      }
                                      placeholder="Nama sesuai KTP"
                                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-slate-600 font-medium mb-1">
                                      NIK (Opsional)
                                    </label>
                                    <input
                                      type="text"
                                      value={approver.nik}
                                      onChange={(e) =>
                                        handleUpdateApprover(approverId, { nik: e.target.value })
                                      }
                                      placeholder="3309..."
                                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-slate-600 font-medium mb-1">
                                      Kelompok Hubungan
                                    </label>
                                    <input
                                      list="bphtb-approver-relation-list"
                                      type="text"
                                      value={approver.hubungan}
                                      onChange={(e) =>
                                        handleUpdateApprover(approverId, {
                                          hubungan: e.target.value,
                                        })
                                      }
                                      placeholder="ISTRI / ANAK KANDUNG"
                                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <datalist id="bphtb-approver-relation-list">
                            {APPROVER_RELATION_PRESETS.map((rel) => (
                              <option key={rel} value={rel} />
                            ))}
                          </datalist>
                        </div>
                      )}
                    </div>

                    {/* Saksi-Saksi (Opsional) */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-emerald-900">
                        Saksi-Saksi (Opsional — kosongkan jika mengikuti format tanpa saksi, atau isi/scan KTP bila diperlukan):
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-emerald-900 font-medium">Saksi I</label>
                            <InlineScanControls
                              slotKey="saksi1"
                              label="KTP Saksi I"
                              scanningSlot={scanningSlot}
                              compact
                              onPickFiles={(files) =>
                                runKtpScan('saksi1', 'Saksi I', files, (person) => {
                                  onChangeForm((prev) => ({
                                    ...prev,
                                    saksi_1_nama: person.nama || prev.saksi_1_nama,
                                  }));
                                })
                              }
                            />
                          </div>
                          <input
                            list="bphtb-saksi-list"
                            type="text"
                            value={form.saksi_1_nama}
                            onChange={(e) =>
                              onChangeForm((prev) => ({
                                ...prev,
                                saksi_1_nama: e.target.value,
                              }))
                            }
                            placeholder="Opsional · Nama Saksi I"
                            className="w-full px-3 py-2 border border-emerald-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-emerald-900 font-medium">Saksi II</label>
                            <InlineScanControls
                              slotKey="saksi2"
                              label="KTP Saksi II"
                              scanningSlot={scanningSlot}
                              compact
                              onPickFiles={(files) =>
                                runKtpScan('saksi2', 'Saksi II', files, (person) => {
                                  onChangeForm((prev) => ({
                                    ...prev,
                                    saksi_2_nama: person.nama || prev.saksi_2_nama,
                                  }));
                                })
                              }
                            />
                          </div>
                          <input
                            list="bphtb-saksi-list"
                            type="text"
                            value={form.saksi_2_nama}
                            onChange={(e) =>
                              onChangeForm((prev) => ({
                                ...prev,
                                saksi_2_nama: e.target.value,
                              }))
                            }
                            placeholder="Opsional · Nama Saksi II"
                            className="w-full px-3 py-2 border border-emerald-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <datalist id="bphtb-saksi-list">
                          {saksiOptions.map((s) => (
                            <option key={s} value={s} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Action Bar: Review & Generate Documents */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {viewMode === 'form' && (
              <button
                type="button"
                onClick={() => handleOpenPreview()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-900 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Eye className="w-4 h-4 text-sky-700" />
                <span>Review Berkas (Pratinjau F4)</span>
              </button>
            )}

            <button
              type="button"
              disabled={busyKey !== null || scanningSlot !== null}
              onClick={handleDownloadZip}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {busyKey === 'zip' ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <FileArchive className="w-4 h-4 text-amber-400" />
              )}
              <span>
                {busyKey === 'zip'
                  ? 'Membuat Berkas...'
                  : `Buat & Unduh Paket BPHTB (.ZIP · ${docList.length} File)`}
              </span>
            </button>

            <button
              type="button"
              disabled={busyKey !== null || scanningSlot !== null}
              onClick={handleDownloadCombinedDocx}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {busyKey === 'combined' ? (
                <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
              ) : (
                <FileText className="w-4 h-4 text-sky-600" />
              )}
              <span>Buat 1 File Word Gabungan (.DOCX)</span>
            </button>
          </div>

          {!generatedState && (
            <p className="text-[11px] text-slate-500">
              Setelah berkas selesai dibuat, tombol <strong>Ajukan Sekarang</strong> ke SIPAD Boyolali akan aktif.
            </p>
          )}
        </div>

        {/* Post-Generation Banner + Ajukan Sekarang CTA */}
        {generatedState && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-emerald-950">
                    Berkas Pengajuan BPHTB Selesai Dibuat
                  </p>
                  <span className="font-mono text-[11px] text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded">
                    {generatedState.generatedAt}
                  </span>
                </div>
                <p className="text-xs text-emerald-900">
                  File terakhir: <strong className="font-mono">{generatedState.fileName}</strong>
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {generatedState.includedLabels.map((lbl) => (
                    <span
                      key={lbl}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-900 bg-white border border-emerald-200 px-2 py-0.5 rounded-md"
                    >
                      <FileCheck2 className="w-3 h-3 text-emerald-600" />
                      {lbl}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch sm:items-end gap-1.5 shrink-0">
              <a
                href={SIPAD_BOYOLALI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
              >
                <span>Ajukan Sekarang</span>
                <ExternalLink className="w-4 h-4" />
              </a>
              <span className="text-[11px] text-emerald-800 font-mono text-center sm:text-right">
                sipad.boyolali.go.id/sipad/
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
