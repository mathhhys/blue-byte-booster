import React from "react";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import { ModelProvidersSection } from "../components/Features";
import PricingSection from "@/components/PricingSection";
import { getFeatureComparison } from '@/config/plans';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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



export default function Pricing() {
  return (
    <>
    <GradientBackground className="mt-8">
      <Navigation />
      
      {/* Hero Section with integrated pricing cards */}
      <section className="pt-24 px-4 bg-transparent">
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
          <p className="text-xl text-gray-300 mb-2 max-w-3xl mx-auto">
            Choose the perfect plan for your coding journey. All plans include access to our powerful AI coding assistant.
          </p>

          {/* Pricing cards directly integrated */}
          <PricingSection />

          {/* Features Comparison Table */}
          <div className="mt-16 mb-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Compare Plans
              </h2>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                See which plan is right for your needs
              </p>
            </div>

            <div className="w-full overflow-x-auto">
              <Table className="w-full text-sm bg-gray-800/50 border border-gray-700 rounded-lg">
                <TableHeader className="bg-gray-700/50">
                  <TableRow>
                    <TableHead className="w-1/2 text-left font-semibold text-white border-r border-gray-600">Feature</TableHead>
                    <TableHead className="text-center font-semibold text-white">Pro</TableHead>
                    <TableHead className="text-center font-semibold text-white">Teams</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getFeatureComparison().categories.map((category, catIndex) => (
                    <React.Fragment key={catIndex}>
                      {/* Category Header Row */}
                      <TableRow className="bg-gray-700/30">
                        <TableCell
                          colSpan={3}
                          className="text-left font-semibold text-white py-4 border-b border-gray-600"
                        >
                          {category.name}
                        </TableCell>
                      </TableRow>
                      {/* Feature Rows */}
                      {category.features.map((feature, featIndex) => (
                        <TableRow key={featIndex} className="hover:bg-gray-700/20 transition-colors">
                          <TableCell className="text-left text-gray-300 py-3 border-r border-gray-600">
                            {feature.name}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            {typeof feature.pro === 'boolean' ? (
                              feature.pro ? <Check className="mx-auto h-4 w-4 text-green-500" /> : <X className="mx-auto h-4 w-4 text-red-500" />
                            ) : (
                              <span className="text-gray-300">{feature.pro}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            {typeof feature.teams === 'boolean' ? (
                              feature.teams ? <Check className="mx-auto h-4 w-4 text-green-500" /> : <X className="mx-auto h-4 w-4 text-red-500" />
                            ) : (
                              <span className="text-gray-300">{feature.teams}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </section>
    </GradientBackground>

    <FAQSection />

      <Footer />
    </>
  );
}