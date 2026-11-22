import React, { useMemo, useState } from 'react';
import {
  FilePlus2,
  Printer,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  FileCheck2,
  Building2,
  FolderOpen,
  Calculator,
  Copy,
  Loader2,
  Wallet,
} from 'lucide-react';
import { BerkasRecord, BerkasStatus } from '../types/ppats';
import { STATUS_OPTIONS } from '../utils/seedData';
import {
  extractMonthYearFromDate,
  formatNumberId,
  formatRupiah,
  formatTanggalDDMMYYYY,
} from '../utils/indonesianFormatter';
import { isAktaService } from '../utils/taxAndAudit';
import { GlossyIcon3D, PartyAvatar3D } from './TactileUI';

interface DashboardModuleProps {
  records: BerkasRecord[];
  onCreateNew: () => void;
  onEditRecord: (record: BerkasRecord) => void;
  onDuplicateRecord: (record: BerkasRecord) => Promise<void> | void;
  onCalculateTax: (record: BerkasRecord) => void;
  onChangeStatus: (recordId: string, nextStatus: BerkasStatus) => void;
  onPrintReceipt: (record: BerkasRecord) => void;
  onDeleteRecord: (recordId: string) => void;
}

function statusStyle(status: BerkasStatus): {
  bg: string;
  text: string;
  border: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (status) {
    case '1. Pemberkasan':
      return {
        bg: 'bg-slate-100 dark:bg-teal-950/80',
        text: 'text-slate-700 dark:text-teal-100',
        border: 'border-slate-300 dark:border-teal-700/70',
        Icon: FolderOpen,
      };
    case '2. Validasi Pajak':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/60',
        text: 'text-amber-800 dark:text-amber-200',
        border: 'border-amber-300 dark:border-amber-700/60',
        Icon: Clock,
      };
    case '3. TTD Akta':
      return {
        bg: 'bg-sky-50 dark:bg-sky-950/60',
        text: 'text-sky-800 dark:text-sky-200',
        border: 'border-sky-300 dark:border-sky-700/60',
        Icon: FileCheck2,
      };
    case '4. Proses BPN':
      return {
        bg: 'bg-indigo-50 dark:bg-indigo-950/60',
        text: 'text-indigo-800 dark:text-indigo-200',
        border: 'border-indigo-300 dark:border-indigo-700/60',
        Icon: Building2,
      };
    case '5. Selesai':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/60',
        text: 'text-emerald-800 dark:text-emerald-200',
        border: 'border-emerald-300 dark:border-emerald-700/60',
        Icon: CheckCircle2,
      };
  }
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  records,
  onCreateNew,
  onEditRecord,
  onDuplicateRecord,
  onCalculateTax,
  onChangeStatus,
  onPrintReceipt,
  onDeleteRecord,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'SEMUA' | BerkasStatus>('SEMUA');
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const handleDuplicateClick = async (rec: BerkasRecord) => {
    if (duplicatingId) return;
    setDuplicatingId(rec.id);
    try {
      await onDuplicateRecord(rec);
    } finally {
      setDuplicatingId(null);
    }
  };

  const kpis = useMemo(() => {
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const recordYms = records
      .map((r) => {
        const my = extractMonthYearFromDate(r.akta.tanggal_akta || r.tanggal_masuk);
        return my ? `${my.year}-${String(my.month).padStart(2, '0')}` : '';
      })
      .filter(Boolean);
    const latestYm = recordYms.length > 0 ? [...recordYms].sort().pop() || currentYm : currentYm;

    const activeYm = recordYms.includes(currentYm) ? currentYm : latestYm;
    const [activeY, activeM] = activeYm.split('-');
    const activeLabel = activeM && activeY ? `${activeM}-${activeY}` : activeYm;

    const berkasBulanIni = records.filter((r) => {
      const my = extractMonthYearFromDate(r.akta.tanggal_akta || r.tanggal_masuk);
      const ym = my ? `${my.year}-${String(my.month).padStart(2, '0')}` : '';
      return ym === activeYm;
    }).length;

    const aktaTerbit = records.filter(
      (r) =>
        isAktaService(r.layanan) &&
        (r.status === '3. TTD Akta' ||
          r.status === '4. Proses BPN' ||
          r.status === '5. Selesai')
    ).length;

    const totalNilaiTransaksi = records.reduce(
      (sum, r) => sum + (r.pajak?.nilai_kesepakatan || 0),
      0
    );

    const prosesBpn = records.filter((r) => r.status === '4. Proses BPN').length;

    return { berkasBulanIni, aktaTerbit, totalNilaiTransaksi, prosesBpn, activeLabel };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...records]
      .sort((a, b) => b.no_urut - a.no_urut)
      .filter((r) => {
        if (statusFilter !== 'SEMUA' && r.status !== statusFilter) return false;
        if (!q) return true;
        const partiesText = r.para_pihak
          .map((p) => `${p.nama} ${p.nik}`)
          .join(' ')
          .toLowerCase();
        const haystack = [
          r.kode_berkas,
          r.akta.nomor_akta,
          r.layanan,
          r.tanah.nib,
          r.tanah.nomor_hak_lama,
          r.tanah.desa,
          partiesText,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
  }, [records, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900 dark:text-white">
            Dashboard &amp; Tracking Progres Berkas
          </h1>
          <p className="text-sm text-slate-600 dark:text-teal-200/75 mt-1">
            Pemantauan berkas loket PPATS, validasi pajak daerah, penandatanganan akta, hingga proses balik nama BPN.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="btn-3d btn-3d-teal inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0"
        >
          <FilePlus2 className="w-4 h-4" />
          <span>Buat Berkas Baru</span>
        </button>
      </div>

      {/* 4 Layered 3D Bento KPI Summary Cards with 3D Glossy Icons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bento-card bento-card-hover p-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-teal-800/80 dark:text-teal-300/80">
              Total Berkas ({kpis.activeLabel})
            </p>
            <p className="font-mono text-3xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
              {kpis.berkasBulanIni}
            </p>
            <p className="text-xs text-slate-500 dark:text-teal-200/65 mt-1.5">
              Dari total {records.length} berkas terdaftar
            </p>
          </div>
          <GlossyIcon3D tone="teal" size="md">
            <FolderOpen className="w-5 h-5" />
          </GlossyIcon3D>
        </div>

        <div className="bento-card bento-card-hover p-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-800/80 dark:text-emerald-300/80">
              Jumlah Akta Terbit
            </p>
            <p className="font-mono text-3xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
              {kpis.aktaTerbit}
            </p>
            <p className="text-xs text-slate-500 dark:text-teal-200/65 mt-1.5">
              Khusus Akta PPATS (non Non-Akta)
            </p>
          </div>
          <GlossyIcon3D tone="emerald" size="md">
            <FileCheck2 className="w-5 h-5" />
          </GlossyIcon3D>
        </div>

        <div className="bento-card bento-card-hover p-5 flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-800/85 dark:text-amber-300/85">
              Total Nilai Transaksi
            </p>
            <p
              className="font-mono text-lg 2xl:text-xl font-bold text-slate-900 dark:text-white mt-2.5 tabular-nums whitespace-nowrap"
              title={formatRupiah(kpis.totalNilaiTransaksi)}
            >
              {formatRupiah(kpis.totalNilaiTransaksi)}
            </p>
            <p className="text-xs text-slate-500 dark:text-teal-200/65 mt-1.5">
              Akumulasi nilai peralihan hak
            </p>
          </div>
          <GlossyIcon3D tone="amber" size="sm">
            <Wallet className="w-4.5 h-4.5" />
          </GlossyIcon3D>
        </div>

        <div className="bento-card bento-card-hover p-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-indigo-800/85 dark:text-indigo-300/85">
              Sedang Proses di BPN
            </p>
            <p className="font-mono text-3xl font-bold text-indigo-700 dark:text-indigo-300 mt-2 tabular-nums">
              {kpis.prosesBpn}
            </p>
            <p className="text-xs text-slate-500 dark:text-teal-200/65 mt-1.5">
              Menunggu sertipikat balik nama
            </p>
          </div>
          <GlossyIcon3D tone="indigo" size="md">
            <Building2 className="w-5 h-5" />
          </GlossyIcon3D>
        </div>
      </div>

      {/* Monitoring Berkas Bento Card */}
      <div className="bento-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-teal-900/10 dark:border-teal-400/15 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          {/* 3D Raised Status Filter Pills */}
          <div
            role="tablist"
            aria-label="Filter status berkas"
            className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#EAF3F1] dark:bg-[#081F22] rounded-2xl border border-teal-900/8 dark:border-teal-400/15 shadow-inner"
          >
            {(['SEMUA', ...STATUS_OPTIONS] as const).map((st) => {
              const active = statusFilter === st;
              return (
                <button
                  key={st}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-b from-teal-400 to-teal-600 text-white border-b-2 border-teal-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),0_6px_14px_-4px_rgba(13,148,136,0.55)] -translate-y-0.5'
                      : 'text-slate-600 dark:text-teal-200/75 hover:text-teal-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-teal-900/40'
                  }`}
                >
                  {st === 'SEMUA' ? 'Semua Status' : st}
                </button>
              );
            })}
          </div>

          {/* Airy Search Input */}
          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="w-4 h-4 text-teal-700/60 dark:text-teal-300/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, no. akta, NIB..."
              aria-label="Cari berkas di papan monitoring"
              className="input-airy w-full pl-10 pr-3.5 py-2 text-sm"
            />
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-700 dark:text-teal-100">
              Tidak ada berkas yang sesuai dengan filter saat ini.
            </p>
            <p className="text-xs text-slate-500 dark:text-teal-200/70 mt-1">
              Ubah kata kunci pencarian atau buat berkas pertanahan baru.
            </p>
            <button
              type="button"
              onClick={onCreateNew}
              className="btn-3d btn-3d-teal mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>Buat Berkas Baru</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-teal-900/10 dark:border-teal-400/15 bg-[#F4FAF8] dark:bg-[#092024] text-[11px] font-semibold text-teal-900/75 dark:text-teal-200/80">
                  <th className="py-3.5 px-2.5 whitespace-nowrap">Kode &amp; No. Akta</th>
                  <th className="py-3.5 px-2 whitespace-nowrap">Layanan &amp; Tgl</th>
                  <th className="py-3.5 px-2">Para Pihak</th>
                  <th className="py-3.5 px-2">Objek Tanah</th>
                  <th className="py-3.5 px-2 text-right whitespace-nowrap">Nilai Transaksi</th>
                  <th className="py-3.5 px-2 whitespace-nowrap">Status Proses</th>
                  <th className="py-3.5 px-2.5 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-900/8 dark:divide-teal-400/10">
                {filteredRecords.map((rec) => {
                  const p1Names =
                    rec.para_pihak
                      .filter((p) => p.peran === 'Pihak I')
                      .map((p) => p.nama)
                      .join(', ') || '-';
                  const p2Names =
                    rec.para_pihak
                      .filter((p) => p.peran === 'Pihak II')
                      .map((p) => p.nama)
                      .join(', ') || '-';
                  const isAkta = isAktaService(rec.layanan);
                  const allParties =
                    rec.para_pihak
                      .filter((p) => p.peran.startsWith('Pihak '))
                      .map((p) => p.nama)
                      .filter(Boolean)
                      .join(', ') || '-';
                  const primaryAvatarName =
                    p1Names !== '-' ? p1Names : allParties !== '-' ? allParties : rec.kode_berkas;
                  const st = statusStyle(rec.status);
                  const StIcon = st.Icon;

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-teal-50/50 dark:hover:bg-teal-900/30 transition-colors"
                    >
                      <td className="py-4 px-2.5 align-middle whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                          {rec.kode_berkas}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-teal-200/70 mt-0.5 tabular-nums">
                          {isAkta
                            ? rec.akta.nomor_akta || 'Belum bernomor'
                            : 'Non-Akta (F4)'}
                        </div>
                      </td>
                      <td className="py-4 px-2 align-middle whitespace-nowrap">
                        <div className="text-xs font-semibold text-slate-900 dark:text-teal-50">
                          {rec.layanan}
                        </div>
                        <div className="font-mono text-[11px] text-slate-600 dark:text-teal-200/75 mt-0.5 tabular-nums">
                          {rec.akta.tanggal_akta
                            ? formatTanggalDDMMYYYY(rec.akta.tanggal_akta)
                            : 'Belum bertanggal'}
                        </div>
                        {!rec.akta.tanggal_akta && rec.tanggal_masuk && (
                          <div className="font-mono text-[10px] text-slate-400 dark:text-teal-300/50 tabular-nums">
                            Masuk: {formatTanggalDDMMYYYY(rec.tanggal_masuk)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-2 align-middle max-w-[175px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <PartyAvatar3D name={primaryAvatarName} />
                          <div className="min-w-0 flex-1">
                            {isAkta || p2Names !== '-' ? (
                              <>
                                <div
                                  className="text-xs font-medium text-slate-800 dark:text-teal-50 truncate"
                                  title={p1Names}
                                >
                                  <span className="text-teal-700/70 dark:text-teal-300/70 font-semibold">
                                    I:
                                  </span>{' '}
                                  {p1Names}
                                </div>
                                <div
                                  className="text-xs text-slate-600 dark:text-teal-200/80 truncate mt-0.5"
                                  title={p2Names}
                                >
                                  <span className="text-teal-700/70 dark:text-teal-300/70 font-semibold">
                                    II:
                                  </span>{' '}
                                  {p2Names}
                                </div>
                              </>
                            ) : (
                              <>
                                <div
                                  className="text-xs font-medium text-slate-800 dark:text-teal-50 truncate"
                                  title={allParties}
                                >
                                  <span className="text-teal-700/70 dark:text-teal-300/70 font-semibold">
                                    Pemohon:
                                  </span>{' '}
                                  {allParties}
                                </div>
                                {rec.non_akta?.nama_pewaris ? (
                                  <div
                                    className="text-[11px] text-slate-500 dark:text-teal-200/70 truncate mt-0.5"
                                    title={rec.non_akta.nama_pewaris}
                                  >
                                    Pewaris: {rec.non_akta.nama_pewaris}
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-slate-500 dark:text-teal-200/70 mt-0.5">
                                    Berkas Non-Akta
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2 align-middle max-w-[150px]">
                        <div className="text-xs font-semibold text-slate-900 dark:text-teal-50 truncate" title={`${rec.tanah.jenis_hak} · ${rec.tanah.desa}`}>
                          {rec.tanah.jenis_hak} · {rec.tanah.desa}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-teal-200/70 mt-0.5 tabular-nums truncate" title={`${rec.tanah.nib || '-'} · ${formatNumberId(rec.tanah.luas_m2)} m²`}>
                          {rec.tanah.nib || '-'} · {formatNumberId(rec.tanah.luas_m2)} m²
                        </div>
                      </td>
                      <td className="py-4 px-2 align-middle text-right font-mono text-xs font-semibold text-slate-900 dark:text-teal-50 tabular-nums whitespace-nowrap">
                        {formatRupiah(rec.pajak.nilai_kesepakatan)}
                      </td>
                      <td className="py-4 px-2 align-middle whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <StIcon className={`w-3.5 h-3.5 shrink-0 ${st.text}`} />
                          <select
                            value={rec.status}
                            aria-label={`Ubah status berkas ${rec.kode_berkas}`}
                            onChange={(e) =>
                              onChangeStatus(rec.id, e.target.value as BerkasStatus)
                            }
                            className={`text-[11px] font-semibold rounded-xl border px-1.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer ${st.bg} ${st.text} ${st.border}`}
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option
                                key={opt}
                                value={opt}
                                className="bg-white dark:bg-[#0D262A] text-slate-900 dark:text-teal-50"
                              >
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-4 px-2.5 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditRecord(rec)}
                            title="Edit / Buka Ulang Berkas"
                            aria-label={`Edit berkas ${rec.kode_berkas}`}
                            className="inline-flex items-center gap-1 px-1.5 py-1.5 rounded-lg border border-teal-900/12 dark:border-teal-400/20 bg-white dark:bg-[#113338] hover:bg-teal-50 dark:hover:bg-teal-800/60 text-[11px] font-medium text-slate-700 dark:text-teal-100 transition-colors shadow-xs"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDuplicateClick(rec)}
                            disabled={duplicatingId !== null}
                            title="Salin / Duplikasi Berkas sebagai Berkas Baru"
                            aria-label={`Duplikasi berkas ${rec.kode_berkas}`}
                            className="inline-flex items-center gap-1 px-1.5 py-1.5 rounded-lg border border-teal-900/12 dark:border-teal-400/20 bg-white dark:bg-[#113338] hover:bg-sky-50 dark:hover:bg-sky-900/50 hover:border-sky-300 hover:text-sky-800 dark:hover:text-sky-200 text-[11px] font-medium text-slate-700 dark:text-teal-100 transition-colors disabled:opacity-60 shadow-xs"
                          >
                            {duplicatingId === rec.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>Salin</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onCalculateTax(rec)}
                            title="Hitung / Ubah Pajak di Menu Perhitungan Pajak"
                            aria-label={`Hitung pajak ${rec.kode_berkas}`}
                            className="inline-flex items-center gap-1 px-1.5 py-1.5 rounded-lg border border-teal-900/12 dark:border-teal-400/20 bg-white dark:bg-[#113338] hover:bg-amber-50 dark:hover:bg-amber-900/40 hover:border-amber-300 text-[11px] font-medium text-slate-700 dark:text-teal-100 transition-colors shadow-xs"
                          >
                            <Calculator className="w-3 h-3" />
                            <span>Pajak</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintReceipt(rec)}
                            title="Cetak Tanda Terima Pemohon"
                            aria-label={`Cetak tanda terima ${rec.kode_berkas}`}
                            className="inline-flex items-center gap-1 px-1.5 py-1.5 rounded-lg border border-teal-900/12 dark:border-teal-400/20 bg-white dark:bg-[#113338] hover:bg-teal-50 dark:hover:bg-teal-800/60 text-[11px] font-medium text-slate-700 dark:text-teal-100 transition-colors shadow-xs"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Kwitansi</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRecord(rec.id)}
                            title="Hapus Berkas"
                            aria-label={`Hapus berkas ${rec.kode_berkas}`}
                            className="p-1.5 rounded-lg border border-transparent hover:border-rose-200 dark:hover:border-rose-700/60 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
