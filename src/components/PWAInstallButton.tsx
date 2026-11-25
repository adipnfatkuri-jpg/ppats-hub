import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  MonitorDown,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'mobile-header' | 'menu-item' | 'settings-button';
  onActionTriggered?: () => void;
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

  const handlePrimaryClick = () => {
    if (isInstallable) {
      onActionTriggered?.();
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
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors"
        >
          {isIOS ? (
            <Smartphone className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          ) : (
            <MonitorDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          )}
          <span>
            {isInstallable
              ? 'Install Aplikasi SIM-PPATS'
              : isIOS
                ? 'Install di iPhone / iPad'
                : 'Buat Shortcut Desktop'}
          </span>
        </button>
      );
    }

    if (variant === 'settings-button') {
      return (
        <button
          type="button"
          onClick={handlePrimaryClick}
          className="btn-3d btn-3d-light inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold whitespace-nowrap"
        >
          {isIOS ? (
            <Smartphone className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          ) : (
            <MonitorDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          )}
          <span>
            {isInstallable
              ? 'Install Aplikasi SIM-PPATS'
              : isIOS
                ? 'Panduan Install iOS'
                : 'Buat Shortcut Desktop'}
          </span>
        </button>
      );
    }

    if (variant === 'mobile-header') {
      return (
        <button
          type="button"
          onClick={handlePrimaryClick}
          aria-label={
            isInstallable
              ? 'Install aplikasi SIM-PPATS'
              : isIOS
                ? 'Install SIM-PPATS di iPhone atau iPad'
                : 'Buat shortcut aplikasi SIM-PPATS'
          }
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium whitespace-nowrap transition-colors"
          title="Install / Shortcut aplikasi SIM-PPATS"
        >
          {isInstallable ? (
            <Download className="w-3.5 h-3.5 shrink-0" />
          ) : isIOS ? (
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <MonitorDown className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="hidden sm:inline">
            {isInstallable ? 'Install' : isIOS ? 'Install iOS' : 'Shortcut'}
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handlePrimaryClick}
        className="btn-3d btn-3d-sidebar w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold"
        title="Pasang SIM-PPATS sebagai aplikasi mandiri & shortcut di desktop/ponsel"
      >
        {isIOS ? (
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <MonitorDown className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>
          {isInstallable
            ? 'Install Aplikasi SIM-PPATS'
            : isIOS
              ? 'Install di iPhone / iPad'
              : 'Buat Shortcut Desktop'}
        </span>
      </button>
    );
  };

  return (
    <>
      {renderTrigger()}

      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="bento-card w-full max-w-sm p-5 text-slate-800 dark:text-slate-100 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
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
              className="btn-3d btn-3d-teal mt-5 w-full py-2.5 text-sm font-semibold"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {showDesktopGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="desktop-shortcut-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => setShowDesktopGuide(false)}
        >
          <div
            className="bento-card w-full max-w-md p-5 text-slate-800 dark:text-slate-100 space-y-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="Ikon SIM-PPATS"
                  className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div>
                  <h3
                    id="desktop-shortcut-title"
                    className="font-display text-base font-bold text-slate-900 dark:text-white"
                  >
                    Shortcut Aplikasi di Desktop Laptop
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Buka SIM-PPATS langsung dari desktop tanpa mengetik alamat browser
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDesktopGuide(false)}
                aria-label="Tutup panduan shortcut desktop"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Opsi 1: Mode Aplikasi Mandiri (PWA) */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-3.5 space-y-2">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Cara 1 (Disarankan — Jendela Mandiri Tanpa Bilah Browser)
              </p>
              <ol className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside">
                <li>
                  Buka aplikasi ini di tab penuh <strong>Google Chrome</strong> atau{' '}
                  <strong>Microsoft Edge</strong>.
                </li>
                <li>
                  Klik ikon <strong>Install / Pasang SIM-PPATS</strong> di ujung kanan kolom alamat,
                  atau klik menu titik tiga (<span className="font-mono">⋮</span>) →{' '}
                  <strong>Simpan &amp; Bagikan / Aplikasi</strong> →{' '}
                  <strong>Instal SIM-PPATS</strong> (atau <em>Buat pintasan → Buka sebagai jendela</em>).
                </li>
                <li>
                  Ikon <strong>SIM-PPATS</strong> otomatis muncul di Desktop &amp; Start Menu dan terbuka
                  langsung seperti aplikasi desktop mandiri.
                </li>
              </ol>
            </div>

            {/* Opsi 2: Unduh File Shortcut Desktop (.url) untuk Windows */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-2.5">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Cara 2 (Cepat — Unduh File Pintasan Desktop Windows)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Unduh file <span className="font-mono font-semibold">SIM-PPATS.url</span> lalu pindahkan ke Desktop laptop Anda untuk membuka aplikasi dalam 1 klik ganda.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadDesktopShortcut}
                  className="btn-3d btn-3d-teal flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold"
                >
                  {downloadedShortcut ? (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Download className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>
                    {downloadedShortcut
                      ? 'SIM-PPATS.url Diunduh'
                      : 'Unduh Shortcut Desktop (.url)'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyAppLink()}
                  className="btn-3d btn-3d-light inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold"
                >
                  {copiedLink ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{copiedLink ? 'Tersalin' : 'Salin Link'}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowDesktopGuide(false)}
              className="btn-3d btn-3d-light w-full py-2 text-xs font-semibold"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
};
