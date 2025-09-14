import { CurrencyCode, CurrencyConfig } from '@/types/database';
import { SUPPORTED_CURRENCIES } from '@/config/currencies';

export const formatPrice = (
  amount: number,
  currency: CurrencyCode
): string => {
  const config = SUPPORTED_CURRENCIES[currency];
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const getCurrencySymbol = (currency: CurrencyCode): string => {
  return SUPPORTED_CURRENCIES[currency].symbol;
};

export const getCurrencyFlag = (currency: CurrencyCode): string => {
  return SUPPORTED_CURRENCIES[currency].flag;
};

export const getPriceDisplayText = (
  amount: number,
  currency: CurrencyCode,
  period: 'monthly' | 'yearly'
): string => {
  const formattedPrice = formatPrice(amount, currency);
  const periodText = period === 'monthly' ? '/mo' : '/yr';
  return `${formattedPrice}${periodText}`;
};

export const formatPriceOnly = (
  amount: number,
  currency: CurrencyCode
): string => {
  const config = SUPPORTED_CURRENCIES[currency];
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const getCurrencyLocale = (currency: CurrencyCode): string => {
  return SUPPORTED_CURRENCIES[currency].locale;
};