import { createContext } from 'react';

/**
 * When an ancestor provides `true`, every FloatingPanel inside renders INLINE —
 * a static, full-width, non-draggable card — instead of a fixed floating one.
 * The mobile clock-tools section uses this so the same widgets stack in a fixed
 * column below the memos (no change needed in the individual widget components).
 */
export const FloatingInlineContext = createContext(false);
