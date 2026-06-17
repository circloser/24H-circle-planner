import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ICON_DICTIONARY, CATEGORIES } from '@/data/icon-dictionary';
import { searchIcons, dedupeByEmoji } from '@/lib/fuse-dict';
import { cn } from '@/lib/utils';
import type { IconEntry } from '@/data/icon-dictionary';

export interface IconPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIcon: string;
  onPick: (emoji: string, lucideId?: string) => void;
}

function IconGrid({
  icons,
  selectedIcon,
  onPick,
}: {
  icons: IconEntry[];
  selectedIcon: string;
  onPick: (emoji: string, lucideId?: string) => void;
}) {
  if (icons.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-6">
        결과가 없습니다
      </p>
    );
  }

  return (
    <div className="grid grid-cols-8 gap-1">
      {icons.map((entry) => {
        const isSelected = selectedIcon === entry.emoji;
        return (
          <button
            key={entry.id}
            type="button"
            title={entry.keyword}
            aria-label={`${entry.emoji} ${entry.keyword}`}
            aria-pressed={isSelected}
            onClick={() => onPick(entry.emoji, entry.lucideId)}
            className={cn(
              'w-9 h-9 text-xl rounded-md flex items-center justify-center transition-all',
              'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected && 'ring-2 ring-ring bg-muted',
            )}
          >
            {entry.emoji}
          </button>
        );
      })}
    </div>
  );
}

export function IconPickerDialog({
  open,
  onOpenChange,
  selectedIcon,
  onPick,
}: IconPickerDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>(CATEGORIES[0].id);

  const searchResults = useMemo(() => {
    if (searchQuery.trim().length < 1) return null;
    return dedupeByEmoji(searchIcons(searchQuery.trim(), 50));
  }, [searchQuery]);

  const categoryIcons = useMemo(
    () => dedupeByEmoji(ICON_DICTIONARY.filter((e) => e.category === activeTab)),
    [activeTab],
  );

  function handlePick(emoji: string, lucideId?: string) {
    onPick(emoji, lucideId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[85vh] flex flex-col gap-3 overflow-hidden"
        style={{ zIndex: 100000 }}
      >
        <DialogHeader>
          <DialogTitle>아이콘 선택</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="아이콘 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />

        {searchResults !== null ? (
          // Search override
          <div className="overflow-y-auto flex-1 pr-1">
            <p className="text-xs text-muted-foreground mb-2">
              검색 결과: {searchResults.length}개
            </p>
            <IconGrid icons={searchResults} selectedIcon={selectedIcon} onPick={handlePick} />
          </div>
        ) : (
          // Category tabs
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="flex flex-wrap h-auto gap-1 justify-start bg-transparent p-0">
              {CATEGORIES.map((cat) => (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="text-xs px-2 py-1 h-auto data-[state=active]:bg-muted"
                >
                  {cat.emoji} {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {CATEGORIES.map((cat) => (
              <TabsContent
                key={cat.id}
                value={cat.id}
                className="overflow-y-auto flex-1 mt-2"
              >
                <IconGrid
                  icons={categoryIcons}
                  selectedIcon={selectedIcon}
                  onPick={handlePick}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
