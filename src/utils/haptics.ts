export type HapticIntent = 'light' | 'navigation' | 'primary' | 'doubleTap';

export type HapticPattern = number | number[];

/**
 * Subtle, non-intrusive vibration durations (in milliseconds)
 * designed for tactile feedback on supported mobile devices.
 */
export const HAPTIC_PATTERNS: Record<HapticIntent, HapticPattern> = {
  light: 10,
  navigation: 12,
  primary: 18,
  doubleTap: [12, 32, 16],
};

const MOBILE_UA_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

export interface HapticsEnvironment {
  vibrate?: (pattern: HapticPattern) => boolean;
  userAgent?: string;
  maxTouchPoints?: number;
  coarsePointer?: boolean;
  reducedMotion?: boolean;
}

export function getBrowserHapticsEnvironment(): HapticsEnvironment {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {};
  }

  const vibrateFn =
    typeof navigator.vibrate === 'function'
      ? (pattern: HapticPattern) => navigator.vibrate(pattern)
      : undefined;

  const matchMediaFn = typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null;

  return {
    vibrate: vibrateFn,
    userAgent: navigator.userAgent || '',
    maxTouchPoints: typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0,
    coarsePointer: matchMediaFn ? matchMediaFn('(pointer: coarse)').matches : false,
    reducedMotion: matchMediaFn ? matchMediaFn('(prefers-reduced-motion: reduce)').matches : false,
  };
}

/**
 * Ensures haptic feedback only triggers on mobile/touch devices that support
 * the Vibration API, never on desktop mice or when reduced motion is enabled.
 */
export function isMobileHapticsSupported(
  pointerType?: string,
  env: HapticsEnvironment = getBrowserHapticsEnvironment()
): boolean {
  if (typeof env.vibrate !== 'function') return false;
  if (env.reducedMotion) return false;

  // Never vibrate for desktop mouse or stylus hover/click interactions
  if (pointerType === 'mouse') return false;

  const isMobileUa = MOBILE_UA_REGEX.test(env.userAgent ?? '');
  const hasTouchHardware = (env.maxTouchPoints ?? 0) > 0 || Boolean(env.coarsePointer);

  if (pointerType === 'touch') {
    return hasTouchHardware || isMobileUa || true;
  }

  // Fallback when pointerType is unavailable: require both mobile/coarse indicator and touch support
  return hasTouchHardware && (isMobileUa || Boolean(env.coarsePointer));
}

/**
 * Triggers a subtle haptic vibration via the Vibration API on supported mobile devices.
 * Returns true if a vibration was triggered, false otherwise.
 */
export function triggerHapticFeedback(
  intent: HapticIntent = 'light',
  options?: {
    pointerType?: string;
    env?: HapticsEnvironment;
  }
): boolean {
  const env = options?.env ?? getBrowserHapticsEnvironment();
  if (!isMobileHapticsSupported(options?.pointerType, env)) {
    return false;
  }

  try {
    return Boolean(env.vibrate?.(HAPTIC_PATTERNS[intent]));
  } catch {
    return false;
  }
}
