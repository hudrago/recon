import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResendMailer } from './resendMailer';

describe('ResendMailer', () => {
  let mailer: ResendMailer;

  beforeEach(() => {
    mailer = new ResendMailer('resend_key_test', 'Recon <no-reply@recon.example>');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the email to the Resend API with the configured sender and bearer token', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);

    await mailer.send({ to: 'operator@example.com', subject: 'Hello', html: '<p>Hi</p>' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer resend_key_test' });
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'Recon <no-reply@recon.example>',
      to: 'operator@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
    });
  });

  it('throws when Resend responds with a non-ok status', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ ok: false, status: 422, statusText: 'Unprocessable Entity' } as Response);

    await expect(mailer.send({ to: 'operator@example.com', subject: 'Hello', html: '<p>Hi</p>' }))
      .rejects.toThrow('Resend send failed: 422 Unprocessable Entity');
  });
});
