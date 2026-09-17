import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, ChevronDown, ChevronUp, GripHorizontal, ImagePlus, Lock, Minus, Palette, Plus, RotateCcw, RotateCw, Sparkles, Trash2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { useDecor } from '@/hooks/useDecor';
import { requestUpgrade } from '@/lib/pro';
import { STICKER_GROUPS, TINTS, stickerGlyph, type StickerGroupId } from '@/lib/decor';
import {
  CALENDAR_PAPERS, MAX_ITEMS, SCALE_MAX, SCALE_MIN, TAPE_COLORS, TAPE_DEFAULT, TAPE_MAX, TAPE_MIN, TAPE_PATTERNS,
  newItemId, tapeBackground, type CalendarPaper, type LayerItem, type TapePattern,
} from '@/lib/decor-layer';
import { loadPhoto, newPhotoId, savePhoto, shrinkPhoto } from '@/lib/calendar-photos';
import { COLOR_THEMES } from '@/data/color-themes';
import type { TKey } from '@/i18n/translations';

/**
 * Diary decorating (다꾸). One 꾸미기 menu holds the colour theme (free), the
 * paper (Pro) and the three decorating tools (Pro), which open a tray under the
 * toolbar. Stickers, masking tape and photo stickers live on a layer above each
 * month, placed by fractions of the month grid — so they stay over the same
 * days whatever size the calendar is drawn at. Decor that is already stored is
 * always SHOWN; only changing it needs Pro.
 */

export type DecorTool = 'sticker' | 'tape' | 'photo';
/** An item waiting to be placed: everything but where. */
export type Armed = Omit<LayerItem, 'id' | 'x' | 'y'>;
export interface Picked { month: string; id: string }

const GROUP_LABEL: Record<StickerGroupId, TKey> = {
  mood: 'decor.groupMood',
  weather: 'decor.groupWeather',
  life: 'decor.groupLife',
  hobby: 'decor.groupHobby',
  food: 'decor.groupFood',
  animal: 'decor.groupAnimal',
  nature: 'decor.groupNature',
  moment: 'decor.groupMoment',
  symbol: 'decor.groupSymbol',
  travel: 'decor.groupTravel',
};
const TOOL_LABEL: Record<DecorTool, TKey> = { sticker: 'decor.stickers', tape: 'decor.tape', photo: 'decor.photo' };
const PAPER_LABEL: Record<CalendarPaper, TKey> = {
  none: 'decor.paperNone',
  grid: 'decor.paperGrid',
  lined: 'decor.paperLined',
  dot: 'decor.paperDot',
  kraft: 'decor.paperKraft',
};
const TOOLS: readonly DecorTool[] = ['sticker', 'tape', 'photo'];

const usePro = () => useAuth().plan === 'pro';
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The sticker picker: a row of category tabs, then that category's stickers.
 *  `picked` is shown pressed. */
