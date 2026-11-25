import React from 'react';

export type GlossyTone =
  | 'teal'
  | 'emerald'
  | 'amber'
  | 'sky'
  | 'indigo'
  | 'cyan'
  | 'violet'
  | 'rose';

/**
 * Flat-Modern Legal-Tech icon badge tones: muted neutral / subtle forest accent,
 * zero gradients, zero glossy highlights, zero heavy drop shadows.
 */
const TONE_STYLES: Record<GlossyTone, string> = {
  teal: 'bg-emerald-50 dark:bg-emerald-950/60 text-[#064E3B] dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60',
  emerald:
    'bg-emerald-50 dark:bg-emerald-950/60 text-[#064E3B] dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60',
  amber:
    'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
  sky: 'bg-slate-100 dark:bg-slate-800 text-[#0F4C5C] dark:text-slate-200 border border-slate-200 dark:border-slate-700',
  cyan: 'bg-slate-100 dark:bg-slate-800 text-[#0F4C5C] dark:text-slate-200 border border-slate-200 dark:border-slate-700',
  indigo:
    'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
  violet:
    'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
  rose: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/60',
};

const SIZE_STYLES = {
  xs: 'w-8 h-8 rounded-lg',
  sm: 'w-9 h-9 rounded-lg',
  md: 'w-10 h-10 rounded-lg',
  lg: 'w-14 h-14 rounded-xl',
};

interface GlossyIcon3DProps {
  tone: GlossyTone;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}

export const GlossyIcon3D: React.FC<GlossyIcon3DProps> = ({
  tone,
  size = 'md',
  className = '',
  children,
}) => {
  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 select-none ${SIZE_STYLES[size]} ${TONE_STYLES[tone]} ${className}`}
    >
      <span className="flex items-center justify-center">{children}</span>
    </div>
  );
};

function extractInitials(rawName: string): string {
  const cleaned = (rawName || '')
    .replace(/^(tn\.|ny\.|sdr\.|h\.|hj\.|dr\.|ir\.)\s+/i, '')
    .trim();
  if (!cleaned || cleaned === '-') return 'PP';
  const words = cleaned.split(/[\s,]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
}

interface PartyAvatar3DProps {
  name: string;
}

export const PartyAvatar3D: React.FC<PartyAvatar3DProps> = ({ name }) => {
  const initials = extractInitials(name);
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-semibold tracking-tight shrink-0 select-none bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
    >
      {initials}
    </span>
  );
};
