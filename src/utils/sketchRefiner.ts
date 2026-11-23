import { PemecahanBidangItem } from '../types/ppats';

export type CardinalSide = 'utara' | 'timur' | 'selatan' | 'barat';

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
  northArrowAngle: number;
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
}

export const CAD_VIEWBOX_WIDTH = 1000;
export const CAD_VIEWBOX_HEIGHT = 640;

const NON_PERSON_BOUNDARY_REGEX =
  /\b(jalan|jl\.?|gang|gg\.?|sungai|kali|saluran|irigasi|parit|selokan|got|rel|kereta|makam|kuburan|tanah\s+negara|tanah\s+kas|tanah\s+desa|lapangan|fasum|fasos|jembatan|tanggul)\b/i;

/**
 * Mengembalikan true jika teks batas merupakan fasilitas umum / non-perorangan
 * (mis. Jalan, Sungai, Saluran) sehingga tidak memerlukan kolom tanda tangan "(   )".
 */
export function isBoundaryNonPerson(raw?: string): boolean {
  const clean = (raw || '').trim();
  if (!clean || clean === '-') return false;
  return NON_PERSON_BOUNDARY_REGEX.test(clean);
}

/**
 * Mendeteksi apakah teks batas merupakan jalan/akses untuk digambar sebagai koridor jalan.
 */
