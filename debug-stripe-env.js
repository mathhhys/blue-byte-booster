// Debug script to test Stripe environment configuration
import { config } from 'dotenv';
config();

console.log('=== STRIPE ENV DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('STRIPE_SECRET_KEY present:', !!process.env.STRIPE_SECRET_KEY);
console.log('STRIPE_SECRET_KEY length:', process.env.STRIPE_SECRET_KEY?.length || 0);
console.log('STRIPE_SECRET_KEY starts with sk_:', process.env.STRIPE_SECRET_KEY?.startsWith('sk_'));

// Test if we can initialize Stripe
try {
  const { default: Stripe } = await import('stripe');
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  console.log('✅ Stripe initialized successfully');
} catch (error) {
  console.error('❌ Stripe initialization failed:', error.message);
}

console.log('=== ENV KEYS CONTAINING STRIPE ===');
Object.keys(process.env).filter(key => key.includes('STRIPE')).forEach(key => {
  console.log(`${key}: ${process.env[key]?.substring(0, 20)}...`);
});