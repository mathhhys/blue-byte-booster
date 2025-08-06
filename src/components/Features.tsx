import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Zap, Shield, Target, Code, Bot, Sparkles, Clock } from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: <Brain className="w-8 h-8" />,
      title: "Intelligent Code Completion",
      description: "Advanced AI understands your codebase context and provides smart suggestions that actually make sense for your project."
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Lightning Fast Responses",
      description: "Get instant AI suggestions with sub-50ms response times. No waiting, just seamless coding flow."
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Privacy-First Architecture",
      description: "Your code stays secure with local processing. Optional cloud features are fully under your control."
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: "Context-Aware Intelligence",
      description: "Understands your project structure, coding patterns, and preferences to deliver personalized assistance."
    },
    {
      icon: <Code className="w-8 h-8" />,
      title: "Multi-Language Support",
      description: "Works seamlessly across JavaScript, TypeScript, Python, Go, Rust, and 20+ other programming languages."
    },
    {
      icon: <Bot className="w-8 h-8" />,
      title: "AI Agent Mode",
      description: "Let Softcodes handle complex refactoring, bug fixes, and feature implementation autonomously."
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "Smart Error Detection",
      description: "Proactively identifies potential bugs and suggests fixes before you even run your code."
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: "Real-time Collaboration",
      description: "Share AI insights with your team and learn from collective coding patterns and best practices."
    }
  ];

  return (
    <section id="features" className="py-24 bg-background relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl"></div>
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-block mb-4">
            <span className="glass px-4 py-2 rounded-full text-sm font-medium text-accent">
              ✨ Powered by Advanced AI
            </span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Supercharge Your Development
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Experience coding with an AI that truly understands your intent and helps you write better code faster than ever before.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="glass hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/10 group"
            >
              <CardHeader className="pb-4">
                <div className="text-primary mb-4 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <CardTitle className="text-lg leading-tight">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Call-to-action section */}
        <div className="mt-20 text-center">
          <div className="glass p-8 rounded-2xl max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">
              Ready to transform your coding experience?
            </h3>
            <p className="text-muted-foreground mb-6">
              Join thousands of developers who are already coding faster and smarter with Softcodes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-lg font-medium transition-colors">
                Install VS Code Extension
              </button>
              <button className="border border-border hover:bg-white/5 px-6 py-3 rounded-lg font-medium transition-colors">
                View Documentation
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;