import { useRef, useState } from 'react';
import { ItemBody } from '@/components/Calendar/Decor';
import { newItemId, type LayerItem } from '@/lib/decor-layer';
import { track } from '@/lib/track';
import type { useLifeDecor } from '@/hooks/useLifeDecor';

/** What waits to be placed, and what is picked on the line. */
export type LifeArmed = Omit<LayerItem, 'id' | 'x' | 'y'>;
export interface LifePicked { row: string; id: string }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The decorating layer for one row of the line. Each row carries its own
 * decorations, placed as fractions of the row's box, so they stay on the same
 * moment however long the line grows. A decoration dragged onto another row
 * moves there (the row under the pointer decides).
 */
export function LifeRowDecor({ row, store, active, armed, selected, onSelect, onPlaced }: {
  row: string;
  store: ReturnType<typeof useLifeDecor>;
  /** Decorating is on (otherwise the layer only shows what is there). */
  active: boolean;
  armed: LifeArmed | null;
  selected: LifePicked | null;
  onSelect: (p: LifePicked | null) => void;
  onPlaced: (p: LifePicked) => void;
}) {
  const items = store.rows[row] ?? [];
  const box = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState<{ id: string; dx: number; dy: number } | null>(null);
  if (!items.length && !active) return null;

  const place = (e: React.PointerEvent) => {
    if (!active || e.button !== 0 || e.target !== e.currentTarget) return;
    if (!armed) return onSelect(null);
    const r = e.currentTarget.getBoundingClientRect();
    const id = newItemId();
    const at = { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
    if (store.addItem(row, { ...armed, id, ...at } as LayerItem)) {
      track('decor_place', { kind: armed.k });
      onPlaced({ row, id });
    }
  };

  const carry = (e: React.PointerEvent, item: LayerItem) => {
    if (!active || e.button !== 0 || !box.current) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect({ row, id: item.id });
    const r = box.current.getBoundingClientRect();
    setMoving({ id: item.id, dx: e.clientX - (r.left + item.x * r.width), dy: e.clientY - (r.top + item.y * r.height) });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const drag = (e: React.PointerEvent) => {
    if (!moving || !box.current) return;
    const r = box.current.getBoundingClientRect();
    store.updateItem(row, moving.id, {
      x: clamp01((e.clientX - moving.dx - r.left) / r.width),
      y: clamp01((e.clientY - moving.dy - r.top) / r.height),
    });
  };

  /** Dropped over another row? Hand the decoration over to it. */
  const drop = (e: React.PointerEvent) => {
    if (!moving) return;
    const id = moving.id;
    setMoving(null);
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-life-row-decor]');
    const to = under?.dataset.lifeRowDecor;
    if (!to || to === row) return;
    const r = under!.getBoundingClientRect();
    store.moveItem(row, to, id, { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) });
    onSelect({ row: to, id });
  };

  return (
    <div ref={box} data-life-row-decor={row}
      className={`absolute inset-0 ${active ? 'z-20' : 'z-[5]'} ${active ? '' : 'pointer-events-none'}`}
      style={{ containerType: 'inline-size' }}
      onPointerDown={place}>
      {items.map((item) => (
        <span key={item.id} data-life-decor-item={item.id}
          className={`absolute -translate-x-1/2 -translate-y-1/2 select-none ${active ? 'cursor-grab touch-none' : 'pointer-events-none'} ${
            selected?.id === item.id ? 'outline outline-2 outline-offset-2 outline-primary' : ''}`}
          style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, rotate: `${item.r}deg` }}
          onPointerDown={(e) => carry(e, item)}
          onPointerMove={drag}
          onPointerUp={drop}
          onPointerCancel={() => setMoving(null)}>
          <ItemBody item={item} />
        </span>
      ))}
    </div>
  );
}
