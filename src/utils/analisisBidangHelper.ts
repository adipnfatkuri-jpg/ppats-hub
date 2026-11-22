import { BerkasRecord } from '../types/ppats';
import { formatNumberId, terbilang } from './indonesianFormatter';

export interface AnalisisSketRow {
  rencanaPenggunaan: string;
  luasM2: number;
  luasText: string;
  alasanPemecahan: string;
}

export interface ResolvedAnalisisBidangConfig {
  nomorHp: string;
  temaAnalisis: string;
  skalaPeta: string;
  jumlahBidang: number;
  jumlahBidangTerbilangCap: string;
  jumlahBidangTerbilangLower: string;
  keperluanUtamaUpper: string;
  alasanPeralihanText: string;
  alasanTabelDefault: string;
  sketRows: AnalisisSketRow[];
  luasRencanaJalanText: string;
  luasPelepasanJalanText: string;
  sertakanPelepasanJalan: boolean;
}

export const DEFAULT_ANALISIS_TEMA =
  'Kesesuaian Penggunaan Tanah terhadap RTRW atau RDTR, LSD dan LP2B';

function capitalizeWords(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function resolveAnalisisBidangConfig(
  record: BerkasRecord
): ResolvedAnalisisBidangConfig {
  const na = record.non_akta;
  const rawBidang = na?.bidang_pecahan ?? [];
  const requestedCount =
    rawBidang.length > 0
      ? rawBidang.length
      : Math.max(1, Math.round(na?.analisis_jumlah_bidang ?? 3));

  const terbilangLower = terbilang(requestedCount).trim().toLowerCase() || String(requestedCount);
  const terbilangCap = capitalizeWords(terbilangLower);

  const rencanaPenggunaanDefault =
    na?.analisis_rencana_penggunaan?.trim() || 'Rumah Tinggal';
  const alasanTabelDefault =
    na?.analisis_alasan_tabel?.trim() || 'dihibahkan ke anak';
  const alasanPeralihanText =
    na?.analisis_alasan_peralihan?.trim() || 'HIBAH kepada anak';

  const sketRows: AnalisisSketRow[] =
    rawBidang.length > 0
      ? rawBidang.map((item) => ({
          rencanaPenggunaan:
            item.rencana_penggunaan?.trim() ||
            item.keterangan?.trim() ||
            rencanaPenggunaanDefault,
          luasM2: item.luas_m2 || 0,
          luasText: item.luas_m2 > 0 ? formatNumberId(item.luas_m2) : '',
          alasanPemecahan:
            item.alasan_pemecahan?.trim() || alasanTabelDefault,
        }))
      : Array.from({ length: requestedCount }, () => ({
          rencanaPenggunaan: rencanaPenggunaanDefault,
          luasM2: 0,
          luasText: '',
          alasanPemecahan: alasanTabelDefault,
        }));

  const rencanaJalanNum =
    na?.analisis_rencana_jalan_luas_m2 && na.analisis_rencana_jalan_luas_m2 > 0
      ? na.analisis_rencana_jalan_luas_m2
      : na?.pelepasan_jalan_luas_m2 && na.pelepasan_jalan_luas_m2 > 0
      ? na.pelepasan_jalan_luas_m2
      : 0;
  const pelepasanJalanNum =
    na?.pelepasan_jalan_luas_m2 && na.pelepasan_jalan_luas_m2 > 0
      ? na.pelepasan_jalan_luas_m2
      : 0;

  return {
    nomorHp: na?.analisis_no_hp?.trim() || na?.pkkpr_telepon?.trim() || '',
    temaAnalisis: na?.analisis_tema?.trim() || DEFAULT_ANALISIS_TEMA,
    skalaPeta: na?.analisis_skala_peta?.trim() || '1 : 1000',
    jumlahBidang: requestedCount,
    jumlahBidangTerbilangCap: terbilangCap,
    jumlahBidangTerbilangLower: terbilangLower,
    keperluanUtamaUpper: rencanaPenggunaanDefault.toUpperCase(),
    alasanPeralihanText,
    alasanTabelDefault,
    sketRows,
    luasRencanaJalanText:
      rencanaJalanNum > 0 ? formatNumberId(rencanaJalanNum) : '..........',
    luasPelepasanJalanText:
      pelepasanJalanNum > 0 ? formatNumberId(pelepasanJalanNum) : '..........',
    sertakanPelepasanJalan: Boolean(na?.sertakan_pelepasan_jalan),
  };
}
