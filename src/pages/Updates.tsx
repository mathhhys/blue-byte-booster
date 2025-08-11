import React from "react";
import Navigation from "../components/Navigation";
import GradientBackground from "../components/GradientBackground";

const updates = [
  {
    date: "2025-08-10",
    title: "New Feature Release: AI-Powered Suggestions",
    description:
      "We've added AI-powered suggestions throughout the platform to help you work faster and smarter.",
  },
  {
    date: "2025-08-05",
    title: "Improved Accessibility",
    description:
      "Major improvements to keyboard navigation, contrast ratios, and screen reader support for better accessibility.",
  },
  {
    date: "2025-08-01",
    title: "Performance Optimization",
    description:
      "We've optimized database queries and caching, resulting in up to 40% faster load times.",
  },
];

export default function Updates() {
  return (
    <div className="relative min-h-screen flex flex-col text-white">
      {/* Background */}
      <GradientBackground>
        {/* Page Content on gradient background */}
        <Navigation />
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 lg:pt-40 pb-12 sm:pb-16 lg:pb-20 relative z-10">
          <header className="mb-12 sm:mb-16 lg:mb-20 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-6 text-white">
              Product Updates
            </h1>
            <p className="text-lg sm:text-xl lg:text-2xl text-white max-w-2xl lg:max-w-3xl mx-auto px-2">
              Stay informed with the latest news and changelogs.
            </p>
          </header>
          <div className="space-y-6 sm:space-y-8 lg:space-y-10 pb-12 sm:pb-16 lg:pb-20">
            {updates.map((update, index) => (
              <div
                key={index}
                className="p-4 sm:p-6 lg:p-8 rounded-lg border border-border shadow-lg bg-card/80 backdrop-blur-md transition-all duration-300 hover:shadow-xl hover:bg-card/90"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 sm:mb-4 gap-2 sm:gap-4">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold leading-tight pr-0 sm:pr-4 text-white">
                    {update.title}
                  </h2>
                  <span className="text-sm sm:text-base text-white whitespace-nowrap flex-shrink-0 font-medium">
                    {update.date}
                  </span>
                </div>
                <p className="text-sm sm:text-base lg:text-lg text-white leading-relaxed">
                  {update.description}
                </p>
              </div>
            ))}
          </div>
        </main>
      </GradientBackground>
    </div>
  );
}