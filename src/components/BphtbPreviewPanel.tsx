import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Edit3,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  OfficeSettings,
  TaxCalculationResult,
  TaxDraftPrefill,
} from '../types/ppats';
import {
  BphtbDocKey,
  BphtbSubmissionFormData,
  buildSingleBphtbDocxBytes,
  getBphtbDocumentList,
} from '../utils/bphtbSubmissionGenerator';
import {
  DocxPreviewDocument,
  PreviewBlock,
  PreviewParagraphBlock,
  PreviewTableBlock,
  parseDocxBytesToPreview,
} from '../utils/docxPreviewParser';

interface BphtbPreviewPanelProps {
  taxForm: TaxDraftPrefill;
  taxResult: TaxCalculationResult;
  form: BphtbSubmissionFormData;
  settings: OfficeSettings;
  activeDocKey: BphtbDocKey;
  onSelectDocKey: (docKey: BphtbDocKey) => void;
  onDownloadSingle: (docKey: BphtbDocKey, label: string) => void;
  onBackToForm: () => void;
  busyKey: string | null;
}

const RenderParagraph: React.FC<{
  block: PreviewParagraphBlock;
  inCompactCell?: boolean;
}> = ({ block, inCompactCell }) => {
  const hasText = block.runs.some((r) => r.text.trim().length > 0);
  const textAlign = block.align === 'justify' ? 'justify' : block.align;
  const textIndent = block.hangingPx
    ? -block.hangingPx
    : block.firstLinePx || 0;

  if (!hasText) {
    return (
      <div
        className={inCompactCell ? 'h-1.5' : 'h-2.5'}
        style={{
          marginBottom:
            block.spaceAfterPx > 6 ? `${Math.min(28, block.spaceAfterPx)}px` : undefined,
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <p
      className={`${
        inCompactCell ? 'text-[11.5px] leading-[1.4]' : 'text-[12.5px] leading-[1.5]'
      } text-slate-900 whitespace-pre-line ${
        block.borderBottom ? 'border-b-2 border-slate-900 pb-1.5 mb-2' : ''
      }`}
      style={{
        textAlign,
        paddingLeft: block.indentLeftPx > 0 ? `${block.indentLeftPx}px` : undefined,
        textIndent: textIndent !== 0 ? `${textIndent}px` : undefined,
        marginTop: block.spaceBeforePx > 0 ? `${block.spaceBeforePx}px` : undefined,
        marginBottom: block.spaceAfterPx > 0 ? `${block.spaceAfterPx}px` : undefined,
      }}
    >
      {block.runs.map((run, rIdx) => {
        const classes = [
          run.bold ? 'font-bold' : 'font-normal',
          run.italic ? 'italic' : '',
          run.underline ? 'underline underline-offset-2' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const fontSizePx =
          run.sizePt && run.sizePt !== 11
            ? Math.round((run.sizePt / 11) * 12 * 10) / 10
            : undefined;
        return (
          <span
            key={rIdx}
            className={classes}
            style={
              fontSizePx ? { fontSize: `${fontSizePx}px`, lineHeight: 1.4 } : undefined
            }
          >
            {run.text}
          </span>
        );
      })}
    </p>
  );
};

const RenderBlock: React.FC<{
  block: PreviewBlock;
  inCompactCell?: boolean;
}> = ({ block, inCompactCell }) => {
  if (block.kind === 'paragraph') {
    return <RenderParagraph block={block} inCompactCell={inCompactCell} />;
  }
  return <RenderTable block={block} />;
};

const RenderTable: React.FC<{ block: PreviewTableBlock }> = ({ block }) => {
  // Deteksi tabel bingkai luar tunggal (1x1 bordered box, seperti bingkai Formulir SSPD)
  const isOuterFrameBox =
    block.rows.length === 1 &&
    block.rows[0].cells.length === 1 &&
    block.rows[0].cells[0].borders.top &&
    block.rows[0].cells[0].borders.bottom &&
    block.rows[0].cells[0].borders.left &&
    block.rows[0].cells[0].borders.right;

  if (isOuterFrameBox) {
    const innerBlocks = block.rows[0].cells[0].blocks;
    return (
      <div className="my-2 border-[1.5px] border-slate-900 px-6 py-5 space-y-0.5">
        {innerBlocks.map((b, bIdx) => (
          <RenderBlock key={bIdx} block={b} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="my-1"
      style={{
        paddingLeft: block.indentLeftPx > 0 ? `${block.indentLeftPx}px` : undefined,
      }}
    >
      <table
        className="border-collapse table-fixed"
        style={{ width: `${Math.min(100, Math.max(40, block.widthPct))}%` }}
      >
        <tbody>
          {block.rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.cells.map((cell, cIdx) => {
                if (cell.hidden) return null;
                const borderStyle: React.CSSProperties = {
                  width: cell.widthPct ? `${cell.widthPct}%` : undefined,
                  borderTop: cell.borders.top ? '1px solid #1e293b' : 'none',
                  borderBottom: cell.borders.bottom ? '1px solid #1e293b' : 'none',
                  borderLeft: cell.borders.left ? '1px solid #1e293b' : 'none',
                  borderRight: cell.borders.right ? '1px solid #1e293b' : 'none',
                  verticalAlign: 'top',
                };
                const hasAnyBorder =
                  cell.borders.top ||
                  cell.borders.bottom ||
                  cell.borders.left ||
                  cell.borders.right;
                return (
                  <td
                    key={cIdx}
                    rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                    style={borderStyle}
                    className={hasAnyBorder ? 'px-2 py-1' : 'px-0.5 py-0.5'}
                  >
                    {cell.blocks.map((b, bIdx) => (
                      <RenderBlock key={bIdx} block={b} inCompactCell />
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const BphtbPreviewPanel: React.FC<BphtbPreviewPanelProps> = ({
  taxForm,
  taxResult,
  form,
  settings,
  activeDocKey,
  onSelectDocKey,
  onDownloadSingle,
  onBackToForm,
  busyKey,
}) => {
  const docList = useMemo(
    () => getBphtbDocumentList(taxForm.layanan),
    [taxForm.layanan]
  );

  const safeDocKey: BphtbDocKey = useMemo(() => {
    const exists = docList.some((d) => d.key === activeDocKey);
    return exists ? activeDocKey : docList[0].key;
  }, [docList, activeDocKey]);

  const activeMeta = useMemo(
    () => docList.find((d) => d.key === safeDocKey) ?? docList[0],
    [docList, safeDocKey]
  );

  const [preview, setPreview] = useState<DocxPreviewDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomPct, setZoomPct] = useState<85 | 100 | 115>(100);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(async () => {
      try {
        const bytes = await buildSingleBphtbDocxBytes(safeDocKey, {
          taxForm,
          taxResult,
          form,
          settings,
        });
        const parsed = parseDocxBytesToPreview(bytes, {
          docKey: '02_lampiran_bundel',
          fileName: activeMeta.fileName,
          paperSize: 'F4',
          usedCustomTemplate: false,
          context: {},
        });
        if (!cancelled) {
          setPreview(parsed);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Gagal menyusun pratinjau dokumen BPHTB.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [safeDocKey, activeMeta.fileName, taxForm, taxResult, form, settings, refreshTick]);

  const paperMaxWidthPx =
    zoomPct === 85 ? 650 : zoomPct === 115 ? 880 : 760;

  return (
    <div className="border border-teal-900/12 dark:border-teal-500/20 rounded-2xl bg-white dark:bg-[#0A2226] overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3.5 border-b border-teal-900/10 dark:border-teal-500/20 bg-[#F4FAF8] dark:bg-[#0D2B30] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Eye className="w-4.5 h-4.5 text-sky-700 dark:text-sky-300 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Review Berkas Pengajuan BPHTB (Format Resmi F4)
            </h3>
            <p className="text-xs text-slate-600 dark:text-teal-200/80 mt-0.5">
              Periksa susunan teks, nama, NIK, NOP, NPOP, dan kolom tanda tangan sebelum mengunduh atau mengajukan ke SIPAD Boyolali.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBackToForm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-900/15 dark:border-teal-500/30 bg-white dark:bg-[#081E22] hover:bg-teal-50 dark:hover:bg-teal-900/50 text-xs font-semibold text-slate-700 dark:text-teal-100 whitespace-nowrap"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Kembali Edit Formulir</span>
          </button>

          <button
            type="button"
            onClick={() => setRefreshTick((n) => n + 1)}
            title="Segarkan pratinjau"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-teal-900/15 dark:border-teal-500/30 bg-white dark:bg-[#081E22] hover:bg-teal-50 dark:hover:bg-teal-900/50 text-xs font-medium text-slate-700 dark:text-teal-100"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Zoom Controls */}
          <div className="inline-flex items-center border border-teal-900/15 dark:border-teal-500/30 rounded-lg bg-white dark:bg-[#081E22] overflow-hidden">
            <button
              type="button"
              onClick={() => setZoomPct(zoomPct === 115 ? 100 : 85)}
              disabled={zoomPct === 85}
              aria-label="Perkecil pratinjau"
              className="px-2 py-1.5 text-slate-600 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-900/50 disabled:opacity-40"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-xs font-mono tabular-nums text-slate-700 dark:text-teal-100 border-x border-teal-900/15 dark:border-teal-500/30">
              {zoomPct}%
            </span>
            <button
              type="button"
              onClick={() => setZoomPct(zoomPct === 85 ? 100 : 115)}
              disabled={zoomPct === 115}
              aria-label="Perbesar pratinjau"
              className="px-2 py-1.5 text-slate-600 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-900/50 disabled:opacity-40"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Document Tabs + Active Download */}
      <div className="px-4 py-2.5 border-b border-teal-900/10 dark:border-teal-500/20 bg-white dark:bg-[#0A2226] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div
          role="tablist"
          aria-label="Pilih berkas BPHTB untuk direview"
          className="flex flex-wrap items-center gap-1.5"
        >
          {docList.map((doc, idx) => {
            const active = doc.key === safeDocKey;
            return (
              <button
                key={doc.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectDocKey(doc.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-teal-900/6 dark:bg-[#081E22] text-slate-700 dark:text-teal-200/85 hover:bg-teal-900/12 dark:hover:bg-teal-900/50'
                }`}
              >
                <span className="font-mono text-[10px] opacity-80">0{idx + 1}</span>
                <span>{doc.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={busyKey !== null}
          onClick={() => onDownloadSingle(activeMeta.key, activeMeta.label)}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-500/35 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-900 dark:text-sky-100 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {busyKey === activeMeta.key ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>Unduh {activeMeta.shortLabel} (.DOCX)</span>
        </button>
      </div>

      {/* Paper Sheet Viewport */}
      <div className="bg-[#EAF2F0] dark:bg-[#061619] p-4 sm:p-6 max-h-[720px] overflow-y-auto overflow-x-auto space-y-5">
        {loading && (
          <div className="mx-auto bg-white border border-slate-200 rounded-md p-8 max-w-[760px] space-y-3 animate-pulse">
            <div className="h-5 w-1/2 bg-slate-200 rounded mx-auto" />
            <div className="h-3 w-full bg-slate-100 rounded" />
            <div className="h-3 w-11/12 bg-slate-100 rounded" />
            <div className="h-3 w-4/5 bg-slate-100 rounded" />
          </div>
        )}

        {error && !loading && (
          <div
            role="alert"
            className="mx-auto max-w-[760px] p-4 rounded-xl border border-rose-200 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/60 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="font-semibold">Gagal Memuat Pratinjau Berkas BPHTB</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          preview?.pages.map((page) => (
            <div
              key={page.pageNumber}
              className="mx-auto"
              style={{ maxWidth: `${paperMaxWidthPx}px` }}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-teal-200/80 mb-1.5 px-1">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-teal-100">
                  <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-300" />
                  <span>{activeMeta.label}</span>
                </span>
                <span className="font-mono tabular-nums">
                  F4 (215 × 330 mm) · Hal. {page.pageNumber} / {preview.pages.length}
                </span>
              </div>

              <div
                className="bg-white border border-slate-300 shadow-sm rounded-[2px] text-slate-900"
                style={{
                  fontFamily:
                    '"Bookman Old Style", "URW Bookman", Georgia, "Times New Roman", serif',
                  padding: '34px 42px 38px 42px',
                  minHeight: '860px',
                }}
              >
                <div className="space-y-0.5">
                  {page.blocks.map((block, bIdx) => (
                    <RenderBlock key={bIdx} block={block} />
                  ))}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
