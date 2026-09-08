import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  execute,
  newToken,
  type ApiInput,
  type Dependencies,
} from '../server/service';
import { guestsCsv } from '../server/csv';
import { deadlineLabel, event, validateEvent } from '../shared/event';
import { MemoryRepository } from './helpers';
import type { Guest, Invitation } from '../shared/types';

let repo: MemoryRepository;
let deps: Dependencies;
const tokenA = 'a'.repeat(64),
  tokenB = 'b'.repeat(64);
const call = (
  route: string,
  body?: unknown,
  overrides: Partial<ApiInput> = {},
) =>
  execute(
    { route, body, method: body === undefined ? 'GET' : 'POST', ...overrides },
    deps,
  );
const admin = { authorization: 'Bearer organizer-session' };
beforeEach(async () => {
  repo = new MemoryRepository();
  deps = { repo, organizers: ['organizer-id'], deadline: null };
  await repo.create('Avery', tokenA);
  await repo.create('Blair', tokenB);
});

describe('personal invitations', () => {
  it('isolates tokens and exposes only public fields', async () => {
    const a = await call('/api/invitation', { token: tokenA });
    expect(a.body).toEqual({
      name: 'Avery',
      status: 'pending',
      childrenCount: 0,
      message: '',
      closed: false,
      deadline: null,
    });
    expect(
      (await call('/api/invitation', { token: tokenB })).body,
    ).toMatchObject({ name: 'Blair' });
    await expect(
      call('/api/invitation', { token: 'c'.repeat(64) }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('updates without duplicates and restores the response', async () => {
    const first = await call('/api/rsvp', {
      token: tokenA,
      status: 'attending',
      childrenCount: 3,
      message: 'Happy birthday!',
    });
    expect(first.body).toMatchObject({
      status: 'attending',
      childrenCount: 3,
    });
    await call('/api/rsvp', {
      token: tokenA,
      status: 'declined',
      childrenCount: 0,
      message: 'Sending love',
    });
    const response = (await call('/api/invitation', { token: tokenA }))
      .body as Invitation;
    expect(response).toMatchObject({
      status: 'declined',
      childrenCount: 0,
      message: 'Sending love',
    });
    expect(repo.guests).toHaveLength(2);
    expect(await repo.find(tokenB)).toMatchObject({
      status: 'pending',
      message: '',
    });
  });
  it.each([
    null,
    [],
    { token: 'bad' },
    { token: tokenA, name: 'Changed' },
    { token: tokenA, companions: 1 },
  ])('rejects invalid invitation input %j', async (body) => {
    await expect(call('/api/invitation', body)).rejects.toMatchObject({
      status: 400,
    });
  });
  it.each([
    { status: 'pending', childrenCount: 0 },
    { status: 'attending', childrenCount: 0, message: 1 },
    { status: 'attending', childrenCount: 0, message: 'x'.repeat(501) },
    { status: 'attending', childrenCount: 0, name: 'Changed' },
    { status: 'attending', childrenCount: 0, deadline: null },
    { status: 'attending', childrenCount: 0, message: '\u0000' },
    { status: 'attending', childrenCount: -1, message: '' },
    { status: 'attending', childrenCount: 21, message: '' },
    { status: 'attending', childrenCount: 1.5, message: '' },
    { status: 'declined', childrenCount: 1, message: '' },
  ])('rejects unsafe RSVP input %j', async (body) => {
    await expect(
      call('/api/rsvp', { token: tokenA, ...body }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await repo.find(tokenA)).toMatchObject({ status: 'pending' });
  });
  it('accepts 500 characters and an omitted optional message', async () => {
    expect(
      (
        await call('/api/rsvp', {
          token: tokenA,
          status: 'attending',
          childrenCount: 2,
          message: 'x'.repeat(500),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call('/api/rsvp', {
          token: tokenA,
          status: 'attending',
          childrenCount: 0,
        })
      ).body,
    ).toMatchObject({ message: '' });
  });
  it('propagates storage failures instead of claiming success', async () => {
    vi.spyOn(repo, 'reply').mockRejectedValue(
      new Error('Database unavailable'),
    );
    await expect(
      call('/api/rsvp', {
        token: tokenA,
        status: 'attending',
        childrenCount: 0,
      }),
    ).rejects.toThrow();
  });
});

describe('deadlines', () => {
  it('accepts before the deadline and rejects exactly at and after it', async () => {
    deps.deadline = '2026-09-09T23:59:00+08:00';
    const boundary = Date.parse(deps.deadline);
    deps.now = () => boundary - 1;
    expect(
      (
        await call('/api/rsvp', {
          token: tokenA,
          status: 'attending',
          childrenCount: 2,
        })
      ).status,
    ).toBe(200);
    for (const now of [boundary, boundary + 1]) {
      deps.now = () => now;
      await expect(
        call('/api/rsvp', {
          token: tokenA,
          status: 'declined',
          childrenCount: 0,
        }),
      ).rejects.toMatchObject({ status: 409 });
    }
    expect(
      (await call('/api/invitation', { token: tokenA })).body,
    ).toMatchObject({ status: 'attending', closed: true });
  });
  it('stays open without a configured deadline', async () => {
    deps.now = () => Date.parse('2035-01-01T00:00:00Z');
    expect(
      (
        await call('/api/rsvp', {
          token: tokenA,
          status: 'attending',
          childrenCount: 0,
        })
      ).status,
    ).toBe(200);
  });
  it('requires timestamp offsets', () => {
    expect(() =>
      validateEvent({ ...event, startsAt: '2026-09-11T13:00:00' }),
    ).toThrow();
    expect(() =>
      validateEvent({ ...event, startsAt: '2026-09-11T13:00:00+08:00' }),
    ).not.toThrow();
    expect(() =>
      validateEvent({ ...event, endsAt: '2026-09-11T20:00:00' }),
    ).toThrow();
  });
  it('configures the production RSVP deadline through September 10', () => {
    expect(event.rsvpDeadline).toBe('2026-09-11T00:00:00+08:00');
    expect(deadlineLabel(event.rsvpDeadline!)).toBe(
      'September 10, 2026 at midnight',
    );
  });
});

describe('organizer operations', () => {
  it.each([
    ['/api/admin/guests', undefined],
    ['/api/admin/guests', { name: 'Casey' }],
    ['/api/admin/rotate', { id: '00000000-0000-0000-0000-000000000001' }],
    ['/api/admin/export', undefined],
  ])('requires verified allowlisted users for %s %j', async (route, body) => {
    for (const [authorization, status] of [
      [undefined, 401],
      ['Bearer invalid', 401],
      ['Bearer ordinary-session', 403],
    ] as const) {
      await expect(call(route, body, { authorization })).rejects.toMatchObject({
        status,
      });
    }
    deps.organizers = [];
    await expect(call(route, body, admin)).rejects.toMatchObject({
      status: 403,
    });
  });
  it('creates named invitations with unpredictable unique 256-bit tokens', async () => {
    const result = await call(
      '/api/admin/guests',
      { name: '  Casey  ' },
      admin,
    );
    const { guest } = result.body as { guest: Guest };
    expect(result.status).toBe(201);
    expect(guest.name).toBe('Casey');
    expect(guest.token).toMatch(/^[a-f0-9]{64}$/);
    expect(new Set(Array.from({ length: 100 }, newToken)).size).toBe(100);
  });
  it('edits guest details without changing the personal invitation token', async () => {
    const original = repo.guests[0];
    const result = await call(
      '/api/admin/guests',
      {
        id: original.id,
        name: '  Avery Rose  ',
        status: 'declined',
        childrenCount: 0,
        message: 'Sending birthday love',
      },
      { ...admin, method: 'PATCH' },
    );
    const { guest } = result.body as { guest: Guest };
    expect(guest).toMatchObject({
      name: 'Avery Rose',
      status: 'declined',
      children_count: 0,
      message: 'Sending birthday love',
      token: tokenA,
    });
    expect(
      (await call('/api/invitation', { token: tokenA })).body,
    ).toMatchObject({ name: 'Avery Rose', status: 'declined' });
  });
  it('deletes a guest and invalidates their personal invitation immediately', async () => {
    const id = repo.guests[0].id;
    const result = await call(
      '/api/admin/guests',
      { id },
      { ...admin, method: 'DELETE' },
    );
    expect(result).toMatchObject({ status: 200, body: { deleted: true } });
    expect(repo.guests).toHaveLength(1);
    await expect(
      call('/api/invitation', { token: tokenA }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('requires organizer access to delete a guest', async () => {
    const id = repo.guests[0].id;
    for (const [authorization, status] of [
      [undefined, 401],
      ['Bearer invalid', 401],
      ['Bearer ordinary-session', 403],
    ] as const) {
      await expect(
        call('/api/admin/guests', { id }, { authorization, method: 'DELETE' }),
      ).rejects.toMatchObject({ status });
    }
    expect(repo.guests).toHaveLength(2);
  });
  it.each([
    { name: '', status: 'pending', childrenCount: 0, message: '' },
    { name: 'Avery', status: 'maybe', childrenCount: 0, message: '' },
    {
      name: 'Avery',
      status: 'pending',
      childrenCount: 0,
      message: 'x'.repeat(501),
    },
    { name: 'Avery', status: 'pending', childrenCount: 2, message: '' },
  ])('rejects invalid guest edits %j', async (changes) => {
    await expect(
      call(
        '/api/admin/guests',
        { id: repo.guests[0].id, ...changes },
        { ...admin, method: 'PATCH' },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it.each(['', '   ', 'x'.repeat(121), 'Name\nAnother'])(
    'rejects invalid names',
    async (name) => {
      await expect(
        call('/api/admin/guests', { name }, admin),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
  it('replaces the token, preserving RSVP and rejecting old reads and writes', async () => {
    await call('/api/rsvp', {
      token: tokenA,
      status: 'attending',
      childrenCount: 4,
      message: 'Hooray!',
    });
    const id = repo.guests[0].id;
    const { guest } = (await call('/api/admin/rotate', { id }, admin)).body as {
      guest: Guest;
    };
    expect(guest).toMatchObject({
      id,
      status: 'attending',
      children_count: 4,
      message: 'Hooray!',
    });
    expect(guest.token).not.toBe(tokenA);
    await expect(
      call('/api/invitation', { token: tokenA }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      call('/api/rsvp', {
        token: tokenA,
        status: 'declined',
        childrenCount: 0,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await call('/api/invitation', { token: guest.token })).body,
    ).toMatchObject({ status: 'attending' });
  });
  it('rejects bad IDs and reports nonexistent guests', async () => {
    await expect(
      call('/api/admin/rotate', { id: 'bad' }, admin),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      call(
        '/api/admin/rotate',
        { id: '00000000-0000-0000-0000-000000000000' },
        admin,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      call('/api/admin/guests', { id: 'bad' }, { ...admin, method: 'DELETE' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      call(
        '/api/admin/guests',
        { id: '00000000-0000-0000-0000-000000000000' },
        { ...admin, method: 'DELETE' },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('CSV safety', () => {
  it.each(['=SUM(1,2)', '+1', '-1', '@cmd', '  =1', '\t=1', '\r=1', '\ntext'])(
    'neutralizes formulas/control prefixes %j',
    async (value) => {
      const csv = guestsCsv([
        { ...repo.guests[0], name: value, message: value },
      ]);
      expect(csv).toContain(`"'${value}"`);
      expect(csv).not.toContain(tokenA);
    },
  );
  it('escapes quotes, commas and newlines and exports attending children', async () => {
    await repo.reply(tokenA, {
      status: 'attending',
      childrenCount: 3,
      message: 'A "wish",\nwith love',
    });
    const result = await call('/api/admin/export', undefined, admin);
    expect(result.body).toContain('"A ""wish"",\nwith love"');
    expect(result.body).toContain('"attending","3"');
    expect(result.body).toContain('"pending","0"');
    expect(result.body).not.toContain(tokenA);
    expect(result.headers?.['Content-Type']).toContain('text/csv');
  });
});
