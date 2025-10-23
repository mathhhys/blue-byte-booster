"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, ArrowRight, Mail } from "lucide-react";
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { PLAN_CONFIGS_MULTI_CURRENCY, getPlanPrice, calculateMultiCurrencySavings } from '@/config/plans';
import { formatPriceOnly } from '@/utils/currency';
import { MultiCurrencyPlanConfig, CurrencyCode } from '@/types/database';
import { DEFAULT_CURRENCY } from '@/config/currencies';

export const PricingSection = () => {
  const [isYearly, setIsYearly] = useState(false);
  const selectedCurrency: CurrencyCode = 'EUR';
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();

  const plans = [
    PLAN_CONFIGS_MULTI_CURRENCY.pro,
    PLAN_CONFIGS_MULTI_CURRENCY.teams,
  ];

  const handlePlanClick = (planId: 'pro' | 'teams') => {
    if (planId === 'teams') {
      window.location.href = 'mailto:sales@softcodes.ai?subject=Teams Plan Inquiry';
      return;
    }

    if (!isLoaded || !isSignedIn) {
      const params = new URLSearchParams({
        plan: planId,
        billing: isYearly ? 'yearly' : 'monthly',
        currency: 'EUR',
      });
      navigate(`/sign-up?${params.toString()}`);
    } else {
      navigate('/dashboard');
    }
  };

  const getPlanPriceDisplay = (plan: MultiCurrencyPlanConfig) => {
    if (plan.isContactSales) return 'Contact us';
    
    // Direct price lookup to ensure reactivity
    const pricing = plan.pricing.EUR;
    const price = isYearly ? pricing.yearly : pricing.monthly;
    
    // Direct formatting to ensure fresh calculation
    return `€${price}`;
  };

  const getSavingsPercentage = (planId: 'pro') => {
    const plan = PLAN_CONFIGS_MULTI_CURRENCY[planId];
    const monthlyPrice = plan.pricing.EUR.monthly;
    const yearlyPrice = plan.pricing.EUR.yearly;
    const monthlyTotal = monthlyPrice * 12;
    return Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100);
  };

  const getButtonText = (planId: 'pro' | 'teams') => {
    if (planId === 'teams') {
      return 'Contact us';
    }
    
    if (!isLoaded || !isSignedIn) {
      return `Get Pro`;
    }
    
    return 'Go to Dashboard';
  };

  const getButtonIcon = (planId: 'pro' | 'teams') => {
    if (planId === 'teams') {
      return Mail;
    }
    return ArrowRight;
  };

  return (
    <section className="bg-[#0E172A] pb-24">
      <div className="max-w-7xl mx-auto px-6">

        {/* Billing Toggle */}
  {/* Pricing Header */}
  <div className="text-center pt-20 mb-20">
    <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">
      Unlock Your Coding Potential with Softcodes AI
    </h2>
    <p className="text-base md:text-lg text-gray-300 max-w-3xl mx-auto leading-loose">
      Elevate your development workflow with AI-powered tools designed for modern developers and teams. Enjoy unlimited agent requests and tab completion, 500 monthly credits included with flexible scaling, plus privacy mode and centralized billing for seamless team collaboration. Our plans deliver the innovation you need to code faster and smarter. Choose the perfect fit and start transforming your productivity today.
    </p>
  </div>
        <div className="flex justify-center items-center mb-12">
          <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-600">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                !isYearly
                  ? "bg-white text-black"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              MONTHLY
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                isYearly
                  ? "bg-white text-black"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              YEARLY <span className="text-gray-400">(SAVE {getSavingsPercentage('pro')}%)</span>
            </button>
          </div>
        </div>

        {/* Main Cards - Pro and Teams in a 2-column grid */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {plans.map((plan) => (
            <Card
              key={`${plan.name}-EUR-${isYearly}`}
              className="relative p-8 border transition-all duration-300 hover:scale-105 border-transparent"
              style={{
                background: "#181F33"
              }}
            >

              <div className="space-y-6">
                {/* Header */}
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl font-bold text-white">
                      {getPlanPriceDisplay(plan)}
                    </span>
                    <span className="text-gray-300">
                      {!plan.isContactSales ? (isYearly ? '/yr' : '/mo') : ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">
                    {plan.description}
                  </p>
                </div>

                {/* Features */}
                <div className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-200">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Button */}
                <Button
                  onClick={() => handlePlanClick(plan.id as 'pro' | 'teams')}
                  variant="outline"
                  className="w-full group border-gray-600 text-white hover:bg-gray-800"
                >
                  {React.createElement(getButtonIcon(plan.id as 'pro' | 'teams'), { className: "w-4 h-4 mr-2 group-hover:translate-x-0.5 transition-transform" })}
                  {getButtonText(plan.id as 'pro' | 'teams')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};