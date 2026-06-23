import { useState } from 'react';
import { StickyNote, Plus, Eye, EyeOff, Trash2, List } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMemos } from '@/hooks/useMemos';
import { useTranslation } from '@/hooks/usePreferences';
import { MemoNote } from './MemoNote';
import { MemoListDialog } from './MemoListDialog';

/**
 * Renders every post-it memo (when visible) plus a single floating memo button
 * that opens a small popup with: new memo / show-hide / delete-all.
 */
export function MemoLayer() {
  const { memos, visible, addMemo, toggleVisible, clearMemos } = useMemos();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const item =
    'flex items-center gap-2 rounded-full px-3 py-2 text-sm shadow-md transition-transform hover:scale-105';
  const itemStyle = {
    backgroundColor: 'hsl(var(--surface))',
    color: 'hsl(var(--foreground))',
    border: '1px solid hsl(var(--border))',
  } as React.CSSProperties;

  return (
    <>
      {visible && memos.filter((m) => m.onScreen).map((m) => <MemoNote key={m.id} memo={m} />)}

      {/* Click-away backdrop for the popup menu. */}
      {menuOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      {/* Popup menu — stacked above the FAB. */}
      {menuOpen && (
        <div className="fixed bottom-[76px] right-5 z-30 flex flex-col items-end gap-2">
          <button
            type="button"
            className={item}
            style={itemStyle}
            onClick={() => { addMemo(); setMenuOpen(false); }}
          >
            <Plus className="h-4 w-4" />
            {t('memo.add')}
          </button>
          <button
            type="button"
            className={item}
            style={itemStyle}
            onClick={() => { setMenuOpen(false); setListOpen(true); }}
          >
            <List className="h-4 w-4" />
            {t('memo.list')}
          </button>
          <button
            type="button"
            className={item}
            style={itemStyle}
            onClick={() => { toggleVisible(); setMenuOpen(false); }}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {visible ? t('memo.hide') : t('memo.show')}
          </button>
          <button
            type="button"
            className={item}
            style={itemStyle}
            disabled={memos.length === 0}
            onClick={() => { setMenuOpen(false); setClearOpen(true); }}
          >
            <Trash2 className="h-4 w-4" />
            {t('memo.clearAll')}
          </button>
        </div>
      )}

      {/* The single memo FAB. */}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={t('memo.add')}
        aria-expanded={menuOpen}
        title={t('memo.add')}
        className="fixed bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--text-muted))', border: '1px solid hsl(var(--border))' }}
      >
        <StickyNote className="h-5 w-5" />
      </button>

      {/* Delete-all confirmation. */}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('memo.clearTitle')}</DialogTitle>
            <DialogDescription>{t('memo.clearBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => { clearMemos(); setClearOpen(false); }}
              style={{ backgroundColor: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))' }}
            >
              {t('memo.clearConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full memo archive (newest first; on/off-screen + permanent delete). */}
      <MemoListDialog open={listOpen} onOpenChange={setListOpen} />
    </>
  );
}
