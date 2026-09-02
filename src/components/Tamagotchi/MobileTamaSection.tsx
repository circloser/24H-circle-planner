import { useEffect } from 'react';
import { TamagotchiDevice } from './TamagotchiDevice';
import { MOBILE_LCD, TAMA_CSS } from './tama-utils';
import { useTamagotchi } from '@/hooks/useTamagotchi';
import { useTranslation } from '@/hooks/usePreferences';

/**
 * Mobile tamagotchi — a plain section under the timetable (like the clock and
 * news sections) instead of the desktop's floating FAB + roaming pets. The
 * console is always visible here and the pets live inside its little LCD
 * terrarium, so nothing is ever drawn over the page or lost off-screen.
 */
export function MobileTamaSection() {
  const { setWorld } = useTamagotchi();
  const { t } = useTranslation();

  // Confine roaming to the LCD box while this section owns the pets.
  useEffect(() => {
    setWorld(MOBILE_LCD);
    return () => setWorld(null);
  }, [setWorld]);

  return (
    <section className="w-full">
      <style>{TAMA_CSS}</style>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('tama.title')}
      </h2>
      {/* The console carries its own play/clean hint — nothing to repeat here. */}
      <TamagotchiDevice isMobile variant="section" />
    </section>
  );
}
