import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Check } from "lucide-react";
import { useAuth, useUser } from '@clerk/clerk-react';
import { createMultiCurrencyCheckoutSession, prepareMultiCurrencyCheckoutData } from '@/utils/stripe/checkout';
import { CurrencyCode } from '@/types/database';

export default function PricingSection() {
  const { getToken } = useAuth();
  const { user, isSignedIn } = useUser();

  const handleProCheckout = async () => {
    if (!isSignedIn) {
      window.location.href = '/sign-up?plan=pro&billing=monthly&currency=EUR';
      return;
    }

    if (!user?.id) {
      console.error('User not available');
      return;
    }

    try {
      // Initialize user if needed
      const token = await getToken();
      await fetch('/api/user/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          planType: 'pro'
        }),
      });

      const checkoutData = prepareMultiCurrencyCheckoutData(
        'pro',
        'monthly',
        'EUR' as CurrencyCode,
        user.id,
        1
      );

      const result = await createMultiCurrencyCheckoutSession(checkoutData);
      if (result.success) {
        const typedResult = result as { success: boolean; url?: string; sessionId?: string };
        if (typedResult.url) {
          window.location.href = typedResult.url;
        } else if (typedResult.sessionId) {
          // Fallback for mock or sessionId-only responses
          const stripeResult = await fetch('/api/stripe/session-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: typedResult.sessionId }),
          });
          const sessionData = await stripeResult.json();
          if (sessionData.url) {
            window.location.href = sessionData.url;
          }
        }
      } else {
        console.error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error initiating checkout:', error);
    }
  };

  return (
    <section id="pricing" className="pt-4 md:pt-8 pb-16 md:pb-32" style={{ backgroundColor: '#0F1629' }}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="mt-4 grid gap-6 md:mt-8 md:grid-cols-2 max-w-4xl mx-auto">
        <Card className="relative border-white/10 bg-white/5 backdrop-blur-sm shadow-lg">
          <span
            className="absolute inset-x-0 -top-3 mx-auto flex h-6 w-fit items-center rounded-full px-3 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/20"
            style={{ backgroundColor: '#1E4ED8' }}
          >
            POPULAR
          </span>

          <div className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-white">PRO</CardTitle>
              <div className="mt-4 space-y-1">
                <span className="text-3xl font-bold text-white block">€20</span>
                <span className="text-sm text-gray-400">per user/month</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 flex-grow">
              <Button onClick={handleProCheckout} className="w-full bg-blue-700 hover:bg-blue-600 text-white font-medium py-6">
                Start 7-day free trial
              </Button>
              
              <div className="pt-2">
                <ul className="list-outside space-y-3 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <Check className="size-4 mt-0.5 text-blue-500 flex-shrink-0" />
                    <span>Unlimited Agent Requests</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="size-4 mt-0.5 text-blue-500 flex-shrink-0" />
                    <span>Unlimited Tab Completions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="size-4 mt-0.5 text-blue-500 flex-shrink-0" />
                    <span>500 Credits Per Month (Billed at API Costs)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="size-4 mt-0.5 text-blue-500 flex-shrink-0" />
                    <span>Maximum Context Windows</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="size-4 mt-0.5 text-blue-500 flex-shrink-0" />
                    <span>Access to +400 Models (Including Free and Local Ones)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="size-4 mt-0.5 text-blue-500 flex-shrink-0" />
                    <span>Zero Data Retention</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </div>
        </Card>

        <Card className="flex flex-col border-white/10 bg-white/5 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-white">TEAMS</CardTitle>
            <div className="mt-4 space-y-1">
              <span className="text-3xl font-bold text-white block">€30</span>
              <span className="text-sm text-gray-400">per user/month</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 flex-grow">
            <Button onClick={() => window.location.href = 'mailto:mathys@softcodes.io'} className="w-full bg-blue-700 hover:bg-blue-600 text-white font-medium py-6">
              Contact Us
            </Button>

            <div className="pt-2">
              <p className="text-sm text-gray-400 mb-4">Everything in Pro, plus:</p>
              <ul className="list-outside space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <Check className="size-4 mt-0.5 text-blue-500 flex-shrink-0" />
                  <span>Centralized Billing</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-4 mt-0.5 text-blue-500 flex-shrink-0" />
                  <span>SSO Available (+$10 per user/month)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-4 mt-0.5 text-blue-500 flex-shrink-0" />
                  <span>User-Role Assignment and User Management</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-4 mt-0.5 text-blue-500 flex-shrink-0" />
                  <span>Pooled Credit Base</span>
                </li>
              </ul>
              <p className="text-sm text-gray-400 mt-4">And more...</p>
            </div>
          </CardContent>
        </Card>
    </div>
      </div>
    </section>
  );
}