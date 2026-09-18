const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function apiRequest<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...init.headers },
    credentials: 'omit',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(response.status, typeof body.message === 'string' ? body.message : 'Request failed');
  }
  return response.json() as Promise<T>;
}
