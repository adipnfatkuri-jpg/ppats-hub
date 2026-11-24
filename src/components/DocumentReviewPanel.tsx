import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  ZoomIn,
  ZoomOut,
  Edit3,
} from 'lucide-react';
import {
  BerkasRecord,
  CustomTemplateEntry,
  OfficeSettings,
  TemplateDocKey,
} from '../types/ppats';
import {
  DocxPreviewDocument,
  PreviewBlock,
  PreviewParagraphBlock,
  PreviewTableBlock,
  renderDocxPreviewPages,
} from '../utils/docxPreviewParser';
import { isAktaService } from '../utils/taxAndAudit';
import { resolvePengesahanGanda, resolvePengesahanTunggal } from '../utils/nonAktaTemplates';

interface DocumentReviewPanelProps {
  record: BerkasRecord;
  settings: OfficeSettings;
  customTemplates: Partial<Record<TemplateDocKey, CustomTemplateEntry>>;
  activeDocKey: '01_akta' | '02_lampiran_bundel';
  onSelectDocKey: (docKey: '01_akta' | '02_lampiran_bundel') => void;
  onEditStep: (step: 2 | 3) => void;
}

const DASH_LEADER_FILL = '-'.repeat(180);

const RenderParagraph: React.FC<{ block: PreviewParagraphBlock; compact?: boolean }> = ({
  block,
  compact,
}) => {
  const hasText =
    block.runs.some((r) => r.text.trim().length > 0) ||
    Boolean(block.keyValueLabelRuns?.some((r) => r.text.trim().length > 0));
  const hasImages = Boolean(block.images && block.images.length > 0);
  const textAlign = block.align === 'justify' ? 'justify' : block.align;
  const textIndent = block.hangingPx
    ? -block.hangingPx
    : block.firstLinePx || 0;

  if (!hasText && !hasImages) {
    return <div className={compact ? 'h-1.5' : 'h-2.5'} aria-hidden="true" />;
  }

  const renderRunList = (runs: PreviewParagraphBlock['runs']) =>
    runs.map((run, rIdx) => {
      const classes = [
        run.bold ? 'font-bold' : 'font-normal',
        run.italic ? 'italic' : '',
        run.underline ? 'underline underline-offset-2' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const fontSizePx =
        !compact && run.sizePt && run.sizePt !== 12
          ? Math.round((run.sizePt / 12) * 12.5 * 10) / 10
          : undefined;
      return (
        <span
          key={rIdx}
          className={classes}
          style={fontSizePx ? { fontSize: `${fontSizePx}px`, lineHeight: 1.35 } : undefined}
        >
          {run.text}
        </span>
      );
    });

  const textBaseClass = `${compact ? 'text-[11px] leading-[1.35]' : 'text-[12.5px] leading-[1.55]'} text-slate-900`;

  return (
    <div
      style={{
        textAlign: block.dashLeader === 'center-flanked' ? 'left' : textAlign,
        paddingLeft: block.indentLeftPx > 0 ? `${block.indentLeftPx}px` : undefined,
        marginTop: block.spaceBeforePx > 0 ? `${block.spaceBeforePx}px` : undefined,
        marginBottom: block.spaceAfterPx > 0 ? `${block.spaceAfterPx}px` : undefined,
      }}
    >
      {hasImages &&
        block.images!.map((img, iIdx) => (
          <img
            key={iIdx}
            src={img.dataUrl}
            alt="Lampiran gambar dokumen"
            className="max-w-full h-auto inline-block rounded border border-slate-200 my-1"
            style={
              img.widthPx
                ? { maxWidth: `${Math.min(img.widthPx, 520)}px` }
                : undefined
            }
          />
        ))}
      {hasText && block.dashLeader === 'center-flanked' && (
        <div
          className={`flex items-center gap-1.5 w-full ${textBaseClass}`}
          data-dash-leader="center-flanked"
        >
          <span
            className={`flex-1 min-w-0 overflow-hidden whitespace-nowrap select-none ${
              block.dashBold ? 'font-bold' : 'font-normal'
            }`}
            aria-hidden="true"
          >
            {DASH_LEADER_FILL}
          </span>
          <span className="shrink-0 whitespace-nowrap">{renderRunList(block.runs)}</span>
          <span
            className={`flex-1 min-w-0 overflow-hidden whitespace-nowrap select-none ${
              block.dashBold ? 'font-bold' : 'font-normal'
            }`}
            aria-hidden="true"
          >
            {DASH_LEADER_FILL}
          </span>
        </div>
      )}
      {hasText && block.dashLeader !== 'center-flanked' && block.keyValueLabelRuns && block.keyValueTabPx && (
        <p
          className={`relative overflow-x-clip flex items-baseline ${textBaseClass}`}
          data-dash-leader="trailing-kv"
        >
          <span
            className="shrink-0 whitespace-pre"
            style={{ width: `${block.keyValueTabPx}px` }}
          >
            {renderRunList(block.keyValueLabelRuns)}
          </span>
          <span className="min-w-0 flex-1 overflow-x-clip">
            {renderRunList(block.runs)}
            {block.dashLeader === 'trailing' && (
              <span className="inline-block relative w-0 align-baseline" aria-hidden="true">
                {'\u200B'}
                <span className="absolute left-0.5 top-0 whitespace-nowrap select-none pointer-events-none font-normal">
                  {DASH_LEADER_FILL}
                </span>
              </span>
            )}
          </span>
        </p>
      )}
      {hasText && block.dashLeader !== 'center-flanked' && !(block.keyValueLabelRuns && block.keyValueTabPx) && (
        <p
          className={`relative ${block.dashLeader === 'trailing' ? 'overflow-x-clip' : ''} ${textBaseClass} whitespace-pre-line ${
            block.borderBottom ? 'border-b-2 border-slate-900 pb-1.5 mb-2' : ''
          }`}
          data-dash-leader={block.dashLeader === 'trailing' ? 'trailing' : undefined}
          style={{
            textIndent: textIndent !== 0 ? `${textIndent}px` : undefined,
          }}
        >
          {renderRunList(block.runs)}
          {block.dashLeader === 'trailing' && (
            <span className="inline-block relative w-0 align-baseline" aria-hidden="true">
              {'\u200B'}
              <span className="absolute left-0.5 top-0 whitespace-nowrap select-none pointer-events-none font-normal">
                {DASH_LEADER_FILL}
              </span>
            </span>
          )}
        </p>
      )}
    </div>
  );
};

const RenderBlock: React.FC<{ block: PreviewBlock; inTable?: boolean }> = ({
  block,
  inTable,
}) => {
  if (block.kind === 'paragraph') {
    return <RenderParagraph block={block} compact={inTable} />;
  }
  return <RenderTable block={block} />;
};

const RenderTable: React.FC<{ block: PreviewTableBlock }> = ({ block }) => {
  return (
    <div
      className="my-1.5"
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
                  borderTop: cell.borders.top ? '1px solid #334155' : 'none',
                  borderBottom: cell.borders.bottom ? '1px solid #334155' : 'none',
                  borderLeft: cell.borders.left ? '1px solid #334155' : 'none',
                  borderRight: cell.borders.right ? '1px solid #334155' : 'none',
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
                    className={hasAnyBorder ? 'px-2 py-1' : 'px-1 py-0.5'}
                  >
                    {cell.blocks.map((b, bIdx) => (
                      <RenderBlock key={bIdx} block={b} inTable />
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

export const DocumentReviewPanel: React.FC<DocumentReviewPanelProps> = ({
  record,
  settings,
  customTemplates,
  activeDocKey,
  onSelectDocKey,
  onEditStep,
}) => {
  const [preview, setPreview] = useState<DocxPreviewDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<number | 'all'>('all');
  const [zoomPct, setZoomPct] = useState<85 | 100 | 115>(100);

  useEffect(() => {
    setSelectedPage('all');
  }, [activeDocKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    renderDocxPreviewPages(record, settings, customTemplates, activeDocKey)
      .then((doc) => {
        if (!cancelled) {
          setPreview(doc);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Gagal menyusun pratinjau dokumen .DOCX.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [record, settings, customTemplates, activeDocKey]);

  const isAkta = isAktaService(record.layanan);
  const pengesahanTunggal = !isAkta ? resolvePengesahanTunggal(record, settings) : null;
  const pengesahanGanda = !isAkta ? resolvePengesahanGanda(record, settings) : null;
  const nonAktaPemohonNames = !isAkta
    ? record.para_pihak
        .filter((p) => p.peran.startsWith('Pihak '))
        .map((p) => p.nama)
        .filter(Boolean)
        .join(', ') || '-'
    : '';
  const hasDualPengesahan =
    record.layanan === 'Turun Waris' ||
    record.layanan === 'Waris C' ||
    record.layanan === 'Ralat Data' ||
    Boolean(record.non_akta?.sertakan_beda_nama);

  const visiblePages =
    preview && selectedPage !== 'all'
      ? preview.pages.filter((p) => p.pageNumber === selectedPage)
      : preview?.pages ?? [];

  const paperMaxWidthPx =
    zoomPct === 85 ? 660 : zoomPct === 115 ? 890 : 770;

  return (
    <section
      aria-label="Review Dokumen Sebelum Generate"
      className="border border-teal-900/12 dark:border-teal-500/20 rounded-2xl bg-white dark:bg-[#0A2226] overflow-hidden"
    >
      {/* Top Toolbar */}
      <div className="px-4 py-3.5 border-b border-teal-900/10 dark:border-teal-500/20 bg-[#F4FAF8] dark:bg-[#0D2B30] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Eye className="w-4.5 h-4.5 text-teal-700 dark:text-teal-300 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Review Dokumen Sebelum Generate
            </h3>
            <p className="text-xs text-slate-600 dark:text-teal-200/80 mt-0.5">
              {preview ? (
                <>
                  <span>{preview.fileName}</span>
                  <span aria-hidden="true"> · </span>
                  <span>
                    Kertas {preview.paperSize}{' '}
                    {preview.paperSize === 'A4' ? '(210 × 297 mm)' : '(215 × 330 mm)'}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span className="tabular-nums">{preview.pages.length} bagian halaman</span>
                </>
              ) : (
                <span>Memeriksa isi dokumen .DOCX aktual sesuai data berkas...</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Switcher Akta A4 vs Lampiran F4 */}
          <div
            role="tablist"
            aria-label="Pilih dokumen untuk direview"
            className="inline-flex items-center p-1 bg-teal-900/8 dark:bg-[#071A1D] border border-teal-900/10 dark:border-teal-500/20 rounded-xl"
          >
            {isAkta && (
              <button
                type="button"
                role="tab"
                aria-selected={activeDocKey === '01_akta'}
                onClick={() => onSelectDocKey('01_akta')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  activeDocKey === '01_akta'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-teal-200/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                01. Blangko Akta (A4)
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={!isAkta || activeDocKey === '02_lampiran_bundel'}
              onClick={() => onSelectDocKey('02_lampiran_bundel')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                !isAkta || activeDocKey === '02_lampiran_bundel'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-teal-200/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isAkta ? '02. Lampiran Bundel (F4)' : 'Bundel Lampiran Non-Akta (F4)'}
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="inline-flex items-center border border-teal-900/12 dark:border-teal-500/25 rounded-lg bg-white dark:bg-[#081E22] overflow-hidden">
            <button
              type="button"
              onClick={() => setZoomPct(zoomPct === 115 ? 100 : 85)}
              disabled={zoomPct === 85}
              aria-label="Perkecil pratinjau"
              className="px-2 py-1.5 text-slate-600 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-900/50 disabled:opacity-40"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-xs font-mono tabular-nums text-slate-700 dark:text-teal-100 border-x border-teal-900/12 dark:border-teal-500/25">
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

      {/* Verification Strip (Resolved Roles & Leftover Tag Check) */}
      {preview && (
        <div className="px-4 py-2.5 border-b border-teal-900/10 dark:border-teal-500/20 bg-white dark:bg-[#0A2226] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-700 dark:text-teal-100/85">
            <span
              className={`inline-flex items-center gap-1.5 font-semibold ${
                preview.summary.leftoverTags.length === 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              {preview.summary.leftoverTags.length === 0 ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              )}
              {preview.summary.leftoverTags.length === 0
                ? 'Seluruh variabel dokumen terisi'
                : `${preview.summary.leftoverTags.length} tag belum terisi (${preview.summary.leftoverTags.join(', ')})`}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-teal-700">|</span>
            {isAkta ? (
              <>
                <span>
                  <strong className="text-slate-900 dark:text-white">{preview.summary.ketPihak1Label}:</strong>{' '}
                  {preview.summary.ketPihak1Names}
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-teal-700">·</span>
                <span>
                  <strong className="text-slate-900 dark:text-white">{preview.summary.ketPihak2Label}:</strong>{' '}
                  {preview.summary.ketPihak2Names}
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-teal-700">·</span>
                <span>
                  <strong className="text-slate-900 dark:text-white">TTD Kuasa/Permohonan/BPHTB/Fisik/Keabsahan:</strong>{' '}
                  {preview.summary.penerimaNama}
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-teal-700">·</span>
                <span>
                  <strong className="text-slate-900 dark:text-white">TTD SPPT/PBB:</strong>{' '}
                  {preview.summary.pemilikAwalNama}
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-teal-700">·</span>
                <span className="tabular-nums">
                  <strong className="text-slate-900 dark:text-white">TTD Data Pribadi:</strong>{' '}
                  {preview.summary.dataPribadiSignersCount} pihak (tanpa pasangan)
                </span>
              </>
            ) : (
              <>
                <span>
                  <strong className="text-slate-900 dark:text-white">Berkas Non-Akta:</strong>{' '}
                  {record.layanan} (F4 Only · Non-Laporan Bulanan)
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-teal-700">·</span>
                <span>
                  <strong className="text-slate-900 dark:text-white">
                    {record.layanan === 'Turun Waris' || record.layanan === 'Waris C'
                      ? 'Ahli Waris / Pemohon:'
                      : 'Pemohon:'}
                  </strong>{' '}
                  {nonAktaPemohonNames}
                </span>
                {pengesahanTunggal && (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-teal-700">·</span>
                    <span>
                      <strong className="text-slate-900 dark:text-white">Pengesahan Lainnya:</strong>{' '}
                      {pengesahanTunggal.jabatanLines.join(' ')} ({pengesahanTunggal.nama})
                    </span>
                  </>
                )}
                {hasDualPengesahan && pengesahanGanda && (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-teal-700">·</span>
                    <span>
                      <strong className="text-slate-900 dark:text-white">Pengesahan SKW/Beda Nama:</strong>{' '}
                      {pengesahanGanda.camatJabatan} &amp; {pengesahanGanda.kadesJabatan}
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onEditStep(2)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-teal-900/15 dark:border-teal-500/30 bg-white dark:bg-[#0D2B30] hover:bg-teal-50 dark:hover:bg-teal-900/50 text-xs font-medium text-slate-700 dark:text-teal-100 whitespace-nowrap"
            >
              <Edit3 className="w-3 h-3" />
              <span>Revisi Pihak/Tanah</span>
            </button>
            <button
              type="button"
              onClick={() => onEditStep(3)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-teal-900/15 dark:border-teal-500/30 bg-white dark:bg-[#0D2B30] hover:bg-teal-50 dark:hover:bg-teal-900/50 text-xs font-medium text-slate-700 dark:text-teal-100 whitespace-nowrap"
            >
              <Edit3 className="w-3 h-3" />
              <span>{isAkta ? 'Ubah Parameter Akta' : 'Pengesahan & Parameter'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Page Navigation Bar */}
      {preview && preview.pages.length > 1 && (
        <div className="px-4 py-2 border-b border-teal-900/10 dark:border-teal-500/20 bg-[#F4FAF8] dark:bg-[#092024] flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedPage('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              selectedPage === 'all'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-teal-200/80 hover:bg-teal-900/10 dark:hover:bg-teal-900/50'
            }`}
          >
            Semua Bagian ({preview.pages.length})
          </button>
          {preview.pages.map((p) => (
            <button
              key={p.pageNumber}
              type="button"
              onClick={() => setSelectedPage(p.pageNumber)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                selectedPage === p.pageNumber
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-teal-200/80 hover:bg-teal-900/10 dark:hover:bg-teal-900/50'
              }`}
            >
              {p.title}
            </button>
          ))}
        </div>
      )}

      {/* Paper Viewport */}
      <div className="bg-[#EAF2F0] dark:bg-[#061619] p-4 sm:p-6 max-h-[680px] overflow-y-auto overflow-x-auto space-y-6">
        {loading && (
          <div className="mx-auto bg-white border border-slate-200 rounded-md p-8 max-w-[770px] space-y-3 animate-pulse">
            <div className="h-5 w-1/2 bg-slate-200 rounded mx-auto" />
            <div className="h-3 w-full bg-slate-100 rounded" />
            <div className="h-3 w-11/12 bg-slate-100 rounded" />
            <div className="h-3 w-4/5 bg-slate-100 rounded" />
          </div>
        )}

        {error && !loading && (
          <div
            role="alert"
            className="mx-auto max-w-[770px] p-4 rounded-xl border border-rose-200 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/60 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="font-semibold">Gagal Memuat Review Dokumen</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          visiblePages.map((page) => (
            <div key={page.pageNumber} className="mx-auto" style={{ maxWidth: `${paperMaxWidthPx}px` }}>
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-teal-200/80 mb-1.5 px-1">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-teal-100">
                  <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-300" />
                  <span>{page.title}</span>
                </span>
                <span className="font-mono tabular-nums">
                  {preview?.paperSize} · Bagian {page.pageNumber} / {preview?.pages.length}
                </span>
              </div>

              <div
                className="bg-white border border-slate-300 shadow-sm rounded-[2px] text-slate-900"
                style={{
                  fontFamily: '"Bookman Old Style", "URW Bookman", Georgia, "Times New Roman", serif',
                  padding:
                    preview?.paperSize === 'A4'
                      ? '38px 26px 36px 64px'
                      : '34px 44px 32px 44px',
                }}
              >
                <div className="space-y-0.5">
                  {page.blocks.map((block, bIdx) => (
                    <RenderBlock key={bIdx} block={block} />
                  ))}
                </div>

                {preview && preview.footerLines.length > 0 && (
                  <div className="mt-8 pt-2 border-t border-slate-800 text-[11px] text-slate-800 space-y-0.5">
                    {preview.footerLines.map((line, idx) => (
                      <p key={idx} className={idx === 1 ? 'font-bold italic' : ''}>
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
};
