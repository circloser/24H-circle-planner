import type { Schedule } from './schedule';

export interface DragRef {
  snapshot: Schedule;
  boundaryIndex: number;
  affectedSliceIds: Set<string>;
  originalSlicePaths: Record<string, string>; // sliceId → SVG d-attribute string
}
