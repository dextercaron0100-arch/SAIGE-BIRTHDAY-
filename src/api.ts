export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  body?: unknown,
  jwt?: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new RequestError(
      0,
      'We could not connect. Check your connection and try again.',
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new RequestError(
      response.status,
      data?.error ?? 'The invitation service is unavailable. Please try again.',
    );
  if (!data)
    throw new RequestError(
      502,
      'The invitation service returned an unexpected response. Please try again.',
    );
  return data as T;
}
