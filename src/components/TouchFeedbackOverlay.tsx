import React, { useEffect, useRef, useState } from 'react';
import { triggerHapticFeedback, type HapticIntent } from '../utils/haptics';

interface TouchPulse {
  id: number;
  x: number;
  y: number;
  variant: 'yellow' | 'crimson';
}

const INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], [role="tab"], [role="menuitem"], select, summary, [data-testid="draggable-sakamoto"]';

function isCrimsonInteractive(el: HTMLElement): boolean {
  return (
    el.classList.contains('btn-grandline-crimson') ||
    el.classList.contains('btn-3d-danger') ||
    Boolean(el.querySelector('.bg-\\[\\#EF4444\\]'))
  );
}

function resolveHapticIntent(el: HTMLElement): HapticIntent {
  const explicit = el.getAttribute('data-haptic');
  if (explicit === 'primary' || explicit === 'navigation' || explicit === 'light') {
    return explicit;
  }
  if (isCrimsonInteractive(el)) {
    return 'primary';
  }
  if (el.closest('nav') || el.closest('aside') || el.getAttribute('role') === 'tab') {
    return 'navigation';
  }
  return 'light';
}

/**
 * Global tactile touch indicator & mobile haptic feedback overlay.
 * Renders a crisp, non-blocking Warm Manga Yellow (or Crimson on primary CTA)
 * expanding ripple ring + core dot at the exact touch/click coordinates whenever
 * any button or interactive control is pressed, and triggers subtle Vibration API
 * haptic feedback on supported mobile touch devices.
 */
export const TouchFeedbackOverlay: React.FC = () => {
  const [pulses, setPulses] = useState<TouchPulse[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef<Set<number>>(new Set());
  const lastPointerTypeRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      lastPointerTypeRef.current = e.pointerType;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
      if (!interactive) return;
      if (interactive.matches(':disabled') || interactive.getAttribute('aria-disabled') === 'true') {
        return;
      }

      const isCrimson = isCrimsonInteractive(interactive);

      const id = nextIdRef.current++;
      const pulse: TouchPulse = {
        id,
        x: Math.round(e.clientX),
        y: Math.round(e.clientY),
        variant: isCrimson ? 'crimson' : 'yellow',
      };

      setPulses((prev) => [...prev.slice(-5), pulse]);

      const timer = window.setTimeout(() => {
        timersRef.current.delete(timer);
        setPulses((prev) => prev.filter((item) => item.id !== id));
      }, 460);
      timersRef.current.add(timer);
    };

    // Fire Vibration API inside click (guaranteed active user gesture & never fires while scrolling)
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
      if (!interactive) return;
      if (interactive.matches(':disabled') || interactive.getAttribute('aria-disabled') === 'true') {
        return;
      }

      const pointerType =
        typeof (e as PointerEvent).pointerType === 'string' && (e as PointerEvent).pointerType
          ? (e as PointerEvent).pointerType
          : lastPointerTypeRef.current;

      triggerHapticFeedback(resolveHapticIntent(interactive), { pointerType });
    };

    document.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
    document.addEventListener('click', handleClick, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      document.removeEventListener('click', handleClick, { capture: true });
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  if (pulses.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="touch-feedback-overlay"
      className="no-print pointer-events-none fixed inset-0 z-[120] overflow-hidden"
    >
      {pulses.map((pulse) => (
        <span
          key={pulse.id}
          data-testid="touch-pulse"
          style={{ left: `${pulse.x}px`, top: `${pulse.y}px` }}
          className={`touch-pulse-ring ${
            pulse.variant === 'crimson' ? 'touch-pulse-crimson' : 'touch-pulse-yellow'
          }`}
        >
          <span className="touch-pulse-core" />
        </span>
      ))}
    </div>
  );
};
