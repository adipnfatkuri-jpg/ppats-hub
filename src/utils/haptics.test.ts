import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HAPTIC_PATTERNS,
  isMobileHapticsSupported,
  triggerHapticFeedback,
  type HapticPattern,
} from './haptics';

test('isMobileHapticsSupported allows supported mobile touch devices and blocks desktop mouse', () => {
  const vibrate = () => true;

  // Supported Android mobile touch
  assert.equal(
    isMobileHapticsSupported('touch', {
      vibrate,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile',
      maxTouchPoints: 5,
      coarsePointer: true,
      reducedMotion: false,
    }),
    true
  );

  // Desktop Chrome has navigator.vibrate, but pointerType='mouse' must be blocked
  assert.equal(
    isMobileHapticsSupported('mouse', {
      vibrate,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0',
      maxTouchPoints: 0,
      coarsePointer: false,
      reducedMotion: false,
    }),
    false
  );

  // Desktop without pointerType also blocked
  assert.equal(
    isMobileHapticsSupported(undefined, {
      vibrate,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Chrome/126.0',
      maxTouchPoints: 0,
      coarsePointer: false,
      reducedMotion: false,
    }),
    false
  );

  // Reduced motion preference disables haptics
  assert.equal(
    isMobileHapticsSupported('touch', {
      vibrate,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile',
      maxTouchPoints: 5,
      coarsePointer: true,
      reducedMotion: true,
    }),
    false
  );

  // Missing Vibration API (e.g. iOS Safari) safely returns false
  assert.equal(
    isMobileHapticsSupported('touch', {
      vibrate: undefined,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile',
      maxTouchPoints: 5,
      coarsePointer: true,
      reducedMotion: false,
    }),
    false
  );
});

test('triggerHapticFeedback dispatches tailored subtle patterns for primary, navigation, light, and doubleTap', () => {
  const calls: HapticPattern[] = [];
  const mobileEnv = {
    vibrate: (pattern: HapticPattern) => {
      calls.push(pattern);
      return true;
    },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile',
    maxTouchPoints: 5,
    coarsePointer: true,
    reducedMotion: false,
  };

  assert.equal(triggerHapticFeedback('primary', { pointerType: 'touch', env: mobileEnv }), true);
  assert.equal(triggerHapticFeedback('navigation', { pointerType: 'touch', env: mobileEnv }), true);
  assert.equal(triggerHapticFeedback('light', { pointerType: 'touch', env: mobileEnv }), true);
  assert.equal(triggerHapticFeedback('doubleTap', { pointerType: 'touch', env: mobileEnv }), true);

  assert.deepEqual(calls, [
    HAPTIC_PATTERNS.primary,
    HAPTIC_PATTERNS.navigation,
    HAPTIC_PATTERNS.light,
    HAPTIC_PATTERNS.doubleTap,
  ]);
});

test('triggerHapticFeedback safely handles Vibration API exceptions', () => {
  const throwingEnv = {
    vibrate: () => {
      throw new Error('Blocked by browser policy');
    },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile',
    maxTouchPoints: 5,
    coarsePointer: true,
    reducedMotion: false,
  };

  assert.equal(triggerHapticFeedback('primary', { pointerType: 'touch', env: throwingEnv }), false);
});
