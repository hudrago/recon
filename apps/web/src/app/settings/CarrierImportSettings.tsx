'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { UploadCloud } from 'lucide-react';
import { usePreferences } from '@/components/PreferencesProvider';
import { uploadCarrierCsv, type CarrierCsvResult } from './actions';

export function CarrierImportSettings({ orgId }: { orgId: string }) {
  const { t } = usePreferences();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CarrierCsvResult | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setPending(true);
    const csv = await file.text();
    const response = await uploadCarrierCsv(orgId, csv);
    setPending(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (response.error || !response.data) {
      setError(response.error ?? t('settings.carrier.error'));
      return;
    }
    setResult(response.data);
  }

  return (
    <section className="members-panel" aria-labelledby="carrier-title">
      <div>
        <p className="eyebrow">{t('settings.carrier.eyebrow')}</p>
        <h2 id="carrier-title">{t('settings.carrier.title')}</h2>
        <p>{t('settings.carrier.description')}</p>
      </div>
      <div className="member-row">
        <label className="button button-secondary" htmlFor="carrier-csv-input">
          <UploadCloud size={16} aria-hidden="true" /> {pending ? t('common.processing') : t('settings.carrier.upload')}
        </label>
        <input
          ref={fileInputRef}
          id="carrier-csv-input"
          type="file"
          accept=".csv,text/csv"
          hidden
          disabled={pending}
          onChange={handleFile}
        />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {result && (
        <div className="member-row">
          <p>{t('settings.carrier.result', { accepted: result.accepted, exceptions: result.exceptionsCreated })}</p>
        </div>
      )}
      {result && result.errors.length > 0 && (
        <div className="member-row">
          <ul className="carrier-errors">
            {result.errors.map((line, index) => <li key={index}>{line}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
