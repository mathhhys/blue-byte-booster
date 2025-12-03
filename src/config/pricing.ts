import { MultiCurrencyPrice } from '@/types/database';

export const MULTI_CURRENCY_PRICING: Record<'pro' | 'teams', MultiCurrencyPrice> = {
  pro: {
    EUR: {
      monthly: 20,
      yearly: 192,
      priceIds: {
        monthly: 'price_1RvK8KH6gWxKcaTXO4AlW0MQ',
        yearly: 'price_1RvK8LH6gWxKcaTXqqNXiuus'
      }
    }
  },
  teams: {
    EUR: {
      monthly: 40,
      yearly: 288,
      priceIds: {
        monthly: 'price_1RwN6oH6gWxKcaTXgmKllDYt',
        yearly: 'price_1RwN8QH6gWxKcaTX7thDBBm7'
      }
    }
  }
};

export const getMultiCurrencyPricing = () => MULTI_CURRENCY_PRICING;