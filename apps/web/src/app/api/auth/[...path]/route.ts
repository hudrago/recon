const developmentApiUrl = 'http://localhost:3001';

export async function proxyAuthRequest(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const apiUrl = process.env.API_URL ?? developmentApiUrl;
  const targetUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, apiUrl);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    redirect: 'manual',
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}

export const GET = proxyAuthRequest;
export const POST = proxyAuthRequest;