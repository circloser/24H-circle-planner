import { useState } from 'react';
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
import { AdSlot } from '@/components/Ads/AdSlot';
import { useTranslation } from '@/hooks/usePreferences';
import { useUserPresets } from '@/hooks/useUserPresets';
import type { Schedule } from '@/types/schedule';

interface SavePresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSchedule: Schedule;
}

function SavePresetDialogBody({
  currentSchedule,
  onOpenChange,
}: {
  currentSchedule: Schedule;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { addPreset } = useUserPresets();
  const [name, setName] = useState(() => currentSchedule.name || '');

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    addPreset(trimmed, currentSchedule.slices);
    toast.success(t('preset.saved', { name: trimmed }));
    onOpenChange(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('preset.saveTitle')}</DialogTitle>
      </DialogHeader>
      <div className="py-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('preset.savePlaceholder')}
          aria-label={t('preset.saveName')}
          autoFocus
        />
      </div>
      <AdSlot slot="savepreset" className="mb-1" />
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={name.trim().length === 0}>
          {t('common.save')}
        </Button>
      </DialogFooter>
    </>
  );
}

export function SavePresetDialog({ open, onOpenChange, currentSchedule }: SavePresetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <SavePresetDialogBody currentSchedule={currentSchedule} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  );
}
