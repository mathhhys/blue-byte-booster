 import Navigation from "@/components/Navigation";
 import { PricingSection } from "@/components/PricingSection";
 import Hero from "@/components/Hero";
 import AlternatingFeaturesSection from "@/components/AlternatingFeaturesSection";
 import ProductivitySection from "@/components/ProductivitySection";
 import TabSection from "@/components/TabSection";
 import Features from "@/components/Features";
 import FeatureShowcase from "@/components/FeatureShowcase";
 import CodeDemo from "@/components/CodeDemo";
 import CTA from "@/components/CTA";
 import StatsSection from "@/components/StatsSection";
 import Footer from "@/components/Footer";
 import FAQSection from "@/components/FAQSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Hero />
      <AlternatingFeaturesSection />
      <ProductivitySection />
      <FeatureShowcase />
      <Features />
      <StatsSection />
      <PricingSection />
      <FAQSection />
      <Footer />
    </div>
  );
};

export default Index;
