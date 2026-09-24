/**
 * The home-screen widget slots, with the other tabs' pictures beside the
 * ring's: run against the real table (worker/migrations/0007_widgets.sql) in
 * an in-memory SQLite shaped like D1.
 */
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { handleWidgetDelete, handleWidgetPng, handleWidgetPut } from '../widget';
import type { Env } from '../index';

/** Just enough of D1: prepare → bind → first / run. */
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(__dirname, '..', 'migrations', '0007_widgets.sql'), 'utf8'));
  const norm = (v: unknown) => (v instanceof ArrayBuffer ? new Uint8Array(v) : v);
  return {
    db,
    prepare(sql: string) {
      let args: unknown[] = [];
      const st = {
        bind(...a: unknown[]) { args = a.map(norm); return st; },
        async first<T>() { return (db.prepare(sql).get(...(args as never[])) ?? null) as T | null; },
        async run() { db.prepare(sql).run(...(args as never[])); return { success: true }; },
      };
      return st;
    },
  };
}

const TOKEN = 'abcdefghijKLMNOPQRST12';
// A 1×1 PNG, and another, so the two pictures differ.
const PNG_A = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const PNG_B = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const put = (png: string) => new Request('https://24houring.com/x', {
  method: 'PUT',
  headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
  body: JSON.stringify({ png, meta: { v: 1 } }),
});
const get = () => new Request('https://24houring.com/x');

describe('a picture per kind, under the phone\'s one token', () => {
  it('keeps the ring and each kind apart, and unlinking drops them all', async () => {
    const db = d1();
    const env = { DB: db } as unknown as Env;
    expect((await handleWidgetPut(put(PNG_A), env, TOKEN)).status).toBe(200);
    expect((await handleWidgetPut(put(PNG_B), env, TOKEN, 'calendar')).status).toBe(200);
    expect((await handleWidgetPut(put(PNG_B), env, TOKEN, 'people')).status).toBe(200);

    const ring = await handleWidgetPng(get(), env, TOKEN);
    const calendar = await handleWidgetPng(get(), env, TOKEN, 'calendar');
    expect(ring.status).toBe(200);
    expect(calendar.status).toBe(200);
    expect(ring.headers.get('etag')).not.toBe(calendar.headers.get('etag'));
    expect((await handleWidgetPng(get(), env, TOKEN, 'place')).status).toBe(404);

    // One kind off the home screen: only its picture goes.
    await handleWidgetDelete(env, TOKEN, 'people');
    expect((await handleWidgetPng(get(), env, TOKEN, 'people')).status).toBe(404);
    expect((await handleWidgetPng(get(), env, TOKEN, 'calendar')).status).toBe(200);

    // Unlinking the phone drops the ring and every kind with it.
    await handleWidgetDelete(env, TOKEN);
    expect((await handleWidgetPng(get(), env, TOKEN)).status).toBe(404);
    expect((await handleWidgetPng(get(), env, TOKEN, 'calendar')).status).toBe(404);
    expect(db.db.prepare('SELECT COUNT(*) AS n FROM widgets').get()).toEqual({ n: 0 });
  });

  it('never lets one phone\'s unlink reach another\'s pictures', async () => {
    const db = d1();
    const env = { DB: db } as unknown as Env;
    const other = 'abcdefghijKLMNOPQRST99';
    await handleWidgetPut(put(PNG_A), env, TOKEN, 'life');
    await handleWidgetPut(put(PNG_A), env, other, 'life');
    await handleWidgetDelete(env, TOKEN);
    expect((await handleWidgetPng(get(), env, other, 'life')).status).toBe(200);
  });
});
