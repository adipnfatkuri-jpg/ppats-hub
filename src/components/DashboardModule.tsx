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
  ShieldCheck,
  Compass,
  MapPin,
  Split,
  FileSearch,
  FileSpreadsheet,
  Award,
} from 'lucide-react';
import { BerkasRecord, BerkasStatus } from '../types/ppats';
import { STATUS_OPTIONS } from '../utils/seedData';
import {
  extractDashboardParties,
  isAktaTerbitStatus,
  normalizeBerkasStatus,
} from '../utils/dashboardHelpers';
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
    case '2. Validasi':
      return {
        bg: 'bg-cyan-50 dark:bg-cyan-950/60',
        text: 'text-cyan-800 dark:text-cyan-200',
        border: 'border-cyan-300 dark:border-cyan-700/60',
        Icon: ShieldCheck,
      };
    case '3. Ukur Ulang':
      return {
        bg: 'bg-teal-50 dark:bg-teal-950/60',
        text: 'text-teal-800 dark:text-teal-200',
        border: 'border-teal-300 dark:border-teal-700/60',
        Icon: Compass,
      };
    case '4. Analisis Bidang':
      return {
        bg: 'bg-sky-50 dark:bg-sky-950/60',
        text: 'text-sky-800 dark:text-sky-200',
        border: 'border-sky-300 dark:border-sky-700/60',
        Icon: MapPin,
      };
    case '5. Pecah':
      return {
        bg: 'bg-violet-50 dark:bg-violet-950/60',
        text: 'text-violet-800 dark:text-violet-200',
        border: 'border-violet-300 dark:border-violet-700/60',
        Icon: Split,
      };
    case '6. Validasi Pajak':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/60',
        text: 'text-amber-800 dark:text-amber-200',
        border: 'border-amber-300 dark:border-amber-700/60',
        Icon: Clock,
      };
    case '7. Pengecekan':
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/60',
        text: 'text-blue-800 dark:text-blue-200',
        border: 'border-blue-300 dark:border-blue-700/60',
        Icon: FileSearch,
      };
    case '8. Proses BPN':
      return {
        bg: 'bg-indigo-50 dark:bg-indigo-950/60',
        text: 'text-indigo-800 dark:text-indigo-200',
        border: 'border-indigo-300 dark:border-indigo-700/60',
        Icon: Building2,
      };
    case '9. Pelaporan':
      return {
        bg: 'bg-purple-50 dark:bg-purple-950/60',
        text: 'text-purple-800 dark:text-purple-200',
        border: 'border-purple-300 dark:border-purple-700/60',
        Icon: FileSpreadsheet,
      };
    case '10. Penerbitan':
      return {
        bg: 'bg-lime-50 dark:bg-lime-950/60',
        text: 'text-lime-800 dark:text-lime-200',
        border: 'border-lime-300 dark:border-lime-700/60',
        Icon: Award,
      };
    case '11. Selesai':
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

    const aktaTerbit = records.filter((r) => {
      const st = normalizeBerkasStatus(r.status);
      return isAktaService(r.layanan) && (isAktaTerbitStatus(st) || Boolean(r.akta.nomor_akta?.trim()));
    }).length;

    const totalNilaiTransaksi = records.reduce(
      (sum, r) => sum + (r.pajak?.nilai_kesepakatan || 0),
      0
    );

    const prosesBpn = records.filter(
      (r) => normalizeBerkasStatus(r.status) === '8. Proses BPN'
    ).length;

    return { berkasBulanIni, aktaTerbit, totalNilaiTransaksi, prosesBpn, activeLabel };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...records]
      .sort((a, b) => b.no_urut - a.no_urut)
      .filter((r) => {
        const normalizedStatus = normalizeBerkasStatus(r.status);
        if (statusFilter !== 'SEMUA' && normalizedStatus !== statusFilter) return false;
        if (!q) return true;
        const partySummary = extractDashboardParties(r);
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
          partySummary.searchText,
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
        <div className="p-4 sm:p-5 border-b border-teal-900/10 dark:border-teal-400/15 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Daftar &amp; Tracking Berkas ({filteredRecords.length})
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-teal-200/70">
                Filter berdasarkan 11 tahap proses berkas atau cari nama pihak, penerima, no. akta, maupun NIB.
              </p>
            </div>
            {/* Airy Search Input */}
            <div className="relative w-full sm:w-80 shrink-0">
              <Search className="w-4 h-4 text-teal-700/60 dark:text-teal-300/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari pihak, penerima, no. akta, NIB..."
                aria-label="Cari berkas di papan monitoring"
                className="input-airy w-full pl-10 pr-3.5 py-2 text-sm"
              />
            </div>
          </div>

          {/* 3D Raised Status Filter Pills (Semua + 11 Tahap = 12 item -> 2 baris simetris 6×2) */}
          <div
            role="tablist"
            aria-label="Filter status berkas"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 p-1.5 bg-[#EAF3F1] dark:bg-[#081F22] rounded-2xl border border-teal-900/8 dark:border-teal-400/15 shadow-inner"
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
                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-150 whitespace-nowrap truncate text-center ${
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
                  <th className="py-3 px-2 whitespace-nowrap">Kode &amp; No. Akta</th>
                  <th className="py-3 px-1.5 whitespace-nowrap">Layanan &amp; Tgl</th>
                  <th className="py-3 px-1.5 whitespace-nowrap">Pihak / Pemohon</th>
                  <th className="py-3 px-1.5 whitespace-nowrap">Pihak Penerima</th>
                  <th className="py-3 px-1.5 whitespace-nowrap">Objek Tanah</th>
                  <th className="py-3 px-1.5 text-right whitespace-nowrap">Nilai Transaksi</th>
                  <th className="py-3 px-1.5 whitespace-nowrap">Status Proses</th>
                  <th className="py-3 px-2 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-900/8 dark:divide-teal-400/10">
                {filteredRecords.map((rec) => {
                  const isAkta = isAktaService(rec.layanan);
                  const partySummary = extractDashboardParties(rec);
                  const currentStatus = normalizeBerkasStatus(rec.status);
                  const st = statusStyle(currentStatus);
                  const StIcon = st.Icon;

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-teal-50/50 dark:hover:bg-teal-900/30 transition-colors"
                    >
                      <td className="py-3 px-2 align-middle whitespace-nowrap">
                        <div className="font-mono text-[11.5px] font-semibold text-slate-900 dark:text-white tabular-nums">
                          {rec.kode_berkas}
                        </div>
                        <div className="font-mono text-[10.5px] text-slate-500 dark:text-teal-200/70 mt-0.5 tabular-nums">
                          {isAkta
                            ? rec.akta.nomor_akta || 'Belum bernomor'
                            : 'Non-Akta (F4)'}
                        </div>
                      </td>
                      <td className="py-3 px-1.5 align-middle whitespace-nowrap">
                        <div className="text-[11.5px] font-semibold text-slate-900 dark:text-teal-50">
                          {rec.layanan}
                        </div>
                        <div className="font-mono text-[10.5px] text-slate-600 dark:text-teal-200/75 mt-0.5 tabular-nums">
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
                      <td className="py-3 px-1.5 align-middle max-w-[140px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <PartyAvatar3D name={partySummary.avatarName} />
                          <div className="min-w-0 flex-1">
                            <div
                              className="text-[11.5px] font-semibold text-slate-800 dark:text-teal-50 truncate"
                              title={partySummary.pihakPertamaText}
                            >
                              {partySummary.pihakPertamaText}
                            </div>
                            <div className="text-[10px] font-medium text-teal-700/80 dark:text-teal-300/75 truncate mt-0.5">
                              {partySummary.pihakPertamaLabel}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-1.5 align-middle max-w-[128px]">
                        <div
                          className="text-[11.5px] font-semibold text-slate-800 dark:text-teal-50 truncate"
                          title={partySummary.pihakPenerimaText}
                        >
                          {partySummary.pihakPenerimaText}
                        </div>
                        <div className="text-[10px] font-medium text-sky-700/85 dark:text-sky-300/80 truncate mt-0.5">
                          {partySummary.pihakPenerimaLabel}
                        </div>
                      </td>
                      <td className="py-3 px-1.5 align-middle max-w-[106px]">
                        <div
                          className="text-[11.5px] font-semibold text-slate-900 dark:text-teal-50 truncate"
                          title={`${rec.tanah.jenis_hak} · ${rec.tanah.desa}`}
                        >
                          {rec.tanah.jenis_hak} · {rec.tanah.desa}
                        </div>
                        <div
                          className="font-mono text-[10.5px] text-slate-500 dark:text-teal-200/70 mt-0.5 tabular-nums truncate"
                          title={`${rec.tanah.nib || '-'} · ${formatNumberId(rec.tanah.luas_m2)} m²`}
                        >
                          {rec.tanah.nib || '-'} · {formatNumberId(rec.tanah.luas_m2)} m²
                        </div>
                      </td>
                      <td className="py-3 px-1.5 align-middle text-right font-mono text-[11.5px] font-semibold text-slate-900 dark:text-teal-50 tabular-nums whitespace-nowrap">
                        {formatRupiah(rec.pajak.nilai_kesepakatan)}
                      </td>
                      <td className="py-3 px-1.5 align-middle whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <StIcon className={`w-3.5 h-3.5 shrink-0 ${st.text}`} />
                          <select
                            value={currentStatus}
                            aria-label={`Ubah status berkas ${rec.kode_berkas}`}
                            onChange={(e) =>
                              onChangeStatus(rec.id, e.target.value as BerkasStatus)
                            }
                            className={`w-[126px] text-[10.5px] font-semibold rounded-xl border px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer ${st.bg} ${st.text} ${st.border}`}
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
                      <td className="py-3 px-2 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditRecord(rec)}
                            title="Edit / Buka Ulang Berkas"
                            aria-label={`Edit berkas ${rec.kode_berkas}`}
                            className="inline-flex items-center gap-1 px-1.5 py-1 rounded-lg border border-teal-900/12 dark:border-teal-400/20 bg-white dark:bg-[#113338] hover:bg-teal-50 dark:hover:bg-teal-800/60 text-[10.5px] font-medium text-slate-700 dark:text-teal-100 transition-colors shadow-xs"
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
                            className="inline-flex items-center gap-1 px-1.5 py-1 rounded-lg border border-teal-900/12 dark:border-teal-400/20 bg-white dark:bg-[#113338] hover:bg-sky-50 dark:hover:bg-sky-900/50 hover:border-sky-300 hover:text-sky-800 dark:hover:text-sky-200 text-[10.5px] font-medium text-slate-700 dark:text-teal-100 transition-colors disabled:opacity-60 shadow-xs"
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
                            className="inline-flex items-center gap-1 px-1.5 py-1 rounded-lg border border-teal-900/12 dark:border-teal-400/20 bg-white dark:bg-[#113338] hover:bg-amber-50 dark:hover:bg-amber-900/40 hover:border-amber-300 text-[10.5px] font-medium text-slate-700 dark:text-teal-100 transition-colors shadow-xs"
                          >
                            <Calculator className="w-3 h-3" />
                            <span>Pajak</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintReceipt(rec)}
                            title="Cetak Tanda Terima Pemohon"
                            aria-label={`Cetak tanda terima ${rec.kode_berkas}`}
                            className="inline-flex items-center gap-1 px-1.5 py-1 rounded-lg border border-teal-900/12 dark:border-teal-400/20 bg-white dark:bg-[#113338] hover:bg-teal-50 dark:hover:bg-teal-800/60 text-[10.5px] font-medium text-slate-700 dark:text-teal-100 transition-colors shadow-xs"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Kwitansi</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRecord(rec.id)}
                            title="Hapus Berkas"
                            aria-label={`Hapus berkas ${rec.kode_berkas}`}
                            className="p-1 rounded-lg border border-transparent hover:border-rose-200 dark:hover:border-rose-700/60 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors"
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
