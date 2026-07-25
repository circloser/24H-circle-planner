import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { suggestIcons } from '@/lib/fuse-dict';
import { useTranslation } from '@/hooks/usePreferences';

export interface IconChipsProps {
  query: string;
  selectedIcon: string;
  onPick: (emoji: string, lucideId?: string) => void;
  onOpenPicker: () => void;
}

/** "No icon" option — lets the user clear the icon and keep the slice text-only. */
function NoneChip({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t('editor.iconNoneAria')}
      aria-label={t('editor.iconNoneAria')}
      aria-pressed={selected}
      className={cn(
        'h-9 px-2 rounded-lg text-xs flex items-center justify-center transition-all shrink-0',
        'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'ring-2 ring-ring bg-muted text-foreground' : 'text-muted-foreground',
      )}
    >
      {t('editor.iconNone')}
    </button>
  );
}

export function IconChips({ query, selectedIcon, onPick, onOpenPicker }: IconChipsProps) {
  const { t } = useTranslation();
  const suggestions = useMemo(() => suggestIcons(query, 3), [query]);
  const noneSelected = selectedIcon === '';

  if (query.length < 2) {
    return (
      <div className="flex items-center gap-2">
        <NoneChip selected={noneSelected} onClick={() => onPick('')} />
        <span className="text-xs text-muted-foreground flex-1">
          {t('editor.iconHint')}
        </span>
        <button
          type="button"
          onClick={onOpenPicker}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          {t('editor.more')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <NoneChip selected={noneSelected} onClick={() => onPick('')} />
      {suggestions.map((entry) => {
        const isSelected = selectedIcon === entry.emoji;
        return (
          <button
            key={entry.id}
            type="button"
            title={entry.keyword}
            aria-label={`${t('editor.iconLabel')} ${entry.emoji} (${entry.keyword})`}
            aria-pressed={isSelected}
            onClick={() => onPick(entry.emoji, entry.lucideId)}
            className={cn(
              'w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all',
              'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected && 'ring-2 ring-ring bg-muted',
            )}
          >
            {entry.emoji}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onOpenPicker}
        className={cn(
          'h-9 px-2 rounded-lg text-xs text-muted-foreground',
          'hover:bg-muted hover:text-foreground transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {t('editor.more')}
      </button>
    </div>
  );
}
