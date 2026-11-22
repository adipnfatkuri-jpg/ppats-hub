import React from 'react';
import { Camera, ImagePlus, Loader2, Plus, ScanLine, Trash2, X } from 'lucide-react';
import { NonAktaDetail, ParaPihak, PemecahanBidangItem } from '../types/ppats';
import { SCAN_DOC_FILE_ACCEPT } from '../utils/imageOptimizer';
import { DateInputId } from './DateInputId';

export interface WarisScanNotice {
  type: 'info' | 'success' | 'error';
  message: string;
}

interface WarisCDetailPanelProps {
  nonAkta: NonAktaDetail;
  setNonAkta: React.Dispatch<React.SetStateAction<NonAktaDetail>>;
  paraPihak: ParaPihak[];
  desaName: string;
  luasIndukM2: number;
  onUploadSketPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onScanWarisC?: (files: File[]) => void;
  scanningWarisC?: boolean;
  scanDisabled?: boolean;
  scanNotice?: WarisScanNotice | null;
  onDismissScanNotice?: () => void;
}

export const WarisCDetailPanel: React.FC<WarisCDetailPanelProps> = ({
  nonAkta,
  setNonAkta,
  paraPihak,
  desaName,
  luasIndukM2,
  onUploadSketPhoto,
  onScanWarisC,
  scanningWarisC = false,
  scanDisabled = false,
  scanNotice = null,
  onDismissScanNotice,
}) => {
  const heirNames = paraPihak
    .filter((p) => p.peran.startsWith('Pihak ') && p.nama.trim())
    .map((p) => p.nama.trim());

  const bidangList = nonAkta.bidang_pecahan ?? [];
  const isBusy = scanningWarisC || scanDisabled;

  const handleScanInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length > 0 && onScanWarisC) {
      onScanWarisC(files);
    }
  };

  const handleAddBidang = () => {
    const nextIdx = bidangList.length + 1;
    const item: PemecahanBidangItem = {
      id: `wc-bid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: `${nextIdx}`,
      luas_m2: 0,
      keterangan: '',
    };
    setNonAkta((prev) => ({
      ...prev,
      bidang_pecahan: [...(prev.bidang_pecahan ?? []), item],
    }));
  };

  const handleUpdateBidang = (
    id: string,
    patch: Partial<PemecahanBidangItem>
  ) => {
    setNonAkta((prev) => ({
      ...prev,
      bidang_pecahan: (prev.bidang_pecahan ?? []).map((b) =>
        b.id === id ? { ...b, ...patch } : b
      ),
    }));
  };

  const handleRemoveBidang = (id: string) => {
    setNonAkta((prev) => ({
      ...prev,
      bidang_pecahan: (prev.bidang_pecahan ?? []).filter((b) => b.id !== id),
    }));
  };

  return (
    <div className="sm:col-span-2 border border-amber-300/60 dark:border-amber-500/30 rounded-2xl p-4 bg-[#FFFDF8] dark:bg-[#0A2226] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-amber-200/80 dark:border-teal-500/20 pb-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
            Detail Khusus Waris Letter C / Konversi Bekas Hak Milik Adat (15–16 Halaman F4)
          </h3>
          <p className="text-[11px] text-slate-600 dark:text-teal-200/75 mt-0.5">
            Lengkapi atau scan Buku Letter C Desa, Surat Riwayat, Pembagian Warisan, SPPT, atau file Word (.docx/.doc) agar seluruh 15–16 halaman bundel Waris C terisi rapi.
          </p>
        </div>

        {onScanWarisC && (
          <div className="inline-flex items-center gap-1 shrink-0">
            <label
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
                isBusy
                  ? 'opacity-60 pointer-events-none border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                  : 'cursor-pointer border-sky-200 dark:border-sky-400/35 bg-sky-50 dark:bg-sky-950/70 hover:bg-sky-100 dark:hover:bg-sky-900/70 text-sky-800 dark:text-sky-200'
              }`}
              title="Scan Foto, PDF, atau Word (.docx/.doc) Buku Letter C, Riwayat Tanah, Pembagian Waris, atau SKW"
            >
              <input
                type="file"
                accept={SCAN_DOC_FILE_ACCEPT}
                multiple
                aria-label="Scan Dokumen Waris C (Foto, PDF, Word)"
                disabled={isBusy}
                onChange={handleScanInputChange}
                className="sr-only"
              />
              {scanningWarisC ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ScanLine className="w-3.5 h-3.5" />
              )}
              <span>{scanningWarisC ? 'Memindai...' : 'Scan Dokumen Waris C'}</span>
            </label>
            <label
              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                isBusy
                  ? 'opacity-60 pointer-events-none border-teal-900/10 dark:border-teal-500/20 bg-slate-50 dark:bg-[#081E22] text-slate-400 dark:text-teal-500/50'
                  : 'cursor-pointer border-teal-900/15 dark:border-teal-400/25 bg-white dark:bg-[#0D2B30] hover:bg-teal-50 dark:hover:bg-[#12383F] text-slate-700 dark:text-teal-100'
              }`}
              title="Foto dokumen Waris Letter C langsung dari kamera"
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="Foto Kamera Dokumen Waris C"
                disabled={isBusy}
                onChange={handleScanInputChange}
                className="sr-only"
              />
              <Camera className="w-3.5 h-3.5" />
            </label>
          </div>
        )}
      </div>

      {scanNotice && (
        <div
          role={scanNotice.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-2 px-3 py-2 rounded-xl border text-xs ${
            scanNotice.type === 'error'
              ? 'border-rose-200 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200'
              : scanNotice.type === 'success'
                ? 'border-emerald-200 dark:border-emerald-600/45 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                : 'border-sky-200 dark:border-sky-600/45 bg-sky-50 dark:bg-sky-950/50 text-sky-900 dark:text-sky-200'
          }`}
        >
          <span className="leading-snug">{scanNotice.message}</span>
          {onDismissScanNotice && (
            <button
              type="button"
              onClick={onDismissScanNotice}
              aria-label="Tutup pemberitahuan scan Waris C"
              className="shrink-0 opacity-70 hover:opacity-100 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Bagian A: Data Tambahan Pasangan Pewaris & Jumlah Anak */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label
            htmlFor="wc-tgl-meninggal-pasangan"
            className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
          >
            Tgl Meninggal Pasangan (Jika Alm.)
          </label>
          <DateInputId
            id="wc-tgl-meninggal-pasangan"
            allowEmpty
            value={nonAkta.tanggal_meninggal_pasangan ?? ''}
            onChange={(val) =>
              setNonAkta((prev) => ({
                ...prev,
                tanggal_meninggal_pasangan: val,
              }))
            }
            placeholder="Kosongkan jika masih hidup"
            className="py-1.5 px-2.5"
          />
        </div>
        <div>
          <label
            htmlFor="wc-tempat-meninggal-pasangan"
            className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
          >
            Tempat Meninggal Pasangan
          </label>
          <input
            id="wc-tempat-meninggal-pasangan"
            type="text"
            value={nonAkta.tempat_meninggal_pasangan ?? ''}
            onChange={(e) =>
              setNonAkta((prev) => ({
                ...prev,
                tempat_meninggal_pasangan: e.target.value,
              }))
            }
            placeholder="Contoh: Boyolali"
            className="input-airy w-full px-2.5 py-1.5"
          />
        </div>
        <div>
          <label
            htmlFor="wc-jumlah-anak"
            className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
          >
            Jumlah Anak / Ahli Waris
          </label>
          <input
            id="wc-jumlah-anak"
            type="number"
            min="1"
            value={nonAkta.jumlah_anak_waris ?? ''}
            onChange={(e) =>
              setNonAkta((prev) => ({
                ...prev,
                jumlah_anak_waris: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
            placeholder={`Otomatis (${Math.max(1, heirNames.length)} orang)`}
            className="input-airy w-full px-2.5 py-1.5 font-mono"
          />
        </div>
      </div>

      {/* Bagian B: Data Hak Adat / Buku Letter C Desa */}
      <div className="pt-2 border-t border-teal-900/10 dark:border-teal-500/15 space-y-2.5">
        <p className="text-[11px] font-bold text-teal-900 dark:text-teal-200 uppercase tracking-wide">
          1. Data Hak Milik Adat / Buku Letter C Desa {desaName || ''}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label
              htmlFor="wc-hak-adat"
              className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
            >
              Nomor Letter C / Persil / Kelas
            </label>
            <input
              id="wc-hak-adat"
              type="text"
              value={nonAkta.waris_c_hak_adat ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({ ...prev, waris_c_hak_adat: e.target.value }))
              }
              placeholder="Contoh: C-723 Persil 73-109 Kelas IIa"
              className="input-airy w-full px-2.5 py-1.5 font-medium"
            />
          </div>
          <div>
            <label
              htmlFor="wc-tahun-c"
              className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
            >
              Tahun Tercatat Buku C
            </label>
            <input
              id="wc-tahun-c"
              type="text"
              value={nonAkta.waris_c_tahun_tercatat_c ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_tahun_tercatat_c: e.target.value,
                }))
              }
              placeholder="Contoh: 1960"
              className="input-airy w-full px-2.5 py-1.5 font-mono"
            />
          </div>
          <div>
            <label
              htmlFor="wc-atas-nama-c"
              className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
            >
              Atas Nama Tercatat di Buku C
            </label>
            <input
              id="wc-atas-nama-c"
              type="text"
              value={nonAkta.waris_c_atas_nama_c ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_atas_nama_c: e.target.value.toUpperCase(),
                }))
              }
              placeholder={nonAkta.nama_pewaris || 'Nama pemilik di Letter C'}
              className="input-airy w-full px-2.5 py-1.5 uppercase"
            />
          </div>
          <div>
            <label
              htmlFor="wc-jenis-tanah"
              className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
            >
              Jenis / Penggunaan Tanah
            </label>
            <select
              id="wc-jenis-tanah"
              value={nonAkta.waris_c_jenis_tanah ?? 'Pekarangan'}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_jenis_tanah: e.target.value,
                }))
              }
              className="input-airy w-full px-2.5 py-1.5"
            >
              <option value="Pekarangan">Pekarangan</option>
              <option value="Pertanian">Pertanian / Sawah</option>
              <option value="Tegalan">Tegalan</option>
              <option value="Tanah dan Bangunan">Tanah dan Bangunan</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="wc-berdiri"
              className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
            >
              Berdiri di Atasnya
            </label>
            <input
              id="wc-berdiri"
              type="text"
              value={nonAkta.waris_c_berdiri_di_atasnya ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_berdiri_di_atasnya: e.target.value,
                }))
              }
              placeholder="Contoh: Bangunan Rumah Tinggal / Kosong"
              className="input-airy w-full px-2.5 py-1.5"
            />
          </div>
          <div>
            <label
              htmlFor="wc-blok-dukuh"
              className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
            >
              Nama Blok / Dukuh Lokasi Tanah
            </label>
            <input
              id="wc-blok-dukuh"
              type="text"
              value={nonAkta.waris_c_nama_blok_dukuh ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_nama_blok_dukuh: e.target.value,
                }))
              }
              placeholder="Contoh: Dukuh Sidorejo RT 02 RW 01"
              className="input-airy w-full px-2.5 py-1.5"
            />
          </div>
          <div>
            <label
              htmlFor="wc-wp-pbb"
              className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
            >
              Nama Wajib Pajak di SPPT PBB
            </label>
            <input
              id="wc-wp-pbb"
              type="text"
              value={nonAkta.waris_c_nama_wp_pbb ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_nama_wp_pbb: e.target.value.toUpperCase(),
                }))
              }
              placeholder="Otomatis dari Pewaris / Nama C"
              className="input-airy w-full px-2.5 py-1.5 uppercase"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="wc-no-suket"
                className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
              >
                No. Suket Desa
              </label>
              <input
                id="wc-no-suket"
                type="text"
                value={nonAkta.waris_c_no_surat_keterangan ?? ''}
                onChange={(e) =>
                  setNonAkta((prev) => ({
                    ...prev,
                    waris_c_no_surat_keterangan: e.target.value,
                  }))
                }
                placeholder="593/..."
                className="input-airy w-full px-2 py-1.5 font-mono"
              />
            </div>
            <div>
              <label
                htmlFor="wc-no-riwayat"
                className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
              >
                No. Surat Riwayat
              </label>
              <input
                id="wc-no-riwayat"
                type="text"
                value={nonAkta.waris_c_no_surat_riwayat ?? ''}
                onChange={(e) =>
                  setNonAkta((prev) => ({
                    ...prev,
                    waris_c_no_surat_riwayat: e.target.value,
                  }))
                }
                placeholder="593/..."
                className="input-airy w-full px-2 py-1.5 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bagian C: Pembagian Waris & Penerima Bagian */}
      <div className="pt-2 border-t border-teal-900/10 dark:border-teal-500/15 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold text-teal-900 dark:text-teal-200 uppercase tracking-wide">
            2. Pembagian Warisan &amp; Bidang Bagian Pemohon
          </p>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-teal-100 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={nonAkta.waris_c_sertakan_kuasa_pemecahan ?? true}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_sertakan_kuasa_pemecahan: e.target.checked,
                }))
              }
              className="rounded border-teal-600 text-teal-600 focus:ring-teal-500"
            />
            <span>Sertakan Hal. 4 Surat Kuasa Pemecahan Bidang</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label
              htmlFor="wc-penerima"
              className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
            >
              Ahli Waris Penerima Bagian / Pemohon Utama
            </label>
            <input
              id="wc-penerima"
              type="text"
              list="waris-c-heir-options"
              value={nonAkta.waris_c_penerima_bagian ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_penerima_bagian: e.target.value.toUpperCase(),
                }))
              }
              placeholder={heirNames[0] || 'Otomatis dari Ahli Waris Pihak I'}
              className="input-airy w-full px-2.5 py-1.5 uppercase font-medium"
            />
            <datalist id="waris-c-heir-options">
              {heirNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label
              htmlFor="wc-luas-bagian"
              className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
            >
              Luas Bagian (m²)
            </label>
            <input
              id="wc-luas-bagian"
              type="number"
              min="0"
              value={nonAkta.waris_c_luas_bagian_m2 ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_luas_bagian_m2: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
              placeholder={luasIndukM2 > 0 ? `Induk: ${luasIndukM2}` : 'Misal: 1412'}
              className="input-airy w-full px-2.5 py-1.5 font-mono"
            />
          </div>
          <div>
            <label
              htmlFor="wc-tahun-waris"
              className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
            >
              Tahun Waris / Kuasa Fisik
            </label>
            <input
              id="wc-tahun-waris"
              type="text"
              value={nonAkta.waris_c_tahun_waris ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_tahun_waris: e.target.value,
                }))
              }
              placeholder="Contoh: 2015"
              className="input-airy w-full px-2.5 py-1.5 font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="wc-hubungan-pewaris"
              className="block text-slate-700 dark:text-teal-100/90 font-medium mb-1"
            >
              Hubungan Pemohon dengan Pewaris
            </label>
            <input
              id="wc-hubungan-pewaris"
              type="text"
              value={nonAkta.waris_c_hubungan_pewaris ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_hubungan_pewaris: e.target.value,
                }))
              }
              placeholder="Contoh: orang tua kandungnya / kakek kandungnya"
              className="input-airy w-full px-2.5 py-1.5"
            />
          </div>
        </div>

        {/* Batas Bagian (Opsional, fallback ke Batas Induk Step 2) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div>
            <label
              htmlFor="wc-batas-utara"
              className="block text-[11px] text-slate-600 dark:text-teal-200/80 font-medium mb-1"
            >
              Batas Bagian Utara (Opsional)
            </label>
            <input
              id="wc-batas-utara"
              type="text"
              value={nonAkta.waris_c_batas_bagian_utara ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_batas_bagian_utara: e.target.value,
                }))
              }
              placeholder="Ikut batas induk"
              className="input-airy w-full px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label
              htmlFor="wc-batas-timur"
              className="block text-[11px] text-slate-600 dark:text-teal-200/80 font-medium mb-1"
            >
              Batas Bagian Timur (Opsional)
            </label>
            <input
              id="wc-batas-timur"
              type="text"
              value={nonAkta.waris_c_batas_bagian_timur ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_batas_bagian_timur: e.target.value,
                }))
              }
              placeholder="Ikut batas induk"
              className="input-airy w-full px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label
              htmlFor="wc-batas-selatan"
              className="block text-[11px] text-slate-600 dark:text-teal-200/80 font-medium mb-1"
            >
              Batas Bagian Selatan (Opsional)
            </label>
            <input
              id="wc-batas-selatan"
              type="text"
              value={nonAkta.waris_c_batas_bagian_selatan ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_batas_bagian_selatan: e.target.value,
                }))
              }
              placeholder="Ikut batas induk"
              className="input-airy w-full px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label
              htmlFor="wc-batas-barat"
              className="block text-[11px] text-slate-600 dark:text-teal-200/80 font-medium mb-1"
            >
              Batas Bagian Barat (Opsional)
            </label>
            <input
              id="wc-batas-barat"
              type="text"
              value={nonAkta.waris_c_batas_bagian_barat ?? ''}
              onChange={(e) =>
                setNonAkta((prev) => ({
                  ...prev,
                  waris_c_batas_bagian_barat: e.target.value,
                }))
              }
              placeholder="Ikut batas induk"
              className="input-airy w-full px-2 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Bagian D: Riwayat Penguasaan Tanah (a, b, c) */}
      <div className="pt-2 border-t border-teal-900/10 dark:border-teal-500/15 space-y-2.5">
        <p className="text-[11px] font-bold text-teal-900 dark:text-teal-200 uppercase tracking-wide">
          3. Riwayat Penguasaan Tanah (Hal. 11 &amp; Hal. 13 — Otomatis Terisi Jika Dikosongkan)
        </p>
        <div className="space-y-2">
          {(
            [
              {
                label: 'a. Riwayat Tahap 1 (Sebelum 1960 / Awal Buku C)',
                tahunKey: 'waris_c_riwayat_1_tahun',
                olehKey: 'waris_c_riwayat_1_oleh',
                caraKey: 'waris_c_riwayat_1_cara',
                buktiKey: 'waris_c_riwayat_1_bukti',
                phTahun: '1960',
                phOleh: 'Nama di Buku C',
                phCara: 'Milik Adat / Turun-Temurun',
                phBukti: 'Buku Letter C Desa',
              },
              {
                label: 'b. Riwayat Tahap 2 (Peralihan Pewaris / Warisan)',
                tahunKey: 'waris_c_riwayat_2_tahun',
                olehKey: 'waris_c_riwayat_2_oleh',
                caraKey: 'waris_c_riwayat_2_cara',
                buktiKey: 'waris_c_riwayat_2_bukti',
                phTahun: 'Tahun waris',
                phOleh: 'Ahli Waris',
                phCara: 'Warisan',
                phBukti: 'Surat Keterangan Warisan',
              },
              {
                label: 'c. Riwayat Tahap 3 (Pembagian / Saat Ini)',
                tahunKey: 'waris_c_riwayat_3_tahun',
                olehKey: 'waris_c_riwayat_3_oleh',
                caraKey: 'waris_c_riwayat_3_cara',
                buktiKey: 'waris_c_riwayat_3_bukti',
                phTahun: 'Tahun pembagian',
                phOleh: 'Penerima Bagian',
                phCara: 'Pembagian Warisan',
                phBukti: 'Surat Pernyataan Pembagian Warisan',
              },
            ] as const
          ).map((row) => (
            <div
              key={row.tahunKey}
              className="p-2.5 rounded-xl border border-teal-900/10 dark:border-teal-500/20 bg-white dark:bg-[#081E22] space-y-2"
            >
              <p className="text-[11px] font-semibold text-slate-800 dark:text-teal-100">
                {row.label}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  aria-label={`${row.label} Tahun`}
                  value={nonAkta[row.tahunKey] ?? ''}
                  onChange={(e) =>
                    setNonAkta((prev) => ({ ...prev, [row.tahunKey]: e.target.value }))
                  }
                  placeholder={`Tahun (${row.phTahun})`}
                  className="input-airy px-2 py-1.5 text-xs font-mono"
                />
                <input
                  type="text"
                  aria-label={`${row.label} Dikuasai Oleh`}
                  value={nonAkta[row.olehKey] ?? ''}
                  onChange={(e) =>
                    setNonAkta((prev) => ({ ...prev, [row.olehKey]: e.target.value }))
                  }
                  placeholder={`Oleh (${row.phOleh})`}
                  className="input-airy px-2 py-1.5 text-xs"
                />
                <input
                  type="text"
                  aria-label={`${row.label} Cara Peralihan`}
                  value={nonAkta[row.caraKey] ?? ''}
                  onChange={(e) =>
                    setNonAkta((prev) => ({ ...prev, [row.caraKey]: e.target.value }))
                  }
                  placeholder={`Cara (${row.phCara})`}
                  className="input-airy px-2 py-1.5 text-xs"
                />
                <input
                  type="text"
                  aria-label={`${row.label} Bukti`}
                  value={nonAkta[row.buktiKey] ?? ''}
                  onChange={(e) =>
                    setNonAkta((prev) => ({ ...prev, [row.buktiKey]: e.target.value }))
                  }
                  placeholder={`Bukti (${row.phBukti})`}
                  className="input-airy px-2 py-1.5 text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bagian E: Sketsa Bidang Tanah (Hal. 8, 9, 12) & Rincian Keterangan Kotak */}
      <div className="pt-2 border-t border-teal-900/10 dark:border-teal-500/15 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold text-teal-900 dark:text-teal-200 uppercase tracking-wide">
            4. Gambar Sket Tanah &amp; Keterangan Bidang [1]..[N] (Hal. 9)
          </p>
          <button
            type="button"
            onClick={handleAddBidang}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-teal-500/30 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-[11px] font-semibold text-teal-800 dark:text-teal-200"
          >
            <Plus className="w-3 h-3" />
            <span>Tambah Keterangan Bidang</span>
          </button>
        </div>

        {bidangList.length > 0 && (
          <div className="space-y-2">
            {bidangList.map((b, idx) => (
              <div
                key={b.id}
                className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl border border-teal-900/10 dark:border-teal-500/20 bg-white dark:bg-[#081E22]"
              >
                <input
                  type="text"
                  aria-label={`Kode bidang ke-${idx + 1}`}
                  value={b.label}
                  onChange={(e) => handleUpdateBidang(b.id, { label: e.target.value })}
                  placeholder={`${idx + 1}`}
                  className="col-span-2 input-airy px-2 py-1 text-xs font-mono text-center"
                />
                <input
                  type="text"
                  aria-label={`Keterangan bidang ke-${idx + 1}`}
                  value={b.keterangan ?? ''}
                  onChange={(e) =>
                    handleUpdateBidang(b.id, { keterangan: e.target.value })
                  }
                  placeholder="Contoh: Bagian a.n. WIJI / Jalan Desa"
                  className="col-span-6 input-airy px-2 py-1 text-xs"
                />
                <input
                  type="number"
                  min="0"
                  aria-label={`Luas bidang ke-${idx + 1}`}
                  value={b.luas_m2 || ''}
                  onChange={(e) =>
                    handleUpdateBidang(b.id, { luas_m2: Number(e.target.value) || 0 })
                  }
                  placeholder="Luas m²"
                  className="col-span-3 input-airy px-2 py-1 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveBidang(b.id)}
                  aria-label={`Hapus bidang ke-${idx + 1}`}
                  className="col-span-1 flex justify-center text-slate-400 hover:text-rose-600 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {nonAkta.foto_sket_pecah ? (
            <div className="flex items-center gap-3 p-2 rounded-xl border border-teal-900/12 dark:border-teal-500/20 bg-white dark:bg-[#081E22]">
              <img
                src={nonAkta.foto_sket_pecah}
                alt="Gambar Sket Tanah Waris C"
                className="w-24 h-16 object-cover rounded-lg border border-teal-900/10"
              />
              <div className="text-[11px] space-y-1">
                <p className="font-semibold text-slate-800 dark:text-teal-50">
                  Gambar Sket Tanah terlampir (Hal. 8, 9 &amp; 12)
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setNonAkta((prev) => ({ ...prev, foto_sket_pecah: '' }))
                  }
                  className="text-rose-600 dark:text-rose-400 font-semibold hover:underline"
                >
                  Hapus Gambar Sket
                </button>
              </div>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-teal-500/45 bg-teal-50/40 dark:bg-teal-950/30 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-xs font-semibold text-teal-800 dark:text-teal-200 cursor-pointer">
              <ImagePlus className="w-4 h-4" />
              <span>Unggah Gambar Sket Tanah (Opsional · disematkan di Hal. 8, 9 &amp; 12)</span>
              <input
                type="file"
                accept="image/*"
                aria-label="Unggah Gambar Sket Tanah Waris C"
                onChange={onUploadSketPhoto}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
};
