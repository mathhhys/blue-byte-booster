import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import GradientBackground from "@/components/GradientBackground";
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const Hero = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();
  
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <GradientBackground>
      <section className="min-h-screen flex items-center justify-center pt-24 pb-24">
        <div className="container mx-auto px-6 flex items-center justify-center min-h-full mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-8 lg:gap-20 items-center max-w-7xl mx-auto">
            {/* Left Column: Text Content */}
            <div className="text-center lg:text-left">
              {/* Welcome badge */}
              <div className="inline-block mb-8">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full">
                <div className="w-3 h-3 bg-green-400 rounded-full shadow-lg shadow-green-400/50 animate-pulse"></div>
                <span className="text-white text-sm font-medium">Welcome to the Future of Coding</span>
              </div>
            </div>
            
            {/* Main heading */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-8 leading-tight text-center lg:text-left">
              <span className="text-white">
                Introducing
              </span>
              <br />
              <span className="text-white mt-0">
                Softcodes
              </span>
            </h1>
            
            {/* Description */}
              <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto lg:mx-0 leading-relaxed">
              Experience the next generation of windsurfing. Book sessions,
              learn from experts, and enjoy premium equipment at stunning
              locations.
            </p>
            
            {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center mb-16">
              {!isLoaded || !isSignedIn ? (
                <Button
                  onClick={() => navigate('/sign-up')}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-medium rounded-lg transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                  size="lg"
                >
                  Get Started
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/dashboard')}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-medium rounded-lg transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                  size="lg"
                >
                  Go to Dashboard
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => scrollToSection('features')}
                className="border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-medium rounded-lg transition-all duration-300 hover:scale-105 backdrop-blur-sm"
                size="lg"
              >
                Explore Features
              </Button>
            </div>

            {/* VS Code 5-star review */}
              <div className="flex justify-center lg:justify-start mb-8">
              <div className="flex items-center gap-4 bg-slate-800/80 px-6 py-3 rounded-xl shadow-lg border border-white/10">
                {/* VS Code Logo from provided SVG URL */}
                <img
                  src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-logo/vscode.svg"
                  alt="VS Code Logo"
                  className="w-10 h-10"
                  style={{ minWidth: 40, minHeight: 40 }}
                />
                <div className="flex flex-col items-start">
                  <div className="flex items-center mb-1">
                    {/* 5 Stars */}
                    <span className="flex items-center text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                          <polygon points="10,1.5 12.6,7.3 18.9,7.8 14,12.2 15.4,18.4 10,15.1 4.6,18.4 6,12.2 1.1,7.8 7.4,7.3" />
                        </svg>
                      ))}
                    </span>
                    <span className="text-white text-base font-semibold ml-2">
                      4.8/5.0
                    </span>
                  </div>
                  <span className="text-gray-300 text-xs font-medium">
                    on VS Code Marketplace
                  </span>
                </div>
              </div>
            </div>
            </div> {/* Closing tag for Left Column: Text Content */}

            {/* Right Column: Demo Video */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full rounded-xl overflow-hidden shadow-2xl border border-white/10">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full aspect-[1138/720] object-contain bg-slate-700/50"
                  aria-label="Hero demo video"
                >
                  <source
                    src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes%20demos/SoftcodesHero2.mp4"
                    type="video/mp4"
                  />
                  {/* Fallback for unsupported browsers */}
                  <div className="bg-slate-700/50 backdrop-blur-sm aspect-[1138/720] flex items-center justify-center text-gray-300 text-sm font-medium">
                    Your browser does not support the video tag.
                  </div>
                </video>
              </div>
            </div>
          </div>
        </div>
      </section>
    </GradientBackground>
  );
};

export default Hero;