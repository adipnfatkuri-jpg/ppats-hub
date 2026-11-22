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

const TONE_STYLES: Record<GlossyTone, string> = {
  teal: 'bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-600 text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.75),0_10px_20px_-6px_rgba(20,184,166,0.55)]',
  emerald:
    'bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.75),0_10px_20px_-6px_rgba(16,185,129,0.55)]',
  amber:
    'bg-gradient-to-br from-amber-300 via-amber-500 to-orange-500 text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.75),0_10px_20px_-6px_rgba(245,158,11,0.55)]',
  sky: 'bg-gradient-to-br from-sky-400 via-sky-500 to-cyan-600 text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.75),0_10px_20px_-6px_rgba(14,165,233,0.55)]',
  cyan: 'bg-gradient-to-br from-cyan-300 via-sky-500 to-teal-500 text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.75),0_10px_20px_-6px_rgba(6,182,212,0.55)]',
  indigo:
    'bg-gradient-to-br from-indigo-400 via-indigo-500 to-violet-600 text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.75),0_10px_20px_-6px_rgba(99,102,241,0.55)]',
  violet:
    'bg-gradient-to-br from-violet-400 via-purple-500 to-indigo-600 text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.75),0_10px_20px_-6px_rgba(139,92,246,0.55)]',
  rose: 'bg-gradient-to-br from-rose-400 via-rose-500 to-pink-600 text-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.75),0_10px_20px_-6px_rgba(244,63,94,0.5)]',
};

const SIZE_STYLES = {
  xs: 'w-8 h-8 rounded-xl',
  sm: 'w-10 h-10 rounded-2xl',
  md: 'w-12 h-12 rounded-2xl',
  lg: 'w-16 h-16 rounded-2xl',
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
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${SIZE_STYLES[size]} ${TONE_STYLES[tone]} ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-1.5 top-1 h-1/3 rounded-full bg-white/30 blur-[1px]"
      />
      <span className="relative z-10 flex items-center justify-center">{children}</span>
    </div>
  );
};

const AVATAR_TONES: GlossyTone[] = ['teal', 'sky', 'emerald', 'amber', 'indigo', 'cyan'];

function extractInitials(rawName: string): string {
  const cleaned = (rawName || '')
    .replace(/^(tn\.|ny\.|sdr\.|h\.|hj\.|dr\.|ir\.)\s+/i, '')
    .trim();
  if (!cleaned || cleaned === '-') return 'PP';
  const words = cleaned.split(/[\s,]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
}

function hashTone(rawName: string): GlossyTone {
  let hash = 0;
  for (let i = 0; i < rawName.length; i += 1) {
    hash = (hash * 31 + rawName.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

interface PartyAvatar3DProps {
  name: string;
}

export const PartyAvatar3D: React.FC<PartyAvatar3DProps> = ({ name }) => {
  const initials = extractInitials(name);
  const tone = hashTone(name || 'PPATS');
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-bold tracking-tight shrink-0 select-none ${TONE_STYLES[tone]}`}
    >
      {initials}
    </span>
  );
};
