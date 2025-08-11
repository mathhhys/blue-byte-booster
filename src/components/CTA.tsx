import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const CTA = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <Card className="gradient-primary p-12 text-center relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
          
          <div className="relative z-10">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6 text-white">
              Ready to Transform Your Coding?
            </h2>
            <p className="text-xl text-white/80 mb-8 max-w-3xl mx-auto">
              Join thousands of developers who are already coding faster and smarter with our AI copilot. 
              Start your free trial today and experience the future of development.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {!isLoaded || !isSignedIn ? (
                <Button
                  onClick={() => navigate('/sign-up')}
                  variant="glass"
                  size="lg"
                  className="text-lg px-8 py-6 bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  🚀 Start Free Trial
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/dashboard')}
                  variant="glass"
                  size="lg"
                  className="text-lg px-8 py-6 bg-white/20 hover:bg-white/30 text-white border-white/30"
                >
                  🚀 Go to Dashboard
                </Button>
              )}
              <Button
                onClick={() => navigate('/pricing')}
                variant="outline"
                size="lg"
                className="text-lg px-8 py-6 border-white/30 text-white hover:bg-white/10"
              >
                View Pricing
              </Button>
            </div>
            
            <div className="mt-8 text-sm text-white/60">
              No credit card required • 14-day free trial • Cancel anytime
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};

export default CTA;