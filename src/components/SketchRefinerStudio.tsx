import React, { useState } from 'react';
import {
  CheckCircle2,
  Columns2,
  Compass,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCw,
  Rows2,
  Sparkles,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';
import { DataTanah, NonAktaDetail, PemecahanBidangItem } from '../types/ppats';
import { optimizeDocumentFile } from '../utils/imageOptimizer';
import { postScanJson } from '../utils/scanApi';
import {
  AutoCadSketchInput,
  CadSketchSpec,
  CardinalSide,
  buildAutoCadSketchSpec,
  normalizeCadSketchSpec,
  rasterizeSvgToPngDataUrl,
  renderCadSketchToSvg,
  rotateCadSketchSpec90,
  syncFormLabelsToCadSpec,
} from '../utils/sketchRefiner';

interface SketchRefinerStudioProps {
  nonAkta: NonAktaDetail;
  setNonAkta: React.Dispatch<React.SetStateAction<NonAktaDetail>>;
  tanah: DataTanah;
  setTanah: React.Dispatch<React.SetStateAction<DataTanah>>;
  isPemecahan: boolean;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

interface DetectedBoundarySuggestion {
  utara?: string;
  timur?: string;
  selatan?: string;
  barat?: string;
}

interface UploadedRoughPayload {
  name: string;
  mimeType: string;
  dataBase64: string;
}

export const SketchRefinerStudio: React.FC<SketchRefinerStudioProps> = ({
  nonAkta,
  setNonAkta,
  tanah,
  setTanah,
  isPemecahan,
  onNotify,
}) => {
  const [isRefining, setIsRefining] = useState(false);
  const [isAutoBuilding, setIsAutoBuilding] = useState(false);
  const [refineSummary, setRefineSummary] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [detectedBounds, setDetectedBounds] = useState<DetectedBoundarySuggestion | null>(null);
  const [activeSpec, setActiveSpec] = useState<CadSketchSpec | null>(null);
  const [splitOrientation, setSplitOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [lastUploadedPayload, setLastUploadedPayload] = useState<UploadedRoughPayload | null>(null);

  const buildSketchContext = (
    orientationOverride?: 'vertical' | 'horizontal'
  ): AutoCadSketchInput => ({
    batasUtara: tanah.batas_utara,
    batasTimur: tanah.batas_timur,
    batasSelatan: tanah.batas_selatan,
    batasBarat: tanah.batas_barat,
    luasIndukM2: tanah.luas_m2,
    bidangPecahan: (nonAkta.bidang_pecahan ?? []) as PemecahanBidangItem[],
    isPemecahan,
    sertakanPelepasanJalan: Boolean(nonAkta.sertakan_pelepasan_jalan),
    pelepasanJalanLuasM2: nonAkta.pelepasan_jalan_luas_m2 ?? 0,
    pelepasanJalanSisi: (nonAkta.pelepasan_jalan_sisi ?? 'utara') as CardinalSide,
    pelepasanJalanKeterangan: nonAkta.pelepasan_jalan_keterangan,
    splitOrientation: orientationOverride ?? splitOrientation,
  });

  const commitSpecToPreview = async (spec: CadSketchSpec, toastMessage?: string) => {
    const svg = renderCadSketchToSvg(spec);
    const pngDataUrl = await rasterizeSvgToPngDataUrl(svg, 1200, 768);
    setActiveSpec(spec);
    setNonAkta((prev) => ({
      ...prev,
      foto_sket_pecah: pngDataUrl,
    }));
    setRefineSummary(
      spec.summary || 'Sket CAD rapi berhasil diperbarui dan disematkan ke berkas.'
    );
    if (toastMessage) {
      onNotify(toastMessage, 'success');
    }
  };

  const handleGenerateAutoCad = async (orientationOverride?: 'vertical' | 'horizontal') => {
    const nextOrient = orientationOverride ?? splitOrientation;
    if (orientationOverride) {
      setSplitOrientation(orientationOverride);
    }
    setIsAutoBuilding(true);
    setRefineError(null);
    try {
      const spec = buildAutoCadSketchSpec(buildSketchContext(nextOrient));
      await commitSpecToPreview(
        spec,
        'Sket bidang tanah CAD rapi berhasil dibuat dan disematkan ke Pemasangan Tanda Batas & Gambar Sket Tanah.'
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal membuat sket CAD otomatis.';
      setRefineError(msg);
      onNotify(msg, 'error');
    } finally {
      setIsAutoBuilding(false);
    }
  };

  const runAiRefineOnPayload = async (payload: UploadedRoughPayload) => {
    setIsRefining(true);
    setRefineError(null);
    setDetectedBounds(null);
    setLastUploadedPayload(payload);
    try {
      const ctx = buildSketchContext();
      const json = await postScanJson<{
        spec?: Partial<CadSketchSpec>;
        error?: string;
      }>('/api/refine-sketch', {
        file: payload,
        context: ctx,
      });

      const normalized = normalizeCadSketchSpec(json.spec, ctx);
      await commitSpecToPreview(
        normalized,
        'Sket kasar berhasil disempurnakan menjadi sket CAD rapi untuk Pemasangan Tanda Batas & Gambar Sket Tanah.'
      );

      const det = normalized.detectedBoundaries;
      if (det && (det.utara || det.timur || det.selatan || det.barat)) {
        setDetectedBounds(det);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal menyempurnakan gambar sket kasar dengan AI.';
      setRefineError(msg);
      onNotify(msg, 'error');
    } finally {
      setIsRefining(false);
    }
  };

  const handleRoughSketchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setRefineError(null);
    try {
      const optimized = await optimizeDocumentFile(file, {
        maxEdge: 1400,
        quality: 0.85,
      });

      if (optimized.mimeType.startsWith('image/')) {
        const roughDataUrl = `data:${optimized.mimeType};base64,${optimized.dataBase64}`;
        setNonAkta((prev) => ({
          ...prev,
          foto_sket_kasar: roughDataUrl,
        }));
      }

      await runAiRefineOnPayload({
        name: file.name,
        mimeType: optimized.mimeType,
        dataBase64: optimized.dataBase64,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal membaca file sket kasar yang diunggah.';
      setRefineError(msg);
      onNotify(msg, 'error');
    }
  };

  const handleReRefineStoredRough = async () => {
    if (lastUploadedPayload) {
      await runAiRefineOnPayload(lastUploadedPayload);
      return;
    }
    const raw = nonAkta.foto_sket_kasar;
    if (!raw) return;
    const match = /^data:([^;]+);base64,(.+)$/s.exec(raw.trim());
    if (!match) return;
    await runAiRefineOnPayload({
      name: 'sket-kasar.jpg',
      mimeType: match[1],
      dataBase64: match[2],
    });
  };

  const handleRotateSpec90 = async () => {
    if (!activeSpec) return;
    setIsAutoBuilding(true);
    setRefineError(null);
    try {
      const rotated = rotateCadSketchSpec90(activeSpec);
      await commitSpecToPreview(rotated, 'Orientasi sket diputar 90° dan diperbarui ke berkas.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memutar gambar sket.';
      setRefineError(msg);
      onNotify(msg, 'error');
    } finally {
      setIsAutoBuilding(false);
    }
  };

  const handleSyncFormLabels = async () => {
    if (!activeSpec) return;
    setIsAutoBuilding(true);
    setRefineError(null);
    try {
      const synced = syncFormLabelsToCadSpec(activeSpec, buildSketchContext());
      await commitSpecToPreview(synced, 'Label batas tetangga & luas bidang berhasil disinkronkan.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyinkronkan label batas.';
      setRefineError(msg);
      onNotify(msg, 'error');
    } finally {
      setIsAutoBuilding(false);
    }
  };

  const handleDirectCleanSketchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setRefineError(null);
    try {
      const optimized = await optimizeDocumentFile(file, {
        maxEdge: 1400,
        quality: 0.85,
      });
      const dataUrl = `data:${optimized.mimeType};base64,${optimized.dataBase64}`;
      setActiveSpec(null);
      setNonAkta((prev) => ({
        ...prev,
        foto_sket_pecah: dataUrl,
      }));
      setRefineSummary(`Gambar sket "${file.name}" disematkan langsung tanpa modifikasi.`);
      onNotify(`Gambar sket ${file.name} berhasil disematkan ke berkas.`, 'success');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal membaca file gambar sket.';
      setRefineError(msg);
      onNotify(msg, 'error');
    }
  };

  const handleApplyDetectedBoundaries = () => {
    if (!detectedBounds) return;
    setTanah((prev) => ({
      ...prev,
      batas_utara: detectedBounds.utara || prev.batas_utara,
      batas_timur: detectedBounds.timur || prev.batas_timur,
      batas_selatan: detectedBounds.selatan || prev.batas_selatan,
      batas_barat: detectedBounds.barat || prev.batas_barat,
    }));
    setDetectedBounds(null);
    onNotify('Nama batas dari sket kasar diterapkan ke Data Tanah.', 'success');
  };

  const hasCleanSketch = Boolean(nonAkta.foto_sket_pecah);
  const hasRoughSketch = Boolean(nonAkta.foto_sket_kasar);
  const canReRefine = hasRoughSketch || Boolean(lastUploadedPayload);
  const hasMultipleLots = isPemecahan && (nonAkta.bidang_pecahan?.length ?? 0) >= 2;

  return (
    <div className="p-3.5 rounded-xl border border-teal-900/15 dark:border-teal-500/25 bg-white dark:bg-[#081E22] space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-teal-600 dark:text-teal-300" />
            <span>Studio Sket Bidang Tanah (Pemasangan Tanda Batas &amp; Gambar Sket Tanah)</span>
          </h4>
          <p className="text-[11px] text-slate-600 dark:text-teal-200/75 mt-0.5 leading-relaxed">
            Scan / unggah <strong>sket gambar kasar (tulisan tangan)</strong> untuk disempurnakan otomatis menjadi gambar garis lurus CAD rapi berpanah Utara (U), atau buat sket CAD otomatis dari data batas &amp; bidang pecahan. Sket otomatis masuk ke kotak <strong>Sketsa Bidang Tanah</strong> di Pemasangan Tanda Batas dan halaman <strong>Gambar Sket Tanah</strong>.
          </p>
        </div>
        {hasCleanSketch && (
          <button
            type="button"
            onClick={() => {
              setNonAkta((prev) => ({
                ...prev,
                foto_sket_pecah: '',
                foto_sket_kasar: '',
              }));
              setActiveSpec(null);
              setLastUploadedPayload(null);
              setRefineSummary(null);
              setRefineError(null);
              setDetectedBounds(null);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-500/35 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-[11px] font-semibold shrink-0 self-start"
          >
            <Trash2 className="w-3 h-3" />
            <span>Hapus Sket</span>
          </button>
        )}
      </div>

      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`btn-3d btn-3d-teal inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
            isRefining || isAutoBuilding ? 'opacity-60 pointer-events-none' : ''
          }`}
        >
          {isRefining ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>
            {isRefining
              ? 'Menyempurnakan Sket Kasar...'
              : 'Scan Sket Kasar → Sempurnakan (AI)'}
          </span>
          <input
            id="sket-rough-upload"
            type="file"
            accept="image/*,application/pdf"
            aria-label="Unggah atau scan sket gambar kasar untuk disempurnakan AI"
            onChange={(e) => void handleRoughSketchUpload(e)}
            disabled={isRefining || isAutoBuilding}
            className="hidden"
          />
        </label>

        <button
          id="btn-auto-cad-sket"
          type="button"
          onClick={() => void handleGenerateAutoCad()}
          disabled={isRefining || isAutoBuilding}
          className="btn-3d btn-3d-light inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60"
        >
          {isAutoBuilding ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
          ) : (
            <Compass className="w-3.5 h-3.5 text-teal-600 dark:text-teal-300" />
          )}
          <span>Buat Sket Otomatis dari Data Form (CAD)</span>
        </button>

        <label
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-teal-900/15 dark:border-teal-500/30 bg-white dark:bg-[#0B262B] hover:bg-teal-50 dark:hover:bg-teal-900/40 text-xs font-semibold text-slate-700 dark:text-teal-100 cursor-pointer ${
            isRefining || isAutoBuilding ? 'opacity-60 pointer-events-none' : ''
          }`}
        >
          <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-teal-300" />
          <span>Unggah Sket Jadi Langsung</span>
          <input
            id="sket-direct-upload"
            type="file"
            accept="image/*"
            aria-label="Unggah gambar sket jadi langsung"
            onChange={(e) => void handleDirectCleanSketchUpload(e)}
            disabled={isRefining || isAutoBuilding}
            className="hidden"
          />
        </label>

        {canReRefine && (
          <button
            id="btn-rerefine-sket"
            type="button"
            onClick={() => void handleReRefineStoredRough()}
            disabled={isRefining || isAutoBuilding}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-teal-900/15 dark:border-teal-500/30 text-[11px] font-semibold text-teal-700 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-900/40 disabled:opacity-50"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sempurnakan Ulang</span>
          </button>
        )}
      </div>

      {/* Precision CAD Adjustment Bar (when active CAD/AI spec exists) */}
      {(activeSpec || hasMultipleLots) && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-teal-900/10 dark:border-teal-500/20">
          {hasMultipleLots && (
            <div className="inline-flex items-center rounded-lg border border-teal-900/15 dark:border-teal-500/30 bg-slate-50 dark:bg-[#06181B] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => void handleGenerateAutoCad('vertical')}
                disabled={isRefining || isAutoBuilding}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition ${
                  splitOrientation === 'vertical'
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-600 dark:text-teal-200 hover:bg-white/70 dark:hover:bg-teal-900/40'
                }`}
              >
                <Columns2 className="w-3 h-3" />
                <span>Bagi Kiri–Kanan</span>
              </button>
              <button
                type="button"
                onClick={() => void handleGenerateAutoCad('horizontal')}
                disabled={isRefining || isAutoBuilding}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold transition ${
                  splitOrientation === 'horizontal'
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-600 dark:text-teal-200 hover:bg-white/70 dark:hover:bg-teal-900/40'
                }`}
              >
                <Rows2 className="w-3 h-3" />
                <span>Bagi Atas–Bawah</span>
              </button>
            </div>
          )}

          {activeSpec && (
            <>
              <button
                id="btn-rotate-sket-90"
                type="button"
                onClick={() => void handleRotateSpec90()}
                disabled={isRefining || isAutoBuilding}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-teal-500/30 bg-white dark:bg-[#0B262B] hover:bg-slate-50 dark:hover:bg-teal-900/40 text-[11px] font-semibold text-slate-700 dark:text-teal-100 disabled:opacity-50"
              >
                <RotateCw className="w-3 h-3 text-teal-600 dark:text-teal-300" />
                <span>Putar 90°</span>
              </button>
              <button
                id="btn-sync-sket-labels"
                type="button"
                onClick={() => void handleSyncFormLabels()}
                disabled={isRefining || isAutoBuilding}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-teal-500/30 bg-white dark:bg-[#0B262B] hover:bg-slate-50 dark:hover:bg-teal-900/40 text-[11px] font-semibold text-slate-700 dark:text-teal-100 disabled:opacity-50"
              >
                <Tag className="w-3 h-3 text-teal-600 dark:text-teal-300" />
                <span>Sinkronkan Batas &amp; Luas Form</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Status / Error / Boundary Suggestion */}
      {refineError && (
        <div className="p-2.5 rounded-lg border border-rose-300 dark:border-rose-500/40 bg-rose-50/80 dark:bg-rose-950/40 text-[11px] text-rose-800 dark:text-rose-200">
          {refineError}
        </div>
      )}

      {refineSummary && !refineError && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-emerald-300/70 dark:border-emerald-500/35 bg-emerald-50/70 dark:bg-emerald-950/35 text-[11px] text-emerald-900 dark:text-emerald-100">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <span>{refineSummary}</span>
        </div>
      )}

      {detectedBounds && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2.5 rounded-lg border border-amber-300/70 dark:border-amber-500/35 bg-amber-50/75 dark:bg-amber-950/35 text-[11px] text-amber-950 dark:text-amber-100">
          <div>
            <p className="font-bold">Batas tetangga terdeteksi dari gambar sket kasar:</p>
            <p className="mt-0.5">
              {[
                detectedBounds.utara ? `Utara: ${detectedBounds.utara}` : null,
                detectedBounds.timur ? `Timur: ${detectedBounds.timur}` : null,
                detectedBounds.selatan ? `Selatan: ${detectedBounds.selatan}` : null,
                detectedBounds.barat ? `Barat: ${detectedBounds.barat}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleApplyDetectedBoundaries}
            className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] shrink-0"
          >
            Terapkan ke Batas Tanah
          </button>
        </div>
      )}

      {/* Preview: Side-by-side Before vs After if rough sketch exists, else single clean preview */}
      {hasCleanSketch ? (
        <div
          className={`grid gap-3 ${
            hasRoughSketch ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {hasRoughSketch && (
            <div className="rounded-xl border border-slate-200 dark:border-teal-500/25 bg-slate-50/80 dark:bg-[#06181B] p-2.5 space-y-1.5">
              <span className="block text-[11px] font-semibold text-slate-600 dark:text-teal-200/80">
                Gambar Sket Kasar (Hasil Scan Asli)
              </span>
              <img
                src={nonAkta.foto_sket_kasar}
                alt="Sket kasar asli"
                className="w-full max-h-56 object-contain rounded-lg bg-white border border-slate-200"
              />
            </div>
          )}
          <div className="rounded-xl border border-teal-600/30 dark:border-teal-400/35 bg-white p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-teal-800">
                Hasil Sket Rapi (Otomatis Dicetak ke Pemasangan Tanda Batas &amp; Gambar Sket Tanah)
              </span>
            </div>
            <img
              id="sket-clean-preview"
              src={nonAkta.foto_sket_pecah}
              alt="Sket bidang tanah rapi"
              className="w-full max-h-60 object-contain rounded-lg bg-white border border-slate-200"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-teal-500/35 bg-teal-50/35 dark:bg-teal-950/25 p-4 text-center text-[11px] text-slate-600 dark:text-teal-200/80 flex flex-col items-center gap-1">
          <ImagePlus className="w-5 h-5 text-teal-600 dark:text-teal-300" />
          <p className="font-medium">
            Belum ada gambar sket terpasang. Gunakan <strong>Scan Sket Kasar → Sempurnakan (AI)</strong> atau <strong>Buat Sket Otomatis (CAD)</strong>.
          </p>
        </div>
      )}
    </div>
  );
};
