import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import EnterpriseHero from "@/components/enterprise/EnterpriseHero";
import EnterpriseStats from "@/components/enterprise/EnterpriseStats";
import EnterpriseFeatures from "@/components/enterprise/EnterpriseFeatures";
import EnterpriseCapabilities from "@/components/enterprise/EnterpriseCapabilities";
import EnterpriseSecurity from "@/components/enterprise/EnterpriseSecurity";
import EnterpriseTestimonials from "@/components/enterprise/EnterpriseTestimonials";
import EnterpriseCTA from "@/components/enterprise/EnterpriseCTA";
import EnterpriseFAQ from "@/components/enterprise/EnterpriseFAQ";
import GradientBackground from "@/components/GradientBackground";

const Teams = () => {
  return (
    <GradientBackground>
      <Navigation />
      <EnterpriseHero />
      <EnterpriseFeatures />
      <EnterpriseCapabilities />
      <EnterpriseSecurity />
      <EnterpriseTestimonials />
      <EnterpriseCTA />
      <EnterpriseFAQ />
      <Footer />
    </GradientBackground>
  );
};

export default Teams;