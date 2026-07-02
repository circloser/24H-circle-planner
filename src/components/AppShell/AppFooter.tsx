import { useTranslation } from '@/hooks/usePreferences';

/** Site footer — required legal/info pages (also crawlable static pages). */
export function AppFooter() {
  const { t } = useTranslation();
  return (
    <footer
      className="relative z-30 mt-auto border-t px-4 py-4 text-center text-xs border-border text-muted-foreground bg-background/90"
      style={{
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <a href="/guides/" className="hover:underline">{t('footer.guides')}</a>
        <span aria-hidden style={{ opacity: 0.4 }}>·</span>
        <a href="/stories/" className="hover:underline">{t('footer.stories')}</a>
        <span aria-hidden style={{ opacity: 0.4 }}>·</span>
        <a href="/health/" className="hover:underline">{t('footer.health')}</a>
        <span aria-hidden style={{ opacity: 0.4 }}>·</span>
        <a href="/faq" className="hover:underline">{t('footer.faq')}</a>
        <span aria-hidden style={{ opacity: 0.4 }}>·</span>
        <a href="/about" className="hover:underline">{t('footer.about')}</a>
        <span aria-hidden style={{ opacity: 0.4 }}>·</span>
        <a href="/privacy" className="hover:underline">{t('footer.privacy')}</a>
        <span aria-hidden style={{ opacity: 0.4 }}>·</span>
        <a href="/contact" className="hover:underline">{t('footer.contact')}</a>
      </nav>
      <p className="mt-1.5 text-muted-foreground/80">© 2026 Circloser · 24houring.com</p>
    </footer>
  );
}
