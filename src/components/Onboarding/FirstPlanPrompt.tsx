import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';

interface Props {
  open: boolean;
  onDismiss: () => void;
  onAdd: () => void;
  onTemplates: () => void;
}

/** In-flow guidance leaves the planner available without a timed interruption. */
export function FirstPlanPrompt({ open, onDismiss, onAdd, onTemplates }: Props) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <section aria-label={t('onboarding.firstPlan')} className="relative mx-auto mt-3 w-[calc(100%-1.5rem)] max-w-xl rounded-xl border border-border bg-surface p-4 pr-12">
      <h2 className="text-sm font-semibold">{t('onboarding.firstPlan')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('onboarding.firstPlanBody')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={onAdd} className="min-h-11">{t('block.add')}</Button>
        <Button variant="outline" onClick={onTemplates} className="min-h-11">{t('welcome.moreGallery')}</Button>
      </div>
      <Button variant="ghost" onClick={onDismiss} aria-label={t('common.cancel')} className="absolute right-1 top-1 h-11 w-11 p-0"><X className="h-4 w-4" /></Button>
    </section>
  );
}
