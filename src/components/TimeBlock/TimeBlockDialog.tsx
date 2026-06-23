import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColorSwatch } from '@/components/SliceEditor/ColorSwatch';
import { useStoreDispatch } from '@/hooks/useScheduleStore';
import { useTranslation } from '@/hooks/usePreferences';

const DEFAULT_COLOR = '#93c5fd';

interface TimeBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new slice id after creation (e.g. to open the slice editor). */
  onCreated?: (id: string) => void;
}

const timeInputCls = 'rounded-md border px-2 py-2 text-base';
const timeInputStyle: React.CSSProperties = {
  backgroundColor: 'hsl(var(--background))',
  borderColor: 'hsl(var(--border))',
  color: 'hsl(var(--foreground))',
};

/**
 * Mobile "add a time block" form — type a start time, end time and name, and a
 * wedge is drawn (SET_BLOCK carves it into the ring). The touch-friendly answer
 * to "I don't want to drag with my finger". Cross-midnight ranges are allowed.
 */
export function TimeBlockDialog({ open, onOpenChange, onCreated }: TimeBlockDialogProps) {
  const dispatch = useStoreDispatch();
  const { t } = useTranslation();
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);

  function submit() {
    if (start === end) {
      toast.error(t('block.invalid'));
      return;
    }
    const id = uuid();
    dispatch({ type: 'SET_BLOCK', start, end, newId: id, content: { label: label.trim(), color } });
    setLabel('');
    onOpenChange(false);
    onCreated?.(id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('block.addTitle')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-1">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium" style={{ color: 'hsl(var(--text-muted))' }}>{t('block.name')}</span>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('block.namePlaceholder')}
            />
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium" style={{ color: 'hsl(var(--text-muted))' }}>{t('block.start')}</span>
              <input type="time" step={600} value={start} onChange={(e) => setStart(e.target.value)} className={timeInputCls} style={timeInputStyle} />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium" style={{ color: 'hsl(var(--text-muted))' }}>{t('block.end')}</span>
              <input type="time" step={600} value={end} onChange={(e) => setEnd(e.target.value)} className={timeInputCls} style={timeInputStyle} />
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'hsl(var(--text-muted))' }}>{t('block.color')}</span>
            <ColorSwatch selectedColor={color} onPick={setColor} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={submit}
            style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            {t('block.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
