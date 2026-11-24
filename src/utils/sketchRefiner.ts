import type { PemecahanBidangItem } from '../types/ppats';

export interface SketchPoint {
  x: number;
  y: number;
}

export interface SketchSubdivisionLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
}

export interface SketchLotLabel {
  text: string;
  x: number;
  y: number;
  subtext?: string;
}

export interface SketchRoadCorridor {
  points: SketchPoint[];
  label: string;
  labelX: number;
  labelY: number;
  labelAngle?: number;
  isPelepasanJalan?: boolean;
}

export type CardinalSide = 'utara' | 'timur' | 'selatan' | 'barat';

export interface SketchEdgeLabel {
  side: CardinalSide | 'lain';
  text: string;
  x: number;
  y: number;
  angle?: number;
}

export interface SketchDimensionLabel {
  text: string;
  x: number;
  y: number;
  angle?: number;
}

export interface CadSketchSpec {
  viewBoxWidth: number;
  viewBoxHeight: number;
  northArrowAngle?: number;
  outerPolygon: SketchPoint[];
  subdivisions: SketchSubdivisionLine[];
  lotLabels: SketchLotLabel[];
  roads: SketchRoadCorridor[];
  edgeLabels: SketchEdgeLabel[];
  dimensions: SketchDimensionLabel[];
  detectedBoundaries?: {
    utara?: string;
    timur?: string;
    selatan?: string;
    barat?: string;
  };
  summary?: string;
}

export interface AutoCadSketchInput {
  batasUtara?: string;
  batasTimur?: string;
  batasSelatan?: string;
  batasBarat?: string;
  luasIndukM2?: number;
  bidangPecahan?: PemecahanBidangItem[];
  isPemecahan?: boolean;
  sertakanPelepasanJalan?: boolean;
  pelepasanJalanLuasM2?: number;
  pelepasanJalanSisi?: CardinalSide;
  pelepasanJalanKeterangan?: string;
  splitOrientation?: 'vertical' | 'horizontal';
}

export const CAD_VIEWBOX_WIDTH = 1000;
export const CAD_VIEWBOX_HEIGHT = 640;

const IDEAL_MIN_X = 215;
const IDEAL_MAX_X = 815;
const IDEAL_MIN_Y = 125;
const IDEAL_MAX_Y = 500;

function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function cleanLabel(val?: string, maxLen = 40): string {
  const s = (val ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
}

/**
 * Membersihkan hasil deteksi batas dari komentar meta AI (mis. "(dari form...)" atau "tidak terbaca")
 * agar tombol "Terapkan ke Batas Tanah" hanya memasukkan nama tetangga/jalan yang valid.
 */
export function sanitizeDetectedBoundaryName(val?: string): string | undefined {
  const raw = (val ?? '').replace(/\s+/g, ' ').trim();
  if (!raw || raw === '-' || raw === '—') return undefined;
  const stripped = raw
    .replace(/\((?:dari\s+form|tidak\s+ada|tidak\s+terbaca|tidak\s+tertulis|sesuai\s+form)[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    !stripped ||
    stripped === '-' ||
    /^(?:tidak\s+(?:ada|terbaca|tertulis|jelas)|kosong|n\/a|none|null)$/i.test(stripped)
  ) {
    return undefined;
  }
  return cleanLabel(stripped, 38) || undefined;
}

export function isRoadBoundary(val?: string): boolean {
  return /(?:\b(?:jalan|jln|gang|akses)\b|\b(?:jl|gg)\.)/i.test(val ?? '');
}

/**
 * Menentukan apakah batas bidang berupa fasilitas umum/non-perorangan
 * (mis. Jalan, Saluran, Sungai, Selokan, Parit, Makam, Rel) sehingga tidak
 * memerlukan tanda tangan pemilik batas perorangan.
 */
export function isBoundaryNonPerson(val?: string): boolean {
  const s = (val ?? '').trim();
  if (!s || s === '-') return false;
  return /(?:\b(?:jalan|jln|gang|akses|saluran|selokan|sungai|kali|parit|irigasi|drainase|makam|kuburan|rel|tanah\s+negara|tanah\s+kas|lapangan)\b|\b(?:jl|gg)\.)/i.test(
    s
  );
}

/**
 * Meluruskan segmen yang hampir horizontal atau hampir vertikal (deviasi sudut <= ~4.5°)
 * agar hasil scan gambar tangan yang sedikit miring tampak presisi layaknya garis CAD.
 */
function snapPolygonOrthogonal(points: SketchPoint[], maxAngleDeg = 4.5): SketchPoint[] {
  if (points.length < 3) return points;
  const threshold = Math.sin((maxAngleDeg * Math.PI) / 180);
  const out = points.map((p) => ({ x: p.x, y: p.y }));

  for (let i = 0; i < out.length; i += 1) {
    const a = out[i];
    const b = out[(i + 1) % out.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 12) continue;

    if (Math.abs(dx) / len <= threshold) {
      const midX = Math.round((a.x + b.x) / 2);
      a.x = midX;
      b.x = midX;
    } else if (Math.abs(dy) / len <= threshold) {
      const midY = Math.round((a.y + b.y) / 2);
      a.y = midY;
      b.y = midY;
    }
  }
  return out;
}

function snapLineOrthogonal(line: SketchSubdivisionLine, maxAngleDeg = 4.5): SketchSubdivisionLine {
  const threshold = Math.sin((maxAngleDeg * Math.PI) / 180);
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len = Math.hypot(dx, dy);
  if (len < 10) return line;
  if (Math.abs(dx) / len <= threshold) {
    const midX = Math.round((line.x1 + line.x2) / 2);
    return { ...line, x1: midX, x2: midX };
  }
  if (Math.abs(dy) / len <= threshold) {
    const midY = Math.round((line.y1 + line.y2) / 2);
    return { ...line, y1: midY, y2: midY };
  }
  return line;
}

function projectPointToSegment(
  p: SketchPoint,
  a: SketchPoint,
  b: SketchPoint
): { point: SketchPoint; dist: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-6) {
    return { point: { x: a.x, y: a.y }, dist: Math.hypot(p.x - a.x, p.y - a.y) };
  }
  const t = clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / lenSq, 0, 1);
  const proj = { x: a.x + t * vx, y: a.y + t * vy };
  return { point: proj, dist: Math.hypot(p.x - proj.x, p.y - proj.y) };
}

/**
 * Menempelkan ujung garis pemisah bidang (subdivision) ke tepi terdekat poligon utama
 * bila jaraknya <= maxSnapDist sehingga tidak ada celah mengambang atau garis melampaui batas.
 */
function snapEndpointToPolygon(
  p: SketchPoint,
  polygon: SketchPoint[],
  maxSnapDist = 38
): SketchPoint {
  let bestPoint = p;
  let bestDist = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const { point, dist } = projectPointToSegment(p, a, b);
    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = point;
    }
  }
  if (bestDist <= maxSnapDist) {
    return { x: Math.round(bestPoint.x), y: Math.round(bestPoint.y) };
  }
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

