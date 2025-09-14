import React from 'react';
import { CurrencyCode } from '@/types/database';
import { getAllCurrencies } from '@/config/currencies';
import { useCurrency } from '@/hooks/useCurrency';

interface CurrencySelectorProps {
  className?: string;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({ 
  className = '' 
}) => {
  const { selectedCurrency, setCurrency } = useCurrency();
  const currencies = getAllCurrencies();

  return (
    <div className={`flex items-center bg-gray-800 rounded-lg p-1 border border-gray-600 ${className}`}>
      {currencies.map((currency) => (
        <button
          key={currency.code}
          onClick={() => setCurrency(currency.code)}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2 ${
            selectedCurrency === currency.code
              ? "bg-white text-black"
              : "text-gray-300 hover:text-white hover:bg-gray-700"
          }`}
          aria-label={`Select ${currency.code} currency`}
        >
          <span 
            className="text-base" 
            role="img" 
            aria-label={`${currency.code} flag`}
          >
            {currency.flag}
          </span>
          <span className="font-semibold">{currency.code}</span>
        </button>
      ))}
    </div>
  );
};

export default CurrencySelector;