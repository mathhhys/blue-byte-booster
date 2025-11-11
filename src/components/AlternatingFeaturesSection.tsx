import { ArrowRight } from "lucide-react";
import { Button } from "./ui/button";

const AlternatingFeaturesSection = () => {
  return (
    <section className="w-full py-16" style={{ backgroundColor: '#0F1629' }} aria-label="Key Features">
      <div className="container mx-auto px-6 max-w-7xl">
        
        {/* Row 1: Terminal Mockup (Left) | Text (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center mb-12 lg:mb-24">
          {/* Terminal Mockup Placeholder */}
          <div className="order-1">
            <div className="bg-[#181f33] rounded-xl border border-blue-500/20 shadow-lg shadow-blue-500/10 aspect-video transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 transform hover:scale-105 overflow-hidden">
              <img
                src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-elements/agent-2.png"
                alt="Agent terminal interface demo"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Text Content */}
          <div className="order-2 space-y-6">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
              Your intelligent coding partner
            </h2>
            <p className="text-base md:text-lg text-gray-300 leading-relaxed max-w-xl">
              Softcodes understands your intent and transforms it into production-ready code.
              From complex algorithms to entire features, watch your ideas come to life with
              context-aware intelligence that learns your coding style.
            </p>
            <Button asChild className="bg-blue-700 hover:bg-blue-600 text-white inline-flex items-center gap-2 font-semibold text-base md:text-lg">
              <a href="#agent">
                Experience Agent
                <ArrowRight className="w-5 h-5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Row 2: Text (Left) | Code Editor Mockup (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center mb-12 lg:mb-24">
          {/* Text Content */}
          <div className="order-2 lg:order-1 space-y-6">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
              Intelligent code completion
            </h2>
            <p className="text-base md:text-lg text-gray-300 leading-relaxed max-w-xl">
              Experience AI-powered autocomplete that understands your codebase context and suggests complete functions, algorithms, and solutions matching your coding patterns and requirements.
            </p>
            <Button asChild className="bg-blue-700 hover:bg-blue-600 text-white inline-flex items-center gap-2 font-semibold text-base md:text-lg">
              <a href="#tab">
                Try Smart Completion
                <ArrowRight className="w-5 h-5" />
              </a>
            </Button>
          </div>

          {/* Code Editor Mockup */}
          <div className="order-1 lg:order-2">
            <div className="bg-[#181f33] rounded-xl border border-blue-500/20 shadow-lg shadow-blue-500/10 aspect-video transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 transform hover:scale-105 overflow-hidden">
              <img
                src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-elements/autocomplete-2.png"
                alt="Intelligent code completion demo"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Row 3: Chat Interface Mockup (Left) | Text (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Chat Interface Mockup Placeholder */}
          <div className="order-1">
            <div className="bg-[#181f33] rounded-xl border border-blue-500/20 shadow-lg shadow-blue-500/10 aspect-video transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 transform hover:scale-105 overflow-hidden">
              <img
                src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-elements/Softcodes%20Modes.png"
                alt="Everywhere software gets built collaboration demo"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Text Content */}
          <div className="order-2 space-y-4">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
              Five specialized AI modes
            </h2>
            <p className="text-base md:text-lg text-gray-300 leading-relaxed max-w-xl">
              Supercharge your development workflow with five specialized AI agents that handle everything from architecture planning to complex debugging, giving you superhuman coding capabilities.
            </p>
            <Button asChild className="bg-blue-700 hover:bg-blue-600 text-white inline-flex items-center gap-2 font-semibold text-base md:text-lg">
              <a href="#agent-modes">
                Explore All Modes
                <ArrowRight className="w-5 h-5" />
              </a>
            </Button>
          </div>
        </div>

      </div>
    </section>
  );
};

export default AlternatingFeaturesSection;