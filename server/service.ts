import { randomBytes } from 'node:crypto';
import { event } from '../shared/event.js';
import type { Guest, Reply } from '../shared/types.js';
import { guestsCsv } from './csv.js';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Repository {
  find(token: string): Promise<Guest | null>;
  reply(
    token: string,
    reply: Reply,
    deadline: string | null,
  ): Promise<Guest | null>;
  list(): Promise<Guest[]>;
  create(name: string, token: string): Promise<Guest>;
  update(
    id: string,
    changes: Pick<Guest, 'name' | 'status' | 'children_count' | 'message'>,
  ): Promise<Guest | null>;
  remove(id: string): Promise<boolean>;
  rotate(id: string, token: string): Promise<Guest | null>;
  userId(jwt: string): Promise<string | null>;
}
export interface ApiInput {
  route: string;
  method: string;
  authorization?: string;
  body: unknown;
}
export interface ApiResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}
export interface Dependencies {
  repo: Repository;
  organizers: string[];
  deadline?: string | null;
  now?: () => number;
}
const tokenPattern = /^[a-f0-9]{64}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const newToken = () => randomBytes(32).toString('hex');

function object(value: unknown, keys: string[]) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw new ApiError(400, 'Invalid request fields.');
  return value as Record<string, unknown>;
}
function token(value: unknown): string {
  if (typeof value !== 'string' || !tokenPattern.test(value))
    throw new ApiError(
      400,
      'This invitation link is invalid. Please ask the family for your personal link.',
    );
  return value;
}
const routes: Record<string, string[]> = {
  '/api/invitation': ['POST'],
  '/api/rsvp': ['POST'],
  '/api/admin/guests': ['GET', 'POST', 'PATCH', 'DELETE'],
  '/api/admin/rotate': ['POST'],
  '/api/admin/export': ['GET'],
};
export function allowedMethods(route: string) {
  return routes[route];
}

