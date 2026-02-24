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
        monthly: 'price_1SaINqH6gWxKcaTXAKZ5CoWW',
        yearly: 'price_After checkout from Teams plans, the user will need to create an organization via Clerk where the subscriptions they have just purchased will become seats for the organization. They can then invite their colleagues via the Clerk elements already present on the site. Everything must be well coordinated with the current implementation.1RwN8QH6gWxKcaTX7thDBBm7'
      }
    }
  }
};

export const getMultiCurrencyPricing = () => MULTI_CURRENCY_PRICING;