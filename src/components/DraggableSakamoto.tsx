import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EyeOff, Maximize2, Minus, Music, Plus, RotateCcw, Sparkles } from 'lucide-react';
import {
  applyRubberBandEdge,
  clampSakamotoPosition,
  clampSakamotoScale,
  compute3DTilt,
  computePinchScale,
  computeSpringReleaseTarget,
  DEFAULT_SAKAMOTO_SCALE,
  DESKTOP_BREAKPOINT_PX,
  DOUBLE_TAP_DELAY_MS,
  getDefaultSakamotoPosition,
  getScaledDimensions,
  isDoubleTap,
  isDragMovement,
  MAX_SAKAMOTO_SCALE,
  MIN_SAKAMOTO_SCALE,
  SCALE_STEP,
  stepSakamotoScale,
  type SakamotoPoint,
  type SakamotoTapSample,
} from '../utils/sakamotoPosition';
import { triggerHapticFeedback } from '../utils/haptics';

const SAKAMOTO_CHIBI_SRC = '/assets/aistudio/SAVE_20261126_100944_19f07050.png';
// Matches uploaded PNG aspect ratio (736 x 1027)
const ASPECT_RATIO = 1027 / 736;

const STORAGE_KEY_MOBILE = 'simppats_sakamoto_3d_pos_mobile_v2';
const STORAGE_KEY_DESKTOP = 'simppats_sakamoto_3d_pos_desktop_v2';
const STORAGE_KEY_SCALE_MOBILE = 'simppats_sakamoto_3d_scale_mobile_v2';
const STORAGE_KEY_SCALE_DESKTOP = 'simppats_sakamoto_3d_scale_desktop_v2';
const STORAGE_KEY_HIDDEN = 'simppats_sakamoto_3d_hidden_v2';
const STORAGE_KEY_MODE = 'simppats_sakamoto_3d_mode_v2';

type IdleRoutine = 'sweep' | 'dance';
type SpringKind = 'none' | 'release' | 'home';
type TouchMotionKind = 'none' | 'settle' | 'spin' | 'mop' | 'hop';
const TOUCH_MOTIONS: Exclude<TouchMotionKind, 'none' | 'settle'>[] = ['mop', 'hop', 'spin'];

function getBaseWidth(viewportWidth: number): number {
  return viewportWidth >= DESKTOP_BREAKPOINT_PX ? 116 : 86;
}

function getPosStorageKey(viewportWidth: number): string {
  return viewportWidth >= DESKTOP_BREAKPOINT_PX
    ? STORAGE_KEY_DESKTOP
    : STORAGE_KEY_MOBILE;
}

function getScaleStorageKey(viewportWidth: number): string {
  return viewportWidth >= DESKTOP_BREAKPOINT_PX
    ? STORAGE_KEY_SCALE_DESKTOP
    : STORAGE_KEY_SCALE_MOBILE;
}

function loadSavedScale(viewportWidth: number): number {
  try {
    const raw = window.localStorage.getItem(getScaleStorageKey(viewportWidth));
    if (raw) {
      const num = Number.parseFloat(raw);
      if (Number.isFinite(num)) return clampSakamotoScale(num);
    }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_SAKAMOTO_SCALE;
}

function loadSavedOrDefaultPosition(
  viewportWidth: number,
  viewportHeight: number,
  scale: number
): SakamotoPoint {
  const { width, height } = getScaledDimensions(
    getBaseWidth(viewportWidth),
    scale,
    ASPECT_RATIO
  );
  const bounds = {
    viewportWidth,
    viewportHeight,
    itemWidth: width,
    itemHeight: height,
  };

  try {
    const raw = window.localStorage.getItem(getPosStorageKey(viewportWidth));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SakamotoPoint>;
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return clampSakamotoPosition({ x: parsed.x, y: parsed.y }, bounds);
      }
    }
  } catch {
    // Ignore storage read errors
  }

  return getDefaultSakamotoPosition(bounds);
}

