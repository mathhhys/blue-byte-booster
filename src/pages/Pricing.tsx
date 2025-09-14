import React, { useState } from "react";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import { ModelProvidersSection } from "../components/Features";
import { PricingSection } from "@/components/PricingSection";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import GradientBackground from "@/components/GradientBackground";

// Pricing data is now managed in PricingSection component
// This removes the duplicate data structure

// Feature comparison data - updated for Pro, Teams, Enterprise
const comparisonFeatures = [
  {
    category: "AI & Coding",
    features: [
      { name: "Agent Requests", pro: "Unlimited", teams: "Unlimited", enterprise: "Unlimited" },
      { name: "Tab Completions", pro: "Unlimited", teams: "Unlimited", enterprise: "Unlimited" },
      { name: "Monthly Credits", pro: "500 included", teams: "500 per user", enterprise: "Custom" },
      { name: "Background Agents", pro: true, teams: true, enterprise: true },
      { name: "Custom Model Training", pro: false, teams: false, enterprise: true }
    ]
  },
  {
    category: "Collaboration",
    features: [
      { name: "Team Members", pro: "1", teams: "Up to 100", enterprise: "Unlimited" },
      { name: "Centralized Billing", pro: false, teams: true, enterprise: true },
      { name: "Admin Dashboard", pro: false, teams: true, enterprise: "Advanced" },
      { name: "Privacy Mode", pro: false, teams: true, enterprise: true },
      { name: "SSO & SAML", pro: false, teams: false, enterprise: true }
    ]
  },
  {
    category: "Support & Security",
    features: [
      { name: "Support Level", pro: "Standard", teams: "Priority", enterprise: "Dedicated" },
      { name: "Custom SLA", pro: false, teams: false, enterprise: true },
      { name: "On-premise Deployment", pro: false, teams: false, enterprise: true },
      { name: "Advanced Security", pro: false, teams: false, enterprise: true },
      { name: "API Price Credits", pro: true, teams: true, enterprise: true }
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
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
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

      {/* Social Proof: Model Providers Section */}
      <ModelProvidersSection />

      <Footer />
    </>
  );
}