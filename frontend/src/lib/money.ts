import type { Currency } from './types';

/** Символ валюты компании (Настройки → «Валюта и точность»). */
export const CURRENCY_SYMBOL: Record<Currency, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  KZT: '₸',
  UZS: 'сум',
};

export const CURRENCIES: Currency[] = ['RUB', 'USD', 'EUR', 'KZT', 'UZS'];

/**
 * «12 500 ₽» — денежный формат как в дизайне. Валюта берётся из workspace;
 * числа не пересчитываются при её смене — меняется только формат.
 */
export function formatMoney(value: number, currency: Currency = 'RUB'): string {
  const amount = Math.round(value).toLocaleString('ru-RU');
  return currency === 'USD' || currency === 'EUR'
    ? `${CURRENCY_SYMBOL[currency]}${amount}`
    : `${amount} ${CURRENCY_SYMBOL[currency]}`;
}

/** «₽/ч» — подпись ставки в валюте компании. */
export function ratePerHour(currency: Currency = 'RUB'): string {
  return `${CURRENCY_SYMBOL[currency]}/ч`;
}

/** Округление часов до шага (15/30 мин) для клиентских отчётов и счетов. */
export function roundHours(hours: number, roundingMinutes: number): number {
  if (!roundingMinutes) return hours;
  const step = roundingMinutes / 60;
  return Math.ceil(hours / step) * step;
}
