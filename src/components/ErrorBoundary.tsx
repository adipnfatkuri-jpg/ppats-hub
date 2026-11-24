import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  friendlyMessage: string;
}

function formatFriendlyError(error: Error): string {
  const raw = error?.message || '';
  try {
    const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
    if (parsed && typeof parsed.error === 'string') {
      if (/Quota exceeded/i.test(parsed.error)) {
        return 'Kuota harian database cloud Firestore sementara telah tercapai. Kuota akan reset keesokan hari.';
      }
      if (/Missing or insufficient permissions/i.test(parsed.error)) {
        return 'Akun Anda tidak memiliki izin akses untuk operasi database ini. Pastikan akun Google Anda sudah didaftarkan di daftar Akses Tim Kantor oleh Admin.';
      }
      if (/exceeds maximum size|longer than 1048487|maximum allowed size/i.test(parsed.error)) {
        return 'Ukuran foto lampiran berkas melebihi batas dokumen cloud (1 MB). Perkecil ukuran foto lampiran lalu coba simpan kembali.';
      }
      return `Gangguan sinkronisasi cloud: ${parsed.error}`;
    }
  } catch {
    // not JSON
  }
  return raw || 'Terjadi kendala tak terduga pada aplikasi.';
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, friendlyMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      friendlyMessage: formatFriendlyError(error),
    };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen app-canvas flex items-center justify-center p-6">
          <div className="max-w-md w-full bento-card p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-700/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  Terjadi Kendala Aplikasi
                </h1>
                <p className="text-xs text-slate-600 dark:text-teal-200/80 mt-1 leading-relaxed">
                  {this.state.friendlyMessage}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-3d btn-3d-teal w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Aplikasi</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
