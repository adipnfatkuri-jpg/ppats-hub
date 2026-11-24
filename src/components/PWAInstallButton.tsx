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
  variant?: 'sidebar' | 'mobile-header';
}

function buildDesktopUrlShortcut(appUrl: string): string {
  return `[InternetShortcut]\r\nURL=${appUrl}\r\nIconIndex=0\r\n`;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'sidebar',
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

  if (isInstallable) {
    if (variant === 'mobile-header') {
      return (
        <button
          type="button"
          onClick={() => void install()}
          aria-label="Install aplikasi SIM-PPATS"
          className="btn-3d btn-3d-amber inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
          title="Install SIM-PPATS ke layar utama / desktop"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Install</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => void install()}
        className="btn-3d btn-3d-amber w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
        title="Pasang SIM-PPATS sebagai aplikasi mandiri & shortcut di desktop/ponsel"
      >
        <MonitorDown className="w-3.5 h-3.5 shrink-0" />
        <span>Install Aplikasi SIM-PPATS</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        {variant === 'mobile-header' ? (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            aria-label="Install SIM-PPATS di iPhone atau iPad"
            className="btn-3d btn-3d-sidebar inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-amber-300 text-xs font-medium whitespace-nowrap"
            title="Cara install SIM-PPATS di iPhone/iPad"
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Install iOS</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="btn-3d btn-3d-sidebar w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-amber-300 text-xs font-semibold"
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span>Install di iPhone / iPad</span>
          </button>
        )}

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="bento-card w-full max-w-sm p-5 text-slate-900 dark:text-teal-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/apple-touch-icon.png"
                    alt="Ikon SIM-PPATS"
                    className="w-10 h-10 rounded-xl border border-slate-200 dark:border-teal-700/60 shrink-0"
                  />
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Install SIM-PPATS di iOS
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-teal-200/70">
                      Tambahkan ke Layar Utama iPhone / iPad
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Tutup panduan install iOS"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-teal-900/60"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <ol className="mt-4 space-y-3 text-sm text-slate-700 dark:text-teal-100/90">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Ketuk ikon{' '}
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                      <Share className="w-3.5 h-3.5 text-sky-600" />
                      Bagikan (Share)
                    </span>{' '}
                    di bilah menu Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Gulir ke bawah lalu pilih{' '}
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                      <PlusSquare className="w-3.5 h-3.5 text-sky-600" />
                      Tambahkan ke Layar Utama
                    </span>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
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
                className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {variant === 'mobile-header' ? (
        <button
          type="button"
          onClick={() => setShowDesktopGuide(true)}
          aria-label="Buat shortcut aplikasi SIM-PPATS"
          className="btn-3d btn-3d-sidebar inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-amber-300 text-xs font-medium whitespace-nowrap"
          title="Buat shortcut aplikasi di desktop/ponsel"
        >
          <MonitorDown className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Shortcut</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setShowDesktopGuide(true)}
          className="btn-3d btn-3d-sidebar w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-amber-300 text-xs font-semibold"
          title="Buat shortcut SIM-PPATS di desktop laptop agar bisa dibuka langsung seperti aplikasi mandiri"
        >
          <MonitorDown className="w-3.5 h-3.5 shrink-0" />
          <span>Buat Shortcut Desktop</span>
        </button>
      )}

      {showDesktopGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="desktop-shortcut-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
          onClick={() => setShowDesktopGuide(false)}
        >
          <div
            className="bento-card w-full max-w-md p-5 text-slate-900 dark:text-teal-50 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="Ikon SIM-PPATS"
                  className="w-11 h-11 rounded-xl border border-teal-900/15 dark:border-teal-600/50 shrink-0"
                />
                <div>
                  <h3
                    id="desktop-shortcut-title"
                    className="font-display text-base font-bold text-slate-900 dark:text-white"
                  >
                    Shortcut Aplikasi di Desktop Laptop
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-teal-200/75">
                    Buka SIM-PPATS langsung dari desktop tanpa mengetik alamat browser
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDesktopGuide(false)}
                aria-label="Tutup panduan shortcut desktop"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-teal-900/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Opsi 1: Mode Aplikasi Mandiri (PWA) */}
            <div className="rounded-xl border border-teal-200 dark:border-teal-700/60 bg-teal-50/70 dark:bg-teal-950/50 p-3.5 space-y-2">
              <p className="text-xs font-bold text-teal-950 dark:text-teal-100">
                Cara 1 (Disarankan — Jendela Mandiri Tanpa Bilah Browser)
              </p>
              <ol className="space-y-1.5 text-xs text-slate-700 dark:text-teal-100/90 list-decimal list-inside">
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
            <div className="rounded-xl border border-slate-200 dark:border-teal-800/70 bg-white dark:bg-[#092024] p-3.5 space-y-2.5">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Cara 2 (Cepat — Unduh File Pintasan Desktop Windows)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-teal-200/70 mt-0.5">
                  Unduh file <span className="font-mono font-semibold">SIM-PPATS.url</span> lalu pindahkan ke Desktop laptop Anda untuk membuka aplikasi dalam 1 klik ganda.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadDesktopShortcut}
                  className="btn-3d btn-3d-teal flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
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
                  className="btn-3d btn-3d-light inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
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
              className="w-full rounded-xl bg-slate-900 dark:bg-teal-700 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-teal-600 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
};