export async function execute(
  input: ApiInput,
  deps: Dependencies,
): Promise<ApiResult> {
  const methods = routes[input.route];
  if (!methods) throw new ApiError(404, 'Not found.');
  if (!methods.includes(input.method))
    return {
      status: 405,
      body: { error: 'Method not allowed.' },
      headers: { Allow: methods.join(', ') },
    };
  const { repo } = deps;
  const deadline =
    deps.deadline === undefined ? event.rsvpDeadline : deps.deadline;
  const closed =
    !!deadline && (deps.now?.() ?? Date.now()) >= Date.parse(deadline);
  const publicGuest = (g: Guest) => ({
    name: g.name,
    status: g.status,
    childrenCount: g.children_count,
    message: g.message,
    deadline,
    closed,
  });

  if (input.route.startsWith('/api/admin/')) {
    const match = /^Bearer (\S+)$/i.exec(input.authorization ?? '');
    if (!match) throw new ApiError(401, 'Please sign in to continue.');
    const id = await repo.userId(match[1]);
    if (!id)
      throw new ApiError(
        401,
        'Your session has expired. Please sign in again.',
      );
    if (!deps.organizers.includes(id))
      throw new ApiError(403, 'This account does not have organizer access.');
    if (input.route === '/api/admin/export')
      return {
        status: 200,
        body: guestsCsv(await repo.list()),
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="valyria-rsvps.csv"',
        },
      };
    if (input.route === '/api/admin/guests' && input.method === 'GET')
      return { status: 200, body: { guests: await repo.list() } };
    if (input.route === '/api/admin/guests' && input.method === 'POST') {
      const b = object(input.body, ['name']);
      if (
        typeof b.name !== 'string' ||
        !b.name.trim() ||
        b.name.trim().length > 120 ||
        /[\u0000-\u001f\u007f]/.test(b.name)
      )
        throw new ApiError(
          400,
          'Enter a guest name between 1 and 120 characters, without control characters.',
        );
      return {
        status: 201,
        body: { guest: await repo.create(b.name.trim(), newToken()) },
      };
    }
    if (input.route === '/api/admin/guests' && input.method === 'DELETE') {
      const b = object(input.body, ['id']);
      if (typeof b.id !== 'string' || !uuidPattern.test(b.id))
        throw new ApiError(400, 'Invalid guest ID.');
      if (!(await repo.remove(b.id)))
        throw new ApiError(404, 'Guest not found.');
      return { status: 200, body: { deleted: true } };
    }
    if (input.route === '/api/admin/guests') {
      const b = object(input.body, [
        'id',
        'name',
        'status',
        'childrenCount',
        'message',
      ]);
      if (typeof b.id !== 'string' || !uuidPattern.test(b.id))
        throw new ApiError(400, 'Invalid guest ID.');
      if (
        typeof b.name !== 'string' ||
        !b.name.trim() ||
        b.name.trim().length > 120 ||
        /[\u0000-\u001f\u007f]/.test(b.name)
      )
        throw new ApiError(
          400,
          'Enter a guest name between 1 and 120 characters, without control characters.',
        );
      if (
        b.status !== 'pending' &&
        b.status !== 'attending' &&
        b.status !== 'declined'
      )
        throw new ApiError(400, 'Choose a valid response status.');
      if (
        !Number.isInteger(b.childrenCount) ||
        (b.childrenCount as number) < 0 ||
        (b.childrenCount as number) > 20 ||
        (b.status !== 'attending' && b.childrenCount !== 0)
      )
        throw new ApiError(400, 'Choose a valid number of children.');
      if (
        typeof b.message !== 'string' ||
        b.message.length > 500 ||
        /[\u0000\u000b\u000c]/.test(b.message)
      )
        throw new ApiError(
          400,
          'The birthday message must be 500 characters or fewer and contain no invalid control characters.',
        );
      const guest = await repo.update(b.id, {
        name: b.name.trim(),
        status: b.status,
        children_count: b.childrenCount as number,
        message: b.message,
      });
      if (!guest) throw new ApiError(404, 'Guest not found.');
      return { status: 200, body: { guest } };
    }
    const b = object(input.body, ['id']);
    if (typeof b.id !== 'string' || !uuidPattern.test(b.id))
      throw new ApiError(400, 'Invalid guest ID.');
    const guest = await repo.rotate(b.id, newToken());
    if (!guest) throw new ApiError(404, 'Guest not found.');
    return { status: 200, body: { guest } };
  }

  const b = object(
    input.body,
    input.route === '/api/rsvp'
      ? ['token', 'status', 'childrenCount', 'message']
      : ['token'],
  );
  const invitationToken = token(b.token);
  if (input.route === '/api/invitation') {
    const guest = await repo.find(invitationToken);
    if (!guest)
      throw new ApiError(
        404,
        'This invitation link is invalid or has been replaced. Please contact the family.',
      );
    return { status: 200, body: publicGuest(guest) };
  }
  if (b.status !== 'attending' && b.status !== 'declined')
    throw new ApiError(400, 'Please choose an attendance response.');
  if (
    !Number.isInteger(b.childrenCount) ||
    (b.childrenCount as number) < 0 ||
    (b.childrenCount as number) > 20 ||
    (b.status === 'declined' && b.childrenCount !== 0)
  )
    throw new ApiError(400, 'Please choose a valid number of children.');
  if (
    b.message !== undefined &&
    (typeof b.message !== 'string' ||
      b.message.length > 500 ||
      /[\u0000\u000b\u000c]/.test(b.message))
  )
    throw new ApiError(
      400,
      'Your message must be 500 characters or fewer and contain no invalid control characters.',
    );
  if (closed)
    throw new ApiError(
      409,
      'The RSVP deadline has passed. Please contact the family.',
    );
  const guest = await repo.reply(
    invitationToken,
    {
      status: b.status,
      childrenCount: b.childrenCount as number,
      message: (b.message as string | undefined) ?? '',
    },
    deadline,
  );
  if (!guest)
    throw new ApiError(
      404,
      'This invitation link is invalid or has been replaced. Please contact the family.',
    );
  return { status: 200, body: publicGuest(guest) };
}
