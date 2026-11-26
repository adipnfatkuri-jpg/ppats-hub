import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  FolderKanban,
  Link2,
  Pencil,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import {
  BerkasRecord,
  BerkasStatus,
  OfficeSettings,
  ServiceType,
} from '../types/ppats';
import { STATUS_OPTIONS } from '../utils/seedData';
import { extractDashboardParties, normalizeBerkasStatus } from '../utils/dashboardHelpers';
import {
  BULAN_ID,
  extractMonthYearFromDate,
  formatNumberId,
  formatTanggalDDMMYYYY,
} from '../utils/indonesianFormatter';
import {
  exportNonAktaRekapXlsx,
  filterNonAktaRecords,
  summarizeNonAktaStats,
} from '../utils/reportGenerator';
import { GlossyIcon3D, PartyAvatar3D } from './TactileUI';

interface NonAktaRekapModuleProps {
  records: BerkasRecord[];
  settings: OfficeSettings;
  onCreateNewNonAkta: () => void;
  onEditRecord: (record: BerkasRecord) => void;
  onChangeStatus: (recordId: string, nextStatus: BerkasStatus) => void;
  onPrintReceipt: (record: BerkasRecord) => void;
  onDeleteRecord: (recordId: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

const NON_AKTA_TABS: Array<{ id: 'SEMUA' | ServiceType; label: string }> = [
  { id: 'SEMUA', label: 'Semua Non-Akta' },
  { id: 'Turun Waris', label: 'Turun Waris' },
  { id: 'Waris C', label: 'Waris C' },
  { id: 'Pemecahan', label: 'Pemecahan' },
  { id: 'Ukur Ulang', label: 'Ukur Ulang' },
  { id: 'Ralat Data', label: 'Ralat Data' },
  { id: 'Pengecekan Sertipikat', label: 'Pengecekan' },
  { id: 'Validasi Sertipikat', label: 'Validasi' },
  { id: 'Analisis Bidang', label: 'Analisis Bidang' },
  { id: 'Permohonan PKKPR', label: 'PKKPR' },
];

function getNonAktaStatusLabel(status: BerkasStatus): string {
  return status;
}

function getPengesahanSummary(rec: BerkasRecord, settings: OfficeSettings): string {
  const na = rec.non_akta;
  if (rec.layanan === 'Permohonan PKKPR') {
    return na?.pkkpr_kuasa_2_aktif
      ? 'Pemohon & 2 Kuasa (DPMPTSP)'
      : 'Pemohon & Kuasa (DPMPTSP)';
  }
  if (rec.layanan === 'Pengecekan Sertipikat') {
    return na?.pengecekan_kuasa_mode === 'kuasa_bpn'
      ? 'Pemohon & Kuasa BPN'
      : `Pemohon & PPATS (${rec.akta.nama_ppats || settings.nama_ppats})`;
  }
  if (rec.layanan === 'Validasi Sertipikat') {
    return 'Pemohon & Kuasa BPN (Geotagging)';
  }
  if (rec.layanan === 'Analisis Bidang') {
    return 'Pemohon & Kuasa BPN (Analisis)';
  }
  if (rec.layanan === 'Waris C') {
    return `Camat & Kepala Desa ${rec.tanah.desa || '-'} (Letter C)`;
  }
  const dualModes =
    rec.layanan === 'Turun Waris' ||
    rec.layanan === 'Ralat Data' ||
    Boolean(na?.sertakan_beda_nama);
  const tunggal =
    na?.pengesahan_mode === 'kades'
      ? `Kepala Desa ${rec.tanah.desa || '-'}`
      : na?.pengesahan_mode === 'camat'
      ? `Camat (${na?.pengesahan_nama?.trim() || settings.nama_ppats})`
      : na?.pengesahan_mode === 'manual'
      ? na?.pengesahan_jabatan?.trim() || 'Pejabat Lainnya'
      : `PPATS (${na?.pengesahan_nama?.trim() || settings.nama_ppats})`;
  return dualModes
    ? `${tunggal} + Camat & Kades`
    : tunggal;
}

function getSpecificSummary(rec: BerkasRecord): string {
  const na = rec.non_akta;
  if (rec.layanan === 'Turun Waris') {
    return na?.nama_pewaris ? `Pewaris: ${na.nama_pewaris}` : 'Permohonan Turun Waris';
  }
  if (rec.layanan === 'Waris C') {
    const parts = [
      na?.nama_pewaris ? `Pewaris: ${na.nama_pewaris}` : '',
      na?.waris_c_hak_adat?.trim() || '',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'Konversi / Waris Letter C';
  }
  if (rec.layanan === 'Pemecahan' || rec.layanan === 'Pemecahan/Ukur Ulang') {
    const count = na?.bidang_pecahan?.length ?? 0;
    return count > 0 ? `Rencana pecah ${count} bidang` : 'Pemecahan bidang tanah';
  }
  if (rec.layanan === 'Ukur Ulang') {
    return na?.koordinat_gps ? `GPS: ${na.koordinat_gps}` : 'Pengukuran ulang / batas';
  }
  if (rec.layanan === 'Ralat Data') {
    if (na?.nama_di_sertipikat || na?.nama_di_ktp_kk) {
      return `${na.nama_di_sertipikat || '-'} → ${na.nama_di_ktp_kk || '-'}`;
    }
    return 'Ralat data sertipikat';
  }
  if (rec.layanan === 'Pengecekan Sertipikat') {
    return na?.pengecekan_kuasa_mode === 'kuasa_bpn'
      ? 'Pengecekan via Kuasa BPN'
      : 'Pengecekan via PPATS / Camat';
  }
  if (rec.layanan === 'Validasi Sertipikat') {
    return na?.koordinat_gps
      ? `Validasi · GPS: ${na.koordinat_gps}`
      : 'Validasi/Verifikasi & Geotagging';
  }
  if (rec.layanan === 'Analisis Bidang') {
    return na?.koordinat_gps
      ? `Analisis Bidang · GPS: ${na.koordinat_gps}`
      : 'Analisis Bidang & Geotagging Poligon';
  }
  if (rec.layanan === 'Permohonan PKKPR') {
    const jenis = na?.pkkpr_jenis_kegiatan || 'Non Berusaha';
    const kbli = na?.pkkpr_kbli?.trim() || 'Rumah Tinggal';
    return `PKKPR ${jenis} · ${kbli}`;
  }
  return '-';
}

export const NonAktaRekapModule: React.FC<NonAktaRekapModuleProps> = ({
  records,
  settings,
  onCreateNewNonAkta,
  onEditRecord,
  onChangeStatus,
  onPrintReceipt,
  onDeleteRecord,
  onNotify,
}) => {
  const [layananFilter, setLayananFilter] = useState<'SEMUA' | ServiceType>('SEMUA');
  const [statusFilter, setStatusFilter] = useState<'SEMUA' | BerkasStatus>('SEMUA');
  const [monthFilter, setMonthFilter] = useState<'SEMUA' | number>('SEMUA');
  const [yearFilter, setYearFilter] = useState<'SEMUA' | number>('SEMUA');
  const [searchQuery, setSearchQuery] = useState('');

  const allNonAkta = useMemo(() => filterNonAktaRecords(records), [records]);
  const stats = useMemo(() => summarizeNonAktaStats(records), [records]);

  const availableYears = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    for (const r of allNonAkta) {
      const my = extractMonthYearFromDate(r.akta.tanggal_akta || r.tanggal_masuk);
      if (my && my.year > 2000) set.add(my.year);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [allNonAkta]);

  const filtered = useMemo(
    () =>
      filterNonAktaRecords(records, {
        layanan: layananFilter,
        status: statusFilter,
        month: monthFilter,
        year: yearFilter,
        query: searchQuery,
      }),
    [records, layananFilter, statusFilter, monthFilter, yearFilter, searchQuery]
  );

  const periodeLabel = useMemo(() => {
    const parts: string[] = [];
    if (layananFilter !== 'SEMUA') parts.push(layananFilter);
    if (monthFilter !== 'SEMUA') parts.push(BULAN_ID[monthFilter - 1] ?? String(monthFilter));
    if (yearFilter !== 'SEMUA') parts.push(String(yearFilter));
    return parts.length > 0 ? parts.join('_') : 'Semua_Periode';
  }, [layananFilter, monthFilter, yearFilter]);

  const handleExport = () => {
    try {
      const fileName = exportNonAktaRekapXlsx({
        records: filtered,
        settings,
        periodeLabel,
      });
      onNotify(`Berhasil mengekspor ${fileName}`, 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Gagal mengekspor rekap Non-Akta.',
        'error'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="rounded-[14px] bg-[#171A21]/92 backdrop-blur-md border border-white/[0.08] border-l-[3px] border-l-[#FACC15] px-5 py-4 shadow-[0_8px_22px_rgba(0,0,0,0.42)] flex items-start gap-3.5 max-w-2xl">
          <GlossyIcon3D tone="sky" size="md">
            <ClipboardList className="w-5 h-5" />
          </GlossyIcon3D>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#FACC15]">
              Rekap Berkas &amp; Tracking Non-Akta
            </h1>
            <p className="text-xs sm:text-sm text-[#CBD5E1] mt-0.5 font-medium">
              Buku rekapitulasi dan pelacakan tahapan khusus berkas Non-Akta (Turun Waris, Waris C, Pemecahan, Ukur Ulang, Ralat Data, Pengecekan, Validasi, Analisis Bidang, PKKPR) di luar Laporan Bulanan PPATS.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExport}
            className="btn-3d btn-3d-emerald inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Rekap (.XLSX)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="btn-3d btn-3d-light inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Rekap</span>
          </button>

          <button
            type="button"
            onClick={onCreateNewNonAkta}
            className="btn-3d btn-3d-teal inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Buat Berkas Non-Akta</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bento-card bento-card-hover p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-teal-200/75">
              Total Berkas Non-Akta
            </p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-teal-50 mt-2 tabular-nums">
              {stats.total}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-teal-300/70 mt-1">
              Waris {stats.turunWaris} · Waris C {stats.warisC} · Pecah {stats.pemecahan} · Ukur {stats.ukurUlang} · Ralat {stats.ralatData} · Cek {stats.pengecekan} · Validasi {stats.validasi} · Analisis {stats.analisisBidang} · PKKPR {stats.pkkpr}
            </p>
          </div>
          <GlossyIcon3D tone="teal" size="md">
            <FolderKanban className="w-5 h-5" />
          </GlossyIcon3D>
        </div>

        <div className="bento-card bento-card-hover p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-teal-200/75">
              Pemberkasan &amp; Pengesahan
            </p>
            <p className="font-mono text-2xl font-bold text-amber-600 dark:text-amber-300 mt-2 tabular-nums">
              {stats.pemberkasanAwal}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-teal-300/70 mt-1">
              Menunggu tanda tangan, Kades, atau validasi pajak
            </p>
          </div>
          <GlossyIcon3D tone="amber" size="md">
            <Clock className="w-5 h-5" />
          </GlossyIcon3D>
        </div>

        <div className="bento-card bento-card-hover p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-teal-200/75">
              Sedang Proses di BPN
            </p>
            <p className="font-mono text-2xl font-bold text-indigo-600 dark:text-indigo-300 mt-2 tabular-nums">
              {stats.prosesBpn}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-teal-300/70 mt-1">
              Berkas sudah masuk loket Kantor Pertanahan
            </p>
          </div>
          <GlossyIcon3D tone="indigo" size="md">
            <Building2 className="w-5 h-5" />
          </GlossyIcon3D>
        </div>

        <div className="bento-card bento-card-hover p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-teal-200/75">
              Selesai / Terbit
            </p>
            <p className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-300 mt-2 tabular-nums">
              {stats.selesai}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-teal-300/70 mt-1">
              Sertipikat / hasil layanan Non-Akta selesai
            </p>
          </div>
          <GlossyIcon3D tone="emerald" size="md">
            <FileCheck2 className="w-5 h-5" />
          </GlossyIcon3D>
        </div>
      </div>

      {/* Filters */}
      <div className="no-print bento-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F3ECE0] dark:bg-[#132C44] border border-[#E2D5C1] dark:border-[#244564] rounded-lg">
            {NON_AKTA_TABS.map((tab) => {
              const active = layananFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLayananFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#0F2942] dark:bg-[#1D4A73] text-[#F8FAFC]'
                      : 'text-[#6B5E4C] dark:text-slate-300 hover:text-[#0F2942] dark:hover:text-white hover:bg-[#FFFDF9]/80 dark:hover:bg-[#1A3957]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-teal-600/70 dark:text-teal-300/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pemohon, pewaris, NIB, desa..."
              aria-label="Cari berkas Non-Akta"
              className="input-airy w-full pl-10 pr-3.5 py-2 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs pt-2 border-t border-teal-900/10 dark:border-teal-500/15">
          <div className="flex items-center gap-1.5">
            <label htmlFor="nonakta-filter-status" className="text-slate-600 dark:text-teal-200/80 font-semibold">
              Status
            </label>
            <select
              id="nonakta-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'SEMUA' | BerkasStatus)}
              className="input-airy px-2.5 py-1.5 text-xs"
            >
              <option value="SEMUA">Semua Status</option>
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {getNonAktaStatusLabel(st)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="nonakta-filter-bulan" className="text-slate-600 dark:text-teal-200/80 font-semibold">
              Bulan
            </label>
            <select
              id="nonakta-filter-bulan"
              value={monthFilter}
              onChange={(e) =>
                setMonthFilter(e.target.value === 'SEMUA' ? 'SEMUA' : Number(e.target.value))
              }
              className="input-airy px-2.5 py-1.5 text-xs"
            >
              <option value="SEMUA">Semua Bulan</option>
              {BULAN_ID.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="nonakta-filter-tahun" className="text-slate-600 dark:text-teal-200/80 font-semibold">
              Tahun
            </label>
            <select
              id="nonakta-filter-tahun"
              value={yearFilter}
              onChange={(e) =>
                setYearFilter(e.target.value === 'SEMUA' ? 'SEMUA' : Number(e.target.value))
              }
              className="input-airy px-2.5 py-1.5 text-xs font-mono"
            >
              <option value="SEMUA">Semua Tahun</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <span className="ml-auto text-slate-500 dark:text-teal-200/75 tabular-nums">
            Menampilkan <strong className="text-slate-900 dark:text-teal-50">{filtered.length}</strong> dari{' '}
            {allNonAkta.length} berkas Non-Akta
          </span>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="hidden print:block text-center border-b-2 border-slate-900 pb-3 mb-4">
        <p className="text-xs font-semibold uppercase">{settings.nama_kabupaten}</p>
        <h2 className="text-base font-bold uppercase">
          REKAPITULASI &amp; TRACKING BERKAS LAYANAN NON-AKTA ({settings.nama_kecamatan})
        </h2>
        <p className="text-xs text-slate-600">
          PPATS: {settings.nama_ppats} · Format Tanggal: DD-MM-YYYY
        </p>
      </div>

      {/* Interactive Tracking Cards */}
      {filtered.length === 0 ? (
        <div className="bento-card p-12 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-800 dark:text-teal-50">
            Belum ada berkas Non-Akta yang sesuai filter saat ini.
          </p>
          <p className="text-xs text-slate-500 dark:text-teal-200/70">
            Buat berkas Non-Akta baru (Turun Waris, Waris C, Pemecahan, Ukur Ulang, Ralat Data, Pengecekan, Validasi, Analisis Bidang, atau PKKPR) agar muncul di rekap dan pelacakan ini.
          </p>
          <button
            type="button"
            onClick={onCreateNewNonAkta}
            className="btn-3d btn-3d-teal mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Buat Berkas Non-Akta</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((rec) => {
            const currentStatus = normalizeBerkasStatus(rec.status);
            const currentStageIdx = STATUS_OPTIONS.indexOf(currentStatus);
            const partySummary = extractDashboardParties(rec);
            const pemohon = partySummary.pihakPertamaText;
            const tglMasuk = formatTanggalDDMMYYYY(rec.tanggal_masuk);
            const tglSurat = rec.akta.tanggal_akta
              ? formatTanggalDDMMYYYY(rec.akta.tanggal_akta)
              : 'Belum bertanggal';

            return (
              <div
                key={rec.id}
                className="bento-card bento-card-hover p-5 space-y-4 break-inside-avoid"
              >
                {/* Top Meta & Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-teal-900/10 dark:border-teal-500/15 pb-3.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-teal-900 dark:text-teal-100 bg-teal-50 dark:bg-teal-900/60 border border-teal-200/80 dark:border-teal-500/30 px-2.5 py-1 rounded-lg tabular-nums">
                      {rec.kode_berkas}
                    </span>
                    <span className="text-xs font-semibold text-sky-900 dark:text-sky-200 bg-sky-50 dark:bg-sky-900/40 border border-sky-200 dark:border-sky-500/30 px-2.5 py-0.5 rounded-lg">
                      {rec.layanan}
                    </span>
                    {rec.non_akta?.linked_berkas_kode && (
                      <span
                        title={`Dikaitkan dari berkas ${rec.non_akta.linked_berkas_kode}${rec.non_akta.linked_berkas_layanan ? ` (${rec.non_akta.linked_berkas_layanan})` : ''}`}
                        className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/45 border border-emerald-200/90 dark:border-emerald-500/35 px-2 py-0.5 rounded-lg"
                      >
                        <Link2 className="w-3 h-3 shrink-0" />
                        <span>Terkait: {rec.non_akta.linked_berkas_kode}</span>
                      </span>
                    )}
                    <span className="font-mono text-xs text-slate-600 dark:text-teal-200/80 tabular-nums">
                      Masuk: <strong className="text-slate-900 dark:text-teal-50">{tglMasuk}</strong>
                    </span>
                    <span className="text-slate-300 dark:text-teal-700">·</span>
                    <span className="font-mono text-xs text-slate-600 dark:text-teal-200/80 tabular-nums">
                      Tgl Berkas:{' '}
                      <strong className={!rec.akta.tanggal_akta ? 'text-amber-600 dark:text-amber-300 font-sans' : 'text-slate-900 dark:text-teal-50'}>
                        {tglSurat}
                      </strong>
                    </span>
                  </div>

                  <div className="no-print flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                    <select
                      aria-label={`Ubah status Non-Akta ${rec.kode_berkas}`}
                      value={currentStatus}
                      onChange={(e) =>
                        onChangeStatus(rec.id, e.target.value as BerkasStatus)
                      }
                      className="input-airy text-xs font-medium px-2.5 py-1.5"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {getNonAktaStatusLabel(opt)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => onEditRecord(rec)}
                      className="btn-3d btn-3d-light inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onPrintReceipt(rec)}
                      className="btn-3d btn-3d-light inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Kwitansi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteRecord(rec.id)}
                      aria-label={`Hapus berkas ${rec.kode_berkas}`}
                      className="p-1.5 rounded-xl border border-transparent hover:border-rose-200 dark:hover:border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="text-slate-500 dark:text-teal-300/75 font-medium">
                      {partySummary.pihakPertamaLabel} &amp; {partySummary.pihakPenerimaLabel}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <PartyAvatar3D name={pemohon} />
                      <div className="min-w-0">
                        <p className="text-slate-900 dark:text-teal-50 font-semibold">{pemohon}</p>
                        {partySummary.pihakPenerimaText !== '-' && (
                          <p className="text-[11px] text-sky-700 dark:text-sky-300 font-medium">
                            {partySummary.pihakPenerimaLabel}: {partySummary.pihakPenerimaText}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-slate-600 dark:text-teal-200/75 mt-1">{getSpecificSummary(rec)}</p>
                  </div>

                  <div>
                    <p className="text-slate-500 dark:text-teal-300/75 font-medium">Objek Tanah &amp; Sertipikat</p>
                    <p className="text-slate-900 dark:text-teal-50 font-semibold mt-1">
                      {rec.tanah.jenis_sertipikat === 'digital' || !rec.tanah.nomor_hak_lama
                        ? `${rec.tanah.jenis_hak} Digital · NIBel ${rec.tanah.nib || '-'}`
                        : `${rec.tanah.jenis_hak} No. ${rec.tanah.nomor_hak_lama} · NIB ${rec.tanah.nib || '-'}`}
                    </p>
                    <p className="text-slate-600 dark:text-teal-200/75 mt-1">
                      Desa {rec.tanah.desa}, Kec. {rec.tanah.kecamatan} ·{' '}
                      <span className="font-mono tabular-nums font-semibold text-teal-800 dark:text-teal-200">
                        {formatNumberId(rec.tanah.luas_m2)} m²
                      </span>
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500 dark:text-teal-300/75 font-medium">Kuasa BPN &amp; Pengesahan</p>
                    <p className="text-slate-900 dark:text-teal-50 mt-1">
                      Kuasa: <span className="font-semibold">{rec.akta.nama_kuasa_bpn || '-'}</span>
                    </p>
                    <p className="text-slate-600 dark:text-teal-200/75 mt-1">
                      Pengesahan: {getPengesahanSummary(rec, settings)}
                    </p>
                  </div>
                </div>

                {/* 11-Stage Interactive Progress Tracking */}
                <div className="pt-2">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-teal-300/75 mb-2">
                    Tracking 11 Tahap Berkas Non-Akta (klik tahap untuk memperbarui progres):
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
                    {STATUS_OPTIONS.map((stage, sIdx) => {
                      const isDone = sIdx < currentStageIdx;
                      const isCurrent = sIdx === currentStageIdx;
                      return (
                        <button
                          key={stage}
                          type="button"
                          onClick={() => onChangeStatus(rec.id, stage)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-left text-[11px] font-semibold transition-colors ${
                            isCurrent
                              ? 'border-[#0F2942] bg-[#0F2942] dark:border-[#D97706] dark:bg-[#1D4A73] text-[#F8FAFC]'
                              : isDone
                              ? 'border-emerald-200 dark:border-emerald-800 bg-[#E2F3EB] dark:bg-emerald-950/50 text-[#115E3B] dark:text-emerald-200 hover:bg-[#D5ECE1] dark:hover:bg-emerald-900/50'
                              : 'border-[#E2D5C1] dark:border-[#244564] bg-[#FAF6EE] dark:bg-[#132C44] text-[#6B5E4C] dark:text-slate-300 hover:bg-[#F3ECE0] dark:hover:bg-[#1A3957]'
                          }`}
                        >
                          <CheckCircle2
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isCurrent
                                ? 'text-white'
                                : isDone
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-300 dark:text-teal-700'
                            }`}
                          />
                          <span className="truncate">{getNonAktaStatusLabel(stage)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
