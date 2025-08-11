import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import TabSection from "@/components/TabSection";
import Features from "@/components/Features";
import FeatureShowcase from "@/components/FeatureShowcase";
import CodeDemo from "@/components/CodeDemo";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Hero />
      <section id="features">
        <TabSection
          title="Tab Tab Tab…Ship"
          description="A single keystroke, limitless power, complete flow. The full power of Windsurf Tab is exclusive to the Windsurf Editor. Our IDE plugins include only the autocomplete action."
          imageSrc="/placeholder.svg"
          imageAlt="Code editor demo"
        />
      </section>
      <TabSection
        title="Command Palette: All Actions, One Place"
        description="Access every feature and setting with a single shortcut. The command palette brings the full power of Windsurf to your fingertips, so you never have to leave your flow."
        imageSrc="/placeholder.svg"
        imageAlt="Command palette demo"
      />
      <TabSection
        title="Instant Search: Find Anything, Instantly"
        description="Lightning-fast search across files, symbols, and documentation. Never lose your place or your focus—just search and go."
        imageSrc="/placeholder.svg"
        imageAlt="Instant search demo"
      />
      <TabSection
        title="Instant Search: Find Anything, Instantly"
        description="Lightning-fast search across files, symbols, and documentation. Never lose your place or your focus—just search and go."
        imageSrc="/placeholder.svg"
        imageAlt="Instant search demo"
      />
      <FeatureShowcase />
      <Features />
      <Footer />
    </div>
  );
};

export default Index;
