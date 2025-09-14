import { CurrencyConfig, CurrencyCode } from '@/types/database';

export const SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  EUR: {
    code: 'EUR',
    symbol: '€',
    flag: '🇪🇺',
    locale: 'de-DE',
    isDefault: true
  },
  USD: {
    code: 'USD',
    symbol: '$',
    flag: '🇺🇸',
    locale: 'en-US'
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    flag: '🇬🇧',
    locale: 'en-GB'
  }
};

export const DEFAULT_CURRENCY: CurrencyCode = 'EUR';

export const getCurrencyConfig = (code: CurrencyCode): CurrencyConfig => {
  return SUPPORTED_CURRENCIES[code];
};

export const getAllCurrencies = (): CurrencyConfig[] => {
  return Object.values(SUPPORTED_CURRENCIES);
};

export const isSupportedCurrency = (currency: string): currency is CurrencyCode => {
  return ['EUR', 'USD', 'GBP'].includes(currency);
};