import React from "react";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import { ModelProvidersSection } from "../components/Features";
import { PricingSection } from "@/components/PricingSection";
import { Check, X } from "lucide-react";
import FAQSection from "@/components/FAQSection";
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

    <FAQSection />

    {/* Trusted by Developers Section */}
    <section className="py-20 bg-gray-900">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Trusted by Developers Worldwide
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Join thousands of developers who are revolutionizing their coding experience with Softcodes AI.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-gray-800 p-6 rounded-lg text-center border border-gray-700">
              <div className="flex justify-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Check key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-200 mb-6 italic">"{testimonial.content}"</p>
              <div>
                <h4 className="font-semibold text-white">{testimonial.name}</h4>
                <p className="text-gray-400">{testimonial.role} at {testimonial.company}</p>
              </div>
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