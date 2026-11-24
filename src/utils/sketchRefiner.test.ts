import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAutoCadSketchSpec,
  isBoundaryNonPerson,
  isRoadBoundary,
  normalizeCadSketchSpec,
  renderCadSketchToSvg,
  rotateCadSketchSpec90,
  sanitizeDetectedBoundaryName,
  syncFormLabelsToCadSpec,
} from './sketchRefiner';

test('isBoundaryNonPerson distinguishes public infrastructure from individual neighbors', () => {
  assert.equal(isBoundaryNonPerson('Jalan'), true);
  assert.equal(isBoundaryNonPerson('Jalan Desa / Aspal'), true);
  assert.equal(isBoundaryNonPerson('Saluran Irigasi'), true);
  assert.equal(isBoundaryNonPerson('Sungai Pepe'), true);
  assert.equal(isBoundaryNonPerson('Sumedi'), false);
  assert.equal(isBoundaryNonPerson('Rohim'), false);
  assert.equal(isBoundaryNonPerson('Sadli'), false);
  assert.equal(isBoundaryNonPerson(''), false);
});

test('isRoadBoundary detects road-like boundary labels', () => {
  assert.equal(isRoadBoundary('Jalan'), true);
  assert.equal(isRoadBoundary('Jl. Raya Sawahan'), true);
  assert.equal(isRoadBoundary('Gang Mawar'), true);
  assert.equal(isRoadBoundary('Sumedi'), false);
});

test('buildAutoCadSketchSpec generates multi-parcel CAD diagram with road corridor and pelepasan jalan', () => {
  const spec = buildAutoCadSketchSpec({
    batasUtara: 'Sumedi',
    batasTimur: 'Jalan',
    batasSelatan: 'Rohim',
    batasBarat: 'Sadli',
    luasIndukM2: 778,
    isPemecahan: true,
    bidangPecahan: [
      { id: 'b1', label: 'Bagian 1 (sisa)', luas_m2: 196 },
      { id: 'b2', label: 'Bagian 2 (Tri Handoko)', luas_m2: 432 },
    ],
    sertakanPelepasanJalan: true,
    pelepasanJalanLuasM2: 150,
    pelepasanJalanSisi: 'utara',
  });

  assert.equal(spec.outerPolygon.length, 4);
  assert.equal(spec.subdivisions.length, 1, '2 parcels must produce 1 internal divider line');
  assert.equal(spec.lotLabels.length, 2);
  assert.equal(spec.lotLabels[0].text, '1');
  assert.equal(spec.lotLabels[1].text, '2');
  assert.ok(
    spec.roads.some((r) => r.label === 'Jalan'),
    'East boundary "Jalan" must render as a road corridor'
  );
  assert.ok(
    spec.roads.some((r) => r.isPelepasanJalan && r.label.includes('Dilepaskan Untuk Jalan')),
    'Enabled pelepasan jalan must render dedicated strip'
  );

  const svg = renderCadSketchToSvg(spec);
  assert.ok(svg.startsWith('<svg '));
  assert.ok(svg.includes('>U</text>'), 'North arrow U must be present');
  assert.ok(svg.includes('Sumedi'));
  assert.ok(svg.includes('Rohim'));
  assert.ok(svg.includes('Sadli'));
  assert.ok(svg.includes('Jalan'));
  assert.ok(svg.includes('Dilepaskan Untuk Jalan'));
  assert.ok(svg.includes('>1</text>'));
  assert.ok(svg.includes('>2</text>'));
});

test('buildAutoCadSketchSpec handles single-parcel Ukur Ulang cleanly without subdivision lines', () => {
  const spec = buildAutoCadSketchSpec({
    batasUtara: 'Sutarno',
    batasTimur: 'Pardi',
    batasSelatan: 'Jalan Desa',
    batasBarat: 'Wagiyem',
    luasIndukM2: 420,
    isPemecahan: false,
  });

  assert.equal(spec.subdivisions.length, 0);
  assert.equal(spec.lotLabels.length, 1);
  assert.equal(spec.lotLabels[0].text, '1');
  assert.ok(spec.roads.some((r) => r.label === 'Jalan Desa'));
});

