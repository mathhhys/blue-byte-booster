"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, ArrowRight, Mail } from "lucide-react";
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { PLAN_CONFIGS } from '@/config/plans';

export const PricingSection = () => {
  const [isYearly, setIsYearly] = useState(false);
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();

  const plans = [
    PLAN_CONFIGS.pro,
    PLAN_CONFIGS.teams,
    PLAN_CONFIGS.enterprise,
  ];

  const handlePlanClick = (planId: 'pro' | 'teams' | 'enterprise') => {
    if (planId === 'enterprise') {
      window.location.href = 'mailto:sales@softcodes.ai?subject=Enterprise Plan Inquiry';
      return;
    }

    if (!isLoaded || !isSignedIn) {
      const params = new URLSearchParams({
        plan: planId,
        billing: isYearly ? 'yearly' : 'monthly',
      });
      navigate(`/sign-up?${params.toString()}`);
    } else {
      navigate('/dashboard');
    }
  };

  const getPlanPrice = (plan: typeof PLAN_CONFIGS.pro | typeof PLAN_CONFIGS.enterprise) => {
    if (plan.isContactSales) return 'Custom';
    if (!plan.price.monthly) return 'Custom';
    const price = isYearly ? plan.price.yearly : plan.price.monthly;
    return `$${price}`;
  };

  const getButtonText = (planId: 'pro' | 'teams' | 'enterprise') => {
    if (planId === 'enterprise') {
      return 'Contact Sales';
    }
    
    if (!isLoaded || !isSignedIn) {
      return `Get ${planId === 'pro' ? 'Pro' : 'Teams'}`;
    }
    
    return 'Go to Dashboard';
  };

  const getButtonIcon = (planId: 'pro' | 'teams' | 'enterprise') => {
    if (planId === 'enterprise') {
      return Mail;
    }
    return ArrowRight;
  };

  return (
    <section className="bg-transparent pb-24">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header - Toggle Only, Centered */}
        <div className="flex justify-center items-center -mt-8 md:mt-0 mb-12">
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
              YEARLY <span className="text-gray-400">(SAVE 20%)</span>
            </button>
          </div>
        </div>

        {/* Main Cards - Pro, Teams, and Enterprise in a 3-column grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative p-8 border transition-all duration-300 hover:scale-105 ${
                plan.isPopular
                  ? 'border-transparent'
                  : 'border-transparent'
              }`}
              style={plan.isPopular ? {
                background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 25%, #3b82f6 50%, #1e40af 75%, #1e3a8a 100%)"
              } : {
                background: "linear-gradient(135deg, #0A0F1C 0%, #0F1929 25%, #1A2332 50%, #0F1929 75%, #0A0F1C 100%)"
              }}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="space-y-6">
                {/* Header */}
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl font-bold text-white">
                      {getPlanPrice(plan)}
                    </span>
                    <span className="text-gray-300">
                      {plan.price.monthly && plan.price.monthly > 0 ? '/mo' : ''}
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
                  onClick={() => handlePlanClick(plan.id)}
                  variant={plan.isPopular ? "default" : "outline"}
                  className={`w-full group ${
                    plan.isPopular
                      ? 'bg-white text-black hover:bg-gray-100'
                      : 'border-gray-600 text-white hover:bg-gray-800'
                  }`}
                >
                  {React.createElement(getButtonIcon(plan.id), { className: "w-4 h-4 mr-2 group-hover:translate-x-0.5 transition-transform" })}
                  {getButtonText(plan.id)}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};