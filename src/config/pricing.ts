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
    },
    USD: {
      monthly: 20,
      yearly: 192,
      priceIds: {
        monthly: 'price_1RvK8KH6gWxKcaTXCWyv035N',
        yearly: 'price_1RvK8KH6gWxKcaTXEn1S0Lql'
      }
    },
    GBP: {
      monthly: 16,
      yearly: 150,
      priceIds: {
        monthly: 'price_1RvK8KH6gWxKcaTXQvGGVCNI',
        yearly: 'price_1RvK8KH6gWxKcaTXYTeJ18no'
      }
    }
  },
  teams: {
    EUR: {
      monthly: 30,
      yearly: 288,
      priceIds: {
        monthly: 'price_1RwN6oH6gWxKcaTXgmKllDYt',
        yearly: 'price_1RwN8QH6gWxKcaTX7thDBBm7'
      }
    },
    USD: {
      monthly: 30,
      yearly: 288,
      priceIds: {
        monthly: 'price_1RwN7VH6gWxKcaTXHVkwwT60',
        yearly: 'price_1RwN8hH6gWxKcaTXEaGbVvhz'
      }
    },
    GBP: {
      monthly: 24,
      yearly: 225,
      priceIds: {
        monthly: 'price_1RwN7uH6gWxKcaTX0jJCR7uU',
        yearly: 'price_1RwN9FH6gWxKcaTXQBUURC9T'
      }
    }
  }
};

export const getMultiCurrencyPricing = () => MULTI_CURRENCY_PRICING;