test('normalizeCadSketchSpec auto-fits out-of-bounds polygons cleanly and falls back when polygon is invalid', () => {
  const normalized = normalizeCadSketchSpec({
    outerPolygon: [
      { x: -50, y: 10 },
      { x: 1500, y: 80 },
      { x: 1200, y: 900 },
      { x: 100, y: 800 },
    ],
    subdivisions: [{ x1: 500, y1: 10, x2: 500, y2: 900 }],
    lotLabels: [
      { text: '1', x: 320, y: 300 },
      { text: '2', x: 680, y: 300 },
    ],
    edgeLabels: [{ side: 'utara', text: 'Sumedi & <Test>', x: 500, y: 50, angle: 0 }],
    dimensions: [{ text: '24,5 m', x: 500, y: 120, angle: 0 }],
    detectedBoundaries: {
      utara: 'Sumedi (dari form, tidak ada di sket)',
      timur: 'Jalan',
      selatan: 'tidak terbaca',
    },
  });

  // Auto-fit centers the polygon proportionally inside the safe CAD drawing frame [175..865] x [90..535]
  for (const pt of normalized.outerPolygon) {
    assert.ok(pt.x >= 175 && pt.x <= 865, `Expected x inside [175..865], got ${pt.x}`);
    assert.ok(pt.y >= 90 && pt.y <= 535, `Expected y inside [90..535], got ${pt.y}`);
  }
  assert.equal(normalized.detectedBoundaries?.utara, 'Sumedi', 'AI meta-commentary must be stripped');
  assert.equal(normalized.detectedBoundaries?.timur, 'Jalan');
  assert.equal(normalized.detectedBoundaries?.selatan, undefined, '"tidak terbaca" must normalize to undefined');

  const svg = renderCadSketchToSvg(normalized);
  assert.ok(svg.includes('Sumedi &amp; &lt;Test&gt;'), 'SVG text must be XML-escaped');
  assert.ok(svg.includes('24,5 m'));
  assert.ok(svg.includes('<circle '), 'Corner patok vertex markers must be rendered in SVG');

  const fallbackResult = normalizeCadSketchSpec(
    { outerPolygon: [{ x: 10, y: 10 }] },
    { batasUtara: 'Karno', batasSelatan: 'Jalan' }
  );
  assert.equal(fallbackResult.outerPolygon.length, 4);
  assert.ok(renderCadSketchToSvg(fallbackResult).includes('Karno'));
});

test('normalizeCadSketchSpec snaps near-orthogonal edges, snaps subdivision endpoints to parcel perimeter, and supports rotate90 + syncFormLabels + horizontal split', () => {
  // Slightly tilted rectangle (~2 deg) + floating subdivision line (15px short of edges)
  const snapped = normalizeCadSketchSpec({
    outerPolygon: [
      { x: 240, y: 150 },
      { x: 760, y: 158 },
      { x: 754, y: 470 },
      { x: 244, y: 465 },
    ],
    subdivisions: [{ x1: 500, y1: 170, x2: 506, y2: 452 }],
    lotLabels: [
      { text: '1', x: 370, y: 310 },
      { text: '2', x: 630, y: 310 },
    ],
    edgeLabels: [{ side: 'utara', text: 'Lama', x: 500, y: 145, angle: 0 }],
  });

  // Top edge y coordinates should be orthogonally leveled
  assert.equal(snapped.outerPolygon[0].y, snapped.outerPolygon[1].y);
  // Subdivision line should snap vertically & touch top and bottom polygon edges
  assert.equal(snapped.subdivisions.length, 1);
  assert.equal(snapped.subdivisions[0].x1, snapped.subdivisions[0].x2);
  assert.equal(snapped.subdivisions[0].y1, snapped.outerPolygon[0].y);
  assert.equal(snapped.subdivisions[0].y2, snapped.outerPolygon[2].y);

  // Edge label must be nudged outside polygon (above minY)
  assert.ok(snapped.edgeLabels[0].y < snapped.outerPolygon[0].y - 10);

  // Rotate 90° clockwise rotates utara -> timur
  const rotated = rotateCadSketchSpec90(snapped);
  assert.equal(rotated.edgeLabels[0].side, 'timur');

  // Sync form labels updates boundary text & lot areas without touching polygon shape
  const synced = syncFormLabelsToCadSpec(snapped, {
    batasUtara: 'H. Sutarno',
    batasSelatan: 'Suwardi',
    isPemecahan: true,
    bidangPecahan: [
      { id: '1', label: 'A', luas_m2: 210 },
      { id: '2', label: 'B', luas_m2: 340 },
    ],
  });
  assert.ok(synced.edgeLabels.some((e) => e.side === 'utara' && e.text === 'H. Sutarno'));
  assert.ok(synced.edgeLabels.some((e) => e.side === 'selatan' && e.text === 'Suwardi'));
  assert.equal(synced.lotLabels[0].subtext, '210 m²');
  assert.equal(synced.lotLabels[1].subtext, '340 m²');

  // Horizontal split orientation creates horizontal subdivision line (y1 === y2)
  const horiz = buildAutoCadSketchSpec({
    batasUtara: 'Utara',
    batasSelatan: 'Selatan',
    isPemecahan: true,
    splitOrientation: 'horizontal',
    bidangPecahan: [
      { id: '1', label: 'Atas', luas_m2: 150 },
      { id: '2', label: 'Bawah', luas_m2: 250 },
    ],
  });
  assert.equal(horiz.subdivisions.length, 1);
  assert.equal(horiz.subdivisions[0].y1, horiz.subdivisions[0].y2);

  // Sanitizer helper strips AI notes cleanly
  assert.equal(sanitizeDetectedBoundaryName('Budi (sesuai form)'), 'Budi');
  assert.equal(sanitizeDetectedBoundaryName('tidak jelas'), undefined);
});
