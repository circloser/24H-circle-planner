import { Component, lazy, Suspense, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from '@/hooks/usePreferences';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Props = ComponentProps<typeof import('./ExportDialog').ExportDialog>;
const loadDialog = () => lazy(() => import('./ExportDialog').then((module) => ({ default: module.ExportDialog })));

class LoadBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** A fresh lazy component on retry avoids React caching a rejected import. */
export function LazyExportDialog(props: Props) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [Content, setContent] = useState(loadDialog);
  const feedback = (failed: boolean) => (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('header.export')}</DialogTitle></DialogHeader>
        <p role="status">{t(failed ? 'export.loadError' : 'export.loading')}</p>
        {failed && <Button className="min-h-11" onClick={() => { setContent(loadDialog); setAttempt((n) => n + 1); }}>{t('export.retryLoad')}</Button>}
        <Button variant="outline" className="min-h-11" onClick={() => props.onOpenChange(false)}>{t('common.close')}</Button>
      </DialogContent>
    </Dialog>
  );
  return <LoadBoundary key={attempt} fallback={feedback(true)}><Suspense fallback={feedback(false)}><Content {...props} /></Suspense></LoadBoundary>;
}
