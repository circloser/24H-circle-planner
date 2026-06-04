import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { suggestIcons } from '@/lib/fuse-dict';

export interface IconChipsProps {
  query: string;
  selectedIcon: string;
  onPick: (emoji: string, lucideId?: string) => void;
  onOpenPicker: () => void;
}

export function IconChips({ query, selectedIcon, onPick, onOpenPicker }: IconChipsProps) {
  const suggestions = useMemo(() => suggestIcons(query, 3), [query]);

  if (query.length < 2) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground flex-1">
          라벨을 입력하면 추천 아이콘이 표시됩니다
        </span>
        <button
          type="button"
          onClick={onOpenPicker}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          더보기
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {suggestions.map((entry) => {
        const isSelected = selectedIcon === entry.emoji;
        return (
          <button
            key={entry.id}
            type="button"
            title={entry.keyword}
            aria-label={`아이콘 ${entry.emoji} (${entry.keyword})`}
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
        더보기
      </button>
    </div>
  );
}
