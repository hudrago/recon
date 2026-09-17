import { History } from 'lucide-react';
import type { ApiAuditLogItem } from '@/lib/api';
import type { Locale } from '@/lib/i18n';
import { actionKindLabel, statusLabel } from '@/lib/presentation';

interface CaseTimelineProps {
  entries: ApiAuditLogItem[];
  locale: Locale;
  title: string;
  emptyLabel: string;
}

export function CaseTimeline({ entries, locale, title, emptyLabel }: CaseTimelineProps) {
  return (
    <section className="case-panel" aria-labelledby="timeline-title">
      <div className="case-panel-title"><History size={18} aria-hidden="true" /><h2 id="timeline-title">{title}</h2></div>
      {entries.length === 0 ? (
        <p className="decision-intro">{emptyLabel}</p>
      ) : (
        <ol className="timeline-list">
          {entries.map((entry, index) => (
            <li key={index} className="timeline-item">
              <div className="timeline-meta">
                <span className="timeline-actor">{entry.actor}</span>
                <span className="timeline-at">
                  {new Date(entry.at).toLocaleString(locale === 'pt' ? 'pt-PT' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              {entry.statusBefore && entry.statusAfter && (
                <p className="timeline-transition">{statusLabel(locale, entry.statusBefore)} → {statusLabel(locale, entry.statusAfter)}</p>
              )}
              <p className="timeline-reason">{entry.reason}</p>
              {entry.actionKind && <span className="tag timeline-tag">{actionKindLabel(locale, entry.actionKind)}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
