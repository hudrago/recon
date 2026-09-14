// Pairs with the "amount" typography token (bold, tabular-nums) applied in CSS.
export function formatMoney(amount: number, currency: string, locale = 'pt-PT'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}
