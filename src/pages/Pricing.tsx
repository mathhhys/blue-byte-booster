import React, { useState } from "react";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import { ModelProvidersSection } from "../components/Features";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Check, X, ChevronDown, ChevronUp, Star, Apple, ArrowRight } from "lucide-react";

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
    <div className="min-h-screen bg-slate-900 mt-8">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 bg-slate-900">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block mb-6">
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-sm font-medium" style={{ color: '#f9f9f9' }}>Special Launch Pricing</span>
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white">
            Plans and Pricing
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
            Choose the perfect plan for your coding journey. All plans include access to our powerful AI coding assistant.
          </p>

          {/* Monthly/Annual Toggle */}
          <div className="flex items-center justify-center gap-4 mb-16">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-white' : 'text-gray-400'}`}>
              Monthly
            </span>
            <Switch
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
              className="data-[state=checked]:bg-primary"
            />
            <span className={`text-sm font-medium ${isAnnual ? 'text-white' : 'text-gray-400'}`}>
              Annual
            </span>
            {isAnnual && (
              <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                Save 20%
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Cards - Custom Section */}
      <section className="bg-black py-20 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-16 gap-8">
            <h2 className="text-4xl lg:text-5xl font-semibold text-white">
              Individual Plans
            </h2>
            <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-600">
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  !isAnnual
                    ? "bg-white text-black"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                MONTHLY
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  isAnnual
                    ? "bg-white text-black"
                    : "text-gray-300 hover:text-white"
                }`}
              >
                YEARLY <span className="text-gray-400">(SAVE 20%)</span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full items-stretch">
            {pricingPlans.map((plan, idx) => (
              <div
                key={plan.id}
                className={`${
                  plan.popular
                    ? "bg-gray-900 rounded-2xl p-8 border border-gray-700 h-full flex flex-col"
                    : "bg-gray-900 rounded-2xl p-8 border border-gray-700 h-full flex flex-col"
                }`}
              >
                {plan.popular && (
                  <>
                    <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold z-10">
                      Most Popular
                    </div>
                  </>
                )}
                <div className="flex flex-col flex-1">
                  <div className="mb-8">
                    <h3 className="text-xl font-medium text-white mb-6">{plan.name}</h3>
                    <div className="text-5xl font-bold text-white mb-2">
                      {plan.monthlyPrice === 0 && plan.annualPrice === 0
                        ? "Free"
                        : plan.monthlyPrice === null && plan.annualPrice === null
                        ? "Custom"
                        : `$${isAnnual ? plan.annualPrice : plan.monthlyPrice}`}
                      {plan.monthlyPrice !== 0 && plan.annualPrice !== 0 && plan.monthlyPrice !== null && plan.annualPrice !== null && (
                        <span className="text-lg font-normal text-white/80 ml-1">/mo</span>
                      )}
                    </div>
                  </div>
                  <div className="mb-10 flex-1">
                    <h4 className="text-gray-300 font-medium mb-6">
                      {plan.id === "free"
                        ? "Includes"
                        : plan.id === "pro"
                        ? "Everything in Free, plus"
                        : plan.id === "teams"
                        ? "Everything in Pro, plus"
                        : "Everything in Teams, plus"}
                    </h4>
                    <ul className="space-y-4">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                          <span className="text-white text-sm leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-4 mt-auto">
                    <Button
                      className={`w-full font-medium py-3 h-12 rounded-lg ${
                        plan.buttonVariant === "default"
                          ? "bg-white text-black hover:bg-gray-100"
                          : "bg-transparent border-gray-600 text-white hover:bg-gray-800"
                      }`}
                      variant={plan.buttonVariant}
                    >
                      {plan.buttonText}
                    </Button>
                    {plan.id === "pro" && (
                      <button className="flex items-center gap-2 text-white hover:text-white/80 text-sm font-medium group transition-colors">
                        More info
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
        </div>


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
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Features</th>
                  <th className="text-center py-4 px-6 font-semibold text-foreground">Pro</th>
                  <th className="text-center py-4 px-6 font-semibold text-foreground">Teams</th>
                  <th className="text-center py-4 px-6 font-semibold text-foreground">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((category) => (
                  <React.Fragment key={category.category}>
                    <tr className="bg-muted/50">
                      <td colSpan={4} className="py-3 px-6 font-semibold text-foreground text-sm uppercase tracking-wide">
                        {category.category}
                      </td>
                    </tr>
                    {category.features.map((feature, index) => (
                      <tr key={index} className="border-b border-border/50">
                        <td className="py-4 px-6 text-foreground">{feature.name}</td>
                        <td className="py-4 px-6 text-center">
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
                        <td className="py-4 px-6 text-center">
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