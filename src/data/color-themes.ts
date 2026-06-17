/**
 * Curated colour palettes that recolour the whole schedule in one click.
 * Each palette is ordered so consecutive entries stay visually distinct; the
 * apply step cycles through it (slice[i] → colors[i % colors.length]).
 */
export interface ColorTheme {
  id: string;
  ko: string;
  en: string;
  colors: string[];
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'pastel',
    ko: '파스텔',
    en: 'Pastel',
    colors: [
      '#d1d5db', '#fca5a5', '#fdba74', '#fcd34d', '#bef264', '#6ee7b7',
      '#5eead4', '#7dd3fc', '#93c5fd', '#c4b5fd', '#f9a8d4', '#f0abfc',
    ],
  },
  {
    id: 'calm',
    ko: '차분',
    en: 'Calm',
    colors: [
      '#cbd5e1', '#a5b4fc', '#93c5fd', '#7dd3fc', '#99f6e4', '#a7f3d0',
      '#bbf7d0', '#fde68a', '#fbcfe8', '#e9d5ff',
    ],
  },
  {
    id: 'ocean',
    ko: '바다',
    en: 'Ocean',
    colors: [
      '#bae6fd', '#7dd3fc', '#38bdf8', '#5eead4', '#2dd4bf', '#99f6e4',
      '#a5f3fc', '#67e8f9', '#93c5fd', '#818cf8',
    ],
  },
  {
    id: 'sunset',
    ko: '노을',
    en: 'Sunset',
    colors: [
      '#fecaca', '#fca5a5', '#fda4af', '#fdba74', '#fcd34d', '#fde68a',
      '#f9a8d4', '#f0abfc', '#e9d5ff', '#ddd6fe',
    ],
  },
  {
    id: 'forest',
    ko: '숲',
    en: 'Forest',
    colors: [
      '#d9f99d', '#bef264', '#a3e635', '#86efac', '#6ee7b7', '#5eead4',
      '#99f6e4', '#fde68a', '#fcd34d', '#d6d3d1',
    ],
  },
  {
    id: 'mono',
    ko: '모노',
    en: 'Mono',
    colors: [
      '#e5e7eb', '#9ca3af', '#d1d5db', '#6b7280', '#cbd5e1', '#94a3b8',
      '#e7e5e4', '#a8a29e', '#d6d3d1', '#78716c',
    ],
  },
];
