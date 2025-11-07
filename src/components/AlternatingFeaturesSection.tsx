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
            <div className="bg-[#181f33] rounded-xl border border-blue-500/20 shadow-lg shadow-blue-500/10 p-6 aspect-[4/3] transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 transform hover:scale-105">
              {/* Editor Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                  <span className="text-gray-400 text-xs font-mono">index.ts</span>
                </div>
                <div className="flex gap-2 text-[10px] text-gray-500">
                  <span>TypeScript</span>
                  <span>•</span>
                  <span>UTF-8</span>
                </div>
              </div>
              
              {/* Code Content */}
              <div className="font-mono text-xs space-y-2">
                <div className="flex">
                  <span className="text-gray-600 w-8 text-right mr-4">1</span>
                  <span className="text-purple-400">import</span>
                  <span className="text-gray-300"> {'{ '}</span>
                  <span className="text-blue-300">useState</span>
                  <span className="text-gray-300">{' }'} </span>
                  <span className="text-purple-400">from</span>
                  <span className="text-green-400"> 'react'</span>
                  <span className="text-gray-300">;</span>
                </div>

                <div className="flex">
                  <span className="text-gray-600 w-8 text-right mr-4">2</span>
                  <span></span>
                </div>

                <div className="flex">
                  <span className="text-gray-600 w-8 text-right mr-4">3</span>
                  <span className="text-purple-400">export</span>
                  <span className="text-gray-300"> </span>
                  <span className="text-purple-400">const</span>
                  <span className="text-blue-300"> calculate</span>
                  <span className="text-gray-300"> = (</span>
                  <span className="text-orange-300">items</span>
                  <span className="text-gray-500">: </span>
                  <span className="text-blue-300">number</span>
                  <span className="text-gray-300">[]</span>
                  <span className="text-gray-300">) </span>
                  <span className="text-purple-400">=&gt;</span>
                  <span className="text-gray-300"> {'{'}</span>
                </div>

                <div className="flex">
                  <span className="text-gray-600 w-8 text-right mr-4">4</span>
                  <span className="text-purple-400 ml-4">  return</span>
                  <span className="text-gray-300"> items.</span>
                  <span className="text-blue-300">sum</span>
                  <span className="animate-pulse text-white">|</span>
                </div>

                {/* Autocomplete suggestion box */}
                <div className="ml-12 mt-1 bg-[#0E172A] border border-blue-400/50 rounded-lg p-3 shadow-lg">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 bg-blue-500/20 px-2 py-1 rounded">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <div className="w-2 h-2 bg-blue-400 rounded-sm"></div>
                      </div>
                      <span className="text-blue-300">sum(callback)</span>
                      <span className="text-gray-500 text-[10px] ml-auto">method</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded cursor-pointer">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <div className="w-2 h-2 bg-green-400 rounded-sm"></div>
                      </div>
                      <span className="text-gray-300">reduce()</span>
                      <span className="text-gray-500 text-[10px] ml-auto">method</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded cursor-pointer">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <div className="w-2 h-2 bg-yellow-400 rounded-sm"></div>
                      </div>
                      <span className="text-gray-300">map()</span>
                      <span className="text-gray-500 text-[10px] ml-auto">method</span>
                    </div>
                  </div>
                </div>

                <div className="flex mt-8">
                  <span className="text-gray-600 w-8 text-right mr-4">5</span>
                  <span className="text-gray-300">{'}'}</span>
                </div>
              </div>
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