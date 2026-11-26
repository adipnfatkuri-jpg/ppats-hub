import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calculator,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  ExternalLink,
  FilePlus2,
  FolderCheck,
  Landmark,
  Loader2,
  Pencil,
  Printer,
  Receipt,
  RotateCcw,
  Save,
  ScanLine,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  BerkasRecord,
  ExtractionApiResponse,
  OfficeSettings,
  ServiceType,
  TaxDraftPrefill,
} from '../types/ppats';
import { SERVICE_TYPES } from '../utils/seedData';
import {
  formatNumberId,
  formatRupiah,
  formatTanggalDDMMYYYY,
  terbilangLuas,
  terbilangRupiah,
} from '../utils/indonesianFormatter';
import {
  applyTaxCalculationToRecord,
  calculateLandTaxes,
  getDefaultNpoptkp,
  summarizeTaxBreakdown,
} from '../utils/taxAndAudit';
import {
  getDefaultAphbHolderCount,
  getDefaultAphbRecipientCount,
} from '../utils/aphbHelpers';
import {
  BphtbSubmissionFormData,
  SIPAD_BOYOLALI_URL,
  buildInitialBphtbFormData,
  getBphtbDocumentList,
  isAjbService,
  isHibahService,
} from '../utils/bphtbSubmissionGenerator';
import {
  BphtbGeneratedState,
  BphtbSubmissionSection,
} from './BphtbSubmissionSection';
import { GlossyIcon3D } from './TactileUI';
import {
  SCAN_DOC_FILE_ACCEPT,
  optimizeDocumentFile,
} from '../utils/imageOptimizer';
import { postScanJson } from '../utils/scanApi';
import {
  applyObjectScanPatchToTaxDraft,
  mergeObjectScanIntoBphtbForm,
} from '../utils/bphtbObjectScan';

const TAX_SCAN_FILE_ACCEPT = SCAN_DOC_FILE_ACCEPT;

