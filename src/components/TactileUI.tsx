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
 * Grand Line Cartography icon badges: restrained warm parchment, marine slate,
 * calm emerald, and gold bounty accent — flat, crisp, and professional.
 */
const TONE_STYLES: Record<GlossyTone, string> = {
  teal: 'bg-[#F0E1C2] dark:bg-[#15314B] text-[#4A2E14] dark:text-[#F4C430] border border-[#C89B3C]/70 dark:border-[#C89B3C]/50',
  emerald:
    'bg-[#E4F0E9] dark:bg-emerald-950/60 text-[#1E4D45] dark:text-emerald-300 border border-[#1E4D45]/30 dark:border-emerald-700/60',
  amber:
    'bg-[#FEF0C7] dark:bg-amber-950/60 text-[#92400E] dark:text-[#F4C430] border border-[#C89B3C] dark:border-amber-600/60',
  sky: 'bg-[#E5EEF8] dark:bg-[#15314B] text-[#1E3A8A] dark:text-sky-200 border border-[#93B4DC] dark:border-[#254A6D]',
  cyan: 'bg-[#E5EEF8] dark:bg-[#15314B] text-[#1E3A8A] dark:text-sky-200 border border-[#93B4DC] dark:border-[#254A6D]',
  indigo:
    'bg-[#E4ECFA] dark:bg-[#15314B] text-[#1E3A8A] dark:text-sky-200 border border-[#94B0DF] dark:border-[#254A6D]',
  violet:
    'bg-[#F0E1C2] dark:bg-[#15314B] text-[#4A2E14] dark:text-slate-200 border border-[#C89B3C]/70 dark:border-[#254A6D]',
  rose: 'bg-rose-50 dark:bg-rose-950/60 text-[#991B1B] dark:text-rose-300 border border-rose-300/80 dark:border-rose-800/60',
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
      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-bold tracking-tight shrink-0 select-none bg-[#DBEAFE] dark:bg-[#17334E] text-[#0B1F3A] dark:text-[#F4C430] border border-[#93C5FD] dark:border-[#C89B3C]/50"
    >
      {initials}
    </span>
  );
};
