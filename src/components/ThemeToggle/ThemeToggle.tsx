import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTheme, type Theme } from '@/hooks/useTheme';

const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];

const THEME_LABELS: Record<Theme, string> = {
  light: '라이트 모드',
  dark: '다크 모드',
  system: '시스템 설정',
};

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'dark') return <Moon className="h-4 w-4" />;
  if (theme === 'system') return <Monitor className="h-4 w-4" />;
  return <Sun className="h-4 w-4" />;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

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
            aria-label={THEME_LABELS[theme]}
          >
            <ThemeIcon theme={theme} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{THEME_LABELS[theme]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
