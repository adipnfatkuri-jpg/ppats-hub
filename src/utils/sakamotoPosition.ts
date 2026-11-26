export interface SakamotoPoint {
  x: number;
  y: number;
}

export interface SakamotoVelocity {
  vx: number;
  vy: number;
}

export interface SakamotoBoundsInput {
  viewportWidth: number;
  viewportHeight: number;
  itemWidth: number;
  itemHeight: number;
}

export interface SakamotoTilt3D {
  rotateX: number;
  rotateY: number;
}

export interface SakamotoTapSample {
  time: number;
  x: number;
  y: number;
}

export const DESKTOP_BREAKPOINT_PX = 1024;
export const DRAG_THRESHOLD_PX = 6;
export const MIN_SAKAMOTO_SCALE = 0.55;
export const MAX_SAKAMOTO_SCALE = 2.1;
export const DEFAULT_SAKAMOTO_SCALE = 1.0;
export const SCALE_STEP = 0.2;
export const MAX_RUBBER_BAND_PX = 28;
export const MAX_SPRING_MOMENTUM_PX = 84;
export const DOUBLE_TAP_DELAY_MS = 320;
export const DOUBLE_TAP_MAX_DIST_PX = 36;

export function getSakamotoSafeInsets(viewportWidth: number): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (viewportWidth >= DESKTOP_BREAKPOINT_PX) {
    return { top: 60, right: 12, bottom: 12, left: 12 };
  }
  // Keep clear of 52px mobile header and 58px mobile bottom nav bar
  return { top: 58, right: 8, bottom: 68, left: 8 };
}

export function clampSakamotoScale(
  scale: number,
  minScale: number = MIN_SAKAMOTO_SCALE,
  maxScale: number = MAX_SAKAMOTO_SCALE
): number {
  if (!Number.isFinite(scale)) return DEFAULT_SAKAMOTO_SCALE;
  const clamped = Math.min(Math.max(scale, minScale), maxScale);
  return Math.round(clamped * 100) / 100;
}

export function stepSakamotoScale(
  currentScale: number,
  delta: number
): number {
  return clampSakamotoScale(currentScale + delta);
}

export function computePinchScale(
  initialScale: number,
  startDistance: number,
  currentDistance: number
): number {
  if (startDistance <= 0 || !Number.isFinite(currentDistance)) {
    return clampSakamotoScale(initialScale);
  }
  const ratio = currentDistance / startDistance;
  return clampSakamotoScale(initialScale * ratio);
}

export function getScaledDimensions(
  baseWidth: number,
  scale: number,
  aspectRatio: number
): { width: number; height: number } {
  const safeScale = clampSakamotoScale(scale);
  const width = Math.round(baseWidth * safeScale);
  const height = Math.round(width * aspectRatio);
  return { width, height };
}

export function compute3DTilt(
  localX: number,
  localY: number,
  width: number,
  height: number,
  maxDeg: number = 22
): SakamotoTilt3D {
  if (width <= 0 || height <= 0) {
    return { rotateX: 0, rotateY: 0 };
  }
  const normX = Math.min(Math.max((localX / width) * 2 - 1, -1), 1);
  const normY = Math.min(Math.max((localY / height) * 2 - 1, -1), 1);
  return {
    rotateX: Math.round(-normY * maxDeg * 10) / 10 || 0,
    rotateY: Math.round(normX * maxDeg * 10) / 10 || 0,
  };
}

export function clampSakamotoPosition(
  point: SakamotoPoint,
  bounds: SakamotoBoundsInput
): SakamotoPoint {
  const insets = getSakamotoSafeInsets(bounds.viewportWidth);
  const maxX = Math.max(insets.left, bounds.viewportWidth - bounds.itemWidth - insets.right);
  const maxY = Math.max(insets.top, bounds.viewportHeight - bounds.itemHeight - insets.bottom);

  return {
    x: Math.round(Math.min(Math.max(point.x, insets.left), maxX)),
    y: Math.round(Math.min(Math.max(point.y, insets.top), maxY)),
  };
}

