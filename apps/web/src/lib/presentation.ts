import type { Locale, MessageKey } from './i18n';
import { translate } from './i18n';

export function exceptionLabel(locale: Locale, code: string) {
  return translateKnown(locale, `presentation.exception.${code}`, code);
}

export function exceptionDescription(locale: Locale, code: string) {
  return translateKnown(locale, `presentation.description.${code}`, '');
}

export function statusLabel(locale: Locale, status: string) {
  return translateKnown(locale, `presentation.status.${status}`, status);
}

export function severityLabel(locale: Locale, severity: string) {
  return translateKnown(locale, `presentation.severity.${severity}`, severity);
}

export function actionKindLabel(locale: Locale, kind: string) {
  return translateKnown(locale, `presentation.actionKind.${kind}`, kind);
}

export function memberRoleLabel(locale: Locale, role: string) {
  return translateKnown(locale, `presentation.role.${role}`, role);
}

export function billingStatusLabel(locale: Locale, status: string) {
  return translateKnown(locale, `billing.status.${status}`, status);
}

export function readableContextKey(key: string, locale: Locale = 'pt') {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').toLocaleLowerCase(locale === 'pt' ? 'pt-PT' : 'en');
}

function translateKnown(locale: Locale, key: string, fallback: string) {
  return translate(locale, key as MessageKey) || fallback;
}