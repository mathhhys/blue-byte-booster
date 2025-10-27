 import Navigation from "@/components/Navigation";
 import Hero from "@/components/Hero";
 import AlternatingFeaturesSection from "@/components/AlternatingFeaturesSection";
 import ProductivitySection from "@/components/ProductivitySection";
 import TabSection from "@/components/TabSection";
 import Features from "@/components/Features";
 import FeatureShowcase from "@/components/FeatureShowcase";
 import CodeDemo from "@/components/CodeDemo";
 import CTA from "@/components/CTA";
 import StatsSection from "@/components/StatsSection";
 import PricingSection from "@/components/PricingSection";
 import MCPServerSection from "@/components/MCPServerSection";
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
      <StatsSection />
      <MCPServerSection />
      <section className="pt-8 px-4" style={{ backgroundColor: '#0E172A' }}>
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
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Choose the perfect plan for your coding journey. All plans include access to our powerful AI coding assistant.
          </p>

          <PricingSection />
        </div>
      </section>
      <Features />
      <FAQSection />
      <Footer />
    </div>
  );
};

export default Index;
