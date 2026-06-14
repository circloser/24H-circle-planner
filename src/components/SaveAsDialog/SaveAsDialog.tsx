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
import { loadSlots, saveSlot } from '@/lib/slots';
import { useTranslation } from '@/hooks/usePreferences';
import type { Schedule } from '@/types/schedule';
import type { Slot } from '@/types/slot';

interface SaveAsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSchedule: Schedule;
  onSaved: () => void;
}

/**
 * Deep-clone a Schedule with new UUIDs for the schedule id and all slice ids.
 */
function cloneScheduleWithNewIds(schedule: Schedule): Schedule {
  return {
    ...schedule,
    id: uuid(),
    updatedAt: new Date().toISOString(),
    slices: schedule.slices.map((s) => ({ ...s, id: uuid() })),
  };
}

/**
 * Compute the default slot name: use the schedule name, appending " (사본)"
 * if that name is already taken in localStorage.
 */
function computeDefaultName(scheduleName: string, copySuffix: string): string {
  const existing = loadSlots();
  const baseName = scheduleName || '내 시간표';
  const takenNames = new Set(Object.values(existing).map((s) => s.name));
  return takenNames.has(baseName) ? `${baseName} ${copySuffix}` : baseName;
}

// ─── SaveAsDialogBody ─────────────────────────────────────────────────────────
// Mounted only when `open=true` so it reads localStorage at mount time.

interface SaveAsDialogBodyProps {
  currentSchedule: Schedule;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function SaveAsDialogBody({ currentSchedule, onOpenChange, onSaved }: SaveAsDialogBodyProps) {
  const { t } = useTranslation();
  // Initialize name at mount time — no useEffect needed
  const [name, setName] = useState(() =>
    computeDefaultName(currentSchedule.name, t('saveAs.copySuffix')),
  );

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;

    const slot: Slot = {
      id: uuid(),
      name: trimmed,
      schedule: cloneScheduleWithNewIds(currentSchedule),
      createdAt: new Date().toISOString(),
    };

    const result = saveSlot(slot);
    if (!result.success && result.reason === 'capacity') {
      toast.error(t('saveAs.capacity'));
      return;
    }

    toast.success(t('saveAs.saved', { name: trimmed }));
    onSaved();
    onOpenChange(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  }

  const isValid = name.trim().length > 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('saveAs.title')}</DialogTitle>
      </DialogHeader>
      <div className="py-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('saveAs.placeholder')}
          aria-label={t('saveAs.nameLabel')}
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={!isValid}>
          {t('common.save')}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── SaveAsDialog ─────────────────────────────────────────────────────────────

export function SaveAsDialog({
  open,
  onOpenChange,
  currentSchedule,
  onSaved,
}: SaveAsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mount body only when open so state initializes fresh each time */}
        {open && (
          <SaveAsDialogBody
            currentSchedule={currentSchedule}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
