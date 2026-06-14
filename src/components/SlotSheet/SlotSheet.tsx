import { useState, useEffect, useRef } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CircleTimeline } from '@/components/CircleTimeline/CircleTimeline';
import { loadSlots, deleteSlot, renameSlot, SLOTS_CAPACITY } from '@/lib/slots';
import { useTranslation } from '@/hooks/usePreferences';
import type { Slot } from '@/types/slot';

interface SlotSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (slot: Slot) => void;
}

// ─── SlotRow ─────────────────────────────────────────────────────────────────

interface SlotRowProps {
  slot: Slot;
  onLoad: (slot: Slot) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

function SlotRow({ slot, onLoad, onDelete, onRename }: SlotRowProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(slot.name);
  const [confirmLoad, setConfirmLoad] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commitRename() {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== slot.name) {
      onRename(slot.id, trimmed);
    } else {
      setDraftName(slot.name);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      setDraftName(slot.name);
      setEditing(false);
    }
  }

  const formattedDate = new Date(slot.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <>
      <div className="flex items-center gap-3 py-3 border-b last:border-b-0">
        {/* Mini timeline thumbnail */}
        <div className="flex-shrink-0">
          <CircleTimeline
            slices={slot.schedule.slices}
            interactionMode="view"
            size={64}
          />
        </div>

        {/* Name + date */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                ref={inputRef}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleKeyDown}
                className="h-7 text-sm"
                aria-label={t('slot.renameEdit')}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={commitRename}
                aria-label={t('slot.renameSave')}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setDraftName(slot.name);
                  setEditing(false);
                }}
                aria-label={t('slot.renameCancel')}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium truncate">{slot.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => {
                  setDraftName(slot.name);
                  setEditing(true);
                }}
                aria-label={t('slot.rename')}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">{formattedDate}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setConfirmLoad(true)}
          >
            {t('slot.load')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            {t('slot.delete')}
          </Button>
        </div>
      </div>

      {/* Load confirmation dialog */}
      <Dialog open={confirmLoad} onOpenChange={setConfirmLoad}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('slot.loadTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('slot.loadBody', { name: slot.name })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLoad(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                setConfirmLoad(false);
                onLoad(slot);
              }}
            >
              {t('slot.load')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('slot.deleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('slot.deleteBody', { name: slot.name })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false);
                onDelete(slot.id);
              }}
            >
              {t('slot.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── SlotSheetBody ────────────────────────────────────────────────────────────
// Mounted only when `open=true`; initializes from localStorage at mount time.

interface SlotSheetBodyProps {
  onOpenChange: (open: boolean) => void;
  onLoad: (slot: Slot) => void;
}

function SlotSheetBody({ onOpenChange, onLoad }: SlotSheetBodyProps) {
  const { t } = useTranslation();
  // Initialize from localStorage at mount (lazy initializer — no useEffect needed)
  const [slots, setSlots] = useState<Record<string, Slot>>(loadSlots);

  const slotList = Object.values(slots);
  const count = slotList.length;
  const atCapacity = count >= SLOTS_CAPACITY;

  function handleDelete(id: string) {
    deleteSlot(id);
    setSlots(loadSlots());
  }

  function handleRename(id: string, name: string) {
    renameSlot(id, name);
    setSlots(loadSlots());
  }

  function handleLoad(slot: Slot) {
    onLoad(slot);
    onOpenChange(false);
  }

  return (
    <>
      <SheetHeader className="flex-shrink-0">
        <SheetTitle>
          {t('header.mySchedules')}{' '}
          <span className="text-sm font-normal text-muted-foreground">
            {count}/{SLOTS_CAPACITY}
          </span>
        </SheetTitle>
      </SheetHeader>

      {atCapacity && (
        <div className="flex-shrink-0 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
          {t('slot.atCapacity')}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {slotList.length === 0 ? (
          <div className="flex items-center justify-center h-full py-12 text-center">
            <p className="text-sm text-muted-foreground px-4">
              {t('slot.emptyPre')}
              <span className="font-medium">{t('slot.saveAsInline')}</span>
              {t('slot.emptyPost')}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {slotList.map((slot) => (
              <SlotRow
                key={slot.id}
                slot={slot}
                onLoad={handleLoad}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── SlotSheet ────────────────────────────────────────────────────────────────

export function SlotSheet({ open, onOpenChange, onLoad }: SlotSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col overflow-hidden">
        {/* Mount SlotSheetBody only when open so it re-reads localStorage on every open */}
        {open && <SlotSheetBody onOpenChange={onOpenChange} onLoad={onLoad} />}
      </SheetContent>
    </Sheet>
  );
}
