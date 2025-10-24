"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const pricingPlans = [
  {
    name: "Pro",
    price: "€20",
    period: "/month",
    description: "For professional developers building faster with AI assistance.",
    features: [
      "Unlimited AI completions",
      "Advanced code generation",
      "Multi-project support",
      "Priority support",
      "Code refactoring tools",
      "Custom AI training",
    ],
    cta: "Upgrade to Pro",
    highlighted: false,
  },
  {
    name: "Team",
    price: "Contact us",
    period: "",
    description: "For teams collaborating on code with shared AI resources.",
    features: [
      "Everything in Pro",
      "Team collaboration features",
      "Shared code snippets",
      "Usage analytics dashboard",
      "Admin controls",
      "Dedicated support",
    ],
    cta: "Start Team Plan",
    highlighted: true,
    badge: "Recommended",
  },
]

export function PricingSection() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();

  const handlePlanClick = (planName: string) => {
    if (planName === "Team") {
      window.location.href = 'mailto:sales@softcodes.ai?subject=Teams Plan Inquiry';
      return;
    }

    // For Pro
    if (!isLoaded || !isSignedIn) {
      const params = new URLSearchParams({
        plan: 'pro',
        billing: 'monthly',
        currency: 'EUR',
      });
      navigate(`/sign-up?${params.toString()}`);
    } else {
      navigate('/dashboard');
    }
  };
return (
  <div className="mx-auto max-w-7xl px-6 lg:px-8">
    <div className="space-y-6">
      {pricingPlans.map((plan) => (
        <div
          key={plan.name}
          className={`mx-auto max-w-4xl rounded-2xl ring-1 lg:flex ${
            plan.highlighted ? "ring-blue-500/50 shadow-lg" : "ring-gray-600"
          } bg-gray-800/50`}
        >
          <div className="-mt-1 p-1 lg:mt-0 lg:w-full lg:max-w-sm lg:flex-shrink-0">
            <div className="rounded-xl bg-gray-800/50 py-8 text-center ring-1 ring-inset ring-gray-600 lg:flex lg:flex-col lg:justify-center lg:py-12">
              <div className="mx-auto max-w-xs px-6">
                <h3 className="text-xl font-bold tracking-tight text-white">{plan.name}</h3>
                <p className="mt-3 text-sm leading-6 text-gray-300">{plan.description}</p>

                {plan.badge && <p className="text-sm font-semibold text-blue-500 mt-4">{plan.badge}</p>}
                <p className="mt-4 flex items-baseline justify-center gap-x-2">
                  <span className="text-4xl font-bold tracking-tight text-white">{plan.price}</span>
                  {plan.period && (
                    <span className="text-sm font-semibold leading-6 tracking-wide text-gray-400">
                      {plan.period}
                    </span>
                  )}
                </p>
                <Button
                  onClick={() => handlePlanClick(plan.name)}
                  className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {plan.cta}
                </Button>
                <p className="mt-4 text-xs leading-5 text-gray-400">
                  Invoices and receipts available for easy company reimbursement
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:flex-auto">
            <div className="flex items-center gap-x-4">
              <h4 className="flex-none text-sm font-semibold leading-6 text-blue-500">What's included</h4>
              <div className="h-px flex-auto bg-gray-600"></div>
            </div>

            <ul role="list" className="mt-6 grid grid-cols-1 gap-3 text-sm leading-6 sm:grid-cols-2 sm:gap-4">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex gap-x-3">
                  <Check className="h-5 w-4 flex-none text-blue-500 mt-0.5" />
                  <span className="text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  </div>
)
}