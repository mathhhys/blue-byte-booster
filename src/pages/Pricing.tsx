import React, { useState } from "react";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import { ModelProvidersSection } from "../components/Features";
import { PricingSection } from "@/components/PricingSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Check, X, ChevronDown, ChevronUp, Star, Apple, ArrowRight } from "lucide-react";
import GradientBackground from "@/components/GradientBackground";

// Pricing data structure
const pricingPlans = [
  {
    id: "free",
    name: "Free",
    description: "Get started with limited access to agents and tab completions.",
    monthlyPrice: 0,
    annualPrice: 0,
    popular: false,
    features: [
      "Limited Agent requests",
      "Limited Tab completions"
    ],
    buttonText: "Get Started",
    buttonVariant: "default" as const
  },
  {
    id: "pro",
    name: "Pro",
    description: "Perfect for individual developers and freelancers",
    monthlyPrice: 20,
    annualPrice: 16,
    popular: false,
    features: [
      "5,000 AI prompts/month",
      "Access to GPT-4, Claude, Gemini",
      "Code generation & completion",
      "Basic code review",
      "Community support",
      "VS Code & JetBrains plugins",
      "Basic analytics",
      "Standard response time"
    ],
    buttonText: "Start Pro Plan",
    buttonVariant: "outline" as const
  },
  {
    id: "teams",
    name: "Teams",
    description: "Ideal for small to medium development teams",
    monthlyPrice: 30,
    annualPrice: 24,
    popular: true,
    features: [
      "15,000 AI prompts/month per user",
      "All Pro features included",
      "Team collaboration tools",
      "Advanced code review",
      "Priority email support",
      "Team analytics & insights",
      "Shared code templates",
      "Team workspace management",
      "Advanced AI models access",
      "Custom integrations"
    ],
    buttonText: "Start Teams Plan",
    buttonVariant: "default" as const
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for large organizations",
    monthlyPrice: null,
    annualPrice: null,
    popular: false,
    features: [
      "Unlimited AI prompts",
      "All Teams features included",
      "Dedicated account manager",
      "Custom SLA agreements",
      "On-premise deployment",
      "SSO & advanced security",
      "Custom model training",
      "24/7 phone support",
      "Onboarding & training",
      "Custom integrations",
      "Compliance certifications",
      "Volume discounts available"
    ],
    buttonText: "Contact Sales",
    buttonVariant: "outline" as const
  }
];

// Feature comparison data
const comparisonFeatures = [
  {
    category: "AI & Coding",
    features: [
      { name: "AI Prompts/month", pro: "5,000", teams: "15,000 per user", enterprise: "Unlimited" },
      { name: "Model Access", pro: "GPT-4, Claude, Gemini", teams: "All models + advanced", enterprise: "All + custom models" },
      { name: "Code Generation", pro: true, teams: true, enterprise: true },
      { name: "Advanced AI Features", pro: false, teams: true, enterprise: true },
      { name: "Custom Model Training", pro: false, teams: false, enterprise: true }
    ]
  },
  {
    category: "Collaboration",
    features: [
      { name: "Team Members", pro: "1", teams: "Up to 50", enterprise: "Unlimited" },
      { name: "Shared Workspaces", pro: false, teams: true, enterprise: true },
      { name: "Team Analytics", pro: false, teams: true, enterprise: true },
      { name: "Code Review Tools", pro: "Basic", teams: "Advanced", enterprise: "Enterprise" }
    ]
  },
  {
    category: "Support & Security",
    features: [
      { name: "Support Level", pro: "Community", teams: "Priority Email", enterprise: "24/7 Dedicated" },
      { name: "SLA", pro: false, teams: false, enterprise: true },
      { name: "SSO Integration", pro: false, teams: false, enterprise: true },
      { name: "Compliance", pro: false, teams: "SOC 2", enterprise: "SOC 2 + Custom" }
    ]
  }
];

// FAQ data
const faqData = [
  {
    question: "What are AI prompts and how are they consumed?",
    answer: "AI prompts are requests sent to our AI models for code generation, completion, or assistance. Each interaction with the AI (like generating a function, explaining code, or getting suggestions) counts as one prompt. The count resets monthly."
  },
  {
    question: "Can I switch between plans anytime?",
    answer: "Yes, you can upgrade or downgrade your plan at any time. When upgrading, you'll be charged the prorated difference immediately. When downgrading, the change takes effect at your next billing cycle."
  },
  {
    question: "Do you offer student discounts?",
    answer: "Yes! We offer 50% off all plans for verified students and educators. Contact our support team with your educational email address to get started."
  },
  {
    question: "What happens if I exceed my prompt limit?",
    answer: "If you exceed your monthly prompt limit, you can either upgrade your plan or purchase additional prompts at $0.01 per prompt. We'll notify you when you're approaching your limit."
  },
  {
    question: "Is my code data secure and private?",
    answer: "Absolutely. We're SOC 2 certified and follow industry best practices for data security. Your code is encrypted in transit and at rest. For Enterprise customers, we offer on-premise deployment options."
  },
  {
    question: "Which IDEs and editors do you support?",
    answer: "We support VS Code, JetBrains IDEs (IntelliJ, PyCharm, WebStorm, etc.), Vim, Neovim, and Emacs. We're continuously adding support for more editors based on user demand."
  }
];

// Testimonials data
const testimonials = [
  {
    name: "Sarah Chen",
    role: "Senior Developer",
    company: "TechCorp",
    content: "SoftCodes has transformed how I write code. The AI suggestions are incredibly accurate and save me hours every day.",
    rating: 5
  },
  {
    name: "Marcus Rodriguez",
    role: "Engineering Manager",
    company: "StartupXYZ",
    content: "Our team's productivity increased by 40% after switching to SoftCodes. The collaboration features are game-changing.",
    rating: 5
  },
  {
    name: "Emily Johnson",
    role: "Full Stack Developer",
    company: "DevStudio",
    content: "The code quality suggestions and automated reviews have significantly improved our codebase. Highly recommended!",
    rating: 5
  }
];

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const getPrice = (plan: typeof pricingPlans[0]) => {
    if (plan.monthlyPrice === null) return "Custom";
    const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
    return `$${price}`;
  };

  const getSavings = () => {
    if (!isAnnual) return null;
    return "Save 20%";
  };

  return (
    <>
    <GradientBackground className="mt-8">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 bg-transparent">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block mb-6">
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-sm font-medium" style={{ color: '#f9f9f9' }}>Choose the perfect plan for you</span>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white">
            Plans and Pricing
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
            Choose the perfect plan for your coding journey. All plans include access to our powerful AI coding assistant.
          </p>

          {/* Monthly/Annual Toggle removed here; will use the one from PricingSection */}
        </div>
      </section>

      {/* Replaced Pricing Cards Section with new PricingSection */}
      <PricingSection />
    </GradientBackground>


      {/* Feature Comparison Table */}
      <section className="py-24 px-4 bg-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Compare Plans
            </h2>
            <p className="text-xl text-gray-300">
              See what's included in each plan
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border border-gray-700 border-collapse shadow-lg">
              <thead className="bg-gray-800">
                <tr className="border-b border-gray-700">
                  <th className="text-left py-4 px-6 font-bold text-white uppercase tracking-wide border-r border-gray-700">Features</th>
                  <th className="text-center py-4 px-6 font-bold text-white uppercase tracking-wide border-r border-gray-700">Pro</th>
                  <th className="text-center py-4 px-6 font-bold text-white uppercase tracking-wide border-r border-gray-700">Teams</th>
                  <th className="text-center py-4 px-6 font-bold text-white uppercase tracking-wide">Enterprise</th>
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-700">
                {comparisonFeatures.map((category) => (
                  <React.Fragment key={category.category}>
                    <tr className="bg-gray-800/70">
                              <td colSpan={4} className="py-3 px-6 font-semibold text-white text-sm uppercase tracking-wide border-b border-gray-700">
                                {category.category}
                              </td>
                            </tr>
                    {category.features.map((feature, index) => (
                      <tr key={index} className="border-b border-border/50">
                        <td className="py-4 px-6 text-gray-200 border-r border-gray-700">{feature.name}</td>
                        <td className="py-4 px-6 text-center border-r border-gray-700">
                          {typeof feature.pro === 'boolean' ? (
                            feature.pro ? (
                              <Check className="w-5 h-5 text-primary mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-muted-foreground mx-auto" />
                            )
                          ) : (
                            <span className="text-foreground">{feature.pro}</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center border-r border-gray-700">
                          {typeof feature.teams === 'boolean' ? (
                            feature.teams ? (
                              <Check className="w-5 h-5 text-primary mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-muted-foreground mx-auto" />
                            )
                          ) : (
                            <span className="text-foreground">{feature.teams}</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {typeof feature.enterprise === 'boolean' ? (
                            feature.enterprise ? (
                              <Check className="w-5 h-5 text-primary mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-muted-foreground mx-auto" />
                            )
                          ) : (
                            <span className="text-foreground">{feature.enterprise}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Social Proof: Model Providers Section */}
      <ModelProvidersSection />

      {/* FAQ Section */}
      <section className="py-24 px-4 bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-300">
              Everything you need to know about SoftCodes pricing
            </p>
          </div>

          <div className="space-y-4">
            {faqData.map((faq, index) => (
              <div
                key={index}
                className="border border-white/10 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <span className="text-white font-medium">{faq.question}</span>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-white" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white" />
                  )}
                </button>
                {expandedFaq === index && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-300">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}