// Same-origin calls to the Worker (worker/index.ts). The session is an HttpOnly
// cookie, so there is no token to attach.

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: 'same-origin',
    signal: init.signal,
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!response.ok) {
    const body = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(body.error || body.message || `HTTP ${response.status}: ${response.statusText}`, response.status);
  }
  return data as T;
}

/** Notion proxy payloads are untyped JSON; callers pick the fields they need. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NotionPayload = any;

/** Calls one of the Notion proxies (worker/notion/routes.ts). */
export async function callEdgeFunction(functionName: string, body?: unknown, signal?: AbortSignal): Promise<NotionPayload> {
  if (signal?.aborted) throw new DOMException('Operation was aborted', 'AbortError');
  return api<NotionPayload>(`/api/notion/${functionName}`, { method: 'POST', body: body ?? {}, signal });
}
