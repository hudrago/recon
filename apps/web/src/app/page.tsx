import Link from 'next/link';
import { DEFAULT_SEVERITY_BY_CODE, SEVERITY_COLOR } from '@recon/ui';
import { listExceptions } from '@/lib/api';
import { requireActiveOrganization } from '@/lib/session';

export default async function Home() {
  const { orgId } = await requireActiveOrganization();
  const exceptions = await listExceptions(orgId);

  return (
    <main className="min-h-screen bg-background p-8 text-text-primary sm:p-12">
      <h1 className="mb-8 text-2xl font-bold">Operations Inbox</h1>
      {exceptions.length === 0 ? (
        <p className="text-text-secondary">No open exceptions.</p>
      ) : (
        <div className="flex max-w-xl flex-col gap-4">
          {exceptions.map((exception) => {
            const severity = DEFAULT_SEVERITY_BY_CODE[exception.code] ?? 'LOW';
            return (
              <Link
                key={exception.id}
                href={`/exceptions/${exception.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface p-6 transition hover:border-accent"
              >
                <div>
                  <span
                    className="mb-2 inline-block rounded-pill px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: SEVERITY_COLOR[severity] }}
                  >
                    {severity}
                  </span>
                  <p className="text-sm text-text-secondary">
                    {exception.code} · {exception.orderId}
                  </p>
                </div>
                <p className="text-sm text-text-secondary">{new Date(exception.detectedAt).toLocaleString('pt-PT')}</p>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