function Picker({ picked, onPick }: { picked?: string | null; onPick: (id: string) => void }) {
  const { t } = useTranslation();
  const [group, setGroup] = useState<StickerGroupId>('mood');
  const items = STICKER_GROUPS.find((g) => g.id === group)?.items ?? [];
  return (
    <div className="flex flex-col gap-1.5" data-sticker-picker>
      <div className="flex flex-wrap gap-0.5">
        {STICKER_GROUPS.map((g) => (
          <button key={g.id} type="button" data-sticker-group={g.id} aria-pressed={group === g.id}
            onClick={() => setGroup(g.id)}
            className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors ${
              group === g.id ? 'border-primary bg-primary/10 text-foreground' : 'border-transparent text-muted-foreground hover:bg-accent/10'
            }`}>
            <span className="text-sm leading-none" aria-hidden>{g.items[0]?.glyph}</span>
            {t(GROUP_LABEL[g.id])}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(2rem,1fr))] gap-0.5">
        {items.map((st) => (
          <button
            key={st.id}
            type="button"
            data-sticker={st.id}
            aria-pressed={picked === st.id}
            aria-label={st.id}
            onClick={() => onPick(st.id)}
            className={`grid h-8 place-items-center rounded-md text-lg leading-none transition-colors hover:bg-accent/15 ${
              picked === st.id ? 'bg-primary/15 ring-2 ring-primary' : ''
            }`}
          >
            {st.glyph}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The toolbar's 꾸미기 menu. */
export function DecorMenu({ theme, onTheme, paper, onPaper, tool, onTool }: {
  theme: string | null;
  onTheme: (id: string | null) => void;
  paper: CalendarPaper;
  onPaper: (p: CalendarPaper) => void;
  tool: DecorTool | null;
  onTool: (tool: DecorTool) => void;
}) {
  const { t, lang } = useTranslation();
  const pro = usePro();
  const lock = !pro && <Lock className="ml-auto h-3 w-3 text-muted-foreground" aria-hidden />;
  const lit = !!theme || paper !== 'none' || !!tool;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" data-decor-menu title={t('decor.menu')}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors hover:bg-accent/10 ${
            lit ? 'border-primary text-foreground' : 'border-border text-muted-foreground'
          }`}>
          <Sparkles className="h-3.5 w-3.5" />
          {t('decor.menu')}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem]" data-decor-menu-content>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-decor-sub="theme" className="gap-2">
            <Palette className="h-3.5 w-3.5" />
            {t('calendar.theme')}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme ?? ''} onValueChange={(v) => onTheme(v || null)}>
              <DropdownMenuRadioItem value="" data-cal-theme-option="">{t('calendar.themeDefault')}</DropdownMenuRadioItem>
              {COLOR_THEMES.map((th) => (
                <DropdownMenuRadioItem key={th.id} value={th.id} data-cal-theme-option={th.id} className="gap-2">
                  <span className="flex gap-0.5">
                    {th.colors.slice(1, 5).map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />)}
                  </span>
                  {lang === 'ko' ? th.ko : th.en}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-decor-sub="paper" className="gap-2">
            <span className="h-3.5 w-3.5 rounded-sm border border-current opacity-70" aria-hidden />
            {t('decor.paper')}
            {lock}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={paper}
              onValueChange={(v) => (pro ? onPaper(v as CalendarPaper) : requestUpgrade())}>
              {CALENDAR_PAPERS.map((p) => (
                <DropdownMenuRadioItem key={p} value={p} data-paper-option={p}>{t(PAPER_LABEL[p])}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        {TOOLS.map((k) => (
          <DropdownMenuItem key={k} data-decor-tool={k} className="gap-2"
            onSelect={() => (pro ? onTool(k) : requestUpgrade())}>
            {t(TOOL_LABEL[k])}
            {lock}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const iconBtn = 'grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent/10 disabled:opacity-40';

/** Where the floating panel was left — a per-viewer convenience, nothing more. */
const PANEL_POS_KEY = 'cal-decor-panel-pos';
type Pos = { x: number; y: number };
function readPanelPos(): Pos | null {
  try {
    const p = JSON.parse(localStorage.getItem(PANEL_POS_KEY) ?? 'null') as Pos | null;
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  } catch {
    return null;
  }
}
function savePanelPos(p: Pos) {
  try { localStorage.setItem(PANEL_POS_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}
/** Keep the panel inside the window, with at least its title bar showing. */
function fitPanel(p: Pos, w: number): Pos {
  const x = Math.min(Math.max(8, p.x), Math.max(8, window.innerWidth - w - 8));
  const y = Math.min(Math.max(8, p.y), Math.max(8, window.innerHeight - 48));
  return { x, y };
}

/**
 * The decorating panel: a window floating over the calendar (so the calendar
 * keeps its size), moved by its title bar and folded to just that bar when it
 * is in the way. Pick what to place, and adjust whatever is selected.
 */
export function DecorTray({ tool, onTool, armed, onArm, selected, onDone }: {
  tool: DecorTool;
  onTool: (tool: DecorTool) => void;
  armed: Armed | null;
  onArm: (a: Armed | null) => void;
  /** The item picked on the layer, with its month. */
  selected: { month: string; item: LayerItem } | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { layer, updateItem, removeItem } = useDecor();
  const [pattern, setPattern] = useState<TapePattern>('stripe');
  const [color, setColor] = useState<string>(TAPE_COLORS[1]);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const sel = selected?.item;
  const count = selected ? (layer[selected.month]?.length ?? 0) : null;

  const armTape = (p: TapePattern, c: string) => {
    setPattern(p);
    setColor(c);
    // A tape that is already on the page takes the new look; otherwise the
    // next tap on the calendar lays a fresh strip.
    if (sel?.k === 'tape' && selected) updateItem(selected.month, sel.id, { p, c });
    else onArm({ k: 'tape', p, c, w: TAPE_DEFAULT, s: 1, r: -3 });
  };

  const addPhoto = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    const data = await shrinkPhoto(f);
    const id = newPhotoId();
    if (data && (await savePhoto(id, data))) {
      onArm({ k: 'photo', ph: id, s: 1, r: Math.round(Math.random() * 10 - 5) });
    }
    setBusy(false);
  };

  const patch = (p: Partial<LayerItem>) => { if (selected && sel) updateItem(selected.month, sel.id, p); };

  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(readPanelPos);
  const [folded, setFolded] = useState(false);

  // First placement (top right on a wide screen, the bottom on a phone), and
  // back inside the window whenever the window changes size.
  useLayoutEffect(() => {
    const fit = () => {
      const el = panel.current;
      if (!el) return;
      const w = el.offsetWidth;
      setPos((p) => {
        const want = p ?? (window.innerWidth < 640
          ? { x: 8, y: window.innerHeight - el.offsetHeight - 8 }
          : { x: window.innerWidth - w - 16, y: 120 });
        const next = fitPanel(want, w);
        return p && p.x === next.x && p.y === next.y ? p : next;
      });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const grab = (e: React.PointerEvent) => {
    if (e.button !== 0 || !pos || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const ox = e.clientX - pos.x;
    const oy = e.clientY - pos.y;
    let last = pos;
    const move = (ev: PointerEvent) => {
      last = fitPanel({ x: ev.clientX - ox, y: ev.clientY - oy }, panel.current?.offsetWidth ?? 0);
      setPos(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      savePanelPos(last);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return createPortal(
    <div
      ref={panel}
      data-decor-tray={tool}
      data-folded={folded || undefined}
      className="fixed z-[45] flex w-[min(380px,calc(100vw-16px))] flex-col overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-2xl"
      style={{ left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? undefined : 'hidden' }}
    >
      <div data-decor-drag onPointerDown={grab}
        className="flex cursor-move touch-none select-none items-center gap-1.5 border-b border-border bg-muted/40 px-2 py-1.5">
        <GripHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="flex-1 text-xs font-semibold">{t('decor.menu')}</span>
        <button type="button" data-decor-fold aria-pressed={folded} onClick={() => setFolded((v) => !v)}
          aria-label={t(folded ? 'decor.unfold' : 'decor.fold')} title={t(folded ? 'decor.unfold' : 'decor.fold')}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent/15">
          {folded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <Button size="sm" onClick={onDone} data-decor-done className="h-7 gap-1 bg-primary px-2 text-xs text-primary-foreground">
          <Check className="h-3.5 w-3.5" />
          {t('decor.done')}
        </Button>
      </div>
      {!folded && (
      <div className="flex max-h-[min(60vh,460px)] flex-col gap-2 overflow-y-auto p-2">
      <div className="flex flex-wrap items-center gap-1">
        {TOOLS.map((k) => (
          <button key={k} type="button" data-decor-tab={k} aria-pressed={tool === k}
            onClick={() => { onTool(k); onArm(null); }}
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              tool === k ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent/10'
            }`}>
            {t(TOOL_LABEL[k])}
          </button>
        ))}
        <span className="basis-full px-1 text-[11px] text-muted-foreground" data-decor-hint>
          {armed ? t('decor.armedHint') : t('decor.layerHint')}
        </span>
      </div>

      {tool === 'sticker' && (
        <Picker picked={armed?.k === 'sticker' ? armed.g : null}
          onPick={(g) => onArm(armed?.g === g ? null : { k: 'sticker', g, s: 1, r: 0 })} />
      )}

      {tool === 'tape' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-10 shrink-0 text-[10px] text-muted-foreground">{t('decor.pattern')}</span>
            {TAPE_PATTERNS.map((p) => (
              <button key={p} type="button" data-tape-pattern={p} aria-label={p}
                aria-pressed={armed?.k === 'tape' ? armed.p === p : sel?.k === 'tape' ? sel.p === p : false}
                onClick={() => armTape(p, sel?.k === 'tape' ? sel.c ?? color : color)}
                className="h-5 w-12 rounded-sm border border-black/10 aria-pressed:ring-2 aria-pressed:ring-primary"
                style={{ background: tapeBackground(p, sel?.k === 'tape' ? sel.c ?? color : color) }} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-10 shrink-0 text-[10px] text-muted-foreground">{t('decor.tapeColor')}</span>
            {TAPE_COLORS.map((c) => (
              <button key={c} type="button" data-tape-color={c} aria-label={c}
                onClick={() => armTape(sel?.k === 'tape' ? sel.p ?? pattern : pattern, c)}
                className="h-5 w-5 rounded-full border border-black/15" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      )}

      {tool === 'photo' && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={file} type="file" accept="image/*" className="hidden" data-decor-photo-input
            onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => file.current?.click()} className="h-7 gap-1 text-xs" data-decor-photo-pick>
            <ImagePlus className="h-3.5 w-3.5" />
            {t('decor.pickPhoto')}
          </Button>
          {armed?.k === 'photo' && <PhotoFrame id={armed.ph ?? ''} width="2.5rem" />}
          <span className="text-[10px] text-muted-foreground">{t('decor.photoLocal')}</span>
        </div>
      )}

      {sel && (
        <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2" data-decor-selected={sel.k}>
          <span className="mr-1 text-[11px] text-muted-foreground">{t('decor.size')}</span>
          <button type="button" className={iconBtn} data-item-smaller aria-label={t('decor.smaller')}
            disabled={sel.s <= SCALE_MIN} onClick={() => patch({ s: sel.s - 0.25 })}><Minus className="h-3.5 w-3.5" /></button>
          <button type="button" className={iconBtn} data-item-bigger aria-label={t('decor.bigger')}
            disabled={sel.s >= SCALE_MAX} onClick={() => patch({ s: sel.s + 0.25 })}><Plus className="h-3.5 w-3.5" /></button>
          <span className="ml-2 mr-1 text-[11px] text-muted-foreground">{t('decor.rotate')}</span>
          <button type="button" className={iconBtn} data-item-rotate-left aria-label={t('decor.rotate')}
            onClick={() => patch({ r: sel.r - 15 })}><RotateCcw className="h-3.5 w-3.5" /></button>
          <button type="button" className={iconBtn} data-item-rotate aria-label={t('decor.rotate')}
            onClick={() => patch({ r: sel.r + 15 })}><RotateCw className="h-3.5 w-3.5" /></button>
          {sel.k === 'tape' && (
            <>
              <span className="ml-2 mr-1 text-[11px] text-muted-foreground">{t('decor.length')}</span>
              <button type="button" className={iconBtn} data-item-shorter aria-label={t('decor.shorter')}
                disabled={(sel.w ?? TAPE_DEFAULT) <= TAPE_MIN} onClick={() => patch({ w: (sel.w ?? TAPE_DEFAULT) - 1 / 28 })}><Minus className="h-3.5 w-3.5" /></button>
              <button type="button" className={iconBtn} data-item-longer aria-label={t('decor.longer')}
                disabled={(sel.w ?? TAPE_DEFAULT) >= TAPE_MAX} onClick={() => patch({ w: (sel.w ?? TAPE_DEFAULT) + 1 / 28 })}><Plus className="h-3.5 w-3.5" /></button>
            </>
          )}
          <span className="flex-1" />
          {count !== null && <span className="text-[10px] tabular-nums text-muted-foreground">{count}/{MAX_ITEMS}</span>}
          <button type="button" data-item-delete onClick={() => { if (selected) removeItem(selected.month, sel.id); }}
            className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs text-red-500 hover:bg-red-500/10">
            <Trash2 className="h-3.5 w-3.5" />
            {t('decor.peel')}
          </button>
        </div>
      )}
      </div>
      )}
    </div>,
    document.body,
  );
}

/** A photo sticker's frame. The picture only exists on the device that added
 *  it; anywhere else the frame stays empty. */
function PhotoFrame({ id, width }: { id: string; width: string }) {
  const [src, setSrc] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    void loadPhoto(id).then((url) => { if (live) setSrc({ id, url }); });
    return () => { live = false; };
  }, [id]);
  const url = src?.id === id ? src.url : null;
  return (
    <span className="block bg-white shadow-md" style={{ width, padding: '6% 6% 20%' }} data-photo-frame={url ? 'shown' : 'empty'}>
      <span className="block aspect-square w-full bg-neutral-200 bg-cover bg-center"
        style={url ? { backgroundImage: `url("${url}")` } : undefined} />
    </span>
  );
}

function ItemBody({ item }: { item: LayerItem }) {
  if (item.k === 'sticker') {
    return (
      <span className="block leading-none drop-shadow-sm" style={{ fontSize: `${3.6 * item.s}cqw` }}>
        {stickerGlyph(item.g ?? '')}
      </span>
    );
  }
  if (item.k === 'tape') {
    return (
      <span
        className="block opacity-85 shadow-sm"
        style={{
          width: `${(item.w ?? TAPE_DEFAULT) * 100}cqw`,
          height: `${2.4 * item.s}cqw`,
          background: tapeBackground(item.p ?? 'solid', item.c ?? TAPE_COLORS[0]),
          // Torn, zigzag ends.
          clipPath: 'polygon(0 0, 100% 0, 98.8% 20%, 100% 40%, 98.8% 60%, 100% 80%, 98.8% 100%, 0 100%, 1.2% 80%, 0 60%, 1.2% 40%, 0 20%)',
        }}
      />
    );
  }
  return <PhotoFrame id={item.ph ?? ''} width={`${9 * item.s}cqw`} />;
}

/**
 * The decoration layer over one month's grid. Positions are fractions of the
 * grid and sizes are container-width units, so the layer scales with the grid.
 * It only takes the pointer while decorating; otherwise the days underneath
 * work as usual.
 */
export function DecorLayer({ month, active, armed, selected, onSelect, onPlaced }: {
  month: string;
  active: boolean;
  armed: Armed | null;
  selected: Picked | null;
  onSelect: (p: Picked | null) => void;
  onPlaced: (p: Picked) => void;
}) {
  const { layer, addItem, updateItem } = useDecor();
  const items = layer[month] ?? [];
  const box = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState<{ id: string; x: number; y: number } | null>(null);

  const place = (e: React.PointerEvent) => {
    if (!active || e.button !== 0 || e.target !== e.currentTarget) return;
    if (!armed) return onSelect(null);
    const r = e.currentTarget.getBoundingClientRect();
    const id = newItemId();
    const at = { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
    if (addItem(month, { ...armed, id, ...at } as LayerItem)) onPlaced({ month, id });
  };

  const carry = (e: React.PointerEvent, item: LayerItem) => {
    if (!active || e.button !== 0 || !box.current) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect({ month, id: item.id });
    const r = box.current.getBoundingClientRect();
    // Keep the point that was grabbed under the pointer.
    const dx = item.x - (e.clientX - r.left) / r.width;
    const dy = item.y - (e.clientY - r.top) / r.height;
    let last: { x: number; y: number } | null = null;
    const move = (ev: PointerEvent) => {
      last = { x: clamp01((ev.clientX - r.left) / r.width + dx), y: clamp01((ev.clientY - r.top) / r.height + dy) };
      setMoving({ id: item.id, ...last });
    };
    const done = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', done);
      window.removeEventListener('pointercancel', done);
      if (last) updateItem(month, item.id, last);
      setMoving(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', done);
    window.addEventListener('pointercancel', done);
  };

  if (!items.length && !active) return null;
  return (
    <div
      ref={box}
      data-decor-layer={month}
      data-decorating={active || undefined}
      onPointerDown={place}
      className={`absolute inset-0 z-30 overflow-hidden rounded-lg ${
        active ? `touch-none ${armed ? 'cursor-copy' : ''} bg-primary/[0.03] ring-2 ring-inset ring-primary/40` : 'pointer-events-none'
      }`}
      style={{ containerType: 'size' }}
    >
      {items.map((item) => {
        const at = moving?.id === item.id ? moving : item;
        const on = selected?.month === month && selected.id === item.id;
        return (
          <div
            key={item.id}
            data-decor-item={item.k}
            data-item-id={item.id}
            data-selected={on || undefined}
            onPointerDown={(e) => carry(e, item)}
            className={`absolute select-none ${active ? 'cursor-move' : ''}`}
            style={{
              left: `${at.x * 100}%`,
              top: `${at.y * 100}%`,
              transform: `translate(-50%, -50%) rotate(${item.r}deg)`,
              outline: on && active ? '2px dashed hsl(var(--primary))' : undefined,
              outlineOffset: 2,
            }}
          >
            <ItemBody item={item} />
          </div>
        );
      })}
    </div>
  );
}

/** The day editor's 다꾸 section: the highlighter behind the whole day. */
export function DayDecorEditor({ day }: { day: string }) {
  const { t } = useTranslation();
  const pro = usePro();
  const { dayDecor, setTint } = useDecor();
  const deco = dayDecor(day);

  if (!pro) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-2" data-decor-locked>
        <Lock className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 text-xs text-muted-foreground">{t('decor.proBody')}</span>
        <Button size="sm" variant="outline" onClick={requestUpgrade}>{t('billing.upgrade')}</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" data-decor-editor>
      <span className="mr-1 text-xs text-muted-foreground">{t('decor.highlight')}</span>
      <button type="button" data-tint="none" aria-pressed={!deco.t} onClick={() => setTint(day, null)}
        aria-label={t('decor.none')} title={t('decor.none')}
        className="grid h-5 w-5 place-items-center rounded-full border border-border text-[10px] text-muted-foreground">
        ∅
      </button>
      {TINTS.map((c) => (
        <button key={c} type="button" data-tint={c} aria-pressed={deco.t === c} aria-label={c}
          onClick={() => setTint(day, c)}
          className="h-5 w-5 rounded-full border border-black/15"
          style={{ backgroundColor: c, outline: deco.t === c ? '2px solid hsl(var(--primary))' : 'none', outlineOffset: '1px' }} />
      ))}
    </div>
  );
}
