import React from 'react';

const StatsSection = () => {
    const stats = [
    {
      number: "28%",
      title: "Faster Coding Speed",
      description: "Ship features faster than ever. Our coding copilot eliminates bottlenecks and keeps you in the zone, delivering real productivity gains you'll feel from day one."
    },
    {
      number: "55.8%",
      title: "Faster Task Completion",
      description: "Cut development time in half and spend less time on repetitive work, more time building what matters."
    },
    {
      number: "95%",
      title: "Developer Satisfaction",
      description: "Developers don't just use Softcodes, they love it. Join the ones who've transformed their workflow and never looked back."
    }
  ];

  return (
    <section className="py-16 px-4 md:px-6 lg:px-8" style={{ backgroundColor: '#0F1629' }}>
      <div className="max-w-7xl mx-auto">
        {/* Stats Label */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center gap-4">
            <div className="w-8 h-px bg-white/40"></div>
            <span className="text-white/70 text-sm font-medium tracking-wider uppercase">
              STATS
            </span>
            <div className="w-8 h-px bg-white/40"></div>
          </div>
        </div>

        {/* Main Heading */}
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
            Trusted by Developers.
            <br />
            Proven in Enterprises.
          </h2>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-16">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              {/* Large Number */}
              <div className="mb-4">
                <span className="text-4xl md:text-5xl lg:text-6xl font-bold text-white">
                  {stat.number}
                </span>
              </div>
              
              {/* Title */}
              <h3 className="text-base md:text-lg font-semibold text-white mb-4">
                {stat.title}
              </h3>
              
              {/* Description */}
              <p className="text-white/80 text-sm md:text-base leading-relaxed max-w-sm mx-auto">
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;