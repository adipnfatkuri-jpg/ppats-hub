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
 * Grand Line Cartography harmonious warm status badges:
 * soft parchment amber, calm ocean blue, muted jade emerald — zero thick borders.
 */
function statusStyle(status: BerkasStatus): {
  bg: string;
  text: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (status) {
    case '1. Pemberkasan':
      return {
        bg: 'bg-[#F2ECE0] dark:bg-[#19324A]',
        text: 'text-[#4B3F2F] dark:text-slate-200',
        Icon: FolderOpen,
      };
    case '2. Validasi':
      return {
        bg: 'bg-[#E5F1F5] dark:bg-cyan-950/60',
        text: 'text-[#124B5E] dark:text-cyan-200',
        Icon: ShieldCheck,
      };
    case '3. Ukur Ulang':
      return {
        bg: 'bg-[#E6F2EE] dark:bg-teal-950/60',
        text: 'text-[#16594A] dark:text-teal-200',
        Icon: Compass,
      };
    case '4. Analisis Bidang':
      return {
        bg: 'bg-[#E6EFF7] dark:bg-sky-950/60',
        text: 'text-[#164873] dark:text-sky-200',
        Icon: MapPin,
      };
    case '5. Pecah':
      return {
        bg: 'bg-[#F2EBF5] dark:bg-violet-950/60',
        text: 'text-[#55366B] dark:text-violet-200',
        Icon: Split,
      };
    case '6. Validasi Pajak':
      return {
        bg: 'bg-[#FEF3D9] dark:bg-amber-950/60',
        text: 'text-[#92400E] dark:text-amber-200',
        Icon: Clock,
      };
    case '7. Pengecekan':
      return {
        bg: 'bg-[#E4EDF6] dark:bg-blue-950/60',
        text: 'text-[#153E6B] dark:text-blue-200',
        Icon: FileSearch,
      };
    case '8. Proses BPN':
      return {
        bg: 'bg-[#E3ECF7] dark:bg-[#18385A]',
        text: 'text-[#0F2942] dark:text-sky-200',
        Icon: Building2,
      };
    case '9. Pelaporan':
      return {
        bg: 'bg-[#F5EBD9] dark:bg-amber-950/50',
        text: 'text-[#7C4A15] dark:text-amber-200',
        Icon: FileSpreadsheet,
      };
    case '10. Penerbitan':
      return {
        bg: 'bg-[#EAF4E4] dark:bg-emerald-950/50',
        text: 'text-[#285B2D] dark:text-emerald-200',
        Icon: Award,
      };
    case '11. Selesai':
      return {
        bg: 'bg-[#E2F3EB] dark:bg-emerald-950/65',
        text: 'text-[#115E3B] dark:text-emerald-200',
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

  const getFilterPillClasses = (
    st: 'SEMUA' | BerkasStatus,
    active: boolean
  ): { pill: string; badge: string } => {
    const activeRing = active
      ? 'ring-2 ring-[#F4C430] ring-offset-1 ring-offset-[#FFFAF0] dark:ring-offset-[#0B1F3A] shadow-md font-bold opacity-100'
      : 'opacity-85 hover:opacity-100 font-semibold';

    if (st === 'SEMUA') {
      return {
        pill: `bg-[#1E4D45] hover:bg-[#173D36] text-white border-[#14352F] ${activeRing}`,
        badge: 'bg-white text-[#1E4D45]',
      };
    }

    const stageNum = Number.parseInt(st.split('.')[0] || '0', 10);
    if (stageNum >= 1 && stageNum <= 4) {
      return {
        pill: `bg-[#B91C1C] hover:bg-[#991B1B] text-white border-[#7F1D1D] ${activeRing}`,
        badge: 'bg-white text-[#B91C1C]',
      };
    }

    return {
      pill: `bg-[#1E3A8A] hover:bg-[#172E6E] text-white border-[#152861] ${activeRing}`,
      badge: 'bg-white text-[#1E3A8A]',
    };
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Page Header — Translucent Parchment Title Plate over Grand Line Sky + Luffy Crimson CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="rounded-xl bg-[#FFFBF0]/85 dark:bg-[#0B1F3A]/85 backdrop-blur-sm border border-[#C89B3C]/70 px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-[0_4px_16px_rgba(11,31,58,0.18)] max-w-2xl">
          <h1 className="font-cinzel text-lg sm:text-[25px] font-extrabold tracking-tight text-[#0B1F3A] dark:text-[#F4C430] leading-snug">
            Dashboard &amp; Tracking Progres Berkas
          </h1>
          <p className="text-xs sm:text-sm text-[#4A3520] dark:text-slate-200 mt-0.5 font-medium leading-relaxed">
            Pemantauan berkas loket PPATS, validasi pajak daerah, penandatanganan akta, hingga proses balik nama BPN.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="btn-3d btn-grandline-crimson w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold whitespace-nowrap shrink-0"
        >
          <FilePlus2 className="w-4 h-4 shrink-0" />
          <span>+ Buat Berkas Baru</span>
        </button>
      </div>

      {/* 4 Wanted Poster / Wooden Parchment KPI Cards — 2x2 Grid on Mobile, 4-Column on Desktop */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5 pt-1 sm:pt-2">
        {/* Card 1: Total Berkas + Nami perched on top-right corner */}
        <div className="wanted-poster-card overflow-visible p-4 sm:p-5 flex items-start justify-between gap-2 sm:gap-3">
          {/* Decorative Nami Chibi Sticker (top-right corner, non-blocking on mobile & desktop) */}
          <img
            src="/nami-chibi.png"
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="pointer-events-none select-none absolute -top-5 -right-2 sm:-top-8 sm:-right-3.5 z-10 w-[44px] sm:w-[62px] lg:w-[66px] h-auto drop-shadow-[0_4px_8px_rgba(30,20,10,0.4)]"
          />
          <div className="relative z-10 min-w-0 sm:pr-5">
            <p className="text-[10.5px] sm:text-[11.5px] font-bold uppercase tracking-normal text-[#6B4423] dark:text-[#F4C430] truncate">
              Total Berkas ({kpis.activeLabel})
            </p>
            <p className="font-cinzel text-2xl sm:text-[34px] font-extrabold text-[#2B180A] dark:text-[#FEF3C7] mt-1 sm:mt-1.5 tabular-nums tracking-tight leading-none">
              {kpis.berkasBulanIni}
            </p>
            <p className="text-[11px] sm:text-xs font-medium text-[#6B4E31] dark:text-slate-300 mt-1.5 sm:mt-2 tabular-nums leading-tight">
              Dari total {records.length} berkas
            </p>
          </div>
          <div className="hidden sm:block relative z-10 self-end">
            <GlossyIcon3D tone="teal" size="sm">
              <FolderOpen className="w-4 h-4" />
            </GlossyIcon3D>
          </div>
        </div>

        {/* Card 2: Jumlah Akta Terbit */}
        <div className="wanted-poster-card p-4 sm:p-5 flex items-start justify-between gap-2 sm:gap-3">
          <div className="relative z-10 min-w-0">
            <p className="text-[10.5px] sm:text-xs font-bold uppercase tracking-wide text-[#6B4423] dark:text-[#F4C430] truncate">
              Akta Terbit
            </p>
            <p className="font-cinzel text-2xl sm:text-[34px] font-extrabold text-[#2B180A] dark:text-[#FEF3C7] mt-1 sm:mt-1.5 tabular-nums tracking-tight leading-none">
              {kpis.aktaTerbit}
            </p>
            <p className="text-[11px] sm:text-xs font-medium text-[#6B4E31] dark:text-slate-300 mt-1.5 sm:mt-2 leading-tight">
              Khusus Akta PPATS
            </p>
          </div>
          <div className="hidden sm:block relative z-10">
            <GlossyIcon3D tone="emerald" size="md">
              <FileCheck2 className="w-4.5 h-4.5" />
            </GlossyIcon3D>
          </div>
        </div>

        {/* Card 3: Highlighted Bounty Valuation KPI Card */}
        <div className="wanted-poster-card bounty-kpi-card p-4 sm:p-5 flex items-start justify-between gap-2 sm:gap-2.5">
          <div className="relative z-10 min-w-0 flex-1">
            <p className="text-[10.5px] sm:text-xs font-bold uppercase tracking-wide text-[#92400E] dark:text-[#F4C430] truncate">
              Nilai Transaksi
            </p>
            <p
              className="font-cinzel text-sm sm:text-lg 2xl:text-xl font-extrabold text-[#2B180A] dark:text-[#FDE68A] mt-1.5 sm:mt-2.5 tabular-nums tracking-tight truncate sm:whitespace-nowrap leading-tight"
              title={formatRupiah(kpis.totalNilaiTransaksi)}
            >
              {formatRupiah(kpis.totalNilaiTransaksi)}
            </p>
            <p className="text-[11px] sm:text-xs font-medium text-[#6B4E31] dark:text-slate-300 mt-1.5 sm:mt-2 leading-tight">
              Akumulasi peralihan hak
            </p>
          </div>
          <div className="hidden sm:block relative z-10">
            <GlossyIcon3D tone="amber" size="md">
              <Wallet className="w-4.5 h-4.5" />
            </GlossyIcon3D>
          </div>
        </div>

        {/* Card 4: Sedang Proses di BPN */}
        <div className="wanted-poster-card p-4 sm:p-5 flex items-start justify-between gap-2 sm:gap-3">
          <div className="relative z-10 min-w-0">
            <p className="text-[10.5px] sm:text-xs font-bold uppercase tracking-wide text-[#6B4423] dark:text-[#F4C430] truncate">
              Proses di BPN
            </p>
            <p className="font-cinzel text-2xl sm:text-[34px] font-extrabold text-[#1E3A8A] dark:text-sky-300 mt-1 sm:mt-1.5 tabular-nums tracking-tight leading-none">
              {kpis.prosesBpn}
            </p>
            <p className="text-[11px] sm:text-xs font-medium text-[#6B4E31] dark:text-slate-300 mt-1.5 sm:mt-2 leading-tight">
              Menunggu balik nama
            </p>
          </div>
          <div className="hidden sm:block relative z-10">
            <GlossyIcon3D tone="indigo" size="md">
              <Building2 className="w-4.5 h-4.5" />
            </GlossyIcon3D>
          </div>
        </div>
      </div>

      {/* Monitoring Berkas Container — Wooden/Rope Border + Semi-Transparent Cream + Decorative Zoro */}
      <div className="wanted-table-container">
        <div className="rounded-[9px] overflow-hidden">
          <div className="p-4 sm:p-5 border-b-2 border-[#C8B294]/70 dark:border-[#C89B3C]/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-cinzel text-base font-extrabold text-[#2B180A] dark:text-[#F4C430] tabular-nums">
                  Daftar &amp; Tracking Berkas ({filteredRecords.length})
                </h2>
                <p className="text-xs text-[#5C452B] dark:text-slate-300 mt-0.5 font-medium">
                  Filter 11 tahap proses berkas atau cari nama pihak, penerima, nomor akta, maupun NIB.
                </p>
              </div>
              {/* Clean Warm Search Input */}
              <div className="relative w-full sm:w-80 shrink-0">
                <Search className="w-4 h-4 text-[#6B4423] dark:text-[#F4C430] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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

            {/* 1-Row Horizontally Scrollable 11-Stage Filter (Teal Semua / Crimson 1-4 / Marine Blue 5-11) */}
            <div
              role="tablist"
              aria-label="Filter status berkas"
              className="flex items-center gap-2 overflow-x-auto no-scrollbar snap-x py-1 px-0.5"
            >
              {(['SEMUA', ...STATUS_OPTIONS] as const).map((st) => {
                const active = statusFilter === st;
                const count = statusCounts[st] ?? 0;
                const pillStyle = getFilterPillClasses(st, active);
                return (
                  <button
                    key={st}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatusFilter(st)}
                    className={`snap-start inline-flex items-center gap-1.5 min-h-[38px] sm:min-h-0 px-3 py-2 sm:py-1.5 rounded-full text-xs transition-all whitespace-nowrap shrink-0 border ${pillStyle.pill}`}
                  >
                    <span>{st === 'SEMUA' ? 'Semua Status' : st}</span>
                    <span
                      className={`inline-flex items-center justify-center min-w-[19px] h-[19px] px-1.5 rounded-full text-[10px] font-extrabold tabular-nums shadow-xs ${pillStyle.badge}`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center bg-[#EFF6FF]/80 dark:bg-[#0E2236]/80">
              <p className="text-sm font-bold text-[#0B1F3A] dark:text-[#F8FAFC]">
                Tidak ada berkas yang sesuai dengan filter saat ini.
              </p>
              <p className="text-xs text-[#5C452B] dark:text-slate-300 mt-1">
                Ubah kata kunci pencarian atau buat berkas pertanahan baru.
              </p>
              <button
                type="button"
                onClick={onCreateNew}
                className="btn-3d btn-grandline-crimson mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>+ Buat Berkas Baru</span>
              </button>
            </div>
          ) : (
            <>
              {/* Mobile-First Touch Card List (< md) — Zero horizontal scrolling on phones */}
              <div className="md:hidden divide-y divide-[#C8D8EC]/80 dark:divide-[#1E3A54] bg-[#EFF6FF]/85 dark:bg-[#0E2644]/85">
                {filteredRecords.map((rec) => {
                  const isAkta = isAktaService(rec.layanan);
                  const partySummary = extractDashboardParties(rec);
                  const currentStatus = normalizeBerkasStatus(rec.status);
                  const st = statusStyle(currentStatus);
                  const StIcon = st.Icon;
                  const isMenuOpen = openActionMenu?.record.id === rec.id;

                  return (
                    <article
                      key={rec.id}
                      className="p-3.5 space-y-3 active:bg-white/95 dark:active:bg-[#15355B]/95 transition-colors"
                    >
                      {/* Row 1: Kode, Layanan, and Nilai Transaksi */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-extrabold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                              {rec.kode_berkas}
                            </span>
                            <span className="text-[11px] font-bold text-[#6B4423] dark:text-[#F4C430]">
                              · {rec.layanan}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] text-[#475569] dark:text-slate-300 mt-0.5 tabular-nums truncate">
                            {isAkta
                              ? rec.akta.nomor_akta || 'Belum bernomor'
                              : 'Non-Akta (F4)'}{' '}
                            ·{' '}
                            {rec.akta.tanggal_akta
                              ? formatTanggalDDMMYYYY(rec.akta.tanggal_akta)
                              : 'Belum bertanggal'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold text-[#0B1F3A] dark:text-[#FDE68A] tabular-nums whitespace-nowrap">
                            {formatRupiah(rec.pajak.nilai_kesepakatan)}
                          </p>
                        </div>
                      </div>

                      {/* Row 2: Parties & Land Object */}
                      <div className="flex items-start gap-2.5">
                        <PartyAvatar3D name={partySummary.avatarName} />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100 truncate">
                            {partySummary.pihakPertamaText}
                            {partySummary.pihakPenerimaText &&
                            partySummary.pihakPenerimaText !== '-' ? (
                              <span className="font-medium text-[#475569] dark:text-slate-300">
                                {' '}
                                → {partySummary.pihakPenerimaText}
                              </span>
                            ) : null}
                          </p>
                          <p className="text-[11px] text-[#475569] dark:text-slate-300 truncate tabular-nums">
                            {rec.tanah.jenis_hak} · {rec.tanah.desa} ·{' '}
                            {formatNumberId(rec.tanah.luas_m2)} m²
                          </p>
                        </div>
                      </div>

                      {/* Row 3: 44px Touch Status Selector + Edit + More Actions */}
                      <div className="flex items-center gap-2 pt-0.5">
                        <div
                          className={`flex-1 min-w-0 min-h-[44px] inline-flex items-center gap-1.5 rounded-lg px-2.5 ${st.bg} ${st.text}`}
                        >
                          <StIcon className="w-3.5 h-3.5 shrink-0 opacity-85" />
                          <select
                            value={currentStatus}
                            aria-label={`Ubah status berkas ${rec.kode_berkas}`}
                            onChange={(e) =>
                              onChangeStatus(rec.id, e.target.value as BerkasStatus)
                            }
                            className="w-full min-w-0 bg-transparent text-xs font-semibold focus:outline-none cursor-pointer py-2"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option
                                key={opt}
                                value={opt}
                                className="bg-[#FFFDF9] dark:bg-[#0E2236] text-[#1E293B] dark:text-[#F8FAFC]"
                              >
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => onEditRecord(rec)}
                          aria-label={`Edit berkas ${rec.kode_berkas}`}
                          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-lg border border-[#BFA47C] dark:border-[#2C5174] bg-white dark:bg-[#132C44] active:bg-[#FBF3E0] dark:active:bg-[#1A3957] text-xs font-bold text-[#0B1F3A] dark:text-slate-100 shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#6B4423] dark:text-[#F4C430]" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleToggleRowMenu(e, rec)}
                          aria-haspopup="menu"
                          aria-expanded={isMenuOpen}
                          aria-label={`Aksi lainnya untuk ${rec.kode_berkas}`}
                          className={`inline-flex items-center justify-center w-11 h-11 rounded-lg border shrink-0 transition-colors ${
                            isMenuOpen
                              ? 'border-[#C89B3C] bg-[#FBF3E0] dark:bg-[#1A3957] text-[#0B1F3A] dark:text-[#F4C430]'
                              : 'border-[#BFA47C] dark:border-[#2C5174] bg-white dark:bg-[#132C44] text-[#4A3520] dark:text-slate-200'
                          }`}
                        >
                          <MoreVertical className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Desktop & Tablet Table View (md+) — Preserved 100% */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#C8B294]/80 dark:border-[#C89B3C]/40 bg-[#EFE3CC]/95 dark:bg-[#08192F]/90 text-[11px] font-bold uppercase tracking-wider text-[#3E2712] dark:text-[#F4C430]">
                    <th className="py-3.5 pl-4 pr-2 whitespace-nowrap">Kode &amp; No. Akta</th>
                    <th className="py-3.5 px-2 whitespace-nowrap">Layanan &amp; Tgl</th>
                    <th className="py-3.5 px-2 whitespace-nowrap">Pihak / Pemohon</th>
                    <th className="py-3.5 px-2 whitespace-nowrap">Pihak Penerima</th>
                    <th className="py-3.5 px-2 whitespace-nowrap">Objek Tanah</th>
                    <th className="py-3.5 px-2 text-right whitespace-nowrap">Nilai Transaksi</th>
                    <th className="py-3.5 px-2 whitespace-nowrap">Status Proses</th>
                    <th className="py-3.5 pl-2 pr-4 xl:pr-[78px] text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#C8D8EC]/80 dark:divide-[#1E3A54]">
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
                        className="bg-[#EFF6FF]/85 dark:bg-[#0E2644]/85 hover:bg-white/95 dark:hover:bg-[#15355B]/95 transition-colors"
                      >
                        <td className="py-4 pl-4 pr-2 align-middle whitespace-nowrap">
                          <div className="font-mono text-xs font-bold text-[#0B1F3A] dark:text-[#F8FAFC] tabular-nums">
                            {rec.kode_berkas}
                          </div>
                          <div className="font-mono text-[11px] text-[#475569] dark:text-slate-300 mt-0.5 tabular-nums">
                            {isAkta
                              ? rec.akta.nomor_akta || 'Belum bernomor'
                              : 'Non-Akta (F4)'}
                          </div>
                        </td>
                        <td className="py-4 px-2 align-middle whitespace-nowrap">
                          <div className="text-xs font-bold text-[#0F172A] dark:text-slate-100">
                            {rec.layanan}
                          </div>
                          <div className="text-[11px] text-[#475569] dark:text-slate-300 mt-0.5 tabular-nums">
                            {rec.akta.tanggal_akta
                              ? formatTanggalDDMMYYYY(rec.akta.tanggal_akta)
                              : 'Belum bertanggal'}
                          </div>
                          {!rec.akta.tanggal_akta && rec.tanggal_masuk && (
                            <div className="text-[10.5px] text-[#64748B] dark:text-slate-400 tabular-nums">
                              Masuk: {formatTanggalDDMMYYYY(rec.tanggal_masuk)}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-2 align-middle max-w-[148px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <PartyAvatar3D name={partySummary.avatarName} />
                            <div className="min-w-0 flex-1">
                              <div
                                className="text-xs font-bold text-[#0F172A] dark:text-slate-100 truncate"
                                title={partySummary.pihakPertamaText}
                              >
                                {partySummary.pihakPertamaText}
                              </div>
                              <div className="text-[11px] text-[#475569] dark:text-slate-300 truncate mt-0.5">
                                {partySummary.pihakPertamaLabel}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-2 align-middle max-w-[126px]">
                          <div
                            className="text-xs font-bold text-[#0F172A] dark:text-slate-100 truncate"
                            title={partySummary.pihakPenerimaText}
                          >
                            {partySummary.pihakPenerimaText}
                          </div>
                          <div className="text-[11px] text-[#475569] dark:text-slate-300 truncate mt-0.5">
                            {partySummary.pihakPenerimaLabel}
                          </div>
                        </td>
                        <td className="py-4 px-2 align-middle max-w-[144px]">
                          <div
                            className="text-xs font-semibold text-[#0F172A] dark:text-slate-100 truncate"
                            title={`${rec.tanah.jenis_hak} · ${rec.tanah.desa}`}
                          >
                            {rec.tanah.jenis_hak} · {rec.tanah.desa}
                          </div>
                          <div
                            className="text-[11px] text-[#475569] dark:text-slate-300 mt-0.5 tabular-nums truncate"
                            title={`${rec.tanah.nib || '-'} · ${formatNumberId(rec.tanah.luas_m2)} m²`}
                          >
                            {rec.tanah.nib || '-'} · {formatNumberId(rec.tanah.luas_m2)} m²
                          </div>
                        </td>
                        <td className="py-4 px-2 align-middle text-right text-xs font-bold text-[#0B1F3A] dark:text-[#FDE68A] tabular-nums whitespace-nowrap">
                          {formatRupiah(rec.pajak.nilai_kesepakatan)}
                        </td>
                        <td className="py-4 px-2 align-middle whitespace-nowrap">
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
                              className="bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer pr-0.5 max-w-[112px]"
                            >
                              {STATUS_OPTIONS.map((opt) => (
                                <option
                                  key={opt}
                                  value={opt}
                                  className="bg-[#FFFDF9] dark:bg-[#0E2236] text-[#1E293B] dark:text-[#F8FAFC]"
                                >
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="py-4 pl-2 pr-4 xl:pr-[78px] align-middle text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onEditRecord(rec)}
                              title="Edit / Buka Ulang Berkas"
                              aria-label={`Edit berkas ${rec.kode_berkas}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#BFA47C] dark:border-[#2C5174] bg-white dark:bg-[#132C44] hover:bg-[#FBF3E0] dark:hover:bg-[#1A3957] text-xs font-semibold text-[#0B1F3A] dark:text-slate-100 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-[#6B4423] dark:text-[#F4C430]" />
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
                                  ? 'border-[#C89B3C] bg-[#FBF3E0] dark:bg-[#1A3957] text-[#0B1F3A] dark:text-[#F4C430]'
                                  : 'border-[#BFA47C] dark:border-[#2C5174] bg-white dark:bg-[#132C44] hover:bg-[#FBF3E0] dark:hover:bg-[#1A3957] text-[#4A3520] dark:text-slate-200'
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
            </>
          )}

          {/* Subtle Bottom Bar creating safe breathing clearance for Zoro sticker */}
          <div className="px-4 py-3 sm:py-2.5 bg-[#EFE3CC]/85 dark:bg-[#08192F]/85 border-t border-[#C8B294]/70 dark:border-[#C89B3C]/35 text-[11px] font-medium text-[#5C452B] dark:text-slate-300 flex items-center justify-between pr-16 md:pr-28">
            <span className="tabular-nums">
              Menampilkan {filteredRecords.length} dari {records.length} berkas terdaftar
            </span>
          </div>
        </div>

        {/* Decorative Zoro Chibi Sticker (bottom-right corner of tracking container, never blocks Aksi) */}
        <img
          src="/zoro-chibi.png"
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="pointer-events-none select-none absolute -bottom-2.5 right-1 xl:-bottom-7 xl:-right-7 z-10 w-[56px] sm:w-[74px] xl:w-[100px] h-auto drop-shadow-[0_6px_12px_rgba(11,31,58,0.45)]"
        />
      </div>

      {/* Floating Fixed-Position Row Action Dropdown (never clipped by table overflow) */}
      {openActionMenu && (
        <div
          ref={actionMenuRef}
          role="menu"
          aria-label={`Menu aksi berkas ${openActionMenu.record.kode_berkas}`}
          style={{ top: openActionMenu.top, right: openActionMenu.right }}
          className="fixed z-50 w-48 rounded-xl border-2 border-[#6B4423] dark:border-[#C89B3C] bg-[#FFFBF0] dark:bg-[#0B1F3A] shadow-xl p-1.5"
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8C7D68] dark:text-slate-400 font-mono truncate">
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
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 text-left text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#F7F2E7] dark:hover:bg-[#163450] rounded-md transition-colors disabled:opacity-60"
          >
            {duplicatingId === openActionMenu.record.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#786B59] shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#786B59] dark:text-slate-400 shrink-0" />
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
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 text-left text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#F7F2E7] dark:hover:bg-[#163450] rounded-md transition-colors"
          >
            <Calculator className="w-3.5 h-3.5 text-[#786B59] dark:text-slate-400 shrink-0" />
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
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 text-left text-xs font-medium text-[#1E293B] dark:text-slate-200 hover:bg-[#F7F2E7] dark:hover:bg-[#163450] rounded-md transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-[#786B59] dark:text-slate-400 shrink-0" />
            <span>Cetak Kwitansi</span>
          </button>

          <div className="my-1 border-t border-[#EFE6D7] dark:border-[#1E3A54]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const targetId = openActionMenu.record.id;
              setOpenActionMenu(null);
              onDeleteRecord(targetId);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 text-left text-xs font-medium text-[#B91C1C] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Hapus Berkas</span>
          </button>
        </div>
      )}
    </div>
  );
};
