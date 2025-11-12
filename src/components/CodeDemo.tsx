import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CodeDemo = () => {
  return (
    <section className="py-24 hero-gradient">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              See AI in Action
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Watch how our AI copilot transforms your coding experience with intelligent suggestions and automated improvements.
          </p>
        </div>
        
        <div className="max-w-6xl mx-auto">
          <Card className="bg-card/30 border-border/30 backdrop-blur-sm overflow-hidden">
            {/* Terminal header */}
            <div className="bg-muted/20 border-b border-border/30 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-destructive rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-sm text-muted-foreground">AI Copilot Demo</span>
                </div>
                <Button variant="ghost" size="sm">
                  <span className="text-xs">Play Demo</span>
                </Button>
              </div>
            </div>
            
            {/* Demo content placeholder */}
            <div className="p-8">
              <div className="bg-muted/10 rounded-lg p-8 text-center">
                <div className="text-6xl mb-4">🎬</div>
                <h3 className="text-2xl font-semibold mb-2">Interactive Demo Coming Soon</h3>
                <p className="text-muted-foreground">
                  This area will showcase an interactive demo of the AI copilot in action.
                  Users will be able to see real-time code suggestions, completions, and AI-powered features.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default CodeDemo;