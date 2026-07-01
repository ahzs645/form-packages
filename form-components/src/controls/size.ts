import type React from 'react';

type MoisThemeLike = {
  mois: {
    sizes: Record<string, React.CSSProperties>;
  };
};

const FRACTIONAL_SIZE_FALLBACKS: Record<string, string> = {
  '1/1': 'max',
  full: 'max',
  '1/2': 'small',
  '1/3': 'small',
  '2/3': 'medium',
  '1/4': 'tiny',
  '3/4': 'large',
};

export function resolveMoisSizeStyles(
  theme: MoisThemeLike,
  size: string | React.CSSProperties | undefined,
  fallback: string
): React.CSSProperties {
  if (typeof size === 'object') return size;
  const key = size ?? fallback;
  const normalizedKey = FRACTIONAL_SIZE_FALLBACKS[key] ?? key;
  return theme.mois.sizes[normalizedKey] ?? theme.mois.sizes[fallback] ?? theme.mois.sizes.medium;
}