export const DraggableSakamoto: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const posRef = useRef<SakamotoPoint>({ x: 16, y: 520 });
  const scaleRef = useRef<number>(DEFAULT_SAKAMOTO_SCALE);

  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{
    startDist: number;
    startScale: number;
  } | null>(null);

  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    lastClientX: number;
    lastClientY: number;
    vx: number;
    vy: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  const resizeStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startScale: number;
  } | null>(null);

  const motionIndexRef = useRef(0);
  const motionTimerRef = useRef<number | null>(null);
  const springTimerRef = useRef<number | null>(null);
  const menuTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<SakamotoTapSample | null>(null);
  const singleTapTimerRef = useRef<number | null>(null);

  const [scale, setScale] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_SAKAMOTO_SCALE;
    const loaded = loadSavedScale(window.innerWidth);
    scaleRef.current = loaded;
    return loaded;
  });
  const [baseWidth, setBaseWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 86 : getBaseWidth(window.innerWidth)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [springKind, setSpringKind] = useState<SpringKind>('none');
  const [isResizing, setIsResizing] = useState(false);
  const [isTilting, setIsTilting] = useState(false);
  const [touchMotion, setTouchMotion] = useState<TouchMotionKind>('none');
  const [idleMode, setIdleMode] = useState<IdleRoutine>(() => {
    if (typeof window === 'undefined') return 'sweep';
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_MODE);
      return saved === 'dance' ? 'dance' : 'sweep';
    } catch {
      return 'sweep';
    }
  });
  const [showControls, setShowControls] = useState(false);
  const [toolbarAlign, setToolbarAlign] = useState<'left' | 'center' | 'right'>('right');
  const [isHidden, setIsHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY_HIDDEN) === '1';
    } catch {
      return false;
    }
  });

  const isSpringing = springKind !== 'none';

  const applyPositionToDom = useCallback((next: SakamotoPoint) => {
    posRef.current = next;
    const el = wrapperRef.current;
    if (el) {
      el.style.setProperty('--sakamoto-x', `${next.x}px`);
      el.style.setProperty('--sakamoto-y', `${next.y}px`);
    }
    if (typeof window !== 'undefined') {
      const bw = getBaseWidth(window.innerWidth);
      const centerX = next.x + (bw * scaleRef.current) / 2;
      const vw = window.innerWidth;
      if (centerX > vw - 135) {
        setToolbarAlign('right');
      } else if (centerX < 135) {
        setToolbarAlign('left');
      } else {
        setToolbarAlign('center');
      }
    }
  }, []);

  const springToPosition = useCallback(
    (target: SakamotoPoint, kind: Exclude<SpringKind, 'none'> = 'release') => {
      if (springTimerRef.current) {
        window.clearTimeout(springTimerRef.current);
      }
      setSpringKind(kind);
      window.requestAnimationFrame(() => {
        applyPositionToDom(target);
      });
      springTimerRef.current = window.setTimeout(
        () => {
          setSpringKind('none');
        },
        kind === 'home' ? 700 : 560
      );
    },
    [applyPositionToDom]
  );

  const applyTiltToDom = useCallback(
    (rx: number, ry: number, rz: number = 0, tz: number = 0) => {
      const el = stageRef.current;
      if (el) {
        el.style.setProperty('--sakamoto-rx', `${rx}deg`);
        el.style.setProperty('--sakamoto-ry', `${ry}deg`);
        el.style.setProperty('--sakamoto-rz', `${rz}deg`);
        el.style.setProperty('--sakamoto-tz', `${tz}px`);
      }
    },
    []
  );

  const persistScale = useCallback((nextScale: number) => {
    try {
      window.localStorage.setItem(
        getScaleStorageKey(window.innerWidth),
        String(nextScale)
      );
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const persistPosition = useCallback((nextPos: SakamotoPoint) => {
    try {
      window.localStorage.setItem(
        getPosStorageKey(window.innerWidth),
        JSON.stringify(nextPos)
      );
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const commitScaleAndClamp = useCallback(
    (rawScale: number, shouldPersist: boolean = true, useSpring: boolean = false) => {
      const clampedScale = clampSakamotoScale(rawScale);
      scaleRef.current = clampedScale;
      setScale(clampedScale);

      const bw = getBaseWidth(window.innerWidth);
      const { width, height } = getScaledDimensions(bw, clampedScale, ASPECT_RATIO);
      const clampedPos = clampSakamotoPosition(posRef.current, {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        itemWidth: width,
        itemHeight: height,
      });
      if (useSpring) {
        springToPosition(clampedPos);
      } else {
        applyPositionToDom(clampedPos);
      }

      if (shouldPersist) {
        persistScale(clampedScale);
        persistPosition(clampedPos);
      }
    },
    [applyPositionToDom, persistPosition, persistScale, springToPosition]
  );

  const triggerTouchMotion = useCallback((explicit?: TouchMotionKind) => {
    if (motionTimerRef.current) {
      window.clearTimeout(motionTimerRef.current);
    }
    const nextMotion: TouchMotionKind =
      explicit ?? TOUCH_MOTIONS[motionIndexRef.current % TOUCH_MOTIONS.length];
    if (!explicit) {
      motionIndexRef.current += 1;
    }

    setTouchMotion('none');
    window.requestAnimationFrame(() => {
      setTouchMotion(nextMotion);
      motionTimerRef.current = window.setTimeout(() => {
        setTouchMotion('none');
      }, 740);
    });
  }, []);

  const scheduleHideControls = useCallback(() => {
    if (menuTimerRef.current) {
      window.clearTimeout(menuTimerRef.current);
    }
    menuTimerRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 5200);
  }, []);

  // Initialize and keep clamped across viewport resizes
  useEffect(() => {
    if (isHidden) return;
    const syncLayout = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const nextBase = getBaseWidth(vw);
      setBaseWidth(nextBase);
      const savedScale = loadSavedScale(vw);
      scaleRef.current = savedScale;
      setScale(savedScale);
      const nextPos = loadSavedOrDefaultPosition(vw, vh, savedScale);
      applyPositionToDom(nextPos);
    };

    syncLayout();
    window.addEventListener('resize', syncLayout);
    return () => window.removeEventListener('resize', syncLayout);
  }, [applyPositionToDom, isHidden]);

  useEffect(() => {
    return () => {
      if (motionTimerRef.current) window.clearTimeout(motionTimerRef.current);
      if (springTimerRef.current) window.clearTimeout(springTimerRef.current);
      if (menuTimerRef.current) window.clearTimeout(menuTimerRef.current);
      if (singleTapTimerRef.current) window.clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  // Dismiss control pill when tapping outside
  useEffect(() => {
    if (!showControls) return;
    const handleOutside = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowControls(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [showControls]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement).closest('button')) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Cancel any ongoing spring glide so dragging feels immediately glued to the finger
    if (springTimerRef.current) {
      window.clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
    }
    setSpringKind('none');

    // Start 2-finger pinch-to-zoom when two touch pointers are active
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchStateRef.current = {
        startDist: Math.max(dist, 10),
        startScale: scaleRef.current,
      };
      dragStateRef.current = null;
      setIsDragging(false);
      setIsResizing(true);
      setShowControls(true);
      return;
    }

    // Immediate 3D tilt response right where the user touches
    const rect = e.currentTarget.getBoundingClientRect();
    const tilt = compute3DTilt(
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height,
      24
    );
    setIsTilting(true);
    applyTiltToDom(tilt.rotateX, tilt.rotateY, 0, 14);

    dragStateRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      vx: 0,
      vy: 0,
      originX: posRef.current.x,
      originY: posRef.current.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Handle live hover 3D tilt on desktop when not dragging/resizing
    if (!activePointersRef.current.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && !isDragging && !isResizing) {
        const rect = e.currentTarget.getBoundingClientRect();
        const tilt = compute3DTilt(
          e.clientX - rect.left,
          e.clientY - rect.top,
          rect.width,
          rect.height,
          18
        );
        setIsTilting(true);
        applyTiltToDom(tilt.rotateX, tilt.rotateY, 0, 10);
      }
      return;
    }

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger pinch zoom
    if (activePointersRef.current.size >= 2 && pinchStateRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const nextScale = computePinchScale(
        pinchStateRef.current.startScale,
        pinchStateRef.current.startDist,
        dist
      );
      commitScaleAndClamp(nextScale, false, false);
      return;
    }

    const state = dragStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;

    const dx = e.clientX - state.startClientX;
    const dy = e.clientY - state.startClientY;

    if (!state.moved && isDragMovement(dx, dy)) {
      state.moved = true;
      setIsDragging(true);
      setShowControls(false);
    }

    if (state.moved) {
      const stepVx = e.clientX - state.lastClientX;
      const stepVy = e.clientY - state.lastClientY;
      state.lastClientX = e.clientX;
      state.lastClientY = e.clientY;
      // Exponential moving average for smooth velocity-driven spring release
      state.vx = state.vx * 0.55 + stepVx * 0.45;
      state.vy = state.vy * 0.55 + stepVy * 0.45;

      const bankZ = Math.max(-18, Math.min(18, state.vx * 1.15));
      const bankY = Math.max(-24, Math.min(24, state.vx * 1.7));
      const pitchX = Math.max(-14, Math.min(14, -state.vy * 0.9));
      applyTiltToDom(pitchX, bankY, bankZ, 22);

      const { width, height } = getScaledDimensions(
        getBaseWidth(window.innerWidth),
        scaleRef.current,
        ASPECT_RATIO
      );
      // Elastic rubber-band allowance near edges so release visibly springs back!
      const elasticPos = applyRubberBandEdge(
        { x: state.originX + dx, y: state.originY + dy },
        {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          itemWidth: width,
          itemHeight: height,
        }
      );
      applyPositionToDom(elasticPos);
    }
  };

  const finishPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (pinchStateRef.current && activePointersRef.current.size < 2) {
      pinchStateRef.current = null;
      setIsResizing(false);
      persistScale(scaleRef.current);
      persistPosition(posRef.current);
      applyTiltToDom(0, 0, 0, 0);
      setIsTilting(false);
      scheduleHideControls();
      return;
    }

    const state = dragStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    dragStateRef.current = null;

    setIsTilting(false);
    applyTiltToDom(0, 0, 0, 0);

    if (state.moved) {
      setIsDragging(false);
      lastTapRef.current = null;
      if (singleTapTimerRef.current) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      const { width, height } = getScaledDimensions(
        getBaseWidth(window.innerWidth),
        scaleRef.current,
        ASPECT_RATIO
      );
      // Spring-physics inertial glide + elastic snap-back inside safe viewport bounds
      const springTarget = computeSpringReleaseTarget(
        posRef.current,
        { vx: state.vx, vy: state.vy },
        {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          itemWidth: width,
          itemHeight: height,
        }
      );
      springToPosition(springTarget, 'release');
      triggerTouchMotion('settle');
      persistPosition(springTarget);
    } else {
      // Distinguish double-tap (spring back to home position) from single tap (burst + toolbar)
      const now = Date.now();
      const currentTap: SakamotoTapSample = {
        time: now,
        x: e.clientX,
        y: e.clientY,
      };

      if (isDoubleTap(lastTapRef.current, currentTap)) {
        lastTapRef.current = null;
        if (singleTapTimerRef.current) {
          window.clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        const { width, height } = getScaledDimensions(
          getBaseWidth(window.innerWidth),
          scaleRef.current,
          ASPECT_RATIO
        );
        const homePos = getDefaultSakamotoPosition({
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          itemWidth: width,
          itemHeight: height,
        });
        setShowControls(false);
        springToPosition(homePos, 'home');
        triggerTouchMotion(idleMode === 'dance' ? 'hop' : 'mop');
        triggerHapticFeedback('doubleTap', { pointerType: e.pointerType });
        try {
          window.localStorage.removeItem(getPosStorageKey(window.innerWidth));
        } catch {
          // Ignore storage errors
        }
      } else {
        lastTapRef.current = currentTap;
        triggerTouchMotion(idleMode === 'dance' ? 'hop' : 'mop');
        if (singleTapTimerRef.current) {
          window.clearTimeout(singleTapTimerRef.current);
        }
        singleTapTimerRef.current = window.setTimeout(() => {
          singleTapTimerRef.current = null;
          setShowControls((prev) => {
            const next = !prev;
            if (next) scheduleHideControls();
            return next;
          });
        }, DOUBLE_TAP_DELAY_MS - 40);
      }
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && !isDragging && !isResizing) {
      setIsTilting(false);
      applyTiltToDom(0, 0, 0, 0);
    }
  };

  // Dedicated bottom-right diagonal drag-to-resize handle
  const handleResizePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsResizing(true);
    setShowControls(true);
    resizeStateRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startScale: scaleRef.current,
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rs = resizeStateRef.current;
    if (!rs || rs.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const deltaPx = (e.clientX - rs.startClientX + (e.clientY - rs.startClientY)) / 2;
    const nextScale = rs.startScale + deltaPx / 110;
    commitScaleAndClamp(nextScale, false, false);
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rs = resizeStateRef.current;
    if (!rs || rs.pointerId !== e.pointerId) return;
    e.stopPropagation();
    resizeStateRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsResizing(false);
    persistScale(scaleRef.current);
    persistPosition(posRef.current);
    scheduleHideControls();
  };

  const handleZoomIn = () => {
    commitScaleAndClamp(stepSakamotoScale(scaleRef.current, SCALE_STEP), true, true);
    triggerTouchMotion();
    scheduleHideControls();
  };

  const handleZoomOut = () => {
    commitScaleAndClamp(stepSakamotoScale(scaleRef.current, -SCALE_STEP), true, true);
    triggerTouchMotion();
    scheduleHideControls();
  };

  const handleToggleIdleMode = () => {
    const nextMode: IdleRoutine = idleMode === 'sweep' ? 'dance' : 'sweep';
    setIdleMode(nextMode);
    triggerTouchMotion(nextMode === 'dance' ? 'hop' : 'mop');
    scheduleHideControls();
    try {
      window.localStorage.setItem(STORAGE_KEY_MODE, nextMode);
    } catch {
      // Ignore storage errors
    }
  };

  const handleResetAll = () => {
    scaleRef.current = DEFAULT_SAKAMOTO_SCALE;
    setScale(DEFAULT_SAKAMOTO_SCALE);
    const { width, height } = getScaledDimensions(
      getBaseWidth(window.innerWidth),
      DEFAULT_SAKAMOTO_SCALE,
      ASPECT_RATIO
    );
    const defPos = getDefaultSakamotoPosition({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      itemWidth: width,
      itemHeight: height,
    });
    springToPosition(defPos, 'home');
    triggerTouchMotion('settle');
    setShowControls(false);
    try {
      window.localStorage.removeItem(getPosStorageKey(window.innerWidth));
      window.localStorage.removeItem(getScaleStorageKey(window.innerWidth));
    } catch {
      // Ignore storage errors
    }
  };

  const handleHide = () => {
    setShowControls(false);
    setIsHidden(true);
    try {
      window.localStorage.setItem(STORAGE_KEY_HIDDEN, '1');
    } catch {
      // Ignore storage errors
    }
  };

  const handleRestore = () => {
    setIsHidden(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY_HIDDEN);
    } catch {
      // Ignore storage errors
    }
    window.requestAnimationFrame(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const savedScale = loadSavedScale(vw);
      scaleRef.current = savedScale;
      setScale(savedScale);
      const next = loadSavedOrDefaultPosition(vw, vh, savedScale);
      applyPositionToDom(next);
      triggerTouchMotion('hop');
    });
  };

  if (isHidden) {
    return (
      <button
        type="button"
        onClick={handleRestore}
        aria-label="Tampilkan maskot 3D Sakamoto"
        title="Tampilkan Sakamoto 3D"
        className="no-print fixed right-3 bottom-[68px] lg:right-5 lg:bottom-5 z-30 w-10 h-10 rounded-full bg-[#171A21] border border-[#FACC15]/60 p-0.5 shadow-[0_6px_18px_rgba(0,0,0,0.55)] hover:scale-110 active:scale-95 transition-transform"
      >
        <span className="w-full h-full rounded-full bg-[#0E1014] flex items-center justify-center overflow-hidden">
          <img
            src={SAKAMOTO_CHIBI_SRC}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="w-8 h-8 object-contain"
          />
        </span>
      </button>
    );
  }

  const currentWidth = Math.round(baseWidth * scale);
  const scalePercent = Math.round(scale * 100);
  const idleMotionClass =
    idleMode === 'dance' ? 'sakamoto-3d-dance-idle' : 'sakamoto-3d-sweep-idle';
  const motionClass =
    isDragging || isResizing
      ? ''
      : touchMotion === 'settle'
        ? 'sakamoto-3d-settle'
        : touchMotion === 'spin'
          ? 'sakamoto-3d-spin'
          : touchMotion === 'mop'
            ? 'sakamoto-3d-mop'
            : touchMotion === 'hop'
              ? 'sakamoto-3d-hop'
              : idleMotionClass;

  const springClass =
    springKind === 'home'
      ? 'is-springing-home'
      : springKind === 'release'
        ? 'is-springing'
        : '';

  return (
    <div
      ref={wrapperRef}
      data-testid="draggable-sakamoto"
      data-scale={scale}
      data-motion={touchMotion}
      data-idle-mode={idleMode}
      data-springing={isSpringing ? 'true' : 'false'}
      data-spring-kind={springKind}
      role="region"
      aria-label="Karakter 3D Sakamoto yang sedang menyapu atau menari; ketuk dua kali untuk kembali ke titik awal, geser untuk pindah"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onPointerLeave={handlePointerLeave}
      className={`no-print sakamoto-3d-wrapper fixed top-0 left-0 z-[35] select-none touch-none ${springClass} ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Slim Dark Mode Control Pill (Sapu/Tari, Zoom -, %, Zoom +, Reset, Hide) when tapped */}
      {showControls && !isDragging && (
        <div
          role="toolbar"
          aria-label="Kontrol animasi, ukuran, dan posisi Sakamoto 3D"
          className={`absolute -top-10 flex items-center gap-1 px-1.5 py-1 rounded-full bg-[#171A21]/96 backdrop-blur-md border border-[#FACC15]/45 shadow-[0_8px_22px_rgba(0,0,0,0.65)] whitespace-nowrap z-20 ${
            toolbarAlign === 'right'
              ? 'right-0'
              : toolbarAlign === 'left'
                ? 'left-0'
                : 'left-1/2 -translate-x-1/2'
          }`}
        >
          <button
            type="button"
            onClick={handleToggleIdleMode}
            aria-label={
              idleMode === 'sweep'
                ? 'Ubah animasi Sakamoto ke Menari'
                : 'Ubah animasi Sakamoto ke Menyapu'
            }
            title={idleMode === 'sweep' ? 'Mode Menyapu (Klik untuk Menari)' : 'Mode Menari (Klik untuk Menyapu)'}
            className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[#FACC15] text-[#0E1014] text-[10px] font-bold transition-transform active:scale-95"
          >
            {idleMode === 'sweep' ? (
              <>
                <Sparkles className="w-3 h-3" />
                <span>Sapu</span>
              </>
            ) : (
              <>
                <Music className="w-3 h-3" />
                <span>Tari</span>
              </>
            )}
          </button>

          <div className="w-px h-3.5 bg-white/[0.12] mx-0.5" />

          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= MIN_SAKAMOTO_SCALE}
            aria-label="Perkecil Sakamoto"
            title="Perkecil"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#252A34] hover:bg-[#FACC15] text-[#F8FAFC] hover:text-[#0E1014] border border-white/[0.1] transition-colors disabled:opacity-40"
          >
            <Minus className="w-3 h-3" />
          </button>

          <span className="px-0.5 text-[10px] font-bold text-[#FACC15] tabular-nums select-none">
            {scalePercent}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= MAX_SAKAMOTO_SCALE}
            aria-label="Perbesar Sakamoto"
            title="Perbesar"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#252A34] hover:bg-[#FACC15] text-[#F8FAFC] hover:text-[#0E1014] border border-white/[0.1] transition-colors disabled:opacity-40"
          >
            <Plus className="w-3 h-3" />
          </button>

          <div className="w-px h-3.5 bg-white/[0.12] mx-0.5" />

          <button
            type="button"
            onClick={handleResetAll}
            aria-label="Reset ukuran dan posisi Sakamoto"
            title="Reset Posisi & Ukuran (atau Double-Tap)"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#252A34] hover:bg-[#FACC15] text-[#F8FAFC] hover:text-[#0E1014] border border-white/[0.1] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={handleHide}
            aria-label="Sembunyikan Sakamoto"
            title="Sembunyikan"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#252A34] hover:bg-[#EF4444] text-[#F8FAFC] border border-white/[0.1] transition-colors"
          >
            <EyeOff className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 3D Tilt Stage */}
      <div
        ref={stageRef}
        style={{ width: `${currentWidth}px` }}
        className={`sakamoto-3d-stage relative ${
          isDragging || isTilting || isResizing ? 'is-interacting' : ''
        }`}
      >
        {/* Subtle Animated Accents for Sweeping (Sparkles) & Dancing (Music Notes) */}
        {!isDragging && !isResizing && idleMode === 'sweep' && (
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-0.5 left-1 right-3 h-5 z-10">
            <span className="sakamoto-sweep-sparkle absolute bottom-0 left-1 text-[10px] font-black text-[#FACC15] drop-shadow-[0_0_6px_rgba(250,204,21,0.75)]">
              ✦
            </span>
            <span
              style={{ animationDelay: '0.95s' }}
              className="sakamoto-sweep-sparkle absolute bottom-0.5 left-6 text-[8px] font-black text-white/90 drop-shadow-[0_0_5px_rgba(250,204,21,0.6)]"
            >
              ✦
            </span>
          </div>
        )}
        {!isDragging && !isResizing && idleMode === 'dance' && (
          <div aria-hidden="true" className="pointer-events-none absolute -top-2 -right-1 w-8 h-8 z-10">
            <span className="sakamoto-dance-note absolute top-2 right-1 text-[12px] font-black text-[#FACC15] drop-shadow-[0_0_6px_rgba(250,204,21,0.85)]">
              ♪
            </span>
            <span
              style={{ animationDelay: '0.7s' }}
              className="sakamoto-dance-note absolute top-4 right-4 text-[10px] font-black text-[#EF4444] drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]"
            >
              ♫
            </span>
          </div>
        )}

        {/* Reactive 3D Ground Contact Shadow */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/55 blur-[5px] transition-all duration-200 ${
            isDragging
              ? 'w-[52%] h-2.5 opacity-40'
              : isSpringing || touchMotion !== 'none'
                ? 'w-[60%] h-2.5 opacity-55'
                : 'w-[72%] h-3 opacity-70'
          }`}
        />

        {/* Animated 3D Chibi Sakamoto Character */}
        <div className={`relative ${motionClass}`}>
          <img
            src={SAKAMOTO_CHIBI_SRC}
            alt="Taro Sakamoto 3D — Sedang menyapu atau menari; ketuk 2x untuk kembali ke posisi awal"
            draggable={false}
            referrerPolicy="no-referrer"
            className={`w-full h-auto block pointer-events-none select-none transition-[filter] duration-150 ${
              isDragging
                ? 'drop-shadow-[0_18px_24px_rgba(0,0,0,0.68)]'
                : 'drop-shadow-[0_10px_16px_rgba(0,0,0,0.52)]'
            }`}
          />
        </div>

        {/* Diagonal Corner Resize Handle (visible when tapped or actively resizing) */}
        {(showControls || isResizing) && !isDragging && (
          <button
            type="button"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
            aria-label="Tarik untuk mengubah ukuran Sakamoto"
            title="Tarik untuk perbesar / perkecil"
            className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#FACC15] text-[#0E1014] border border-[#0E1014] shadow-[0_3px_10px_rgba(0,0,0,0.5)] flex items-center justify-center cursor-nwse-resize touch-none z-20 active:scale-110 transition-transform"
          >
            <Maximize2 className="w-3 h-3 stroke-[2.5]" />
          </button>
        )}
      </div>
    </div>
  );
};
