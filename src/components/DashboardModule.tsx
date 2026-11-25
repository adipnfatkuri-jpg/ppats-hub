import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  MoreVertical,
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

/**
 * Calm pastel legal-tech status badges: soft tinted fill with high-contrast dark text,
 * zero thick borders.
 */
function statusStyle(status: BerkasStatus): {
  bg: string;
  text: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (status) {
    case '1. Pemberkasan':
      return {
        bg: 'bg-slate-100 dark:bg-slate-800',
        text: 'text-slate-700 dark:text-slate-200',
        Icon: FolderOpen,
      };
    case '2. Validasi':
      return {
        bg: 'bg-cyan-50 dark:bg-cyan-950/60',
        text: 'text-cyan-800 dark:text-cyan-200',
        Icon: ShieldCheck,
      };
    case '3. Ukur Ulang':
      return {
        bg: 'bg-teal-50 dark:bg-teal-950/60',
        text: 'text-teal-800 dark:text-teal-200',
        Icon: Compass,
      };
    case '4. Analisis Bidang':
      return {
        bg: 'bg-sky-50 dark:bg-sky-950/60',
        text: 'text-sky-800 dark:text-sky-200',
        Icon: MapPin,
      };
    case '5. Pecah':
      return {
        bg: 'bg-violet-50 dark:bg-violet-950/60',
        text: 'text-violet-800 dark:text-violet-200',
        Icon: Split,
      };
    case '6. Validasi Pajak':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/60',
        text: 'text-amber-800 dark:text-amber-200',
        Icon: Clock,
      };
    case '7. Pengecekan':
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/60',
        text: 'text-blue-800 dark:text-blue-200',
        Icon: FileSearch,
      };
    case '8. Proses BPN':
      return {
        bg: 'bg-indigo-50 dark:bg-indigo-950/60',
        text: 'text-indigo-800 dark:text-indigo-200',
        Icon: Building2,
      };
    case '9. Pelaporan':
      return {
        bg: 'bg-purple-50 dark:bg-purple-950/60',
        text: 'text-purple-800 dark:text-purple-200',
        Icon: FileSpreadsheet,
      };
    case '10. Penerbitan':
      return {
        bg: 'bg-lime-50 dark:bg-lime-950/60',
        text: 'text-lime-800 dark:text-lime-200',
        Icon: Award,
      };
    case '11. Selesai':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/60',
        text: 'text-emerald-800 dark:text-emerald-200',
        Icon: CheckCircle2,
      };
  }
}

