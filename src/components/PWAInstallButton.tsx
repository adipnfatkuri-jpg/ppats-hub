import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  Download,
  MonitorDown,
  PlusSquare,
  RefreshCw,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

declare const __APP_BUILD_TIMESTAMP__: string;

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'mobile-header' | 'header-download' | 'menu-item' | 'settings-button';
  onActionTriggered?: () => void;
}

function getBuildVersionParam(): string {
  return typeof __APP_BUILD_TIMESTAMP__ === 'string' && __APP_BUILD_TIMESTAMP__
    ? __APP_BUILD_TIMESTAMP__
    : Date.now().toString();
}

function buildDesktopUrlShortcut(appUrl: string): string {
  return `[InternetShortcut]\r\nURL=${appUrl}\r\nIconIndex=0\r\n`;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'sidebar',
  onActionTriggered,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
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

  const getAppUrl = (withCacheBust = false) => {
    if (typeof window === 'undefined') return '';
    return withCacheBust
      ? `${window.location.origin}/?shortcut=desktop&v=${getBuildVersionParam()}`
      : `${window.location.origin}/`;
  };

  const handleDownloadDesktopShortcut = () => {
    const appUrl = getAppUrl(true);
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
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // Lanjutkan muat ulang meski API cache dibatasi
    }
    const targetUrl = `${window.location.origin}/?v=${Date.now()}`;
    window.location.replace(targetUrl);
  };

  const handleCopyAppLink = async () => {
    const appUrl = getAppUrl(false);
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback: ignore if clipboard API blocked
    }
  };

  const handlePrimaryClick = () => {
    onActionTriggered?.();
    if (isInstallable) {
      void install();
      return;
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
          onClick={handlePrimaryClick}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 text-left text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#F3E5C8] dark:hover:bg-[#163450] rounded-md transition-colors"
        >
          {isIOS ? (
            <Smartphone className="w-3.5 h-3.5 text-[#6B4423] dark:text-[#F4C430] shrink-0" />
          ) : (
            <MonitorDown className="w-3.5 h-3.5 text-[#6B4423] dark:text-[#F4C430] shrink-0" />
          )}
          <span>
            {isInstallable
              ? 'Download / Install PWA'
              : isIOS
                ? 'Install PWA di iPhone / iPad'
                : 'Download PWA & Shortcut'}
          </span>
        </button>
      );
    }

    if (variant === 'settings-button') {
      return (
        <button
          type="button"
          onClick={handlePrimaryClick}
          className="btn-3d btn-3d-light min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold whitespace-nowrap"
        >
          {isIOS ? (
            <Smartphone className="w-3.5 h-3.5 text-[#6B4423] dark:text-[#F4C430] shrink-0" />
          ) : (
            <Download className="w-3.5 h-3.5 text-[#6B4423] dark:text-[#F4C430] shrink-0" />
          )}
          <span>
            {isInstallable
              ? 'Download / Install PWA'
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
          onClick={handlePrimaryClick}
          aria-label="Download dan Install aplikasi PWA SIM-PPATS"
          className="inline-flex items-center justify-center gap-1 sm:gap-1.5 h-9 px-2.5 sm:px-3.5 rounded-full border border-[#C89B3C]/90 bg-[#0B1F3A]/92 dark:bg-[#143054]/92 hover:bg-[#142F52] dark:hover:bg-[#1B3E6B] text-[#F4C430] text-[11px] sm:text-xs font-bold shadow-[0_2px_10px_rgba(11,31,58,0.22)] whitespace-nowrap transition-colors shrink-0"
          title="Download / Install Aplikasi PWA & Shortcut Desktop"
        >
          <Download className="w-3.5 h-3.5 text-[#F4C430] shrink-0" />
          <span className="hidden sm:inline">Download PWA</span>
          <span className="sm:hidden">PWA</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handlePrimaryClick}
        className="btn-3d btn-3d-sidebar w-full flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-xs font-semibold"
        title="Pasang SIM-PPATS sebagai aplikasi mandiri & shortcut di desktop/ponsel"
      >
        {isIOS ? (
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Download className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>
          {isInstallable
            ? 'Download / Install PWA'
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
                    src="/apple-touch-icon.png"
                    alt="Ikon SIM-PPATS"
                    className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Install SIM-PPATS di iOS
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tambahkan ke Layar Utama iPhone / iPad
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Tutup panduan install iOS"
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
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
                      className="font-cinzel text-base font-extrabold text-[#0B1F3A] dark:text-[#F4C430]"
                    >
                      Download PWA &amp; Shortcut
                    </h3>
                    <p className="text-xs text-[#5C452B] dark:text-slate-300">
                      Pasang SIM-PPATS di layar utama HP atau Desktop Laptop
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDesktopGuide(false)}
                  aria-label="Tutup panduan shortcut dan PWA"
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Opsi 1: Install Aplikasi PWA di HP Android & Laptop Chrome/Edge */}
              <div className="rounded-xl border border-[#C8B294] dark:border-[#264869] bg-[#FFFDF9] dark:bg-[#0E2236] p-3.5 space-y-2">
                <p className="text-xs font-bold text-[#0B1F3A] dark:text-[#F4C430]">
                  Cara 1 — Install Aplikasi PWA (HP Android &amp; Desktop)
                </p>
                <ol className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200 list-decimal list-inside leading-relaxed">
                  <li>
                    Buka link aplikasi langsung di tab <strong>Google Chrome</strong> atau{' '}
                    <strong>Microsoft Edge</strong> (bukan di dalam preview).
                  </li>
                  <li>
                    <strong>Di HP Android:</strong> Ketuk menu titik tiga (<span className="font-mono">⋮</span>) di pojok kanan atas → pilih <strong>Instal aplikasi / Tambahkan ke Layar Utama</strong>.
                  </li>
                  <li>
                    <strong>Di Laptop / PC:</strong> Klik ikon <strong>Install</strong> di ujung kanan kolom alamat, atau menu (<span className="font-mono">⋮</span>) → <strong>Simpan &amp; Bagikan</strong> → <strong>Instal SIM-PPATS</strong>.
                  </li>
                </ol>
              </div>

              {/* Opsi 2: Unduh File Shortcut Desktop (.url) untuk Windows */}
              <div className="rounded-xl border border-[#C8B294] dark:border-[#264869] bg-[#FFFDF9] dark:bg-[#0E2236] p-3.5 space-y-2.5">
                <div>
                  <p className="text-xs font-bold text-[#0B1F3A] dark:text-[#F4C430]">
                    Cara 2 — Unduh File Shortcut Desktop Windows (.url)
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Unduh file <span className="font-mono font-semibold">SIM-PPATS.url</span> lalu pindahkan ke Desktop laptop Anda untuk membuka dalam 1 klik ganda.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadDesktopShortcut}
                    className="btn-3d btn-3d-teal min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold"
                  >
                    {downloadedShortcut ? (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Download className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>
                      {downloadedShortcut
                        ? 'SIM-PPATS.url Diunduh'
                        : 'Unduh Shortcut (.url)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyAppLink()}
                    className="btn-3d btn-3d-light min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold"
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{copiedLink ? 'Link Tersalin' : 'Salin Link Aplikasi'}</span>
                  </button>
                </div>
              </div>

              {/* Opsi 3: Bersihkan Cache PWA & Muat Versi Terbaru */}
              <div className="rounded-xl border border-amber-300/80 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-950/30 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Shortcut Masih Versi Lama?
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Bersihkan cache PWA lama lalu muat versi terbaru.
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
