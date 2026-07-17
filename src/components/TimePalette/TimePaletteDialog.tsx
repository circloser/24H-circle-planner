import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColorSwatch } from '@/components/SliceEditor/ColorSwatch';
import { IconChips } from '@/components/SliceEditor/IconChips';
import { IconPickerDialog } from '@/components/IconPicker/IconPickerDialog';
import { useTimePalette, MAX_PALETTE_ITEMS } from '@/hooks/useTimePalette';
import { useTranslation } from '@/hooks/usePreferences';
import { idealTextColor } from '@/lib/contrast';
import { track } from '@/lib/track';

interface TimePaletteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_COLOR = '#93c5fd';

/**
 * Design → 타임 팔레트: manage recurring items (label + colour + icon). Each
 * saved item becomes a one-tap chip in the slice editor, so frequent entries
 * keep a consistent colour and take one click to fill in.
 */
export function TimePaletteDialog({ open, onOpenChange }: TimePaletteDialogProps) {
  const { t } = useTranslation();
  const { items, addItem, removeItem } = useTimePalette();
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [icon, setIcon] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const add = () => {
    if (!label.trim()) return;
    if (addItem({ label, color, icon })) {
      track('palette_add');
      setLabel('');
      setIcon('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('palette.title')}</DialogTitle>
          <DialogDescription>{t('palette.desc')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Add form — label + icon suggestions + colour, mirroring the editor. */}
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add();
                  }
                }}
                placeholder={t('palette.itemName')}
                className="h-8 flex-1 text-sm"
                maxLength={24}
              />
              <Button size="sm" onClick={add} disabled={!label.trim() || items.length >= MAX_PALETTE_ITEMS} className="gap-1">
                <Plus className="h-4 w-4" />
                {t('palette.add')}
              </Button>
            </div>
            <IconChips
              query={label}
              selectedIcon={icon}
              onPick={(emoji) => setIcon(emoji)}
              onOpenPicker={() => setPickerOpen(true)}
            />
            <ColorSwatch selectedColor={color} onPick={setColor} />
          </div>

          {/* Saved items — the chips the editor will offer. */}
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('palette.empty')}</p>
          ) : (
            <div className="flex max-h-56 flex-wrap content-start gap-1.5 overflow-y-auto">
              {items.map((it) => (
                <span
                  key={it.id}
                  className="inline-flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1 text-sm"
                  style={{ backgroundColor: it.color, color: idealTextColor(it.color) }}
                >
                  {it.icon && <span aria-hidden>{it.icon}</span>}
                  {it.label}
                  <button
                    type="button"
                    aria-label={`${t('palette.remove')}: ${it.label}`}
                    onClick={() => removeItem(it.id)}
                    className="grid h-5 w-5 place-items-center rounded-full transition-colors hover:bg-black/15"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {items.length >= MAX_PALETTE_ITEMS && (
            <p className="text-xs text-muted-foreground">{t('palette.max')}</p>
          )}
        </div>

        <IconPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          selectedIcon={icon}
          onPick={(emoji) => setIcon(emoji)}
        />
      </DialogContent>
    </Dialog>
  );
}
