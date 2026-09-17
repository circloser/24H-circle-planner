import { Camera, Smile, type LucideIcon } from 'lucide-react';

/** The three things that can be added to the calendar, in menu order. */
export type DecorTool = 'sticker' | 'tape' | 'photo';
export const TOOLS: readonly DecorTool[] = ['sticker', 'tape', 'photo'];

/** A strip of tape, drawn as an icon. */
const TapeIcon = (({ className }: { className?: string }) => (
  <span className={`inline-grid place-items-center ${className ?? ''}`} aria-hidden>
    <span className="block h-[40%] w-full -rotate-12 rounded-[1px] border border-current opacity-80" />
  </span>
)) as unknown as LucideIcon;

export const TOOL_ICON: Record<DecorTool, LucideIcon> = { sticker: Smile, tape: TapeIcon, photo: Camera };
