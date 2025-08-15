import { Button } from "@/components/ui/button";
import GradientBackground from "@/components/GradientBackground";
import { useNavigate } from 'react-router-dom';

const EnterpriseHero = () => {
  const navigate = useNavigate();

  return (
    <GradientBackground>
      <section className="min-h-screen flex items-center justify-center pt-24 pb-16">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-8 leading-tight mt-16">
              Maximize developer
              <br />
              output securely
              <br />
              and at scale
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              For large organizations that need to scale their development efforts without compromising on security or control.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button
                size="lg"
                className="bg-[#0052cc] text-white hover:bg-[#0052cc]/90 px-8 py-4 text-lg font-medium rounded-lg transition-all duration-200 hover:scale-105"
                onClick={() => navigate('/pricing')}
              >
                Explore Team Plans
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-medium rounded-lg transition-all duration-300 hover:scale-105 backdrop-blur-sm"
                size="lg"
              >
                Explore Features
              </Button>
            </div>

            {/* VS Code 5-star review */}
            <div className="flex justify-center mb-8">
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
          </div>
        </div>
      </section>
    </GradientBackground>
  );
};

export default EnterpriseHero;