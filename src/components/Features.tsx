import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Features = () => {
  const features = [
    {
      icon: "🧠",
      title: "Intelligent Code Completion",
      description: "Advanced AI understands your codebase and provides contextual suggestions that actually make sense."
    },
    {
      icon: "⚡",
      title: "Lightning Fast",
      description: "Optimized for speed with instant suggestions and seamless integration into your workflow."
    },
    {
      icon: "🔒",
      title: "Privacy First",
      description: "Your code stays secure. Local processing with optional cloud features you control."
    },
    {
      icon: "🎯",
      title: "Context Aware",
      description: "Understands your project structure, coding patterns, and preferences to deliver personalized assistance."
    },
    {
      icon: "🔧",
      title: "Multi-Language Support",
      description: "Works seamlessly across all major programming languages and frameworks."
    },
    {
      icon: "🤖",
      title: "AI Agent Mode",
      description: "Let AI handle complex refactoring, bug fixes, and feature implementation autonomously."
    }
  ];

  return (
    <section id="features" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Supercharge Your Development
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Experience coding with an AI that truly understands your intent and helps you write better code faster.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="glass hover:bg-white/10 transition-all duration-300 hover:scale-105">
              <CardHeader>
                <div className="text-4xl mb-4">{feature.icon}</div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;