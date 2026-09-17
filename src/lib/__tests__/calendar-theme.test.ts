import { describe, expect, it } from 'vitest';
import { COLOR_THEMES } from '@/data/color-themes';
import { EVENT_COLORS } from '../calendar-events';
import { chipInk, shownColor, slotsFor, themeAccent, themeSlots } from '../calendar-theme';

describe('a colour theme on the calendar', () => {
  it('leaves colours alone when no theme is chosen, or an unknown one', () => {
    expect(shownColor('#3b82f6', null)).toBe('#3b82f6');
    expect(shownColor('#3b82f6', 'no-such-theme')).toBe('#3b82f6');
    expect(slotsFor(undefined)).toBeNull();
  });

  it('shows every canonical plan colour in the theme', () => {
    const pastel = COLOR_THEMES.find((t) => t.id === 'pastel')!;
    for (const canon of EVENT_COLORS) {
      expect(pastel.colors).toContain(shownColor(canon, 'pastel'));
    }
  });

  it('keeps the colour families recognisable', () => {
    const [blue, red, amber, green, , slate] = themeSlots(COLOR_THEMES.find((t) => t.id === 'pastel')!.colors);
    expect(blue).toBe('#93c5fd');
    expect(red).toBe('#fca5a5');
    // Amber (hue 38°) lands on the nearest warm colour: pastel orange (31°)
    // is a hair closer than pastel yellow (46°).
    expect(amber).toBe('#fdba74');
    expect(green).toBe('#6ee7b7');
    expect(slate).toBe('#d1d5db'); // the grey slot takes the least saturated colour
  });

  it('gives six different colours whenever the theme has six to give', () => {
    for (const theme of COLOR_THEMES) {
      const slots = themeSlots(theme.colors);
      expect(slots).toHaveLength(EVENT_COLORS.length);
      expect(new Set(slots).size).toBe(Math.min(EVENT_COLORS.length, new Set(theme.colors).size));
    }
  });

  it('never touches a colour the user picked outside the canonical six', () => {
    expect(shownColor('#123456', 'ocean')).toBe('#123456');
  });

  it('switching themes recolours the same stored colour', () => {
    expect(shownColor('#ef4444', 'pastel')).not.toBe(shownColor('#ef4444', 'ocean'));
  });

  it('puts dark ink on light theme colours and keeps white on the default ones', () => {
    expect(chipInk('#fcd34d')).toBe('#1f2937');
    expect(chipInk('#3b82f6')).toBe('#ffffff');
  });

  it('takes the most vivid colour as the accent (not the palest "saturated" one)', () => {
    expect(themeAccent('ocean')).toBe('#38bdf8');
    expect(themeAccent(null)).toBeNull();
  });
});
