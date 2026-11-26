import React, { useMemo, useState } from 'react';
import { Search, Pencil, BookOpen } from 'lucide-react';
import { BerkasRecord, ServiceType } from '../types/ppats';
import { SERVICE_TYPES } from '../utils/seedData';
import {
  extractMonthYearFromDate,
  formatNumberId,
  formatRupiah,
  formatTanggalDDMMYYYY,
} from '../utils/indonesianFormatter';
import { isAktaService } from '../utils/taxAndAudit';
import { GlossyIcon3D, PartyAvatar3D } from './TactileUI';

interface RegisterModuleProps {
  records: BerkasRecord[];
  onEditRecord: (record: BerkasRecord) => void;
}

export const RegisterModule: React.FC<RegisterModuleProps> = ({
  records,
  onEditRecord,
}) => {
  const [query, setQuery] = useState('');
  const [filterKategori, setFilterKategori] = useState<'SEMUA' | 'AKTA' | 'NON_AKTA'>('SEMUA');
  const [filterLayanan, setFilterLayanan] = useState<'SEMUA' | ServiceType>('SEMUA');
  const [filterTahun, setFilterTahun] = useState<string>('SEMUA');

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const r of records) {
      const my = extractMonthYearFromDate(r.akta.tanggal_akta || r.tanggal_masuk);
      if (my) years.add(String(my.year));
    }
    return Array.from(years).sort().reverse();
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...records]
      .sort((a, b) => a.no_urut - b.no_urut)
      .filter((r) => {
        if (filterKategori === 'AKTA' && !isAktaService(r.layanan)) return false;
        if (filterKategori === 'NON_AKTA' && isAktaService(r.layanan)) return false;
        if (filterLayanan !== 'SEMUA' && r.layanan !== filterLayanan) return false;
        const my = extractMonthYearFromDate(r.akta.tanggal_akta || r.tanggal_masuk);
        const year = my ? String(my.year) : '';
        if (filterTahun !== 'SEMUA' && year !== filterTahun) return false;
        if (!q) return true;
        const partyText = r.para_pihak
          .map((p) => `${p.nama} ${p.nik}`)
          .join(' ')
          .toLowerCase();
        const hay = [
          r.akta.nomor_akta,
          r.kode_berkas,
          r.layanan,
          r.tanah.nib,
          r.tanah.nomor_hak_lama,
          r.tanah.desa,
          partyText,
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
  }, [records, query, filterKategori, filterLayanan, filterTahun]);

  return (
    <div className="space-y-6">
      <div className="rounded-[14px] bg-[#171A21]/92 backdrop-blur-md border border-white/[0.08] border-l-[3px] border-l-[#FACC15] px-5 py-4 shadow-[0_8px_22px_rgba(0,0,0,0.42)] flex items-start gap-3.5">
        <GlossyIcon3D tone="teal" size="md">
          <BookOpen className="w-5 h-5" />
        </GlossyIcon3D>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#FACC15]">
            Buku Register Akta &amp; Berkas (Repertorium)
          </h1>
          <p className="text-xs sm:text-sm text-[#CBD5E1] mt-0.5 font-medium">
            Catatan kronologis seluruh Akta PPATS dan Berkas Non-Akta (Turun Waris, Waris C, Pemecahan, Ukur Ulang, Ralat Data, Pengecekan, Validasi, Analisis Bidang, PKKPR) beserta NIB, luas bidang, nilai transaksi, serta BPHTB &amp; PPh.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bento-card p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-[#0E1014]/90 rounded-full shrink-0">
            {[
              { id: 'SEMUA' as const, label: 'Semua Berkas' },
              { id: 'AKTA' as const, label: 'Akta PPATS' },
              { id: 'NON_AKTA' as const, label: 'Non-Akta' },
            ].map((tab) => {
              const active = filterKategori === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterKategori(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-150 whitespace-nowrap ${
                    active
                      ? 'bg-[#0E1014] text-[#FACC15] shadow-xs'
                      : 'text-[#475569] dark:text-slate-300 hover:text-[#0E1014] dark:hover:text-white hover:bg-white/80 dark:hover:bg-[#252A34]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-teal-600/70 dark:text-teal-300/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari Nama, NIK, NIB, atau Nomor Akta..."
              aria-label="Cari di Buku Register Akta"
              className="input-airy w-full pl-10 pr-3.5 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="filter-jenis-akta" className="text-xs font-semibold text-slate-600 dark:text-teal-200/80">
              Jenis Layanan
            </label>
            <select
              id="filter-jenis-akta"
              value={filterLayanan}
              onChange={(e) => setFilterLayanan(e.target.value as 'SEMUA' | ServiceType)}
              className="input-airy text-sm px-3 py-1.5"
            >
              <option value="SEMUA">Semua Jenis</option>
              {SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="filter-tahun-akta" className="text-xs font-semibold text-slate-600 dark:text-teal-200/80">
              Tahun
            </label>
            <select
              id="filter-tahun-akta"
              value={filterTahun}
              onChange={(e) => setFilterTahun(e.target.value)}
              className="input-airy text-sm px-3 py-1.5 font-mono"
            >
              <option value="SEMUA">Semua Tahun</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Repertorium Table */}
      <div className="bento-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-teal-200/70">
            Belum ada catatan akta yang cocok dengan pencarian atau filter.
          </div>
        ) : (
          <>
            {/* Mobile-First Card View (< md) */}
            <div className="md:hidden divide-y divide-[#C8B294]/60 dark:divide-[#1E3A54]">
              {filtered.map((r) => {
                const p1 =
                  r.para_pihak
                    .filter((p) => p.peran === 'Pihak I')
                    .map((p) => p.nama)
                    .join(', ') || '-';
                const p2 =
                  r.para_pihak
                    .filter((p) => p.peran === 'Pihak II')
                    .map((p) => p.nama)
                    .join(', ') || '-';
                const tgl = r.akta.tanggal_akta
                  ? formatTanggalDDMMYYYY(r.akta.tanggal_akta)
                  : 'Belum bertanggal';

                return (
                  <article key={r.id} className="p-3.5 space-y-2.5 bg-white/95 dark:bg-[#102E21]/90">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-extrabold text-[#143D2B] dark:text-[#FACC15] tabular-nums">
                            #{String(r.no_urut).padStart(3, '0')}
                          </span>
                          <span className="text-xs font-bold text-[#111827] dark:text-white">
                            {r.layanan}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-[#475569] dark:text-slate-300 mt-0.5 tabular-nums truncate">
                          {isAktaService(r.layanan)
                            ? r.akta.nomor_akta || '-'
                            : 'Non-Akta (F4)'}{' '}
                          · {tgl}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditRecord(r)}
                        className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3.5 rounded-full bg-[#DBEAFE] hover:bg-[#BFDBFE] text-[#1E40AF] dark:bg-[#1E3A5F] dark:text-[#93C5FD] text-xs font-bold shrink-0 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Buka</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <PartyAvatar3D name={p1} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#111827] dark:text-slate-100 truncate">
                          {p1}
                          {p2 && p2 !== '-' ? (
                            <span className="font-medium text-[#475569] dark:text-slate-300">
                              {' '}
                              → {p2}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-[#475569] dark:text-slate-300 truncate tabular-nums">
                          {r.tanah.desa}, {r.tanah.kecamatan} · {formatNumberId(r.tanah.luas_m2)} m²
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/80 dark:border-emerald-900/50 text-[11px] tabular-nums">
                      <div>
                        <span className="font-bold text-[#111827] dark:text-[#FACC15]">
                          {formatRupiah(r.pajak.nilai_kesepakatan)}
                        </span>
                        <span className="text-[#475569] dark:text-slate-300 ml-2">
                          BPHTB {formatRupiah(r.pajak.bphtb)}
                        </span>
                      </div>
                      <span className="font-semibold text-[#1E3A8A] dark:text-sky-300 truncate">
                        {r.status}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop Table View (md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-teal-900/10 dark:border-teal-500/20 bg-teal-50/50 dark:bg-teal-950/60 font-semibold text-teal-950/80 dark:text-teal-100">
                    <th className="py-3.5 px-2.5 whitespace-nowrap">No</th>
                    <th className="py-3.5 px-2.5 whitespace-nowrap">No. &amp; Tgl Akta</th>
                    <th className="py-3.5 px-2.5 whitespace-nowrap">Jenis</th>
                    <th className="py-3.5 px-2.5">Pihak I</th>
                    <th className="py-3.5 px-2.5">Pihak II</th>
                    <th className="py-3.5 px-2.5">Hak &amp; NIB</th>
                    <th className="py-3.5 px-2.5">Letak Tanah</th>
                    <th className="py-3.5 px-2.5 text-right whitespace-nowrap">Luas</th>
                    <th className="py-3.5 px-2.5 text-right whitespace-nowrap">Nilai Transaksi</th>
                    <th className="py-3.5 px-2.5 text-right whitespace-nowrap">BPHTB &amp; PPh</th>
                    <th className="py-3.5 px-2.5 whitespace-nowrap">Status</th>
                    <th className="py-3.5 px-2.5 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-900/5 dark:divide-teal-500/10">
                  {filtered.map((r) => {
                    const p1 =
                      r.para_pihak
                        .filter((p) => p.peran === 'Pihak I')
                        .map((p) => p.nama)
                        .join(', ') || '-';
                    const p2 =
                      r.para_pihak
                        .filter((p) => p.peran === 'Pihak II')
                        .map((p) => p.nama)
                        .join(', ') || '-';
                    const tgl = r.akta.tanggal_akta
                      ? formatTanggalDDMMYYYY(r.akta.tanggal_akta)
                      : 'Belum bertanggal';

                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-teal-50/50 dark:hover:bg-teal-900/25 transition-colors"
                      >
                        <td className="py-3.5 px-2.5 font-mono font-semibold text-teal-900 dark:text-teal-200 tabular-nums">
                          {String(r.no_urut).padStart(3, '0')}
                        </td>
                        <td className="py-3.5 px-2.5 whitespace-nowrap">
                          <div className="font-mono font-semibold text-slate-900 dark:text-teal-50">
                            {isAktaService(r.layanan)
                              ? r.akta.nomor_akta || '-'
                              : 'Non-Akta (F4)'}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500 dark:text-teal-300/70 mt-0.5 tabular-nums">
                            {tgl}
                          </div>
                        </td>
                        <td className="py-3.5 px-2.5 font-semibold text-slate-900 dark:text-teal-100 whitespace-nowrap">
                          {r.layanan}
                        </td>
                        <td className="py-3.5 px-2.5 text-slate-800 dark:text-teal-100 max-w-[140px]" title={p1}>
                          <div className="flex items-center gap-2 min-w-0">
                            <PartyAvatar3D name={p1} />
                            <span className="truncate font-medium">{p1}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-2.5 text-slate-800 dark:text-teal-100/90 max-w-[115px] truncate" title={p2}>
                          {p2}
                        </td>
                        <td className="py-3.5 px-2.5 max-w-[155px]">
                          <div className="text-slate-900 dark:text-teal-50 font-medium truncate" title={`${r.tanah.jenis_hak} ${r.tanah.nomor_hak_lama}`}>
                            {r.tanah.jenis_sertipikat === 'digital' || !r.tanah.nomor_hak_lama
                              ? `${r.tanah.jenis_hak} (Digital)`
                              : `${r.tanah.jenis_hak} No. ${r.tanah.nomor_hak_lama}`}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500 dark:text-teal-300/70 mt-0.5 truncate">
                            {r.tanah.jenis_sertipikat === 'digital' || !r.tanah.nomor_hak_lama ? 'NIBel' : 'NIB'}: {r.tanah.nib || '-'}
                          </div>
                        </td>
                        <td className="py-3.5 px-2.5 text-slate-700 dark:text-teal-200/80 max-w-[110px] truncate" title={`${r.tanah.desa}, ${r.tanah.kecamatan}`}>
                          {r.tanah.desa}, {r.tanah.kecamatan}
                        </td>
                        <td className="py-3.5 px-2.5 text-right font-mono tabular-nums text-slate-900 dark:text-teal-50 whitespace-nowrap">
                          {formatNumberId(r.tanah.luas_m2)} m²
                        </td>
                        <td className="py-3.5 px-2.5 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-teal-50 whitespace-nowrap">
                          {formatRupiah(r.pajak.nilai_kesepakatan)}
                        </td>
                        <td className="py-3.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                          <div className="text-sky-700 dark:text-sky-300 font-semibold">
                            {formatRupiah(r.pajak.bphtb)}
                          </div>
                          <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                            PPh {formatRupiah(r.pajak.pph)}
                          </div>
                        </td>
                        <td className="py-3.5 px-2.5 text-slate-700 dark:text-teal-200 whitespace-nowrap font-medium">
                          {r.status}
                        </td>
                        <td className="py-3.5 px-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onEditRecord(r)}
                            className="btn-3d btn-3d-light inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Buka</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
