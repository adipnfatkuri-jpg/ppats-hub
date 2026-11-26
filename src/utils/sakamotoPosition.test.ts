import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampSakamotoPosition,
  clampSakamotoScale,
  compute3DTilt,
  computePinchScale,
  getDefaultSakamotoPosition,
  getScaledDimensions,
  isDragMovement,
  MAX_SAKAMOTO_SCALE,
  MIN_SAKAMOTO_SCALE,
  stepSakamotoScale,
} from './sakamotoPosition';

test('clampSakamotoScale enforces min/max bounds and handles non-finite input', () => {
  assert.equal(clampSakamotoScale(0.1), MIN_SAKAMOTO_SCALE);
  assert.equal(clampSakamotoScale(5.0), MAX_SAKAMOTO_SCALE);
  assert.equal(clampSakamotoScale(1.236), 1.24);
  assert.equal(clampSakamotoScale(Number.NaN), 1.0);
});

test('stepSakamotoScale increments and decrements within bounds', () => {
  assert.equal(stepSakamotoScale(1.0, 0.2), 1.2);
  assert.equal(stepSakamotoScale(1.0, -0.2), 0.8);
  assert.equal(stepSakamotoScale(MIN_SAKAMOTO_SCALE, -0.5), MIN_SAKAMOTO_SCALE);
  assert.equal(stepSakamotoScale(MAX_SAKAMOTO_SCALE, 0.5), MAX_SAKAMOTO_SCALE);
});

test('computePinchScale scales proportionally and clamps cleanly', () => {
  assert.equal(computePinchScale(1.0, 100, 150), 1.5);
  assert.equal(computePinchScale(1.0, 100, 50), MIN_SAKAMOTO_SCALE);
  assert.equal(computePinchScale(1.5, 100, 200), MAX_SAKAMOTO_SCALE);
  assert.equal(computePinchScale(1.2, 0, 150), 1.2);
});

test('getScaledDimensions preserves aspect ratio', () => {
  const dims = getScaledDimensions(100, 1.5, 1027 / 736);
  assert.equal(dims.width, 150);
  assert.equal(dims.height, Math.round(150 * (1027 / 736)));
});

test('compute3DTilt produces intuitive 3D pitch and yaw angles', () => {
  const center = compute3DTilt(50, 50, 100, 100, 20);
  assert.deepEqual(center, { rotateX: 0, rotateY: 0 });

  const topRight = compute3DTilt(100, 0, 100, 100, 20);
  assert.deepEqual(topRight, { rotateX: 20, rotateY: 20 });

  const bottomLeft = compute3DTilt(0, 100, 100, 100, 20);
  assert.deepEqual(bottomLeft, { rotateX: -20, rotateY: -20 });
});

test('clampSakamotoPosition keeps mascot within safe desktop and mobile viewports', () => {
  const mobile = clampSakamotoPosition(
    { x: -50, y: 9999 },
    { viewportWidth: 390, viewportHeight: 844, itemWidth: 96, itemHeight: 134 }
  );
  assert.equal(mobile.x, 8);
  assert.equal(mobile.y, 844 - 134 - 68);

  const desktopDefault = getDefaultSakamotoPosition({
    viewportWidth: 1440,
    viewportHeight: 900,
    itemWidth: 124,
    itemHeight: 173,
  });
  assert.equal(desktopDefault.x, 1440 - 124 - 22);
  assert.equal(desktopDefault.y, 900 - 173 - 22);
});

test('isDragMovement respects pixel threshold', () => {
  assert.equal(isDragMovement(2, 2), false);
  assert.equal(isDragMovement(6, 0), true);
  assert.equal(isDragMovement(5, 5), true);
});
