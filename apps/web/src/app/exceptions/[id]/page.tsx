import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getException } from '@/lib/api';
import { requireActiveOrganization } from '@/lib/session';
import { CaseActions } from './CaseActions';

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId } = await requireActiveOrganization();
  const exception = await getException(orgId, id);
  if (!exception) notFound();

  return (
    <main className="min-h-screen bg-background p-8 text-text-primary sm:p-12">
      <Link href="/" className="text-sm text-text-secondary hover:text-accent">
        &larr; Back to inbox
      </Link>
      <h1 className="mb-2 mt-4 text-2xl font-bold">{exception.code}</h1>
      <p className="mb-8 text-sm text-text-secondary">
        Order {exception.orderId} · Status: {exception.status}
      </p>

      <div className="max-w-xl rounded-lg border border-border bg-surface p-6">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-text-secondary">Detected</dt>
          <dd>{new Date(exception.detectedAt).toLocaleString('pt-PT')}</dd>
          <dt className="text-text-secondary">Status</dt>
          <dd>{exception.status}</dd>
          <dt className="text-text-secondary">Context</dt>
          <dd className="break-all font-mono text-xs">{JSON.stringify(exception.context)}</dd>
        </dl>
      </div>

      <CaseActions orgId={orgId} exceptionId={exception.id} orderId={exception.orderId} status={exception.status} />
    </main>
  );
}
