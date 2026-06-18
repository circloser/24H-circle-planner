import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/usePreferences';
import type { TKey } from '@/i18n/translations';

// Light/dark only — toggles between the two (no OS-following 'system').
const THEME_CYCLE: Theme[] = ['light', 'dark'];

const THEME_LABEL_KEY: Record<Theme, TKey> = {
  light: 'theme.lightMode',
  dark: 'theme.darkMode',
};

function ThemeIcon({ theme }: { theme: Theme }) {
  return theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const label = t(THEME_LABEL_KEY[theme]);

  function handleClick() {
    const currentIdx = THEME_CYCLE.indexOf(theme);
    const nextIdx = (currentIdx + 1) % THEME_CYCLE.length;
    setTheme(THEME_CYCLE[nextIdx]);
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            aria-label={label}
          >
            <ThemeIcon theme={theme} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
