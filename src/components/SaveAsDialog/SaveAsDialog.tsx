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
function computeDefaultName(scheduleName: string): string {
  const existing = loadSlots();
  const baseName = scheduleName || '내 시간표';
  const takenNames = new Set(Object.values(existing).map((s) => s.name));
  return takenNames.has(baseName) ? `${baseName} (사본)` : baseName;
}

// ─── SaveAsDialogBody ─────────────────────────────────────────────────────────
// Mounted only when `open=true` so it reads localStorage at mount time.

interface SaveAsDialogBodyProps {
  currentSchedule: Schedule;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function SaveAsDialogBody({ currentSchedule, onOpenChange, onSaved }: SaveAsDialogBodyProps) {
  // Initialize name at mount time — no useEffect needed
  const [name, setName] = useState(() => computeDefaultName(currentSchedule.name));

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
      toast.error('최대 10개 슬롯입니다. 기존 슬롯을 먼저 삭제하세요.');
      return;
    }

    toast.success(`"${trimmed}"이(가) 저장되었습니다`);
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
        <DialogTitle>다른 이름으로 저장</DialogTitle>
      </DialogHeader>
      <div className="py-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="시간표 이름"
          aria-label="슬롯 이름"
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          취소
        </Button>
        <Button onClick={handleSave} disabled={!isValid}>
          저장
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
