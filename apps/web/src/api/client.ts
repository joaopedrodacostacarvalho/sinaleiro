import { auth } from "../auth/firebase";

const rawApiUrl = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');

function normalizarBaseUrl(url: string): string {
  if (!url) return 'http://localhost:3000/v1';
  if (url.endsWith('/v1')) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
    return `${url}/v1`;
  }
  return 'http://localhost:3000/v1';
}

const API_BASE_URL = normalizarBaseUrl(rawApiUrl);
const DEFAULT_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  readonly status: number;

  constructor(
    status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface ApiRequestOptions extends RequestInit {
  timeOutMs?: number;
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { timeOutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;

  await auth.authStateReady();
  const user = auth.currentUser;
  const baseHeaders = new Headers(fetchOptions.headers);

  if (!baseHeaders.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {

    baseHeaders.set('Content-Type', 'application/json');
  }

  const shouldAttachFirebaseToken = Boolean(user && !baseHeaders.has('Authorization'));

  const executeRequest = async (forceRefresh = false): Promise<Response> => {
    const headers = new Headers(baseHeaders);

    if (shouldAttachFirebaseToken && user) {
      const token = await user.getIdToken(forceRefresh);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
    }

    const timeOutSignal = AbortSignal.timeout(timeOutMs);
    const signal = fetchOptions.signal
      ? AbortSignal.any([fetchOptions.signal, timeOutSignal])
      : timeOutSignal;

    return fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
      signal,
    });

  }

  const response = await (async (): Promise<Response> => {
    try {
      const initial = await executeRequest(false);
      if (initial.status === 401 && shouldAttachFirebaseToken) {
        return await executeRequest(true);
      }
      return initial;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new ApiError(408, `Request timed out after ${timeOutMs}ms`);
      }
      throw error;
    }
  })();

  if (!response.ok) {
    const text = await response.text();
    let message = text || response.statusText || `HTTP Error ${response.status}`;
    try {
      const body = JSON.parse(text);
      const raw = body.message ?? body.error ?? text;
      message = Array.isArray(raw) ? raw.join(', ') : String(raw);
    } catch {
      // Reponse wasn't JSON; keep text/statusText fallback
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
