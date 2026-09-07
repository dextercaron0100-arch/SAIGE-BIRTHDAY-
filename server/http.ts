import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  ApiError,
  allowedMethods,
  execute,
  type Dependencies,
} from './service.js';
import { createRepository } from './supabase.js';

const MAX_BYTES = 8192;
type Request = IncomingMessage & { body?: unknown };
async function readBody(req: Request) {
  const length = req.headers['content-length'];
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES))
    throw new ApiError(413, 'Request is too large.');
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? ''))
    throw new ApiError(415, 'Use application/json.');
  if (
    req.headers['content-encoding'] &&
    req.headers['content-encoding'] !== 'identity'
  )
    throw new ApiError(415, 'Compressed requests are not supported.');
  let raw: string;
  if (req.body !== undefined) {
    raw =
      typeof req.body === 'string'
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > MAX_BYTES)
      throw new ApiError(413, 'Request is too large.');
  } else {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_BYTES) {
        req.resume();
        throw new ApiError(413, 'Request is too large.');
      }
      chunks.push(buffer);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, 'Invalid JSON request.');
  }
}

export function createHandler(
  route: string,
  dependencies?: () => Dependencies,
) {
  return async (req: Request, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const method = req.method ?? 'GET';
      const methods = allowedMethods(route);
      if (!methods) throw new ApiError(404, 'Not found.');
      if (!methods.includes(method)) {
        res.setHeader('Allow', methods.join(', '));
        throw new ApiError(405, 'Method not allowed.');
      }
      const body =
        method === 'POST' || method === 'PATCH'
          ? await readBody(req)
          : undefined;
      const deps = dependencies?.() ?? {
        repo: createRepository(),
        organizers: (process.env.ORGANIZER_USER_IDS ?? '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      };
      const result = await execute(
        { route, method, body, authorization: req.headers.authorization },
        deps,
      );
      for (const [key, value] of Object.entries(result.headers ?? {}))
        res.setHeader(key, value);
      res.statusCode = result.status;
      res.end(
        typeof result.body === 'string'
          ? result.body
          : JSON.stringify(result.body),
      );
    } catch (error) {
      res.statusCode = error instanceof ApiError ? error.status : 500;
      res.end(
        JSON.stringify({
          error:
            error instanceof ApiError
              ? error.message
              : 'Something went wrong. Please try again.',
        }),
      );
    }
  };
}