function computePolygonBounds(points: SketchPoint[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

/**
 * Menghasilkan spesifikasi sket bidang tanah CAD vektor standar BPN secara otomatis
 * dari data batas utara/timur/selatan/barat, daftar bidang pecahan, dan opsi pelepasan jalan.
 */
export function buildAutoCadSketchSpec(input: AutoCadSketchInput): CadSketchSpec {
  const utara = cleanLabel(input.batasUtara) || 'Batas Utara';
  const timur = cleanLabel(input.batasTimur) || 'Batas Timur';
  const selatan = cleanLabel(input.batasSelatan) || 'Batas Selatan';
  const barat = cleanLabel(input.batasBarat) || 'Batas Barat';

  const hasRoadUtara = isRoadBoundary(utara);
  const hasRoadTimur = isRoadBoundary(timur);
  const hasRoadSelatan = isRoadBoundary(selatan);
  const hasRoadBarat = isRoadBoundary(barat);

  const pelepasanAktif = Boolean(input.sertakanPelepasanJalan);
  const pelepasanSisi: CardinalSide = input.pelepasanJalanSisi ?? 'utara';
  const orientation = input.splitOrientation ?? 'vertical';

  const leftX = hasRoadBarat || (pelepasanAktif && pelepasanSisi === 'barat') ? 265 : 225;
  const rightXTop = hasRoadTimur || (pelepasanAktif && pelepasanSisi === 'timur') ? 760 : 810;
  const rightXBottom = hasRoadTimur ? rightXTop + 28 : rightXTop;
  const topY = hasRoadUtara || (pelepasanAktif && pelepasanSisi === 'utara') ? 168 : 132;
  const bottomY = hasRoadSelatan || (pelepasanAktif && pelepasanSisi === 'selatan') ? 470 : 500;

  const outerPolygon: SketchPoint[] = [
    { x: leftX, y: topY },
    { x: rightXTop, y: topY },
    { x: rightXBottom, y: bottomY },
    { x: leftX, y: bottomY },
  ];

  const roads: SketchRoadCorridor[] = [];
  const edgeLabels: SketchEdgeLabel[] = [];

  if (hasRoadTimur) {
    const roadW = 48;
    roads.push({
      points: [
        { x: rightXTop + 8, y: topY - 45 },
        { x: rightXTop + 8 + roadW, y: topY - 45 },
        { x: rightXBottom + 8 + roadW, y: bottomY + 45 },
        { x: rightXBottom + 8, y: bottomY + 45 },
      ],
      label: timur,
      labelX: Math.round((rightXTop + rightXBottom) / 2 + 8 + roadW / 2),
      labelY: Math.round((topY + bottomY) / 2),
      labelAngle: -84,
    });
  } else {
    edgeLabels.push({
      side: 'timur',
      text: timur,
      x: Math.round(Math.max(rightXTop, rightXBottom) + (pelepasanAktif && pelepasanSisi === 'timur' ? 68 : 38)),
      y: Math.round((topY + bottomY) / 2),
      angle: -90,
    });
  }

  if (hasRoadBarat) {
    const roadW = 46;
    roads.push({
      points: [
        { x: leftX - 8 - roadW, y: topY - 35 },
        { x: leftX - 8, y: topY - 35 },
        { x: leftX - 8, y: bottomY + 35 },
        { x: leftX - 8 - roadW, y: bottomY + 35 },
      ],
      label: barat,
      labelX: Math.round(leftX - 8 - roadW / 2),
      labelY: Math.round((topY + bottomY) / 2),
      labelAngle: -90,
    });
  } else {
    edgeLabels.push({
      side: 'barat',
      text: barat,
      x: leftX - (pelepasanAktif && pelepasanSisi === 'barat' ? 66 : 38),
      y: Math.round((topY + bottomY) / 2),
      angle: -90,
    });
  }

  if (hasRoadUtara) {
    const roadH = 42;
    const roadOffset = pelepasanAktif && pelepasanSisi === 'utara' ? 42 : 8;
    roads.push({
      points: [
        { x: leftX - 24, y: topY - roadOffset - roadH },
        { x: rightXTop + 24, y: topY - roadOffset - roadH },
        { x: rightXTop + 24, y: topY - roadOffset },
        { x: leftX - 24, y: topY - roadOffset },
      ],
      label: utara,
      labelX: Math.round((leftX + rightXTop) / 2),
      labelY: Math.round(topY - roadOffset - roadH / 2 + 2),
      labelAngle: 0,
    });
  } else {
    edgeLabels.push({
      side: 'utara',
      text: utara,
      x: Math.round((leftX + rightXTop) / 2),
      y: pelepasanAktif && pelepasanSisi === 'utara' ? topY - 62 : topY - 30,
      angle: 0,
    });
  }

  if (hasRoadSelatan) {
    const roadH = 42;
    const roadOffset = pelepasanAktif && pelepasanSisi === 'selatan' ? 42 : 8;
    roads.push({
      points: [
        { x: leftX - 24, y: bottomY + roadOffset },
        { x: rightXBottom + 24, y: bottomY + roadOffset },
        { x: rightXBottom + 24, y: bottomY + roadOffset + roadH },
        { x: leftX - 24, y: bottomY + roadOffset + roadH },
      ],
      label: selatan,
      labelX: Math.round((leftX + rightXBottom) / 2),
      labelY: Math.round(bottomY + roadOffset + roadH / 2 + 2),
      labelAngle: 0,
    });
  } else {
    edgeLabels.push({
      side: 'selatan',
      text: selatan,
      x: Math.round((leftX + rightXBottom) / 2),
      y: pelepasanAktif && pelepasanSisi === 'selatan' ? bottomY + 68 : bottomY + 36,
      angle: 0,
    });
  }

  if (pelepasanAktif) {
    const pelepasanText = 'Dilepaskan Untuk Jalan';
    if (pelepasanSisi === 'utara') {
      const stripH = 34;
      roads.push({
        points: [
          { x: leftX, y: topY - stripH },
          { x: rightXTop + (hasRoadTimur ? 8 : 0), y: topY - stripH },
          { x: rightXTop + (hasRoadTimur ? 4 : 0), y: topY },
          { x: leftX, y: topY },
        ],
        label: pelepasanText,
        labelX: Math.round((leftX + rightXTop) / 2),
        labelY: Math.round(topY - stripH / 2 + 1),
        labelAngle: 0,
        isPelepasanJalan: true,
      });
    } else if (pelepasanSisi === 'selatan') {
      const stripH = 34;
      roads.push({
        points: [
          { x: leftX, y: bottomY },
          { x: rightXBottom + (hasRoadTimur ? 8 : 0), y: bottomY },
          { x: rightXBottom + (hasRoadTimur ? 4 : 0), y: bottomY + stripH },
          { x: leftX, y: bottomY + stripH },
        ],
        label: pelepasanText,
        labelX: Math.round((leftX + rightXBottom) / 2),
        labelY: Math.round(bottomY + stripH / 2 + 1),
        labelAngle: 0,
        isPelepasanJalan: true,
      });
    } else if (pelepasanSisi === 'barat') {
      const stripW = 34;
      roads.push({
        points: [
          { x: leftX - stripW, y: topY },
          { x: leftX, y: topY },
          { x: leftX, y: bottomY },
          { x: leftX - stripW, y: bottomY },
        ],
        label: pelepasanText,
        labelX: Math.round(leftX - stripW / 2),
        labelY: Math.round((topY + bottomY) / 2),
        labelAngle: -90,
        isPelepasanJalan: true,
      });
    } else {
      const stripW = 34;
      roads.push({
        points: [
          { x: rightXTop, y: topY },
          { x: rightXTop + stripW, y: topY },
          { x: rightXBottom + stripW, y: bottomY },
          { x: rightXBottom, y: bottomY },
        ],
        label: pelepasanText,
        labelX: Math.round((rightXTop + rightXBottom) / 2 + stripW / 2),
        labelY: Math.round((topY + bottomY) / 2),
        labelAngle: -90,
        isPelepasanJalan: true,
      });
    }
  }

  const subdivisions: SketchSubdivisionLine[] = [];
  const lotLabels: SketchLotLabel[] = [];
  const bidangList =
    input.isPemecahan !== false && input.bidangPecahan && input.bidangPecahan.length > 0
      ? input.bidangPecahan
      : [];

  if (bidangList.length >= 2) {
    const weights = bidangList.map((b) => (b.luas_m2 > 0 ? b.luas_m2 : 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0) || bidangList.length;

    if (orientation === 'horizontal') {
      const totalH = bottomY - topY;
      let accWeight = 0;
      for (let i = 0; i < bidangList.length; i += 1) {
        const startRatio = accWeight / totalWeight;
        accWeight += weights[i];
        const endRatio = accWeight / totalWeight;

        if (i < bidangList.length - 1) {
          const divY = Math.round(topY + totalH * endRatio);
          const rightAtY = Math.round(rightXTop + (rightXBottom - rightXTop) * endRatio);
          subdivisions.push({
            x1: leftX,
            y1: divY,
            x2: rightAtY,
            y2: divY,
          });
        }

        const midRatio = (startRatio + endRatio) / 2;
        const midY = Math.round(topY + totalH * midRatio);
        const rightAtMid = rightXTop + (rightXBottom - rightXTop) * midRatio;
        const midX = Math.round((leftX + rightAtMid) / 2);
        lotLabels.push({
          text: String(i + 1),
          x: midX,
          y: midY,
          subtext: bidangList[i].luas_m2 > 0 ? `${bidangList[i].luas_m2} m²` : undefined,
        });
      }
    } else {
      const widthTop = rightXTop - leftX;
      const widthBottom = rightXBottom - leftX;

      let accWeight = 0;
      for (let i = 0; i < bidangList.length; i += 1) {
        const startRatio = accWeight / totalWeight;
        accWeight += weights[i];
        const endRatio = accWeight / totalWeight;

        if (i < bidangList.length - 1) {
          const divXTop = Math.round(leftX + widthTop * endRatio);
          const divXBottom = Math.round(leftX + widthBottom * endRatio);
          subdivisions.push({
            x1: divXTop,
            y1: topY,
            x2: divXBottom,
            y2: bottomY,
          });
        }

        const midRatio = (startRatio + endRatio) / 2;
        const midX = Math.round(leftX + ((widthTop + widthBottom) / 2) * midRatio);
        const midY = Math.round((topY + bottomY) / 2);
        lotLabels.push({
          text: String(i + 1),
          x: midX,
          y: midY,
          subtext: bidangList[i].luas_m2 > 0 ? `${bidangList[i].luas_m2} m²` : undefined,
        });
      }
    }
  } else {
    lotLabels.push({
      text: '1',
      x: Math.round((leftX + (rightXTop + rightXBottom) / 2) / 2),
      y: Math.round((topY + bottomY) / 2),
      subtext: input.luasIndukM2 && input.luasIndukM2 > 0 ? `${input.luasIndukM2} m²` : undefined,
    });
  }

  return {
    viewBoxWidth: CAD_VIEWBOX_WIDTH,
    viewBoxHeight: CAD_VIEWBOX_HEIGHT,
    northArrowAngle: 0,
    outerPolygon,
    subdivisions,
    lotLabels,
    roads,
    edgeLabels,
    dimensions: [],
    detectedBoundaries: {
      utara: sanitizeDetectedBoundaryName(input.batasUtara),
      timur: sanitizeDetectedBoundaryName(input.batasTimur),
      selatan: sanitizeDetectedBoundaryName(input.batasSelatan),
      barat: sanitizeDetectedBoundaryName(input.batasBarat),
    },
    summary:
      bidangList.length >= 2
        ? `Sket CAD otomatis dengan ${bidangList.length} bidang pecahan (${orientation === 'horizontal' ? 'bagi atas–bawah' : 'bagi kiri–kanan'})${pelepasanAktif ? ' dan jalur pelepasan jalan' : ''}.`
        : 'Sket CAD otomatis 1 bidang tanah sesuai batas-batas yang diisi.',
  };
}

/**
 * Menormalkan dan memvalidasi spesifikasi sket CAD hasil ekstraksi AI dari gambar kasar:
 * 1. Auto-fit & centering proporsional (menjaga rasio aspek poligon utama agar selalu berada
 *    rapi di area gambar utama, tidak menabrak panah Utara di sisi kiri dan tidak gepeng).
 * 2. Pelurusan sudut hampir horizontal/vertikal (<= 4.5°) agar garis CAD presisi.
 * 3. Snapping ujung garis pemisah bidang (subdivisions) tepat ke sisi poligon utama.
 * 4. Penghindaran tabrakan label batas tepi dengan poligon/jalan & pembersihan komentar AI.
 */
export function normalizeCadSketchSpec(
  raw: Partial<CadSketchSpec> | null | undefined,
  fallbackInput?: AutoCadSketchInput
): CadSketchSpec {
  const fallback = buildAutoCadSketchSpec(fallbackInput ?? {});
  if (!raw || typeof raw !== 'object') return fallback;

  const rawPoly = Array.isArray(raw.outerPolygon) ? raw.outerPolygon : [];
  const parsedPoly: SketchPoint[] = rawPoly
    .filter(
      (p): p is SketchPoint =>
        Boolean(p) &&
        typeof p.x === 'number' &&
        typeof p.y === 'number' &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y)
    )
    .map((p) => ({ x: p.x, y: p.y }));

  if (parsedPoly.length < 3) {
    return fallback;
  }

  // Hitung transformasi auto-fit proporsional bila poligon AI terlalu kecil, keluar bingkai,
  // atau terlalu condong ke tepi (mis. menabrak panah Utara x < 165).
  const rawBounds = computePolygonBounds(parsedPoly);
  const idealW = IDEAL_MAX_X - IDEAL_MIN_X; // 600
  const idealH = IDEAL_MAX_Y - IDEAL_MIN_Y; // 375
  const idealCx = (IDEAL_MIN_X + IDEAL_MAX_X) / 2; // 515
  const idealCy = (IDEAL_MIN_Y + IDEAL_MAX_Y) / 2; // 312.5

  const needsAutoFit =
    rawBounds.minX < 175 ||
    rawBounds.maxX > 875 ||
    rawBounds.minY < 85 ||
    rawBounds.maxY > 545 ||
    rawBounds.width < 260 ||
    rawBounds.height < 160;

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  if (needsAutoFit) {
    scale = Math.min(idealW / rawBounds.width, idealH / rawBounds.height);
    scale = clamp(scale, 0.45, 3.2);
    offsetX = idealCx - rawBounds.cx * scale;
    offsetY = idealCy - rawBounds.cy * scale;
  }

  const tx = (x: number) => Math.round(x * scale + offsetX);
  const ty = (y: number) => Math.round(y * scale + offsetY);

  const transformedPoly = parsedPoly.map((p) => ({
    x: clamp(tx(p.x), 175, 865),
    y: clamp(ty(p.y), 90, 535),
  }));

  const validPoly = snapPolygonOrthogonal(transformedPoly, 4.5);
  const polyBounds = computePolygonBounds(validPoly);

  const subdivisions: SketchSubdivisionLine[] = (Array.isArray(raw.subdivisions) ? raw.subdivisions : [])
    .filter(
      (s): s is SketchSubdivisionLine =>
        Boolean(s) &&
        typeof s.x1 === 'number' &&
        typeof s.y1 === 'number' &&
        typeof s.x2 === 'number' &&
        typeof s.y2 === 'number' &&
        Number.isFinite(s.x1) &&
        Number.isFinite(s.y1) &&
        Number.isFinite(s.x2) &&
        Number.isFinite(s.y2)
    )
    .map((s) => {
      const p1 = snapEndpointToPolygon(
        { x: clamp(tx(s.x1), 170, 870), y: clamp(ty(s.y1), 85, 540) },
        validPoly,
        38
      );
      const p2 = snapEndpointToPolygon(
        { x: clamp(tx(s.x2), 170, 870), y: clamp(ty(s.y2), 85, 540) },
        validPoly,
        38
      );
      return snapLineOrthogonal(
        {
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          dashed: Boolean(s.dashed),
        },
        4.5
      );
    })
    .filter((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= 18);

  const lotLabels: SketchLotLabel[] = (Array.isArray(raw.lotLabels) ? raw.lotLabels : [])
    .filter(
      (l): l is SketchLotLabel =>
        Boolean(l) &&
        typeof l.text === 'string' &&
        l.text.trim().length > 0 &&
        typeof l.x === 'number' &&
        typeof l.y === 'number' &&
        Number.isFinite(l.x) &&
        Number.isFinite(l.y)
    )
    .map((l) => ({
      text: cleanLabel(l.text, 18),
      x: Math.round(clamp(tx(l.x), polyBounds.minX + 24, polyBounds.maxX - 24)),
      y: Math.round(clamp(ty(l.y), polyBounds.minY + 24, polyBounds.maxY - 24)),
      subtext: l.subtext ? cleanLabel(l.subtext, 28) : undefined,
    }));

  if (lotLabels.length === 0) {
    lotLabels.push({
      text: '1',
      x: Math.round(polyBounds.cx),
      y: Math.round(polyBounds.cy),
    });
  }

  const roads: SketchRoadCorridor[] = (Array.isArray(raw.roads) ? raw.roads : [])
    .filter(
      (r): r is SketchRoadCorridor =>
        Boolean(r) && Array.isArray(r.points) && r.points.length >= 2
    )
    .map((r) => {
      const pts = r.points
        .filter(
          (p) =>
            Boolean(p) &&
            typeof p.x === 'number' &&
            typeof p.y === 'number' &&
            Number.isFinite(p.x) &&
            Number.isFinite(p.y)
        )
        .map((p) => ({
          x: Math.round(clamp(tx(p.x), 135, 965)),
          y: Math.round(clamp(ty(p.y), 40, 600)),
        }));
      const avgX =
        pts.length > 0 ? Math.round(pts.reduce((sum, p) => sum + p.x, 0) / pts.length) : 500;
      const avgY =
        pts.length > 0 ? Math.round(pts.reduce((sum, p) => sum + p.y, 0) / pts.length) : 320;
      return {
        points: pts,
        label: cleanLabel(r.label, 36) || (r.isPelepasanJalan ? 'Dilepaskan Untuk Jalan' : 'Jalan'),
        labelX:
          typeof r.labelX === 'number' && Number.isFinite(r.labelX)
            ? Math.round(clamp(tx(r.labelX), 145, 960))
            : avgX,
        labelY:
          typeof r.labelY === 'number' && Number.isFinite(r.labelY)
            ? Math.round(clamp(ty(r.labelY), 42, 605))
            : avgY,
        labelAngle:
          typeof r.labelAngle === 'number' && Number.isFinite(r.labelAngle)
            ? clamp(r.labelAngle, -180, 180)
            : 0,
        isPelepasanJalan: Boolean(r.isPelepasanJalan),
      };
    })
    .filter((r) => r.points.length >= 2);

  // Hitung bounding box total (termasuk jalan) agar edgeLabels tidak menimpa poligon/jalan
  const allObstaclePoints = [...validPoly, ...roads.flatMap((r) => r.points)];
  const totalBounds = computePolygonBounds(allObstaclePoints);

  const rawEdgeLabels: SketchEdgeLabel[] = (Array.isArray(raw.edgeLabels) ? raw.edgeLabels : [])
    .filter(
      (e): e is SketchEdgeLabel =>
        Boolean(e) &&
        typeof e.text === 'string' &&
        e.text.trim().length > 0 &&
        typeof e.x === 'number' &&
        typeof e.y === 'number' &&
        Number.isFinite(e.x) &&
        Number.isFinite(e.y)
    )
    .map((e) => {
      const side: SketchEdgeLabel['side'] =
        e.side === 'utara' || e.side === 'timur' || e.side === 'selatan' || e.side === 'barat'
          ? e.side
          : 'lain';
      let x = Math.round(clamp(tx(e.x), 152, 962));
      let y = Math.round(clamp(ty(e.y), 34, 610));
      let angle =
        typeof e.angle === 'number' && Number.isFinite(e.angle) ? clamp(e.angle, -180, 180) : 0;

      // Dorong label keluar dari batas poligon bila terlalu mepet atau masuk ke dalam bidang
      if (side === 'utara') {
        y = Math.round(clamp(Math.min(y, polyBounds.minY - 26), 34, totalBounds.minY - 20 > 34 ? Math.min(y, polyBounds.minY - 26) : 34));
        angle = 0;
      } else if (side === 'selatan') {
        y = Math.round(clamp(Math.max(y, polyBounds.maxY + 34), 60, 608));
        angle = 0;
      } else if (side === 'barat') {
        x = Math.round(clamp(Math.min(x, polyBounds.minX - 32), 152, 950));
        if (Math.abs(angle) < 10) angle = -90;
      } else if (side === 'timur') {
        x = Math.round(clamp(Math.max(x, polyBounds.maxX + 34), 200, 962));
        if (Math.abs(angle) < 10) angle = -90;
      }

      return {
        side,
        text: cleanLabel(e.text, 40),
        x,
        y,
        angle,
      };
    });

  const edgeLabels = rawEdgeLabels.length > 0 ? rawEdgeLabels : fallback.edgeLabels;

  const dimensions: SketchDimensionLabel[] = (Array.isArray(raw.dimensions) ? raw.dimensions : [])
    .filter(
      (d): d is SketchDimensionLabel =>
        Boolean(d) &&
        typeof d.text === 'string' &&
        d.text.trim().length > 0 &&
        typeof d.x === 'number' &&
        typeof d.y === 'number' &&
        Number.isFinite(d.x) &&
        Number.isFinite(d.y)
    )
    .map((d) => ({
      text: cleanLabel(d.text, 20),
      x: Math.round(clamp(tx(d.x), 145, 960)),
      y: Math.round(clamp(ty(d.y), 35, 615)),
      angle:
        typeof d.angle === 'number' && Number.isFinite(d.angle) ? clamp(d.angle, -180, 180) : 0,
    }));

  const detectedBoundaries = {
    utara: sanitizeDetectedBoundaryName(raw.detectedBoundaries?.utara),
    timur: sanitizeDetectedBoundaryName(raw.detectedBoundaries?.timur),
    selatan: sanitizeDetectedBoundaryName(raw.detectedBoundaries?.selatan),
    barat: sanitizeDetectedBoundaryName(raw.detectedBoundaries?.barat),
  };

  return {
    viewBoxWidth: CAD_VIEWBOX_WIDTH,
    viewBoxHeight: CAD_VIEWBOX_HEIGHT,
    northArrowAngle:
      typeof raw.northArrowAngle === 'number' && Number.isFinite(raw.northArrowAngle)
        ? clamp(raw.northArrowAngle, -180, 180)
        : 0,
    outerPolygon: validPoly,
    subdivisions,
    lotLabels,
    roads,
    edgeLabels,
    dimensions,
    detectedBoundaries,
    summary:
      typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : 'Sket kasar berhasil disempurnakan menjadi gambar bidang CAD rapi.',
  };
}

/**
 * Memutar spesifikasi sket CAD 90° searah jarum jam di sekitar pusat bidang tanah
 * (berguna bila foto/scan sket kasar diunggah miring/landscape) lalu menormalkan posisinya.
 */
export function rotateCadSketchSpec90(spec: CadSketchSpec): CadSketchSpec {
  const b = computePolygonBounds(spec.outerPolygon);
  const rotPt = (p: SketchPoint): SketchPoint => ({
    x: b.cx - (p.y - b.cy),
    y: b.cy + (p.x - b.cx),
  });
  const rotateSide = (side: SketchEdgeLabel['side']): SketchEdgeLabel['side'] => {
    if (side === 'utara') return 'timur';
    if (side === 'timur') return 'selatan';
    if (side === 'selatan') return 'barat';
    if (side === 'barat') return 'utara';
    return 'lain';
  };

  const rotatedRaw: Partial<CadSketchSpec> = {
    ...spec,
    outerPolygon: spec.outerPolygon.map(rotPt),
    subdivisions: spec.subdivisions.map((s) => {
      const a = rotPt({ x: s.x1, y: s.y1 });
      const c = rotPt({ x: s.x2, y: s.y2 });
      return { ...s, x1: a.x, y1: a.y, x2: c.x, y2: c.y };
    }),
    lotLabels: spec.lotLabels.map((l) => {
      const p = rotPt({ x: l.x, y: l.y });
      return { ...l, x: p.x, y: p.y };
    }),
    roads: spec.roads.map((r) => {
      const pts = r.points.map(rotPt);
      const lp = rotPt({ x: r.labelX, y: r.labelY });
      const nextAngle = r.labelAngle === 0 ? -90 : 0;
      return { ...r, points: pts, labelX: lp.x, labelY: lp.y, labelAngle: nextAngle };
    }),
    edgeLabels: spec.edgeLabels.map((e) => {
      const p = rotPt({ x: e.x, y: e.y });
      const nextSide = rotateSide(e.side);
      const nextAngle = nextSide === 'utara' || nextSide === 'selatan' ? 0 : -90;
      return { ...e, side: nextSide, x: p.x, y: p.y, angle: nextAngle };
    }),
    dimensions: spec.dimensions.map((d) => {
      const p = rotPt({ x: d.x, y: d.y });
      return { ...d, x: p.x, y: p.y, angle: d.angle === 0 ? -90 : 0 };
    }),
    summary: 'Orientasi sket bidang diputar 90° searah jarum jam.',
  };

  return normalizeCadSketchSpec(rotatedRaw);
}

/**
 * Menyinkronkan nama batas tetangga & keterangan luas dari data form ke poligon CAD aktif
 * tanpa mengubah bentuk geometri bidang tanah hasil penyempurnaan AI.
 */
export function syncFormLabelsToCadSpec(
  spec: CadSketchSpec,
  input: AutoCadSketchInput
): CadSketchSpec {
  const b = computePolygonBounds(spec.outerPolygon);
  const sideMap: Record<CardinalSide, string | undefined> = {
    utara: sanitizeDetectedBoundaryName(input.batasUtara),
    timur: sanitizeDetectedBoundaryName(input.batasTimur),
    selatan: sanitizeDetectedBoundaryName(input.batasSelatan),
    barat: sanitizeDetectedBoundaryName(input.batasBarat),
  };

  const existingSides = new Set<string>();
  const updatedEdges = spec.edgeLabels.map((edge) => {
    if (edge.side !== 'lain') {
      existingSides.add(edge.side);
      const formText = sideMap[edge.side];
      if (formText && !isRoadBoundary(formText)) {
        return { ...edge, text: formText };
      }
    }
    return edge;
  });

  // Tambah label batas sisi yang belum muncul (jika bukan koridor jalan eksisting)
  const addIfMissing = (side: CardinalSide, x: number, y: number, angle: number) => {
    const txt = sideMap[side];
    if (!txt || existingSides.has(side) || isRoadBoundary(txt)) return;
    updatedEdges.push({ side, text: txt, x, y, angle });
  };
  addIfMissing('utara', Math.round(b.cx), Math.max(40, Math.round(b.minY - 30)), 0);
  addIfMissing('selatan', Math.round(b.cx), Math.min(604, Math.round(b.maxY + 36)), 0);
  addIfMissing('barat', Math.max(154, Math.round(b.minX - 36)), Math.round(b.cy), -90);
  addIfMissing('timur', Math.min(958, Math.round(b.maxX + 36)), Math.round(b.cy), -90);

  const bidangList =
    input.isPemecahan !== false && input.bidangPecahan && input.bidangPecahan.length > 0
      ? input.bidangPecahan
      : [];
  const updatedLots = spec.lotLabels.map((lot, idx) => {
    const matched = bidangList[idx];
    if (matched && matched.luas_m2 > 0) {
      return { ...lot, subtext: `${matched.luas_m2} m²` };
    }
    return lot;
  });

  return {
    ...spec,
    edgeLabels: updatedEdges,
    lotLabels: updatedLots,
    summary: 'Label batas tetangga dan luas bidang disinkronkan dari data formulir.',
  };
}

/**
 * Merender spesifikasi sket CAD menjadi SVG vektor hitam-putih tajam standar BPN
 * (berlatar putih bersih, panah arah Utara "U", garis batas tegas, patok sudut, nomor bidang, dan label batas).
 */
export function renderCadSketchToSvg(spec: CadSketchSpec): string {
  const w = spec.viewBoxWidth || CAD_VIEWBOX_WIDTH;
  const h = spec.viewBoxHeight || CAD_VIEWBOX_HEIGHT;

  const polygonPointsAttr = spec.outerPolygon.map((p) => `${p.x},${p.y}`).join(' ');

  const roadsSvg = spec.roads
    .map((road) => {
      const ptsAttr = road.points.map((p) => `${p.x},${p.y}`).join(' ');
      const fill = road.isPelepasanJalan ? '#F8FAFC' : '#FFFFFF';
      const strokeDash = road.isPelepasanJalan ? ' stroke-dasharray="6,4"' : '';
      const transform = road.labelAngle
        ? ` transform="rotate(${road.labelAngle} ${road.labelX} ${road.labelY})"`
        : '';
      const fontSize = road.isPelepasanJalan ? 16 : 21;
      const shapeTag =
        road.points.length >= 3
          ? `<polygon points="${ptsAttr}" fill="${fill}" stroke="#111827" stroke-width="2"${strokeDash} stroke-linejoin="miter" />`
          : `<polyline points="${ptsAttr}" fill="none" stroke="#111827" stroke-width="2"${strokeDash} />`;
      return `
  <g>
    ${shapeTag}
    <text x="${road.labelX}" y="${road.labelY}" text-anchor="middle" dominant-baseline="middle" font-family="'Bookman Old Style', Georgia, serif" font-size="${fontSize}" fill="#111827"${transform}>${escapeSvgText(road.label)}</text>
  </g>`;
    })
    .join('');

  const subdivisionsSvg = spec.subdivisions
    .map((line) => {
      const dash = line.dashed ? ' stroke-dasharray="8,5"' : '';
      return `  <line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="#111827" stroke-width="2.2" stroke-linecap="square"${dash} />`;
    })
    .join('\n');

  // Penanda titik patok kecil di sudut-sudut poligon utama (standar gambar ukur BPN)
  const patokVerticesSvg = spec.outerPolygon
    .map(
      (pt) =>
        `  <circle cx="${pt.x}" cy="${pt.y}" r="3.2" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.8" />`
    )
    .join('\n');

  const lotLabelsSvg = spec.lotLabels
    .map((lot) => {
      const sub = lot.subtext
        ? `<text x="${lot.x}" y="${lot.y + 26}" text-anchor="middle" dominant-baseline="middle" font-family="'Bookman Old Style', Georgia, serif" font-size="16" fill="#334155">${escapeSvgText(lot.subtext)}</text>`
        : '';
      return `  <g>
    <text x="${lot.x}" y="${lot.y}" text-anchor="middle" dominant-baseline="middle" font-family="'Bookman Old Style', Georgia, serif" font-size="34" font-weight="700" fill="#0F172A">${escapeSvgText(lot.text)}</text>
    ${sub}
  </g>`;
    })
    .join('\n');

  const edgeLabelsSvg = spec.edgeLabels
    .map((lbl) => {
      const transform = lbl.angle ? ` transform="rotate(${lbl.angle} ${lbl.x} ${lbl.y})"` : '';
      return `  <text x="${lbl.x}" y="${lbl.y}" text-anchor="middle" dominant-baseline="middle" font-family="'Bookman Old Style', Georgia, serif" font-size="22" fill="#111827"${transform}>${escapeSvgText(lbl.text)}</text>`;
    })
    .join('\n');

  const dimensionsSvg = spec.dimensions
    .map((dim) => {
      const transform = dim.angle ? ` transform="rotate(${dim.angle} ${dim.x} ${dim.y})"` : '';
      return `  <text x="${dim.x}" y="${dim.y}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="600" fill="#1E293B"${transform}>${escapeSvgText(dim.text)}</text>`;
    })
    .join('\n');

  const arrowRot = spec.northArrowAngle ? ` transform="rotate(${spec.northArrowAngle} 68 290)"` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect x="0" y="0" width="${w}" height="${h}" fill="#FFFFFF" />
  <g${arrowRot}>
    <text x="68" y="88" text-anchor="middle" font-family="'Bookman Old Style', Georgia, serif" font-size="26" font-weight="700" fill="#111827">U</text>
    <line x1="68" y1="490" x2="68" y2="122" stroke="#111827" stroke-width="2.6" />
    <polygon points="68,108 59,130 77,130" fill="#111827" />
  </g>
${roadsSvg}
  <polygon points="${polygonPointsAttr}" fill="#FFFFFF" stroke="#111827" stroke-width="2.8" stroke-linejoin="miter" />
${subdivisionsSvg}
${patokVerticesSvg}
${lotLabelsSvg}
${edgeLabelsSvg}
${dimensionsSvg}
</svg>`;
}

/**
 * Mengonversi SVG CAD menjadi PNG Data URL resolusi tinggi di browser
 * agar dapat disematkan langsung ke Microsoft Word (.DOCX) via ImageRun.
 */
export async function rasterizeSvgToPngDataUrl(
  svgString: string,
  width = 1200,
  height = 768
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Rasterisasi SVG ke PNG hanya tersedia di lingkungan browser.');
  }

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Gagal merender SVG sket ke gambar PNG.'));
      image.src = src;
    });

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    let img: HTMLImageElement;
    try {
      img = await loadImage(blobUrl);
    } catch {
      const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
      img = await loadImage(encoded);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context tidak tersedia.');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
