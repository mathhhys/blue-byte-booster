import {
  EnhancedCard,
  EnhancedCardHeader,
  EnhancedCardTitle,
  EnhancedCardDescription,
  EnhancedCardContent
} from "@/components/ui/enhanced-card";
import { Badge } from "@/components/ui/badge";

const ProductivitySection = () => {
  return (
    <section
      id="productivity"
      className="w-full py-16 px-4"
      style={{ backgroundColor: '#0F1629' }}
      aria-labelledby="productivity-heading"
    >
      <div className="mx-auto max-w-6xl flex flex-col gap-8 md:px-8 lg:px-12 xl:px-16">
        {/* Header */}
        <div className="text-center mb-6">
          <h2
            id="productivity-heading"
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4"
          >
            The AI-powered platform
          </h2>
          <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto">
            Unlock powerful insights and automate complex processes effortlessly.
          </p>
        </div>

        {/* 3 Blocks Stacked Vertically */}
        <div className="flex flex-col gap-5 md:gap-6">
          {/* Block 1: Adaptive Learning */}
          <EnhancedCard
            variant="secondary"
            className="card-hover rounded-xl shadow-lg shadow-blue-500/10 border-blue-500/20 w-full"
            aria-label="Adaptive Learning"
          >
            <EnhancedCardContent className="p-4 md:p-5 flex flex-col md:flex-row gap-4 md:gap-5 items-center">
              <div className="w-full md:w-2/5 space-y-1.5">
                <h3 className="text-base md:text-lg font-bold text-white">Adaptive Learning</h3>
                <p className="text-gray-300 leading-relaxed text-xs md:text-sm">
                  Adaptive learning continuously improves performance and adapts to new patterns.
                </p>
              </div>
              <div className="w-full md:w-3/5">
                <div className="w-full aspect-[4/3] bg-[#181f33] rounded-lg relative overflow-hidden border border-blue-500/20">
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover rounded-lg"
                    aria-label="Adaptive Learning demonstration video"
                  >
                    <source
                      src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-elements/Softcodes-context2.mp4"
                      type="video/mp4"
                    />
                    Your browser does not support the video tag.
                  </video>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent rounded-lg pointer-events-none"></div>
                </div>
              </div>
            </EnhancedCardContent>
          </EnhancedCard>

          {/* Block 2: Smart Automation */}
          <EnhancedCard
            variant="secondary"
            className="card-hover rounded-xl shadow-lg shadow-blue-500/10 border-blue-500/20 w-full"
            aria-label="Smart Automation"
          >
            <EnhancedCardContent className="p-4 md:p-5 flex flex-col md:flex-row gap-4 md:gap-5 items-center">
              <div className="w-full md:w-2/5 space-y-1.5">
                <h3 className="text-base md:text-lg font-bold text-white">Smart Automation</h3>
                <p className="text-gray-300 leading-relaxed text-xs md:text-sm">
                  Empower automation-driven workflows to simplify operations, enhance productivity.
                </p>
              </div>
              <div className="w-full md:w-3/5">
                <div className="w-full aspect-[4/3] bg-[#181f33] rounded-lg relative overflow-hidden border border-blue-500/20">
                  <img
                    src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-elements/Softcodes-models.png"
                    alt="Smart Automation demonstration image"
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent rounded-lg pointer-events-none"></div>
                </div>
              </div>
            </EnhancedCardContent>
          </EnhancedCard>

          {/* Block 3: Data Mapping & Predictive Analytics */}
          <EnhancedCard
            variant="secondary"
            className="card-hover rounded-xl shadow-lg shadow-blue-500/10 border-blue-500/20 w-full"
            aria-label="Data Mapping & Predictive Analytics"
          >
            <EnhancedCardContent className="p-4 md:p-5 flex flex-col md:flex-row gap-4 md:gap-5 items-center">
              <div className="w-full md:w-2/5 space-y-1.5">
                <h3 className="text-base md:text-lg font-bold text-white">Data Mapping & Predictive Analytics</h3>
                <p className="text-gray-300 leading-relaxed text-xs md:text-sm">
                  Data mapping visualizes complex data structures. Predictive analytics harness advanced models for future trends.
                </p>
              </div>
              <div className="w-full md:w-3/5">
                <div className="w-full aspect-[4/3] bg-[#181f33] rounded-lg relative overflow-hidden border border-blue-500/20">
                  <img
                    src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-elements/Softcodes%20Browser%20(1).png"
                    alt="Data Mapping & Predictive Analytics demonstration image"
                    className="w-full h-full object-contain rounded-lg"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent rounded-lg pointer-events-none"></div>
                </div>
              </div>
            </EnhancedCardContent>
          </EnhancedCard>
        </div>
      </div>
    </section>
  );
};

export default ProductivitySection;