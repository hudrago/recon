import { Sparkles } from 'lucide-react';
import type { ApiCaseBrief } from '@/lib/api';

interface CaseBriefProps {
  brief: ApiCaseBrief | null;
  title: string;
  aiMarker: string;
  recommendationLabel: string;
  rationaleLabel: string;
}

// AI-generated, advisory only — never renders anything actionable itself; the operator still
// approves/dismisses/executes through CaseActions. Renders nothing if `brief` is null, so a
// disabled or failing AI gateway never breaks the case page (see lib/api.ts's getCaseBrief).
export function CaseBrief({ brief, title, aiMarker, recommendationLabel, rationaleLabel }: CaseBriefProps) {
  if (!brief) return null;
  return (
    <section className="case-panel" aria-labelledby="brief-title">
      <div className="case-panel-title">
        <Sparkles size={18} aria-hidden="true" />
        <h2 id="brief-title">{title}</h2>
        <span className="status-badge">{aiMarker}</span>
      </div>
      <p>{brief.summary}</p>
      <dl className="context-list">
        <div>
          <dt>{recommendationLabel}</dt>
          <dd>{brief.recommendation}</dd>
        </div>
        <div>
          <dt>{rationaleLabel}</dt>
          <dd>{brief.rationale}</dd>
        </div>
      </dl>
    </section>
  );
}
