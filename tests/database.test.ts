import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let db: PGlite;
const token = 'd'.repeat(64),
  replacement = 'e'.repeat(64);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    'create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;',
  );
  await db.exec(
    await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'),
  );
  await db.query('insert into public.guests(name, token) values ($1, $2)', [
    'Database Guest',
    token,
  ]);
}, 30_000);
afterAll(async () => {
  await db?.close();
});

describe('real PostgreSQL schema and permissions', () => {
  it('has RLS enabled', async () => {
    const { rows } = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = 'public.guests'::regclass",
    );
    expect(rows[0].relrowsecurity).toBe(true);
  });
  it.each(['anon', 'authenticated'])(
    'denies direct reads, writes, and RPC to %s',
    async (role) => {
      await db.exec(`set role ${role}`);
      try {
        await expect(db.query('select * from public.guests')).rejects.toThrow(
          /permission denied/,
        );
        await expect(
          db.query('update public.guests set status = $1', ['attending']),
        ).rejects.toThrow(/permission denied/);
        await expect(
          db.query('insert into public.guests(name, token) values ($1, $2)', [
            'Intruder',
            'f'.repeat(64),
          ]),
        ).rejects.toThrow(/permission denied/);
        await expect(
          db.query('select * from public.save_rsvp($1,$2,$3,$4)', [
            token,
            'attending',
            '',
            null,
          ]),
        ).rejects.toThrow(/permission denied/);
      } finally {
        await db.exec('reset role');
      }
    },
  );
  it('enforces token uniqueness, allowed status, and message length', async () => {
    await expect(
      db.query('insert into public.guests(name, token) values ($1,$2)', [
        'Duplicate',
        token,
      ]),
    ).rejects.toThrow(/unique/);
    await expect(
      db.query('update public.guests set status = $1', ['maybe']),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.query('update public.guests set message = $1', ['x'.repeat(501)]),
    ).rejects.toThrow(/check constraint/);
  });
  it('allows service-role updates without duplicate rows', async () => {
    await db.exec('set role service_role');
    try {
      await db.query('select * from public.save_rsvp($1,$2,$3,$4)', [
        token,
        'attending',
        'A real SQL wish',
        null,
      ]);
      const { rows } = await db.query<{ status: string; message: string }>(
        'select * from public.save_rsvp($1,$2,$3,$4)',
        [token, 'declined', 'Updated wish', null],
      );
      expect(rows[0]).toMatchObject({
        status: 'declined',
        message: 'Updated wish',
      });
      expect((await db.query('select * from public.guests')).rows).toHaveLength(
        1,
      );
    } finally {
      await db.exec('reset role');
    }
  });
  it('enforces the database clock, including the exact deadline', async () => {
    await expect(
      db.query('select * from public.save_rsvp($1,$2,$3,clock_timestamp())', [
        token,
        'attending',
        'Too late',
      ]),
    ).rejects.toThrow('RSVP_CLOSED');
    await expect(
      db.query(
        "select * from public.save_rsvp($1,$2,$3,clock_timestamp() - interval '1 day')",
        [token, 'attending', 'Too late'],
      ),
    ).rejects.toThrow('RSVP_CLOSED');
    const { rows } = await db.query<{ message: string }>(
      'select message from public.guests',
    );
    expect(rows[0].message).toBe('Updated wish');
  });
  it('invalidates the old token while preserving response and identity', async () => {
    const old = (
      await db.query<{ id: string; status: string; message: string }>(
        'select * from public.guests',
      )
    ).rows[0];
    await db.query('update public.guests set token = $1 where token = $2', [
      replacement,
      token,
    ]);
    expect(
      (
        await db.query('select * from public.save_rsvp($1,$2,$3,$4)', [
          token,
          'attending',
          'Old link',
          null,
        ])
      ).rows,
    ).toEqual([]);
    const updated = (
      await db.query(
        'select id, status, message from public.guests where token = $1',
        [replacement],
      )
    ).rows[0];
    expect(updated).toEqual({
      id: old.id,
      status: old.status,
      message: old.message,
    });
  });
});
