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
 * Sakamoto Days Dark Mode icon badges: refined, harmonious dark-pastel accents
 * on Matte Black / Dark Charcoal surfaces without harsh neon glare.
 */
const TONE_STYLES: Record<GlossyTone, string> = {
  teal: 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/25',
  emerald: 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/25',
  amber: 'bg-[#FACC15]/12 text-[#FACC15] border border-[#FACC15]/30',
  sky: 'bg-sky-400/10 text-sky-300 border border-sky-400/25',
  cyan: 'bg-sky-400/10 text-sky-300 border border-sky-400/25',
  indigo: 'bg-sky-400/10 text-sky-300 border border-sky-400/25',
  violet: 'bg-[#FACC15]/12 text-[#FACC15] border border-[#FACC15]/30',
  rose: 'bg-[#EF4444]/12 text-rose-300 border border-[#EF4444]/30',
};

const SIZE_STYLES = {
  xs: 'w-8 h-8 rounded-lg',
  sm: 'w-9 h-9 rounded-lg',
  md: 'w-10 h-10 rounded-xl',
  lg: 'w-12 h-12 rounded-xl',
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
      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-bold tracking-tight shrink-0 select-none bg-[#252A34] text-[#FACC15] border border-white/[0.12]"
    >
      {initials}
    </span>
  );
};
