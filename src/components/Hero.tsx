import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

const Hero = () => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="min-h-screen flex items-center justify-center bg-slate-900 relative overflow-hidden pt-24">
      {/* Background decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <div className="container mx-auto px-6 relative z-10 flex items-center justify-center min-h-full mt-24">
        <div className="text-center max-w-4xl mx-auto">
          {/* Welcome badge */}
          <div className="inline-block mb-8">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full">
              <div className="w-3 h-3 bg-green-400 rounded-full shadow-lg shadow-green-400/50 animate-pulse"></div>
              <span className="text-white text-sm font-medium">Welcome to the Future of Coding</span>
            </div>
          </div>
          
          {/* Main heading */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-8 leading-tight text-center">
            <span className="text-white">
              Introducing
            </span>
            <br />
            <span className="text-white mt-0">
              Softcodes
            </span>
          </h1>
          
          {/* Description */}
          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Experience the next generation of windsurfing. Book sessions, 
            learn from experts, and enjoy premium equipment at stunning 
            locations.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-medium rounded-lg transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
              size="lg"
            >
              Get Started
            </Button>
            <Button 
              variant="outline" 
              className="border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-medium rounded-lg transition-all duration-300 hover:scale-105 backdrop-blur-sm"
              size="lg"
              onClick={() => scrollToSection("demo")}
            >
              <Play className="w-5 h-5 mr-2" />
              Watch Demo
            </Button>
          </div>

          {/* Hero image container */}
          <div className="flex justify-center items-center my-8">
            <div className="rounded-2xl overflow-hidden shadow-lg border border-white/10 bg-white/5 backdrop-blur-sm max-w-3xl w-full">
              <img
                src="/placeholder.svg"
                alt="Windsurfing Hero"
                className="w-full h-80 object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;