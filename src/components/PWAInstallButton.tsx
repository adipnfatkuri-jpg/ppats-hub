import React, { useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'mobile-header';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'sidebar',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    if (variant === 'mobile-header') {
      return (
        <button
          type="button"
          onClick={() => void install()}
          className="btn-3d btn-3d-amber inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap"
          title="Install SIM-PPATS ke layar utama"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Install</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => void install()}
        className="btn-3d btn-3d-amber w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
      >
        <Smartphone className="w-3.5 h-3.5 shrink-0" />
        <span>Install Aplikasi (PWA)</span>
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
            className="btn-3d btn-3d-sidebar inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-amber-300 text-xs font-medium whitespace-nowrap"
            title="Cara install SIM-PPATS di iPhone/iPad"
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span>Install iOS</span>
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

              <ol className="mt-4 space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Ketuk ikon{' '}
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
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
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
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
                    Ketuk <strong className="text-slate-900">Tambah</strong> di pojok kanan atas
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

  return null;
};
