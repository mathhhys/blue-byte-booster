import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const EnterpriseCTA = () => {
  return (
    <section className="py-24 bg-transparent">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Join 50k+
              <br />
              teams
              <br />
              building with
              <br />
              Softcodes
            </h2>
            <Button
              size="lg"
              className="bg-black text-white hover:bg-gray-800 px-8 py-4 text-lg font-medium rounded-lg transition-all duration-200 hover:scale-105"
            >
              Contact Sales Today
            </Button>
          </div>

          {/* Right Demo Image */}
          <div className="relative">
            <Card className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg overflow-hidden">
              <div className="p-6">
                {/* Mock IDE Interface */}
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                  {/* IDE Header */}
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-700">
                    <div className="flex gap-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <span className="text-gray-400 ml-2">main.tsx</span>
                  </div>
                  
                  {/* Code Content */}
                  <div className="space-y-2">
                    <div className="text-gray-400">
                      <span className="text-purple-400">import</span>{" "}
                      <span className="text-blue-400">React</span>{" "}
                      <span className="text-purple-400">from</span>{" "}
                      <span className="text-green-400">'react'</span>
                    </div>
                    <div className="text-gray-400">
                      <span className="text-purple-400">import</span>{" "}
                      <span className="text-blue-400">{"{ useState }"}</span>{" "}
                      <span className="text-purple-400">from</span>{" "}
                      <span className="text-green-400">'react'</span>
                    </div>
                    <div className="h-4"></div>
                    <div className="text-gray-400">
                      <span className="text-purple-400">const</span>{" "}
                      <span className="text-blue-400">App</span>{" "}
                      <span className="text-white">=</span>{" "}
                      <span className="text-yellow-400">()</span>{" "}
                      <span className="text-purple-400">=&gt;</span>{" "}
                      <span className="text-yellow-400">{"{"}</span>
                    </div>
                    <div className="text-gray-400 ml-4">
                      <span className="text-purple-400">const</span>{" "}
                      <span className="text-white">[</span>
                      <span className="text-blue-400">count</span>
                      <span className="text-white">,</span>{" "}
                      <span className="text-blue-400">setCount</span>
                      <span className="text-white">]</span>{" "}
                      <span className="text-white">=</span>{" "}
                      <span className="text-yellow-400">useState</span>
                      <span className="text-white">(</span>
                      <span className="text-orange-400">0</span>
                      <span className="text-white">)</span>
                    </div>
                    <div className="h-4"></div>
                    <div className="text-gray-400 ml-4">
                      <span className="text-purple-400">return</span>{" "}
                      <span className="text-white">(</span>
                    </div>
                    <div className="text-gray-400 ml-8">
                      <span className="text-red-400">&lt;div</span>{" "}
                      <span className="text-blue-400">className</span>
                      <span className="text-white">=</span>
                      <span className="text-green-400">"app"</span>
                      <span className="text-red-400">&gt;</span>
                    </div>
                    <div className="text-gray-400 ml-12">
                      <span className="text-red-400">&lt;h1&gt;</span>
                      <span className="text-white">Count: {"{count}"}</span>
                      <span className="text-red-400">&lt;/h1&gt;</span>
                    </div>
                    
                    {/* AI Suggestion Popup */}
                    <div className="relative ml-12">
                      <div className="absolute -top-2 left-0 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs shadow-lg border border-blue-500">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span>AI suggests: Add increment button</span>
                        </div>
                        <div className="absolute -bottom-1 left-4 w-2 h-2 bg-blue-600 rotate-45"></div>
                      </div>
                      <span className="text-red-400">&lt;button</span>{" "}
                      <span className="text-blue-400">onClick</span>
                      <span className="text-white">=</span>
                      <span className="text-yellow-400">{"{"}</span>
                      <span className="text-white">() =&gt; setCount(count + 1)</span>
                      <span className="text-yellow-400">{"}"}</span>
                      <span className="text-red-400">&gt;</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EnterpriseCTA;