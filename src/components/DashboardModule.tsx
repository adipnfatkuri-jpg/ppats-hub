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
 * Sakamoto Days Dark Mode status badges: thin 1px border with soft dark-pastel
 * tints (warm amber for Validasi Pajak, soft blue for BPN, soft emerald for Selesai).
 */
function statusStyle(status: BerkasStatus): {
  bg: string;
  text: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (status) {
    case '1. Pemberkasan':
      return {
        bg: 'bg-white/[0.06] border border-white/[0.14]',
        text: 'text-slate-200',
        Icon: FolderOpen,
      };
    case '2. Validasi':
      return {
        bg: 'bg-sky-400/10 border border-sky-300/25',
        text: 'text-sky-200',
        Icon: ShieldCheck,
      };
    case '3. Ukur Ulang':
      return {
        bg: 'bg-emerald-400/10 border border-emerald-300/25',
        text: 'text-emerald-200',
        Icon: Compass,
      };
    case '4. Analisis Bidang':
      return {
        bg: 'bg-sky-400/10 border border-sky-300/25',
        text: 'text-sky-200',
        Icon: MapPin,
      };
    case '5. Pecah':
      return {
        bg: 'bg-rose-400/10 border border-rose-300/25',
        text: 'text-rose-200',
        Icon: Split,
      };
    case '6. Validasi Pajak':
      return {
        bg: 'bg-amber-400/10 border border-amber-300/25',
        text: 'text-amber-200',
        Icon: Clock,
      };
    case '7. Pengecekan':
      return {
        bg: 'bg-sky-400/10 border border-sky-300/25',
        text: 'text-sky-200',
        Icon: FileSearch,
      };
    case '8. Proses BPN':
      return {
        bg: 'bg-sky-400/12 border border-sky-300/28',
        text: 'text-sky-200',
        Icon: Building2,
      };
    case '9. Pelaporan':
      return {
        bg: 'bg-amber-400/10 border border-amber-300/25',
        text: 'text-amber-200',
        Icon: FileSpreadsheet,
      };
    case '10. Penerbitan':
      return {
        bg: 'bg-emerald-400/10 border border-emerald-300/25',
        text: 'text-emerald-200',
        Icon: Award,
      };
    case '11. Selesai':
      return {
        bg: 'bg-emerald-400/12 border border-emerald-300/28',
        text: 'text-emerald-200',
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
    _st: 'SEMUA' | BerkasStatus,
    active: boolean
  ): { pill: string; badge: string } => {
    if (active) {
      return {
        pill: 'bg-[#FACC15] text-[#0E1014] font-bold shadow-[0_2px_10px_rgba(250,204,21,0.28)] border border-[#FACC15]',
        badge: 'bg-[#0E1014]/85 text-[#FACC15]',
      };
    }

    return {
      pill: 'bg-[#252A34] hover:bg-[#2F3643] text-[#CBD5E1] hover:text-[#F8FAFC] border border-white/[0.08] hover:border-white/[0.18] font-medium',
      badge: 'bg-[#0E1014]/70 text-[#94A3B8]',
    };
  };

  return (
    <div className="space-y-5 pb-4">
      {/* Page Header — Dark Charcoal #171A21 Plate + Warm Manga Yellow Heading + Crimson CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="rounded-[14px] bg-[#171A21]/92 backdrop-blur-md border border-white/[0.08] border-l-[3px] border-l-[#FACC15] px-4 py-3 sm:px-5 sm:py-3.5 shadow-[0_8px_22px_rgba(0,0,0,0.42)] max-w-2xl">
          <h1 className="text-[17px] sm:text-[24px] font-extrabold tracking-tight text-[#FACC15] leading-snug">
            Dashboard &amp; Tracking Progres Berkas
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5 font-medium leading-relaxed">
            Pemantauan berkas loket PPATS, validasi pajak daerah, penandatanganan akta, hingga proses balik nama BPN.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="btn-3d btn-grandline-crimson w-full sm:w-auto h-[40px] sm:h-[42px] inline-flex items-center justify-center gap-2 px-5 text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0"
        >
          <FilePlus2 className="w-4 h-4 shrink-0" />
          <span>+ Buat Berkas Baru</span>
        </button>
      </div>

      {/* 4 Cohesive Dark Charcoal KPI Cards with Refined Accent Strips */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Berkas — Warm Manga Yellow (#FACC15) */}
        <div className="wanted-poster-card flex flex-col">
          <div className="h-[4px] w-full bg-[#FACC15] shrink-0" aria-hidden="true" />
          <div className="p-3 sm:p-4 flex items-start justify-between gap-2 flex-1">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-[#FACC15] truncate">
                Total Berkas ({kpis.activeLabel})
              </p>
              <p className="text-[24px] sm:text-[32px] font-extrabold text-[#F8FAFC] mt-1 tabular-nums tracking-tight leading-none">
                {kpis.berkasBulanIni}
              </p>
              <p className="text-[11px] font-medium text-[#94A3B8] mt-1.5 tabular-nums leading-tight">
                Dari total {records.length} berkas
              </p>
            </div>
            <div className="shrink-0">
              <GlossyIcon3D tone="amber" size="xs" className="sm:w-9 sm:h-9">
                <FolderOpen className="w-4 h-4" />
              </GlossyIcon3D>
            </div>
          </div>
        </div>

        {/* Card 2: Jumlah Akta Terbit — Soft Emerald */}
        <div className="wanted-poster-card flex flex-col">
          <div className="h-[4px] w-full bg-emerald-400/90 shrink-0" aria-hidden="true" />
          <div className="p-3 sm:p-4 flex items-start justify-between gap-2 flex-1">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-emerald-300 truncate">
                Akta Terbit
              </p>
              <p className="text-[24px] sm:text-[32px] font-extrabold text-[#F8FAFC] mt-1 tabular-nums tracking-tight leading-none">
                {kpis.aktaTerbit}
              </p>
              <p className="text-[11px] font-medium text-[#94A3B8] mt-1.5 leading-tight">
                Khusus Akta PPATS
              </p>
            </div>
            <div className="shrink-0">
              <GlossyIcon3D tone="emerald" size="xs" className="sm:w-9 sm:h-9">
                <FileCheck2 className="w-4 h-4" />
              </GlossyIcon3D>
            </div>
          </div>
        </div>

        {/* Card 3: Nilai Transaksi — Crimson Accent */}
        <div className="wanted-poster-card bounty-kpi-card flex flex-col">
          <div className="h-[4px] w-full bg-[#EF4444] shrink-0" aria-hidden="true" />
          <div className="p-3 sm:p-4 flex items-start justify-between gap-1.5 sm:gap-2 flex-1">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-rose-300 truncate">
                Nilai Transaksi
              </p>
              <p
                className="text-[13px] sm:text-lg 2xl:text-xl font-extrabold text-[#FACC15] mt-1.5 sm:mt-2 tabular-nums tracking-tight truncate sm:whitespace-nowrap leading-tight"
                title={formatRupiah(kpis.totalNilaiTransaksi)}
              >
                {formatRupiah(kpis.totalNilaiTransaksi)}
              </p>
              <p className="text-[11px] font-medium text-[#94A3B8] mt-1.5 leading-tight">
                Akumulasi peralihan hak
              </p>
            </div>
            <div className="shrink-0">
              <GlossyIcon3D tone="rose" size="xs" className="sm:w-9 sm:h-9">
                <Wallet className="w-4 h-4" />
              </GlossyIcon3D>
            </div>
          </div>
        </div>

        {/* Card 4: Sedang Proses di BPN — Soft Sky Blue */}
        <div className="wanted-poster-card flex flex-col">
          <div className="h-[4px] w-full bg-sky-400/90 shrink-0" aria-hidden="true" />
          <div className="p-3 sm:p-4 flex items-start justify-between gap-2 flex-1">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-sky-300 truncate">
                Proses di BPN
              </p>
              <p className="text-[24px] sm:text-[32px] font-extrabold text-[#F8FAFC] mt-1 tabular-nums tracking-tight leading-none">
                {kpis.prosesBpn}
              </p>
              <p className="text-[11px] font-medium text-[#94A3B8] mt-1.5 leading-tight">
                Menunggu balik nama
              </p>
            </div>
            <div className="shrink-0">
              <GlossyIcon3D tone="sky" size="xs" className="sm:w-9 sm:h-9">
                <Building2 className="w-4 h-4" />
              </GlossyIcon3D>
            </div>
          </div>
        </div>
      </div>

      {/* Monitoring Berkas Container — Dark Charcoal #171A21 + Thin Uniform Border */}
      <div className="wanted-table-container overflow-hidden">
        <div>
          <div className="p-3.5 sm:p-5 border-b border-white/[0.08] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div>
                <h2 className="text-[15px] sm:text-base font-extrabold text-[#FACC15] tabular-nums tracking-tight">
                  Daftar &amp; Tracking Berkas ({filteredRecords.length})
                </h2>
                <p className="text-[11.5px] text-[#94A3B8] mt-0.5 font-medium">
                  Filter 11 tahap proses berkas atau cari nama pihak, penerima, nomor akta, maupun NIB.
                </p>
              </div>
              {/* Crisp Matte Black Search Input */}
              <div className="relative w-full sm:w-72 shrink-0">
                <Search className="w-3.5 h-3.5 text-[#FACC15] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari pihak, penerima, no. akta, NIB..."
                  aria-label="Cari berkas di papan monitoring"
                  className="input-airy w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* 1-Row Horizontally Scrollable 11-Stage Filter (No Scrollbar, Slim Pills) */}
            <div
              role="tablist"
              aria-label="Filter status berkas"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar snap-x py-0.5"
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
                    className={`snap-start inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[11.5px] transition-all whitespace-nowrap shrink-0 ${pillStyle.pill}`}
                  >
                    <span>{st === 'SEMUA' ? 'Semua Status' : st}</span>
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums ${pillStyle.badge}`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="p-10 text-center bg-transparent">
              <p className="text-sm font-bold text-[#F8FAFC]">
                Tidak ada berkas yang sesuai dengan filter saat ini.
              </p>
              <p className="text-xs text-[#94A3B8] mt-1">
                Ubah kata kunci pencarian atau buat berkas pertanahan baru.
              </p>
              <button
                type="button"
                onClick={onCreateNew}
                className="btn-3d btn-grandline-crimson mt-4 inline-flex items-center gap-2 px-5 py-2 text-xs font-extrabold"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>+ Buat Berkas Baru</span>
              </button>
            </div>
          ) : (
            <>
              {/* Mobile-First Wanted Poster Card List (< md) — Monospaced Serial & Technical Details */}
              <div className="md:hidden p-2.5 space-y-2.5 bg-[#0E1014]/55">
                {filteredRecords.map((rec, idx) => {
                  const isAkta = isAktaService(rec.layanan);
                  const partySummary = extractDashboardParties(rec);
                  const currentStatus = normalizeBerkasStatus(rec.status);
                  const st = statusStyle(currentStatus);
                  const StIcon = st.Icon;
                  const isMenuOpen = openActionMenu?.record.id === rec.id;
                  const serialNo = `#${String(idx + 1).padStart(2, '0')}`;

                  return (
                    <article
                      key={rec.id}
                      data-testid="wanted-poster-card-row"
                      className="wanted-poster-mobile-card px-[13px] py-[11px] space-y-2.5"
                    >
                      {/* Top Wanted Dossier Strip: Serial #, Kode, Layanan & Bounty Valuation */}
                      <div className="flex items-start justify-between gap-2 pb-2 border-b border-dashed border-[#FACC15]/20">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#FACC15]/15 border border-[#FACC15]/40 font-mono text-[10px] font-extrabold tracking-wider text-[#FACC15] tabular-nums">
                              {serialNo}
                            </span>
                            <span className="font-mono text-xs font-extrabold tracking-tight text-[#F8FAFC] tabular-nums">
                              {rec.kode_berkas}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#252A34] border border-white/[0.12] font-mono text-[9.5px] font-semibold uppercase tracking-wide text-slate-200">
                              {rec.layanan}
                            </span>
                          </div>
                          <p className="font-mono text-[10.5px] tracking-tight text-[#CBD5E1] mt-1 tabular-nums truncate">
                            {isAkta
                              ? rec.akta.nomor_akta || 'Belum bernomor'
                              : 'Non-Akta (F4)'}{' '}
                            <span className="text-[#FACC15]/60">·</span>{' '}
                            {rec.akta.tanggal_akta
                              ? formatTanggalDDMMYYYY(rec.akta.tanggal_akta)
                              : 'Belum bertanggal'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block font-mono text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                            NILAI
                          </span>
                          <p className="font-mono text-xs font-extrabold tracking-tight text-[#FACC15] tabular-nums whitespace-nowrap">
                            {formatRupiah(rec.pajak.nilai_kesepakatan)}
                          </p>
                        </div>
                      </div>

                      {/* Row 2: Parties & Monospaced Technical Land Object */}
                      <div className="flex items-center gap-2.5">
                        <PartyAvatar3D name={partySummary.avatarName} />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-xs font-semibold text-[#F8FAFC] truncate">
                            {partySummary.pihakPertamaText}
                            {partySummary.pihakPenerimaText &&
                            partySummary.pihakPenerimaText !== '-' ? (
                              <span className="font-normal text-[#94A3B8]">
                                {' '}
                                → {partySummary.pihakPenerimaText}
                              </span>
                            ) : null}
                          </p>
                          <p className="font-mono text-[10.5px] text-[#CBD5E1] truncate tabular-nums">
                            {rec.tanah.jenis_hak} · {rec.tanah.desa} ·{' '}
                            <span className="text-[#FACC15]/90">
                              {rec.tanah.nib ? `NIB ${rec.tanah.nib} · ` : ''}
                              {formatNumberId(rec.tanah.luas_m2)} m²
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Row 3: Ultra-Slim Action Strip (29px height, 6px radius, Dark Slate Edit, 28px ⋮) */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <div
                          className={`flex-1 min-w-0 h-[29px] inline-flex items-center gap-1.5 rounded-[6px] px-[10px] py-[3px] ${st.bg} ${st.text}`}
                        >
                          <StIcon className="w-[13px] h-[13px] shrink-0 opacity-90" />
                          <select
                            value={currentStatus}
                            aria-label={`Ubah status berkas ${rec.kode_berkas}`}
                            onChange={(e) =>
                              onChangeStatus(rec.id, e.target.value as BerkasStatus)
                            }
                            className="w-full min-w-0 bg-transparent text-[11.5px] font-semibold focus:outline-none cursor-pointer leading-none"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option
                                key={opt}
                                value={opt}
                                className="bg-[#171A21] text-[#F8FAFC]"
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
                          className="inline-flex items-center justify-center gap-1.5 h-[29px] px-[10px] py-[3px] rounded-[6px] bg-[#252A34] hover:bg-[#2F3643] active:scale-95 text-[11.5px] font-semibold text-[#F8FAFC] border border-white/[0.12] hover:border-[#FACC15]/45 transition-all shrink-0"
                        >
                          <Pencil className="w-[13px] h-[13px] text-[#F8FAFC]" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleToggleRowMenu(e, rec)}
                          aria-haspopup="menu"
                          aria-expanded={isMenuOpen}
                          aria-label={`Aksi lainnya untuk ${rec.kode_berkas}`}
                          className={`inline-flex items-center justify-center w-[28px] h-[28px] rounded-[6px] shrink-0 transition-colors ${
                            isMenuOpen
                              ? 'bg-[#FACC15] text-[#0E1014] border border-[#FACC15]'
                              : 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08]'
                          }`}
                        >
                          <MoreVertical className="w-[13px] h-[13px]" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Desktop & Tablet Wanted Poster Table View (md+) — Separated Poster Rows + Monospaced Serial & Technical Details */}
              <div className="hidden md:block overflow-x-auto px-3.5 sm:px-4 pt-2.5 pb-2">
                <table className="wanted-poster-table w-full text-left text-sm">
                  <thead>
                    <tr className="bg-[#FACC15] font-mono text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#0E1014]">
                      <th className="py-2.5 pl-3 pr-1.5 rounded-l-[8px] whitespace-nowrap">No · Kode &amp; Akta</th>
                      <th className="py-2.5 px-1.5 whitespace-nowrap">Layanan &amp; Tgl</th>
                      <th className="py-2.5 px-1.5 whitespace-nowrap">Pihak / Pemohon</th>
                      <th className="py-2.5 px-1.5 whitespace-nowrap">Pihak Penerima</th>
                      <th className="py-2.5 px-1.5 whitespace-nowrap">Objek Tanah</th>
                      <th className="py-2.5 px-1.5 text-right whitespace-nowrap">Nilai Transaksi</th>
                      <th className="py-2.5 px-1.5 whitespace-nowrap">Status Proses</th>
                      <th className="py-2.5 pl-1.5 pr-3 rounded-r-[8px] text-right whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((rec, idx) => {
                      const isAkta = isAktaService(rec.layanan);
                      const partySummary = extractDashboardParties(rec);
                      const currentStatus = normalizeBerkasStatus(rec.status);
                      const st = statusStyle(currentStatus);
                      const StIcon = st.Icon;
                      const isMenuOpen = openActionMenu?.record.id === rec.id;
                      const serialNo = `#${String(idx + 1).padStart(2, '0')}`;

                      return (
                        <tr
                          key={rec.id}
                          data-testid="wanted-poster-row"
                          className="wanted-poster-row"
                        >
                          <td className="py-2.5 pl-2.5 pr-1.5 align-middle whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center justify-center min-w-[28px] px-1 py-0.5 rounded-[4px] bg-[#FACC15]/14 border border-[#FACC15]/45 font-mono text-[10px] font-extrabold tracking-wider text-[#FACC15] tabular-nums">
                                {serialNo}
                              </span>
                              <div>
                                <div className="font-mono text-[11.5px] font-extrabold tracking-tight text-[#F8FAFC] tabular-nums">
                                  {rec.kode_berkas}
                                </div>
                                <div className="font-mono text-[10.5px] tracking-tight text-[#CBD5E1] mt-0.5 tabular-nums">
                                  {isAkta
                                    ? rec.akta.nomor_akta || 'Belum bernomor'
                                    : 'Non-Akta (F4)'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-1.5 align-middle whitespace-nowrap">
                            <div className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[#252A34]/90 border border-white/[0.1] text-[10.5px] font-bold text-[#F8FAFC]">
                              {rec.layanan}
                            </div>
                            <div className="font-mono text-[10.5px] tracking-tight text-[#CBD5E1] mt-1 tabular-nums">
                              {rec.akta.tanggal_akta
                                ? formatTanggalDDMMYYYY(rec.akta.tanggal_akta)
                                : 'Belum bertanggal'}
                            </div>
                            {!rec.akta.tanggal_akta && rec.tanggal_masuk && (
                              <div className="font-mono text-[9.5px] text-[#94A3B8] tabular-nums">
                                IN: {formatTanggalDDMMYYYY(rec.tanggal_masuk)}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-1.5 align-middle max-w-[138px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <PartyAvatar3D name={partySummary.avatarName} />
                              <div className="min-w-0 flex-1">
                                <div
                                  className="text-xs font-bold text-[#F8FAFC] truncate"
                                  title={partySummary.pihakPertamaText}
                                >
                                  {partySummary.pihakPertamaText}
                                </div>
                                <div className="font-mono text-[9.5px] uppercase tracking-wide text-[#94A3B8] truncate mt-0.5">
                                  {partySummary.pihakPertamaLabel}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-1.5 align-middle max-w-[116px]">
                            <div
                              className="text-xs font-bold text-[#F8FAFC] truncate"
                              title={partySummary.pihakPenerimaText}
                            >
                              {partySummary.pihakPenerimaText}
                            </div>
                            <div className="font-mono text-[9.5px] uppercase tracking-wide text-[#94A3B8] truncate mt-0.5">
                              {partySummary.pihakPenerimaLabel}
                            </div>
                          </td>
                          <td className="py-2.5 px-1.5 align-middle max-w-[134px]">
                            <div
                              className="text-xs font-semibold text-[#F8FAFC] truncate"
                              title={`${rec.tanah.jenis_hak} · ${rec.tanah.desa}`}
                            >
                              {rec.tanah.jenis_hak} · {rec.tanah.desa}
                            </div>
                            <div
                              className="font-mono text-[10.5px] tracking-tight text-[#CBD5E1] mt-0.5 tabular-nums truncate"
                              title={`${rec.tanah.nib || '-'} · ${formatNumberId(rec.tanah.luas_m2)} m²`}
                            >
                              <span className="text-[#FACC15]/85">{rec.tanah.nib || '-'}</span>
                              {' · '}
                              {formatNumberId(rec.tanah.luas_m2)} m²
                            </div>
                          </td>
                          <td className="py-2.5 px-1.5 align-middle text-right whitespace-nowrap">
                            <div className="font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
                              VALUASI
                            </div>
                            <div className="font-mono text-[11.5px] font-extrabold tracking-tight text-[#FACC15] tabular-nums">
                              {formatRupiah(rec.pajak.nilai_kesepakatan)}
                            </div>
                          </td>
                          <td className="py-2.5 px-1.5 align-middle whitespace-nowrap">
                            <div
                              className={`inline-flex items-center gap-1 h-[29px] rounded-[6px] px-2 py-[3px] ${st.bg} ${st.text}`}
                            >
                              <StIcon className="w-[12px] h-[12px] shrink-0 opacity-90" />
                              <select
                                value={currentStatus}
                                aria-label={`Ubah status berkas ${rec.kode_berkas}`}
                                onChange={(e) =>
                                  onChangeStatus(rec.id, e.target.value as BerkasStatus)
                                }
                                className="bg-transparent text-[11px] font-semibold focus:outline-none cursor-pointer pr-0.5 max-w-[112px] leading-none"
                              >
                                {STATUS_OPTIONS.map((opt) => (
                                  <option
                                    key={opt}
                                    value={opt}
                                    className="bg-[#171A21] text-[#F8FAFC]"
                                  >
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="py-2.5 pl-1.5 pr-2.5 align-middle text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onEditRecord(rec)}
                                title="Edit / Buka Ulang Berkas"
                                aria-label={`Edit berkas ${rec.kode_berkas}`}
                                className="inline-flex items-center gap-1 h-[29px] px-2.5 py-[3px] rounded-[6px] bg-[#252A34] hover:bg-[#2F3643] text-[11px] font-semibold text-[#F8FAFC] border border-white/[0.12] hover:border-[#FACC15]/45 transition-all"
                              >
                                <Pencil className="w-[12px] h-[12px] text-[#F8FAFC]" />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleToggleRowMenu(e, rec)}
                                aria-haspopup="menu"
                                aria-expanded={isMenuOpen}
                                aria-label={`Aksi lainnya untuk ${rec.kode_berkas}`}
                                title="Aksi lainnya (Salin, Pajak, Kwitansi, Hapus)"
                                className={`inline-flex items-center justify-center w-[28px] h-[28px] rounded-[6px] transition-colors ${
                                  isMenuOpen
                                    ? 'bg-[#FACC15] text-[#0E1014] border border-[#FACC15]'
                                    : 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08]'
                                }`}
                              >
                                <MoreVertical className="w-[13px] h-[13px]" />
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

          {/* Clean Bottom Count Bar */}
          <div className="px-4 sm:px-5 py-2.5 bg-[#0E1014]/65 border-t border-white/[0.08] text-[11px] font-medium text-[#94A3B8] flex items-center justify-between">
            <span className="tabular-nums">
              Menampilkan <span className="text-[#FACC15] font-bold">{filteredRecords.length}</span> dari {records.length} berkas terdaftar
            </span>
          </div>
        </div>
      </div>

      {/* Floating Fixed-Position Row Action Dropdown (never clipped by table overflow) */}
      {openActionMenu && (
        <div
          ref={actionMenuRef}
          role="menu"
          aria-label={`Menu aksi berkas ${openActionMenu.record.kode_berkas}`}
          style={{ top: openActionMenu.top, right: openActionMenu.right }}
          className="fixed z-50 w-48 rounded-xl border border-white/[0.12] bg-[#171A21]/98 shadow-[0_14px_32px_rgba(0,0,0,0.78)] p-1.5"
        >
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FACC15] font-mono truncate">
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
            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-xs font-medium text-[#F8FAFC] hover:bg-white/[0.08] hover:text-[#FACC15] rounded-lg transition-colors disabled:opacity-60"
          >
            {duplicatingId === openActionMenu.record.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FACC15] shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-sky-300 shrink-0" />
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
            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-xs font-medium text-[#F8FAFC] hover:bg-white/[0.08] hover:text-[#FACC15] rounded-lg transition-colors"
          >
            <Calculator className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
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
            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-xs font-medium text-[#F8FAFC] hover:bg-white/[0.08] hover:text-[#FACC15] rounded-lg transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span>Cetak Kwitansi</span>
          </button>

          <div className="my-1 border-t border-white/[0.08]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const targetId = openActionMenu.record.id;
              setOpenActionMenu(null);
              onDeleteRecord(targetId);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-xs font-semibold text-[#EF4444] hover:bg-[#EF4444]/15 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Hapus Berkas</span>
          </button>
        </div>
      )}
    </div>
  );
};
