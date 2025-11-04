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
      <div className="mx-auto flex flex-col gap-14 md:px-8 lg:px-12 xl:px-16">
        {/* Header */}
        <div className="text-center mb-12">
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

        {/* 3 Blocks Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12">
          {/* Block 1: Adaptive Learning */}
          <EnhancedCard
            variant="secondary"
            className="card-hover rounded-xl shadow-lg shadow-blue-500/10 border-blue-500/20 min-h-[450px]"
            aria-label="Adaptive Learning"
          >
            <EnhancedCardContent className="p-6 flex flex-col gap-6 items-center text-center md:text-left md:items-start">
              <div className="flex-1 min-w-0 w-full hidden md:block">
                <div className="w-full h-64 bg-[#181f33] rounded-lg relative overflow-hidden border border-blue-500/20">
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
              <div className="flex-1 space-y-3">
                <h3 className="text-lg md:text-xl font-bold text-white">Adaptive Learning</h3>
                <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                  Adaptive learning continuously improves performance and adapts to new patterns.
                </p>
                <div className="md:hidden w-full h-48 bg-[#181f33] rounded-lg relative overflow-hidden border border-blue-500/20">
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-contain rounded-lg"
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
            className="card-hover rounded-xl shadow-lg shadow-blue-500/10 border-blue-500/20 min-h-[450px]"
            aria-label="Smart Automation"
          >
            <EnhancedCardContent className="p-6 flex flex-col gap-6 items-center text-center md:text-left md:items-start">
              <div className="flex-1 min-w-0 w-full hidden md:block">
                <div className="w-full h-64 bg-[#181f33] rounded-lg flex flex-col justify-center items-start p-4 relative overflow-hidden border border-blue-500/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent rounded-lg"></div>
                  <div className="relative z-10 space-y-2 text-blue-200 pl-2">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-400 rounded mr-2"></div>
                      <span className="text-xs font-medium">Manage</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-400 rounded mr-2"></div>
                      <span className="text-xs font-medium">Generate</span>
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-2 w-16 h-1 bg-blue-400 rounded-full"></div>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <h3 className="text-lg md:text-xl font-bold text-white">Smart Automation</h3>
                <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                  Empower automation-driven workflows to simplify operations, enhance productivity.
                </p>
                <div className="md:hidden w-full h-48 bg-[#181f33] rounded-lg flex flex-col justify-center items-start p-4 relative overflow-hidden border border-blue-500/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent rounded-lg"></div>
                  <div className="relative z-10 space-y-2 text-blue-200 pl-2">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-400 rounded mr-2"></div>
                      <span className="text-xs font-medium">Manage</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-400 rounded mr-2"></div>
                      <span className="text-xs font-medium">Generate</span>
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-2 w-16 h-1 bg-blue-400 rounded-full"></div>
                </div>
              </div>
            </EnhancedCardContent>
          </EnhancedCard>

          {/* Block 3: Data Mapping & Predictive Analytics */}
          <EnhancedCard
            variant="secondary"
            className="card-hover rounded-xl shadow-lg shadow-blue-500/10 border-blue-500/20 min-h-[450px]"
            aria-label="Data Mapping & Predictive Analytics"
          >
            <EnhancedCardContent className="p-6 flex flex-col gap-6 items-center text-center md:text-left md:items-start">
              <div className="flex-1 min-w-0 w-full hidden md:block">
                <div className="w-full h-64 bg-[#181f33] rounded-lg flex justify-center items-center p-4 relative overflow-hidden border border-blue-500/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent rounded-lg"></div>
                  <div className="relative z-10 grid grid-cols-2 gap-2 w-full max-w-xs h-32 p-2">
                    <div className="space-y-1">
                      <div className="h-6 bg-blue-300/30 rounded w-full"></div>
                      <div className="h-6 bg-blue-400/30 rounded w-3/4"></div>
                      <div className="h-6 bg-blue-300/30 rounded w-full"></div>
                    </div>
                    <div className="flex items-end justify-end">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        AI
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 w-4 h-4 bg-blue-400 rounded-full"></div>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <h3 className="text-lg md:text-xl font-bold text-white">Data Mapping & Predictive Analytics</h3>
                <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                  Data mapping visualizes complex data structures. Predictive analytics harness advanced models for future trends.
                </p>
                <div className="md:hidden w-full h-48 bg-[#181f33] rounded-lg flex justify-center items-center p-4 relative overflow-hidden border border-blue-500/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent rounded-lg"></div>
                  <div className="relative z-10 grid grid-cols-2 gap-2 w-full max-w-xs h-32 p-2">
                    <div className="space-y-1">
                      <div className="h-6 bg-blue-300/30 rounded w-full"></div>
                      <div className="h-6 bg-blue-400/30 rounded w-3/4"></div>
                      <div className="h-6 bg-blue-300/30 rounded w-full"></div>
                    </div>
                    <div className="flex items-end justify-end">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        AI
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 w-4 h-4 bg-blue-400 rounded-full"></div>
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