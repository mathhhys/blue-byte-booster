"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Download, ArrowRight, Users } from "lucide-react";

export const PricingSection = () => {
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: "Hobby",
      price: { monthly: 0, yearly: 0 },
      description: "Pro two-week trial",
      features: [
        "Limited Agent requests",
        "Limited Tab completions"
      ],
      buttonText: "Get Started For Free",
      buttonIcon: ArrowRight,
      buttonVariant: "default" as const,
      isPopular: false
    },
    {
      name: "Pro",
      price: { monthly: 20, yearly: 16 },
      description: "Extended limits on Agent",
      features: [
        "Unlimited Tab completions",
        "Access to Background Agents",
        "Access to Bugbot", 
        "Access to maximum context windows"
      ],
      buttonText: "Get Softcodes Pro",
      buttonIcon: ArrowRight,
      buttonVariant: "default" as const,
      isPopular: true
    },
    {
      name: "Teams",
      price: { monthly: 30, yearly: 24 },
      description: "20x usage on all OpenAI/Claude/Gemini models",
      features: [
        "Automated zero data retention",
        "Centralized Billing",
        "Admin dashboard with analytics",
        "Priority support"
      ],
      buttonText: "Get Softcodes for Teams",
      buttonIcon: ArrowRight,
      buttonVariant: "default" as const,
      isPopular: false
    }
  ];

  const enterpriseFeatures = [
    "Custom deployment",
    "SSO & SAML",
    "Dedicated support",
    "Advanced security"
  ];

  return (
    <section className="bg-transparent">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header - Toggle Only, Centered */}
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
              YEARLY <span className="text-gray-400">(SAVE 20%)</span>
            </button>
          </div>
        </div>

        {/* Main Cards */}
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
              <div className="space-y-6">
                {/* Header */}
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl font-bold text-white">
                      ${isYearly ? plan.price.yearly : plan.price.monthly}
                    </span>
                    <span className="text-gray-300">
                      {plan.price.monthly > 0 ? '/mo' : ''}
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
                  variant={plan.buttonVariant}
                  className={`w-full group ${
                    plan.isPopular 
                      ? 'bg-white text-black hover:bg-gray-100' 
                      : (plan.buttonVariant as string) === 'outline'
                      ? 'border-gray-600 text-white hover:bg-gray-800'
                      : ''
                  }`}
                >
                  <plan.buttonIcon className="w-4 h-4 mr-2 group-hover:translate-x-0.5 transition-transform" />
                  {plan.buttonText}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Enterprise Card - Made Larger */}
        <Card 
          className="border-transparent p-12 transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: "linear-gradient(135deg, #0A0F1C 0%, #0F1929 25%, #1A2332 50%, #0F1929 75%, #0A0F1C 100%)"
          }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-8">
            {/* Left Content */}
            <div className="flex-1">
              <div className="flex items-center gap-6 mb-8">
                <Users className="w-8 h-8 text-purple-400" />
                <h3 className="text-3xl font-semibold text-white">Enterprise</h3>
                <span className="text-3xl font-bold text-white ml-auto lg:ml-0">
                  Custom pricing
                </span>
              </div>
              
              <p className="text-lg text-gray-300 mb-8">
                Everything in Teams plus :
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                {enterpriseFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span className="text-base text-gray-200">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Button */}
            <div className="lg:ml-12">
              <Button
                variant={"default" as const}
                size="lg"
                className="border-gray-600 text-white hover:bg-gray-800 px-12 py-4 text-lg"
              >
                Contact Sales
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};