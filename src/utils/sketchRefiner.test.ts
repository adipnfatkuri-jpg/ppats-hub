import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAutoCadSketchSpec,
  isBoundaryNonPerson,
  isRoadBoundary,
  normalizeCadSketchSpec,
  renderCadSketchToSvg,
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

test('normalizeCadSketchSpec clamps out-of-bounds coordinates and falls back when polygon is invalid', () => {
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
    detectedBoundaries: { utara: 'Sumedi', timur: 'Jalan' },
  });

  assert.equal(normalized.outerPolygon[0].x, 155);
  assert.equal(normalized.outerPolygon[1].x, 920);
  assert.equal(normalized.outerPolygon[2].y, 565);
  assert.equal(normalized.detectedBoundaries?.utara, 'Sumedi');

  const svg = renderCadSketchToSvg(normalized);
  assert.ok(svg.includes('Sumedi &amp; &lt;Test&gt;'), 'SVG text must be XML-escaped');
  assert.ok(svg.includes('24,5 m'));

  const fallbackResult = normalizeCadSketchSpec(
    { outerPolygon: [{ x: 10, y: 10 }] },
    { batasUtara: 'Karno', batasSelatan: 'Jalan' }
  );
  assert.equal(fallbackResult.outerPolygon.length, 4);
  assert.ok(renderCadSketchToSvg(fallbackResult).includes('Karno'));
});
