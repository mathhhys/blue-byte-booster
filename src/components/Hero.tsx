import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const Hero = () => {
  return (
    <section className="min-h-screen flex items-center justify-center hero-gradient relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 gradient-mesh opacity-30"></div>
      <div className="absolute top-20 left-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }}></div>
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Hero content */}
          <div className="text-center lg:text-left">
            <div className="inline-block mb-6">
              <span className="glass px-4 py-2 rounded-full text-sm font-medium text-accent">
                ✨ Now with AI Agent Mode
              </span>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                The AI Code
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Copilot
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
              Built to make you extraordinarily productive. Experience the next generation 
              of AI-powered coding with intelligent suggestions, seamless collaboration, and 
              lightning-fast development.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button variant="hero" size="lg" className="text-lg px-8 py-6">
                🍎 Download for macOS
              </Button>
              <Button variant="glass" size="lg" className="text-lg px-8 py-6">
                Explore Features
              </Button>
            </div>
            
            <div className="mt-8">
              <p className="text-sm text-muted-foreground mb-4">
                Already have Visual Studio Code? 
                <a href="#" className="text-primary hover:text-accent transition-colors ml-1 underline">
                  Install Extension
                </a>
              </p>
            </div>
          </div>
          
          {/* Right side - Code editor preview placeholder */}
          <div className="relative">
            <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-destructive rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-xs text-muted-foreground">main.py</span>
                </div>
                
                {/* Code preview placeholder */}
                <div className="space-y-3 font-mono text-sm">
                  <div className="text-muted-foreground"># AI-powered code suggestions</div>
                  <div className="text-foreground">
                    <span className="text-purple-400">def</span>{" "}
                    <span className="text-blue-400">analyze_data</span>
                    <span className="text-yellow-400">(</span>
                    <span className="text-orange-400">dataset</span>
                    <span className="text-yellow-400">):</span>
                  </div>
                  <div className="text-muted-foreground pl-4"># AI suggests optimal implementation</div>
                  <div className="pl-4 bg-primary/10 p-2 rounded border-l-2 border-primary">
                    <div className="text-sm text-primary mb-1">💡 AI Suggestion</div>
                    <div className="text-xs text-muted-foreground">
                      Analyzing your dataset... Suggesting pandas optimization
                    </div>
                  </div>
                  <div className="text-foreground pl-4">
                    <span className="text-purple-400">return</span>{" "}
                    <span className="text-green-400">optimized_result</span>
                  </div>
                </div>
                
                <div className="mt-6 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center space-x-2 text-xs">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span className="text-muted-foreground">AI is analyzing your code...</span>
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

export default Hero;