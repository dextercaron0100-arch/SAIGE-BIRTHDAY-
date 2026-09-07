import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createHandler } from '../server/http';
import { MemoryRepository } from './helpers';

let server: Server, origin: string;
beforeAll(async () => {
  const repo = new MemoryRepository();
  await repo.create('Avery', 'a'.repeat(64));
  server = createServer(
    (req, res) =>
      void createHandler(
        new URL(req.url!, 'http://localhost').pathname,
        () => ({ repo, organizers: ['organizer-id'], deadline: null }),
      )(req, res),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
);
it('rejects unsupported methods with Allow and no-cache headers', async () => {
  const response = await fetch(`${origin}/api/rsvp`, { method: 'DELETE' });
  expect(response.status).toBe(405);
  expect(response.headers.get('allow')).toBe('POST');
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('rejects unknown API routes', async () => {
  expect((await fetch(`${origin}/api/missing`)).status).toBe(404);
});
it('rejects oversized JSON', async () => {
  const response = await fetch(`${origin}/api/rsvp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'a'.repeat(64), message: 'x'.repeat(9000) }),
  });
  expect(response.status).toBe(413);
});
it('rejects oversized streamed bodies without a Content-Length header', async () => {
  const status = await new Promise<number | undefined>((resolve, reject) => {
    const req = httpRequest(
      `${origin}/api/rsvp`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on('error', reject);
    req.write('x'.repeat(5000));
    req.end('x'.repeat(5000));
  });
  expect(status).toBe(413);
});
it('rejects unsupported content types and malformed JSON', async () => {
  expect(
    (await fetch(`${origin}/api/rsvp`, { method: 'POST', body: '{}' })).status,
  ).toBe(415);
  expect(
    (
      await fetch(`${origin}/api/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      })
    ).status,
  ).toBe(400);
});
it('serves isolated responses without caching', async () => {
  const response = await fetch(`${origin}/api/invitation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'a'.repeat(64) }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ name: 'Avery' });
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
});
it('reads JSON bodies for protected PATCH requests', async () => {
  const guests = await fetch(`${origin}/api/admin/guests`, {
    headers: { Authorization: 'Bearer organizer-session' },
  }).then((response) => response.json());
  const response = await fetch(`${origin}/api/admin/guests`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer organizer-session',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: guests.guests[0].id,
      name: 'Avery Rose',
      status: 'pending',
      message: '',
    }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    guest: { name: 'Avery Rose', status: 'pending' },
  });
});