function rubberBandAxis(value: number, min: number, max: number, resistance: number): number {
  if (value < min) {
    const over = min - value;
    return min - Math.min(MAX_RUBBER_BAND_PX, over * resistance);
  }
  if (value > max) {
    const over = value - max;
    return max + Math.min(MAX_RUBBER_BAND_PX, over * resistance);
  }
  return value;
}

/**
 * Allows subtle elastic rubber-band pull past viewport edges while dragging,
 * so releasing snaps back smoothly with spring physics.
 */
export function applyRubberBandEdge(
  point: SakamotoPoint,
  bounds: SakamotoBoundsInput,
  resistance: number = 0.28
): SakamotoPoint {
  const insets = getSakamotoSafeInsets(bounds.viewportWidth);
  const maxX = Math.max(insets.left, bounds.viewportWidth - bounds.itemWidth - insets.right);
  const maxY = Math.max(insets.top, bounds.viewportHeight - bounds.itemHeight - insets.bottom);

  return {
    x: Math.round(rubberBandAxis(point.x, insets.left, maxX, resistance)),
    y: Math.round(rubberBandAxis(point.y, insets.top, maxY, resistance)),
  };
}

/**
 * Computes the inertial spring-release landing point from pointer velocity (px/frame)
 * and clamps it back inside safe viewport bounds for tactile spring-back animation.
 */
export function computeSpringReleaseTarget(
  currentPoint: SakamotoPoint,
  velocity: SakamotoVelocity,
  bounds: SakamotoBoundsInput,
  momentumFactor: number = 4.5
): SakamotoPoint {
  const projectedDx = Math.max(
    -MAX_SPRING_MOMENTUM_PX,
    Math.min(MAX_SPRING_MOMENTUM_PX, (Number.isFinite(velocity.vx) ? velocity.vx : 0) * momentumFactor)
  );
  const projectedDy = Math.max(
    -MAX_SPRING_MOMENTUM_PX,
    Math.min(MAX_SPRING_MOMENTUM_PX, (Number.isFinite(velocity.vy) ? velocity.vy : 0) * momentumFactor)
  );

  return clampSakamotoPosition(
    {
      x: currentPoint.x + projectedDx,
      y: currentPoint.y + projectedDy,
    },
    bounds
  );
}

export function getDefaultSakamotoPosition(bounds: SakamotoBoundsInput): SakamotoPoint {
  if (bounds.viewportWidth >= DESKTOP_BREAKPOINT_PX) {
    // Bottom-right stage on desktop so it never overlaps the static sidebar Sakamoto
    return clampSakamotoPosition(
      {
        x: bounds.viewportWidth - bounds.itemWidth - 22,
        y: bounds.viewportHeight - bounds.itemHeight - 22,
      },
      bounds
    );
  }

  // Mobile/tablet: bottom-right neatly above the 58px mobile bottom navigation bar
  return clampSakamotoPosition(
    {
      x: bounds.viewportWidth - bounds.itemWidth - 10,
      y: bounds.viewportHeight - bounds.itemHeight - 72,
    },
    bounds
  );
}

export function isDragMovement(
  dx: number,
  dy: number,
  threshold: number = DRAG_THRESHOLD_PX
): boolean {
  return Math.hypot(dx, dy) >= threshold;
}

/**
 * Determines whether two consecutive taps qualify as a double-tap
 * within the configured time window and spatial tolerance.
 */
export function isDoubleTap(
  prevTap: SakamotoTapSample | null,
  nextTap: SakamotoTapSample,
  maxDelayMs: number = DOUBLE_TAP_DELAY_MS,
  maxDistancePx: number = DOUBLE_TAP_MAX_DIST_PX
): boolean {
  if (!prevTap) return false;
  const elapsed = nextTap.time - prevTap.time;
  if (elapsed < 0 || elapsed > maxDelayMs) return false;
  return Math.hypot(nextTap.x - prevTap.x, nextTap.y - prevTap.y) <= maxDistancePx;
}
