import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  MonitorDown,
  PlusSquare,
  RefreshCw,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'mobile-header' | 'header-download' | 'menu-item' | 'settings-button';
  onActionTriggered?: () => void;
}

function buildDesktopUrlShortcut(appUrl: string): string {
  return `[InternetShortcut]\r\nURL=${appUrl}\r\nIconIndex=0\r\n`;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'sidebar',
  onActionTriggered,
}) => {
  const {
    isInstallable,
    isInstalled,
    isAlreadyInstalledRelated,
    isIOS,
    isAndroid,
    isInIframe,
    isInstalling,
    install,
  } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showDesktopGuide, setShowDesktopGuide] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadedShortcut, setDownloadedShortcut] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);

  useEffect(() => {
    if (!showIOSGuide && !showDesktopGuide) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowIOSGuide(false);
        setShowDesktopGuide(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showIOSGuide, showDesktopGuide]);

  if (isInstalled) {
    return null;
  }

  const getAppUrl = () => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/`;
  };

  const handleDownloadDesktopShortcut = () => {
    const appUrl = getAppUrl();
    if (!appUrl) return;
    const content = buildDesktopUrlShortcut(appUrl);
    const blob = new Blob([content], { type: 'application/internet-shortcut;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'SIM-PPATS.url';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    setDownloadedShortcut(true);
    window.setTimeout(() => setDownloadedShortcut(false), 3500);
  };

  const handleForceRefreshPwa = async () => {
    setRefreshingCache(true);
    try {
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
      }
    } catch {
      // Lanjutkan muat ulang meski API cache dibatasi
    }
    window.location.replace(`${window.location.origin}/`);
  };

  const handleCopyAppLink = async () => {
    const appUrl = getAppUrl();
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback: ignore if clipboard API blocked
    }
  };

  const handlePrimaryClick = async () => {
    onActionTriggered?.();
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        setShowDesktopGuide(false);
        return;
      }
      if (outcome === 'dismissed') {
        return;
      }
    }
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    setShowDesktopGuide(true);
  };

  const renderTrigger = () => {
    if (variant === 'menu-item') {
      return (
        <button
          type="button"
          role="menuitem"
          onClick={() => void handlePrimaryClick()}
          disabled={isInstalling}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 sm:py-2 min-h-[40px] sm:min-h-0 text-left text-xs font-semibold text-[#F8FAFC] hover:bg-white/[0.08] hover:text-[#FACC15] rounded-lg transition-colors disabled:opacity-60"
        >
          {isIOS ? (
            <Smartphone className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
          ) : isInstallable ? (
            <Download className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
          ) : (
            <MonitorDown className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
          )}
          <span className="flex-1">
            {isInstalling
              ? 'Menginstal Aplikasi...'
              : isInstallable
                ? 'Install Aplikasi Langsung'
                : isIOS
                  ? 'Install PWA di iPhone / iPad'
                  : 'Download PWA & Shortcut'}
          </span>
          {isInstallable && (
            <span className="w-2 h-2 rounded-full bg-[#FACC15] animate-pulse shrink-0" />
          )}
        </button>
      );
    }

    if (variant === 'settings-button') {
      return (
        <button
          type="button"
          onClick={() => void handlePrimaryClick()}
          disabled={isInstalling}
          className={`${
            isInstallable ? 'btn-3d btn-3d-teal' : 'btn-3d btn-3d-light'
          } min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold whitespace-nowrap disabled:opacity-60`}
        >
          {isIOS ? (
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Download className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>
            {isInstalling
              ? 'Menginstal...'
              : isInstallable
                ? 'Install Aplikasi Sekarang'
                : isIOS
                  ? 'Panduan Install iOS'
                  : 'Download PWA & Shortcut'}
          </span>
        </button>
      );
    }

    if (variant === 'header-download' || variant === 'mobile-header') {
      return (
        <button
          type="button"
          onClick={() => void handlePrimaryClick()}
          disabled={isInstalling}
          aria-label={
            isInstallable
              ? 'Install aplikasi SIM-PPATS langsung ke perangkat'
              : 'Download dan Install aplikasi PWA SIM-PPATS'
          }
          className="relative inline-flex items-center justify-center gap-1 sm:gap-1.5 h-[30px] sm:h-8 px-2.5 sm:px-3 rounded-[7px] sm:rounded-full bg-[#252A34] hover:bg-[#2F3643] text-[#F8FAFC] hover:text-[#FACC15] border border-white/[0.12] hover:border-[#FACC15]/45 text-[11.5px] sm:text-xs font-semibold whitespace-nowrap transition-all active:scale-95 shrink-0 disabled:opacity-60"
          title={
            isInstallable
              ? 'Klik untuk langsung menginstal aplikasi SIM-PPATS ke HP / Desktop'
              : 'Download / Install Aplikasi PWA & Shortcut Desktop'
          }
        >
          <Download className="w-[13px] h-[13px] shrink-0 text-[#FACC15] stroke-[2.2]" />
          <span className="hidden sm:inline">
            {isInstalling ? 'Menginstal...' : isInstallable ? 'Install Aplikasi' : 'Download PWA'}
          </span>
          <span className="sm:hidden">
            {isInstalling ? '...' : isInstallable ? 'Install' : 'PWA'}
          </span>
          {isInstallable && (
            <span
              aria-hidden="true"
              className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-[#FACC15] animate-ping shrink-0"
            />
          )}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => void handlePrimaryClick()}
        disabled={isInstalling}
        className="btn-3d btn-3d-sidebar w-full flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-xs font-semibold disabled:opacity-60"
        title="Pasang SIM-PPATS sebagai aplikasi mandiri & shortcut di desktop/ponsel"
      >
        {isIOS ? (
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Download className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>
          {isInstalling
            ? 'Menginstal...'
            : isInstallable
              ? 'Install Aplikasi Langsung'
              : isIOS
                ? 'Install di iPhone / iPad'
                : 'Download PWA & Shortcut'}
        </span>
      </button>
    );
  };

  const iosModal =
    showIOSGuide && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-[2px] p-0 sm:p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="bento-card w-full sm:max-w-sm rounded-t-3xl sm:rounded-xl p-5 pb-safe text-slate-800 dark:text-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sm:hidden w-10 h-1.5 bg-[#C8B294] dark:bg-slate-600 rounded-full mx-auto mb-3" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/pwa-192x192.png"
                    alt="Ikon SIM-PPATS"
                    className="w-10 h-10 rounded-lg border border-[#C89B3C]/60"
                  />
                  <div>
                    <h3 className="text-base font-extrabold text-[#111827] dark:text-[#FACC15]">
                      Install SIM-PPATS
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Panduan iPhone &amp; iPad (Safari)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Tutup panduan instalasi"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <ol className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Ketuk ikon{' '}
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                      <Share className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B]" />
                      Bagikan (Share)
                    </span>{' '}
                    di bilah menu Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Gulir ke bawah lalu pilih{' '}
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                      <PlusSquare className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B]" />
                      Tambahkan ke Layar Utama
                    </span>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Ketuk <strong className="text-slate-900 dark:text-white">Tambah</strong> di pojok kanan atas
                    untuk menyelesaikan instalasi.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="btn-3d btn-3d-teal mt-5 w-full min-h-[44px] py-2.5 text-sm font-semibold"
              >
                Mengerti
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  const desktopModal =
    showDesktopGuide && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="desktop-shortcut-title"
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-[2px] p-0 sm:p-4"
            onClick={() => setShowDesktopGuide(false)}
          >
            <div
              className="bento-card w-full sm:max-w-md rounded-t-3xl sm:rounded-xl p-5 pb-safe text-slate-800 dark:text-slate-100 space-y-3.5 shadow-2xl max-h-[88vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sm:hidden w-10 h-1.5 bg-[#C8B294] dark:bg-slate-600 rounded-full mx-auto -mt-1 mb-1" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/pwa-192x192.png"
                    alt="Ikon SIM-PPATS"
                    className="w-10 h-10 rounded-lg border border-[#C89B3C]/60 shrink-0"
                  />
                  <div>
                    <h3
                      id="desktop-shortcut-title"
                      className="text-base font-extrabold text-[#111827] dark:text-[#FACC15]"
                    >
                      Download &amp; Install Aplikasi
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Pasang SIM-PPATS di Layar Utama HP atau Desktop
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDesktopGuide(false)}
                  aria-label="Tutup"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Jika browser siap install langsung saat modal terbuka */}
              {isInstallable && (
                <div className="rounded-xl border-2 border-emerald-500/80 bg-emerald-50/90 dark:bg-emerald-950/40 p-3.5 space-y-2.5">
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Siap Install Otomatis (1 Klik)
                  </p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    Browser Anda siap mengunduh &amp; memasang SIM-PPATS langsung ke perangkat.
                  </p>
                  <button
                    type="button"
                    disabled={isInstalling}
                    onClick={async () => {
                      const res = await install();
                      if (res === 'accepted') setShowDesktopGuide(false);
                    }}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-md transition-colors disabled:opacity-60"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isInstalling ? 'Menginstal...' : 'Install Aplikasi Sekarang'}</span>
                  </button>
                </div>
              )}

              {/* Jika aplikasi sudah terpasang di HP Android */}
              {!isInstallable && isAlreadyInstalledRelated && (
                <div className="rounded-xl border border-emerald-400/70 bg-emerald-50/80 dark:bg-emerald-950/35 p-3.5 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    <p className="font-bold">SIM-PPATS Sudah Terpasang</p>
                    <p className="mt-0.5 opacity-90">
                      Aplikasi sudah ada di Layar Utama / daftar aplikasi perangkat Anda. Buka langsung dari ikon SIM-PPATS, atau hapus versi lama terlebih dahulu jika ingin menginstal ulang.
                    </p>
                  </div>
                </div>
              )}

              {/* Jika dibuka di dalam iframe / preview */}
              {!isInstallable && isInIframe && (
                <div className="rounded-xl border border-amber-400/80 bg-amber-50/85 dark:bg-amber-950/35 p-3.5 space-y-2.5">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Buka Langsung di Browser untuk Install 1 Klik
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Instalasi otomatis diblokir saat aplikasi dibuka di dalam jendela preview. Salin link berikut lalu buka langsung di tab Google Chrome atau Edge.
                  </p>
                  <a
                    href={getAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-3d btn-3d-teal w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka Tab Baru untuk Install</span>
                  </a>
                </div>
              )}

              {/* Opsi 1: Install PWA di Android Chrome / Desktop */}
              {!isInstallable && !isInIframe && (
                <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.04] p-3.5 space-y-2">
                  <p className="text-xs font-bold text-[#0E1014] dark:text-[#FACC15]">
                    {isAndroid
                      ? 'Cara Install di HP Android (Chrome)'
                      : 'Cara Install Aplikasi PWA (Chrome / Edge)'}
                  </p>
                  <ol className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    {isAndroid ? (
                      <>
                        <li>
                          1. Ketuk menu titik tiga (<strong className="text-slate-900 dark:text-white">⋮</strong>) di pojok kanan atas Chrome.
                        </li>
                        <li>
                          2. Pilih{' '}
                          <strong className="text-slate-900 dark:text-white">
                            Tambahkan ke layar utama → Instal aplikasi
                          </strong>.
                        </li>
                        <li className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                          Catatan: Jika tombol install langsung belum muncul, biasanya karena aplikasi sudah terpasang atau popup sempat ditutup sebelumnya.
                        </li>
                      </>
                    ) : (
                      <>
                        <li>
                          1. Di <strong className="text-slate-900 dark:text-white">HP Android</strong>: Ketuk menu titik tiga (<strong>⋮</strong>) → pilih{' '}
                          <strong className="text-slate-900 dark:text-white">
                            Instal aplikasi / Tambahkan ke Layar Utama
                          </strong>.
                        </li>
                        <li>
                          2. Di <strong className="text-slate-900 dark:text-white">Laptop / PC</strong>: Klik ikon{' '}
                          <strong className="text-slate-900 dark:text-white">Install</strong> di ujung kanan kolom alamat, atau menu (<strong>⋮</strong>) →{' '}
                          <strong className="text-slate-900 dark:text-white">Simpan &amp; Bagikan → Instal SIM-PPATS</strong>.
                        </li>
                      </>
                    )}
                  </ol>
                </div>
              )}

              {/* Opsi 2: Unduh File Shortcut Desktop (.url) */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.04] p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-[#0E1014] dark:text-[#FACC15]">
                  Shortcut Desktop Windows (.url) &amp; Link
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Unduh file <code className="font-mono text-[11px]">SIM-PPATS.url</code> untuk dipasang di Desktop komputer/laptop.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadDesktopShortcut}
                    className="btn-3d btn-3d-teal w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold"
                  >
                    {downloadedShortcut ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>
                      {downloadedShortcut ? 'SIM-PPATS.url Terunduh!' : 'Unduh Shortcut (.url)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyAppLink()}
                    className="btn-3d btn-3d-light w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Link Tersalin' : 'Salin Link Aplikasi'}</span>
                  </button>
                </div>
              </div>

              {/* Opsi 3: Bersihkan Cache PWA & Muat Versi Terbaru */}
              <div className="rounded-xl border border-amber-300/80 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-950/30 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Perbarui Versi PWA
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Segarkan cache agar prompt instalasi &amp; fitur terbaru aktif.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={refreshingCache}
                  onClick={() => void handleForceRefreshPwa()}
                  className="btn-3d btn-3d-light min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold shrink-0 disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingCache ? 'animate-spin' : ''}`} />
                  <span>{refreshingCache ? 'Memuat...' : 'Perbarui'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowDesktopGuide(false)}
                className="btn-3d btn-3d-light w-full min-h-[44px] py-2 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {renderTrigger()}
      {iosModal}
      {desktopModal}
    </>
  );
};