export function isRoadBoundary(raw?: string): boolean {
  const clean = (raw || '').trim();
  if (!clean) return false;
  return /\b(jalan|jl\.?|gang|gg\.?|akses)\b/i.test(clean);
}

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanLabel(val?: string, maxLen = 44): string {
  const trimmed = (val || '').replace(/\s+/g, ' ').trim();
  if (!trimmed || trimmed === '-') return '';
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen - 1)}…` : trimmed;
}

/**
 * Menyusun spesifikasi sket CAD bersih secara deterministik dari data form
 * (menyerupai format standar BPN Boyolali: panah Utara, poligon rapi, nomor bidang 1, 2, ...,
 * koridor Jalan, dan jalur Dilepaskan Untuk Jalan bila aktif).
 */
export function buildAutoCadSketchSpec(input: AutoCadSketchInput): CadSketchSpec {
  const utara = cleanLabel(input.batasUtara) || 'Batas Utara';
  const timur = cleanLabel(input.batasTimur) || 'Batas Timur';
  const selatan = cleanLabel(input.batasSelatan) || 'Batas Selatan';
  const barat = cleanLabel(input.batasBarat) || 'Batas Barat';

  const hasRoadUtara = isRoadBoundary(input.batasUtara);
  const hasRoadTimur = isRoadBoundary(input.batasTimur);
  const hasRoadSelatan = isRoadBoundary(input.batasSelatan);
  const hasRoadBarat = isRoadBoundary(input.batasBarat);

  const pelepasanAktif = Boolean(input.sertakanPelepasanJalan);
  const pelepasanSisi: CardinalSide = input.pelepasanJalanSisi || 'utara';

  // Area parcel utama (memberi ruang lega untuk panah U di kiri & label batas di 4 sisi)
  const leftX = hasRoadBarat || (pelepasanAktif && pelepasanSisi === 'barat') ? 265 : 225;
  const rightXTop = hasRoadTimur || (pelepasanAktif && pelepasanSisi === 'timur') ? 790 : 835;
  // Sedikit kemiringan realistis jika ada jalan di sisi timur (seperti sket BPN), atau tegak lurus
  const rightXBottom = hasRoadTimur ? rightXTop - 36 : rightXTop;
  const topY = hasRoadUtara || (pelepasanAktif && pelepasanSisi === 'utara') ? 160 : 125;
  const bottomY = hasRoadSelatan || (pelepasanAktif && pelepasanSisi === 'selatan') ? 470 : 505;

  const outerPolygon: SketchPoint[] = [
    { x: leftX, y: topY },
    { x: rightXTop, y: topY },
    { x: rightXBottom, y: bottomY },
    { x: leftX, y: bottomY },
  ];

  const roads: SketchRoadCorridor[] = [];
  const edgeLabels: SketchEdgeLabel[] = [];

  // Koridor Jalan eksisting jika batas merupakan Jalan
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
      x: Math.round(Math.max(rightXTop, rightXBottom) + 36),
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
      x: leftX - 38,
      y: Math.round((topY + bottomY) / 2),
      angle: -90,
    });
  }

  if (hasRoadUtara) {
    const roadH = 42;
    roads.push({
      points: [
        { x: leftX - 24, y: topY - 8 - roadH },
        { x: rightXTop + 24, y: topY - 8 - roadH },
        { x: rightXTop + 24, y: topY - 8 },
        { x: leftX - 24, y: topY - 8 },
      ],
      label: utara,
      labelX: Math.round((leftX + rightXTop) / 2),
      labelY: Math.round(topY - 8 - roadH / 2 + 5),
      labelAngle: 0,
    });
  } else {
    edgeLabels.push({
      side: 'utara',
      text: utara,
      x: Math.round((leftX + rightXTop) / 2),
      y: pelepasanAktif && pelepasanSisi === 'utara' ? topY - 58 : topY - 26,
      angle: 0,
    });
  }

  if (hasRoadSelatan) {
    const roadH = 42;
    roads.push({
      points: [
        { x: leftX - 24, y: bottomY + 8 },
        { x: rightXBottom + 24, y: bottomY + 8 },
        { x: rightXBottom + 24, y: bottomY + 8 + roadH },
        { x: leftX - 24, y: bottomY + 8 + roadH },
      ],
      label: selatan,
      labelX: Math.round((leftX + rightXBottom) / 2),
      labelY: Math.round(bottomY + 8 + roadH / 2 + 5),
      labelAngle: 0,
    });
  } else {
    edgeLabels.push({
      side: 'selatan',
      text: selatan,
      x: Math.round((leftX + rightXBottom) / 2),
      y: pelepasanAktif && pelepasanSisi === 'selatan' ? bottomY + 72 : bottomY + 38,
      angle: 0,
    });
  }

  // Strip "Dilepaskan Untuk Jalan" bila aktif
  if (pelepasanAktif) {
    const pelepasanText = 'Dilepaskan Untuk Jalan';
    if (pelepasanSisi === 'utara') {
      const stripH = 32;
      roads.push({
        points: [
          { x: leftX, y: topY - stripH },
          { x: rightXTop + (hasRoadTimur ? 8 : 0), y: topY - stripH },
          { x: rightXTop + (hasRoadTimur ? 4 : 0), y: topY },
          { x: leftX, y: topY },
        ],
        label: pelepasanText,
        labelX: Math.round((leftX + rightXTop) / 2),
        labelY: Math.round(topY - stripH / 2 + 5),
        labelAngle: 0,
        isPelepasanJalan: true,
      });
    } else if (pelepasanSisi === 'selatan') {
      const stripH = 32;
      roads.push({
        points: [
          { x: leftX, y: bottomY },
          { x: rightXBottom + (hasRoadTimur ? 8 : 0), y: bottomY },
          { x: rightXBottom + (hasRoadTimur ? 4 : 0), y: bottomY + stripH },
          { x: leftX, y: bottomY + stripH },
        ],
        label: pelepasanText,
        labelX: Math.round((leftX + rightXBottom) / 2),
        labelY: Math.round(bottomY + stripH / 2 + 5),
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

  // Pembagian bidang pecahan berdasarkan proporsi luas
  const subdivisions: SketchSubdivisionLine[] = [];
  const lotLabels: SketchLotLabel[] = [];
  const bidangList =
    input.isPemecahan !== false && input.bidangPecahan && input.bidangPecahan.length > 0
      ? input.bidangPecahan
      : [];

  if (bidangList.length >= 2) {
    const weights = bidangList.map((b) => (b.luas_m2 > 0 ? b.luas_m2 : 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0) || bidangList.length;
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
      });
    }
  } else {
    lotLabels.push({
      text: '1',
      x: Math.round((leftX + (rightXTop + rightXBottom) / 2) / 2),
      y: Math.round((topY + bottomY) / 2),
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
      utara: cleanLabel(input.batasUtara) || undefined,
      timur: cleanLabel(input.batasTimur) || undefined,
      selatan: cleanLabel(input.batasSelatan) || undefined,
      barat: cleanLabel(input.batasBarat) || undefined,
    },
    summary:
      bidangList.length >= 2
        ? `Sket CAD otomatis dengan ${bidangList.length} bidang pecahan${pelepasanAktif ? ' dan jalur pelepasan jalan' : ''}.`
        : 'Sket CAD otomatis 1 bidang tanah sesuai batas-batas yang diisi.',
  };
}

/**
 * Menormalkan dan memvalidasi spesifikasi sket CAD hasil ekstraksi AI dari gambar kasar
 * agar koordinat selalu berada di dalam kanvas, poligon tertutup rapi, dan teks terbaca jelas.
 */
export function normalizeCadSketchSpec(
  raw: Partial<CadSketchSpec> | null | undefined,
  fallbackInput?: AutoCadSketchInput
): CadSketchSpec {
  const fallback = buildAutoCadSketchSpec(fallbackInput ?? {});
  if (!raw || typeof raw !== 'object') return fallback;

  const rawPoly = Array.isArray(raw.outerPolygon) ? raw.outerPolygon : [];
  const validPoly: SketchPoint[] = rawPoly
    .filter(
      (p): p is SketchPoint =>
        Boolean(p) && typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y)
    )
    .map((p) => ({
      x: Math.round(clamp(p.x, 155, 920)),
      y: Math.round(clamp(p.y, 75, 565)),
    }));

  if (validPoly.length < 3) {
    return fallback;
  }

  const subdivisions: SketchSubdivisionLine[] = (Array.isArray(raw.subdivisions) ? raw.subdivisions : [])
    .filter(
      (s): s is SketchSubdivisionLine =>
        Boolean(s) &&
        typeof s.x1 === 'number' &&
        typeof s.y1 === 'number' &&
        typeof s.x2 === 'number' &&
        typeof s.y2 === 'number'
    )
    .map((s) => ({
      x1: Math.round(clamp(s.x1, 155, 920)),
      y1: Math.round(clamp(s.y1, 75, 565)),
      x2: Math.round(clamp(s.x2, 155, 920)),
      y2: Math.round(clamp(s.y2, 75, 565)),
      dashed: Boolean(s.dashed),
    }));

  const lotLabels: SketchLotLabel[] = (Array.isArray(raw.lotLabels) ? raw.lotLabels : [])
    .filter(
      (l): l is SketchLotLabel =>
        Boolean(l) && typeof l.text === 'string' && l.text.trim().length > 0 && typeof l.x === 'number' && typeof l.y === 'number'
    )
    .map((l) => ({
      text: cleanLabel(l.text, 18),
      x: Math.round(clamp(l.x, 165, 910)),
      y: Math.round(clamp(l.y, 85, 555)),
      subtext: l.subtext ? cleanLabel(l.subtext, 28) : undefined,
    }));

  const roads: SketchRoadCorridor[] = (Array.isArray(raw.roads) ? raw.roads : [])
    .filter(
      (r): r is SketchRoadCorridor =>
        Boolean(r) && Array.isArray(r.points) && r.points.length >= 2
    )
    .map((r) => {
      const pts = r.points
        .filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number')
        .map((p) => ({
          x: Math.round(clamp(p.x, 130, 965)),
          y: Math.round(clamp(p.y, 45, 600)),
        }));
      const avgX = pts.length > 0 ? Math.round(pts.reduce((sum, p) => sum + p.x, 0) / pts.length) : 500;
      const avgY = pts.length > 0 ? Math.round(pts.reduce((sum, p) => sum + p.y, 0) / pts.length) : 320;
      return {
        points: pts,
        label: cleanLabel(r.label, 36) || (r.isPelepasanJalan ? 'Dilepaskan Untuk Jalan' : 'Jalan'),
        labelX: typeof r.labelX === 'number' ? Math.round(clamp(r.labelX, 140, 960)) : avgX,
        labelY: typeof r.labelY === 'number' ? Math.round(clamp(r.labelY, 45, 605)) : avgY,
        labelAngle: typeof r.labelAngle === 'number' && Number.isFinite(r.labelAngle) ? clamp(r.labelAngle, -180, 180) : 0,
        isPelepasanJalan: Boolean(r.isPelepasanJalan),
      };
    })
    .filter((r) => r.points.length >= 2);

  const edgeLabels: SketchEdgeLabel[] = (Array.isArray(raw.edgeLabels) ? raw.edgeLabels : [])
    .filter(
      (e): e is SketchEdgeLabel =>
        Boolean(e) && typeof e.text === 'string' && e.text.trim().length > 0 && typeof e.x === 'number' && typeof e.y === 'number'
    )
    .map((e) => ({
      side:
        e.side === 'utara' || e.side === 'timur' || e.side === 'selatan' || e.side === 'barat'
          ? e.side
          : 'lain',
      text: cleanLabel(e.text, 40),
      x: Math.round(clamp(e.x, 130, 965)),
      y: Math.round(clamp(e.y, 35, 615)),
      angle: typeof e.angle === 'number' && Number.isFinite(e.angle) ? clamp(e.angle, -180, 180) : 0,
    }));

  const dimensions: SketchDimensionLabel[] = (Array.isArray(raw.dimensions) ? raw.dimensions : [])
    .filter(
      (d): d is SketchDimensionLabel =>
        Boolean(d) && typeof d.text === 'string' && d.text.trim().length > 0 && typeof d.x === 'number' && typeof d.y === 'number'
    )
    .map((d) => ({
      text: cleanLabel(d.text, 20),
      x: Math.round(clamp(d.x, 135, 960)),
      y: Math.round(clamp(d.y, 35, 615)),
      angle: typeof d.angle === 'number' && Number.isFinite(d.angle) ? clamp(d.angle, -180, 180) : 0,
    }));

  const detectedBoundaries = {
    utara: cleanLabel(raw.detectedBoundaries?.utara) || undefined,
    timur: cleanLabel(raw.detectedBoundaries?.timur) || undefined,
    selatan: cleanLabel(raw.detectedBoundaries?.selatan) || undefined,
    barat: cleanLabel(raw.detectedBoundaries?.barat) || undefined,
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
 * Merender spesifikasi sket CAD menjadi SVG vektor hitam-putih tajam standar BPN
 * (berlatar putih bersih, panah arah Utara "U", garis batas tegas, nomor bidang, dan label batas).
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
      const fontSize = road.isPelepasanJalan ? 17 : 22;
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
      return `  <line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="#111827" stroke-width="2.2"${dash} />`;
    })
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
      return `  <text x="${lbl.x}" y="${lbl.y}" text-anchor="middle" dominant-baseline="middle" font-family="'Bookman Old Style', Georgia, serif" font-size="23" fill="#111827"${transform}>${escapeSvgText(lbl.text)}</text>`;
    })
    .join('\n');

  const dimensionsSvg = spec.dimensions
    .map((dim) => {
      const transform = dim.angle ? ` transform="rotate(${dim.angle} ${dim.x} ${dim.y})"` : '';
      return `  <text x="${dim.x}" y="${dim.y}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="600" fill="#1E293B"${transform}>${escapeSvgText(dim.text)}</text>`;
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

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Gagal merender SVG sket ke gambar PNG.'));
      image.src = blobUrl;
    });

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
