import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { useAuth, useUser, useOrganization } from '@clerk/clerk-react';
import { createOrganizationSubscription } from '@/utils/organization/billing';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Check, Minus, Plus } from "lucide-react";
import { createMultiCurrencyCheckoutSession, prepareMultiCurrencyCheckoutData } from '@/utils/stripe/checkout';
import { CurrencyCode } from '@/types/database';
import { useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";


export default function PricingSection() {
  const { getToken } = useAuth();
  const { user, isSignedIn } = useUser();
  const [seats, setSeats] = useState(3);

  const handleProCheckout = async () => {
    // Track Reddit Pixel SignUp Event (trial intent)
    if (window.rdt) {
      window.rdt('track', 'SignUp');
      console.log('Reddit Pixel: SignUp event tracked (trial start intent)');
    }

    if (!isSignedIn) {
      // Small delay to ensure pixel event fires before navigation
      setTimeout(() => {
        window.location.href = '/sign-up?plan=pro&billing=monthly&currency=EUR';
      }, 300);
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
          // Small delay to ensure pixel event fires before navigation
          setTimeout(() => {
            window.location.href = typedResult.url!;
          }, 300);
        } else if (typedResult.sessionId) {
          // Fallback for mock or sessionId-only responses
          const stripeResult = await fetch('/api/stripe/session-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: typedResult.sessionId }),
          });
          const sessionData = await stripeResult.json();
          if (sessionData.url) {
            setTimeout(() => {
              window.location.href = sessionData.url;
            }, 300);
          }
        }
      } else {
        console.error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error initiating checkout:', error);
    }
  };
  
  const handleTeamsCheckout = async () => {
    // Track Reddit Pixel SignUp Event (trial intent)
    if (window.rdt) {
      window.rdt('track', 'SignUp');
      console.log('Reddit Pixel: SignUp event tracked (teams trial start intent)');
    }
  
    if (!isSignedIn) {
      // Small delay to ensure pixel event fires before navigation
      setTimeout(() => {
        window.location.href = `/sign-up?plan=teams&billing=monthly&seats=${seats}&currency=EUR`;
      }, 300);
      return;
    }
  
    const { organization } = useOrganization();
    if (!organization) {
      // Redirect to create organization
      setTimeout(() => {
        window.location.href = `/organization/new?plan=teams&billing=monthly&seats=${seats}&currency=EUR`;
      }, 300);
      return;
    }
  
    // Check if user is admin
    const { memberships } = useOrganization();
    const currentMembership = memberships?.data?.find(m => m.publicUserData?.userId === user.id);
    if (currentMembership?.role !== 'org:admin') {
      alert('Only organization admins can manage subscriptions. Please contact your admin.');
      return;
    }
  
    if (!user?.id || !organization.id) {
      console.error('User or organization not available');
      return;
    }
  
    try {
      // Initialize user/org if needed (optional for teams)
      const token = await getToken();
      await fetch('/api/user/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          planType: 'teams'
        }),
      });
  
      const result = await createOrganizationSubscription({
        clerk_org_id: organization.id,
        plan_type: 'teams',
        billing_frequency: 'monthly',
        seats_total: seats,
      }, token);
  
      if (result.success && result.checkout_url) {
        // Small delay to ensure pixel event fires before navigation
        setTimeout(() => {
          window.location.href = result.checkout_url!;
        }, 300);
      } else {
        console.error('Failed to create teams checkout session');
      }
    } catch (error) {
      console.error('Error initiating teams checkout:', error);
    }
  };

  return (
    <section id="pricing" className="pt-4 md:pt-8 pb-16 md:pb-32">
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
              <span className="text-3xl font-bold text-white block">€40</span>
              <span className="text-sm text-gray-400">per user/month</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 flex-grow">
            <div className="py-4 flex items-center justify-between">
              <Label htmlFor="seats" className="text-white">Number of seats</Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  onClick={() => setSeats(Math.max(3, seats - 1))}
                  disabled={seats <= 3}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="seats"
                  type="number"
                  min={3}
                  max={100}
                  value={seats}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) setSeats(Math.max(3, Math.min(100, val)));
                  }}
                  className="w-16 h-8 bg-white/10 border-white/20 text-white text-center p-0"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  onClick={() => setSeats(Math.min(100, seats + 1))}
                  disabled={seats >= 100}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button onClick={handleTeamsCheckout} className="w-full bg-blue-700 hover:bg-blue-600 text-white font-medium py-6">
              Start 14-day free trial
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
                  <span>Seat-Based Pricing (min. 3 seats)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-4 mt-0.5 text-blue-500 flex-shrink-0" />
                  <span>Admin Dashboard & User Management</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-4 mt-0.5 text-blue-500 flex-shrink-0" />
                  <span>Role-Based Access Control</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="size-4 mt-0.5 text-blue-500 flex-shrink-0" />
                  <span>Priority Support</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
    </div>
      </div>
    </section>
  );
}