/**
 * Floating 1-tap PWA Install Banner.
 * Muncul otomatis HANYA saat browser (Chrome Android / Desktop / Edge) melaporkan
 * `beforeinstallprompt` siap untuk instalasi langsung 1 klik.
 */
export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isInstalling, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || !isInstallable || dismissed) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Pasang Aplikasi SIM-PPATS"
      className="no-print fixed left-3 right-3 sm:left-auto sm:right-5 bottom-[70px] lg:bottom-5 z-40 sm:max-w-sm rounded-2xl border border-[#FACC15]/45 bg-[#171A21]/96 backdrop-blur-md text-white shadow-[0_12px_32px_rgba(0,0,0,0.65)] p-3 flex items-center gap-3"
    >
      <img
        src="/pwa-192x192.png"
        alt="SIM-PPATS"
        className="w-10 h-10 rounded-xl border border-white/10 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold text-[#FACC15] truncate">
          Install SIM-PPATS
        </p>
        <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
          Pasang langsung ke HP / Desktop untuk akses cepat &amp; offline.
        </p>
      </div>
      <button
        type="button"
        disabled={isInstalling}
        onClick={() => void install()}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#FACC15] hover:brightness-105 active:scale-95 text-[#0E1014] text-xs font-extrabold whitespace-nowrap shadow-[0_2px_12px_rgba(250,204,21,0.3)] transition-all shrink-0 disabled:opacity-60"
      >
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>{isInstalling ? '...' : 'Install'}</span>
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Tutup banner instalasi"
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
