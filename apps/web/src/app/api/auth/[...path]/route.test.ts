import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxyAuthRequest } from './route';

describe('auth proxy route', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('forwards the request to the runtime API URL', async () => {
    vi.stubEnv('API_URL', 'https://api.example.com');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', {
      status: 201,
      headers: { 'content-type': 'application/json', 'set-cookie': 'session=token; HttpOnly' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxyAuthRequest(new Request(
      'https://web.example.com/api/auth/sign-up/email?source=web',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://web.example.com' },
        body: '{"email":"operator@example.com"}',
      },
    ));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [target, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(target.href).toBe('https://api.example.com/api/auth/sign-up/email?source=web');
    expect(init.method).toBe('POST');
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"email":"operator@example.com"}');
    expect(new Headers(init.headers).get('origin')).toBe('https://web.example.com');
    expect(response.status).toBe(201);
    expect(response.headers.get('set-cookie')).toContain('session=token');
  });
});