import { useEffect, useState } from 'react';
import { TAMA_FX_EVENT, TAMA_FX_EMOJI, type TamaFxDetail } from './tama-utils';

interface FxItem { id: number; x: number; y: number; emoji: string }
let seq = 0;

/**
 * Renders the small floating reaction emojis (hearts on play, 😋 on feed) that
 * pop above a pet and drift up as they fade. Driven by the `tama-fx` window
 * event (fireTamaFx). Mounted once in TamagotchiLayer.
 */
export function TamaFx() {
  const [items, setItems] = useState<FxItem[]>([]);

  useEffect(() => {
    const onFx = (e: Event) => {
      const d = (e as CustomEvent<TamaFxDetail>).detail;
      if (!d) return;
      const pool = TAMA_FX_EMOJI[d.kind] ?? ['✨'];
      const emoji = pool[Math.floor(Math.random() * pool.length)];
      const id = ++seq;
      const jx = (Math.random() - 0.5) * 26;
      setItems((it) => [...it, { id, x: d.x + jx, y: d.y - 14, emoji }]);
      window.setTimeout(() => setItems((it) => it.filter((f) => f.id !== id)), 900);
    };
    window.addEventListener(TAMA_FX_EVENT, onFx);
    return () => window.removeEventListener(TAMA_FX_EVENT, onFx);
  }, []);

  return (
    <>
      {items.map((f) => (
        <span
          key={f.id}
          className="tama-fx"
          aria-hidden
          style={{ position: 'fixed', left: f.x, top: f.y, zIndex: 72, fontSize: 16, pointerEvents: 'none' }}
        >
          {f.emoji}
        </span>
      ))}
    </>
  );
}