interface ActionMenuState {
  record: BerkasRecord;
  top: number;
  right: number;
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
  const [openActionMenu, setOpenActionMenu] = useState<ActionMenuState | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openActionMenu) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(e.target as Node)
      ) {
        setOpenActionMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenActionMenu(null);
      }
    };
    const handleViewportChange = () => {
      setOpenActionMenu(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [openActionMenu]);

  const handleToggleRowMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    rec: BerkasRecord
  ) => {
    e.stopPropagation();
    if (openActionMenu?.record.id === rec.id) {
      setOpenActionMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const estimatedMenuHeight = 188;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight;
    const top = openUpward
      ? Math.max(8, rect.top - estimatedMenuHeight - 6)
      : rect.bottom + 6;
    const right = Math.max(12, window.innerWidth - rect.right);
    setOpenActionMenu({ record: rec, top, right });
  };

  const handleDuplicateClick = async (rec: BerkasRecord) => {
    if (duplicatingId) return;
    setDuplicatingId(rec.id);
    try {
      await onDuplicateRecord(rec);
    } finally {
      setDuplicatingId(null);
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { SEMUA: records.length };
    for (const st of STATUS_OPTIONS) {
      counts[st] = 0;
    }
    for (const r of records) {
      const normalized = normalizeBerkasStatus(r.status);
      counts[normalized] = (counts[normalized] || 0) + 1;
    }
    return counts;
  }, [records]);

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
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#1E293B] dark:text-white">
            Dashboard &amp; Tracking Progres Berkas
          </h1>
          <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
            Pemantauan berkas loket PPATS, validasi pajak daerah, penandatanganan akta, hingga proses balik nama BPN.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="btn-3d btn-3d-teal inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0"
        >
          <FilePlus2 className="w-4 h-4" />
          <span>Buat Berkas Baru</span>
        </button>
      </div>

      {/* 4 Flat-Modern Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bento-card bento-card-hover p-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#64748B] dark:text-slate-400">
              Total Berkas ({kpis.activeLabel})
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-[#1E293B] dark:text-white mt-2 tabular-nums tracking-tight">
              {kpis.berkasBulanIni}
            </p>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1.5 tabular-nums">
              Dari total {records.length} berkas terdaftar
            </p>
          </div>
          <GlossyIcon3D tone="teal" size="md">
            <FolderOpen className="w-4.5 h-4.5" />
          </GlossyIcon3D>
        </div>

        <div className="bento-card bento-card-hover p-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#64748B] dark:text-slate-400">
              Jumlah Akta Terbit
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-[#1E293B] dark:text-white mt-2 tabular-nums tracking-tight">
              {kpis.aktaTerbit}
            </p>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1.5">
              Khusus Akta PPATS (non Non-Akta)
            </p>
          </div>
          <GlossyIcon3D tone="emerald" size="md">
            <FileCheck2 className="w-4.5 h-4.5" />
          </GlossyIcon3D>
        </div>

        <div className="bento-card bento-card-hover p-5 flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#64748B] dark:text-slate-400">
              Total Nilai Transaksi
            </p>
            <p
              className="text-lg 2xl:text-xl font-bold text-[#1E293B] dark:text-white mt-2.5 tabular-nums tracking-tight whitespace-nowrap"
              title={formatRupiah(kpis.totalNilaiTransaksi)}
            >
              {formatRupiah(kpis.totalNilaiTransaksi)}
            </p>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1.5">
              Akumulasi nilai peralihan hak
            </p>
          </div>
          <GlossyIcon3D tone="amber" size="md">
            <Wallet className="w-4.5 h-4.5" />
          </GlossyIcon3D>
        </div>

        <div className="bento-card bento-card-hover p-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#64748B] dark:text-slate-400">
              Sedang Proses di BPN
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-[#0F4C5C] dark:text-emerald-400 mt-2 tabular-nums tracking-tight">
              {kpis.prosesBpn}
            </p>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1.5">
              Menunggu sertipikat balik nama
            </p>
          </div>
          <GlossyIcon3D tone="indigo" size="md">
            <Building2 className="w-4.5 h-4.5" />
          </GlossyIcon3D>
        </div>
      </div>

      {/* Monitoring Berkas Card */}
      <div className="bento-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#1E293B] dark:text-white tabular-nums">
                Daftar &amp; Tracking Berkas ({filteredRecords.length})
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                Filter 11 tahap proses berkas atau cari nama pihak, penerima, nomor akta, maupun NIB.
              </p>
            </div>
            {/* Clean Flat Search Input */}
            <div className="relative w-full sm:w-80 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari pihak, penerima, no. akta, NIB..."
                aria-label="Cari berkas di papan monitoring"
                className="input-airy w-full pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Compact 1-Row Horizontally Scrollable 11-Stage Status Filter with Counts */}
          <div
            role="tablist"
            aria-label="Filter status berkas"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1"
          >
            {(['SEMUA', ...STATUS_OPTIONS] as const).map((st) => {
              const active = statusFilter === st;
              const count = statusCounts[st] ?? 0;
              return (
                <button
                  key={st}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(st)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#064E3B] dark:bg-emerald-700 text-white'
                      : 'bg-slate-100/80 dark:bg-slate-800/80 text-[#64748B] dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 hover:text-[#1E293B] dark:hover:text-white'
                  }`}
                >
                  <span>{st === 'SEMUA' ? 'Semua Status' : st}</span>
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md text-[10px] font-semibold tabular-nums ${
                      active
                        ? 'bg-white/20 text-white'
                        : count > 0
                          ? 'bg-white dark:bg-slate-900 text-[#1E293B] dark:text-slate-200 border border-slate-200/80 dark:border-slate-700'
                          : 'bg-transparent text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-[#1E293B] dark:text-slate-100">
              Tidak ada berkas yang sesuai dengan filter saat ini.
            </p>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
              Ubah kata kunci pencarian atau buat berkas pertanahan baru.
            </p>
            <button
              type="button"
              onClick={onCreateNew}
              className="btn-3d btn-3d-teal mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>Buat Berkas Baru</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                  <th className="py-3.5 pl-4 pr-2.5 whitespace-nowrap">Kode &amp; No. Akta</th>
                  <th className="py-3.5 px-2.5 whitespace-nowrap">Layanan &amp; Tgl</th>
                  <th className="py-3.5 px-2.5 whitespace-nowrap">Pihak / Pemohon</th>
                  <th className="py-3.5 px-2.5 whitespace-nowrap">Pihak Penerima</th>
                  <th className="py-3.5 px-2.5 whitespace-nowrap">Objek Tanah</th>
                  <th className="py-3.5 px-2.5 text-right whitespace-nowrap">Nilai Transaksi</th>
                  <th className="py-3.5 px-2.5 whitespace-nowrap">Status Proses</th>
                  <th className="py-3.5 pl-2.5 pr-4 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredRecords.map((rec) => {
                  const isAkta = isAktaService(rec.layanan);
                  const partySummary = extractDashboardParties(rec);
                  const currentStatus = normalizeBerkasStatus(rec.status);
                  const st = statusStyle(currentStatus);
                  const StIcon = st.Icon;
                  const isMenuOpen = openActionMenu?.record.id === rec.id;

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-4 pl-4 pr-2.5 align-middle whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-[#1E293B] dark:text-white tabular-nums">
                          {rec.kode_berkas}
                        </div>
                        <div className="font-mono text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 tabular-nums">
                          {isAkta
                            ? rec.akta.nomor_akta || 'Belum bernomor'
                            : 'Non-Akta (F4)'}
                        </div>
                      </td>
                      <td className="py-4 px-2.5 align-middle whitespace-nowrap">
                        <div className="text-xs font-semibold text-[#1E293B] dark:text-slate-100">
                          {rec.layanan}
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 tabular-nums">
                          {rec.akta.tanggal_akta
                            ? formatTanggalDDMMYYYY(rec.akta.tanggal_akta)
                            : 'Belum bertanggal'}
                        </div>
                        {!rec.akta.tanggal_akta && rec.tanggal_masuk && (
                          <div className="text-[10.5px] text-slate-400 dark:text-slate-500 tabular-nums">
                            Masuk: {formatTanggalDDMMYYYY(rec.tanggal_masuk)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-2.5 align-middle max-w-[164px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <PartyAvatar3D name={partySummary.avatarName} />
                          <div className="min-w-0 flex-1">
                            <div
                              className="text-xs font-semibold text-[#1E293B] dark:text-slate-100 truncate"
                              title={partySummary.pihakPertamaText}
                            >
                              {partySummary.pihakPertamaText}
                            </div>
                            <div className="text-[11px] text-[#64748B] dark:text-slate-400 truncate mt-0.5">
                              {partySummary.pihakPertamaLabel}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2.5 align-middle max-w-[140px]">
                        <div
                          className="text-xs font-semibold text-[#1E293B] dark:text-slate-100 truncate"
                          title={partySummary.pihakPenerimaText}
                        >
                          {partySummary.pihakPenerimaText}
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-slate-400 truncate mt-0.5">
                          {partySummary.pihakPenerimaLabel}
                        </div>
                      </td>
                      <td className="py-4 px-2.5 align-middle max-w-[162px]">
                        <div
                          className="text-xs font-medium text-[#1E293B] dark:text-slate-100 truncate"
                          title={`${rec.tanah.jenis_hak} · ${rec.tanah.desa}`}
                        >
                          {rec.tanah.jenis_hak} · {rec.tanah.desa}
                        </div>
                        <div
                          className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 tabular-nums truncate"
                          title={`${rec.tanah.nib || '-'} · ${formatNumberId(rec.tanah.luas_m2)} m²`}
                        >
                          {rec.tanah.nib || '-'} · {formatNumberId(rec.tanah.luas_m2)} m²
                        </div>
                      </td>
                      <td className="py-4 px-2.5 align-middle text-right text-xs font-semibold text-[#1E293B] dark:text-slate-100 tabular-nums whitespace-nowrap">
                        {formatRupiah(rec.pajak.nilai_kesepakatan)}
                      </td>
                      <td className="py-4 px-2.5 align-middle whitespace-nowrap">
                        <div
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 ${st.bg} ${st.text}`}
                        >
                          <StIcon className="w-3.5 h-3.5 shrink-0 opacity-85" />
                          <select
                            value={currentStatus}
                            aria-label={`Ubah status berkas ${rec.kode_berkas}`}
                            onChange={(e) =>
                              onChangeStatus(rec.id, e.target.value as BerkasStatus)
                            }
                            className="bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer pr-0.5 max-w-[116px]"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option
                                key={opt}
                                value={opt}
                                className="bg-white dark:bg-[#111827] text-slate-900 dark:text-slate-100"
                              >
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-4 pl-2.5 pr-4 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditRecord(rec)}
                            title="Edit / Buka Ulang Berkas"
                            aria-label={`Edit berkas ${rec.kode_berkas}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-[#1E293B] dark:text-slate-100 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleToggleRowMenu(e, rec)}
                            aria-haspopup="menu"
                            aria-expanded={isMenuOpen}
                            aria-label={`Aksi lainnya untuk ${rec.kode_berkas}`}
                            title="Aksi lainnya (Salin, Pajak, Kwitansi, Hapus)"
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
                              isMenuOpen
                                ? 'border-[#064E3B] dark:border-emerald-500 bg-slate-100 dark:bg-slate-800 text-[#064E3B] dark:text-emerald-300'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300'
                            }`}
                          >
                            <MoreVertical className="w-4 h-4" />
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

      {/* Floating Fixed-Position Row Action Dropdown (never clipped by table overflow) */}
      {openActionMenu && (
        <div
          ref={actionMenuRef}
          role="menu"
          aria-label={`Menu aksi berkas ${openActionMenu.record.kode_berkas}`}
          style={{ top: openActionMenu.top, right: openActionMenu.right }}
          className="fixed z-50 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-md p-1.5"
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono truncate">
            {openActionMenu.record.kode_berkas}
          </div>

          <button
            type="button"
            role="menuitem"
            disabled={duplicatingId !== null}
            onClick={() => {
              const target = openActionMenu.record;
              setOpenActionMenu(null);
              void handleDuplicateClick(target);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors disabled:opacity-60"
          >
            {duplicatingId === openActionMenu.record.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            )}
            <span>Salin / Duplikasi</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const target = openActionMenu.record;
              setOpenActionMenu(null);
              onCalculateTax(target);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors"
          >
            <Calculator className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span>Perhitungan Pajak</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const target = openActionMenu.record;
              setOpenActionMenu(null);
              onPrintReceipt(target);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
            <span>Cetak Kwitansi</span>
          </button>

          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const targetId = openActionMenu.record.id;
              setOpenActionMenu(null);
              onDeleteRecord(targetId);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Hapus Berkas</span>
          </button>
        </div>
      )}
    </div>
  );
};
