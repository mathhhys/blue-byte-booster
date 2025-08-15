import React from 'react';

const StatsSection = () => {
  const stats = [
    {
      number: "1M+",
      title: "Number of users",
      description: "Trusted by over a million innovators, creators, and teams worldwide"
    },
    {
      number: "4,000+",
      title: "Enterprise customers", 
      description: "Trusted by startups, agencies, and enterprises worldwide."
    },
    {
      number: "94%",
      title: "Percent of code written by AI",
      description: "Our AI removes the vast amounts of time spent of boilerplate and menial tasks so that you can focus on the fun and creative parts of building."
    }
  ];

  return (
    <section className="stats-gradient-bg py-24 px-4 md:px-6 lg:px-8">
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
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
            Trusted by Developers.
            <br />
            Proven in Enterprises.
          </h2>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-16">
          {stats.map((stat, index) => (
            <div key={index} className="text-center lg:text-left">
              {/* Large Number */}
              <div className="mb-4">
                <span className="text-5xl md:text-6xl lg:text-7xl font-bold text-white">
                  {stat.number}
                </span>
              </div>
              
              {/* Title */}
              <h3 className="text-lg md:text-xl font-semibold text-white mb-4">
                {stat.title}
              </h3>
              
              {/* Description */}
              <p className="text-white/80 text-base md:text-lg leading-relaxed max-w-sm mx-auto lg:mx-0">
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