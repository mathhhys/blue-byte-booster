import React from "react";

interface TabSectionProps {
  title: string;
  description: string;
  imageSrc?: string;
  imageAlt?: string;
  subheading: string;
  subdescription: string;
  linkHref?: string;
  linkText?: string;
}

const TabSection: React.FC<TabSectionProps> = ({
  title,
  description,
  imageSrc = "/placeholder.svg",
  imageAlt = "Feature demo",
  subheading,
  subdescription,
  linkHref = "#",
  linkText = "Learn More →",
}) => (
  <section className="w-full flex flex-col items-center py-24 bg-[#101624]">
    <h2 className="text-4xl md:text-5xl font-bold text-white text-center mb-4">
      {title}
    </h2>
    <p className="text-lg md:text-xl text-gray-300 text-center max-w-2xl mb-10">
      {description}
    </p>
    <div className="relative w-full max-w-6xl rounded-3xl overflow-hidden shadow-2xl mb-14 bg-[#181f33] p-8 md:p-16 flex justify-center items-center">
      <img
        src={imageSrc}
        alt={imageAlt}
        className="relative z-10 w-full"
        style={{ aspectRatio: "16/9", objectFit: "cover" }}
      />
      {/* Video player UI overlay */}
      <div className="absolute left-1/2 bottom-10 -translate-x-1/2 flex items-center z-20">
        <button className="bg-black/80 rounded-full p-3 mr-4">
          <svg width="32" height="32" fill="white" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <div className="w-64 h-3 bg-gray-400/60 rounded-full overflow-hidden">
          <div className="h-3 bg-white/80 rounded-full" style={{ width: "40%" }} />
        </div>
      </div>
    </div>
    <h3 className="text-2xl md:text-3xl font-semibold text-white text-center mb-2">
      {subheading}
    </h3>
    <p className="text-base md:text-lg text-gray-300 text-center max-w-xl mb-4">
      {subdescription}
    </p>
    <a
      href={linkHref}
      className="text-teal-400 font-semibold text-base md:text-lg hover:underline transition"
    >
      {linkText}
    </a>
  </section>
);

export default TabSection;