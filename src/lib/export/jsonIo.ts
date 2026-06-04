import { v4 as uuid } from 'uuid';
import type { Schedule } from '@/types/schedule';

/**
 * JSON export/import envelope shape.
 * version: 1 is the only known version.
 */
interface ExportEnvelope {
  version: 1;
  exportedAt: string;
  schedule: Schedule;
}

/**
 * Exports the given schedule as a JSON Blob.
 * Envelope format: { version: 1, exportedAt: ISO8601, schedule }
 * Pretty-printed with 2-space indent (G4 / H6 requirement).
 */
export function exportScheduleAsJson(schedule: Schedule): Blob {
  const envelope: ExportEnvelope = {
    version: 1,
    exportedAt: new Date().toISOString(),
    schedule,
  };
  const json = JSON.stringify(envelope, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Imports a schedule from a JSON File.
 *
 * Version handling:
 *  - version === 1: valid — deep-clone with new UUIDs
 *  - missing version: migrate by stamping version: 1, then clone with new UUIDs
 *  - unknown future version (>1): throw Error('Unknown JSON version: <n>')
 *  - corrupt JSON: throws SyntaxError
 */
export async function importScheduleFromJson(file: File): Promise<Schedule> {
  const text = await readFileAsText(file);
  const parsed = JSON.parse(text) as Record<string, unknown>;

  // Determine version
  const version = parsed['version'];
  if (version !== undefined && version !== 1) {
    throw new Error(`Unknown JSON version: ${String(version)}`);
  }

  // Extract schedule — support both versioned envelope and bare schedule object.
  // A versioned envelope has { version: 1, exportedAt, schedule: {...} }.
  // A bare schedule (legacy / no-envelope) has the schedule fields at root:
  //   { id, version: 1, name, slices, ... } — the 'slices' key is the discriminator.
  const hasEnvelopeSchedule = version === 1 && 'schedule' in parsed && parsed['schedule'] !== undefined;
  const rawSchedule: Schedule = hasEnvelopeSchedule
    ? (parsed['schedule'] as Schedule)
    : (parsed as unknown as Schedule);

  if (!rawSchedule || typeof rawSchedule !== 'object') {
    throw new Error('Invalid JSON: missing schedule object');
  }

  // Deep-clone with new UUIDs so the imported plan integrates cleanly
  const importedSchedule: Schedule = {
    ...(rawSchedule as Schedule),
    id: uuid(),
    version: 1,
    updatedAt: new Date().toISOString(),
    slices: (rawSchedule as Schedule).slices.map((s) => ({ ...s, id: uuid() })),
  };

  return importedSchedule;
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function readFileAsText(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsText(file);
  });
}