interface TaxCalculatorModuleProps {
  records: BerkasRecord[];
  settings: OfficeSettings;
  initialRecordId?: string | null;
  onSaveRecord: (record: BerkasRecord) => Promise<void>;
  onCreateBerkasWithTax: (prefill: TaxDraftPrefill) => void;
  onEditRecord: (record: BerkasRecord) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

type TaxMode = 'standalone' | 'linked';

function buildDraftFromRecord(
  record: BerkasRecord,
  settings: OfficeSettings
): TaxDraftPrefill {
  const luasBangunan = Math.max(0, Number(record.pbb?.luas_bangunan_m2) || 0);
  const njopBangunanM2 = Math.max(0, Number(record.pbb?.njop_bangunan_m2) || 0);
  const njopBangunanTotal =
    luasBangunan > 0 && njopBangunanM2 > 0
      ? Math.round(luasBangunan * njopBangunanM2)
      : Math.max(0, Number(record.pbb?.njop_bangunan) || 0);

  return {
    layanan: record.layanan,
    luas_m2: record.tanah?.luas_m2 ?? 0,
    njop_bumi_m2: record.pbb?.njop_bumi_m2 ?? 0,
    luas_bangunan_m2: luasBangunan,
    njop_bangunan_m2: njopBangunanM2,
    njop_bangunan: njopBangunanTotal,
    harga_per_m2: record.akta?.harga_per_m2 ?? 0,
    nilai_transaksi_override: record.akta?.nilai_transaksi_override ?? null,
    npoptkp:
      record.akta?.npoptkp ?? getDefaultNpoptkp(record.layanan, settings),
    aphb_jumlah_pemegang_hak:
      record.layanan === 'APHB'
        ? getDefaultAphbHolderCount(record.para_pihak || [], record.akta)
        : record.akta?.aphb_jumlah_pemegang_hak ?? 2,
    aphb_jumlah_penerima:
      record.layanan === 'APHB'
        ? getDefaultAphbRecipientCount(record.para_pihak || [], record.akta)
        : record.akta?.aphb_jumlah_penerima ?? 1,
  };
}

function buildEmptyDraft(settings: OfficeSettings): TaxDraftPrefill {
  return {
    layanan: 'AJB',
    luas_m2: 0,
    njop_bumi_m2: 0,
    luas_bangunan_m2: 0,
    njop_bangunan_m2: 0,
    njop_bangunan: 0,
    harga_per_m2: 0,
    nilai_transaksi_override: null,
    npoptkp: getDefaultNpoptkp('AJB', settings),
    aphb_jumlah_pemegang_hak: 2,
    aphb_jumlah_penerima: 1,
  };
}

export const TaxCalculatorModule: React.FC<TaxCalculatorModuleProps> = ({
  records,
  settings,
  initialRecordId,
  onSaveRecord,
  onCreateBerkasWithTax,
  onEditRecord,
  onNotify,
}) => {
  const initialRecord = useMemo(
    () =>
      initialRecordId
        ? records.find((r) => r.id === initialRecordId) ?? null
        : null,
    [initialRecordId, records]
  );

  const [mode, setMode] = useState<TaxMode>(
    initialRecord ? 'linked' : 'standalone'
  );
  const [selectedRecordId, setSelectedRecordId] = useState<string>(
    initialRecord?.id ?? records[0]?.id ?? ''
  );
  const [form, setForm] = useState<TaxDraftPrefill>(() =>
    initialRecord
      ? buildDraftFromRecord(initialRecord, settings)
      : buildEmptyDraft(settings)
  );
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBphtbPanel, setShowBphtbPanel] = useState(false);
  const [bphtbForm, setBphtbForm] = useState<BphtbSubmissionFormData>(() =>
    buildInitialBphtbFormData(settings, initialRecord)
  );
  const [bphtbGenerated, setBphtbGenerated] = useState<BphtbGeneratedState | null>(null);
  const [scanningDoc, setScanningDoc] = useState<'sppt' | 'sertipikat' | null>(null);
  const [scanNotice, setScanNotice] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (initialRecordId) {
      const target = records.find((r) => r.id === initialRecordId);
      if (target) {
        setMode('linked');
        setSelectedRecordId(target.id);
        setForm(buildDraftFromRecord(target, settings));
        setBphtbForm(buildInitialBphtbFormData(settings, target));
        setBphtbGenerated(null);
      }
    }
  }, [initialRecordId, records, settings]);

  const selectedRecord = useMemo(
    () => records.find((r) => r.id === selectedRecordId) ?? null,
    [records, selectedRecordId]
  );

  const taxResult = useMemo(
    () =>
      calculateLandTaxes({
        luas_m2: form.luas_m2,
        harga_per_m2: form.harga_per_m2,
        njop_bumi_m2: form.njop_bumi_m2,
        luas_bangunan_m2: form.luas_bangunan_m2,
        njop_bangunan_m2: form.njop_bangunan_m2,
        njop_bangunan: form.njop_bangunan,
        npoptkp: form.npoptkp,
        layanan: form.layanan,
        nilai_transaksi_override: form.nilai_transaksi_override,
        aphb_jumlah_pemegang_hak:
          form.layanan === 'APHB' ? Math.max(2, form.aphb_jumlah_pemegang_hak ?? 2) : undefined,
        aphb_jumlah_penerima:
          form.layanan === 'APHB' ? Math.max(1, form.aphb_jumlah_penerima ?? 1) : undefined,
      }),
    [form]
  );

  const taxSummary = useMemo(
    () => summarizeTaxBreakdown(taxResult),
    [taxResult]
  );

  const bphtbDocs = useMemo(
    () => getBphtbDocumentList(form.layanan),
    [form.layanan]
  );

  const handleModeChange = (nextMode: TaxMode) => {
    setMode(nextMode);
    setBphtbGenerated(null);
    if (nextMode === 'linked') {
      const target = selectedRecord ?? records[0] ?? null;
      if (target) {
        setSelectedRecordId(target.id);
        setForm(buildDraftFromRecord(target, settings));
        setBphtbForm(buildInitialBphtbFormData(settings, target));
      }
    } else {
      setBphtbForm(buildInitialBphtbFormData(settings, null));
    }
  };

  const handleSelectLinkedRecord = (recordId: string) => {
    setSelectedRecordId(recordId);
    const target = records.find((r) => r.id === recordId);
    if (target) {
      setMode('linked');
      setForm(buildDraftFromRecord(target, settings));
      setBphtbForm(buildInitialBphtbFormData(settings, target));
      setBphtbGenerated(null);
    }
  };

  const handleLoadRecordFromTable = (record: BerkasRecord) => {
    setMode('linked');
    setSelectedRecordId(record.id);
    setForm(buildDraftFromRecord(record, settings));
    setBphtbForm(buildInitialBphtbFormData(settings, record));
    setBphtbGenerated(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleServiceChange = (nextLayanan: ServiceType) => {
    setForm((prev) => ({
      ...prev,
      layanan: nextLayanan,
      npoptkp: getDefaultNpoptkp(nextLayanan, settings),
      aphb_jumlah_pemegang_hak:
        nextLayanan === 'APHB'
          ? Math.max(2, prev.aphb_jumlah_pemegang_hak ?? 2)
          : prev.aphb_jumlah_pemegang_hak,
      aphb_jumlah_penerima:
        nextLayanan === 'APHB'
          ? Math.max(1, prev.aphb_jumlah_penerima ?? 1)
          : prev.aphb_jumlah_penerima,
    }));
    setBphtbGenerated(null);
  };

  const handleResetStandalone = () => {
    setMode('standalone');
    setForm(buildEmptyDraft(settings));
    setBphtbForm(buildInitialBphtbFormData(settings, null));
    setBphtbGenerated(null);
    setScanNotice(null);
  };

  const handleTaxObjectScan = async (
    kind: 'sppt' | 'sertipikat',
    files: File[]
  ) => {
    if (!files || files.length === 0) return;
    const label = kind === 'sppt' ? 'SPPT PBB' : 'Sertipikat';
    const startedAt = Date.now();
    setScanningDoc(kind);
    setScanNotice({
      type: 'info',
      message: `Sedang memindai ${files.length} dokumen ${label}...`,
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
          layanan: form.layanan,
          scanMode: 'fast',
          scope: 'object_only',
          files: optimized,
        }
      );

      const merged = mergeObjectScanIntoBphtbForm(bphtbForm, data);
      setBphtbForm((prev) => mergeObjectScanIntoBphtbForm(prev, data).nextForm);
      setForm((prev) =>
        applyObjectScanPatchToTaxDraft(prev, merged.taxPatch, kind)
      );
      setBphtbGenerated(null);

      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      const summary = merged.summaryParts.join(' · ');
      const msg = summary
        ? `Scan ${label} selesai (${elapsedSec} dtk) · ${summary}.`
        : `Scan ${label} selesai (${elapsedSec} dtk), namun angka luas/NJOP belum terbaca jelas — periksa foto dokumen.`;
      setScanNotice({ type: 'success', message: msg });
      onNotify(msg, 'success');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : `Gagal memindai dokumen ${label}.`;
      setScanNotice({ type: 'error', message: msg });
      onNotify(msg, 'error');
    } finally {
      setScanningDoc(null);
    }
  };

  const handleToggleBphtbPanel = () => {
    setShowBphtbPanel((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => {
          document
            .getElementById('bphtb-submission-panel')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      }
      return next;
    });
  };

  const handleSaveTaxToRecord = async () => {
    if (!selectedRecord) {
      onNotify('Pilih berkas register terlebih dahulu untuk menyimpan pajak.', 'error');
      return;
    }
    setSaving(true);
    try {
      const updated = applyTaxCalculationToRecord(selectedRecord, form);
      await onSaveRecord(updated);
      onNotify(
        `Perhitungan pajak berkas ${updated.kode_berkas} berhasil diperbarui (BPHTB ${formatRupiah(updated.pajak.bphtb)}, PPh ${formatRupiah(updated.pajak.pph)}).`,
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan perhitungan pajak ke berkas.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...records]
      .sort((a, b) => b.no_urut - a.no_urut)
      .filter((r) => {
        if (!q) return true;
        const parties = r.para_pihak.map((p) => `${p.nama} ${p.nik}`).join(' ');
        const hay = [
          r.kode_berkas,
          r.akta.nomor_akta,
          r.layanan,
          r.tanah.desa,
          r.tanah.nib,
          parties,
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
  }, [records, searchQuery]);

  const todayFormatted = useMemo(
    () => formatTanggalDDMMYYYY(new Date().toISOString().slice(0, 10)),
    []
  );

  return (
    <div className="space-y-6">
      {/* Screen Header & Controls */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
        <div className="rounded-[14px] bg-[#171A21]/92 backdrop-blur-md border border-white/[0.08] border-l-[3px] border-l-[#FACC15] px-4 py-3 sm:px-5 sm:py-3.5 shadow-[0_8px_22px_rgba(0,0,0,0.42)] max-w-2xl">
          <h1 className="text-lg sm:text-[24px] font-extrabold tracking-tight text-[#FACC15] leading-snug">
            Perhitungan Pajak (BPHTB &amp; PPh Final)
          </h1>
          <p className="text-xs sm:text-sm text-[#CBD5E1] mt-0.5 font-medium">
            Jalur khusus perhitungan BPHTB (5%) dan PPh Final (2,5%), terpisah dari alur pembuatan berkas akta.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetStandalone}
            className="btn-3d btn-3d-light min-h-[40px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Reset Simulasi</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-3d btn-3d-light min-h-[40px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span>Cetak Rincian Pajak</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Bar — Responsive full-width stack on mobile, inline pill on sm+ */}
      <div className="no-print bento-card p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div
          role="tablist"
          aria-label="Mode jalur perhitungan pajak"
          className="grid grid-cols-1 sm:inline-flex items-stretch sm:items-center gap-1.5 sm:gap-1 p-1 bg-slate-100/90 dark:bg-[#0E1014]/90 rounded-2xl sm:rounded-full w-full sm:w-fit"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'standalone'}
            onClick={() => handleModeChange('standalone')}
            className={`min-h-[40px] sm:min-h-0 px-4 py-2 sm:py-1.5 rounded-xl sm:rounded-full text-xs font-bold transition-colors text-center ${
              mode === 'standalone'
                ? 'bg-[#0E1014] text-[#FACC15] shadow-xs'
                : 'text-[#475569] dark:text-slate-300 hover:text-[#0E1014] dark:hover:text-white'
            }`}
          >
            Simulasi Mandiri (Baru)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'linked'}
            onClick={() => handleModeChange('linked')}
            disabled={records.length === 0}
            className={`min-h-[40px] sm:min-h-0 px-4 py-2 sm:py-1.5 rounded-xl sm:rounded-full text-xs font-bold transition-colors text-center disabled:opacity-50 ${
              mode === 'linked'
                ? 'bg-[#0E1014] text-[#FACC15] shadow-xs'
                : 'text-[#475569] dark:text-slate-300 hover:text-[#0E1014] dark:hover:text-white'
            }`}
          >
            Kaitkan ke Berkas Terdaftar ({records.length})
          </button>
        </div>

        {mode === 'linked' && records.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 lg:max-w-xl">
            <label
              htmlFor="tax-linked-record"
              className="text-xs font-semibold text-slate-600 dark:text-teal-200 whitespace-nowrap"
            >
              Pilih Berkas:
            </label>
            <select
              id="tax-linked-record"
              value={selectedRecordId}
              onChange={(e) => handleSelectLinkedRecord(e.target.value)}
              className="input-airy w-full px-3.5 py-2 text-xs font-medium"
            >
              {records
                .slice()
                .sort((a, b) => b.no_urut - a.no_urut)
                .map((r) => {
                  const p1 =
                    r.para_pihak
                      .filter((p) => p.peran === 'Pihak I')
                      .map((p) => p.nama)
                      .join(', ') || '-';
                  return (
                    <option key={r.id} value={r.id}>
                      {r.kode_berkas} · {r.layanan} · {p1} ({formatNumberId(r.tanah.luas_m2)} m²)
                    </option>
                  );
                })}
            </select>
          </div>
        )}
      </div>

      {/* Main 2-Column Calculator Workspace */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Parameter Tanah, NJOP, Kesepakatan, NPOPTKP */}
        <div className="lg:col-span-6 bento-card p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-teal-900/10 dark:border-teal-400/15 pb-3.5">
            <div className="flex items-center gap-3">
              <GlossyIcon3D tone="teal" size="xs">
                <Calculator className="w-4 h-4" />
              </GlossyIcon3D>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Parameter Objek &amp; Nilai Transaksi
              </h2>
            </div>
            {mode === 'linked' && selectedRecord && (
              <span className="font-mono text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-700/60 px-2.5 py-1 rounded-xl">
                {selectedRecord.kode_berkas}
              </span>
            )}
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-teal-200/85 font-semibold mb-2">
                Jenis Layanan Peralihan Hak
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {SERVICE_TYPES.map((type) => {
                  const active = form.layanan === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleServiceChange(type)}
                      className={`px-3 py-2.5 rounded-lg border text-xs font-semibold text-left transition-colors ${
                        active
                          ? 'border-[#0F2942] dark:border-[#D97706] bg-[#F3ECE0] dark:bg-[#173654] text-[#0F2942] dark:text-[#FDE68A]'
                          : 'border-[#E2D5C1] dark:border-[#244564] bg-[#FFFDF9] dark:bg-[#0E2236] hover:bg-[#F7F2E7] dark:hover:bg-[#15314B] text-[#475569] dark:text-slate-300'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scan Cepat SPPT PBB & Sertipikat */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 p-3.5 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ScanLine className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Scan AI SPPT PBB &amp; Sertipikat</span>
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-teal-200/75 mt-0.5">
                    Dukung foto/JPG/PNG, PDF, dan Word (.docx/.doc) — isi otomatis Luas Tanah, NJOP Bumi/m², NJOP Bangunan sekaligus data Formulir Pengajuan BPHTB.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Scan SPPT PBB */}
                <div className="flex items-center gap-1.5">
                  <label
                    className={`btn-3d btn-3d-sky flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                      scanningDoc !== null ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    {scanningDoc === 'sppt' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <ScanLine className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">
                      {scanningDoc === 'sppt' ? 'Memindai SPPT...' : 'Scan SPPT PBB'}
                    </span>
                    <input
                      type="file"
                      accept={TAX_SCAN_FILE_ACCEPT}
                      multiple
                      disabled={scanningDoc !== null}
                      aria-label="Pilih file SPPT PBB untuk scan AI pajak"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = '';
                        void handleTaxObjectScan('sppt', files);
                      }}
                      className="sr-only"
                    />
                  </label>
                  <label
                    title="Foto kamera SPPT PBB"
                    aria-label="Foto kamera SPPT PBB"
                    className={`btn-3d btn-3d-light inline-flex items-center justify-center p-2 rounded-xl cursor-pointer shrink-0 ${
                      scanningDoc !== null ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    <Camera className="w-4 h-4 text-sky-600 dark:text-sky-300" />
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={scanningDoc !== null}
                      aria-label="Ambil foto kamera SPPT PBB"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = '';
                        void handleTaxObjectScan('sppt', files);
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>

                {/* Scan Sertipikat */}
                <div className="flex items-center gap-1.5">
                  <label
                    className={`btn-3d btn-3d-teal flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                      scanningDoc !== null ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    {scanningDoc === 'sertipikat' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <ScanLine className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">
                      {scanningDoc === 'sertipikat' ? 'Memindai Sertipikat...' : 'Scan Sertipikat'}
                    </span>
                    <input
                      type="file"
                      accept={TAX_SCAN_FILE_ACCEPT}
                      multiple
                      disabled={scanningDoc !== null}
                      aria-label="Pilih file Sertipikat untuk scan AI pajak"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = '';
                        void handleTaxObjectScan('sertipikat', files);
                      }}
                      className="sr-only"
                    />
                  </label>
                  <label
                    title="Foto kamera Sertipikat"
                    aria-label="Foto kamera Sertipikat"
                    className={`btn-3d btn-3d-light inline-flex items-center justify-center p-2 rounded-xl cursor-pointer shrink-0 ${
                      scanningDoc !== null ? 'opacity-60 pointer-events-none' : ''
                    }`}
                  >
                    <Camera className="w-4 h-4 text-teal-600 dark:text-teal-300" />
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={scanningDoc !== null}
                      aria-label="Ambil foto kamera Sertipikat"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = '';
                        void handleTaxObjectScan('sertipikat', files);
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {scanNotice && (
                <div
                  role={scanNotice.type === 'error' ? 'alert' : 'status'}
                  className={`flex items-start justify-between gap-2 px-3 py-2 rounded-xl text-[11px] border ${
                    scanNotice.type === 'error'
                      ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-500/35 text-rose-800 dark:text-rose-200'
                      : scanNotice.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-500/35 text-emerald-800 dark:text-emerald-200'
                      : 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-500/35 text-sky-800 dark:text-sky-200'
                  }`}
                >
                  <div className="flex items-start gap-1.5 min-w-0">
                    {scanNotice.type === 'info' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5" />
                    ) : scanNotice.type === 'error' ? (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-snug">{scanNotice.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScanNotice(null)}
                    aria-label="Tutup pemberitahuan scan"
                    className="p-0.5 opacity-70 hover:opacity-100 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Rumus Khusus BPHTB APHB: ((n - m) / n) × Luas × NJOP */}
            {form.layanan === 'APHB' && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-amber-950 dark:text-amber-100">
                      Parameter Rumus BPHTB APHB — Bagian Hak Baru ((n − m) / n)
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-teal-200/75 mt-0.5">
                      <strong>n</strong> = jumlah pemegang hak bersama saat ini ·{' '}
                      <strong>m</strong> = jumlah calon penerima hak selanjutnya (1 nama atau lebih).
                    </p>
                  </div>
                  {taxResult.aphb_aktif && (
                    <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 border border-amber-300/80 dark:border-amber-600/50">
                      Bagian Kena Pajak: {(taxResult.aphb_n ?? 2) - (taxResult.aphb_m ?? 1)}/
                      {taxResult.aphb_n ?? 2}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="tax-aphb-n"
                      className="block text-slate-700 dark:text-teal-100/90 font-semibold mb-1"
                    >
                      Jumlah Pemegang Hak Saat Ini (n)
                    </label>
                    <input
                      id="tax-aphb-n"
                      type="number"
                      min="2"
                      value={form.aphb_jumlah_pemegang_hak ?? 2}
                      onChange={(e) => {
                        const nextN = Math.max(2, Math.floor(Number(e.target.value) || 2));
                        const curM = Math.max(1, Math.floor(form.aphb_jumlah_penerima ?? 1));
                        setForm({
                          ...form,
                          aphb_jumlah_pemegang_hak: nextN,
                          aphb_jumlah_penerima: Math.min(nextN, curM),
                        });
                      }}
                      className="input-airy w-full px-3 py-2 font-mono tabular-nums text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="tax-aphb-m"
                      className="block text-slate-700 dark:text-teal-100/90 font-semibold mb-1"
                    >
                      Jumlah Calon Penerima Hak (m)
                    </label>
                    <input
                      id="tax-aphb-m"
                      type="number"
                      min="1"
                      max={Math.max(2, form.aphb_jumlah_pemegang_hak ?? 2)}
                      value={form.aphb_jumlah_penerima ?? 1}
                      onChange={(e) => {
                        const curN = Math.max(2, Math.floor(form.aphb_jumlah_pemegang_hak ?? 2));
                        const nextM = Math.min(
                          curN,
                          Math.max(1, Math.floor(Number(e.target.value) || 1))
                        );
                        setForm({
                          ...form,
                          aphb_jumlah_penerima: nextM,
                        });
                      }}
                      className="input-airy w-full px-3 py-2 font-mono tabular-nums text-sm"
                    />
                  </div>
                </div>

                {taxResult.aphb_aktif && (
                  <p className="text-[11px] font-mono text-amber-950 dark:text-amber-200 bg-white/80 dark:bg-[#081C20] px-3 py-2 rounded-xl border border-amber-200/80 dark:border-amber-700/40">
                    Luas Tanah Kena Pajak: ({taxResult.aphb_n} − {taxResult.aphb_m}) /{' '}
                    {taxResult.aphb_n} × {formatNumberId(form.luas_m2)} m² ={' '}
                    <strong>{formatNumberId(taxResult.luas_bumi_kena_pajak ?? 0)} m²</strong>
                    {(form.luas_bangunan_m2 ?? 0) > 0 && (
                      <span> · NJOP Bangunan tetap penuh sesuai SPPT</span>
                    )}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="tax-luas"
                  className="block text-slate-600 dark:text-teal-200/85 font-semibold mb-1.5"
                >
                  Luas Bidang Tanah (m²)
                </label>
                <input
                  id="tax-luas"
                  type="number"
                  min="0"
                  value={form.luas_m2}
                  onChange={(e) =>
                    setForm({ ...form, luas_m2: Number(e.target.value) || 0 })
                  }
                  className="input-airy w-full px-3.5 py-2.5 font-mono tabular-nums text-sm"
                />
                <p className="text-[11px] text-slate-500 dark:text-teal-200/65 mt-1 italic">
                  {terbilangLuas(form.luas_m2)}
                </p>
              </div>

              <div>
                <label
                  htmlFor="tax-njop-bumi-m2"
                  className="block text-slate-600 dark:text-teal-200/85 font-semibold mb-1.5"
                >
                  NJOP Bumi per m² (Rp)
                </label>
                <input
                  id="tax-njop-bumi-m2"
                  type="number"
                  min="0"
                  value={form.njop_bumi_m2}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      njop_bumi_m2: Number(e.target.value) || 0,
                    })
                  }
                  className="input-airy w-full px-3.5 py-2.5 font-mono tabular-nums text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="tax-luas-bangunan"
                  className="block text-slate-600 dark:text-teal-200/85 font-semibold mb-1.5"
                >
                  Luas Bangunan (m² · SPPT)
                </label>
                <input
                  id="tax-luas-bangunan"
                  type="number"
                  min="0"
                  value={form.luas_bangunan_m2 ?? 0}
                  onChange={(e) => {
                    const nextLuasB = Math.max(0, Number(e.target.value) || 0);
                    const curPerM2 = Math.max(0, form.njop_bangunan_m2 ?? 0);
                    setForm({
                      ...form,
                      luas_bangunan_m2: nextLuasB,
                      njop_bangunan:
                        nextLuasB > 0 && curPerM2 > 0
                          ? Math.round(nextLuasB * curPerM2)
                          : nextLuasB === 0 && curPerM2 > 0
                          ? 0
                          : form.njop_bangunan,
                    });
                  }}
                  className="input-airy w-full px-3.5 py-2.5 font-mono tabular-nums text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="tax-njop-bangunan-m2"
                  className="block text-slate-600 dark:text-teal-200/85 font-semibold mb-1.5"
                >
                  NJOP Bangunan per m² (Rp · SPPT)
                </label>
                <input
                  id="tax-njop-bangunan-m2"
                  type="number"
                  min="0"
                  value={form.njop_bangunan_m2 ?? 0}
                  onChange={(e) => {
                    const nextPerM2 = Math.max(0, Number(e.target.value) || 0);
                    const curLuasB = Math.max(0, form.luas_bangunan_m2 ?? 0);
                    setForm({
                      ...form,
                      njop_bangunan_m2: nextPerM2,
                      njop_bangunan:
                        curLuasB > 0 && nextPerM2 > 0
                          ? Math.round(curLuasB * nextPerM2)
                          : curLuasB > 0 && nextPerM2 === 0
                          ? 0
                          : form.njop_bangunan,
                    });
                  }}
                  className="input-airy w-full px-3.5 py-2.5 font-mono tabular-nums text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="tax-njop-bangunan"
                  className="block text-slate-600 dark:text-teal-200/85 font-semibold mb-1.5"
                >
                  Total NJOP Bangunan (Rp)
                </label>
                <input
                  id="tax-njop-bangunan"
                  type="number"
                  min="0"
                  value={
                    (form.luas_bangunan_m2 ?? 0) > 0 && (form.njop_bangunan_m2 ?? 0) > 0
                      ? Math.round((form.luas_bangunan_m2 ?? 0) * (form.njop_bangunan_m2 ?? 0))
                      : form.njop_bangunan
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      luas_bangunan_m2: 0,
                      njop_bangunan_m2: 0,
                      njop_bangunan: Number(e.target.value) || 0,
                    })
                  }
                  className="input-airy w-full px-3.5 py-2.5 font-mono tabular-nums text-sm"
                />
                <p className="text-[11px] text-slate-500 dark:text-teal-200/65 mt-1">
                  {(form.luas_bangunan_m2 ?? 0) > 0 && (form.njop_bangunan_m2 ?? 0) > 0
                    ? `Otomatis SPPT: ${formatNumberId(form.luas_bangunan_m2 ?? 0)} m² × ${formatRupiah(form.njop_bangunan_m2 ?? 0)}/m²`
                    : 'Isi Luas & NJOP Bangunan/m² dari SPPT, atau ketik total manual.'}
                </p>
              </div>

              <div>
                <label
                  htmlFor="tax-harga-m2"
                  className="block text-slate-600 dark:text-teal-200/85 font-semibold mb-1.5"
                >
                  Harga Kesepakatan per m² (Rp)
                </label>
                <input
                  id="tax-harga-m2"
                  type="number"
                  min="0"
                  value={form.harga_per_m2}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      harga_per_m2: Number(e.target.value) || 0,
                    })
                  }
                  className="input-airy w-full px-3.5 py-2.5 font-mono tabular-nums text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="tax-override"
                  className="block text-slate-600 dark:text-teal-200/85 font-semibold mb-1.5"
                >
                  Total Kesepakatan Manual (Opsional · kosongkan untuk otomatis Luas × Harga/m²)
                </label>
                <input
                  id="tax-override"
                  type="number"
                  min="0"
                  value={form.nilai_transaksi_override ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nilai_transaksi_override:
                        e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="Otomatis dari Luas × Harga per m²"
                  className="input-airy w-full px-3.5 py-2.5 font-mono tabular-nums text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="tax-npoptkp"
                    className="text-slate-600 dark:text-teal-200/85 font-semibold"
                  >
                    NPOPTKP (Rp · Default{' '}
                    {form.layanan === 'Turun Waris' || form.layanan === 'Waris C'
                      ? `Waris ${formatRupiah(settings.npoptkp_waris)}`
                      : `Umum ${formatRupiah(settings.npoptkp_umum)}`}
                    )
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        npoptkp: getDefaultNpoptkp(form.layanan, settings),
                      })
                    }
                    className="text-teal-700 dark:text-teal-300 hover:underline font-semibold"
                  >
                    Reset Default
                  </button>
                </div>
                <input
                  id="tax-npoptkp"
                  type="number"
                  min="0"
                  value={form.npoptkp}
                  onChange={(e) =>
                    setForm({ ...form, npoptkp: Number(e.target.value) || 0 })
                  }
                  className="input-airy w-full px-3.5 py-2.5 font-mono tabular-nums text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Hasil Perhitungan BPHTB & PPh Final */}
        <div className="lg:col-span-6 bento-card p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-teal-900/10 dark:border-teal-400/15 pb-3.5">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Rincian BPHTB &amp; PPh Final
              </h2>
              <span className="text-xs font-medium text-slate-500 dark:text-teal-200/75">
                Basis NPOP:{' '}
                <strong className="text-teal-900 dark:text-teal-200">
                  {taxSummary.dasar_npop_sumber}
                </strong>
              </span>
            </div>

            <div className="divide-y divide-teal-900/10 dark:divide-teal-400/15 text-xs border border-teal-900/10 dark:border-teal-400/15 rounded-2xl overflow-hidden">
              {taxResult.aphb_aktif && (
                <div className="px-4 py-2.5 bg-amber-50/90 dark:bg-amber-950/45 flex items-center justify-between gap-2">
                  <span className="text-amber-950 dark:text-amber-100 font-semibold">
                    Rumus APHB ({taxResult.aphb_n} − {taxResult.aphb_m}) / {taxResult.aphb_n} ×{' '}
                    {formatNumberId(form.luas_m2)} m²
                  </span>
                  <span className="font-mono font-bold text-amber-950 dark:text-amber-100 tabular-nums whitespace-nowrap">
                    {formatNumberId(taxResult.luas_bumi_kena_pajak ?? 0)} m² kena pajak
                  </span>
                </div>
              )}
              <div className="px-4 py-2.5 bg-[#F4FAF8] dark:bg-[#092024] flex items-center justify-between gap-2">
                <span className="text-slate-600 dark:text-teal-200/80">
                  {taxResult.aphb_aktif
                    ? `NJOP Bumi Kena Pajak (${formatNumberId(taxResult.luas_bumi_kena_pajak ?? 0)} m² × ${formatRupiah(form.njop_bumi_m2)})`
                    : `NJOP Bumi Total (${formatNumberId(form.luas_m2)} m² × ${formatRupiah(form.njop_bumi_m2)})`}
                </span>
                <span className="font-mono font-medium text-slate-900 dark:text-teal-50 tabular-nums whitespace-nowrap">
                  {formatRupiah(taxResult.njop_bumi_total)}
                </span>
              </div>
              <div className="px-4 py-2.5 bg-white dark:bg-[#0D262A] flex items-center justify-between gap-2">
                <span className="text-slate-600 dark:text-teal-200/80">
                  {(form.luas_bangunan_m2 ?? 0) > 0 && (form.njop_bangunan_m2 ?? 0) > 0
                    ? `NJOP Bangunan (${formatNumberId(form.luas_bangunan_m2 ?? 0)} m² × ${formatRupiah(form.njop_bangunan_m2 ?? 0)})`
                    : 'NJOP Bangunan'}
                </span>
                <span className="font-mono font-medium text-slate-900 dark:text-teal-50 tabular-nums whitespace-nowrap">
                  {formatRupiah(
                    taxResult.njop_bangunan_total ??
                      Math.max(0, taxResult.njop_total - taxResult.njop_bumi_total)
                  )}
                </span>
              </div>
              <div className="px-4 py-2.5 bg-[#F4FAF8] dark:bg-[#092024] flex items-center justify-between gap-2">
                <span className="font-medium text-slate-700 dark:text-teal-100">
                  Total NJOP PBB (Bumi + Bangunan)
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-teal-50 tabular-nums whitespace-nowrap">
                  {formatRupiah(taxResult.njop_total)}
                </span>
              </div>
              <div className="px-4 py-2.5 bg-[#F4FAF8] dark:bg-[#092024] space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-teal-200/80">
                    Nilai Kesepakatan Transaksi
                  </span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                    {formatRupiah(taxResult.nilai_kesepakatan)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-teal-200/65 italic">
                  Terbilang: {terbilangRupiah(taxResult.nilai_kesepakatan)}
                </p>
              </div>
              <div className="px-4 py-2.5 bg-white dark:bg-[#0D262A] flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800 dark:text-teal-100">
                  NPOP (Nilai Tertinggi Kesepakatan vs NJOP)
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                  {formatRupiah(taxResult.npop)}
                </span>
              </div>
              <div className="px-4 py-2.5 bg-[#F4FAF8] dark:bg-[#092024] flex items-center justify-between gap-2">
                <span className="text-slate-600 dark:text-teal-200/80">Pengurang NPOPTKP</span>
                <span className="font-mono font-medium text-slate-700 dark:text-teal-200 tabular-nums whitespace-nowrap">
                  − {formatRupiah(taxResult.npoptkp)}
                </span>
              </div>
              <div className="px-4 py-2.5 bg-white dark:bg-[#0D262A] flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800 dark:text-teal-100">
                  NPOPKP (Dasar Hitung BPHTB)
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                  {formatRupiah(taxResult.npopkp)}
                </span>
              </div>
            </div>

            {/* Flat Executive BPHTB & PPh Final Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-[#1E293B] dark:text-slate-100 leading-snug">
                    BPHTB Terutang
                    <span className="block text-[11px] font-medium text-[#64748B] dark:text-slate-400">
                      5% × NPOPKP
                    </span>
                  </p>
                  <GlossyIcon3D tone="sky" size="xs">
                    <Receipt className="w-4 h-4" />
                  </GlossyIcon3D>
                </div>
                <p className="font-mono text-xl font-bold text-[#1E293B] dark:text-white tabular-nums">
                  {formatRupiah(taxResult.bphtb)}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400 italic">
                  {terbilangRupiah(taxResult.bphtb)}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-[#1E293B] dark:text-slate-100 leading-snug">
                    PPh Final
                    <span className="block text-[11px] font-medium text-[#64748B] dark:text-slate-400">
                      2,5% × NPOP
                    </span>
                  </p>
                  <GlossyIcon3D tone="amber" size="xs">
                    <Coins className="w-4 h-4" />
                  </GlossyIcon3D>
                </div>
                <p className="font-mono text-xl font-bold text-[#1E293B] dark:text-white tabular-nums">
                  {formatRupiah(taxResult.pph)}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400 italic">
                  {terbilangRupiah(taxResult.pph)}
                </p>
              </div>
            </div>

            {/* Flat Deep Marine Navy + Gold Accent Card: Total Estimasi Pajak */}
            <div className="px-5 py-4 rounded-xl bg-[#0F2942] dark:bg-[#0A1D30] border border-[#1E3A54] border-t-2 border-t-[#D97706]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 border border-[#D97706]/50 text-[#FBBF24] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#FDE68A]">
                      Total Estimasi Pajak
                    </span>
                    <span className="block text-xs font-medium text-slate-200/85">
                      BPHTB (5%) + PPh Final (2,5%)
                    </span>
                  </div>
                </div>
                <div className="sm:text-right">
                  <span className="text-2xl font-extrabold text-[#F8FAFC] tracking-tight tabular-nums">
                    {formatRupiah(taxSummary.total_pajak)}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Pengajuan BPHTB (SIPAD Boyolali) tepat di bawah Total Estimasi Pajak */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <GlossyIcon3D tone="sky" size="sm" className="mt-0.5">
                    <Landmark className="w-4 h-4" />
                  </GlossyIcon3D>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-bold text-slate-900 dark:text-white">
                        Pengajuan BPHTB (SIPAD Boyolali)
                      </p>
                      {isAjbService(form.layanan) && (
                        <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                          · + Bukti Transaksi
                        </span>
                      )}
                      {isHibahService(form.layanan) && (
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          · + Surat Pernyataan Hibah
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-teal-200/80 mt-0.5">
                      Buat formulir pengajuan:{' '}
                      <span className="font-semibold text-slate-800 dark:text-teal-100">
                        {bphtbDocs.map((d) => d.shortLabel).join(', ')}
                      </span>
                      .
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleBphtbPanel}
                  className="btn-3d btn-3d-sky inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  <span>
                    {showBphtbPanel ? 'Tutup Formulir BPHTB' : 'Buat Formulir Pengajuan BPHTB'}
                  </span>
                  {showBphtbPanel ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {bphtbGenerated && (
                <div className="pt-2.5 border-t border-sky-200/80 dark:border-sky-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Berkas selesai dibuat ({bphtbGenerated.docCount} formulir · {bphtbGenerated.generatedAt})
                    </span>
                  </div>
                  <a
                    href={SIPAD_BOYOLALI_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-3d btn-3d-emerald inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap"
                  >
                    <span>Ajukan Sekarang</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Workflow Bridge Actions */}
          <div className="pt-3.5 border-t border-teal-900/10 dark:border-teal-400/15 flex flex-wrap items-center justify-between gap-2.5">
            {mode === 'linked' && selectedRecord ? (
              <>
                <button
                  type="button"
                  onClick={() => onEditRecord(selectedRecord)}
                  className="btn-3d btn-3d-light inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Buka Berkas di Pembuatan Akta</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveTaxToRecord}
                  disabled={saving}
                  className="btn-3d btn-3d-teal inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-60 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {saving
                      ? 'Menyimpan...'
                      : `Simpan Pajak ke Berkas ${selectedRecord.kode_berkas}`}
                  </span>
                </button>
              </>
            ) : (
              <>
                <span className="text-[11px] text-slate-500 dark:text-teal-200/70">
                  Hasil simulasi ini dapat langsung dipakai untuk membuka berkas baru.
                </span>
                <button
                  type="button"
                  onClick={() => onCreateBerkasWithTax(form)}
                  className="btn-3d btn-3d-teal inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>Buat Berkas Baru dengan Hasil Pajak Ini</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Formulir Pengajuan BPHTB Workspace */}
      {showBphtbPanel && (
        <BphtbSubmissionSection
          taxForm={form}
          taxResult={taxResult}
          settings={settings}
          linkedRecord={mode === 'linked' ? selectedRecord : null}
          form={bphtbForm}
          onChangeForm={setBphtbForm}
          onSyncTaxFromObjectScan={(patch) => {
            setForm((prev) => applyObjectScanPatchToTaxDraft(prev, patch, 'both'));
          }}
          onResetFromSource={() => {
            setBphtbForm(
              buildInitialBphtbFormData(
                settings,
                mode === 'linked' ? selectedRecord : null
              )
            );
            setBphtbGenerated(null);
            onNotify('Data formulir pengajuan BPHTB dimuat ulang dari sumber aktif.', 'success');
          }}
          generatedState={bphtbGenerated}
          onGenerated={setBphtbGenerated}
          onClose={() => setShowBphtbPanel(false)}
          onNotify={onNotify}
        />
      )}

      {/* Bottom Registered Records Quick Tax Table */}
      <div className="no-print bento-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-teal-900/10 dark:border-teal-400/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <GlossyIcon3D tone="indigo" size="xs">
              <FolderCheck className="w-4 h-4" />
            </GlossyIcon3D>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Daftar Pajak Berkas Terdaftar
              </h2>
              <p className="text-xs text-slate-500 dark:text-teal-200/70">
                Klik &ldquo;Hitung / Ubah&rdquo; pada berkas mana saja untuk memuat ulang dan memperbarui pajaknya.
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-teal-700/60 dark:text-teal-300/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode berkas, pihak, desa..."
              aria-label="Cari daftar pajak berkas"
              className="input-airy w-full pl-9 pr-3 py-2 text-xs"
            />
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-teal-200/70">
            Tidak ada berkas yang cocok dengan pencarian Anda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-teal-900/10 dark:border-teal-400/15 bg-[#F4FAF8] dark:bg-[#092024] font-semibold text-teal-900/75 dark:text-teal-200/80">
                  <th className="py-3 px-3 whitespace-nowrap">Kode &amp; Layanan</th>
                  <th className="py-3 px-3">Para Pihak</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Luas</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">NPOP</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">BPHTB (5%)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">PPh (2,5%)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-900/8 dark:divide-teal-400/10">
                {filteredRecords.map((r) => {
                  const p1 =
                    r.para_pihak
                      .filter((p) => p.peran === 'Pihak I')
                      .map((p) => p.nama)
                      .join(', ') || '-';
                  const p2 =
                    r.para_pihak
                      .filter((p) => p.peran === 'Pihak II')
                      .map((p) => p.nama)
                      .join(', ') || '-';
                  const isSelected = mode === 'linked' && selectedRecordId === r.id;
                  return (
                    <tr
                      key={r.id}
                      className={
                        isSelected
                          ? 'bg-teal-50/80 dark:bg-teal-900/40'
                          : 'hover:bg-teal-50/50 dark:hover:bg-teal-900/25 transition-colors'
                      }
                    >
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900 dark:text-white">
                          {r.kode_berkas}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-teal-200/70">
                          {r.layanan}
                        </div>
                      </td>
                      <td className="py-3 px-3 max-w-[200px]">
                        <div className="truncate text-slate-800 dark:text-teal-50" title={p1}>
                          I: {p1}
                        </div>
                        <div className="truncate text-slate-500 dark:text-teal-200/70" title={p2}>
                          II: {p2}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-800 dark:text-teal-100">
                        {formatNumberId(r.tanah.luas_m2)} m²
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-900 dark:text-white">
                        {formatRupiah(r.pajak.npop)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap font-semibold text-sky-800 dark:text-sky-300">
                        {formatRupiah(r.pajak.bphtb)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap font-semibold text-amber-800 dark:text-amber-300">
                        {formatRupiah(r.pajak.pph)}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleLoadRecordFromTable(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-teal-900/12 dark:border-teal-400/20 bg-white dark:bg-[#113338] hover:bg-teal-50 dark:hover:bg-teal-800/60 text-xs font-semibold text-slate-700 dark:text-teal-100 shadow-xs"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          <span>Hitung / Ubah</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print-Only Official Summary Sheet */}
      <div className="hidden print:block p-6 text-slate-900 text-xs space-y-4">
        <div className="border-b-2 border-slate-900 pb-3 text-center">
          <p className="font-bold text-sm uppercase">
            KANTOR PEJABAT PEMBUAT AKTA TANAH SEMENTARA (PPATS)
          </p>
          <p className="font-bold text-sm uppercase">{settings.nama_kecamatan}</p>
          <p>{settings.alamat_kantor} · Telp. {settings.telepon_kantor}</p>
        </div>
        <div className="text-center">
          <h2 className="font-bold text-sm uppercase underline">
            LEMBAR PERHITUNGAN ESTIMASI PAJAK PERTANAHAN (BPHTB &amp; PPh FINAL)
          </h2>
          {mode === 'linked' && selectedRecord && (
            <p className="mt-1 font-mono">
              Berkas: {selectedRecord.kode_berkas} · Layanan: {form.layanan}
            </p>
          )}
        </div>
        <table className="w-full border-collapse border border-slate-400">
          <tbody>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-medium w-1/2">
                Jenis Layanan
              </td>
              <td className="border border-slate-400 px-3 py-2">{form.layanan}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-medium">
                Luas Bidang Tanah
              </td>
              <td className="border border-slate-400 px-3 py-2 font-mono">
                {formatNumberId(form.luas_m2)} m² ({terbilangLuas(form.luas_m2)})
                {taxResult.aphb_aktif &&
                  ` · Kena Pajak APHB (${taxResult.aphb_n} − ${taxResult.aphb_m})/${taxResult.aphb_n}: ${formatNumberId(taxResult.luas_bumi_kena_pajak ?? 0)} m²`}
              </td>
            </tr>
            {(form.luas_bangunan_m2 ?? 0) > 0 && (
              <tr>
                <td className="border border-slate-400 px-3 py-2 font-medium">
                  Bangunan (SPPT)
                </td>
                <td className="border border-slate-400 px-3 py-2 font-mono">
                  {formatNumberId(form.luas_bangunan_m2 ?? 0)} m² ×{' '}
                  {formatRupiah(form.njop_bangunan_m2 ?? 0)}/m²
                </td>
              </tr>
            )}
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-medium">
                Total NJOP PBB (Bumi + Bangunan)
              </td>
              <td className="border border-slate-400 px-3 py-2 font-mono">
                {formatRupiah(taxResult.njop_total)}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-medium">
                Nilai Kesepakatan Transaksi
              </td>
              <td className="border border-slate-400 px-3 py-2 font-mono">
                {formatRupiah(taxResult.nilai_kesepakatan)}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-semibold">
                NPOP (Nilai Tertinggi)
              </td>
              <td className="border border-slate-400 px-3 py-2 font-mono font-semibold">
                {formatRupiah(taxResult.npop)}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-medium">
                NPOPTKP
              </td>
              <td className="border border-slate-400 px-3 py-2 font-mono">
                {formatRupiah(taxResult.npoptkp)}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-medium">
                NPOPKP
              </td>
              <td className="border border-slate-400 px-3 py-2 font-mono">
                {formatRupiah(taxResult.npopkp)}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-bold">
                BPHTB Terutang (5% × NPOPKP)
              </td>
              <td className="border border-slate-400 px-3 py-2 font-mono font-bold">
                {formatRupiah(taxResult.bphtb)} ({terbilangRupiah(taxResult.bphtb)})
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-bold">
                PPh Final (2,5% × NPOP)
              </td>
              <td className="border border-slate-400 px-3 py-2 font-mono font-bold">
                {formatRupiah(taxResult.pph)} ({terbilangRupiah(taxResult.pph)})
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-3 py-2 font-bold">
                Total Pajak (BPHTB + PPh)
              </td>
              <td className="border border-slate-400 px-3 py-2 font-mono font-bold">
                {formatRupiah(taxSummary.total_pajak)}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="pt-6 text-right">
          <p>{settings.nama_kecamatan}, {todayFormatted}</p>
          <p className="mt-12 font-semibold">{settings.nama_ppats}</p>
        </div>
      </div>
    </div>
  );
};
