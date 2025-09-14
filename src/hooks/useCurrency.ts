import { useState, useCallback, useEffect } from 'react';
import { CurrencyCode } from '@/types/database';
import { DEFAULT_CURRENCY, getCurrencyConfig, isSupportedCurrency } from '@/config/currencies';
import { formatPrice } from '@/utils/currency';

export const useCurrency = () => {
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() => {
    // Try to get currency from URL params first
    const urlParams = new URLSearchParams(window.location.search);
    const urlCurrency = urlParams.get('currency');
    
    if (urlCurrency && isSupportedCurrency(urlCurrency)) {
      return urlCurrency;
    }
    
    // Then try localStorage
    const storedCurrency = localStorage.getItem('selectedCurrency');
    if (storedCurrency && isSupportedCurrency(storedCurrency)) {
      return storedCurrency;
    }
    
    return DEFAULT_CURRENCY;
  });

  const setCurrency = useCallback((currency: CurrencyCode) => {
    setSelectedCurrency(currency);
    localStorage.setItem('selectedCurrency', currency);
    
    // Update URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.set('currency', currency);
    window.history.replaceState({}, '', url.toString());
  }, []);

  const formatCurrencyPrice = useCallback((amount: number) => {
    return formatPrice(amount, selectedCurrency);
  }, [selectedCurrency]);

  const getCurrentConfig = useCallback(() => {
    return getCurrencyConfig(selectedCurrency);
  }, [selectedCurrency]);

  // Update URL on mount if currency was loaded from localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCurrency = urlParams.get('currency');
    
    if (!urlCurrency || urlCurrency !== selectedCurrency) {
      const url = new URL(window.location.href);
      url.searchParams.set('currency', selectedCurrency);
      window.history.replaceState({}, '', url.toString());
    }
  }, [selectedCurrency]);

  return {
    selectedCurrency,
    setCurrency,
    formatPrice: formatCurrencyPrice,
    getCurrencyConfig: getCurrentConfig,
  };
};